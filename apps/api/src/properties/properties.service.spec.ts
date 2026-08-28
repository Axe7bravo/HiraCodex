import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PropertyStatus, UserRole } from '@prisma/client';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

describe('PropertiesService', () => {
  const property = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };
  const propertyPhoto = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };
  const verification = {
    findFirst: jest.fn(),
  };
  type TestTransactionClient = {
    property: typeof property;
    propertyPhoto: typeof propertyPhoto;
    verification: typeof verification;
  };
  const transactionClient: TestTransactionClient = {
    property,
    propertyPhoto,
    verification,
  };
  const prisma = {
    property,
    propertyPhoto,
    verification,
    $transaction: jest.fn(
      (callback: (client: TestTransactionClient) => unknown) =>
        callback(transactionClient),
    ),
  };
  const storage = { put: jest.fn(), get: jest.fn(), delete: jest.fn() };
  const service = new PropertiesService(prisma as never, storage);

  beforeEach(() => {
    jest.clearAllMocks();
    storage.put.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
    propertyPhoto.findMany.mockResolvedValue([]);
    verification.findFirst.mockResolvedValue({ id: 'verification-1' });
  });

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
    property.updateMany.mockResolvedValue({ count: 1 });
    property.findUniqueOrThrow.mockResolvedValue({ id: 'property-1' });

    await service.update('property-1', 'landlord-1', {
      status: PropertyStatus.PAUSED,
    });

    expect(property.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'property-1', landlordId: 'landlord-1' },
      }),
    );
    expect(property.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'property-1',
        landlordId: 'landlord-1',
        status: {
          in: [PropertyStatus.DRAFT, PropertyStatus.PAUSED],
        },
      },
      data: { status: PropertyStatus.PAUSED },
    });
  });

  it('conditionally pauses an owned ACTIVE property', async () => {
    property.findFirst.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.ACTIVE,
    });
    property.updateMany.mockResolvedValue({ count: 1 });
    property.findUniqueOrThrow.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.PAUSED,
    });

    const transformedInput = Object.assign(new UpdatePropertyDto(), {
      title: undefined,
      description: undefined,
      monthlyPrice: undefined,
      amenities: undefined,
      status: PropertyStatus.PAUSED,
    });

    await expect(
      service.update('property-1', 'landlord-1', transformedInput),
    ).resolves.toMatchObject({ status: PropertyStatus.PAUSED });
    expect(property.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'property-1',
        landlordId: 'landlord-1',
        status: { in: [PropertyStatus.ACTIVE] },
      },
      data: { status: PropertyStatus.PAUSED },
    });
  });

  it('does not allow property fields to be changed while pausing ACTIVE', async () => {
    property.findFirst.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.ACTIVE,
    });

    await expect(
      service.update('property-1', 'landlord-1', {
        status: PropertyStatus.PAUSED,
        title: 'Stale active edit',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(property.updateMany).not.toHaveBeenCalled();
  });

  it('does not pause when ACTIVE status is lost before the mutation', async () => {
    property.findFirst
      .mockResolvedValueOnce({
        id: 'property-1',
        status: PropertyStatus.ACTIVE,
      })
      .mockResolvedValueOnce({ status: PropertyStatus.INACTIVE });
    property.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.update('property-1', 'landlord-1', {
        status: PropertyStatus.PAUSED,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(property.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('updates rejected property content without changing its status', async () => {
    property.findFirst.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.REJECTED,
    });
    property.updateMany.mockResolvedValue({ count: 1 });
    property.findUniqueOrThrow.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.REJECTED,
      rejectionReason: 'Add more detail.',
      title: 'Corrected listing title',
    });

    await expect(
      service.update('property-1', 'landlord-1', {
        title: 'Corrected listing title',
      }),
    ).resolves.toMatchObject({ status: PropertyStatus.REJECTED });
    expect(property.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'property-1',
        landlordId: 'landlord-1',
        status: {
          in: [
            PropertyStatus.DRAFT,
            PropertyStatus.PAUSED,
            PropertyStatus.REJECTED,
          ],
        },
      },
      data: { title: 'Corrected listing title' },
    });
  });

  it.each([PropertyStatus.DRAFT, PropertyStatus.PAUSED])(
    'rejects a rejected property status change to %s',
    async (status) => {
      property.findFirst.mockResolvedValue({
        id: 'property-1',
        status: PropertyStatus.REJECTED,
      });

      await expect(
        service.update('property-1', 'landlord-1', { status }),
      ).rejects.toThrow(
        'Rejected properties remain rejected until they are resubmitted',
      );
      expect(property.updateMany).not.toHaveBeenCalled();
    },
  );

  it('does not reveal a property owned by another landlord', async () => {
    property.findFirst.mockResolvedValue(null);
    await expect(
      service.update('property-1', 'landlord-2', { title: 'Other listing' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(property.update).not.toHaveBeenCalled();
  });

  it('does not update when submission wins after the preliminary read', async () => {
    property.findFirst
      .mockResolvedValueOnce({ id: 'property-1', status: PropertyStatus.DRAFT })
      .mockResolvedValueOnce({ status: PropertyStatus.PENDING_REVIEW });
    property.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.update('property-1', 'landlord-1', { title: 'Stale edit' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(property.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'property-1',
        landlordId: 'landlord-1',
        status: {
          in: [
            PropertyStatus.DRAFT,
            PropertyStatus.PAUSED,
            PropertyStatus.REJECTED,
          ],
        },
      },
      data: { title: 'Stale edit' },
    });
    expect(property.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('maps interaction-history delete constraints to a conflict', async () => {
    property.findFirst.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.PAUSED,
    });
    property.deleteMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('constraint', {
        code: 'P2003',
        clientVersion: '6.19.1',
      }),
    );
    propertyPhoto.findMany.mockResolvedValue([{ objectKey: 'properties/a' }]);

    await expect(
      service.remove('property-1', 'landlord-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('cleans stored photo objects after a property is deleted', async () => {
    property.findFirst.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.DRAFT,
    });
    propertyPhoto.findMany.mockResolvedValue([
      { objectKey: 'properties/one' },
      { objectKey: 'properties/two' },
    ]);
    property.deleteMany.mockResolvedValue({ count: 1 });
    await service.remove('property-1', 'landlord-1');
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });

  it('does not delete when submission wins after the preliminary read', async () => {
    property.findFirst
      .mockResolvedValueOnce({ id: 'property-1', status: PropertyStatus.DRAFT })
      .mockResolvedValueOnce({ status: PropertyStatus.PENDING_REVIEW });
    propertyPhoto.findMany.mockResolvedValue([{ objectKey: 'properties/one' }]);
    property.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.remove('property-1', 'landlord-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(property.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'property-1',
        landlordId: 'landlord-1',
        status: {
          in: [
            PropertyStatus.DRAFT,
            PropertyStatus.PAUSED,
            PropertyStatus.REJECTED,
          ],
        },
      },
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('does not delete a photo when submission wins after the preliminary read', async () => {
    property.findFirst
      .mockResolvedValueOnce({ id: 'property-1', status: PropertyStatus.DRAFT })
      .mockResolvedValueOnce({ status: PropertyStatus.PENDING_REVIEW });
    propertyPhoto.findFirst.mockResolvedValue({ objectKey: 'properties/one' });
    propertyPhoto.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.deletePhoto('property-1', 'photo-1', 'landlord-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(propertyPhoto.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'photo-1',
        propertyId: 'property-1',
        property: {
          landlordId: 'landlord-1',
          status: {
            in: [
              PropertyStatus.DRAFT,
              PropertyStatus.PAUSED,
              PropertyStatus.REJECTED,
            ],
          },
        },
      },
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('cleans up an attempted object key when storage put throws', async () => {
    property.findFirst.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.DRAFT,
    });
    storage.put.mockRejectedValue(new Error('lost response'));
    await expect(
      service.addPhoto('property-1', 'landlord-1', photo()),
    ).rejects.toThrow('lost response');
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(propertyPhoto.create).not.toHaveBeenCalled();
  });

  it('preserves the upload error when cleanup also fails', async () => {
    property.findFirst.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.DRAFT,
    });
    storage.put.mockRejectedValue(new Error('original upload error'));
    storage.delete.mockRejectedValue(new Error('cleanup error'));
    await expect(
      service.addPhoto('property-1', 'landlord-1', photo()),
    ).rejects.toThrow('original upload error');
  });

  it('rejects unsupported and oversized property photos', async () => {
    await expect(
      service.addPhoto('property-1', 'landlord-1', {
        ...photo(),
        mimetype: 'image/gif',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.addPhoto('property-1', 'landlord-1', {
        ...photo(),
        size: 5 * 1024 * 1024 + 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('enforces the ten-photo limit and cleans up the stored upload', async () => {
    property.findFirst.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.DRAFT,
    });
    propertyPhoto.count.mockResolvedValue(10);
    await expect(
      service.addPhoto('property-1', 'landlord-1', photo()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });

  it('cleans up stored content when database persistence fails', async () => {
    property.findFirst.mockResolvedValue({
      id: 'property-1',
      status: PropertyStatus.DRAFT,
    });
    propertyPhoto.count.mockResolvedValue(0);
    propertyPhoto.create.mockRejectedValue(new Error('database unavailable'));
    await expect(
      service.addPhoto('property-1', 'landlord-1', photo()),
    ).rejects.toThrow('database unavailable');
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });

  it('resubmits a rejected property and clears its rejection reason', async () => {
    property.findFirst.mockResolvedValue({
      status: PropertyStatus.REJECTED,
      _count: { photos: 3 },
    });
    property.updateMany.mockResolvedValue({ count: 1 });
    property.findUniqueOrThrow.mockResolvedValue({
      status: PropertyStatus.PENDING_REVIEW,
    });
    await expect(
      service.submitReview('property-1', 'landlord-1', UserRole.LANDLORD),
    ).resolves.toMatchObject({ status: PropertyStatus.PENDING_REVIEW });
    expect(property.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'property-1',
        landlordId: 'landlord-1',
        status: {
          in: [
            PropertyStatus.DRAFT,
            PropertyStatus.PAUSED,
            PropertyStatus.REJECTED,
          ],
        },
      },
      data: {
        status: PropertyStatus.PENDING_REVIEW,
        rejectionReason: null,
      },
    });
  });

  it('rejects submission without three photos and stale submission state', async () => {
    property.findFirst.mockResolvedValueOnce({
      status: PropertyStatus.DRAFT,
      _count: { photos: 2 },
    });
    await expect(
      service.submitReview('property-1', 'landlord-1', UserRole.LANDLORD),
    ).rejects.toBeInstanceOf(BadRequestException);
    property.findFirst.mockResolvedValueOnce({
      status: PropertyStatus.PENDING_REVIEW,
      _count: { photos: 3 },
    });
    await expect(
      service.submitReview('property-1', 'landlord-1', UserRole.LANDLORD),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows an ADMIN owner to submit without a landlord verification row', async () => {
    property.findFirst.mockResolvedValue({
      status: PropertyStatus.DRAFT,
      _count: { photos: 3 },
    });
    property.updateMany.mockResolvedValue({ count: 1 });
    property.findUniqueOrThrow.mockResolvedValue({
      status: PropertyStatus.PENDING_REVIEW,
    });

    await service.submitReview('property-1', 'admin-1', UserRole.ADMIN);

    expect(verification.findFirst).not.toHaveBeenCalled();
    expect(property.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'property-1',
        landlordId: 'admin-1',
        status: {
          in: [
            PropertyStatus.DRAFT,
            PropertyStatus.PAUSED,
            PropertyStatus.REJECTED,
          ],
        },
      },
      data: {
        status: PropertyStatus.PENDING_REVIEW,
        rejectionReason: null,
      },
    });
  });

  it('requires an approved verification for a normal LANDLORD submission', async () => {
    property.findFirst.mockResolvedValue({
      status: PropertyStatus.DRAFT,
      _count: { photos: 3 },
    });
    verification.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.submitReview('property-1', 'landlord-1', UserRole.LANDLORD),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(property.updateMany).not.toHaveBeenCalled();
  });
});

function photo() {
  return {
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    mimetype: 'image/jpeg',
    originalname: 'room.jpg',
    size: 4,
  };
}

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
