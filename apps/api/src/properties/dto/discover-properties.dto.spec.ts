import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DiscoverPropertiesDto } from './discover-properties.dto';

describe('DiscoverPropertiesDto', () => {
  it('transforms valid pagination and comma-separated amenities', async () => {
    const input = plainToInstance(DiscoverPropertiesDto, {
      page: '2',
      pageSize: '6',
      amenities: ' Wi-Fi, Parking ',
      availableBy: '2026-09-15',
    });
    expect(await validate(input)).toHaveLength(0);
    expect(input).toMatchObject({
      page: 2,
      pageSize: 6,
      amenities: ['Wi-Fi', 'Parking'],
    });
  });

  it.each([
    { minPrice: 'free' },
    { availableBy: '2026-09-15T12:00:00.000Z' },
    { sort: 'relevant' },
    { page: '0' },
    { pageSize: '25' },
  ])('rejects invalid discovery query values: %o', async (values) => {
    const input = plainToInstance(DiscoverPropertiesDto, values);
    expect(await validate(input)).not.toHaveLength(0);
  });

  it.each([
    { area: 'a'.repeat(121) },
    { nearestInstitution: 'i'.repeat(161) },
    { roomType: 'r'.repeat(81) },
    { amenities: Array.from({ length: 31 }, (_, index) => `Amenity ${index}`) },
    { amenities: 'a'.repeat(81) },
  ])('rejects oversized discovery filters: %o', async (values) => {
    const input = plainToInstance(DiscoverPropertiesDto, values);
    expect(await validate(input)).not.toHaveLength(0);
  });
});
