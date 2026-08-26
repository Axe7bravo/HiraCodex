import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PropertyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

const manageableStatuses: PropertyStatus[] = [
  PropertyStatus.DRAFT,
  PropertyStatus.PAUSED,
];
type CreatePropertyData = Omit<
  Prisma.PropertyUncheckedCreateInput,
  'landlordId' | 'status'
>;

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  mine(landlordId: string) {
    return this.prisma.property.findMany({
      where: { landlordId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  }

  create(landlordId: string, input: CreatePropertyDto) {
    return this.prisma.property.create({
      data: {
        landlordId,
        ...this.propertyData(input),
        status: PropertyStatus.DRAFT,
      },
    });
  }

  async update(id: string, landlordId: string, input: UpdatePropertyDto) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one property field is required');
    }
    await this.requireManageableProperty(id, landlordId);
    return this.prisma.property.update({
      where: { id },
      data: this.propertyData(input),
    });
  }

  async remove(id: string, landlordId: string): Promise<void> {
    await this.requireManageableProperty(id, landlordId);
    try {
      await this.prisma.property.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Properties with inquiry or accommodation request history cannot be deleted',
        );
      }
      throw error;
    }
  }

  private async requireManageableProperty(id: string, landlordId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, landlordId },
      select: { id: true, status: true },
    });
    if (!property) throw new NotFoundException('Property not found');
    if (!manageableStatuses.includes(property.status)) {
      throw new ConflictException(
        'Only draft or paused properties can be managed in this milestone',
      );
    }
    return property;
  }

  private propertyData(input: CreatePropertyDto): CreatePropertyData;
  private propertyData(
    input: UpdatePropertyDto,
  ): Prisma.PropertyUncheckedUpdateInput;
  private propertyData(
    input: CreatePropertyDto | UpdatePropertyDto,
  ): CreatePropertyData | Prisma.PropertyUncheckedUpdateInput {
    const data: Prisma.PropertyUncheckedUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.monthlyPrice !== undefined) {
      const price = new Prisma.Decimal(input.monthlyPrice);
      if (!price.greaterThan(0)) {
        throw new BadRequestException('monthlyPrice must be positive');
      }
      data.monthlyPrice = price;
    }
    if (input.roomType !== undefined) data.roomType = input.roomType;
    if (input.availableFrom !== undefined)
      data.availableFrom = this.calendarDate(input.availableFrom);
    if (input.amenities !== undefined)
      data.amenities = [...new Set(input.amenities)];
    if (input.area !== undefined) data.area = input.area;
    if (input.nearestInstitution !== undefined)
      data.nearestInstitution = input.nearestInstitution;
    if (input.distanceNote !== undefined)
      data.distanceNote = input.distanceNote || null;
    if (input.fullAddress !== undefined)
      data.fullAddress = input.fullAddress || null;
    if (input.latitude !== undefined)
      data.latitude = this.coordinate(input.latitude, -90, 90, 'latitude');
    if (input.longitude !== undefined)
      data.longitude = this.coordinate(input.longitude, -180, 180, 'longitude');
    if ('status' in input && input.status !== undefined)
      data.status = input.status;
    return data;
  }

  private calendarDate(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        'availableFrom must be a valid calendar date',
      );
    }
    return date;
  }

  private coordinate(
    value: string | null,
    minimum: number,
    maximum: number,
    name: string,
  ) {
    if (value === null || value === '') return null;
    const decimal = new Prisma.Decimal(value);
    if (decimal.lessThan(minimum) || decimal.greaterThan(maximum)) {
      throw new BadRequestException(`${name} is outside its valid range`);
    }
    return decimal;
  }
}
