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
  let failVerificationEmail = false;
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
    get: jest.fn((key: string): Promise<Buffer> => {
      const contents = storedVerificationDocuments.get(key);
      return contents
        ? Promise.resolve(contents)
        : Promise.reject(new Error('object unavailable'));
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
    sendVerificationApproved: jest.fn((): Promise<void> =>
      failVerificationEmail
        ? Promise.reject(new Error('provider unavailable'))
        : Promise.resolve(),
    ),
    sendVerificationRejected: jest.fn((): Promise<void> =>
      failVerificationEmail
        ? Promise.reject(new Error('provider unavailable'))
        : Promise.resolve(),
    ),
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
    failVerificationEmail = false;
    verificationStorage.put.mockClear();
    verificationStorage.delete.mockClear();
    verificationStorage.get.mockClear();
    emailService.sendVerificationApproved.mockClear();
    emailService.sendVerificationRejected.mockClear();
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
    const expiredToken = `expired-reset-token-${runId}`;
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

  it('protects every admin verification route by authoritative role', async () => {
    const tenant = await authenticatedAgent(
      'admin-auth-tenant',
      UserRole.TENANT,
    );
    const landlord = await authenticatedAgent(
      'admin-auth-landlord',
      UserRole.LANDLORD,
    );
    for (const path of [
      '/admin/verifications',
      '/admin/verifications/missing',
      '/admin/verifications/missing/documents/missing',
    ]) {
      await request(app.getHttpServer()).get(path).expect(401);
      await tenant.get(path).expect(403);
      await landlord.get(path).expect(403);
    }
    await request(app.getHttpServer())
      .patch('/admin/verifications/missing')
      .send({ status: VerificationStatus.APPROVED })
      .expect(401);
    await tenant
      .patch('/admin/verifications/missing')
      .send({ status: VerificationStatus.APPROVED })
      .expect(403);
    await landlord
      .patch('/admin/verifications/missing')
      .send({ status: VerificationStatus.APPROVED })
      .expect(403);
  });

  it('returns a FIFO pending queue, safe detail, and private document download', async () => {
    const first = await authenticatedAgent(
      'admin-queue-first',
      UserRole.TENANT,
    );
    const second = await authenticatedAgent(
      'admin-queue-second',
      UserRole.LANDLORD,
    );
    const firstSubmission = await first
      .post('/verifications')
      .attach('documents', Buffer.from('first-private-document'), {
        filename: 'student\r\ncard.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const secondSubmission = await second
      .post('/verifications')
      .attach('documents', Buffer.from('second-private-document'), {
        filename: 'registration.png',
        contentType: 'image/png',
      })
      .expect(201);
    const firstId = String(getBody(firstSubmission).id);
    const secondId = String(getBody(secondSubmission).id);
    await prisma.verification.update({
      where: { id: firstId },
      data: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
    });
    await prisma.verification.update({
      where: { id: secondId },
      data: { createdAt: new Date('2026-01-02T00:00:00.000Z') },
    });
    const admin = await authenticatedAdminAgent('admin-queue-reviewer');
    const queue = await admin.get('/admin/verifications').expect(200);
    const queueRows = queue.body as Array<Record<string, unknown>>;
    const relevant = queueRows.filter(
      ({ id }) => id === firstId || id === secondId,
    );
    expect(relevant.map(({ id }) => id)).toEqual([firstId, secondId]);
    expect(relevant[0]).toMatchObject({
      type: VerificationType.STUDENT,
      documentCount: 1,
    });
    expect(JSON.stringify(relevant)).not.toContain('objectKey');

    const detail = await admin
      .get(`/admin/verifications/${firstId}`)
      .expect(200);
    expect(getBody(detail)).toMatchObject({
      id: firstId,
      user: { email: email('admin-queue-first'), role: UserRole.TENANT },
    });
    expect(JSON.stringify(detail.body)).not.toContain('objectKey');
    const documentId = String(
      (getBody(detail).documents as Array<Record<string, unknown>>)[0].id,
    );
    const download = await admin
      .get(`/admin/verifications/${firstId}/documents/${documentId}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(download.body).toEqual(Buffer.from('first-private-document'));
    expect(download.headers['content-type']).toContain('application/pdf');
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(download.headers['cache-control']).toBe('private, no-store');
    expect(JSON.stringify(download.headers)).not.toContain('verifications/');
    await admin
      .get(`/admin/verifications/${secondId}/documents/${documentId}`)
      .expect(404);
    await admin
      .get(`/admin/verifications/${firstId}/documents/missing`)
      .expect(404);
    storedVerificationDocuments.clear();
    const storageFailure = await admin
      .get(`/admin/verifications/${firstId}/documents/${documentId}`)
      .expect(500);
    expect(JSON.stringify(storageFailure.body)).not.toContain('verifications/');
    expect(JSON.stringify(storageFailure.body)).not.toContain('object');
  });

  it('atomically approves a pending verification, audits it, and emails afterward', async () => {
    const owner = await authenticatedAgent(
      'admin-approve-owner',
      UserRole.TENANT,
    );
    const submission = await owner
      .post('/verifications')
      .attach('documents', Buffer.from('approval document'), {
        filename: 'approval.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const verificationId = String(getBody(submission).id);
    const admin = await authenticatedAdminAgent('admin-approver');
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: email('admin-approver') },
    });
    const reviewed = await admin
      .patch(`/admin/verifications/${verificationId}`)
      .send({ status: VerificationStatus.APPROVED })
      .expect(200);
    expect(getBody(reviewed)).toMatchObject({
      status: VerificationStatus.APPROVED,
      rejectionReason: null,
      reviewedBy: { id: adminUser.id },
    });
    expect(getBody(reviewed).reviewedAt).toBeTruthy();
    expect(
      await prisma.auditLog.count({
        where: {
          action: 'VERIFICATION_APPROVED',
          targetId: verificationId,
          actorId: adminUser.id,
        },
      }),
    ).toBe(1);
    expect(emailService.sendVerificationApproved).toHaveBeenCalledWith(
      email('admin-approve-owner'),
    );
    expect(
      getBody(await owner.get('/verifications/me').expect(200)).status,
    ).toBe(VerificationStatus.APPROVED);
    expect(
      getBody(await owner.get('/users/me').expect(200)).verificationStatus,
    ).toBe(VerificationStatus.APPROVED);
    const queueAfterReview = await admin
      .get('/admin/verifications')
      .expect(200);
    expect(
      (queueAfterReview.body as Array<{ id: string }>).some(
        ({ id }) => id === verificationId,
      ),
    ).toBe(false);
    await admin
      .patch(`/admin/verifications/${verificationId}`)
      .send({ status: VerificationStatus.REJECTED, rejectionReason: 'No' })
      .expect(409);
  });

  it('rejects with a reason, survives email failure, and permits resubmission', async () => {
    const owner = await authenticatedAgent(
      'admin-reject-owner',
      UserRole.LANDLORD,
    );
    const submission = await owner
      .post('/verifications')
      .attach('documents', Buffer.from('rejection document'), {
        filename: 'landlord.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const verificationId = String(getBody(submission).id);
    const admin = await authenticatedAdminAgent('admin-rejecter');
    await admin
      .patch(`/admin/verifications/${verificationId}`)
      .send({ status: VerificationStatus.REJECTED })
      .expect(400);
    await admin
      .patch(`/admin/verifications/${verificationId}`)
      .send({ status: VerificationStatus.REJECTED, rejectionReason: '   ' })
      .expect(400);
    await admin
      .patch(`/admin/verifications/${verificationId}`)
      .send({ status: VerificationStatus.APPROVED, rejectionReason: 'No' })
      .expect(400);
    await admin
      .patch(`/admin/verifications/${verificationId}`)
      .send({ status: 'PENDING' })
      .expect(400);

    failVerificationEmail = true;
    await admin
      .patch(`/admin/verifications/${verificationId}`)
      .send({
        status: VerificationStatus.REJECTED,
        rejectionReason: '  The registration is unreadable.  ',
      })
      .expect(200);
    expect(emailService.sendVerificationRejected).toHaveBeenCalledWith(
      email('admin-reject-owner'),
      'The registration is unreadable.',
    );
    expect(
      getBody(await owner.get('/verifications/me').expect(200)),
    ).toMatchObject({
      status: VerificationStatus.REJECTED,
      rejectionReason: 'The registration is unreadable.',
    });
    expect(
      await prisma.auditLog.count({
        where: { action: 'VERIFICATION_REJECTED', targetId: verificationId },
      }),
    ).toBe(1);
    await owner
      .post('/verifications')
      .attach('documents', Buffer.from('replacement'), {
        filename: 'replacement.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
  });

  it('allows exactly one concurrent admin review and one audit record', async () => {
    const owner = await authenticatedAgent('admin-race-owner', UserRole.TENANT);
    const submission = await owner
      .post('/verifications')
      .attach('documents', Buffer.from('race'), {
        filename: 'race.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const verificationId = String(getBody(submission).id);
    const firstAdmin = await authenticatedAdminAgent('admin-race-first');
    const secondAdmin = await authenticatedAdminAgent('admin-race-second');
    const responses = await Promise.all([
      firstAdmin
        .patch(`/admin/verifications/${verificationId}`)
        .send({ status: VerificationStatus.APPROVED }),
      secondAdmin.patch(`/admin/verifications/${verificationId}`).send({
        status: VerificationStatus.REJECTED,
        rejectionReason: 'Rejected concurrently.',
      }),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Verification', targetId: verificationId },
      }),
    ).toBe(1);
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

  async function authenticatedAdminAgent(name: string) {
    await prisma.user.create({
      data: {
        email: email(name),
        firstName: 'Admin',
        lastName: 'Reviewer',
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        role: UserRole.ADMIN,
      },
    });
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
      await prisma.auditLog.deleteMany({
        where: {
          actor: { email: { startsWith: `e2e-${runId}-` } },
        },
      });
      await prisma.user.deleteMany({
        where: { email: { startsWith: `e2e-${runId}-` } },
      });
    }
    if (app) await app.close();
  });
});
