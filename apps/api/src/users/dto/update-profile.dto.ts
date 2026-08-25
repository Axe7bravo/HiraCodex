import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimOptional = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class UpdateProfileDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 80)
  @Transform(trim)
  firstName?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 80)
  @Transform(trim)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimOptional)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimOptional)
  contactMethod?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(trimOptional)
  institution?: string | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true, strictSeparator: true })
  expectedMoveIn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(trimOptional)
  organisation?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  propertyCount?: number | null;
}
