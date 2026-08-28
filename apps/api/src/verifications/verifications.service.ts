import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  UserRole,
  VerificationStatus,
  VerificationType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { VERIFICATION_DOCUMENT_STORAGE } from './verification-document-storage';
import type { VerificationDocumentStorage } from './verification-document-storage';

export const ALLOWED_VERIFICATION_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;
export const MAX_VERIFICATION_FILE_SIZE = 10 * 1024 * 1024;

export type VerificationUpload = Pick<
  Express.Multer.File,
  'buffer' | 'mimetype' | 'originalname' | 'size'
>;

const verificationResponseSelect = {
  id: true,
  type: true,
  status: true,
  rejectionReason: true,
  reviewedAt: true,
  createdAt: true,
  documents: {
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.VerificationSelect;

@Injectable()
export class VerificationsService {
  private readonly logger = new Logger(VerificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VERIFICATION_DOCUMENT_STORAGE)
    private readonly storage: VerificationDocumentStorage,
  ) {}

  async getMine(userId: string, role: UserRole) {
    const type = this.typeForRole(role);
    const verification = await this.prisma.verification.findFirst({
      where: { userId, type },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: verificationResponseSelect,
    });

    return (
      verification ?? {
        id: null,
        type,
        status: 'NOT_SUBMITTED' as const,
        rejectionReason: null,
        reviewedAt: null,
        createdAt: null,
        documents: [],
      }
    );
  }

  async getMineDocument(userId: string, role: UserRole, documentId: string) {
    const type = this.typeForRole(role);
    const document = await this.prisma.verificationDocument.findFirst({
      where: {
        id: documentId,
        verification: { userId, type },
      },
      select: { objectKey: true, originalName: true, mimeType: true },
    });
    if (!document) {
      throw new NotFoundException('Verification document not found');
    }
    try {
      return {
        contents: await this.storage.get(document.objectKey),
        originalName: document.originalName,
        mimeType: document.mimeType,
      };
    } catch {
      throw new InternalServerErrorException(
        'Verification document could not be retrieved',
      );
    }
  }

  async submit(userId: string, role: UserRole, files: VerificationUpload[]) {
    const type = this.typeForRole(role);
    this.validateFiles(role, files);
    await this.assertCanSubmit(this.prisma, userId, type);

    const attemptedKeys: string[] = [];
    try {
      const documents: Prisma.VerificationDocumentCreateWithoutVerificationInput[] =
        [];
      for (const file of files) {
        const objectKey = `verifications/${randomUUID()}`;
        attemptedKeys.push(objectKey);
        await this.storage.put(objectKey, file.buffer, file.mimetype);
        documents.push({
          objectKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        });
      }

      return await this.prisma.$transaction(
        async (transaction) => {
          await this.assertCanSubmit(transaction, userId, type);
          return transaction.verification.create({
            data: {
              userId,
              type,
              status: VerificationStatus.PENDING,
              documents: { create: documents },
            },
            select: verificationResponseSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      await this.cleanup(attemptedKeys);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'A verification submission is already pending or approved',
        );
      }
      throw error;
    }
  }

  private typeForRole(role: UserRole): VerificationType {
    if (role === UserRole.TENANT) return VerificationType.STUDENT;
    if (role === UserRole.LANDLORD) return VerificationType.LANDLORD;
    throw new ForbiddenException('Administrators cannot submit verification');
  }

  private validateFiles(role: UserRole, files: VerificationUpload[]): void {
    const requiredCount = role === UserRole.LANDLORD ? 1 : undefined;
    if (
      files.length === 0 ||
      files.length > 3 ||
      (requiredCount !== undefined && files.length !== requiredCount)
    ) {
      throw new BadRequestException(
        role === UserRole.LANDLORD
          ? 'Landlord verification requires exactly one document'
          : 'Student verification requires between one and three documents',
      );
    }

    for (const file of files) {
      if (
        !ALLOWED_VERIFICATION_MIME_TYPES.includes(
          file.mimetype as (typeof ALLOWED_VERIFICATION_MIME_TYPES)[number],
        )
      ) {
        throw new BadRequestException('Unsupported verification document type');
      }
      if (file.size > MAX_VERIFICATION_FILE_SIZE) {
        throw new BadRequestException(
          'Verification documents must not exceed 10 MB each',
        );
      }
    }
  }

  private async assertCanSubmit(
    client: Pick<Prisma.TransactionClient, 'verification'>,
    userId: string,
    type: VerificationType,
  ): Promise<void> {
    const latest = await client.verification.findFirst({
      where: { userId, type },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { status: true },
    });
    if (
      latest?.status === VerificationStatus.PENDING ||
      latest?.status === VerificationStatus.APPROVED
    ) {
      throw new ConflictException(
        'A verification submission is already pending or approved',
      );
    }
  }

  private async cleanup(objectKeys: string[]): Promise<void> {
    await Promise.all(
      objectKeys.map(async (objectKey) => {
        try {
          await this.storage.delete(objectKey);
        } catch {
          this.logger.error('Verification document cleanup failed');
        }
      }),
    );
  }
}
