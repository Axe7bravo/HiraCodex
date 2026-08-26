import {
  Body,
  Controller,
  Delete,
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
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

@Controller('properties')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.LANDLORD)
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get('mine')
  mine(@Req() request: AuthenticatedRequest) {
    return this.properties.mine(request.user.id);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreatePropertyDto,
  ) {
    return this.properties.create(request.user.id, input);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() input: UpdatePropertyDto,
  ) {
    return this.properties.update(id, request.user.id, input);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.properties.remove(id, request.user.id);
  }
}
