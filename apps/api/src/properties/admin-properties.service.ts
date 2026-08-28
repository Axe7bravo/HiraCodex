import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, PropertyStatus } from '@prisma/client';
import { EmailService } from '../auth/email.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewPropertyDto } from './dto/review-property.dto';
import { PROPERTY_PHOTO_STORAGE } from './property-photo-storage';
import type { PropertyPhotoStorage } from './property-photo-storage';

const landlordSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  contactMethod: true,
  landlordProfile: { select: { organisation: true, propertyCount: true } },
} satisfies Prisma.UserSelect;

const photoSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  sortOrder: true,
  createdAt: true,
} satisfies Prisma.PropertyPhotoSelect;

@Injectable()
export class AdminPropertiesService {
  private readonly logger = new Logger(AdminPropertiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @Inject(PROPERTY_PHOTO_STORAGE)
    private readonly storage: PropertyPhotoStorage,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async list() {
    const rows = await this.prisma.property.findMany({
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
        landlord: { select: landlordSelect },
        _count: { select: { photos: true } },
      },
    });
    return rows.map(({ _count, updatedAt, ...property }) => ({
      ...property,
      submittedAt: updatedAt,
      photoCount: _count.photos,
    }));
  }

  async getDetail(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        landlord: { select: landlordSelect },
        photos: { select: photoSelect, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!property) throw new NotFoundException('Property not found');
    const review = await this.prisma.auditLog.findFirst({
      where: {
        targetType: 'Property',
        targetId: id,
        action: { in: ['PROPERTY_APPROVED', 'PROPERTY_REJECTED'] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        action: true,
        createdAt: true,
        actor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    return { ...property, review };
  }

  async getPhoto(propertyId: string, photoId: string) {
    const photo = await this.prisma.propertyPhoto.findFirst({
      where: { id: photoId, propertyId },
      select: { objectKey: true, mimeType: true },
    });
    if (!photo) throw new NotFoundException('Property photo not found');
    try {
      return {
        contents: await this.storage.get(photo.objectKey),
        mimeType: photo.mimeType,
      };
    } catch {
      throw new InternalServerErrorException(
        'Property photo could not be retrieved',
      );
    }
  }

  async review(id: string, adminId: string, input: ReviewPropertyDto) {
    this.validateDecision(input);
    const result = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.property.findUnique({
        where: { id },
        select: {
          id: true,
          landlordId: true,
          status: true,
          landlord: { select: { email: true } },
        },
      });
      if (!current) throw new NotFoundException('Property not found');

      const decided = await transaction.property.updateMany({
        where: { id, status: PropertyStatus.PENDING_REVIEW },
        data: {
          status: input.status,
          rejectionReason:
            input.status === PropertyStatus.REJECTED
              ? input.rejectionReason
              : null,
        },
      });
      if (decided.count !== 1) {
        throw new ConflictException('Property has already been reviewed');
      }
      await transaction.auditLog.create({
        data: {
          actorId: adminId,
          action:
            input.status === PropertyStatus.ACTIVE
              ? 'PROPERTY_APPROVED'
              : 'PROPERTY_REJECTED',
          targetType: 'Property',
          targetId: id,
          metadata: {
            previousStatus: current.status,
            newStatus: input.status,
            propertyId: current.id,
            landlordUserId: current.landlordId,
          },
        },
      });
      return {
        email: current.landlord.email,
        status: input.status,
        landlordId: current.landlordId,
      };
    });

    if (result.status === PropertyStatus.ACTIVE) {
      this.analytics?.capture('property_approved', result.landlordId, {
        propertyId: id,
        landlordId: result.landlordId,
      });
    }

    try {
      if (result.status === PropertyStatus.ACTIVE) {
        await this.email.sendPropertyApproved(result.email);
      } else {
        await this.email.sendPropertyRejected(
          result.email,
          input.rejectionReason!,
        );
      }
    } catch {
      this.logger.error('Property decision email delivery failed');
    }
    return this.getDetail(id);
  }

  private validateDecision(input: ReviewPropertyDto): void {
    if (input.status === PropertyStatus.REJECTED && !input.rejectionReason) {
      throw new BadRequestException('A rejection reason is required');
    }
    if (
      input.status === PropertyStatus.ACTIVE &&
      input.rejectionReason !== undefined
    ) {
      throw new BadRequestException(
        'Approval must not include a rejection reason',
      );
    }
  }
}
