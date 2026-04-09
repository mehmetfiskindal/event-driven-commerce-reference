import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../../shared/config/environment.schema';
import type { DomainEvent } from '../../shared/events/event-envelope';
import { createLogger } from '../../shared/logger/logger';
import { publishEvent } from '../../shared/messaging/publisher';

@Injectable()
export class OrderEventsPublisher {
  private readonly logger = createLogger(OrderEventsPublisher.name);
  private readonly connectionUrl: string;
  private readonly exchangeName: string;
  private readonly queueNames: string[];

  constructor(
    private readonly configService: ConfigService<AppEnvironment, true>,
  ) {
    this.connectionUrl = configService.get('RABBITMQ_URL', {
      infer: true,
    });
    this.exchangeName = configService.get('RABBITMQ_ORDER_EVENTS_EXCHANGE', {
      infer: true,
    });
    this.queueNames = [
      configService.get('RABBITMQ_PAYMENT_QUEUE', { infer: true }),
      configService.get('RABBITMQ_INVENTORY_QUEUE', { infer: true }),
      configService.get('RABBITMQ_NOTIFICATION_QUEUE', { infer: true }),
    ];
  }

  async publish<TPayload>(
    event: DomainEvent<TPayload>,
  ): Promise<string | undefined> {
    return publishEvent({
      connectionUrl: this.connectionUrl,
      exchangeName: this.exchangeName,
      queueNames: this.queueNames,
      event,
      logger: this.logger,
    });
  }
}
