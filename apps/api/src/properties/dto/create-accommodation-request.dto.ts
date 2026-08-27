import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { DATE_PATTERN } from './create-property.dto';
import { trimString } from './property-dto.transforms';

export class CreateAccommodationRequestDto {
  @Transform(trimString)
  @IsString()
  @Matches(DATE_PATTERN, { message: 'preferredMoveInDate must use YYYY-MM-DD' })
  @IsDateString(
    { strict: true, strictSeparator: true },
    { message: 'preferredMoveInDate must be a valid calendar date' },
  )
  preferredMoveInDate!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
