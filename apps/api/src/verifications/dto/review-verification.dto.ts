import { Transform } from 'class-transformer';
import { VerificationStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewVerificationDto {
  @IsIn([VerificationStatus.APPROVED, VerificationStatus.REJECTED])
  status!: VerificationStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
