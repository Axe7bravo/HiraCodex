import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  UserRole,
  VerificationStatus,
  VerificationType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const profileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  contactMethod: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  tenantProfile: { select: { institution: true, expectedMoveIn: true } },
  landlordProfile: { select: { organisation: true, propertyCount: true } },
  verifications: {
    select: { id: true, type: true, status: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
  },
} satisfies Prisma.UserSelect;

type ProfileRecord = Prisma.UserGetPayload<{ select: typeof profileSelect }>;
type ProfileClient = Pick<Prisma.TransactionClient, 'user'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.loadProfile(this.prisma, userId);
    return this.toProfileResponse(user);
  }

  async updateMe(userId: string, input: UpdateProfileDto) {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUniqueOrThrow({
        where: { id: userId },
        select: { role: true },
      });
      this.assertCompatibleFields(user.role, input);

      const commonData: Prisma.UserUpdateInput = {};
      if (input.firstName !== undefined) commonData.firstName = input.firstName;
      if (input.lastName !== undefined) commonData.lastName = input.lastName;
      if (input.phone !== undefined) commonData.phone = input.phone;
      if (input.contactMethod !== undefined) {
        commonData.contactMethod = input.contactMethod;
      }
      if (Object.keys(commonData).length) {
        await transaction.user.update({
          where: { id: userId },
          data: commonData,
        });
      }

      if (user.role === UserRole.TENANT) {
        const tenantData: Prisma.TenantProfileUpdateInput = {};
        if (input.institution !== undefined) {
          tenantData.institution = input.institution;
        }
        if (input.expectedMoveIn !== undefined) {
          tenantData.expectedMoveIn = input.expectedMoveIn
            ? new Date(`${input.expectedMoveIn}T00:00:00.000Z`)
            : null;
        }
        if (Object.keys(tenantData).length) {
          await transaction.tenantProfile.update({
            where: { userId },
            data: tenantData,
          });
        }
      }

      if (user.role === UserRole.LANDLORD) {
        const landlordData: Prisma.LandlordProfileUpdateInput = {};
        if (input.organisation !== undefined) {
          landlordData.organisation = input.organisation;
        }
        if (input.propertyCount !== undefined) {
          landlordData.propertyCount = input.propertyCount;
        }
        if (Object.keys(landlordData).length) {
          await transaction.landlordProfile.update({
            where: { userId },
            data: landlordData,
          });
        }
      }

      const updated = await this.loadProfile(transaction, userId);
      return this.toProfileResponse(updated);
    });
  }

  private loadProfile(client: ProfileClient, userId: string) {
    return client.user.findUniqueOrThrow({
      where: { id: userId },
      select: profileSelect,
    });
  }

  private assertCompatibleFields(
    role: UserRole,
    input: UpdateProfileDto,
  ): void {
    if (
      role !== UserRole.TENANT &&
      (input.institution !== undefined || input.expectedMoveIn !== undefined)
    ) {
      throw new BadRequestException(
        'Tenant profile fields are not available for this account role',
      );
    }
    if (
      role !== UserRole.LANDLORD &&
      (input.organisation !== undefined || input.propertyCount !== undefined)
    ) {
      throw new BadRequestException(
        'Landlord profile fields are not available for this account role',
      );
    }
  }

  private toProfileResponse(user: ProfileRecord) {
    const common = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      contactMethod: user.contactMethod,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    if (user.role === UserRole.TENANT) {
      return {
        ...common,
        verificationStatus: this.verificationStatus(
          user,
          VerificationType.STUDENT,
        ),
        tenantProfile: user.tenantProfile,
      };
    }
    if (user.role === UserRole.LANDLORD) {
      return {
        ...common,
        verificationStatus: this.verificationStatus(
          user,
          VerificationType.LANDLORD,
        ),
        landlordProfile: user.landlordProfile,
      };
    }
    return common;
  }

  private verificationStatus(
    user: ProfileRecord,
    type: VerificationType,
  ): VerificationStatus | 'NOT_SUBMITTED' {
    return (
      user.verifications.find((verification) => verification.type === type)
        ?.status ?? 'NOT_SUBMITTED'
    );
  }
}
