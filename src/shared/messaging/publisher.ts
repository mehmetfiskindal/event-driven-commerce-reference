import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type Options,
} from 'amqplib';
import { ORDER_EVENTS_EXCHANGE_TYPE } from '../constants/rabbitmq.constants';
import type { AppLogger } from '../logger/logger';
import type { DomainEvent } from '../events/event-envelope';

type FanoutPublisherState = {
  channel?: ConfirmChannel;
  connection?: ChannelModel;
  initialization?: Promise<ConfirmChannel>;
  url?: string;
};

type PublishEventOptions<TPayload> = {
  connectionUrl: string;
  exchangeName: string;
  queueNames: string[];
  event: DomainEvent<TPayload>;
  logger?: AppLogger;
};

const publisherState: FanoutPublisherState = {};

function resetPublisherState(): void {
  publisherState.channel = undefined;
  publisherState.connection = undefined;
  publisherState.initialization = undefined;
}

async function createPublisherChannel(
  connectionUrl: string,
): Promise<ConfirmChannel> {
  const connection = await connect(connectionUrl);
  const channel = await connection.createConfirmChannel();

  publisherState.connection = connection;
  publisherState.channel = channel;
  publisherState.url = connectionUrl;

  connection.on('close', () => {
    resetPublisherState();
  });

  connection.on('error', () => {
    resetPublisherState();
  });

  return channel;
}

async function getPublisherChannel(
  connectionUrl: string,
): Promise<ConfirmChannel> {
  if (
    publisherState.channel &&
    publisherState.connection &&
    publisherState.url === connectionUrl
  ) {
    return publisherState.channel;
  }

  if (publisherState.initialization && publisherState.url === connectionUrl) {
    return publisherState.initialization;
  }

  publisherState.url = connectionUrl;
  publisherState.initialization = createPublisherChannel(connectionUrl);

  try {
    return await publisherState.initialization;
  } finally {
    publisherState.initialization = undefined;
  }
}

async function ensureFanoutTopology(
  channel: ConfirmChannel,
  exchangeName: string,
  queueNames: string[],
): Promise<void> {
  await channel.assertExchange(exchangeName, ORDER_EVENTS_EXCHANGE_TYPE, {
    durable: true,
  });

  for (const queueName of queueNames) {
    await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queueName, exchangeName, '');
  }
}

export async function publishEvent<TPayload>({
  connectionUrl,
  exchangeName,
  queueNames,
  event,
  logger,
}: PublishEventOptions<TPayload>): Promise<string | undefined> {
  const channel = await getPublisherChannel(connectionUrl);

  await ensureFanoutTopology(channel, exchangeName, queueNames);

  const messageOptions: Options.Publish = {
    persistent: true,
    contentType: 'application/json',
    contentEncoding: 'utf-8',
    messageId: event.metadata.eventId,
    type: event.eventType,
    timestamp: Date.parse(event.metadata.createdAt),
    headers: {
      correlationId: event.metadata.correlationId,
      requestId: event.metadata.requestId,
      idempotencyKey: event.metadata.idempotencyKey,
      source: event.metadata.source,
      eventVersion: event.eventVersion,
    },
  };

  const published = channel.publish(
    exchangeName,
    '',
    Buffer.from(JSON.stringify(event), 'utf-8'),
    messageOptions,
  );

  if (!published) {
    await new Promise<void>((resolve) => {
      channel.once('drain', () => {
        resolve();
      });
    });
  }

  await channel.waitForConfirms();

  logger?.info('Published domain event.', {
    eventId: event.metadata.eventId,
    eventType: event.eventType,
    correlationId: event.metadata.correlationId,
    exchangeName,
    queueNames,
    messageId: event.metadata.eventId,
  });

  return event.metadata.eventId;
}
