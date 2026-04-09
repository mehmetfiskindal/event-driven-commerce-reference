import { DuplicateMessageError } from '../errors/duplicate-message.error';
import type { ProcessedMessageStore } from './idempotency.store';

export class IdempotencyService {
  constructor(private readonly store: ProcessedMessageStore) {}

  async isAlreadyProcessed(
    messageId: string,
    consumerName: string,
  ): Promise<boolean> {
    return this.store.has(messageId, consumerName);
  }

  async markAsProcessed(
    messageId: string,
    consumerName: string,
  ): Promise<void> {
    await this.store.save(messageId, consumerName);
  }

  async assertNotProcessed(
    messageId: string,
    consumerName: string,
  ): Promise<void> {
    const alreadyProcessed = await this.isAlreadyProcessed(
      messageId,
      consumerName,
    );

    if (alreadyProcessed) {
      throw new DuplicateMessageError(
        `Message ${messageId} was already processed by ${consumerName}.`,
      );
    }
  }
}

