import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeclineAccommodationRequestDto } from './decline-accommodation-request.dto';

describe('DeclineAccommodationRequestDto', () => {
  it.each([{}, { reason: '   ' }, { reason: 'x'.repeat(501) }])(
    'rejects an invalid reason %#',
    async (input) => {
      expect(
        await validate(plainToInstance(DeclineAccommodationRequestDto, input)),
      ).not.toHaveLength(0);
    },
  );

  it('trims and accepts a concise reason', async () => {
    const input = plainToInstance(DeclineAccommodationRequestDto, {
      reason: '  The room is no longer available.  ',
    });
    expect(await validate(input)).toHaveLength(0);
    expect(input.reason).toBe('The room is no longer available.');
  });
});
