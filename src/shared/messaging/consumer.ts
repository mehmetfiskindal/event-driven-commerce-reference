import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  type Message,
  type SQSClient,
} from '@aws-sdk/client-sqs';
import type { AppLogger } from '../logger/logger';

type QueueHandler<TMessage> = (
  message: TMessage,
  rawMessage: Message,
) => Promise<void>;

type QueueConsumerOptions<TMessage> = {
  client: SQSClient;
  queueUrl: string;
  consumerName: string;
  parse: (body: string) => TMessage;
  handler: QueueHandler<TMessage>;
  logger?: AppLogger;
  waitTimeSeconds?: number;
  maxNumberOfMessages?: number;
};

type SnsEnvelope = {
  Message?: string;
};

function extractMessageBody(body: string): string {
  const parsed = JSON.parse(body) as SnsEnvelope;

  if (typeof parsed?.Message === 'string') {
    return parsed.Message;
  }

  return body;
}

export class QueueConsumer<TMessage> {
  private readonly logger: AppLogger | undefined;

  constructor(private readonly options: QueueConsumerOptions<TMessage>) {
    this.logger = options.logger;
  }

  async pollOnce(): Promise<number> {
    const response = await this.options.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.options.queueUrl,
        MaxNumberOfMessages: this.options.maxNumberOfMessages ?? 1,
        WaitTimeSeconds: this.options.waitTimeSeconds ?? 10,
      }),
    );

    const messages = response.Messages ?? [];

    for (const message of messages) {
      await this.handleMessage(message);
    }

    return messages.length;
  }

  async start(signal?: AbortSignal): Promise<void> {
    while (!signal?.aborted) {
      await this.pollOnce();
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    if (!message.Body || !message.ReceiptHandle) {
      return;
    }

    try {
      const parsedMessage = this.options.parse(
        extractMessageBody(message.Body),
      );

      await this.options.handler(parsedMessage, message);

      await this.options.client.send(
        new DeleteMessageCommand({
          QueueUrl: this.options.queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );

      this.logger?.info('Consumed queue message.', {
        consumerName: this.options.consumerName,
        messageId: message.MessageId,
        queueUrl: this.options.queueUrl,
      });
    } catch (error) {
      this.logger?.error('Failed to consume queue message.', {
        consumerName: this.options.consumerName,
        messageId: message.MessageId,
        queueUrl: this.options.queueUrl,
        error,
      });
    }
  }
}
