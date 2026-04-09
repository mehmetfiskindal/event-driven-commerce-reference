import { z } from 'zod';
import {
  DEFAULT_AWS_REGION,
  LOCALSTACK_ACCOUNT_ID,
} from '../constants/aws.constants';
import { QUEUE_NAMES } from '../constants/queues';
import { TOPIC_NAMES } from '../constants/topics';

const nonEmptyString = z.string().trim().min(1);

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: nonEmptyString.optional(),
  AWS_REGION: nonEmptyString.default(DEFAULT_AWS_REGION),
  AWS_ENDPOINT_URL: z.string().url().default('http://localhost:4566'),
  AWS_ACCESS_KEY_ID: nonEmptyString.default('test'),
  AWS_SECRET_ACCESS_KEY: nonEmptyString.default('test'),
  SNS_ORDER_EVENTS_TOPIC_ARN: nonEmptyString.default(
    `arn:aws:sns:${DEFAULT_AWS_REGION}:${LOCALSTACK_ACCOUNT_ID}:${TOPIC_NAMES.ORDER_EVENTS}`,
  ),
  SQS_PAYMENT_QUEUE_URL: z.string().url().default(
    `http://localhost:4566/${LOCALSTACK_ACCOUNT_ID}/${QUEUE_NAMES.PAYMENT}`,
  ),
  SQS_INVENTORY_QUEUE_URL: z.string().url().default(
    `http://localhost:4566/${LOCALSTACK_ACCOUNT_ID}/${QUEUE_NAMES.INVENTORY}`,
  ),
  SQS_NOTIFICATION_QUEUE_URL: z.string().url().default(
    `http://localhost:4566/${LOCALSTACK_ACCOUNT_ID}/${QUEUE_NAMES.NOTIFICATION}`,
  ),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  rawConfig: Record<string, unknown>,
): AppEnvironment {
  return environmentSchema.parse(rawConfig);
}
