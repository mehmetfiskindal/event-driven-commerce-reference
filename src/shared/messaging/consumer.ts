import {
  connect,
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
} from 'amqplib';
import { ORDER_EVENTS_EXCHANGE_TYPE } from '../constants/rabbitmq.constants';
import { DuplicateMessageError } from '../errors/duplicate-message.error';
import { NonRetryableError } from '../errors/non-retryable.error';
import type { AppLogger } from '../logger/logger';

type QueueHandler<TMessage> = (
  message: TMessage,
  rawMessage: ConsumeMessage,
) => Promise<void>;

type QueueConsumerOptions<TMessage> = {
  connectionUrl: string;
  queueName: string;
  exchangeName?: string;
  consumerName: string;
  parse: (body: string) => TMessage;
  handler: QueueHandler<TMessage>;
  logger?: AppLogger;
  prefetchCount?: number;
};

function shouldRequeue(error: unknown): boolean {
  if (
    error instanceof NonRetryableError ||
    error instanceof DuplicateMessageError
  ) {
    return false;
  }

  return true;
}

export class QueueConsumer<TMessage> {
  private readonly logger: AppLogger | undefined;
  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(private readonly options: QueueConsumerOptions<TMessage>) {
    this.logger = options.logger;
  }

  async start(): Promise<void> {
    const connection = await connect(this.options.connectionUrl);
    const channel = await connection.createChannel();

    this.connection = connection;
    this.channel = channel;

    if (this.options.prefetchCount) {
      await channel.prefetch(this.options.prefetchCount);
    }

    await channel.assertQueue(this.options.queueName, { durable: true });

    if (this.options.exchangeName) {
      await channel.assertExchange(
        this.options.exchangeName,
        ORDER_EVENTS_EXCHANGE_TYPE,
        { durable: true },
      );
      await channel.bindQueue(
        this.options.queueName,
        this.options.exchangeName,
        '',
      );
    }

    await channel.consume(this.options.queueName, (message) => {
      if (!message) {
        return;
      }

      void this.handleMessage(message, channel);
    });
  }

  async stop(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = undefined;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = undefined;
    }
  }

  private async handleMessage(
    message: ConsumeMessage,
    channel: Channel,
  ): Promise<void> {
    try {
      const parsedMessage = this.options.parse(
        message.content.toString('utf-8'),
      );

      await this.options.handler(parsedMessage, message);

      channel.ack(message);

      this.logger?.info('Consumed queue message.', {
        consumerName: this.options.consumerName,
        messageId: message.properties.messageId,
        queueName: this.options.queueName,
      });
    } catch (error) {
      channel.nack(message, false, shouldRequeue(error));

      this.logger?.error('Failed to consume queue message.', {
        consumerName: this.options.consumerName,
        messageId: message.properties.messageId,
        queueName: this.options.queueName,
        error,
      });
    }
  }
}
