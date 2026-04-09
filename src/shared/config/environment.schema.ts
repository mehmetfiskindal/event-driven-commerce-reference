import { z } from 'zod';
import { DEFAULT_RABBITMQ_URL } from '../constants/rabbitmq.constants';
import { EXCHANGE_NAMES } from '../constants/exchanges';
import { QUEUE_NAMES } from '../constants/queues';

const nonEmptyString = z.string().trim().min(1);

export const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: nonEmptyString,
  RABBITMQ_URL: nonEmptyString.default(DEFAULT_RABBITMQ_URL),
  RABBITMQ_ORDER_EVENTS_EXCHANGE: nonEmptyString.default(
    EXCHANGE_NAMES.ORDER_EVENTS,
  ),
  RABBITMQ_PAYMENT_QUEUE: nonEmptyString.default(QUEUE_NAMES.PAYMENT),
  RABBITMQ_INVENTORY_QUEUE: nonEmptyString.default(QUEUE_NAMES.INVENTORY),
  RABBITMQ_NOTIFICATION_QUEUE: nonEmptyString.default(QUEUE_NAMES.NOTIFICATION),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  rawConfig: Record<string, unknown>,
): AppEnvironment {
  return environmentSchema.parse(rawConfig);
}
