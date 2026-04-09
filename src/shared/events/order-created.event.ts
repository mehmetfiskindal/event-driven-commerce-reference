import { z } from 'zod';
import {
  buildDomainEvent,
  createEventEnvelopeSchema,
  type EventMetadata,
} from './event-envelope';

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

export const orderCreatedPayloadSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().min(1),
  items: z.array(orderItemSchema).min(1),
  totalAmount: z.number().nonnegative(),
  currency: z.string().length(3),
  status: z.literal('CREATED'),
});

export const orderCreatedEventSchema = createEventEnvelopeSchema(
  orderCreatedPayloadSchema,
).extend({
  eventType: z.literal('OrderCreated'),
});

export type OrderItem = z.infer<typeof orderItemSchema>;
export type OrderCreatedPayload = z.infer<typeof orderCreatedPayloadSchema>;
export type OrderCreatedEvent = z.infer<typeof orderCreatedEventSchema>;

type BuildOrderCreatedEventOptions = {
  payload: OrderCreatedPayload;
  metadata?: Partial<EventMetadata>;
  source?: string;
};

export function buildOrderCreatedEvent({
  payload,
  metadata,
  source = 'order-service',
}: BuildOrderCreatedEventOptions): OrderCreatedEvent {
  const parsedPayload = orderCreatedPayloadSchema.parse(payload);

  return orderCreatedEventSchema.parse(
    buildDomainEvent({
      eventType: 'OrderCreated',
      source,
      payload: parsedPayload,
      metadata,
    }),
  );
}
