import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { OrderStatus } from '../../generated/prisma/client.js';
import { buildOrderCreatedEvent } from '../../shared/events/order-created.event';
import { createLogger } from '../../shared/logger/logger';
import { createPrefixedId } from '../../shared/utils/id';
import { OrderEventsPublisher } from '../messaging/order-events.publisher';
import { OrdersRepository } from './orders.repository';
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  OrderRequestContext,
} from './orders.types';

const CREATED_STATUS = 'CREATED';

function calculateTotalAmount(items: CreateOrderRequest['items']): number {
  return Number(
    items
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      .toFixed(2),
  );
}

function buildOrderCreatedIdempotencyKey(orderId: string): string {
  return `order-created:${orderId}`;
}

@Injectable()
export class OrdersService {
  private readonly logger = createLogger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly orderEventsPublisher: OrderEventsPublisher,
  ) {}

  async createOrder(
    request: CreateOrderRequest,
    context: OrderRequestContext,
  ): Promise<CreateOrderResponse> {
    const orderId = createPrefixedId('ord');
    const totalAmount = calculateTotalAmount(request.items);
    const idempotencyKey = buildOrderCreatedIdempotencyKey(orderId);

    await this.ordersRepository.createOrder({
      id: orderId,
      userId: request.userId,
      status: OrderStatus.CREATED,
      totalAmount,
      currency: request.currency,
      requestId: context.requestId,
      correlationId: context.correlationId,
      idempotencyKey,
      items: request.items,
    });

    const event = buildOrderCreatedEvent({
      payload: {
        orderId,
        userId: request.userId,
        items: request.items,
        totalAmount,
        currency: request.currency,
        status: CREATED_STATUS,
      },
      metadata: {
        requestId: context.requestId,
        correlationId: context.correlationId,
        idempotencyKey,
      },
    });

    try {
      await this.orderEventsPublisher.publish(event);
    } catch (error) {
      this.logger.error(
        'Failed to publish OrderCreated event after order persistence.',
        {
          orderId,
          requestId: context.requestId,
          correlationId: context.correlationId,
          error,
        },
      );

      throw new ServiceUnavailableException({
        message: 'Order persisted but event publication failed.',
        orderId,
      });
    }

    this.logger.info('Created order and published OrderCreated event.', {
      orderId,
      requestId: context.requestId,
      correlationId: context.correlationId,
      itemCount: request.items.length,
      totalAmount,
    });

    return {
      success: true,
      orderId,
      status: CREATED_STATUS,
    };
  }
}

export const ordersDomain = {
  calculateTotalAmount,
  buildOrderCreatedIdempotencyKey,
};
