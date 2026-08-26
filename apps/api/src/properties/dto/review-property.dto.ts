import { Transform } from 'class-transformer';
import { PropertyStatus } from '@prisma/client';
import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { trimString } from './property-dto.transforms';

export class ReviewPropertyDto {
  @IsIn([PropertyStatus.ACTIVE, PropertyStatus.REJECTED])
  status!: PropertyStatus;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  rejectionReason?: string;
}
