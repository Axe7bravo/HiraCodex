import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AccommodationRequestsService } from './accommodation-requests.service';
import { CreateAccommodationRequestDto } from './dto/create-accommodation-request.dto';

@Controller()
@UseGuards(SessionAuthGuard, RolesGuard)
export class AccommodationRequestsController {
  constructor(private readonly requests: AccommodationRequestsService) {}

  @Post('properties/:propertyId/requests')
  @Roles(UserRole.TENANT)
  create(
    @Param('propertyId') propertyId: string,
    @Body() input: CreateAccommodationRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requests.create(request.user.id, propertyId, input);
  }

  @Get('requests')
  @Roles(UserRole.TENANT, UserRole.LANDLORD)
  list(@Req() request: AuthenticatedRequest) {
    return request.user.role === UserRole.TENANT
      ? this.requests.listForTenant(request.user.id)
      : this.requests.listForLandlord(request.user.id);
  }

  @Patch('requests/:id/accept')
  @Roles(UserRole.LANDLORD)
  accept(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.requests.decide(request.user.id, id, 'ACCEPTED');
  }

  @Patch('requests/:id/decline')
  @Roles(UserRole.LANDLORD)
  decline(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.requests.decide(request.user.id, id, 'DECLINED');
  }

  @Patch('requests/:id/cancel')
  @Roles(UserRole.TENANT)
  cancel(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.requests.cancel(request.user.id, id);
  }
}
