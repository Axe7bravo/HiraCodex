import { NotFoundException } from '@nestjs/common';
import { PropertyStatus } from '@prisma/client';
import { FavouritesService } from './favourites.service';

describe('FavouritesService', () => {
  const favourite = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
  };
  const prisma = { favourite, $executeRaw: jest.fn() };
  const analytics = { capture: jest.fn() };
  const service = new FavouritesService(prisma as never, analytics as never);

  beforeEach(() => jest.clearAllMocks());

  it('lists only the tenant own currently ACTIVE favourites', async () => {
    favourite.findMany.mockResolvedValue([]);
    await service.list('tenant-1');
    expect(favourite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          property: { status: PropertyStatus.ACTIVE },
        },
      }),
    );
  });

  it('uses an atomic conditional insert and returns the authoritative favourite', async () => {
    prisma.$executeRaw.mockResolvedValue(1);
    favourite.findFirst.mockResolvedValue({
      propertyId: 'property-1',
      createdAt: new Date(),
      property: { id: 'property-1', status: PropertyStatus.ACTIVE },
    });

    await expect(service.save('tenant-1', 'property-1')).resolves.toMatchObject(
      {
        propertyId: 'property-1',
      },
    );
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(favourite.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          propertyId: 'property-1',
          property: { status: PropertyStatus.ACTIVE },
        },
      }),
    );
    expect(analytics.capture).toHaveBeenCalledWith(
      'favourite_added',
      'tenant-1',
      { userId: 'tenant-1', propertyId: 'property-1' },
    );
  });

  it('does not expose a nonexistent or non-ACTIVE property', async () => {
    prisma.$executeRaw.mockResolvedValue(0);
    favourite.findFirst.mockResolvedValue(null);
    await expect(
      service.save('tenant-1', 'private-property'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes only the authenticated tenant favourite', async () => {
    favourite.deleteMany.mockResolvedValue({ count: 1 });
    await service.remove('tenant-1', 'property-1');
    expect(favourite.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', propertyId: 'property-1' },
    });
    expect(analytics.capture).toHaveBeenCalledWith(
      'favourite_removed',
      'tenant-1',
      { userId: 'tenant-1', propertyId: 'property-1' },
    );
  });
});
