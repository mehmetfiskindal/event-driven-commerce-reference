import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { HealthResponseDto, type HealthResponse } from './health.schemas';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ZodResponse({ status: HttpStatus.OK, type: HealthResponseDto })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
    };
  }
}
