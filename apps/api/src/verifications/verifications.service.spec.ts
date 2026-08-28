import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole, VerificationStatus, VerificationType } from '@prisma/client';
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
    verificationDocument: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const storage = {
    put: jest.fn(),
    get: jest.fn(),
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

  it('retrieves only a document owned by the authenticated tenant verification', async () => {
    prisma.verificationDocument.findFirst.mockResolvedValueOnce({
      objectKey: 'private-key',
      originalName: 'student.pdf',
      mimeType: 'application/pdf',
    });
    storage.get.mockResolvedValueOnce(Buffer.from('document'));

    await expect(
      service.getMineDocument('tenant-1', UserRole.TENANT, 'document-1'),
    ).resolves.toMatchObject({ originalName: 'student.pdf' });
    expect(prisma.verificationDocument.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        verification: {
          userId: 'tenant-1',
          type: VerificationType.STUDENT,
        },
      },
      select: { objectKey: true, originalName: true, mimeType: true },
    });
  });

  it('does not retrieve a document outside the authenticated owner scope', async () => {
    prisma.verificationDocument.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.getMineDocument(
        'landlord-1',
        UserRole.LANDLORD,
        'other-document',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.get).not.toHaveBeenCalled();
  });
});
