import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PropertyStatus } from '@prisma/client';
import { PropertiesService } from './properties.service';

describe('PropertiesService', () => {
  const property = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const service = new PropertiesService({ property } as never);

  beforeEach(() => jest.clearAllMocks());

  it('lists only the authenticated landlord properties', async () => {
    property.findMany.mockResolvedValue([]);
    await service.mine('landlord-1');
    expect(property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { landlordId: 'landlord-1' } }),
    );
  });

  it('creates a trimmed, decimal-safe draft with a UTC calendar date', async () => {
    property.create.mockImplementation(({ data }: { data: unknown }) => data);
    const result = await service.create('landlord-1', validInput());

    expect(result).toMatchObject({
      landlordId: 'landlord-1',
      status: PropertyStatus.DRAFT,
      monthlyPrice: new Prisma.Decimal('1450.50'),
      availableFrom: new Date('2026-09-15T00:00:00.000Z'),
    });
  });

  it('rejects a non-positive price', () => {
    expect(() =>
      service.create('landlord-1', {
        ...validInput(),
        monthlyPrice: '0',
      }),
    ).toThrow(BadRequestException);
    expect(property.create).not.toHaveBeenCalled();
  });

  it('updates only a property owned by the landlord', async () => {
    property.findFirst.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.DRAFT,
    });
    property.update.mockResolvedValue({ id: 'property-1' });

    await service.update('property-1', 'landlord-1', {
      status: PropertyStatus.PAUSED,
    });

    expect(property.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'property-1', landlordId: 'landlord-1' },
      }),
    );
    expect(property.update).toHaveBeenCalledWith({
      where: { id: 'property-1' },
      data: { status: PropertyStatus.PAUSED },
    });
  });

  it('does not reveal a property owned by another landlord', async () => {
    property.findFirst.mockResolvedValue(null);
    await expect(
      service.update('property-1', 'landlord-2', { title: 'Other listing' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(property.update).not.toHaveBeenCalled();
  });

  it('maps interaction-history delete constraints to a conflict', async () => {
    property.findFirst.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.PAUSED,
    });
    property.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('constraint', {
        code: 'P2003',
        clientVersion: '6.19.1',
      }),
    );

    await expect(
      service.remove('property-1', 'landlord-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

function validInput() {
  return {
    title: 'Campus garden room',
    description: 'A quiet furnished room close to the university campus.',
    monthlyPrice: '1450.50',
    roomType: 'Private room',
    availableFrom: '2026-09-15',
    amenities: ['Wi-Fi', 'Parking'],
    area: 'Roma',
    nearestInstitution: 'National University of Lesotho',
  };
}
