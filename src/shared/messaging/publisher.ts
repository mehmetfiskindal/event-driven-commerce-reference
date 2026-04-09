import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns';
import type { AppLogger } from '../logger/logger';
import type { DomainEvent } from '../events/event-envelope';

type PublishEventOptions<TPayload> = {
  client: SNSClient;
  topicArn: string;
  event: DomainEvent<TPayload>;
  logger?: AppLogger;
};

export async function publishEvent<TPayload>({
  client,
  topicArn,
  event,
  logger,
}: PublishEventOptions<TPayload>): Promise<string | undefined> {
  const response = await client.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(event),
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: event.eventType,
        },
        correlationId: {
          DataType: 'String',
          StringValue: event.metadata.correlationId,
        },
      },
    }),
  );

  logger?.info('Published domain event.', {
    eventId: event.metadata.eventId,
    eventType: event.eventType,
    correlationId: event.metadata.correlationId,
    topicArn,
    messageId: response.MessageId,
  });

  return response.MessageId;
}

