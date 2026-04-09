# Contributing

Thanks for considering a contribution.

This repository is a public portfolio/demo project. The goal is to keep it technically credible, readable, and well-documented rather than turning it into a production-grade commerce platform.

## Before You Change Anything

Read these files first:

* [README.md](/home/mehmetfiskindal/fiecommerce/README.md)
* [AGENTS.md](/home/mehmetfiskindal/fiecommerce/AGENTS.md)
* [docs/arch.md](/home/mehmetfiskindal/fiecommerce/docs/arch.md)
* [docs/event-contracts.md](/home/mehmetfiskindal/fiecommerce/docs/event-contracts.md)
* [docs/database.md](/home/mehmetfiskindal/fiecommerce/docs/database.md)

## Contribution Principles

Please keep changes aligned with these rules:

* prefer incremental improvements
* keep architecture consistent with the documented event-driven design
* do not introduce a second ORM or validation stack without a strong reason
* preserve event naming and envelope compatibility
* optimize for clarity and portfolio quality
* avoid adding fake complexity just to look advanced

## Good Contributions

Examples of helpful contributions:

* Prisma schema and migrations
* Zod request/response schemas
* Swagger integration
* order workflow implementation
* worker implementations
* tests
* docs fixes
* Docker and local setup improvements

## Less Helpful Contributions

Examples of changes that are usually out of scope:

* replacing the stack without a clear need
* adding production infra claims the repo does not meet
* introducing major architectural changes without updating docs
* adding secrets, real credentials, or deployment-specific assumptions

## Local Workflow

```bash
npm install
npm run lint
npm test
docker compose up --build
```

If the task changes behavior or contracts, update the relevant docs in the same contribution.

