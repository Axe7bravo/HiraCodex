import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccommodationRequestStatus,
  Prisma,
  PropertyStatus,
  VerificationStatus,
  VerificationType,
} from '@prisma/client';
import { EmailService } from '../auth/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccommodationRequestDto } from './dto/create-accommodation-request.dto';

type LandlordDecision = Extract<
  AccommodationRequestStatus,
  'ACCEPTED' | 'DECLINED'
>;

const safePropertySummary = {
  id: true,
  title: true,
  monthlyPrice: true,
  roomType: true,
  area: true,
  city: true,
  nearestInstitution: true,
} satisfies Prisma.PropertySelect;

const requestBaseSelect = {
  id: true,
  propertyId: true,
  preferredMoveInDate: true,
  note: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  property: { select: safePropertySummary },
} satisfies Prisma.AccommodationRequestSelect;

const safeTenantSelect = {
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
} satisfies Prisma.UserSelect;

const landlordRequestSelect = {
  ...requestBaseSelect,
  tenant: { select: safeTenantSelect },
} satisfies Prisma.AccommodationRequestSelect;

const decisionRequestSelect = {
  ...requestBaseSelect,
  tenant: { select: { ...safeTenantSelect, email: true } },
} satisfies Prisma.AccommodationRequestSelect;

@Injectable()
export class AccommodationRequestsService {
  private readonly logger = new Logger(AccommodationRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async create(
    tenantId: string,
    propertyId: string,
    input: CreateAccommodationRequestDto,
  ) {
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
      const accommodationRequest =
        await transaction.accommodationRequest.create({
          data: {
            propertyId: property.id,
            tenantId,
            landlordId: property.landlordId,
            preferredMoveInDate: new Date(
              `${input.preferredMoveInDate}T00:00:00.000Z`,
            ),
            note: input.note ?? null,
          },
          select: requestBaseSelect,
        });
      return { accommodationRequest, landlordEmail: property.landlordEmail };
    });
    try {
      await this.email.sendNewAccommodationRequest(result.landlordEmail);
    } catch {
      this.logger.error('New accommodation request email delivery failed');
    }
    return result.accommodationRequest;
  }

  listForTenant(tenantId: string) {
    return this.prisma.accommodationRequest.findMany({
      where: { tenantId },
      select: requestBaseSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async listForLandlord(landlordId: string) {
    const requests = await this.prisma.accommodationRequest.findMany({
      where: { landlordId, property: { landlordId } },
      select: landlordRequestSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return requests.map((request) => this.toLandlordRequest(request));
  }

  async decide(landlordId: string, id: string, target: LandlordDecision) {
    const changed = await this.prisma.accommodationRequest.updateMany({
      where: {
        id,
        landlordId,
        property: { landlordId },
        status: AccommodationRequestStatus.PENDING,
      },
      data: { status: target },
    });
    const request = await this.prisma.accommodationRequest.findFirst({
      where: { id, landlordId, property: { landlordId } },
      select: decisionRequestSelect,
    });
    if (!request)
      throw new NotFoundException('Accommodation request not found');
    if (changed.count === 0 && request.status !== target)
      throw new ConflictException(
        'Accommodation request transition is not allowed',
      );
    if (changed.count > 0) {
      try {
        if (target === AccommodationRequestStatus.ACCEPTED)
          await this.email.sendAccommodationRequestAccepted(
            request.tenant.email,
          );
        else
          await this.email.sendAccommodationRequestDeclined(
            request.tenant.email,
          );
      } catch {
        this.logger.error(
          'Accommodation request decision email delivery failed',
        );
      }
    }
    return this.toLandlordRequest(request);
  }

  async cancel(tenantId: string, id: string) {
    const changed = await this.prisma.accommodationRequest.updateMany({
      where: { id, tenantId, status: AccommodationRequestStatus.PENDING },
      data: { status: AccommodationRequestStatus.CANCELLED },
    });
    const request = await this.prisma.accommodationRequest.findFirst({
      where: { id, tenantId },
      select: requestBaseSelect,
    });
    if (!request)
      throw new NotFoundException('Accommodation request not found');
    if (
      changed.count === 0 &&
      request.status !== AccommodationRequestStatus.CANCELLED
    )
      throw new ConflictException(
        'Accommodation request transition is not allowed',
      );
    return request;
  }

  private toLandlordRequest(
    request:
      | Prisma.AccommodationRequestGetPayload<{
          select: typeof landlordRequestSelect;
        }>
      | Prisma.AccommodationRequestGetPayload<{
          select: typeof decisionRequestSelect;
        }>,
  ) {
    const { tenant, ...safeRequest } = request;
    return {
      ...safeRequest,
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
