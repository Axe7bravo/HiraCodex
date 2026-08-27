import { Logger, NotFoundException } from '@nestjs/common';
import {
  InquiryStatus,
  VerificationStatus,
  VerificationType,
} from '@prisma/client';
import { InquiriesService } from './inquiries.service';

describe('InquiriesService', () => {
  const eligiblePropertyQuery = jest.fn();
  const inquiryCreate = jest.fn();
  const inquiryFindMany = jest.fn();
  const inquiryUpdateMany = jest.fn();
  const inquiryFindFirst = jest.fn();
  const transactionClient = {
    $queryRaw: eligiblePropertyQuery,
    inquiry: { create: inquiryCreate },
  };
  const prisma = {
    $transaction: jest.fn(
      (operation: (transaction: typeof transactionClient) => unknown) =>
        operation(transactionClient),
    ),
    inquiry: {
      create: inquiryCreate,
      findMany: inquiryFindMany,
      updateMany: inquiryUpdateMany,
      findFirst: inquiryFindFirst,
    },
  };
  const email = { sendNewInquiry: jest.fn() };
  const service = new InquiriesService(prisma as never, email as never);

  beforeEach(() => {
    jest.clearAllMocks();
    email.sendNewInquiry.mockResolvedValue(undefined);
  });

  it('derives ownership from an ACTIVE property and stores UTC midnight', async () => {
    eligiblePropertyQuery.mockResolvedValue([
      {
        id: 'property-1',
        landlordId: 'landlord-1',
        landlordEmail: 'landlord@example.com',
      },
    ]);
    inquiryCreate.mockResolvedValue({ id: 'inquiry-1' });

    await expect(
      service.create('tenant-1', 'property-1', {
        message: 'Is this room still available?',
        moveInDate: '2026-09-15',
      }),
    ).resolves.toEqual({ id: 'inquiry-1' });
    expect(eligiblePropertyQuery).toHaveBeenCalledTimes(1);
    expect(inquiryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          propertyId: 'property-1',
          tenantId: 'tenant-1',
          landlordId: 'landlord-1',
          message: 'Is this room still available?',
          moveInDate: new Date('2026-09-15T00:00:00.000Z'),
        },
      }),
    );
  });

  it('does not create an inquiry when an ACTIVE property is unavailable', async () => {
    eligiblePropertyQuery.mockResolvedValue([]);
    await expect(
      service.create('tenant-1', 'private-property', { message: 'Hello' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(inquiryCreate).not.toHaveBeenCalled();
    expect(email.sendNewInquiry).not.toHaveBeenCalled();
  });

  it('scopes tenant history by the session tenant', async () => {
    inquiryFindMany.mockResolvedValue([]);
    await service.listForTenant('tenant-1');
    expect(inquiryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
  });

  it('scopes the landlord inbox and derives student verification', async () => {
    inquiryFindMany.mockResolvedValue([
      {
        id: 'inquiry-1',
        tenant: {
          firstName: 'Lerato',
          lastName: 'Molefe',
          phone: '50000000',
          contactMethod: 'WhatsApp',
          tenantProfile: { institution: 'Limkokwing University' },
          verifications: [{ id: 'verified' }],
        },
      },
    ]);
    await expect(service.listForLandlord('landlord-1')).resolves.toEqual([
      {
        id: 'inquiry-1',
        tenant: {
          firstName: 'Lerato',
          lastName: 'Molefe',
          phone: '50000000',
          contactMethod: 'WhatsApp',
          institution: 'Limkokwing University',
          verified: true,
        },
      },
    ]);
    expect(inquiryFindMany).toHaveBeenCalledWith({
      where: {
        landlordId: 'landlord-1',
        property: { landlordId: 'landlord-1' },
      },
      select: {
        id: true,
        propertyId: true,
        message: true,
        moveInDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        property: {
          select: {
            id: true,
            title: true,
            monthlyPrice: true,
            roomType: true,
            area: true,
            city: true,
            nearestInstitution: true,
          },
        },
        tenant: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            contactMethod: true,
            tenantProfile: { select: { institution: true } },
            verifications: {
              where: {
                type: VerificationType.STUDENT,
                status: VerificationStatus.APPROVED,
              },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });

  it('keeps a created inquiry when notification delivery fails', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    eligiblePropertyQuery.mockResolvedValue([
      {
        id: 'property-1',
        landlordId: 'landlord-1',
        landlordEmail: 'landlord@example.com',
      },
    ]);
    inquiryCreate.mockResolvedValue({ id: 'inquiry-1' });
    email.sendNewInquiry.mockRejectedValue(new Error('delivery failed'));
    await expect(
      service.create('tenant-1', 'property-1', { message: 'Hello' }),
    ).resolves.toEqual({ id: 'inquiry-1' });
  });

  it('conditionally transitions an owned OPEN inquiry to RESPONDED', async () => {
    inquiryUpdateMany.mockResolvedValue({ count: 1 });
    inquiryFindFirst.mockResolvedValue(
      landlordInquiry(InquiryStatus.RESPONDED),
    );

    await expect(
      service.updateStatus('landlord-1', 'inquiry-1', InquiryStatus.RESPONDED),
    ).resolves.toMatchObject({ status: InquiryStatus.RESPONDED });
    expect(inquiryUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'inquiry-1',
        landlordId: 'landlord-1',
        property: { landlordId: 'landlord-1' },
        status: { in: [InquiryStatus.OPEN] },
      },
      data: { status: InquiryStatus.RESPONDED },
    });
  });

  it('conditionally transitions RESPONDED to CLOSED', async () => {
    inquiryUpdateMany.mockResolvedValue({ count: 1 });
    inquiryFindFirst.mockResolvedValue(landlordInquiry(InquiryStatus.CLOSED));
    await expect(
      service.updateStatus('landlord-1', 'inquiry-1', InquiryStatus.CLOSED),
    ).resolves.toMatchObject({ status: InquiryStatus.CLOSED });
    expect(inquiryUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'inquiry-1',
        landlordId: 'landlord-1',
        property: { landlordId: 'landlord-1' },
        status: { in: [InquiryStatus.OPEN, InquiryStatus.RESPONDED] },
      },
      data: { status: InquiryStatus.CLOSED },
    });
  });

  it('hides another landlord inquiry and rejects reopening CLOSED', async () => {
    inquiryUpdateMany.mockResolvedValue({ count: 0 });
    inquiryFindFirst.mockResolvedValue(null);
    await expect(
      service.updateStatus('landlord-2', 'inquiry-1', InquiryStatus.CLOSED),
    ).rejects.toBeInstanceOf(NotFoundException);

    inquiryFindFirst.mockResolvedValue(landlordInquiry(InquiryStatus.CLOSED));
    await expect(
      service.updateStatus('landlord-1', 'inquiry-1', InquiryStatus.RESPONDED),
    ).rejects.toThrow('Inquiry status transition is not allowed');
  });
});

function landlordInquiry(status: InquiryStatus) {
  return {
    id: 'inquiry-1',
    status,
    tenant: {
      firstName: 'Lerato',
      lastName: 'Molefe',
      phone: null,
      contactMethod: null,
      tenantProfile: null,
      verifications: [],
    },
  };
}
