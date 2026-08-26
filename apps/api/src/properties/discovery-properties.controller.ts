import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DiscoverPropertiesDto } from './dto/discover-properties.dto';
import { DiscoveryPropertiesService } from './discovery-properties.service';

@Controller('discovery/properties')
export class DiscoveryPropertiesController {
  constructor(private readonly properties: DiscoveryPropertiesService) {}

  @Get()
  list(@Query() query: DiscoverPropertiesDto) {
    return this.properties.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.properties.getDetail(id);
  }

  @Get(':propertyId/photos/:photoId')
  @Header(
    'Cache-Control',
    'public, max-age=86400, stale-while-revalidate=604800',
  )
  @Header('X-Content-Type-Options', 'nosniff')
  async photo(
    @Param('propertyId') propertyId: string,
    @Param('photoId') photoId: string,
    @Res() response: Response,
  ) {
    const photo = await this.properties.getPhoto(propertyId, photoId);
    response.type(photo.mimeType);
    response.set('Content-Length', String(photo.contents.length));
    response.send(photo.contents);
  }
}
