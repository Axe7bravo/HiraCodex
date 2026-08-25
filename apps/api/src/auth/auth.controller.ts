import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.login(input);
    response.cookie(SESSION_COOKIE_NAME, token, this.sessionCookieOptions());
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, this.cookieAttributes());
  }

  private cookieAttributes(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
  }

  private sessionCookieOptions(): CookieOptions {
    return {
      ...this.cookieAttributes(),
      maxAge: SESSION_MAX_AGE_MS,
    };
  }
}
