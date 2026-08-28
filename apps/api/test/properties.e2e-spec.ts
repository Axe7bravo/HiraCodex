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
import { AdminPropertiesService } from '../src/properties/admin-properties.service';
import { VERIFICATION_DOCUMENT_STORAGE } from '../src/verifications/verification-document-storage';

process.env.JWT_SECRET ??=
  'hira-property-e2e-secret-longer-than-thirty-two-characters';

describe('Landlord property management (e2e)', () => {
  jest.setTimeout(120_000);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = (name: string) => `property-${runId}-${name}@example.com`;
  const password = 'SecurePass123!';
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminProperties: AdminPropertiesService;
  const storedPhotos = new Map<string, Buffer>();
  const propertyStorage = {
    put: jest.fn((key: string, contents: Buffer) => {
      storedPhotos.set(key, contents);
      return Promise.resolve();
    }),
    get: jest.fn((key: string) =>
      Promise.resolve(storedPhotos.get(key) ?? Buffer.alloc(0)),
    ),
    delete: jest.fn((key: string) => {
      storedPhotos.delete(key);
      return Promise.resolve();
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({
        sendPasswordReset: jest.fn(),
        sendVerificationApproved: jest.fn(),
        sendVerificationRejected: jest.fn(),
        sendPropertyApproved: jest.fn(),
        sendPropertyRejected: jest.fn(),
      })
      .overrideProvider(VERIFICATION_DOCUMENT_STORAGE)
      .useValue({ put: jest.fn(), get: jest.fn(), delete: jest.fn() })
      .overrideProvider(PROPERTY_PHOTO_STORAGE)
      .useValue(propertyStorage)
      .compile();
    prisma = module.get(PrismaService);
    adminProperties = module.get(AdminPropertiesService);
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { actor: { email: { startsWith: `property-${runId}-` } } },
    });
    await prisma.inquiry.deleteMany({
      where: { tenant: { email: { startsWith: `property-${runId}-` } } },
    });
    await prisma.property.deleteMany({
      where: { landlord: { email: { startsWith: `property-${runId}-` } } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: `property-${runId}-` } },
    });
    await app.close();
  });

  it('authorizes admin moderation and resolves concurrent review once', async () => {
    const owner = await authenticatedAgent(
      'moderation-owner',
      UserRole.LANDLORD,
    );
    const created = await owner
      .post('/properties')
      .send(validProperty('Concurrent review'))
      .expect(201);
    const propertyId = getBody<PropertyBody>(created).id;
    for (const { name, contents } of validPhotos()) {
      await owner
        .post(`/properties/${propertyId}/photos`)
        .attach('photo', contents, { filename: name })
        .expect(201);
    }
    await owner.post(`/properties/${propertyId}/submit-review`).expect(201);

    await owner.get('/admin/properties').expect(403);
    const firstAdmin = await authenticatedAdminAgent('property-admin-one');
    const secondAdmin = await authenticatedAdminAgent('property-admin-two');
    const queue = await firstAdmin.get('/admin/properties').expect(200);
    expect(JSON.stringify(queue.body)).not.toContain('objectKey');
    const detail = await firstAdmin
      .get(`/admin/properties/${propertyId}`)
      .expect(200);
    expect(JSON.stringify(detail.body)).not.toContain('objectKey');
    const photoId = getBody<{ photos: { id: string }[] }>(detail).photos[0].id;
    await firstAdmin
      .get(`/admin/properties/${propertyId}/photos/${photoId}`)
      .expect(200);
    await firstAdmin
      .get(`/admin/properties/not-${propertyId}/photos/${photoId}`)
      .expect(404);

    const decisions = await Promise.all([
      firstAdmin
        .patch(`/admin/properties/${propertyId}`)
        .send({ status: 'ACTIVE' }),
      secondAdmin
        .patch(`/admin/properties/${propertyId}`)
        .send({ status: 'REJECTED', rejectionReason: 'Needs changes.' }),
    ]);
    expect(decisions.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Property', targetId: propertyId },
      }),
    ).toBe(1);
    expect(
      (await prisma.property.findUniqueOrThrow({ where: { id: propertyId } }))
        .status,
    ).toBe(
      getBody<{ status: PropertyStatus }>(
        decisions.find(({ status }) => status === 200)!,
      ).status,
    );
  });

  it('rolls back a decision when audit creation fails', async () => {
    const owner = await authenticatedAgent('audit-owner', UserRole.LANDLORD);
    const created = await owner
      .post('/properties')
      .send(validProperty('Audit rollback'))
      .expect(201);
    const propertyId = getBody<PropertyBody>(created).id;
    for (const { name, contents } of validPhotos()) {
      await owner
        .post(`/properties/${propertyId}/photos`)
        .attach('photo', contents, { filename: name })
        .expect(201);
    }
    await owner.post(`/properties/${propertyId}/submit-review`).expect(201);

    await expect(
      adminProperties.review(propertyId, 'missing-admin', {
        status: PropertyStatus.ACTIVE,
      }),
    ).rejects.toThrow();
    expect(
      (await prisma.property.findUniqueOrThrow({ where: { id: propertyId } }))
        .status,
    ).toBe(PropertyStatus.PENDING_REVIEW);
    expect(
      await prisma.auditLog.count({
        where: { targetType: 'Property', targetId: propertyId },
      }),
    ).toBe(0);
  });

  it('lets a landlord correct and resubmit a rejected property', async () => {
    const owner = await authenticatedAgent('rejected-owner', UserRole.LANDLORD);
    const admin = await authenticatedAdminAgent('rejecting-admin');
    const created = await owner
      .post('/properties')
      .send(validProperty('Needs review'))
      .expect(201);
    const propertyId = getBody<PropertyBody>(created).id;
    for (const { name, contents } of validPhotos()) {
      await owner
        .post(`/properties/${propertyId}/photos`)
        .attach('photo', contents, { filename: name })
        .expect(201);
    }
    await owner.post(`/properties/${propertyId}/submit-review`).expect(201);
    await admin
      .patch(`/admin/properties/${propertyId}`)
      .send({
        status: 'REJECTED',
        rejectionReason: 'Add a more specific description.',
      })
      .expect(200);

    const mine = await owner.get('/properties/mine').expect(200);
    const rejected = getBody<PropertyBody[]>(mine).find(
      ({ id }) => id === propertyId,
    );
    expect(rejected).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Add a more specific description.',
    });
    const corrected = await owner
      .patch(`/properties/${propertyId}`)
      .send({
        description:
          'A corrected and more specific description for this furnished room.',
      })
      .expect(200);
    expect(getBody<PropertyBody>(corrected)).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Add a more specific description.',
    });
    await owner
      .patch(`/properties/${propertyId}`)
      .send({ status: 'DRAFT' })
      .expect(409);
    await owner
      .patch(`/properties/${propertyId}`)
      .send({ status: 'PAUSED' })
      .expect(409);
    await owner
      .post(`/properties/${propertyId}/submit-review`)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'PENDING_REVIEW',
          rejectionReason: null,
        });
      });
  });

  it('allows LANDLORD and ADMIN owners while rejecting TENANT access', async () => {
    await request(app.getHttpServer()).get('/properties/mine').expect(401);
    const tenant = await authenticatedAgent('tenant-role', UserRole.TENANT);
    await tenant.post('/properties').send(validProperty()).expect(403);
    const admin = await authenticatedAdminAgent('admin-role');
    const adminProperty = getBody<PropertyBody>(
      await admin
        .post('/properties')
        .send(validProperty('Admin-owned property'))
        .expect(201),
    );
    expect(
      getBody<PropertyBody[]>(
        await admin.get('/properties/mine').expect(200),
      ).map(({ id }) => id),
    ).toContain(adminProperty.id);
    for (const { name, contents } of validPhotos()) {
      await admin
        .post(`/properties/${adminProperty.id}/photos`)
        .attach('photo', contents, { filename: name })
        .expect(201);
    }
    await admin
      .post(`/properties/${adminProperty.id}/submit-review`)
      .expect(201)
      .expect(({ body }) => {
        expect((body as { status: string }).status).toBe('PENDING_REVIEW');
      });

    const landlord = await authenticatedAgent(
      'admin-scope-landlord',
      UserRole.LANDLORD,
    );
    const landlordProperty = getBody<PropertyBody>(
      await landlord
        .post('/properties')
        .send(validProperty('Landlord-owned property'))
        .expect(201),
    );
    await admin
      .patch(`/properties/${landlordProperty.id}`)
      .send({ title: 'Not admin-owned' })
      .expect(404);
    await landlord
      .patch(`/properties/${adminProperty.id}`)
      .send({ title: 'Not landlord-owned' })
      .expect(404);
  });

  it('creates, lists and edits only the authenticated landlord draft', async () => {
    const owner = await authenticatedAgent('owner', UserRole.LANDLORD);
    const created = await owner
      .post('/properties')
      .send({ ...validProperty(), title: '  Roma garden room  ' })
      .expect(201);
    const createdBody = getBody<PropertyBody>(created);
    expect(createdBody).toMatchObject({
      title: 'Roma garden room',
      status: 'DRAFT',
      monthlyPrice: '1450.5',
      availableFrom: '2026-09-15T00:00:00.000Z',
      country: 'Lesotho',
      city: 'Maseru',
    });

    const mine = await owner.get('/properties/mine').expect(200);
    expect(getBody<PropertyBody[]>(mine).map(({ id }) => id)).toContain(
      createdBody.id,
    );

    const stranger = await authenticatedAgent('stranger', UserRole.LANDLORD);
    await stranger
      .patch(`/properties/${createdBody.id}`)
      .send({ title: 'Not mine to edit' })
      .expect(404);
    await stranger.delete(`/properties/${createdBody.id}`).expect(404);

    const updated = await owner
      .patch(`/properties/${createdBody.id}`)
      .send({ status: 'PAUSED', monthlyPrice: '1500.00' })
      .expect(200);
    expect(getBody<PropertyBody>(updated)).toMatchObject({
      status: 'PAUSED',
      monthlyPrice: '1500',
    });
  });

  it('pauses only an owned ACTIVE property before editing and resubmission', async () => {
    const owner = await authenticatedAgent('pause-owner', UserRole.LANDLORD);
    const stranger = await authenticatedAgent(
      'pause-stranger',
      UserRole.LANDLORD,
    );
    const admin = await authenticatedAdminAgent('pause-admin');
    const created = getBody<PropertyBody>(
      await owner
        .post('/properties')
        .send(validProperty('Active pause property'))
        .expect(201),
    );
    for (const { name, contents } of validPhotos()) {
      await owner
        .post(`/properties/${created.id}/photos`)
        .attach('photo', contents, { filename: name })
        .expect(201);
    }
    await prisma.property.update({
      where: { id: created.id },
      data: { status: PropertyStatus.ACTIVE },
    });

    await owner
      .patch(`/properties/${created.id}`)
      .send({ title: 'Active listings remain read-only' })
      .expect(409);
    await stranger
      .patch(`/properties/${created.id}`)
      .send({ status: 'PAUSED' })
      .expect(404);
    await admin
      .patch(`/properties/${created.id}`)
      .send({ status: 'PAUSED' })
      .expect(404);

    await owner
      .patch(`/properties/${created.id}`)
      .send({ status: 'PAUSED' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'PAUSED' });
      });
    await owner
      .patch(`/properties/${created.id}`)
      .send({ title: 'Edited while paused' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          title: 'Edited while paused',
          status: 'PAUSED',
        });
      });
    await owner
      .post(`/properties/${created.id}/submit-review`)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'PENDING_REVIEW' });
      });

    const adminOwned = getBody<PropertyBody>(
      await admin
        .post('/properties')
        .send(validProperty('Admin active pause property'))
        .expect(201),
    );
    await prisma.property.update({
      where: { id: adminOwned.id },
      data: { status: PropertyStatus.ACTIVE },
    });
    await admin
      .patch(`/properties/${adminOwned.id}`)
      .send({ status: 'PAUSED' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'PAUSED' });
      });
  });

  it('rejects unsafe client-controlled and invalid values', async () => {
    const owner = await authenticatedAgent('validation', UserRole.LANDLORD);
    await owner
      .post('/properties')
      .send({ ...validProperty(), landlordId: 'someone-else' })
      .expect(400);
    await owner
      .post('/properties')
      .send({ ...validProperty(), monthlyPrice: '0' })
      .expect(400);
    await owner
      .post('/properties')
      .send({ ...validProperty(), availableFrom: '2026-09-31' })
      .expect(400);
    await owner
      .post('/properties')
      .send({ ...validProperty(), title: '   ' })
      .expect(400);
    for (const invalid of [
      { roomType: 'Bespoke suite' },
      { area: 'roma' },
      { nearestInstitution: 'NUL' },
      { amenities: ['Wi-Fi', 'Jacuzzi'] },
    ]) {
      await owner
        .post('/properties')
        .send({ ...validProperty(), ...invalid })
        .expect(400);
    }

    const created = await owner
      .post('/properties')
      .send(validProperty('PATCH validation property'))
      .expect(201);
    const propertyId = getBody<PropertyBody>(created).id;
    await owner
      .patch(`/properties/${propertyId}`)
      .send({ title: null })
      .expect(400);
    await owner
      .patch(`/properties/${propertyId}`)
      .send({ amenities: null })
      .expect(400);
    await owner
      .patch(`/properties/${propertyId}`)
      .send({ status: null })
      .expect(400);
    await owner
      .patch(`/properties/${propertyId}`)
      .send({ roomType: 'Bespoke suite' })
      .expect(400);
    await owner
      .patch(`/properties/${propertyId}`)
      .send({ area: 'roma' })
      .expect(400);
    await owner
      .patch(`/properties/${propertyId}`)
      .send({ nearestInstitution: 'NUL' })
      .expect(400);
    await owner
      .patch(`/properties/${propertyId}`)
      .send({ amenities: ['Wi-Fi', 'Jacuzzi'] })
      .expect(400);
  });

  it('deletes an untouched property but preserves interaction history', async () => {
    const owner = await authenticatedAgent('delete-owner', UserRole.LANDLORD);
    const clean = await owner
      .post('/properties')
      .send(validProperty('Clean property'))
      .expect(201);
    const cleanBody = getBody<PropertyBody>(clean);
    await owner.delete(`/properties/${cleanBody.id}`).expect(200);
    expect(
      await prisma.property.findUnique({ where: { id: cleanBody.id } }),
    ).toBeNull();

    const historic = await owner
      .post('/properties')
      .send(validProperty('Historic property'))
      .expect(201);
    const historicBody = getBody<PropertyBody>(historic);
    const tenant = await prisma.user.create({
      data: {
        email: email('history-tenant'),
        firstName: 'History',
        lastName: 'Tenant',
        passwordHash: await argon2.hash(password),
        role: UserRole.TENANT,
      },
    });
    const inquiry = await prisma.inquiry.create({
      data: {
        propertyId: historicBody.id,
        tenantId: tenant.id,
        landlordId: historicBody.landlordId,
        message: 'Please preserve this interaction.',
      },
    });
    await owner.delete(`/properties/${historicBody.id}`).expect(409);
    expect(
      await prisma.inquiry.findUnique({ where: { id: inquiry.id } }),
    ).not.toBeNull();
  });

  it('privately manages photos and locks the listing after review submission', async () => {
    const owner = await authenticatedAgent('photo-owner', UserRole.LANDLORD);
    const stranger = await authenticatedAgent(
      'photo-stranger',
      UserRole.LANDLORD,
    );
    const tenant = await authenticatedAgent('photo-tenant', UserRole.TENANT);
    const created = await owner
      .post('/properties')
      .send(validProperty('Photo property'))
      .expect(201);
    const propertyId = getBody<PropertyBody>(created).id;

    await tenant
      .post(`/properties/${propertyId}/photos`)
      .attach('photo', Buffer.from('x'), 'room.jpg')
      .expect(403);
    await owner
      .post(`/properties/${propertyId}/photos`)
      .attach('photo', Buffer.from('x'), 'room.gif')
      .expect(400);

    const photoIds: string[] = [];
    for (const { name, contents } of validPhotos()) {
      const uploaded = await owner
        .post(`/properties/${propertyId}/photos`)
        .attach('photo', contents, { filename: name })
        .expect(201);
      const body = getBody<{ id: string; mimeType: string }>(uploaded);
      expect(body).not.toHaveProperty('objectKey');
      photoIds.push(body.id);
    }

    await owner
      .get(`/properties/${propertyId}/photos/${photoIds[0]}`)
      .expect(200)
      .expect('Content-Type', /image\/jpeg/);
    await stranger
      .get(`/properties/${propertyId}/photos/${photoIds[0]}`)
      .expect(404);
    await stranger
      .delete(`/properties/${propertyId}/photos/${photoIds[0]}`)
      .expect(404);

    await owner
      .post(`/properties/${propertyId}/submit-review`)
      .expect(201)
      .expect(({ body }) => {
        expect((body as { status: string }).status).toBe('PENDING_REVIEW');
      });
    await owner.post(`/properties/${propertyId}/submit-review`).expect(409);
    await owner
      .patch(`/properties/${propertyId}`)
      .send({ title: 'Locked title' })
      .expect(409);
    await owner
      .delete(`/properties/${propertyId}/photos/${photoIds[0]}`)
      .expect(409);
    await owner.delete(`/properties/${propertyId}`).expect(409);
  });

  function registration(name: string, role: UserRole) {
    return {
      firstName: 'Hira',
      lastName: 'Tester',
      email: email(name),
      password,
      role,
    };
  }

  async function authenticatedAgent(name: string, role: UserRole) {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(registration(name, role))
      .expect(201);
    if (role === UserRole.LANDLORD) {
      const owner = await prisma.user.findUniqueOrThrow({
        where: { email: email(name) },
        select: { id: true },
      });
      await prisma.verification.create({
        data: {
          userId: owner.id,
          type: VerificationType.LANDLORD,
          status: VerificationStatus.APPROVED,
        },
      });
    }
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
        lastName: 'Tester',
        passwordHash: await argon2.hash(password),
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
});

type PropertyBody = {
  id: string;
  landlordId: string;
  title: string;
  status: string;
  monthlyPrice: string;
  availableFrom: string;
  country: string;
  city: string;
};

function getBody<T>(response: request.Response): T {
  const body: unknown = response.body;
  return body as T;
}

function validProperty(title = 'Roma garden room') {
  return {
    title,
    description: 'A quiet furnished room close to the university campus.',
    monthlyPrice: '1450.50',
    roomType: 'Private room',
    availableFrom: '2026-09-15',
    amenities: ['Wi-Fi', 'Parking'],
    area: 'Roma',
    nearestInstitution: 'National University of Lesotho',
    distanceNote: 'Ten minutes on foot',
  };
}

function validPhotos() {
  return [
    { name: 'front.jpg', contents: Buffer.from([0xff, 0xd8, 0xff, 0x00]) },
    {
      name: 'room.png',
      contents: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    },
    { name: 'kitchen.webp', contents: Buffer.from('RIFF0000WEBP') },
  ];
}
