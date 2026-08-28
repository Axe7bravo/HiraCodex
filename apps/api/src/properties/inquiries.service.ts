import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  InquiryStatus,
  Prisma,
  PropertyStatus,
  VerificationStatus,
  VerificationType,
} from '@prisma/client';
import { EmailService } from '../auth/email.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import type { LandlordInquiryTargetStatus } from './dto/update-inquiry-status.dto';

const safePropertySummary = {
  id: true,
  title: true,
  monthlyPrice: true,
  roomType: true,
  area: true,
  city: true,
  nearestInstitution: true,
} satisfies Prisma.PropertySelect;

const inquiryBaseSelect = {
  id: true,
  propertyId: true,
  message: true,
  moveInDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  property: { select: safePropertySummary },
} satisfies Prisma.InquirySelect;

const landlordInquirySelect = {
  ...inquiryBaseSelect,
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
} satisfies Prisma.InquirySelect;

@Injectable()
export class InquiriesService {
  private readonly logger = new Logger(InquiriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async create(tenantId: string, propertyId: string, input: CreateInquiryDto) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const [property] = await transaction.$queryRaw<
        Array<{ id: string; landlordId: string; landlordEmail: string }>
      >`
        SELECT property."id", property."landlordId", landlord."email" AS "landlordEmail"
        FROM "Property" AS property
        INNER JOIN "User" AS landlord ON landlord."id" = property."landlordId"
        WHERE property."id" = ${propertyId}
          AND property."status" = ${PropertyStatus.ACTIVE}::"PropertyStatus"
        FOR SHARE OF property
      `;
      if (!property) throw new NotFoundException('Property not found');

      const inquiry = await transaction.inquiry.create({
        data: {
          propertyId: property.id,
          tenantId,
          landlordId: property.landlordId,
          message: input.message,
          moveInDate: input.moveInDate
            ? new Date(`${input.moveInDate}T00:00:00.000Z`)
            : null,
        },
        select: inquiryBaseSelect,
      });
      return { inquiry, landlordEmail: property.landlordEmail };
    });

    this.analytics?.capture('inquiry_created', tenantId, {
      userId: tenantId,
      propertyId: result.inquiry.propertyId,
      inquiryId: result.inquiry.id,
    });

    try {
      await this.email.sendNewInquiry(result.landlordEmail);
    } catch {
      this.logger.error('New inquiry email delivery failed');
    }
    return result.inquiry;
  }

  listForTenant(tenantId: string) {
    return this.prisma.inquiry.findMany({
      where: { tenantId },
      select: inquiryBaseSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async listForLandlord(landlordId: string) {
    const inquiries = await this.prisma.inquiry.findMany({
      where: { landlordId, property: { landlordId } },
      select: landlordInquirySelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return inquiries.map((inquiry) => this.toLandlordInquiry(inquiry));
  }

  async updateStatus(
    landlordId: string,
    id: string,
    target: LandlordInquiryTargetStatus,
  ) {
    const currentStatuses =
      target === InquiryStatus.RESPONDED
        ? [InquiryStatus.OPEN]
        : [InquiryStatus.OPEN, InquiryStatus.RESPONDED];
    const changed = await this.prisma.inquiry.updateMany({
      where: {
        id,
        landlordId,
        property: { landlordId },
        status: { in: currentStatuses },
      },
      data: { status: target },
    });

    const inquiry = await this.prisma.inquiry.findFirst({
      where: { id, landlordId, property: { landlordId } },
      select: landlordInquirySelect,
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    if (changed.count === 0 && inquiry.status !== target) {
      throw new ConflictException('Inquiry status transition is not allowed');
    }
    return this.toLandlordInquiry(inquiry);
  }

  private toLandlordInquiry(
    inquiry: Prisma.InquiryGetPayload<{ select: typeof landlordInquirySelect }>,
  ) {
    const { tenant, ...safeInquiry } = inquiry;
    return {
      ...safeInquiry,
      tenant: {
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        phone: tenant.phone,
        contactMethod: tenant.contactMethod,
        institution: tenant.tenantProfile?.institution ?? null,
        verified: tenant.verifications.length > 0,
      },
    };
  }
}
