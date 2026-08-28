import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePropertyDto } from './create-property.dto';
import { UpdatePropertyDto } from './update-property.dto';

const validProperty = {
  title: 'Roma garden room',
  description: 'A practical furnished room close to the university campus.',
  monthlyPrice: '1450.50',
  roomType: 'Private room',
  availableFrom: '2026-09-15',
  amenities: ['Wi-Fi', 'Parking'],
  area: 'Roma',
  nearestInstitution: 'National University of Lesotho',
};

const invalidOptions: Array<{ field: string; value: unknown }> = [
  { field: 'roomType', value: 'Bespoke suite' },
  { field: 'area', value: 'roma' },
  { field: 'nearestInstitution', value: 'NUL' },
  { field: 'amenities', value: ['Wi-Fi', 'Jacuzzi'] },
];

describe('controlled property options', () => {
  it('accepts canonical create and update values', async () => {
    expect(
      await validate(plainToInstance(CreatePropertyDto, validProperty)),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(UpdatePropertyDto, {
          roomType: validProperty.roomType,
          area: validProperty.area,
          nearestInstitution: validProperty.nearestInstitution,
          amenities: validProperty.amenities,
        }),
      ),
    ).toHaveLength(0);
  });

  it.each(invalidOptions)(
    'rejects unsupported $field values on create and update',
    async ({ field, value }) => {
      expect(
        await validate(
          plainToInstance(CreatePropertyDto, {
            ...validProperty,
            [field]: value,
          }),
        ),
      ).not.toHaveLength(0);
      expect(
        await validate(plainToInstance(UpdatePropertyDto, { [field]: value })),
      ).not.toHaveLength(0);
    },
  );
});
