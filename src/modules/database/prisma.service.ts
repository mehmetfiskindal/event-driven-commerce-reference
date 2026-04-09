import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { AppEnvironment } from '../../shared/config/environment.schema';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(configService: ConfigService<AppEnvironment, true>) {
    super({
      datasources: {
        db: {
          url: configService.get('DATABASE_URL', { infer: true }),
        },
      },
    });
  }
}
