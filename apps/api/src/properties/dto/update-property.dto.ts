import { Transform } from 'class-transformer';
import { PropertyStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  COORDINATE_PATTERN,
  DATE_PATTERN,
  MONEY_PATTERN,
} from './create-property.dto';
import { trimString, trimStringArray } from './property-dto.transforms';
import {
  PROPERTY_AMENITIES,
  PROPERTY_AREAS,
  PROPERTY_INSTITUTIONS,
  PROPERTY_ROOM_TYPES,
} from '../property-options';

export class UpdatePropertyDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @Matches(MONEY_PATTERN)
  monthlyPrice?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsIn([...PROPERTY_ROOM_TYPES])
  @MinLength(2)
  @MaxLength(80)
  roomType?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @Matches(DATE_PATTERN)
  availableFrom?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimStringArray)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @IsIn([...PROPERTY_AMENITIES], { each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  amenities?: string[];
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsIn([...PROPERTY_AREAS])
  @MinLength(2)
  @MaxLength(120)
  area?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsIn([...PROPERTY_INSTITUTIONS])
  @MinLength(2)
  @MaxLength(160)
  nearestInstitution?: string;
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(250)
  distanceNote?: string | null;
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(300)
  fullAddress?: string | null;
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(COORDINATE_PATTERN)
  latitude?: string | null;
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(COORDINATE_PATTERN)
  longitude?: string | null;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn([PropertyStatus.DRAFT, PropertyStatus.PAUSED])
  status?: PropertyStatus;
}
