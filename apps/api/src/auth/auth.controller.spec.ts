import { Response } from 'express';
import { AuthService } from './auth.service';
import { SESSION_COOKIE_NAME } from './auth.constants';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  it('clears the session cookie without set-only maxAge', () => {
    const controller = new AuthController({} as AuthService);
    const clearCookie = jest.fn();

    controller.logout({ clearCookie } as unknown as Response);

    expect(clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  });
});
