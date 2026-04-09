export interface ProcessedMessageStore {
  has(messageId: string, consumerName: string): Promise<boolean>;
  save(messageId: string, consumerName: string): Promise<void>;
}

export class InMemoryProcessedMessageStore implements ProcessedMessageStore {
  private readonly processedMessages = new Set<string>();

  has(messageId: string, consumerName: string): Promise<boolean> {
    return Promise.resolve(
      this.processedMessages.has(this.toKey(messageId, consumerName)),
    );
  }

  save(messageId: string, consumerName: string): Promise<void> {
    this.processedMessages.add(this.toKey(messageId, consumerName));

    return Promise.resolve();
  }

  private toKey(messageId: string, consumerName: string): string {
    return `${consumerName}:${messageId}`;
  }
}
