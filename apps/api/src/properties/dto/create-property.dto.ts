import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString, trimStringArray } from './property-dto.transforms';

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COORDINATE_PATTERN = /^-?\d{1,3}(?:\.\d{1,6})?$/;

export class CreatePropertyDto {
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description!: string;

  @Transform(trimString)
  @IsString()
  @Matches(MONEY_PATTERN, {
    message:
      'monthlyPrice must be a positive amount with at most two decimal places',
  })
  monthlyPrice!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  roomType!: string;

  @Transform(trimString)
  @IsString()
  @Matches(DATE_PATTERN, { message: 'availableFrom must use YYYY-MM-DD' })
  availableFrom!: string;

  @Transform(trimStringArray)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  amenities!: string[];

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  area!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nearestInstitution!: string;

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
}

export { COORDINATE_PATTERN, DATE_PATTERN, MONEY_PATTERN };
