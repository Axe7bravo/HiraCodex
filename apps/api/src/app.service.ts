import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', api: 'running', database: 'reachable' } as const;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        api: 'running',
        database: 'unreachable',
      });
    }
  }
}
