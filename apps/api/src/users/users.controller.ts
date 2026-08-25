import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';

@Controller('users')
@UseGuards(SessionAuthGuard, RolesGuard)
export class UsersController {
  @Get('me')
  getMe(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}
