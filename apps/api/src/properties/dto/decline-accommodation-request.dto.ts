import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimString } from './property-dto.transforms';

export class DeclineAccommodationRequestDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
