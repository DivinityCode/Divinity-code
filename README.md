# Divinity Code

Divinity Code is an AI engineering platform designed to combine best-in-class coding execution, multi-agent orchestration, and a user-friendly trust-first UX.

## Current Status
Project bootstrapping is in progress. Initial planning and architecture artifacts are available in [`docs/`](docs).

## Documents
- [Product Plan](docs/PRODUCT_PLAN.md)
- [Architecture Draft](docs/ARCHITECTURE.md)
- [MVP Backlog](docs/MVP_BACKLOG.md)
- [Competitive Repository Research](docs/REPOSITORY_RESEARCH.md)
- [Week 1 Execution Plan](docs/WEEK1_EXECUTION_PLAN.md)

## Near-Term Focus
1. Bootstrap codebase structure for CLI + Dashboard.
2. Implement task/run domain contracts.
3. Build first end-to-end runnable workflow.


## Repo Layout
- `apps/cli` - Builder Mode CLI
- `apps/api` - Control Plane API
- `apps/dashboard` - Operator Mode dashboard
- `packages/contracts` - versioned task/run/policy schemas
- `packages/policy-engine` - trust and budget gate evaluation
- `packages/events` - shared run event model


## Validation
- Run `npm install`
- Run `npm run validate:contracts` to validate schema examples and CI contract checks.
- Run `npm run test:smoke` for a local CLI+API smoke path.
- Run `npm test` for preflight engine, API, CLI, and smoke checks.
