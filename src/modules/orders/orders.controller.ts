import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import {
  getCorrelationId,
  getRequestId,
} from '../../shared/tracing/correlation';
import {
  CreateOrderRequestDto,
  CreateOrderResponseDto,
} from './orders.schemas';
import { OrdersService } from './orders.service';
import type { CreateOrderResponse } from './orders.types';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ZodResponse({ status: 201, type: CreateOrderResponseDto })
  async createOrder(
    @Body() body: CreateOrderRequestDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<CreateOrderResponse> {
    const requestId = getRequestId({ headers });
    const correlationId = getCorrelationId({ requestId, headers });

    return this.ordersService.createOrder(body, {
      requestId,
      correlationId,
    });
  }
}
