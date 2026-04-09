# AGENTS.md

## Purpose

This repository is an event-driven mini e-commerce / order processing backend demo.

Core flow:

1. Client calls `POST /orders`
2. API validates and persists the order
3. `OrderCreated` is published to RabbitMQ
4. RabbitMQ fan-out routes the event to worker queues
5. Payment, inventory, and notification workers process independently

The system is intentionally limited to demo and portfolio scope. It should optimize for clarity, learning value, readability, and incremental delivery rather than product completeness.

---

## Source Of Truth

Before changing architecture or domain behavior, read these files:

* [README.md](README.md)
* [docs/arch.md](docs/arch.md)
* [docs/flow.md](docs/flow.md)
* [docs/event-contracts.md](docs/event-contracts.md)
* [docs/database.md](docs/database.md)

If code and docs conflict, prefer keeping behavior aligned with the docs unless the user explicitly asks to evolve the design.

When in doubt, choose the simpler implementation that keeps the repo clearly in demo territory.

---

## Current State

Current codebase state:

* single NestJS app scaffold in `src/`
* documentation describes a future monorepo-style service split under `apps/`
* Prisma, Zod, Swagger, Nest config, and RabbitMQ client dependencies are installed
* the multi-service runtime is not implemented yet

Interpretation:

* do not assume the target architecture already exists in code
* when implementing, move incrementally from the current Nest scaffold toward the documented architecture
* prefer modular boundaries now, even if everything temporarily lives in one app
* do not add product-grade operational complexity unless the user explicitly asks for it

---

## Technical Direction

Use these defaults unless the user asks otherwise:

* Framework: NestJS
* Runtime language: TypeScript
* Validation: `zod` with `nestjs-zod`
* API docs: `@nestjs/swagger`
* Database: PostgreSQL first, SQLite only for fast local prototyping
* ORM: Prisma
* Messaging: RabbitMQ via AMQP
* Local infrastructure: Docker Compose with PostgreSQL and RabbitMQ

Use these as demo defaults, not as claims of production readiness.

Avoid introducing parallel stacks unless there is a clear reason.

Examples to avoid by default:

* `class-validator` / `class-transformer` DTO validation path
* TypeORM in parallel with Prisma
* Kafka or a second broker stack unless explicitly requested
* advanced platform tooling added only for appearance

---

## Domain Model

The domain currently revolves around these concepts:

* orders
* order items
* payments
* inventory reservations
* notification logs
* processed events for idempotency
* optional dead-letter persistence

Primary events:

* `OrderCreated`
* `PaymentCompleted`
* `PaymentFailed`
* `InventoryReserved`
* `InventoryFailed`
* `NotificationSent`
* `NotificationFailed`

All events should follow the documented envelope with:

* `eventType`
* `eventVersion`
* `payload`
* `metadata.eventId`
* `metadata.requestId`
* `metadata.correlationId`
* `metadata.idempotencyKey`
* `metadata.source`
* `metadata.createdAt`

Do not invent incompatible payloads when event contracts already exist in docs.

---

## Implementation Priorities

Prefer work in this order:

1. Establish clean module boundaries in the Nest app
2. Add Prisma schema and persistence for the documented database model
3. Add request validation with Zod
4. Implement `POST /orders`
5. Publish `OrderCreated`
6. Add worker consumption paths
7. Add idempotency, retry-aware handling, and DLQ support
8. Add Swagger, tests, and demo polish

If the user asks for a large feature, implement the smallest coherent slice first.

---

## Recommended Project Layout

Near-term incremental layout:

```text
src/
  modules/
    orders/
    payments/
    inventory/
    notifications/
    messaging/
    database/
    shared/
```

Longer-term target layout from the docs:

```text
apps/
  api-gateway/
  order-service/
  payment-worker/
  inventory-worker/
  notification-worker/
  shared/
```

When creating new modules now, name them so they can later move into `apps/` or `shared/` with minimal churn.

That does not mean implementing the full split now. Prefer code organization that demonstrates intent without forcing a full microservice rewrite.

