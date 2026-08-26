import { PrismaClient, PropertyStatus, UserRole } from '@prisma/client';
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

if (!process.env.DATABASE_URL) {
  process.loadEnvFile(resolve(process.cwd(), '.env'));
}

const prisma = new PrismaClient();
const landlordId = 'dev-marketplace-landlord';
const landlordEmail = 'marketplace.landlord@dev.hira.local';

const fixtures = [
  listing(
    '01',
    'Roma Campus Garden Room',
    1250,
    'Roma',
    'National University of Lesotho',
    'Private room',
    '2026-09-01',
    ['Wi-Fi', 'Study desk', 'Parking'],
    PropertyStatus.ACTIVE,
    ['#86b8e8', '#d8aa72', '#57713c'],
  ),
  listing(
    '02',
    'Qoaling Student Cottage',
    980,
    'Qoaling',
    'Limkokwing University of Creative Technology',
    'Single room',
    '2026-08-15',
    ['Wi-Fi', 'Water included', 'Security'],
    PropertyStatus.ACTIVE,
    ['#8fc8d0', '#d98b65', '#5d7f48'],
  ),
  listing(
    '03',
    'Thetsane Shared House',
    850,
    'Thetsane',
    'Lerotholi Polytechnic',
    'Shared room',
    '2026-10-01',
    ['Wi-Fi', 'Furnished', 'Public transport'],
    PropertyStatus.ACTIVE,
    ['#b1c9ea', '#d2a25e', '#667a45'],
  ),
  listing(
    '04',
    'Maseru West Studio',
    2200,
    'Maseru West',
    'Limkokwing University of Creative Technology',
    'Studio',
    '2026-09-20',
    ['Wi-Fi', 'Kitchen', 'Security'],
    PropertyStatus.ACTIVE,
    ['#97b7df', '#c48662', '#63793c'],
  ),
  listing(
    '05',
    'Khubetsoana Quiet Room',
    1400,
    'Khubetsoana',
    'Botho University Lesotho',
    'Private room',
    '2026-11-01',
    ['Wi-Fi', 'Study desk', 'Water included'],
    PropertyStatus.ACTIVE,
    ['#80bfd2', '#e0b36c', '#527143'],
  ),
  listing(
    '06',
    'Ha Thetsane Courtyard Rooms',
    1100,
    'Ha Thetsane',
    'Lerotholi Polytechnic',
    'Single room',
    '2026-09-10',
    ['Parking', 'Security', 'Furnished'],
    PropertyStatus.ACTIVE,
    ['#9cc6ec', '#b77755', '#667e4d'],
  ),
  listing(
    '07',
    'Upper Thamae Student Flat',
    1750,
    'Upper Thamae',
    'Botho University Lesotho',
    'Apartment',
    '2026-12-01',
    ['Wi-Fi', 'Kitchen', 'Parking'],
    PropertyStatus.ACTIVE,
    ['#93b8db', '#d1a074', '#557342'],
  ),
  listing(
    '08',
    'Mabote Affordable Room',
    750,
    'Mabote',
    'Lesotho College of Education',
    'Single room',
    '2026-08-01',
    ['Water included', 'Public transport', 'Security'],
    PropertyStatus.ACTIVE,
    ['#82b5df', '#d99562', '#607e46'],
  ),
  listing(
    '09',
    'Roma Hills Draft Listing',
    1350,
    'Roma',
    'National University of Lesotho',
    'Private room',
    '2026-10-15',
    ['Wi-Fi', 'Study desk'],
    PropertyStatus.DRAFT,
    ['#9abddd', '#c99166', '#667545'],
  ),
  listing(
    '10',
    'Naleli Paused Rooms',
    1050,
    'Naleli',
    'Lesotho Agricultural College',
    'Shared room',
    '2026-09-01',
    ['Parking', 'Water included'],
    PropertyStatus.PAUSED,
    ['#91b4cf', '#d4a06f', '#5a7142'],
  ),
  listing(
    '11',
    'Moshoeshoe II Review Flat',
    1900,
    'Moshoeshoe II',
    'Botho University Lesotho',
    'Apartment',
    '2026-11-15',
    ['Wi-Fi', 'Kitchen', 'Security'],
    PropertyStatus.PENDING_REVIEW,
    ['#87b8de', '#c18460', '#61784a'],
  ),
  listing(
    '12',
    'Lithoteng Rejected Cottage',
    1200,
    'Lithoteng',
    'Lesotho College of Education',
    'Private room',
    '2026-09-30',
    ['Wi-Fi', 'Furnished'],
    PropertyStatus.REJECTED,
    ['#a0bed7', '#ce9468', '#687c4b'],
  ),
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development fixtures must not be seeded in production');
  }
  if (process.env.PROPERTY_STORAGE_DRIVER === 's3') {
    throw new Error(
      'Development fixtures require local property photo storage',
    );
  }
  validateFixtures();

  const storageRoot = resolve(
    process.env.PROPERTY_LOCAL_STORAGE_DIR ??
      resolve(process.cwd(), '.private-property-photos'),
  );
  for (const fixture of fixtures) {
    const destination = resolve(storageRoot, fixture.objectKey);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, propertyImage(...fixture.palette));
  }

  await prisma.user.upsert({
    where: { email: landlordEmail },
    update: {
      firstName: 'Mpho',
      lastName: 'Mokoena',
      role: UserRole.LANDLORD,
      status: 'ACTIVE',
    },
    create: {
      id: landlordId,
      email: landlordEmail,
      firstName: 'Mpho',
      lastName: 'Mokoena',
      passwordHash: 'development-fixture-not-for-login',
      role: UserRole.LANDLORD,
    },
  });

  const propertyIds = fixtures.map(({ id }) => id);
  await prisma.$transaction([
    prisma.auditLog.deleteMany({
      where: { targetType: 'Property', targetId: { in: propertyIds } },
    }),
    prisma.favourite.deleteMany({ where: { propertyId: { in: propertyIds } } }),
    prisma.inquiry.deleteMany({ where: { propertyId: { in: propertyIds } } }),
    prisma.accommodationRequest.deleteMany({
      where: { propertyId: { in: propertyIds } },
    }),
    prisma.property.deleteMany({ where: { id: { in: propertyIds } } }),
    prisma.property.createMany({
      data: fixtures.map((fixture) => propertyData(fixture)),
    }),
    prisma.propertyPhoto.createMany({
      data: fixtures.map((fixture, index) => ({
        id: `dev-marketplace-photo-${String(index + 1).padStart(2, '0')}`,
        propertyId: fixture.id,
        objectKey: fixture.objectKey,
        originalName: `${fixture.id}.png`,
        mimeType: 'image/png',
        sizeBytes: propertyImage(...fixture.palette).length,
        sortOrder: 0,
      })),
    }),
  ]);

  console.log(
    `Seeded ${fixtures.length} marketplace fixtures (${fixtures.filter(({ status }) => status === PropertyStatus.ACTIVE).length} ACTIVE) with local card images.`,
  );
}

