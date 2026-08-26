import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PropertyStatus,
  VerificationStatus,
  VerificationType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DiscoverPropertiesDto,
  type DiscoverySort,
} from './dto/discover-properties.dto';
import { PROPERTY_PHOTO_STORAGE } from './property-photo-storage';
import type { PropertyPhotoStorage } from './property-photo-storage';

export const publicPropertyCardSelect = {
  id: true,
  title: true,
  monthlyPrice: true,
  roomType: true,
  availableFrom: true,
  amenities: true,
  country: true,
  city: true,
  area: true,
  nearestInstitution: true,
  distanceNote: true,
  createdAt: true,
  photos: {
    select: { id: true, mimeType: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
    take: 1,
  },
} satisfies Prisma.PropertySelect;

const publicPropertyDetailSelect = {
  id: true,
  title: true,
  description: true,
  monthlyPrice: true,
  roomType: true,
  availableFrom: true,
  amenities: true,
  country: true,
  city: true,
  area: true,
  nearestInstitution: true,
  distanceNote: true,
  createdAt: true,
  updatedAt: true,
  photos: {
    select: { id: true, mimeType: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  landlord: {
    select: {
      firstName: true,
      lastName: true,
      landlordProfile: { select: { organisation: true } },
      verifications: {
        where: {
          type: VerificationType.LANDLORD,
          status: VerificationStatus.APPROVED,
        },
        select: { id: true },
        take: 1,
      },
    },
  },
} satisfies Prisma.PropertySelect;

@Injectable()
export class DiscoveryPropertiesService {
  private readonly logger = new Logger(DiscoveryPropertiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROPERTY_PHOTO_STORAGE)
    private readonly storage: PropertyPhotoStorage,
  ) {}

  async list(query: DiscoverPropertiesDto) {
    const where = this.filters(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        select: publicPropertyCardSelect,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async getDetail(id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, status: PropertyStatus.ACTIVE },
      select: publicPropertyDetailSelect,
    });
    if (!property) throw new NotFoundException('Property not found');

    const { landlord, ...detail } = property;
    return {
      ...detail,
      landlord: {
        firstName: landlord.firstName,
        lastName: landlord.lastName,
        organisation: landlord.landlordProfile?.organisation ?? null,
        verified: landlord.verifications.length > 0,
      },
    };
  }

  async getPhoto(propertyId: string, photoId: string) {
    const photo = await this.prisma.propertyPhoto.findFirst({
      where: {
        id: photoId,
        propertyId,
        property: { status: PropertyStatus.ACTIVE },
      },
      select: { objectKey: true, mimeType: true },
    });
    if (!photo) throw new NotFoundException('Property photo not found');

    try {
      return {
        mimeType: photo.mimeType,
        contents: await this.storage.get(photo.objectKey),
      };
    } catch {
      this.logger.error('Marketplace property photo retrieval failed');
      throw new InternalServerErrorException('Property photo is unavailable');
    }
  }

  private filters(query: DiscoverPropertiesDto): Prisma.PropertyWhereInput {
    const minimum = query.minPrice && new Prisma.Decimal(query.minPrice);
    const maximum = query.maxPrice && new Prisma.Decimal(query.maxPrice);
    if (minimum && !minimum.greaterThan(0)) {
      throw new BadRequestException('minPrice must be positive');
    }
    if (maximum && !maximum.greaterThan(0)) {
      throw new BadRequestException('maxPrice must be positive');
    }
    if (minimum && maximum && minimum.greaterThan(maximum)) {
      throw new BadRequestException('minPrice must not exceed maxPrice');
    }

    return {
      status: PropertyStatus.ACTIVE,
      monthlyPrice:
        minimum || maximum ? { gte: minimum, lte: maximum } : undefined,
      area: query.area
        ? { contains: query.area, mode: 'insensitive' }
        : undefined,
      nearestInstitution: query.nearestInstitution
        ? { contains: query.nearestInstitution, mode: 'insensitive' }
        : undefined,
      availableFrom: query.availableBy
        ? { lte: this.calendarDate(query.availableBy) }
        : undefined,
      roomType: query.roomType
        ? { equals: query.roomType, mode: 'insensitive' }
        : undefined,
      amenities: query.amenities?.length
        ? { hasEvery: [...new Set(query.amenities)] }
        : undefined,
    };
  }

  private orderBy(
    sort: DiscoverySort,
  ): Prisma.PropertyOrderByWithRelationInput[] {
    if (sort === 'price_asc') {
      return [{ monthlyPrice: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }];
    }
    if (sort === 'price_desc') {
      return [{ monthlyPrice: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
    }
    return [{ createdAt: 'desc' }, { id: 'desc' }];
  }

  private calendarDate(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        'availableBy must be a valid calendar date',
      );
    }
    return date;
  }
}
