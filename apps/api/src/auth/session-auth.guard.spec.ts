import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_COOKIE_NAME } from './auth.constants';
import { SessionAuthGuard } from './session-auth.guard';

describe('SessionAuthGuard', () => {
  const jwt = { verifyAsync: jest.fn() };
  const prisma = { user: { findUnique: jest.fn() } };
  const guard = new SessionAuthGuard(
    jwt as unknown as JwtService,
    prisma as unknown as PrismaService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects a missing session cookie', async () => {
    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired JWT', async () => {
    jwt.verifyAsync.mockRejectedValueOnce(new Error('invalid token'));

    await expect(
      guard.canActivate(contextFor('bad-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a session whose user no longer exists', async () => {
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'missing-user' });
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      guard.canActivate(contextFor('valid-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a suspended user', async () => {
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'suspended-user' });
    prisma.user.findUnique.mockResolvedValueOnce(user(UserStatus.SUSPENDED));

    await expect(
      guard.canActivate(contextFor('valid-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows unexpected database errors to propagate', async () => {
    const databaseError = new Error('database unavailable');
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'user-id' });
    prisma.user.findUnique.mockRejectedValueOnce(databaseError);

    await expect(guard.canActivate(contextFor('valid-token'))).rejects.toBe(
      databaseError,
    );
  });
});

function contextFor(token?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        cookies: token ? { [SESSION_COOKIE_NAME]: token } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

function user(status: UserStatus) {
  return {
    id: 'user-id',
    email: 'user@example.com',
    firstName: 'Hira',
    lastName: 'Tester',
    role: UserRole.TENANT,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
