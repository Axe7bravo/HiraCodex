import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsDateString,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DATE_PATTERN } from './create-property.dto';
import { trimString } from './property-dto.transforms';

export class CreateInquiryDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @Transform(trimString)
  @IsString()
  @Matches(DATE_PATTERN, { message: 'moveInDate must use YYYY-MM-DD' })
  @IsDateString(
    { strict: true, strictSeparator: true },
    { message: 'moveInDate must be a valid calendar date' },
  )
  moveInDate?: string | null;
}
