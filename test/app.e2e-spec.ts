import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './../src/modules/health/health.controller';
import { OrderEventsPublisher } from './../src/modules/messaging/order-events.publisher';
import type { OrderCreatedEvent } from './../src/shared/events/order-created.event';
import { CreateOrderRequestDto } from './../src/modules/orders/orders.schemas';
import { OrdersController } from './../src/modules/orders/orders.controller';
import {
  type CreateOrderRecord,
  OrdersRepository,
} from './../src/modules/orders/orders.repository';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/fiecommerce';

describe('App (e2e)', () => {
  let appModuleClass: (typeof import('./../src/app.module'))['AppModule'];
  let moduleFixture: TestingModule;
  let healthController: HealthController;
  let ordersController: OrdersController;
  let createOrder: jest.Mock<Promise<void>, [CreateOrderRecord]>;
  let publish: jest.Mock<Promise<string | undefined>, [OrderCreatedEvent]>;

  beforeAll(() => {
    const appModule = jest.requireActual<typeof import('./../src/app.module')>(
      './../src/app.module',
    );

    appModuleClass = appModule.AppModule;
  });

  beforeEach(async () => {
    createOrder = jest.fn<Promise<void>, [CreateOrderRecord]>();
    publish = jest.fn<Promise<string | undefined>, [OrderCreatedEvent]>();
    createOrder.mockResolvedValue(undefined);
    publish.mockResolvedValue('sns-message-1');

    moduleFixture = await Test.createTestingModule({
      imports: [appModuleClass],
    })
      .overrideProvider(OrdersRepository)
      .useValue({ createOrder })
      .overrideProvider(OrderEventsPublisher)
      .useValue({ publish })
      .compile();
    healthController = moduleFixture.get(HealthController);
    ordersController = moduleFixture.get(OrdersController);
  });

  it('/health (GET)', () => {
    expect(healthController.getHealth()).toEqual({ status: 'ok' });
  });

  it('/orders (POST) creates an order and publishes OrderCreated', async () => {
    const response = await ordersController.createOrder(
      CreateOrderRequestDto.create({
        userId: 'u-1001',
        items: [
          { productId: 'p-10', quantity: 2, unitPrice: 120 },
          { productId: 'p-11', quantity: 1, unitPrice: 80 },
        ],
        currency: 'TRY',
      }),
      {
        'x-request-id': 'req-e2e',
        'x-correlation-id': 'corr-e2e',
      },
    );

    expect(response.success).toBe(true);
    expect(response.orderId).toMatch(/^ord-/);
    expect(response.status).toBe('CREATED');

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('/orders (POST) rejects invalid input', () => {
    expect(() =>
      CreateOrderRequestDto.create({
        userId: 'u-1001',
        items: [],
        currency: 'TRY',
      }),
    ).toThrow();

    expect(createOrder).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  afterEach(async () => {
    if (moduleFixture) {
      await moduleFixture.close();
    }
  });
});
