import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service';
import type { CreateOrderRequest } from './orders.types';

export type CreateOrderRecord = {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  requestId: string;
  correlationId: string;
  idempotencyKey: string;
  items: CreateOrderRequest['items'];
};

function toMoneyAmount(value: number): number {
  return Number(value.toFixed(2));
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(order: CreateOrderRecord): Promise<void> {
    await this.prisma.order.create({
      data: {
        id: order.id,
        userId: order.userId,
        status: order.status,
        totalAmount: new Prisma.Decimal(order.totalAmount),
        currency: order.currency,
        requestId: order.requestId,
        correlationId: order.correlationId,
        idempotencyKey: order.idempotencyKey,
        items: {
          create: order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            lineTotal: new Prisma.Decimal(
              toMoneyAmount(item.quantity * item.unitPrice),
            ),
          })),
        },
      },
    });
  }
}
