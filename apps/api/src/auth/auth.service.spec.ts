import { ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma, UserRole } from '@prisma/client';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { EmailService } from './email.service';

jest.mock('argon2', () => ({
  argon2id: 2,
  hash: jest.fn().mockResolvedValue('test-password-hash'),
}));

describe('Registration welcome email', () => {
  const create = jest.fn();
  const sendWelcome = jest.fn();
  let service: AuthService;

  beforeEach(async () => {
    create.mockReset();
    sendWelcome.mockReset().mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: { user: { create } } },
        { provide: JwtService, useValue: {} },
        { provide: EmailService, useValue: { sendWelcome } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([UserRole.TENANT, UserRole.LANDLORD])(
    'sends one welcome only after the %s user/profile write resolves',
    async (role) => {
      const user = { id: 'user-1', email: 'user@example.com', role };
      let commit: (value: typeof user) => void = () => undefined;
      let reportStarted: () => void = () => undefined;
      const persisted = new Promise<typeof user>((resolve) => {
        commit = resolve;
      });
      const started = new Promise<void>((resolve) => {
        reportStarted = resolve;
      });
      create.mockImplementationOnce(() => {
        reportStarted();
        return persisted;
      });
      const registration = service.register(input(role));
      try {
        await started;
        expect(sendWelcome).not.toHaveBeenCalled();
        expect(create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({
            role,
            tenantProfile: role === UserRole.TENANT ? { create: {} } : undefined,
            landlordProfile: role === UserRole.LANDLORD ? { create: {} } : undefined,
          }),
        }));
      } finally {
        commit(user);
        await registration;
      }
      await expect(registration).resolves.toEqual(user);
      expect(create).toHaveBeenCalledTimes(1);
      expect(sendWelcome).toHaveBeenCalledTimes(1);
      expect(sendWelcome).toHaveBeenCalledWith(user.email, role);
    },
  );

  it('returns the created user even when welcome delivery fails', async () => {
    const user = { id: 'user-1', email: 'user@example.com', role: UserRole.TENANT };
    create.mockResolvedValue(user);
    sendWelcome.mockRejectedValue(new Error('Provider unavailable'));
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await expect(service.register(input(UserRole.TENANT))).resolves.toEqual(user);
    expect(create).toHaveBeenCalledTimes(1);
    expect(sendWelcome).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith('Welcome email delivery failed');
  });

  it('does not send when the nested database write fails', async () => {
    const failure = new Error('Profile creation failed');
    create.mockRejectedValue(failure);
    await expect(service.register(input(UserRole.LANDLORD))).rejects.toBe(failure);
    expect(sendWelcome).not.toHaveBeenCalled();
  });

  it('preserves duplicate-email conflicts without sending a welcome', async () => {
    create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002', clientVersion: '6.19.1',
    }));
    await expect(service.register(input(UserRole.TENANT))).rejects.toBeInstanceOf(ConflictException);
    expect(sendWelcome).not.toHaveBeenCalled();
  });

  it('still rejects ADMIN in the public registration DTO', async () => {
    const dto = Object.assign(new RegisterDto(), input(UserRole.ADMIN));
    const errors = await validate(dto);
    expect(errors.map(({ property }) => property)).toContain('role');
    expect(create).not.toHaveBeenCalled();
    expect(sendWelcome).not.toHaveBeenCalled();
  });

  it('does not send a public welcome for an ADMIN result', async () => {
    create.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: UserRole.ADMIN });
    await service.register(input(UserRole.ADMIN));
    expect(sendWelcome).not.toHaveBeenCalled();
  });
});

function input(role: UserRole): RegisterDto {
  return {
    firstName: 'Mpho', lastName: 'Mokoena', email: 'user@example.com',
    password: 'SecurePass123!', role,
  };
}
