import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
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
  'hira-property-e2e-secret-longer-than-thirty-two-characters';

describe('Landlord property management (e2e)', () => {
  jest.setTimeout(60_000);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = (name: string) => `property-${runId}-${name}@example.com`;
  const password = 'SecurePass123!';
  let app: INestApplication<App>;
  let prisma: PrismaService;
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
      })
      .overrideProvider(VERIFICATION_DOCUMENT_STORAGE)
      .useValue({ put: jest.fn(), get: jest.fn(), delete: jest.fn() })
      .overrideProvider(PROPERTY_PHOTO_STORAGE)
      .useValue(propertyStorage)
      .compile();
    prisma = module.get(PrismaService);
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
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

  it('enforces authentication and the LANDLORD role', async () => {
    await request(app.getHttpServer()).get('/properties/mine').expect(401);
    const tenant = await authenticatedAgent('tenant-role', UserRole.TENANT);
    await tenant.post('/properties').send(validProperty()).expect(403);
    const admin = await authenticatedAdminAgent('admin-role');
    await admin.get('/properties/mine').expect(403);
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
