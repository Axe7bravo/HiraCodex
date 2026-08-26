import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AdminPropertiesService } from './admin-properties.service';
import { ReviewPropertyDto } from './dto/review-property.dto';

@Controller('admin/properties')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPropertiesController {
  constructor(private readonly properties: AdminPropertiesService) {}

  @Get()
  list() {
    return this.properties.list();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.properties.getDetail(id);
  }

  @Get(':propertyId/photos/:photoId')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async photo(
    @Param('propertyId') propertyId: string,
    @Param('photoId') photoId: string,
    @Res() response: Response,
  ) {
    const photo = await this.properties.getPhoto(propertyId, photoId);
    response.type(photo.mimeType);
    response.send(photo.contents);
  }

  @Patch(':id')
  review(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() input: ReviewPropertyDto,
  ) {
    return this.properties.review(id, request.user.id, input);
  }
}
