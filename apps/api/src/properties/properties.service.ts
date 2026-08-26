import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PropertyStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PROPERTY_PHOTO_STORAGE } from './property-photo-storage';
import type { PropertyPhotoStorage } from './property-photo-storage';

export const ALLOWED_PROPERTY_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const MAX_PROPERTY_PHOTO_SIZE = 5 * 1024 * 1024;
export const MIN_PROPERTY_PHOTOS = 3;
export const MAX_PROPERTY_PHOTOS = 10;
export type PropertyPhotoUpload = Pick<
  Express.Multer.File,
  'buffer' | 'mimetype' | 'originalname' | 'size'
>;

const safePhotoSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  sortOrder: true,
  createdAt: true,
} satisfies Prisma.PropertyPhotoSelect;

const manageableStatuses: PropertyStatus[] = [
  PropertyStatus.DRAFT,
  PropertyStatus.PAUSED,
  PropertyStatus.REJECTED,
];
const landlordStatusChangeSourceStatuses: PropertyStatus[] = [
  PropertyStatus.DRAFT,
  PropertyStatus.PAUSED,
];
type CreatePropertyData = Omit<
  Prisma.PropertyUncheckedCreateInput,
  'landlordId' | 'status'
>;

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROPERTY_PHOTO_STORAGE)
    private readonly storage: PropertyPhotoStorage,
  ) {}

  mine(landlordId: string) {
    return this.prisma.property.findMany({
      where: { landlordId },
      include: {
        photos: { select: safePhotoSelect, orderBy: { sortOrder: 'asc' } },
      },
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
      include: {
        photos: { select: safePhotoSelect, orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async update(id: string, landlordId: string, input: UpdatePropertyDto) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one property field is required');
    }
    const property = await this.requireManageableProperty(id, landlordId);
    if (
      property.status === PropertyStatus.REJECTED &&
      input.status !== undefined
    ) {
      throw new ConflictException(
        'Rejected properties remain rejected until they are resubmitted',
      );
    }
    const mutationStatuses =
      input.status === undefined
        ? manageableStatuses
        : landlordStatusChangeSourceStatuses;
    const updated = await this.prisma.property.updateMany({
      where: {
        id,
        landlordId,
        status: { in: mutationStatuses },
      },
      data: this.propertyData(input),
    });
    if (updated.count !== 1) {
      await this.throwPropertyMutationFailure(this.prisma, id, landlordId);
    }
    return this.prisma.property.findUniqueOrThrow({
      where: { id },
      include: {
        photos: { select: safePhotoSelect, orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async remove(id: string, landlordId: string): Promise<void> {
    await this.requireManageableProperty(id, landlordId);
    let objectKeys: string[];
    try {
      objectKeys = await this.prisma.$transaction(
        async (transaction) => {
          const photos = await transaction.propertyPhoto.findMany({
            where: {
              propertyId: id,
              property: {
                landlordId,
                status: { in: manageableStatuses },
              },
            },
            select: { objectKey: true },
          });
          const deleted = await transaction.property.deleteMany({
            where: {
              id,
              landlordId,
              status: { in: manageableStatuses },
            },
          });
          if (deleted.count !== 1) {
            await this.throwPropertyMutationFailure(
              transaction,
              id,
              landlordId,
            );
          }
          return photos.map(({ objectKey }) => objectKey);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Properties with inquiry or accommodation request history cannot be deleted',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException('Property is no longer editable');
      }
      throw error;
    }
    await this.cleanup(objectKeys);
  }

  async addPhoto(id: string, landlordId: string, file: PropertyPhotoUpload) {
    this.validatePhoto(file);
    await this.requireManageableProperty(id, landlordId);
    const objectKey = `properties/${id}/${randomUUID()}`;
    const attemptedKeys = [objectKey];
    try {
      await this.storage.put(objectKey, file.buffer, file.mimetype);
      return await this.prisma.$transaction(
        async (transaction) => {
          const property = await transaction.property.findFirst({
            where: { id, landlordId, status: { in: manageableStatuses } },
            select: { id: true },
          });
          if (!property)
            throw new ConflictException('Property is no longer editable');
          const count = await transaction.propertyPhoto.count({
            where: { propertyId: id },
          });
          if (count >= MAX_PROPERTY_PHOTOS) {
            throw new BadRequestException(
              'A property may have at most 10 photos',
            );
          }
          return transaction.propertyPhoto.create({
            data: {
              propertyId: id,
              objectKey,
              originalName: file.originalname,
              mimeType: file.mimetype,
              sizeBytes: file.size,
              sortOrder: count,
            },
            select: safePhotoSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      await this.cleanup(attemptedKeys);
      throw error;
    }
  }

  async getPhoto(id: string, photoId: string, landlordId: string) {
    const photo = await this.prisma.propertyPhoto.findFirst({
      where: { id: photoId, propertyId: id, property: { landlordId } },
      select: { objectKey: true, mimeType: true },
    });
    if (!photo) throw new NotFoundException('Property photo not found');
    return {
      mimeType: photo.mimeType,
      contents: await this.storage.get(photo.objectKey),
    };
  }

  async deletePhoto(
    id: string,
    photoId: string,
    landlordId: string,
  ): Promise<void> {
    await this.requireManageableProperty(id, landlordId);
    let objectKey: string;
    try {
      objectKey = await this.prisma.$transaction(
        async (transaction) => {
          const photo = await transaction.propertyPhoto.findFirst({
            where: {
              id: photoId,
              propertyId: id,
              property: {
                landlordId,
                status: { in: manageableStatuses },
              },
            },
            select: { objectKey: true },
          });
          if (!photo) {
            await this.throwPropertyMutationFailure(
              transaction,
              id,
              landlordId,
            );
            throw new NotFoundException('Property photo not found');
          }
          const deleted = await transaction.propertyPhoto.deleteMany({
            where: {
              id: photoId,
              propertyId: id,
              property: {
                landlordId,
                status: { in: manageableStatuses },
              },
            },
          });
          if (deleted.count !== 1) {
            await this.throwPropertyMutationFailure(
              transaction,
              id,
              landlordId,
            );
            throw new NotFoundException('Property photo not found');
          }
          return photo.objectKey;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException('Property is no longer editable');
      }
      throw error;
    }
    await this.cleanup([objectKey]);
  }

  async submitReview(id: string, landlordId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        const property = await transaction.property.findFirst({
          where: { id, landlordId },
          select: { status: true, _count: { select: { photos: true } } },
        });
        if (!property) throw new NotFoundException('Property not found');
        if (!manageableStatuses.includes(property.status)) {
          throw new ConflictException(
            'Property has already been submitted or is not editable',
          );
        }
        if (
          property._count.photos < MIN_PROPERTY_PHOTOS ||
          property._count.photos > MAX_PROPERTY_PHOTOS
        ) {
          throw new BadRequestException(
            'A property requires between 3 and 10 photos before submission',
          );
        }
        const updated = await transaction.property.updateMany({
          where: { id, landlordId, status: { in: manageableStatuses } },
          data: {
            status: PropertyStatus.PENDING_REVIEW,
            rejectionReason: null,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'Property has already been submitted or is not editable',
          );
        }
        return transaction.property.findUniqueOrThrow({
          where: { id },
          include: {
            photos: { select: safePhotoSelect, orderBy: { sortOrder: 'asc' } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async requireManageableProperty(id: string, landlordId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, landlordId },
      select: { id: true, status: true },
    });
    if (!property) throw new NotFoundException('Property not found');
    if (!manageableStatuses.includes(property.status)) {
      throw new ConflictException(
        'Only draft, paused, or rejected properties can be managed',
      );
    }
    return property;
  }

  private async throwPropertyMutationFailure(
    client: Pick<Prisma.TransactionClient, 'property'>,
    id: string,
    landlordId: string,
  ): Promise<never> {
    const property = await client.property.findFirst({
      where: { id, landlordId },
      select: { status: true },
    });
    if (!property) throw new NotFoundException('Property not found');
    throw new ConflictException(
      'Only draft, paused, or rejected properties can be managed',
    );
  }

  private validatePhoto(file: PropertyPhotoUpload): void {
    if (!ALLOWED_PROPERTY_PHOTO_MIME_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException('Unsupported property photo type');
    }
    if (file.size > MAX_PROPERTY_PHOTO_SIZE) {
      throw new BadRequestException(
        'Property photos must not exceed 5 MB each',
      );
    }
    if (!this.hasExpectedPhotoSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'Property photo content does not match its file type',
      );
    }
  }

  private hasExpectedPhotoSignature(
    contents: Buffer,
    mimeType: string,
  ): boolean {
    if (mimeType === 'image/jpeg') {
      return (
        contents.length >= 3 &&
        contents[0] === 0xff &&
        contents[1] === 0xd8 &&
        contents[2] === 0xff
      );
    }
    if (mimeType === 'image/png') {
      return contents
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    return (
      mimeType === 'image/webp' &&
      contents.subarray(0, 4).toString('ascii') === 'RIFF' &&
      contents.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  private async cleanup(objectKeys: string[]): Promise<void> {
    await Promise.all(
      objectKeys.map(async (objectKey) => {
        try {
          await this.storage.delete(objectKey);
        } catch {
          this.logger.error('Property photo cleanup failed');
        }
      }),
    );
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
