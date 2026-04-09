import { z } from 'zod';
import { createPrefixedId } from '../utils/id';

export const eventMetadataSchema = z.object({
  eventId: z.string().min(1),
  requestId: z.string().min(1),
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  source: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type EventMetadata = z.infer<typeof eventMetadataSchema>;
export type DomainEvent<TPayload> = {
  eventType: string;
  eventVersion: 1;
  payload: TPayload;
  metadata: EventMetadata;
};

export function createEventEnvelopeSchema<TPayload extends z.ZodTypeAny>(
  payloadSchema: TPayload,
) {
  return z.object({
    eventType: z.string().min(1),
    eventVersion: z.literal(1),
    payload: payloadSchema,
    metadata: eventMetadataSchema,
  });
}

type BuildDomainEventOptions<TPayload> = {
  eventType: string;
  source: string;
  payload: TPayload;
  metadata?: Partial<EventMetadata>;
};

export function buildDomainEvent<TPayload>({
  eventType,
  source,
  payload,
  metadata,
}: BuildDomainEventOptions<TPayload>): DomainEvent<TPayload> {
  const eventId = metadata?.eventId ?? createPrefixedId('evt');
  const requestId = metadata?.requestId ?? createPrefixedId('req');
  const correlationId = metadata?.correlationId ?? requestId;

  return {
    eventType,
    eventVersion: 1 as const,
    payload,
    metadata: {
      eventId,
      requestId,
      correlationId,
      idempotencyKey: metadata?.idempotencyKey ?? eventId,
      source: metadata?.source ?? source,
      createdAt: metadata?.createdAt ?? new Date().toISOString(),
    },
  };
}
