import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('GET /health', () => {
  const queryRaw = jest.fn();
  let controller: AppController;

  beforeEach(async () => {
    queryRaw.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
      ],
    }).compile();
    controller = module.get(AppController);
  });

  it('reports that the API and database are healthy', async () => {
    queryRaw.mockResolvedValue([{ result: 1 }]);
    await expect(controller.getHealth()).resolves.toEqual({
      status: 'ok',
      api: 'running',
      database: 'reachable',
    });
  });

  it('does not expose the database error when Prisma fails', async () => {
    queryRaw.mockRejectedValue(new Error('sensitive connection detail'));
    await expect(controller.getHealth()).rejects.toEqual(
      new ServiceUnavailableException({
        status: 'error',
        api: 'running',
        database: 'unreachable',
      }),
    );
  });
});
