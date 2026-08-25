import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = moduleFixture.get(PrismaService);
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
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