function listing(
  suffix: string,
  title: string,
  monthlyPrice: number,
  area: string,
  nearestInstitution: string,
  roomType: string,
  availableFrom: string,
  amenities: string[],
  status: PropertyStatus,
  palette: readonly [string, string, string],
) {
  const id = `dev-marketplace-property-${suffix}`;
  return {
    id,
    title,
    description: `${title} offers practical student accommodation in ${area}, Maseru, with straightforward access to ${nearestInstitution}.`,
    monthlyPrice,
    roomType,
    status,
    availableFrom,
    amenities,
    country: 'Lesotho',
    city: 'Maseru',
    area,
    nearestInstitution,
    distanceNote: 'Accessible by local taxi from central Maseru.',
    rejectionReason:
      status === PropertyStatus.REJECTED
        ? 'Development fixture: listing details require correction.'
        : null,
    objectKey: `development/marketplace/${id}.png`,
    palette,
  };
}

function validateFixtures() {
  const ids = new Set(fixtures.map(({ id }) => id));
  if (
    ids.size !== fixtures.length ||
    fixtures.length < 8 ||
    fixtures.length > 12
  ) {
    throw new Error('Marketplace fixtures must contain 8–12 unique properties');
  }
  if (
    fixtures.filter(({ status }) => status === PropertyStatus.ACTIVE).length <=
    fixtures.length / 2
  ) {
    throw new Error('Most marketplace fixtures must be ACTIVE');
  }
}

function propertyData(fixture: (typeof fixtures)[number]) {
  return {
    id: fixture.id,
    landlordId,
    title: fixture.title,
    description: fixture.description,
    monthlyPrice: fixture.monthlyPrice,
    roomType: fixture.roomType,
    status: fixture.status,
    availableFrom: new Date(`${fixture.availableFrom}T00:00:00.000Z`),
    amenities: fixture.amenities,
    country: fixture.country,
    city: fixture.city,
    area: fixture.area,
    nearestInstitution: fixture.nearestInstitution,
    distanceNote: fixture.distanceNote,
    rejectionReason: fixture.rejectionReason,
  };
}

function propertyImage(sky: string, building: string, ground: string) {
  const width = 480;
  const height = 300;
  const rowSize = width * 4 + 1;
  const pixels = Buffer.alloc(rowSize * height);
  const colors = [sky, building, ground, '#f4f0df', '#26364a'].map(hex);
  for (let y = 0; y < height; y += 1) {
    const row = y * rowSize;
    pixels[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const roof = y >= 105 + Math.abs(x - 240) * 0.32 && y < 150;
      const wall = x >= 90 && x <= 390 && y >= 145 && y <= 250;
      const window =
        wall &&
        y >= 170 &&
        y <= 215 &&
        ((x >= 125 && x <= 175) || (x >= 305 && x <= 355));
      const door = wall && x >= 220 && x <= 265 && y >= 175;
      const color =
        window || door
          ? colors[4]
          : roof
            ? colors[4]
            : wall
              ? colors[1]
              : y > 235
                ? colors[2]
                : colors[0];
      const offset = row + 1 + x * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', Buffer.from([0, 0, 1, 224, 0, 0, 1, 44, 8, 6, 0, 0, 0])),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function hex(value: string) {
  return [1, 3, 5].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16),
  );
}

function pngChunk(type: string, data: Buffer) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
