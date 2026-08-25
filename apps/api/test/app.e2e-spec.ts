import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  UserRole,
  UserStatus,
  VerificationStatus,
  VerificationType,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EmailService } from '../src/auth/email.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { VERIFICATION_DOCUMENT_STORAGE } from '../src/verifications/verification-document-storage';

process.env.JWT_SECRET ??=
  'hira-e2e-secret-that-is-longer-than-thirty-two-characters';

describe('Hira API (e2e)', () => {
  jest.setTimeout(60_000);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = (name: string) => `e2e-${runId}-${name}@example.com`;
  const password = 'SecurePass123!';
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const sentResetEmails: { to: string; token: string }[] = [];
  let failEmailDelivery = false;
  const storedVerificationDocuments = new Map<string, Buffer>();
  const verificationStorage = {
    put: jest.fn((key: string, contents: Buffer): Promise<void> => {
      storedVerificationDocuments.set(key, contents);
      return Promise.resolve();
    }),
    delete: jest.fn((key: string): Promise<void> => {
      storedVerificationDocuments.delete(key);
      return Promise.resolve();
    }),
  };
  const emailService = {
    sendPasswordReset: jest.fn((to: string, token: string): Promise<void> => {
      if (failEmailDelivery) {
        return Promise.reject(new Error('provider unavailable'));
      }
      sentResetEmails.push({ to, token });
      return Promise.resolve();
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(emailService)
      .overrideProvider(VERIFICATION_DOCUMENT_STORAGE)
      .useValue(verificationStorage)
      .compile();
    prisma = moduleFixture.get(PrismaService);
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    failEmailDelivery = false;
    verificationStorage.put.mockClear();
    verificationStorage.delete.mockClear();
  });

  it('keeps the database health endpoint available', () =>
    request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', api: 'running', database: 'reachable' }));

  it('registers a tenant atomically with a profile and hashes the password', async () => {
    const response = await register('tenant', UserRole.TENANT).expect(201);
    expectSafeUser(getBody(response), UserRole.TENANT);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: email('tenant') },
      include: { tenantProfile: true, landlordProfile: true },
    });
    expect(stored.tenantProfile).not.toBeNull();
    expect(stored.landlordProfile).toBeNull();
    expect(stored.passwordHash).not.toBe(password);
    await expect(argon2.verify(stored.passwordHash, password)).resolves.toBe(
      true,
    );
  });

  it('registers a landlord with a landlord profile', async () => {
    const response = await register('landlord', UserRole.LANDLORD).expect(201);
    expectSafeUser(getBody(response), UserRole.LANDLORD);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: email('landlord') },
      include: { tenantProfile: true, landlordProfile: true },
    });
    expect(stored.landlordProfile).not.toBeNull();
    expect(stored.tenantProfile).toBeNull();
  });

  it('rejects duplicate normalized email addresses cleanly', async () => {
    await register('duplicate', UserRole.TENANT).expect(201);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(
        registration(
          `  ${email('duplicate').toUpperCase()}  `,
          UserRole.TENANT,
        ),
      )
      .expect(409);
  });

  it('makes ADMIN public registration impossible', () =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send(registration(email('admin'), UserRole.ADMIN))
      .expect(400));

  it('rejects whitespace-only registration names', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...registration(email('blank-first-name'), UserRole.TENANT),
        firstName: '   ',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...registration(email('blank-last-name'), UserRole.TENANT),
        lastName: '\t  ',
      })
      .expect(400);
  });

  it('logs in, reads /users/me from the database, and logs out', async () => {
    await register('session', UserRole.TENANT).expect(201);
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/auth/login')
      .send({ email: email('session'), password })
      .expect(200);
    expectSafeUser(getBody(login), UserRole.TENANT);
    expect(login.headers['set-cookie']?.[0]).toMatch(
      /hira_session=.*HttpOnly.*SameSite=Lax/i,
    );

    const me = await agent.get('/users/me').expect(200);
    expectSafeUser(getBody(me), UserRole.TENANT);
    expect(getBody(me).email).toBe(email('session'));

    await agent.post('/auth/logout').expect(204);
    await agent.get('/users/me').expect(401);
  });

  it('uses the same response for an invalid password and unknown email', async () => {
    await register('credentials', UserRole.TENANT).expect(201);
    const invalidPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('credentials'), password: 'WrongPassword!' })
      .expect(401);
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('unknown'), password })
      .expect(401);
    expect(getBody(invalidPassword).message).toBe('Invalid email or password');
    expect(getBody(unknownEmail).message).toBe(
      getBody(invalidPassword).message,
    );
  });

  it('rejects suspended login and invalidates an existing session on /users/me', async () => {
    await register('suspended', UserRole.LANDLORD).expect(201);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email: email('suspended'), password })
      .expect(200);
    await prisma.user.update({
      where: { email: email('suspended') },
      data: { status: UserStatus.SUSPENDED },
    });
    await agent.get('/users/me').expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('suspended'), password })
      .expect(401);
  });

  it('rejects unauthenticated /users/me', () =>
    request(app.getHttpServer()).get('/users/me').expect(401));

  it('returns the same forgot-password response for known and unknown emails', async () => {
    await register('forgot-known', UserRole.TENANT).expect(201);
    const known = await forgotPassword(email('forgot-known')).expect(202);
    const callsAfterKnown = emailService.sendPasswordReset.mock.calls.length;
    const unknown = await forgotPassword(email('forgot-unknown')).expect(202);

    expect(getBody(known)).toEqual(getBody(unknown));
    expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
      email('forgot-known'),
      expect.any(String),
    );
    expect(emailService.sendPasswordReset).toHaveBeenCalledTimes(
      callsAfterKnown,
    );
  });

  it('stores only a reset-token hash', async () => {
    await register('hashed-reset', UserRole.TENANT).expect(201);
    await forgotPassword(email('hashed-reset')).expect(202);
    const rawToken = resetTokenFor(email('hashed-reset'));
    const stored = await prisma.passwordResetToken.findFirstOrThrow({
      where: { user: { email: email('hashed-reset') } },
    });

    expect(stored.tokenHash).not.toBe(rawToken);
    expect(stored.tokenHash).toBe(hashToken(rawToken));
  });

  it('resets the password once, invalidates sessions and outstanding tokens', async () => {
    await register('reset-success', UserRole.LANDLORD).expect(201);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email: email('reset-success'), password })
      .expect(200);

    await forgotPassword(email('reset-success')).expect(202);
    const firstToken = resetTokenFor(email('reset-success'));
    await forgotPassword(email('reset-success')).expect(202);
    const secondToken = resetTokenFor(email('reset-success'));
    const newPassword = 'NewSecurePass456!';

    await resetPassword(firstToken, newPassword).expect(200);
    await agent.get('/users/me').expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('reset-success'), password })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('reset-success'), password: newPassword })
      .expect(200);
    await resetPassword(firstToken, 'AnotherPass789!').expect(400);
    await resetPassword(secondToken, 'AnotherPass789!').expect(400);

    const outstanding = await prisma.passwordResetToken.count({
      where: {
        user: { email: email('reset-success') },
        usedAt: null,
      },
    });
    expect(outstanding).toBe(0);
  });

  it('allows only one concurrent reset attempt for the same token', async () => {
    await register('concurrent-reset', UserRole.TENANT).expect(201);

    await forgotPassword(email('concurrent-reset')).expect(202);
    const token = resetTokenFor(email('concurrent-reset'));

    const [first, second] = await Promise.all([
      resetPassword(token, 'ConcurrentPass123!'),
      resetPassword(token, 'ConcurrentPass456!'),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 400]);
  });

  it('rejects invalid and expired reset tokens safely', async () => {
    await register('expired-reset', UserRole.TENANT).expect(201);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: email('expired-reset') },
    });
    const expiredToken = 'expired-reset-token';
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(expiredToken),
        expiresAt: new Date(Date.now() - 1_000),
      },
    });

    const invalid = await resetPassword('not-a-real-token', password).expect(
      400,
    );
    const expired = await resetPassword(expiredToken, password).expect(400);
    expect(getBody(expired).message).toBe(getBody(invalid).message);
  });

  it('does not reset a suspended account', async () => {
    await register('suspended-reset', UserRole.TENANT).expect(201);
    await forgotPassword(email('suspended-reset')).expect(202);
    const token = resetTokenFor(email('suspended-reset'));
    await prisma.user.update({
      where: { email: email('suspended-reset') },
      data: { status: UserStatus.SUSPENDED },
    });

    await resetPassword(token, 'NewSecurePass456!').expect(400);
    const beforeCalls = emailService.sendPasswordReset.mock.calls.length;
    await forgotPassword(email('suspended-reset')).expect(202);
    expect(emailService.sendPasswordReset).toHaveBeenCalledTimes(beforeCalls);
  });

  it('keeps the safe response when email delivery fails', async () => {
    await register('email-failure', UserRole.TENANT).expect(201);
    failEmailDelivery = true;

    await forgotPassword(email('email-failure')).expect(202);
    expect(
      await prisma.passwordResetToken.count({
        where: { user: { email: email('email-failure') } },
      }),
    ).toBe(1);
  });

  it('applies registration password validation to password reset', () =>
    resetPassword('any-token', 'short').expect(400));

  it('reads and atomically updates a tenant profile with derived verification', async () => {
    const agent = await authenticatedAgent('profile-tenant', UserRole.TENANT);
    const initial = await agent.get('/users/me').expect(200);
    expect(getBody(initial)).toMatchObject({
      email: email('profile-tenant'),
      role: UserRole.TENANT,
      phone: null,
      contactMethod: null,
      verificationStatus: 'NOT_SUBMITTED',
      tenantProfile: { institution: null, expectedMoveIn: null },
    });
    expectNoSensitiveProfileFields(getBody(initial));

    const updated = await agent
      .patch('/users/me')
      .send({
        firstName: '  Mpho  ',
        lastName: '  Student  ',
        phone: '  +266 5000 0000  ',
        contactMethod: '  WhatsApp  ',
        institution: '  National University of Lesotho  ',
        expectedMoveIn: '2026-09-15',
      })
      .expect(200);
    expect(getBody(updated)).toMatchObject({
      firstName: 'Mpho',
      lastName: 'Student',
      phone: '+266 5000 0000',
      contactMethod: 'WhatsApp',
      tenantProfile: {
        institution: 'National University of Lesotho',
        expectedMoveIn: '2026-09-15T00:00:00.000Z',
      },
    });

    await agent
      .patch('/users/me')
      .send({ expectedMoveIn: '2026-09-15T12:30:00.000Z' })
      .expect(400);

    const clearedMoveIn = await agent
      .patch('/users/me')
      .send({ expectedMoveIn: null })
      .expect(200);
    expect(getBody(clearedMoveIn)).toMatchObject({
      tenantProfile: { expectedMoveIn: null },
    });

    const partial = await agent
      .patch('/users/me')
      .send({ phone: null })
      .expect(200);
    expect(getBody(partial)).toMatchObject({
      firstName: 'Mpho',
      phone: null,
      tenantProfile: { institution: 'National University of Lesotho' },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: email('profile-tenant') },
    });
    await prisma.verification.createMany({
      data: [
        {
          userId: user.id,
          type: VerificationType.STUDENT,
          status: VerificationStatus.APPROVED,
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
        },
        {
          userId: user.id,
          type: VerificationType.STUDENT,
          status: VerificationStatus.REJECTED,
          createdAt: new Date('2026-08-02T00:00:00.000Z'),
        },
      ],
    });
    const verified = await agent.get('/users/me').expect(200);
    expect(getBody(verified).verificationStatus).toBe(
      VerificationStatus.REJECTED,
    );
    expectNoSensitiveProfileFields(getBody(verified));
  });

  it('reads and updates only landlord profile fields', async () => {
    const agent = await authenticatedAgent(
      'profile-landlord',
      UserRole.LANDLORD,
    );
    const updated = await agent
      .patch('/users/me')
      .send({
        firstName: '  Lineo  ',
        phone: '  +266 5111 1111 ',
        organisation: '  Maseru Student Homes  ',
        propertyCount: 4,
      })
      .expect(200);

    expect(getBody(updated)).toMatchObject({
      firstName: 'Lineo',
      phone: '+266 5111 1111',
      role: UserRole.LANDLORD,
      verificationStatus: 'NOT_SUBMITTED',
      landlordProfile: {
        organisation: 'Maseru Student Homes',
        propertyCount: 4,
      },
    });
    expect(getBody(updated)).not.toHaveProperty('tenantProfile');
    expectNoSensitiveProfileFields(getBody(updated));
  });

  it('returns only common safe fields for an admin profile', async () => {
    await prisma.user.create({
      data: {
        email: email('profile-admin'),
        firstName: 'Hira',
        lastName: 'Admin',
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        role: UserRole.ADMIN,
      },
    });
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email: email('profile-admin'), password })
      .expect(200);
    const response = await agent.get('/users/me').expect(200);

    expect(getBody(response)).toMatchObject({ role: UserRole.ADMIN });
    expect(getBody(response)).not.toHaveProperty('tenantProfile');
    expect(getBody(response)).not.toHaveProperty('landlordProfile');
    expect(getBody(response)).not.toHaveProperty('verificationStatus');
    expectNoSensitiveProfileFields(getBody(response));
  });

  it('rejects invalid and role-incompatible profile fields', async () => {
    const tenant = await authenticatedAgent(
      'profile-rules-tenant',
      UserRole.TENANT,
    );
    const landlord = await authenticatedAgent(
      'profile-rules-landlord',
      UserRole.LANDLORD,
    );

    await tenant.patch('/users/me').send({ firstName: '   ' }).expect(400);
    await landlord.patch('/users/me').send({ propertyCount: -1 }).expect(400);
    await tenant
      .patch('/users/me')
      .send({ organisation: 'Not allowed' })
      .expect(400);
    await landlord
      .patch('/users/me')
      .send({ institution: 'Not allowed' })
      .expect(400);

    for (const forbidden of [
      { email: 'changed@example.com' },
      { role: UserRole.ADMIN },
      { status: UserStatus.SUSPENDED },
      { authVersion: 99 },
      { verificationStatus: VerificationStatus.APPROVED },
    ]) {
      await tenant.patch('/users/me').send(forbidden).expect(400);
    }
  });

  it('rejects unauthenticated profile updates and cannot target another user', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .send({ firstName: 'Blocked' })
      .expect(401);

    const owner = await authenticatedAgent('profile-owner', UserRole.TENANT);
    await register('profile-other', UserRole.TENANT).expect(201);
    const other = await prisma.user.findUniqueOrThrow({
      where: { email: email('profile-other') },
    });
    await owner
      .patch('/users/me')
      .send({ id: other.id, firstName: 'Cannot target another user' })
      .expect(400);
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: other.id } }),
    ).toMatchObject({ firstName: 'Hira' });
  });

  it('submits student documents, exposes safe metadata, and blocks duplicates', async () => {
    const agent = await authenticatedAgent(
      'verification-student',
      UserRole.TENANT,
    );
    const initial = await agent.get('/verifications/me').expect(200);
    expect(getBody(initial)).toMatchObject({
      id: null,
      type: VerificationType.STUDENT,
      status: 'NOT_SUBMITTED',
      documents: [],
    });

    const submitted = await agent
      .post('/verifications')
      .attach('documents', Buffer.from('student card'), {
        filename: 'student-card.pdf',
        contentType: 'application/pdf',
      })
      .attach('documents', Buffer.from('enrolment proof'), {
        filename: 'proof.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(getBody(submitted)).toMatchObject({
      type: VerificationType.STUDENT,
      status: VerificationStatus.PENDING,
      documents: [
        { originalName: 'student-card.pdf', mimeType: 'application/pdf' },
        { originalName: 'proof.png', mimeType: 'image/png' },
      ],
    });
    expect(JSON.stringify(submitted.body)).not.toContain('objectKey');
    expect(verificationStorage.put).toHaveBeenCalledTimes(2);

    const profile = await agent.get('/users/me').expect(200);
    expect(getBody(profile).verificationStatus).toBe(
      VerificationStatus.PENDING,
    );
    await agent
      .post('/verifications')
      .attach('documents', Buffer.from('again'), {
        filename: 'again.pdf',
        contentType: 'application/pdf',
      })
      .expect(409);
  });

  it('allows a rejected submission to be replaced while preserving history', async () => {
    const agent = await authenticatedAgent(
      'verification-resubmit',
      UserRole.TENANT,
    );
    await agent
      .post('/verifications')
      .attach('documents', Buffer.from('first'), {
        filename: 'first.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: email('verification-resubmit') },
    });
    await prisma.verification.updateMany({
      where: { userId: user.id },
      data: {
        status: VerificationStatus.REJECTED,
        rejectionReason: 'The document is unreadable.',
      },
    });

    const rejected = await agent.get('/verifications/me').expect(200);
    expect(getBody(rejected)).toMatchObject({
      status: VerificationStatus.REJECTED,
      rejectionReason: 'The document is unreadable.',
    });
    await agent
      .post('/verifications')
      .attach('documents', Buffer.from('replacement'), {
        filename: 'replacement.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    expect(
      await prisma.verification.count({ where: { userId: user.id } }),
    ).toBe(2);
    await prisma.verification.updateMany({
      where: { userId: user.id, status: VerificationStatus.PENDING },
      data: { status: VerificationStatus.APPROVED },
    });
    await agent
      .post('/verifications')
      .attach('documents', Buffer.from('not allowed'), {
        filename: 'third.pdf',
        contentType: 'application/pdf',
      })
      .expect(409);
  });

  it('enforces landlord, MIME, body, role, and authentication rules', async () => {
    const landlord = await authenticatedAgent(
      'verification-landlord',
      UserRole.LANDLORD,
    );
    await landlord
      .post('/verifications')
      .attach('documents', Buffer.from('one'), {
        filename: 'one.pdf',
        contentType: 'application/pdf',
      })
      .attach('documents', Buffer.from('two'), {
        filename: 'two.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    await landlord
      .post('/verifications')
      .attach('documents', Buffer.from('registration'), {
        filename: 'registration.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    await landlord
      .post('/verifications')
      .attach('documents', Buffer.from('text'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    await landlord
      .post('/verifications')
      .field('status', VerificationStatus.APPROVED)
      .attach('documents', Buffer.from('valid'), {
        filename: 'registration.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/verifications')
      .attach('documents', Buffer.from('valid'), {
        filename: 'valid.pdf',
        contentType: 'application/pdf',
      })
      .expect(401);

    await prisma.user.create({
      data: {
        email: email('verification-admin'),
        firstName: 'Hira',
        lastName: 'Admin',
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        role: UserRole.ADMIN,
      },
    });
    const admin = request.agent(app.getHttpServer());
    await admin
      .post('/auth/login')
      .send({ email: email('verification-admin'), password })
      .expect(200);
    await admin
      .post('/verifications')
      .attach('documents', Buffer.from('valid'), {
        filename: 'valid.pdf',
        contentType: 'application/pdf',
      })
      .expect(403);
  });

  it('rejects missing, excessive, and oversized student documents', async () => {
    const agent = await authenticatedAgent(
      'verification-file-limits',
      UserRole.TENANT,
    );
    await agent.post('/verifications').expect(400);

    const excessive = agent.post('/verifications');
    for (let index = 0; index < 4; index += 1) {
      excessive.attach('documents', Buffer.from(`document-${index}`), {
        filename: `document-${index}.pdf`,
        contentType: 'application/pdf',
      });
    }
    await excessive.expect(400);

    await agent
      .post('/verifications')
      .attach('documents', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'oversized.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);
  });

  it('does not expose another user or private storage identifiers', async () => {
    const first = await authenticatedAgent(
      'verification-private-first',
      UserRole.TENANT,
    );
    const second = await authenticatedAgent(
      'verification-private-second',
      UserRole.TENANT,
    );
    await first
      .post('/verifications')
      .attach('documents', Buffer.from('private'), {
        filename: 'private.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const response = await second.get('/verifications/me').expect(200);
    expect(getBody(response)).toMatchObject({ status: 'NOT_SUBMITTED' });
    expect(JSON.stringify(response.body)).not.toContain('objectKey');
    expect(JSON.stringify(response.body)).not.toContain('verifications/');
  });

  function registration(accountEmail: string, role: UserRole) {
    return {
      firstName: 'Hira',
      lastName: 'Tester',
      email: accountEmail,
      password,
      role,
    };
  }

  function register(name: string, role: UserRole) {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send(registration(email(name), role));
  }

  async function authenticatedAgent(name: string, role: UserRole) {
    await register(name, role).expect(201);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email: email(name), password })
      .expect(200);
    return agent;
  }

  function forgotPassword(accountEmail: string) {
    return request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: accountEmail });
  }

  function resetPassword(token: string, newPassword: string) {
    return request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, newPassword });
  }

  function resetTokenFor(accountEmail: string): string {
    const sent = sentResetEmails.findLast(({ to }) => to === accountEmail);
    if (!sent) throw new Error(`No reset email captured for ${accountEmail}`);
    return sent.token;
  }

  function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  function expectSafeUser(body: Record<string, unknown>, role: UserRole) {
    expect(body).toMatchObject({ role, status: UserStatus.ACTIVE });
    expect(body).not.toHaveProperty('passwordHash');
  }

  function expectNoSensitiveProfileFields(body: Record<string, unknown>) {
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('authVersion');
    expect(body).not.toHaveProperty('passwordResetTokens');
    expect(JSON.stringify(body)).not.toContain('documentKey');
  }

  function getBody(response: request.Response): Record<string, unknown> {
    const body: unknown = response.body;
    return body as Record<string, unknown>;
  }

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { startsWith: `e2e-${runId}-` } },
      });
    }
    if (app) await app.close();
  });
});
