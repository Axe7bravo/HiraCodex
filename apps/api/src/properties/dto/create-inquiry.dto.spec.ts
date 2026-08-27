import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInquiryDto } from './create-inquiry.dto';

describe('CreateInquiryDto', () => {
  it('trims a message and accepts an optional calendar date', async () => {
    const dto = plainToInstance(CreateInquiryDto, {
      message: '  Is this available?  ',
      moveInDate: '2026-09-15',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.message).toBe('Is this available?');
  });

  it.each([
    { message: '   ' },
    { message: 'Hello', moveInDate: '2026-09-15T12:30:00.000Z' },
    { message: 'Hello', moveInDate: '2026-09-31' },
    { message: 'x'.repeat(2001) },
  ])('rejects invalid inquiry input %#', async (input) => {
    const errors = await validate(plainToInstance(CreateInquiryDto, input));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts null to omit the move-in date', async () => {
    await expect(
      validate(
        plainToInstance(CreateInquiryDto, {
          message: 'Hello',
          moveInDate: null,
        }),
      ),
    ).resolves.toHaveLength(0);
  });
});
