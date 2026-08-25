import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, UserStatus } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  it('allows an authenticated user with an allowed role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.TENANT]);
    expect(guard.canActivate(contextFor(UserRole.TENANT))).toBe(true);
  });

  it('rejects an authenticated user with the wrong role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(contextFor(UserRole.LANDLORD))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a missing authentication context without a TypeError', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(contextFor())).toThrow(
      UnauthorizedException,
    );
  });
});

function contextFor(role?: UserRole): ExecutionContext {
  return {
    getHandler: () => rolesTestHandler,
    getClass: () => RolesTestClass,
    switchToHttp: () => ({
      getRequest: () => ({
        user: role
          ? {
              id: 'user-id',
              email: 'user@example.com',
              firstName: 'Hira',
              lastName: 'Tester',
              role,
              status: UserStatus.ACTIVE,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

function rolesTestHandler() {}
class RolesTestClass {}
