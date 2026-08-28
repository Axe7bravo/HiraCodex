import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AccommodationRequestStatus } from '@prisma/client';
import { AccommodationRequestsService } from './accommodation-requests.service';

describe('AccommodationRequestsService', () => {
  const eligiblePropertyQuery = jest.fn();
  const create = jest.fn();
  const findMany = jest.fn();
  const updateMany = jest.fn();
  const findFirst = jest.fn();
  const transactionClient = {
    $queryRaw: eligiblePropertyQuery,
    accommodationRequest: { create },
  };
  const prisma = {
    $transaction: jest.fn(
      (operation: (transaction: typeof transactionClient) => unknown) =>
        operation(transactionClient),
    ),
    accommodationRequest: { findMany, updateMany, findFirst },
  };
  const email = {
    sendNewAccommodationRequest: jest.fn(),
    sendAccommodationRequestAccepted: jest.fn(),
    sendAccommodationRequestDeclined: jest.fn(),
  };
  const service = new AccommodationRequestsService(
    prisma as never,
    email as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    email.sendNewAccommodationRequest.mockResolvedValue(undefined);
    email.sendAccommodationRequestAccepted.mockResolvedValue(undefined);
    email.sendAccommodationRequestDeclined.mockResolvedValue(undefined);
  });

  it('creates from the locked ACTIVE property with session ownership and UTC midnight', async () => {
    eligiblePropertyQuery.mockResolvedValue([
      {
        id: 'property-1',
        landlordId: 'landlord-1',
        landlordEmail: 'landlord@example.com',
      },
    ]);
    create.mockResolvedValue({
      id: 'request-1',
      status: AccommodationRequestStatus.PENDING,
    });
    await expect(
      service.create('tenant-1', 'property-1', {
        preferredMoveInDate: '2026-09-15',
        note: 'Hello',
      }),
    ).resolves.toMatchObject({ id: 'request-1' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          propertyId: 'property-1',
          tenantId: 'tenant-1',
          landlordId: 'landlord-1',
          preferredMoveInDate: new Date('2026-09-15T00:00:00.000Z'),
          note: 'Hello',
        },
      }),
    );
    expect(email.sendNewAccommodationRequest).toHaveBeenCalledWith(
      'landlord@example.com',
    );
  });

  it('returns 404 and sends no email when no ACTIVE property is locked', async () => {
    eligiblePropertyQuery.mockResolvedValue([]);
    await expect(
      service.create('tenant-1', 'property-1', {
        preferredMoveInDate: '2026-09-15',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
    expect(email.sendNewAccommodationRequest).not.toHaveBeenCalled();
  });

  it('scopes tenant and landlord lists by session ownership', async () => {
    findMany.mockResolvedValue([]);
    await service.listForTenant('tenant-1');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
    await service.listForLandlord('landlord-1');
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          landlordId: 'landlord-1',
          property: { landlordId: 'landlord-1' },
        },
      }),
    );
  });

  it.each([
    AccommodationRequestStatus.ACCEPTED,
    AccommodationRequestStatus.DECLINED,
  ])(
    'atomically decides PENDING -> %s and emails the tenant',
    async (target) => {
      updateMany.mockResolvedValue({ count: 1 });
      findFirst.mockResolvedValue(landlordRequest(target));
      await expect(
        service.decide(
          'landlord-1',
          'request-1',
          target,
          target === AccommodationRequestStatus.DECLINED
            ? 'Room unavailable'
            : undefined,
        ),
      ).resolves.toMatchObject({ status: target });
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: 'request-1',
          landlordId: 'landlord-1',
          property: { landlordId: 'landlord-1' },
          status: AccommodationRequestStatus.PENDING,
        },
        data: {
          status: target,
          declineReason:
            target === AccommodationRequestStatus.DECLINED
              ? 'Room unavailable'
              : null,
        },
      });
      if (target === AccommodationRequestStatus.ACCEPTED) {
        expect(email.sendAccommodationRequestAccepted).toHaveBeenCalledWith(
          'tenant@example.com',
        );
      } else {
        expect(email.sendAccommodationRequestDeclined).toHaveBeenCalledWith(
          'tenant@example.com',
          'Room unavailable',
        );
      }
    },
  );

  it('rejects a declined transition without a non-whitespace reason', async () => {
    await expect(
      service.decide(
        'landlord-1',
        'request-1',
        AccommodationRequestStatus.DECLINED,
        '   ',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('atomically cancels only a tenant-owned PENDING request', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findFirst.mockResolvedValue({
      id: 'request-1',
      status: AccommodationRequestStatus.CANCELLED,
    });
    await expect(
      service.cancel('tenant-1', 'request-1'),
    ).resolves.toMatchObject({ status: AccommodationRequestStatus.CANCELLED });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'request-1',
        tenantId: 'tenant-1',
        status: AccommodationRequestStatus.PENDING,
      },
      data: {
        status: AccommodationRequestStatus.CANCELLED,
        declineReason: null,
      },
    });
  });

  it('hides other owners and conflicts on a stale terminal transition', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findFirst.mockResolvedValue(null);
    await expect(
      service.decide(
        'landlord-2',
        'request-1',
        AccommodationRequestStatus.ACCEPTED,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    findFirst.mockResolvedValue(
      landlordRequest(AccommodationRequestStatus.DECLINED),
    );
    await expect(
      service.decide(
        'landlord-1',
        'request-1',
        AccommodationRequestStatus.ACCEPTED,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not roll back a persisted request or decision when email fails', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    eligiblePropertyQuery.mockResolvedValue([
      {
        id: 'property-1',
        landlordId: 'landlord-1',
        landlordEmail: 'landlord@example.com',
      },
    ]);
    create.mockResolvedValue({ id: 'request-1' });
    email.sendNewAccommodationRequest.mockRejectedValue(new Error('failed'));
    await expect(
      service.create('tenant-1', 'property-1', {
        preferredMoveInDate: '2026-09-15',
      }),
    ).resolves.toEqual({ id: 'request-1' });
    updateMany.mockResolvedValue({ count: 1 });
    findFirst.mockResolvedValue(
      landlordRequest(AccommodationRequestStatus.ACCEPTED),
    );
    email.sendAccommodationRequestAccepted.mockRejectedValue(
      new Error('failed'),
    );
    await expect(
      service.decide(
        'landlord-1',
        'request-1',
        AccommodationRequestStatus.ACCEPTED,
      ),
    ).resolves.toMatchObject({ status: AccommodationRequestStatus.ACCEPTED });
  });
});

function landlordRequest(status: AccommodationRequestStatus) {
  return {
    id: 'request-1',
    status,
    declineReason:
      status === AccommodationRequestStatus.DECLINED
        ? 'Room unavailable'
        : null,
    tenant: {
      email: 'tenant@example.com',
      firstName: 'Lerato',
      lastName: 'Molefe',
      phone: null,
      contactMethod: null,
      tenantProfile: null,
      verifications: [],
    },
  };
}