---

## Coding Rules

Follow these repo-specific rules:

* keep transport concerns thin; business rules belong in service/domain layers
* centralize event contracts and message serialization logic
* preserve correlation and idempotency metadata across boundaries
* keep consumers idempotent
* prefer explicit types over ad hoc object literals
* add only small, high-signal comments
* use ASCII unless the file already uses non-ASCII intentionally
* prefer understandable code over clever abstractions

For money values:

* use a consistent shape such as `amount` + `currency`
* do not silently mix `total` and `totalAmount` for the same contract

For statuses:

* reuse documented values like `CREATED`, `COMPLETED`, `FAILED`, `RESERVED`
* do not create near-duplicate enum values without reason

---

## Validation And API Rules

Use Zod-first validation.

Preferred pattern:

* define request and response schemas close to the feature module
* derive TypeScript types from Zod schemas
* connect Swagger intentionally rather than duplicating DTO definitions excessively

If a request shape exists in docs, keep the API aligned with it unless the user asks to revise the contract.

Do not add extra API surface just to simulate a larger product.

---

## Database Rules

When introducing Prisma:

* model the tables described in `docs/database.md`
* keep naming consistent with the documented schema
* include timestamp fields on persistent operational tables
* add uniqueness constraints required for idempotency
* avoid premature denormalization
* keep the schema minimal unless the user explicitly expands scope

Outbox-style tables are optional and should not be treated as mandatory for this demo.

---

## Messaging Rules

When implementing RabbitMQ integration:

* keep exchange and queue names centralized
* isolate connection and channel creation in a shared messaging module
* deserialize and validate every consumed message
* check `eventType` and `eventVersion` before handling
* record processed events to prevent duplicate handling

Workers should not rely on in-memory state for correctness.
Workers also should not introduce enterprise-grade orchestration or platform layers unless explicitly requested.

---

## Testing Expectations

At minimum, prefer these tests as the project grows:

* unit tests for order creation and event building
* unit tests for consumer idempotency behavior
* integration tests for DB persistence
* e2e tests for `POST /orders`

When behavior changes, update or add tests in the same task if feasible.
Favor a small, credible test suite over a large but shallow one.

---

## Commands

Useful existing commands:

* `npm run start:dev`
* `npm run build`
* `npm run lint`
* `npm test`
* `npm run test:e2e`
* `npm run prisma:generate`
* `npm run prisma:migrate:dev`
* `npm run prisma:migrate:deploy`
* `npm run prisma:studio`

Before adding new scripts, check whether an existing command can be reused.

---

## Change Strategy For Agents

When working in this repo:

* inspect docs first
* verify whether code already exists before creating new abstractions
* prefer incremental, shippable changes
* avoid large speculative refactors
* keep future monorepo separation in mind
* keep the repo obviously demo-scoped to outside contributors

If you add a new cross-cutting concept, also update the relevant doc when the contract or architecture meaningfully changes.

---

## Do Not

Do not do these by default:

* do not replace documented event names with new variants
* do not introduce a second validation or ORM stack
* do not couple workers tightly to HTTP layer concerns
* do not hide event metadata
* do not skip idempotency considerations for consumers
* do not rewrite the repo into microservices in one step unless explicitly requested
* do not add production-readiness theater such as complex platform layers with no demo value
* do not add security, compliance, or operational claims the repo does not actually meet
* do not optimize for “looks enterprise” over clarity

---

## Good First Deliverables

If no narrower instruction is given, useful next tasks are:

1. add Prisma schema from `docs/database.md`
2. bootstrap Swagger in Nest
3. add Zod-based order request validation
4. implement `POST /orders`
5. create `OrderCreated` event builder and publisher

## Explicit Non-Goals

These are outside the default scope of this repository:

* production deployment pipelines
* cloud-specific infrastructure modules
* full outbox/inbox workflows
* replay consoles and operational dashboards
* advanced observability platforms
* real payment gateway integration
* compliance or security hardening programs

If a user wants any of these, implement them only with explicit direction and without overstating repo maturity.
