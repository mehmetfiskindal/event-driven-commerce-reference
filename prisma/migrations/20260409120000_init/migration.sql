-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM (
  'CREATED',
  'PENDING',
  'PAYMENT_COMPLETED',
  'PAYMENT_FAILED',
  'INVENTORY_RESERVED',
  'INVENTORY_FAILED'
);

-- CreateTable
CREATE TABLE "orders" (
  "id" VARCHAR(64) NOT NULL,
  "user_id" VARCHAR(64) NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(8) NOT NULL,
  "request_id" VARCHAR(64) NOT NULL,
  "correlation_id" VARCHAR(64) NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
  "id" BIGSERIAL NOT NULL,
  "order_id" VARCHAR(64) NOT NULL,
  "product_id" VARCHAR(64) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price" DECIMAL(12,2) NOT NULL,
  "line_total" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
  "id" BIGSERIAL NOT NULL,
  "event_id" VARCHAR(64) NOT NULL,
  "event_type" VARCHAR(64) NOT NULL,
  "consumer_name" VARCHAR(64) NOT NULL,
  "correlation_id" VARCHAR(64),
  "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "processed_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_orders_user_id" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "idx_orders_correlation_id" ON "orders"("correlation_id");

-- CreateIndex
CREATE INDEX "idx_orders_created_at" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "idx_processed_events_event_id_consumer_name" ON "processed_events"("event_id", "consumer_name");

-- CreateIndex
CREATE UNIQUE INDEX "processed_events_event_id_consumer_name_key" ON "processed_events"("event_id", "consumer_name");

-- AddForeignKey
ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
