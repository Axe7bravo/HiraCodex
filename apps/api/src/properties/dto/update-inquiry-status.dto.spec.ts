import { InquiryStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateInquiryStatusDto } from './update-inquiry-status.dto';

describe('UpdateInquiryStatusDto', () => {
  it.each([InquiryStatus.RESPONDED, InquiryStatus.CLOSED])(
    'accepts landlord target %s',
    async (status) => {
      await expect(
        validate(plainToInstance(UpdateInquiryStatusDto, { status })),
      ).resolves.toHaveLength(0);
    },
  );

  it.each([InquiryStatus.OPEN, 'INVALID', null])(
    'rejects invalid target %s',
    async (status) => {
      const errors = await validate(
        plainToInstance(UpdateInquiryStatusDto, { status }),
      );
      expect(errors.length).toBeGreaterThan(0);
    },
  );
});
