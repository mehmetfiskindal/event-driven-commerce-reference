import { Module } from '@nestjs/common';
import { OrderEventsPublisher } from './order-events.publisher';

@Module({
  providers: [OrderEventsPublisher],
  exports: [OrderEventsPublisher],
})
export class MessagingModule {}
