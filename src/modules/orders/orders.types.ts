import { z } from 'zod';
import {
  createOrderRequestSchema,
  createOrderResponseSchema,
} from './orders.schemas';

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;

export type OrderRequestContext = {
  requestId: string;
  correlationId: string;
};
