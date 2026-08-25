import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EmailService } from '../src/auth/email.service';
import { PrismaService } from '../src/prisma/prisma.service';

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
      .compile();
    prisma = moduleFixture.get(PrismaService);
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    failEmailDelivery = false;
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
