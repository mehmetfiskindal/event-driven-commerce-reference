export const QUEUE_NAMES = {
  PAYMENT: 'payment-queue',
  INVENTORY: 'inventory-queue',
  NOTIFICATION: 'notification-queue',
} as const;

export const DLQ_NAMES = {
  PAYMENT: 'payment-dlq',
  INVENTORY: 'inventory-dlq',
  NOTIFICATION: 'notification-dlq',
} as const;

