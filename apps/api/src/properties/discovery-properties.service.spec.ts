import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PropertyStatus,
  VerificationStatus,
  VerificationType,
} from '@prisma/client';
import { DiscoveryPropertiesService } from './discovery-properties.service';

describe('DiscoveryPropertiesService', () => {
  const findFirstMock = jest.fn<
    Promise<unknown>,
    [Prisma.PropertyFindFirstArgs]
  >();
  const property = {
    findMany: jest.fn(),
    findFirst: findFirstMock,
    count: jest.fn(),
  };
  const propertyPhoto = { findFirst: jest.fn() };
  const prisma = {
    property,
    propertyPhoto,
    $transaction: jest.fn((queries: Promise<unknown>[]) =>
      Promise.all(queries),
    ),
  };
  const storage = { put: jest.fn(), get: jest.fn(), delete: jest.fn() };
  const service = new DiscoveryPropertiesService(prisma as never, storage);

  beforeEach(() => {
    jest.clearAllMocks();
    property.findMany.mockResolvedValue([]);
    property.count.mockResolvedValue(0);
  });

  it('returns only ACTIVE properties with an explicit safe card selection', async () => {
    await service.list({ sort: 'newest', page: 1, pageSize: 12 });

    expect(property.findMany).toHaveBeenCalledWith({
      where: {
        status: PropertyStatus.ACTIVE,
        monthlyPrice: undefined,
        area: undefined,
        nearestInstitution: undefined,
        availableFrom: undefined,
        roomType: undefined,
        amenities: undefined,
      },
      select: {
        id: true,
        title: true,
        monthlyPrice: true,
        roomType: true,
        availableFrom: true,
        amenities: true,
        country: true,
        city: true,
        area: true,
        nearestInstitution: true,
        distanceNote: true,
        createdAt: true,
        photos: {
          select: { id: true, mimeType: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 12,
    });
  });

  it('returns a safe ACTIVE property detail and mapped landlord summary', async () => {
    findFirstMock.mockResolvedValue({
      id: 'property-1',
      title: 'Roma room',
      description: 'A complete public description.',
      landlord: {
        firstName: 'Mpho',
        lastName: 'Mokoena',
        landlordProfile: { organisation: 'Mokoena Rooms' },
        verifications: [{ id: 'verification-1' }],
      },
      photos: [],
    });

    await expect(service.getDetail('property-1')).resolves.toMatchObject({
      id: 'property-1',
      landlord: {
        firstName: 'Mpho',
        lastName: 'Mokoena',
        organisation: 'Mokoena Rooms',
        verified: true,
      },
    });
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: 'property-1', status: PropertyStatus.ACTIVE },
      select: {
        id: true,
        title: true,
        description: true,
        monthlyPrice: true,
        roomType: true,
        availableFrom: true,
        amenities: true,
        country: true,
        city: true,
        area: true,
        nearestInstitution: true,
        distanceNote: true,
        createdAt: true,
        updatedAt: true,
        photos: {
          select: { id: true, mimeType: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
        landlord: {
          select: {
            firstName: true,
            lastName: true,
            landlordProfile: { select: { organisation: true } },
            verifications: {
              where: {
                type: VerificationType.LANDLORD,
                status: VerificationStatus.APPROVED,
              },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
  });

  it('does not publicly retrieve a nonexistent or non-ACTIVE property', async () => {
    findFirstMock.mockResolvedValue(null);
    await expect(service.getDetail('private-property')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('combines every documented filter and applies deterministic price sort', async () => {
    await service.list({
      minPrice: '800',
      maxPrice: '2000',
      area: 'Roma',
      nearestInstitution: 'NUL',
      availableBy: '2026-09-15',
      roomType: 'Private room',
      amenities: ['Wi-Fi', 'Parking', 'Wi-Fi'],
      sort: 'price_asc',
      page: 2,
      pageSize: 6,
    });

    expect(property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: PropertyStatus.ACTIVE,
          monthlyPrice: {
            gte: new Prisma.Decimal('800'),
            lte: new Prisma.Decimal('2000'),
          },
          area: { contains: 'Roma', mode: 'insensitive' },
          nearestInstitution: { contains: 'NUL', mode: 'insensitive' },
          availableFrom: { lte: new Date('2026-09-15T00:00:00.000Z') },
          roomType: { equals: 'Private room', mode: 'insensitive' },
          amenities: { hasEvery: ['Wi-Fi', 'Parking'] },
        },
        orderBy: [
          { monthlyPrice: 'asc' },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        skip: 6,
        take: 6,
      }),
    );
  });

  it('rejects invalid price ranges and impossible calendar dates', async () => {
    await expect(
      service.list({
        minPrice: '2000',
        maxPrice: '1000',
        sort: 'newest',
        page: 1,
        pageSize: 12,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.list({
        availableBy: '2026-09-31',
        sort: 'newest',
        page: 1,
        pageSize: 12,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(property.findMany).not.toHaveBeenCalled();
  });

  it('retrieves a photo only through its requested ACTIVE property', async () => {
    propertyPhoto.findFirst.mockResolvedValue({
      objectKey: 'private/properties/photo',
      mimeType: 'image/jpeg',
    });
    storage.get.mockResolvedValue(Buffer.from('image'));

    await expect(service.getPhoto('property-1', 'photo-1')).resolves.toEqual({
      mimeType: 'image/jpeg',
      contents: Buffer.from('image'),
    });
    expect(propertyPhoto.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'photo-1',
        propertyId: 'property-1',
        property: { status: PropertyStatus.ACTIVE },
      },
      select: { objectKey: true, mimeType: true },
    });
  });

  it('rejects cross-property and non-active photos without reading storage', async () => {
    propertyPhoto.findFirst.mockResolvedValue(null);
    await expect(
      service.getPhoto('property-1', 'photo-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.get).not.toHaveBeenCalled();
  });

  it('returns a generic error when photo storage fails', async () => {
    propertyPhoto.findFirst.mockResolvedValue({
      objectKey: 'private/provider/bucket/key',
      mimeType: 'image/webp',
    });
    storage.get.mockRejectedValue(new Error('bucket and key details'));
    await expect(service.getPhoto('property-1', 'photo-1')).rejects.toEqual(
      new InternalServerErrorException('Property photo is unavailable'),
    );
  });
});
