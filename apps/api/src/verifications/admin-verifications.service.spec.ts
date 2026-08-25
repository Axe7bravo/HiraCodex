import { Logger } from '@nestjs/common';
import { VerificationStatus, VerificationType } from '@prisma/client';
import { AdminVerificationsService } from './admin-verifications.service';

describe('AdminVerificationsService', () => {
  const transaction = {
    verification: { findUnique: jest.fn(), updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    verification: { findUnique: jest.fn(), findMany: jest.fn() },
    verificationDocument: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const email = {
    sendVerificationApproved: jest.fn(),
    sendVerificationRejected: jest.fn(),
  };
  const storage = { put: jest.fn(), get: jest.fn(), delete: jest.fn() };
  let service: AdminVerificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.verification.findUnique.mockResolvedValue({
      id: 'verification-1',
      userId: 'owner-1',
      type: VerificationType.STUDENT,
      status: VerificationStatus.PENDING,
      user: { email: 'owner@example.com' },
    });
    transaction.verification.updateMany.mockResolvedValue({ count: 1 });
    transaction.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );
    prisma.verification.findUnique.mockResolvedValue({
      id: 'verification-1',
      status: VerificationStatus.APPROVED,
      documents: [],
    });
    email.sendVerificationApproved.mockResolvedValue(undefined);
    email.sendVerificationRejected.mockResolvedValue(undefined);
    service = new AdminVerificationsService(
      prisma as never,
      email as never,
      storage,
    );
  });

  it('does not email when mandatory audit creation fails', async () => {
    let persistedStatus: VerificationStatus = VerificationStatus.PENDING;
    prisma.$transaction.mockImplementationOnce(
      async (callback: (client: typeof transaction) => Promise<unknown>) => {
        const previous = persistedStatus;
        transaction.verification.updateMany.mockImplementationOnce(() => {
          persistedStatus = VerificationStatus.APPROVED;
          return Promise.resolve({ count: 1 });
        });
        try {
          return await callback(transaction);
        } catch (error) {
          persistedStatus = previous;
          throw error;
        }
      },
    );
    transaction.auditLog.create.mockRejectedValueOnce(
      new Error('audit insert failed'),
    );

    await expect(
      service.review('verification-1', 'admin-1', {
        status: VerificationStatus.APPROVED,
      }),
    ).rejects.toThrow('audit insert failed');
    expect(transaction.verification.updateMany).toHaveBeenCalled();
    expect(persistedStatus).toBe(VerificationStatus.PENDING);
    expect(email.sendVerificationApproved).not.toHaveBeenCalled();
  });

  it('keeps a successful decision response when email delivery fails', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    email.sendVerificationApproved.mockRejectedValueOnce(
      new Error('provider failed'),
    );

    await expect(
      service.review('verification-1', 'admin-1', {
        status: VerificationStatus.APPROVED,
      }),
    ).resolves.toMatchObject({
      id: 'verification-1',
      status: VerificationStatus.APPROVED,
    });
    expect(transaction.auditLog.create).toHaveBeenCalledTimes(1);
    expect(
      transaction.auditLog.create.mock.invocationCallOrder[0],
    ).toBeLessThan(email.sendVerificationApproved.mock.invocationCallOrder[0]);
    expect(log).toHaveBeenCalledWith(
      'Verification decision email delivery failed',
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('owner@example.com');
    log.mockRestore();
  });
});
