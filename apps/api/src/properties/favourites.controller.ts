import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { FavouritesService } from './favourites.service';

@Controller('favourites')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.TENANT)
export class FavouritesController {
  constructor(private readonly favourites: FavouritesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.favourites.list(request.user.id);
  }

  @Post(':propertyId')
  save(
    @Param('propertyId') propertyId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.favourites.save(request.user.id, propertyId);
  }

  @Delete(':propertyId')
  @HttpCode(204)
  remove(
    @Param('propertyId') propertyId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.favourites.remove(request.user.id, propertyId);
  }
}
