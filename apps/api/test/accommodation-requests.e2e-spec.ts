import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AccommodationRequestStatus,
  PropertyStatus,
  UserRole,
  VerificationStatus,
  VerificationType,
} from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EmailService } from '../src/auth/email.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PROPERTY_PHOTO_STORAGE } from '../src/properties/property-photo-storage';
import { VERIFICATION_DOCUMENT_STORAGE } from '../src/verifications/verification-document-storage';

process.env.JWT_SECRET ??=
  'hira-request-e2e-secret-longer-than-thirty-two-characters';

describe('Accommodation requests (e2e)', () => {
  jest.setTimeout(60_000);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = (name: string) => `request-${runId}-${name}@example.com`;
  const password = 'SecurePass123!';
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let activeId: string;
  let inactiveId: string;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({
        sendNewAccommodationRequest: jest.fn(),
        sendAccommodationRequestAccepted: jest.fn(),
        sendAccommodationRequestDeclined: jest.fn(),
      })
      .overrideProvider(VERIFICATION_DOCUMENT_STORAGE)
      .useValue({ put: jest.fn(), get: jest.fn(), delete: jest.fn() })
      .overrideProvider(PROPERTY_PHOTO_STORAGE)
      .useValue({ put: jest.fn(), get: jest.fn(), delete: jest.fn() })
      .compile();
    prisma = module.get(PrismaService);
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    const hash = await argon2.hash(password);
    const [landlordA, landlordB, tenantA, tenantB] = await Promise.all([
      prisma.user.create({
        data: userData('landlord-a', UserRole.LANDLORD, hash),
      }),
      prisma.user.create({
        data: userData('landlord-b', UserRole.LANDLORD, hash),
      }),
      prisma.user.create({ data: userData('tenant-a', UserRole.TENANT, hash) }),
      prisma.user.create({ data: userData('tenant-b', UserRole.TENANT, hash) }),
    ]);
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;
    await prisma.tenantProfile.create({
      data: { userId: tenantA.id, institution: 'Limkokwing University' },
    });
    await prisma.verification.create({
      data: {
        userId: tenantA.id,
        type: VerificationType.STUDENT,
        status: VerificationStatus.APPROVED,
      },
    });
    const active = await prisma.property.create({
      data: propertyData(
        landlordA.id,
        PropertyStatus.ACTIVE,
        'Active request room',
      ),
    });
    const inactive = await prisma.property.create({
      data: propertyData(
        landlordA.id,
        PropertyStatus.PAUSED,
        'Paused private room',
      ),
    });
    activeId = active.id;
    inactiveId = inactive.id;
    await prisma.property.create({
      data: propertyData(
        landlordB.id,
        PropertyStatus.ACTIVE,
        'Other landlord room',
      ),
    });
    await prisma.user.create({ data: userData('admin', UserRole.ADMIN, hash) });
  });

  afterAll(async () => {
    await prisma.accommodationRequest.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.property.deleteMany({
      where: {
        landlord: { email: { startsWith: `request-${runId}-landlord-` } },
      },
    });
    await prisma.verification.deleteMany({
      where: { user: { email: email('tenant-a') } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: `request-${runId}-` } },
    });
    await app.close();
  });

  it('creates only for a TENANT and ACTIVE property with safe isolated histories', async () => {
    const tenantA = await agent('tenant-a');
    const tenantB = await agent('tenant-b');
    const landlordA = await agent('landlord-a');
    const landlordB = await agent('landlord-b');
    await request(app.getHttpServer())
      .post(`/properties/${activeId}/requests`)
      .send({ preferredMoveInDate: '2026-10-01' })
      .expect(401);
    await landlordA
      .post(`/properties/${activeId}/requests`)
      .send({ preferredMoveInDate: '2026-10-01' })
      .expect(403);
    await tenantA
      .post(`/properties/${inactiveId}/requests`)
      .send({ preferredMoveInDate: '2026-10-01' })
      .expect(404);
    await tenantA
      .post(`/properties/${activeId}/requests`)
      .send({ preferredMoveInDate: '2026-09-31' })
      .expect(400);
    await tenantA
      .post(`/properties/${activeId}/requests`)
      .send({ preferredMoveInDate: '2026-10-01T12:00:00.000Z' })
      .expect(400);
    await tenantA
      .post(`/properties/${activeId}/requests`)
      .send({
        preferredMoveInDate: '2026-10-01',
        tenantId: tenantBId,
        status: AccommodationRequestStatus.ACCEPTED,
      })
      .expect(400);
    const created = body<{ id: string; preferredMoveInDate: string }>(
      await tenantA
        .post(`/properties/${activeId}/requests`)
        .send({
          preferredMoveInDate: '2026-10-01',
          note: '  Near campus please  ',
        })
        .expect(201),
    );
    expect(created.preferredMoveInDate).toBe('2026-10-01T00:00:00.000Z');
    await expect(
      prisma.accommodationRequest.findUniqueOrThrow({
        where: { id: created.id },
      }),
    ).resolves.toMatchObject({
      tenantId: tenantAId,
      note: 'Near campus please',
      status: AccommodationRequestStatus.PENDING,
    });
    expect(
      body<Array<{ id: string }>>(
        await tenantA.get('/requests').expect(200),
      ).map(({ id }) => id),
    ).toContain(created.id);
    expect(
      body<Array<{ id: string }>>(
        await tenantB.get('/requests').expect(200),
      ).map(({ id }) => id),
    ).not.toContain(created.id);
    const landlordList = body<
      Array<{ id: string; tenant: { verified: boolean } }>
    >(await landlordA.get('/requests').expect(200));
    expect(
      landlordList.find(({ id }) => id === created.id)?.tenant.verified,
    ).toBe(true);
    expect(
      body<Array<{ id: string }>>(
        await landlordB.get('/requests').expect(200),
      ).map(({ id }) => id),
    ).not.toContain(created.id);
    expect(JSON.stringify(landlordList)).not.toMatch(
      /email|passwordHash|objectKey|fullAddress|latitude|longitude|documents/,
    );
  });

  it('atomically isolates and resolves competing landlord decisions', async () => {
    const tenant = await agent('tenant-a');
    const landlordA = await agent('landlord-a');
    const landlordB = await agent('landlord-b');
    const admin = await agent('admin');
    const created = body<{ id: string }>(
      await tenant
        .post(`/properties/${activeId}/requests`)
        .send({ preferredMoveInDate: '2026-11-01' })
        .expect(201),
    );
    await tenant.patch(`/requests/${created.id}/accept`).expect(403);
    await admin.patch(`/requests/${created.id}/decline`).expect(404);
    await landlordB.patch(`/requests/${created.id}/accept`).expect(404);
    const decisions = await Promise.all([
      landlordA.patch(`/requests/${created.id}/accept`),
      landlordA.patch(`/requests/${created.id}/decline`),
    ]);
    expect(decisions.map(({ status }) => status).sort()).toEqual([200, 409]);
    const stored = await prisma.accommodationRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect([
      AccommodationRequestStatus.ACCEPTED,
      AccommodationRequestStatus.DECLINED,
    ]).toContain(stored.status);
  });

  it('allows only the owning tenant to cancel PENDING and resolves a decision race', async () => {
    const tenantA = await agent('tenant-a');
    const tenantB = await agent('tenant-b');
    const landlord = await agent('landlord-a');
    const created = body<{ id: string }>(
      await tenantA
        .post(`/properties/${activeId}/requests`)
        .send({ preferredMoveInDate: '2026-12-01' })
        .expect(201),
    );
    await tenantB.patch(`/requests/${created.id}/cancel`).expect(404);
    await landlord.patch(`/requests/${created.id}/cancel`).expect(403);
    const outcomes = await Promise.all([
      tenantA.patch(`/requests/${created.id}/cancel`),
      landlord.patch(`/requests/${created.id}/accept`),
    ]);
    expect(outcomes.map(({ status }) => status).sort()).toEqual([200, 409]);
    const stored = await prisma.accommodationRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect([
      AccommodationRequestStatus.CANCELLED,
      AccommodationRequestStatus.ACCEPTED,
    ]).toContain(stored.status);
  });

  it('cannot create after an in-flight property loses ACTIVE eligibility', async () => {
    const tenant = await agent('tenant-b');
    const before = await prisma.accommodationRequest.count({
      where: { tenantId: tenantBId, propertyId: activeId },
    });
    let release: () => void = () => undefined;
    const mayTransition = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    let locked: () => void = () => undefined;
    const lockAcquired = new Promise<void>((resolve) => {
      locked = () => resolve();
    });
    const transition = prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "Property" WHERE "id" = ${activeId} FOR UPDATE`;
      locked();
      await mayTransition;
      await transaction.property.update({
        where: { id: activeId },
        data: { status: PropertyStatus.PAUSED },
      });
    });
    await lockAcquired;
    const creation = tenant
      .post(`/properties/${activeId}/requests`)
      .send({ preferredMoveInDate: '2027-01-01' })
      .then((response) => response);
    await new Promise((resolve) => setTimeout(resolve, 100));
    release();
    await transition;
    expect((await creation).status).toBe(404);
    expect(
      await prisma.accommodationRequest.count({
        where: { tenantId: tenantBId, propertyId: activeId },
      }),
    ).toBe(before);
    await prisma.property.update({
      where: { id: activeId },
      data: { status: PropertyStatus.ACTIVE },
    });
  });

  async function agent(name: string) {
    const authenticated = request.agent(app.getHttpServer());
    await authenticated
      .post('/auth/login')
      .send({ email: email(name), password })
      .expect(200);
    return authenticated;
  }

  function userData(name: string, role: UserRole, passwordHash: string) {
    return {
      email: email(name),
      passwordHash,
      role,
      firstName: role === UserRole.LANDLORD ? 'Mpho' : 'Lerato',
      lastName: role === UserRole.LANDLORD ? 'Mokoena' : 'Molefe',
    };
  }
});

function propertyData(
  landlordId: string,
  status: PropertyStatus,
  title: string,
) {
  return {
    landlordId,
    status,
    title,
    description:
      'A complete Maseru student accommodation listing for request testing.',
    monthlyPrice: '2200',
    roomType: 'Single room',
    availableFrom: new Date('2026-09-01T00:00:00.000Z'),
    amenities: ['Wi-Fi'],
    country: 'Lesotho',
    city: 'Maseru',
    area: 'Roma',
    nearestInstitution: 'National University of Lesotho',
  };
}

function body<T>(response: { body: unknown }): T {
  return response.body as T;
}
