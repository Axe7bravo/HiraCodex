import { ConflictException } from '@nestjs/common';
import { UserRole, VerificationStatus } from '@prisma/client';
import {
  VerificationsService,
  VerificationUpload,
} from './verifications.service';

const file = (name: string): VerificationUpload => ({
  buffer: Buffer.from(name),
  mimetype: 'application/pdf',
  originalname: name,
  size: Buffer.byteLength(name),
});

describe('VerificationsService', () => {
  const verification = {
    findFirst: jest.fn(),
    create: jest.fn(),
  };
  const prisma = {
    verification,
    $transaction: jest.fn(),
  };
  const storage = {
    put: jest.fn(),
    delete: jest.fn(),
  };
  let service: VerificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    verification.findFirst.mockResolvedValue(null);
    storage.put.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(
      (callback: (client: { verification: typeof verification }) => unknown) =>
        callback({ verification }),
    );
    service = new VerificationsService(prisma as never, storage);
  });

  it('does not create a database row when the first upload fails', async () => {
    storage.put.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(
      service.submit('user-1', UserRole.TENANT, [file('student.pdf')]),
    ).rejects.toThrow('storage unavailable');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });

  it('cleans up successful and uncertain uploads when a later put throws', async () => {
    const remotelyStoredKeys: string[] = [];
    storage.put.mockImplementation((objectKey: string) => {
      remotelyStoredKeys.push(objectKey);
      // Simulates the second object being persisted before its response is lost.
      return remotelyStoredKeys.length === 2
        ? Promise.reject(new Error('second upload response lost'))
        : Promise.resolve();
    });

    await expect(
      service.submit('user-1', UserRole.TENANT, [
        file('student-card.pdf'),
        file('enrolment.pdf'),
      ]),
    ).rejects.toThrow('second upload response lost');
    expect(remotelyStoredKeys).toHaveLength(2);
    expect(storage.delete).toHaveBeenCalledWith(remotelyStoredKeys[0]);
    expect(storage.delete).toHaveBeenCalledWith(remotelyStoredKeys[1]);
    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(verification.create).not.toHaveBeenCalled();
  });

  it('removes every new upload when the database transaction fails', async () => {
    prisma.$transaction.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(
      service.submit('user-1', UserRole.TENANT, [
        file('student-card.pdf'),
        file('enrolment.pdf'),
      ]),
    ).rejects.toThrow('database unavailable');
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });

  it('rejects a new submission when the latest one is pending', async () => {
    verification.findFirst.mockResolvedValueOnce({
      status: VerificationStatus.PENDING,
    });

    await expect(
      service.submit('user-1', UserRole.TENANT, [file('student.pdf')]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.put).not.toHaveBeenCalled();
  });
});
