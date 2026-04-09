# Event-Driven Commerce Reference

Portfolio-oriented demo project for an event-driven order processing backend built with NestJS, PostgreSQL, and RabbitMQ.

This repository is intentionally developed as a public showcase project, not as a production product. The goal is to demonstrate architecture thinking, backend fundamentals, async workflows, and clean documentation in a way that is useful for a CV and GitHub portfolio.

## Status

Current status:

* active demo project
* architecture and contracts are documented first
* implementation is being built incrementally
* local-first, no live deployment target

## Why This Project Exists

This repo is meant to show:

* event-driven backend design
* RabbitMQ fan-out patterns
* async order processing
* retry and DLQ thinking
* idempotent consumer design
* pragmatic API and persistence modeling

## Non-Goals

This repo is not intended to be:

* a production-ready commerce platform
* a real payment or inventory system
* a hosted SaaS product
* a security-hardened live deployment template

If you use ideas from this repo in a real product, you should review architecture, infrastructure, secrets handling, security, and operational assumptions from scratch.

## High-Level Flow

When a user creates an order:

1. API accepts `POST /orders`
2. Order data is validated and persisted
3. `OrderCreated` is published to RabbitMQ
4. RabbitMQ fans out to worker queues
5. Payment, inventory, and notification workers consume independently

```text
Client → API Gateway → Database
                    ↓
            RabbitMQ Exchange (order-events)
                    ↓
     ┌──────────────┼──────────────┐
     ↓              ↓              ↓
Payment Queue   Inventory Queue   Notification Queue
     ↓              ↓              ↓
 Payment Worker  Inventory Worker Notification Worker
```

## Tech Stack

* NestJS
* TypeScript
* Prisma
* Zod
* Swagger / OpenAPI
* PostgreSQL
* RabbitMQ
* amqplib
* Docker Compose

## Repository Docs

Project decisions are documented here:

* [Architecture](docs/arch.md)
* [Flow](docs/flow.md)
* [Event Contracts](docs/event-contracts.md)
* [Database](docs/database.md)
* [Project Plan](docs/firstplan.md)
* [Agent Guidance](AGENTS.md)

## Local Development

### Requirements

* Node.js 22+
* npm
* Docker
* Docker Compose

### Environment

Copy the example environment file if you want to run the app outside Docker:

```bash
cp .env.example .env
```

### Start With Docker

```bash
docker compose up --build
```

This starts:

* Nest app container
* PostgreSQL
* RabbitMQ

The Nest app asserts the messaging topology on publish:

* fanout exchange `order-events`
* queues `payment-queue`, `inventory-queue`, `notification-queue`

RabbitMQ management UI is available at `http://localhost:15672`.

### Start Locally Without Docker For The App

Infrastructure can run in Docker while the app runs on the host:

```bash
npm install
npm run start:dev
```

## Planned Scope

MVP:

* order create endpoint
* order persistence
* `OrderCreated` publication
* queue consumers for payment, inventory, notification

Next:

* Prisma schema and migrations
* Zod request validation
* Swagger setup
* retry and DLQ flows
* integration and e2e tests

## Demo Boundary

| This repo intentionally includes | This repo intentionally does not include |
| --- | --- |
| local-first setup with Docker + RabbitMQ | production deployment pipeline |
| documented RabbitMQ event flow | cloud hardening and runtime operations |
| simplified order, payment, inventory, notification demo flow | real payment providers or real commerce integrations |
| Prisma, Zod, Swagger, and clean backend structure | enterprise schema governance or contract registry tooling |
| basic retry, DLQ, and idempotency concepts | full replay tooling, operations dashboards, or runbooks |
| portfolio-quality documentation | product-grade security, compliance, and support guarantees |

If someone wants to turn this into a real product, they should still need to add architecture, operations, security, and platform work on top of what is shown here.

## Public Repo Notes

Because this is a public portfolio repo:

* secrets should never be committed
* demo credentials in examples are local-only and non-sensitive
* docs should stay aligned with implementation
* breaking contract changes should be explicit
* code should optimize for readability over cleverness

## Contributing

Contributions are welcome, but keep the repo scope aligned with its purpose: a clean, well-documented demo project.

Before making larger changes, read:

* [AGENTS.md](AGENTS.md)
* [CONTRIBUTING.md](CONTRIBUTING.md)

## Security

This repo is not meant for production deployment. See [SECURITY.md](SECURITY.md) for reporting guidance and scope.

## License

MIT. See [LICENSE](LICENSE).
