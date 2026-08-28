import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, PropertyStatus } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { publicPropertyCardSelect } from './discovery-properties.service';

const activeFavouriteWhere = (
  tenantId: string,
): Prisma.FavouriteWhereInput => ({
  tenantId,
  property: { status: PropertyStatus.ACTIVE },
});

const favouriteSelect = {
  propertyId: true,
  createdAt: true,
  property: { select: publicPropertyCardSelect },
} satisfies Prisma.FavouriteSelect;

@Injectable()
export class FavouritesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  list(tenantId: string) {
    return this.prisma.favourite.findMany({
      where: activeFavouriteWhere(tenantId),
      select: favouriteSelect,
      orderBy: [{ createdAt: 'desc' }, { propertyId: 'asc' }],
    });
  }

  async save(tenantId: string, propertyId: string) {
    const inserted = await this.prisma.$executeRaw`
      INSERT INTO "Favourite" ("tenantId", "propertyId", "createdAt")
      SELECT ${tenantId}, "id", NOW()
      FROM "Property"
      WHERE "id" = ${propertyId} AND "status" = 'ACTIVE'
      ON CONFLICT ("tenantId", "propertyId") DO NOTHING
    `;

    const favourite = await this.prisma.favourite.findFirst({
      where: { ...activeFavouriteWhere(tenantId), propertyId },
      select: favouriteSelect,
    });
    if (!favourite) throw new NotFoundException('Property not found');
    if (inserted > 0) {
      this.analytics?.capture('favourite_added', tenantId, {
        userId: tenantId,
        propertyId,
      });
    }
    return favourite;
  }

  async remove(tenantId: string, propertyId: string): Promise<void> {
    const deleted = await this.prisma.favourite.deleteMany({
      where: { tenantId, propertyId },
    });
    if (deleted.count > 0) {
      this.analytics?.capture('favourite_removed', tenantId, {
        userId: tenantId,
        propertyId,
      });
    }
  }
}
