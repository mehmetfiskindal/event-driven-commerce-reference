import { ServiceUnavailableException } from '@nestjs/common';
import { OrderStatus } from '../../generated/prisma/client.js';
import type { OrderCreatedEvent } from '../../shared/events/order-created.event';
import { OrderEventsPublisher } from '../messaging/order-events.publisher';
import { type CreateOrderRecord, OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const createOrder = jest.fn<Promise<void>, [CreateOrderRecord]>();
  const publish = jest.fn<Promise<string | undefined>, [OrderCreatedEvent]>();
  const repository: Pick<OrdersRepository, 'createOrder'> = {
    createOrder,
  };
  const publisher: Pick<OrderEventsPublisher, 'publish'> = {
    publish,
  };
  const service = new OrdersService(
    repository as OrdersRepository,
    publisher as OrderEventsPublisher,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    publish.mockResolvedValue('sns-message-1');
    createOrder.mockResolvedValue(undefined);
  });

  it('creates an order, stores it, and publishes OrderCreated', async () => {
    const result = await service.createOrder(
      {
        userId: 'u-1001',
        items: [
          { productId: 'p-10', quantity: 2, unitPrice: 120 },
          { productId: 'p-11', quantity: 1, unitPrice: 80 },
        ],
        currency: 'TRY',
      },
      {
        requestId: 'req-123',
        correlationId: 'corr-456',
      },
    );

    expect(result.success).toBe(true);
    expect(result.orderId).toMatch(/^ord-/);
    expect(result.status).toBe('CREATED');
    const persistedOrder = createOrder.mock.calls[0]?.[0];
    const publishedEvent = publish.mock.calls[0]?.[0];

    expect(persistedOrder).toBeDefined();
    expect(persistedOrder?.userId).toBe('u-1001');
    expect(persistedOrder?.status).toBe(OrderStatus.CREATED);
    expect(persistedOrder?.totalAmount).toBe(320);
    expect(persistedOrder?.currency).toBe('TRY');
    expect(persistedOrder?.requestId).toBe('req-123');
    expect(persistedOrder?.correlationId).toBe('corr-456');
    expect(persistedOrder?.idempotencyKey).toMatch(/^order-created:ord-/);

    expect(publishedEvent).toBeDefined();
    expect(publishedEvent?.eventType).toBe('OrderCreated');
    expect(publishedEvent?.payload.userId).toBe('u-1001');
    expect(publishedEvent?.payload.totalAmount).toBe(320);
    expect(publishedEvent?.payload.currency).toBe('TRY');
    expect(publishedEvent?.payload.status).toBe('CREATED');
    expect(publishedEvent?.metadata.requestId).toBe('req-123');
    expect(publishedEvent?.metadata.correlationId).toBe('corr-456');
  });

  it('throws a controlled error when event publish fails', async () => {
    createOrder.mockResolvedValue(undefined);
    publish.mockRejectedValue(new Error('RabbitMQ is unavailable'));

    await expect(
      service.createOrder(
        {
          userId: 'u-1001',
          items: [{ productId: 'p-10', quantity: 2, unitPrice: 120 }],
          currency: 'TRY',
        },
        {
          requestId: 'req-123',
          correlationId: 'corr-456',
        },
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
