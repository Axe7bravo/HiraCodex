import { VerificationType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class AdminVerificationQueryDto {
  @IsOptional()
  @IsEnum(VerificationType)
  type?: VerificationType;
}
