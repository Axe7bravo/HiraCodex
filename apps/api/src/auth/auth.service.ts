import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  FORGOT_PASSWORD_MESSAGE,
  INVALID_RESET_TOKEN_MESSAGE,
  PASSWORD_RESET_EXPIRY_MS,
} from './auth.constants';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from './email.service';
import { safeUserSelect } from './safe-user.select';

const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  async register(input: RegisterDto) {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });

    try {
      return await this.prisma.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email,
          passwordHash,
          role: input.role,
          tenantProfile:
            input.role === UserRole.TENANT ? { create: {} } : undefined,
          landlordProfile:
            input.role === UserRole.LANDLORD ? { create: {} } : undefined,
        },
        select: safeUserSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(input.email) },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      input.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      authVersion: user.authVersion,
    });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async forgotPassword(input: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: this.normalizeEmail(input.email),
        status: UserStatus.ACTIVE,
      },
      select: { id: true, email: true },
    });

    if (user) {
      const token = randomBytes(32).toString('base64url');
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashResetToken(token),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS),
        },
      });

      try {
        await this.email.sendPasswordReset(user.email, token);
      } catch {
        this.logger.error('Password reset email delivery failed');
      }
    }

    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(input: ResetPasswordDto) {
    const now = new Date();
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashResetToken(input.token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
      throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
    }

    const passwordHash = await argon2.hash(input.newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
      }

      const updatedUser = await transaction.user.updateMany({
        where: { id: resetToken.userId, status: UserStatus.ACTIVE },
        data: {
          passwordHash,
          authVersion: { increment: 1 },
        },
      });
      if (updatedUser.count !== 1) {
        throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
      }

      await transaction.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null },
        data: { usedAt: now },
      });
    });

    return { message: 'Password reset successfully.' };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
