import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PropertyStatus } from '@prisma/client';
import { AdminPropertiesService } from './admin-properties.service';

describe('AdminPropertiesService', () => {
  const property = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };
  const propertyPhoto = { findFirst: jest.fn() };
  const auditLog = { findFirst: jest.fn(), create: jest.fn() };
  const prisma = {
    property,
    propertyPhoto,
    auditLog,
    $transaction: jest.fn((callback: (client: unknown) => unknown) =>
      callback({ property, auditLog }),
    ),
  };
  const email = {
    sendPropertyApproved: jest.fn(),
    sendPropertyRejected: jest.fn(),
  };
  const storage = { get: jest.fn(), put: jest.fn(), delete: jest.fn() };
  const service = new AdminPropertiesService(
    prisma as never,
    email as never,
    storage,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    email.sendPropertyApproved.mockResolvedValue(undefined);
    email.sendPropertyRejected.mockResolvedValue(undefined);
    auditLog.findFirst.mockResolvedValue(null);
  });

  it('lists only pending properties oldest first with safe fields', async () => {
    property.findMany.mockResolvedValue([]);
    await service.list();
    expect(property.findMany).toHaveBeenCalledWith({
      where: { status: PropertyStatus.PENDING_REVIEW },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        monthlyPrice: true,
        status: true,
        country: true,
        city: true,
        area: true,
        updatedAt: true,
        landlord: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            contactMethod: true,
            landlordProfile: {
              select: { organisation: true, propertyCount: true },
            },
          },
        },
        _count: { select: { photos: true } },
      },
    });
  });

  it('retrieves a photo internally without exposing storage failures', async () => {
    propertyPhoto.findFirst.mockResolvedValue({
      objectKey: 'private/key',
      mimeType: 'image/jpeg',
    });
    storage.get.mockRejectedValue(new Error('bucket private/key unavailable'));
    await expect(
      service.getPhoto('property-1', 'photo-1'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('approves with a conditional transition and creates one safe audit entry', async () => {
    property.findUnique.mockResolvedValue(currentProperty());
    property.updateMany.mockResolvedValue({ count: 1 });
    auditLog.create.mockResolvedValue({ id: 'audit-1' });
    property.findUnique
      .mockResolvedValueOnce(currentProperty())
      .mockResolvedValueOnce({ id: 'property-1' });

    await service.review('property-1', 'admin-1', {
      status: PropertyStatus.ACTIVE,
    });

    expect(property.updateMany).toHaveBeenCalledWith({
      where: { id: 'property-1', status: PropertyStatus.PENDING_REVIEW },
      data: { status: PropertyStatus.ACTIVE, rejectionReason: null },
    });
    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'PROPERTY_APPROVED',
        targetType: 'Property',
        targetId: 'property-1',
        metadata: {
          previousStatus: PropertyStatus.PENDING_REVIEW,
          newStatus: PropertyStatus.ACTIVE,
          propertyId: 'property-1',
          landlordUserId: 'landlord-1',
        },
      },
    });
    expect(email.sendPropertyApproved).toHaveBeenCalledWith(
      'landlord@example.com',
    );
  });

  it('rejects invalid decisions and stale reviews', async () => {
    await expect(
      service.review('property-1', 'admin-1', {
        status: PropertyStatus.REJECTED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.review('property-1', 'admin-1', {
        status: PropertyStatus.ACTIVE,
        rejectionReason: 'not allowed',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    property.findUnique.mockResolvedValue(currentProperty());
    property.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.review('property-1', 'admin-1', {
        status: PropertyStatus.ACTIVE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('does not roll back a committed rejection when email delivery fails', async () => {
    property.findUnique
      .mockResolvedValueOnce(currentProperty())
      .mockResolvedValueOnce({ id: 'property-1' });
    property.updateMany.mockResolvedValue({ count: 1 });
    auditLog.create.mockResolvedValue({ id: 'audit-1' });
    email.sendPropertyRejected.mockRejectedValue(
      new Error('provider unavailable'),
    );
    await expect(
      service.review('property-1', 'admin-1', {
        status: PropertyStatus.REJECTED,
        rejectionReason: 'Add a clearer exterior photo.',
      }),
    ).resolves.toMatchObject({ id: 'property-1' });
  });
});

function currentProperty() {
  return {
    id: 'property-1',
    landlordId: 'landlord-1',
    status: PropertyStatus.PENDING_REVIEW,
    landlord: { email: 'landlord@example.com' },
  };
}
