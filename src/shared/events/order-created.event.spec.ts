import { buildOrderCreatedEvent } from './order-created.event';

describe('buildOrderCreatedEvent', () => {
  it('should build a valid OrderCreated event with defaults', () => {
    const event = buildOrderCreatedEvent({
      payload: {
        orderId: 'ord-5001',
        userId: 'u-1001',
        items: [{ productId: 'p-10', quantity: 2, unitPrice: 120 }],
        totalAmount: 240,
        currency: 'TRY',
        status: 'CREATED',
      },
    });

    expect(event.eventType).toBe('OrderCreated');
    expect(event.eventVersion).toBe(1);
    expect(event.metadata.source).toBe('order-service');
    expect(event.metadata.eventId).toMatch(/^evt-/);
    expect(event.metadata.requestId).toMatch(/^req-/);
    expect(event.metadata.correlationId).toBe(event.metadata.requestId);
    expect(event.metadata.idempotencyKey).toBe(event.metadata.eventId);
  });
});
