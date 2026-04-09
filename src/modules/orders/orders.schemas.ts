import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { orderItemSchema } from '../../shared/events/order-created.event';

export const createOrderRequestSchema = z
  .object({
    userId: z.string().trim().min(1),
    items: z.array(orderItemSchema).min(1),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/),
  })
  .meta({ id: 'CreateOrderRequest' });

export const createOrderResponseSchema = z
  .object({
    success: z.literal(true),
    orderId: z.string().min(1),
    status: z.literal('CREATED'),
  })
  .meta({ id: 'CreateOrderResponse' });

export class CreateOrderRequestDto extends createZodDto(
  createOrderRequestSchema,
) {}

export class CreateOrderResponseDto extends createZodDto(
  createOrderResponseSchema,
) {}
