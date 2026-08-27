import { InquiryStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export type LandlordInquiryTargetStatus = Extract<
  InquiryStatus,
  'RESPONDED' | 'CLOSED'
>;

export class UpdateInquiryStatusDto {
  @IsIn([InquiryStatus.RESPONDED, InquiryStatus.CLOSED])
  status!: LandlordInquiryTargetStatus;
}
