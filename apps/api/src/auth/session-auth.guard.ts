import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_COOKIE_NAME } from './auth.constants';
import { AuthenticatedRequest } from './auth.types';
import { safeUserSelect } from './safe-user.select';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = (request as Request).cookies?.[SESSION_COOKIE_NAME] as
      string | undefined;
    if (!token) throw new UnauthorizedException();

    let payload: { sub: string; authVersion: number };
    try {
      payload = await this.jwt.verifyAsync<{
        sub: string;
        authVersion: number;
      }>(token);
    } catch {
      throw new UnauthorizedException();
    }

    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.authVersion !== 'number'
    ) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { ...safeUserSelect, authVersion: true },
    });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      user.authVersion !== payload.authVersion
    ) {
      throw new UnauthorizedException();
    }
    request.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return true;
  }
}
