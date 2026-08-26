import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PropertyStatus, UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EmailService } from '../src/auth/email.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PROPERTY_PHOTO_STORAGE } from '../src/properties/property-photo-storage';
import { VERIFICATION_DOCUMENT_STORAGE } from '../src/verifications/verification-document-storage';

process.env.JWT_SECRET ??=
  'hira-discovery-e2e-secret-longer-than-thirty-two-characters';

describe('Public property discovery (e2e)', () => {
  jest.setTimeout(60_000);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let activeId: string;
  let activePhotoId: string;
  let draftId: string;
  let draftPhotoId: string;
  const storedPhotos = new Map<string, Buffer>();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({})
      .overrideProvider(VERIFICATION_DOCUMENT_STORAGE)
      .useValue({ put: jest.fn(), get: jest.fn(), delete: jest.fn() })
      .overrideProvider(PROPERTY_PHOTO_STORAGE)
      .useValue({
        put: jest.fn(),
        get: jest.fn((key: string) =>
          Promise.resolve(storedPhotos.get(key) ?? Buffer.alloc(0)),
        ),
        delete: jest.fn(),
      })
      .compile();
    prisma = module.get(PrismaService);
    app = module.createNestApplication();
    configureApp(app);
    await app.init();

    const landlord = await prisma.user.create({
      data: {
        email: `discovery-${runId}@example.com`,
        firstName: 'Public',
        lastName: 'Landlord',
        passwordHash: 'not-used-by-this-test',
        role: UserRole.LANDLORD,
      },
    });
    const active = await prisma.property.create({
      data: propertyData(
        landlord.id,
        PropertyStatus.ACTIVE,
        'Active Roma room',
      ),
    });
    activeId = active.id;
    const activePhoto = await prisma.propertyPhoto.create({
      data: photoData(active.id, `discovery/${runId}/active`),
    });
    activePhotoId = activePhoto.id;
    storedPhotos.set(activePhoto.objectKey, Buffer.from([0xff, 0xd8, 0xff]));

    const draft = await prisma.property.create({
      data: propertyData(landlord.id, PropertyStatus.DRAFT, 'Private draft'),
    });
    draftId = draft.id;
    const draftPhoto = await prisma.propertyPhoto.create({
      data: photoData(draft.id, `discovery/${runId}/draft`),
    });
    draftPhotoId = draftPhoto.id;
    storedPhotos.set(draftPhoto.objectKey, Buffer.from([0xff, 0xd8, 0xff]));
  });

  afterAll(async () => {
    await prisma.property.deleteMany({
      where: { landlord: { email: `discovery-${runId}@example.com` } },
    });
    await prisma.user.deleteMany({
      where: { email: `discovery-${runId}@example.com` },
    });
    await app.close();
  });

  it('returns only matching ACTIVE listings through a safe public response', async () => {
    const response = await request(app.getHttpServer())
      .get('/discovery/properties')
      .query({
        minPrice: '1000',
        maxPrice: '1600',
        area: `Roma-${runId}`,
        nearestInstitution: `Discovery University ${runId}`,
        availableBy: '2026-10-01',
        roomType: 'private room',
        amenities: `Wi-Fi,Test-${runId}`,
        sort: 'price_asc',
      })
      .expect(200);

    const body = getBody<DiscoveryBody>(response);
    expect(body).toMatchObject({ total: 1, page: 1, pageSize: 12 });
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: activeId,
      title: 'Active Roma room',
      photos: [{ id: activePhotoId }],
    });
    expect(JSON.stringify(body)).not.toMatch(
      /landlordId|email|fullAddress|latitude|longitude|rejectionReason|objectKey|passwordHash/,
    );
    expect(JSON.stringify(body)).not.toContain(draftId);
  });

  it('rejects invalid query values', async () => {
    await request(app.getHttpServer())
      .get('/discovery/properties?minPrice=2000&maxPrice=1000')
      .expect(400);
    await request(app.getHttpServer())
      .get('/discovery/properties?availableBy=2026-09-15T12:00:00.000Z')
      .expect(400);
    await request(app.getHttpServer())
      .get('/discovery/properties?pageSize=100')
      .expect(400);
  });

  it('rejects oversized public filter values and amenity selections', async () => {
    await request(app.getHttpServer())
      .get('/discovery/properties')
      .query({ area: 'a'.repeat(121) })
      .expect(400);
    await request(app.getHttpServer())
      .get('/discovery/properties')
      .query({ nearestInstitution: 'i'.repeat(161) })
      .expect(400);
    await request(app.getHttpServer())
      .get('/discovery/properties')
      .query({ roomType: 'r'.repeat(81) })
      .expect(400);
    await request(app.getHttpServer())
      .get('/discovery/properties')
      .query({
        amenities: Array.from({ length: 31 }, (_, index) => `A${index}`).join(
          ',',
        ),
      })
      .expect(400);
    await request(app.getHttpServer())
      .get('/discovery/properties')
      .query({ amenities: 'a'.repeat(81) })
      .expect(400);
  });

  it('serves only photos belonging to ACTIVE properties with safe headers', async () => {
    await request(app.getHttpServer())
      .get(`/discovery/properties/${activeId}/photos/${activePhotoId}`)
      .expect(200)
      .expect('Content-Type', /image\/jpeg/)
      .expect('X-Content-Type-Options', 'nosniff')
      .expect('Cache-Control', /public, max-age=86400/);
    await request(app.getHttpServer())
      .get(`/discovery/properties/${draftId}/photos/${draftPhotoId}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/discovery/properties/${draftId}/photos/${activePhotoId}`)
      .expect(404);
  });

  function propertyData(
    landlordId: string,
    status: PropertyStatus,
    title: string,
  ) {
    return {
      landlordId,
      title,
      description: 'A sufficiently detailed listing description for discovery.',
      monthlyPrice: '1450.00',
      roomType: 'Private room',
      status,
      availableFrom: new Date('2026-09-15T00:00:00.000Z'),
      amenities: ['Wi-Fi', `Test-${runId}`],
      area: `Roma-${runId}`,
      nearestInstitution: `Discovery University ${runId}`,
      fullAddress: 'Private address that must not be returned',
      rejectionReason: status === PropertyStatus.DRAFT ? 'Private note' : null,
    };
  }

  function photoData(propertyId: string, objectKey: string) {
    return {
      propertyId,
      objectKey,
      originalName: 'private-name.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 3,
      sortOrder: 0,
    };
  }
});

type DiscoveryBody = {
  items: Array<{
    id: string;
    title: string;
    photos: Array<{ id: string }>;
  }>;
  page: number;
  pageSize: number;
  total: number;
};

function getBody<T>(response: request.Response): T {
  const body: unknown = response.body;
  return body as T;
}
