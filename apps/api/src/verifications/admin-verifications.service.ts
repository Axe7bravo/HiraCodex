import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VerificationStatus, VerificationType } from '@prisma/client';
import { EmailService } from '../auth/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { VERIFICATION_DOCUMENT_STORAGE } from './verification-document-storage';
import type { VerificationDocumentStorage } from './verification-document-storage';

const ownerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  tenantProfile: { select: { institution: true } },
  landlordProfile: { select: { organisation: true } },
} satisfies Prisma.UserSelect;

const documentSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} satisfies Prisma.VerificationDocumentSelect;

@Injectable()
export class AdminVerificationsService {
  private readonly logger = new Logger(AdminVerificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @Inject(VERIFICATION_DOCUMENT_STORAGE)
    private readonly storage: VerificationDocumentStorage,
  ) {}

  async list(type?: VerificationType) {
    const rows = await this.prisma.verification.findMany({
      where: { status: VerificationStatus.PENDING, ...(type ? { type } : {}) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        user: { select: ownerSelect },
        _count: { select: { documents: true } },
      },
    });
    return rows.map(({ _count, ...verification }) => ({
      ...verification,
      documentCount: _count.documents,
    }));
  }

  async getDetail(id: string) {
    const verification = await this.prisma.verification.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        reviewedAt: true,
        user: { select: ownerSelect },
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        documents: {
          select: documentSelect,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!verification) throw new NotFoundException('Verification not found');
    return verification;
  }

  async getDocument(verificationId: string, documentId: string) {
    const document = await this.prisma.verificationDocument.findFirst({
      where: { id: documentId, verificationId },
      select: { objectKey: true, originalName: true, mimeType: true },
    });
    if (!document)
      throw new NotFoundException('Verification document not found');
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

  async review(id: string, adminId: string, input: ReviewVerificationDto) {
    this.validateDecision(input);
    const reviewedAt = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.verification.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          type: true,
          status: true,
          user: { select: { email: true } },
        },
      });
      if (!current) throw new NotFoundException('Verification not found');

      const claimed = await transaction.verification.updateMany({
        where: { id, status: VerificationStatus.PENDING },
        data: {
          status: input.status,
          rejectionReason:
            input.status === VerificationStatus.REJECTED
              ? input.rejectionReason
              : null,
          reviewedById: adminId,
          reviewedAt,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Verification has already been reviewed');
      }

      await transaction.auditLog.create({
        data: {
          actorId: adminId,
          action:
            input.status === VerificationStatus.APPROVED
              ? 'VERIFICATION_APPROVED'
              : 'VERIFICATION_REJECTED',
          targetType: 'Verification',
          targetId: id,
          metadata: {
            previousStatus: current.status,
            newStatus: input.status,
            verificationType: current.type,
            ownerUserId: current.userId,
          },
        },
      });
      return { email: current.user.email, status: input.status };
    });

    try {
      if (result.status === VerificationStatus.APPROVED) {
        await this.email.sendVerificationApproved(result.email);
      } else {
        await this.email.sendVerificationRejected(
          result.email,
          input.rejectionReason!,
        );
      }
    } catch {
      this.logger.error('Verification decision email delivery failed');
    }
    return this.getDetail(id);
  }

  private validateDecision(input: ReviewVerificationDto): void {
    if (
      input.status === VerificationStatus.REJECTED &&
      !input.rejectionReason
    ) {
      throw new BadRequestException('A rejection reason is required');
    }
    if (
      input.status === VerificationStatus.APPROVED &&
      input.rejectionReason !== undefined
    ) {
      throw new BadRequestException(
        'Approval must not include a rejection reason',
      );
    }
  }
}
