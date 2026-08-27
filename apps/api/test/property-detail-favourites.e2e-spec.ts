import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
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
  'hira-favourites-e2e-secret-longer-than-thirty-two-characters';

describe('Public property detail and tenant favourites (e2e)', () => {
  jest.setTimeout(60_000);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = (name: string) => `favourite-${runId}-${name}@example.com`;
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
      .useValue({})
      .overrideProvider(VERIFICATION_DOCUMENT_STORAGE)
      .useValue({ put: jest.fn(), get: jest.fn(), delete: jest.fn() })
      .overrideProvider(PROPERTY_PHOTO_STORAGE)
      .useValue({
        put: jest.fn(),
        get: jest.fn().mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff])),
        delete: jest.fn(),
      })
      .compile();
    prisma = module.get(PrismaService);
    app = module.createNestApplication();
    configureApp(app);
    await app.init();

    const passwordHash = await argon2.hash(password);
    const [landlord, tenantA, tenantB] = await Promise.all([
      prisma.user.create({
        data: userData('landlord', UserRole.LANDLORD, passwordHash),
      }),
      prisma.user.create({
        data: userData('tenant-a', UserRole.TENANT, passwordHash),
      }),
      prisma.user.create({
        data: userData('tenant-b', UserRole.TENANT, passwordHash),
      }),
    ]);
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;
    await prisma.landlordProfile.create({
      data: { userId: landlord.id, organisation: 'Maseru Student Rooms' },
    });
    await prisma.verification.create({
      data: {
        userId: landlord.id,
        type: VerificationType.LANDLORD,
        status: VerificationStatus.APPROVED,
      },
    });
    const active = await prisma.property.create({
      data: propertyData(
        landlord.id,
        PropertyStatus.ACTIVE,
        'Public Roma room',
      ),
    });
    activeId = active.id;
    const inactive = await prisma.property.create({
      data: propertyData(
        landlord.id,
        PropertyStatus.DRAFT,
        'Private draft room',
      ),
    });
    inactiveId = inactive.id;
    await prisma.propertyPhoto.createMany({
      data: [
        photoData(active.id, 'second', 1),
        photoData(active.id, 'first', 0),
        photoData(inactive.id, 'private', 0),
      ],
    });
  });

  afterAll(async () => {
    await prisma.inquiry.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.favourite.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.property.deleteMany({
      where: { landlord: { email: email('landlord') } },
    });
    await prisma.verification.deleteMany({
      where: { user: { email: email('landlord') } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: `favourite-${runId}-` } },
    });
    await app.close();
  });

  it('returns only safe ACTIVE public detail with ordered photos', async () => {
    const response = await request(app.getHttpServer())
      .get(`/discovery/properties/${activeId}`)
      .expect(200);
    const body = getBody<PropertyDetailBody>(response);
    expect(body).toMatchObject({
      id: activeId,
      title: 'Public Roma room',
      area: 'Roma',
      nearestInstitution: 'National University of Lesotho',
      landlord: {
        firstName: 'Mpho',
        lastName: 'Mokoena',
        organisation: 'Maseru Student Rooms',
        verified: true,
      },
    });

    expect(typeof body.description).toBe('string');
    expect(body.description.length).toBeGreaterThan(0);
    expect(body.photos.map(({ sortOrder }) => sortOrder)).toEqual([0, 1]);
    expect(JSON.stringify(body)).not.toMatch(
      /email|phone|contactMethod|passwordHash|objectKey|originalName|fullAddress|latitude|longitude|rejectionReason|audit/,
    );
    await request(app.getHttpServer())
      .get(`/discovery/properties/${inactiveId}`)
      .expect(404);
    await request(app.getHttpServer())
      .get('/discovery/properties/missing-property')
      .expect(404);
  });

  it('allows only authenticated TENANT users to use favourites', async () => {
    await request(app.getHttpServer()).get('/favourites').expect(401);
    const landlord = await authenticatedAgent('landlord');
    await landlord.get('/favourites').expect(403);
    const admin = await createAdminAgent();
    await admin.post(`/favourites/${activeId}`).expect(403);
  });

  it('saves idempotently, lists safely, removes, and isolates tenants', async () => {
    const tenantA = await authenticatedAgent('tenant-a');
    const tenantB = await authenticatedAgent('tenant-b');
    const saves = await Promise.all([
      tenantA.post(`/favourites/${activeId}`),
      tenantA.post(`/favourites/${activeId}`),
    ]);
    expect(saves.map(({ status }) => status)).toEqual([201, 201]);
    expect(
      await prisma.favourite.count({
        where: { tenantId: tenantAId, propertyId: activeId },
      }),
    ).toBe(1);

    const list = getBody<FavouriteBody[]>(
      await tenantA.get('/favourites').expect(200),
    );
    expect(list).toHaveLength(1);
    expect(list[0].property.id).toBe(activeId);
    expect(JSON.stringify(list)).not.toMatch(
      /landlordId|objectKey|fullAddress|latitude|longitude|rejectionReason/,
    );
    expect(
      getBody<unknown[]>(await tenantB.get('/favourites').expect(200)),
    ).toHaveLength(0);
    await tenantB.delete(`/favourites/${activeId}`).expect(204);
    expect(
      await prisma.favourite.count({
        where: { tenantId: tenantAId, propertyId: activeId },
      }),
    ).toBe(1);
    await tenantA.delete(`/favourites/${activeId}`).expect(204);
    expect(
      await prisma.favourite.count({
        where: { tenantId: tenantAId, propertyId: activeId },
      }),
    ).toBe(0);
  });

  it('creates and isolates a structured inquiry using session ownership', async () => {
    const tenantA = await authenticatedAgent('tenant-a');
    const tenantB = await authenticatedAgent('tenant-b');
    const landlord = await authenticatedAgent('landlord');
    await prisma.user.create({
      data: userData(
        'landlord-b',
        UserRole.LANDLORD,
        await argon2.hash(password),
      ),
    });
    const landlordB = await authenticatedAgent('landlord-b');

    await request(app.getHttpServer())
      .post(`/properties/${activeId}/inquiries`)
      .send({ message: 'Is this room available?' })
      .expect(401);
    await landlord
      .post(`/properties/${activeId}/inquiries`)
      .send({ message: 'Not a tenant' })
      .expect(403);
    await tenantA
      .post(`/properties/${inactiveId}/inquiries`)
      .send({ message: 'Can I see this private listing?' })
      .expect(404);
    await tenantA
      .post(`/properties/${activeId}/inquiries`)
      .send({ message: '   ', moveInDate: '2026-09-15T12:30:00.000Z' })
      .expect(400);
    await tenantA
      .post(`/properties/${activeId}/inquiries`)
      .send({ message: 'Hello', moveInDate: '2026-09-31' })
      .expect(400);
    await tenantA
      .post(`/properties/${activeId}/inquiries`)
      .send({ message: 'Hello', tenantId: tenantBId })
      .expect(400);

    const created = getBody<{ id: string; moveInDate: string }>(
      await tenantA
        .post(`/properties/${activeId}/inquiries`)
        .send({
          message: '  Is this room available in September?  ',
          moveInDate: '2026-09-15',
        })
        .expect(201),
    );
    expect(created.moveInDate).toBe('2026-09-15T00:00:00.000Z');
    await expect(
      prisma.inquiry.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({
      tenantId: tenantAId,
      message: 'Is this room available in September?',
    });

    const tenantList = getBody<Array<{ id: string }>>(
      await tenantA.get('/inquiries').expect(200),
    );
    expect(tenantList.map(({ id }) => id)).toContain(created.id);
    expect(
      getBody<Array<{ id: string }>>(
        await tenantB.get('/inquiries').expect(200),
      ).map(({ id }) => id),
    ).not.toContain(created.id);

    const landlordList = getBody<Array<{ id: string; tenant: unknown }>>(
      await landlord.get('/inquiries').expect(200),
    );
    expect(landlordList.map(({ id }) => id)).toContain(created.id);
    expect(
      getBody<Array<{ id: string }>>(
        await landlordB.get('/inquiries').expect(200),
      ).map(({ id }) => id),
    ).not.toContain(created.id);
    expect(JSON.stringify(landlordList)).not.toMatch(
      /email|passwordHash|objectKey|fullAddress|latitude|longitude|rejectionReason|documents/,
    );

    await tenantA
      .patch(`/inquiries/${created.id}/status`)
      .send({ status: 'RESPONDED' })
      .expect(403);
    await (
      await authenticatedAgent('admin')
    )
      .patch(`/inquiries/${created.id}/status`)
      .send({ status: 'RESPONDED' })
      .expect(403);
    await landlordB
      .patch(`/inquiries/${created.id}/status`)
      .send({ status: 'RESPONDED' })
      .expect(404);
    await landlord
      .patch(`/inquiries/${created.id}/status`)
      .send({ status: 'OPEN' })
      .expect(400);
    await landlord
      .patch(`/inquiries/${created.id}/status`)
      .send({ status: 'RESPONDED', landlordId: 'client-controlled' })
      .expect(400);

    const responded = getBody<{ status: string }>(
      await landlord
        .patch(`/inquiries/${created.id}/status`)
        .send({ status: 'RESPONDED' })
        .expect(200),
    );
    expect(responded.status).toBe('RESPONDED');
    expect(JSON.stringify(responded)).not.toMatch(
      /email|passwordHash|objectKey|fullAddress|latitude|longitude|rejectionReason|documents/,
    );
    const closed = getBody<{ status: string }>(
      await landlord
        .patch(`/inquiries/${created.id}/status`)
        .send({ status: 'CLOSED' })
        .expect(200),
    );
    expect(closed.status).toBe('CLOSED');
    await landlord
      .patch(`/inquiries/${created.id}/status`)
      .send({ status: 'RESPONDED' })
      .expect(409);
  });

  it('does not create an inquiry when an in-flight property becomes non-ACTIVE', async () => {
    const tenant = await authenticatedAgent('tenant-b');
    const before = await prisma.inquiry.count({
      where: { tenantId: tenantBId, propertyId: activeId },
    });
    let releaseTransition: () => void = () => undefined;
    const mayTransition = new Promise<void>((resolve) => {
      releaseTransition = () => resolve();
    });
    let reportLockAcquired: () => void = () => undefined;
    const lockAcquired = new Promise<void>((resolve) => {
      reportLockAcquired = () => resolve();
    });
    const transition = prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id" FROM "Property" WHERE "id" = ${activeId} FOR UPDATE
      `;
      reportLockAcquired();
      await mayTransition;
      await transaction.property.update({
        where: { id: activeId },
        data: { status: PropertyStatus.PAUSED },
      });
    });
    await lockAcquired;

    const creation = tenant
      .post(`/properties/${activeId}/inquiries`)
      .send({ message: 'Can I still inquire?' })
      .then((response) => response);
    await new Promise((resolve) => setTimeout(resolve, 100));
    releaseTransition();
    await transition;

    expect((await creation).status).toBe(404);
    expect(
      await prisma.inquiry.count({
        where: { tenantId: tenantBId, propertyId: activeId },
      }),
    ).toBe(before);
    await prisma.property.update({
      where: { id: activeId },
      data: { status: PropertyStatus.ACTIVE },
    });
  });

  it('rejects non-ACTIVE saves and omits a saved property after deactivation', async () => {
    const tenant = await authenticatedAgent('tenant-a');
    await tenant.post(`/favourites/${inactiveId}`).expect(404);
    await tenant.post(`/favourites/${activeId}`).expect(201);
    await prisma.property.update({
      where: { id: activeId },
      data: { status: PropertyStatus.PAUSED },
    });
    expect(
      getBody<unknown[]>(await tenant.get('/favourites').expect(200)),
    ).toHaveLength(0);
  });

  async function authenticatedAgent(name: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email: email(name), password })
      .expect(200);
    return agent;
  }

  async function createAdminAgent() {
    await prisma.user.create({
      data: userData('admin', UserRole.ADMIN, await argon2.hash(password)),
    });
    return authenticatedAgent('admin');
  }

  function userData(name: string, role: UserRole, passwordHash: string) {
    return {
      email: email(name),
      firstName: role === UserRole.LANDLORD ? 'Mpho' : 'Test',
      lastName: role === UserRole.LANDLORD ? 'Mokoena' : 'Tenant',
      passwordHash,
      role,
    };
  }
});

type PropertyDetailBody = {
  id: string;
  title: string;
  description: string;
  area: string;
  nearestInstitution: string;
  photos: Array<{ id: string; sortOrder: number }>;
  landlord: {
    firstName: string;
    lastName: string;
    organisation: string | null;
    verified: boolean;
  };
};

type FavouriteBody = {
  propertyId: string;
  createdAt: string;
  property: { id: string };
};

function propertyData(
  landlordId: string,
  status: PropertyStatus,
  title: string,
) {
  return {
    landlordId,
    title,
    description:
      'A detailed student housing listing in Maseru for public review.',
    monthlyPrice: '1450.00',
    roomType: 'Private room',
    status,
    availableFrom: new Date('2026-09-15T00:00:00.000Z'),
    amenities: ['Wi-Fi', 'Parking'],
    area: 'Roma',
    nearestInstitution: 'National University of Lesotho',
    distanceNote: 'Ten minutes on foot',
    fullAddress: 'Private street address',
    latitude: '-29.315000',
    longitude: '27.486000',
    rejectionReason: status === PropertyStatus.DRAFT ? 'Private reason' : null,
  };
}

function photoData(propertyId: string, name: string, sortOrder: number) {
  return {
    propertyId,
    objectKey: `favourites/${propertyId}/${name}`,
    originalName: `${name}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 3,
    sortOrder,
  };
}

function getBody<T>(response: request.Response): T {
  const body: unknown = response.body;
  return body as T;
}
