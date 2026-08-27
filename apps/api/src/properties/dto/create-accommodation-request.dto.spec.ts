import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAccommodationRequestDto } from './create-accommodation-request.dto';

describe('CreateAccommodationRequestDto', () => {
  it('accepts a real calendar date and trims the note', async () => {
    const dto = plainToInstance(CreateAccommodationRequestDto, {
      preferredMoveInDate: '2026-09-15',
      note: '  Near campus please  ',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.note).toBe('Near campus please');
  });

  it.each([undefined, null, '2026-09-15T12:30:00.000Z', '2026-09-31'])(
    'rejects invalid preferredMoveInDate %s',
    async (preferredMoveInDate) => {
      const errors = await validate(
        plainToInstance(CreateAccommodationRequestDto, { preferredMoveInDate }),
      );
      expect(errors.length).toBeGreaterThan(0);
    },
  );
});
