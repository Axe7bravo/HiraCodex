import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DATE_PATTERN, MONEY_PATTERN } from './create-property.dto';
import { trimString } from './property-dto.transforms';

export const DISCOVERY_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export type DiscoverySort = (typeof DISCOVERY_SORTS)[number];

const optionalTrimmedString = () => Transform(trimString);
const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
const toAmenities = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value
    .split(',')
    .map((amenity) => amenity.trim())
    .filter(Boolean);
};

export class DiscoverPropertiesDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(MONEY_PATTERN)
  minPrice?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(MONEY_PATTERN)
  maxPrice?: string;

  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  @MaxLength(160)
  nearestInstitution?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(DATE_PATTERN)
  availableBy?: string;

  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  @MaxLength(80)
  roomType?: string;

  @IsOptional()
  @Transform(toAmenities)
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  amenities?: string[];

  @IsOptional()
  @IsIn(DISCOVERY_SORTS)
  sort: DiscoverySort = 'newest';

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(24)
  pageSize = 12;
}
