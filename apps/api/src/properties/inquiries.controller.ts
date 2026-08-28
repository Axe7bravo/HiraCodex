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
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { UpdateInquiryStatusDto } from './dto/update-inquiry-status.dto';
import { InquiriesService } from './inquiries.service';

@Controller()
@UseGuards(SessionAuthGuard, RolesGuard)
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Post('properties/:propertyId/inquiries')
  @Roles(UserRole.TENANT)
  create(
    @Param('propertyId') propertyId: string,
    @Body() input: CreateInquiryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inquiries.create(request.user.id, propertyId, input);
  }

  @Get('inquiries')
  @Roles(UserRole.TENANT, UserRole.LANDLORD, UserRole.ADMIN)
  list(@Req() request: AuthenticatedRequest) {
    return request.user.role === UserRole.TENANT
      ? this.inquiries.listForTenant(request.user.id)
      : this.inquiries.listForLandlord(request.user.id);
  }

  @Patch('inquiries/:id/status')
  @Roles(UserRole.LANDLORD, UserRole.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() input: UpdateInquiryStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inquiries.updateStatus(request.user.id, id, input.status);
  }
}
