# Divinity Code

Divinity Code is an AI engineering platform designed to combine best-in-class coding execution, multi-agent orchestration, and a user-friendly trust-first UX.

## Current Status
Bootstrap development is integrated on `main`. The repo now includes contract validation, CLI/API run flows, policy and budget gates, approval transitions, execution adapter records, isolated local and Git URL execution workspaces with cleanup, artifacts, audit export, operator dashboard surfaces, starter recipes, diagnostics, orchestration traces, memory provenance, team policy packs, constrained package-script execution, a shared capabilities catalog, and opt-in file-backed API run storage.

## Documents
- [Product Plan](docs/PRODUCT_PLAN.md)
- [Architecture Draft](docs/ARCHITECTURE.md)
- [MVP Backlog](docs/MVP_BACKLOG.md)
- [Competitive Repository Research](docs/REPOSITORY_RESEARCH.md)
- [Week 1 Execution Plan](docs/WEEK1_EXECUTION_PLAN.md)

## Implemented Surfaces
1. Builder CLI: `init`, `run`, `status`, `approve`, `capabilities`, `recipes`, and `doctor`.
2. IDE extension scaffold: task run, dashboard launch, and doctor commands delegated to the repo-local CLI.
3. Control Plane API: health, preflight, task creation, run retrieval, approvals, step gates and execution, artifacts, audit export, and live run streams.
4. Operator dashboard: run queue, approvals, run timeline, decision trace, execution evidence, artifacts, audit metadata, and API-backed live updates.


## Repo Layout
- `apps/cli` - Builder Mode CLI
- `apps/ide-extension` - Builder Mode IDE extension scaffold
- `apps/api` - Control Plane API
- `apps/dashboard` - Operator Mode dashboard
- `packages/contracts` - versioned task/run/policy/capability schemas
- `packages/capabilities` - shared policy, adapter, and recipe capability catalog
- `packages/policy-engine` - trust and budget gate evaluation
- `packages/execution` - policy-approved step execution adapters
- `packages/workspaces` - per-run local/Git URL workspaces and cleanup for execution
- `packages/run-store` - in-memory and file-backed API run state snapshots
- `packages/events` - shared run event model
- `packages/artifacts` - patch/log/summary artifact payloads
- `packages/audit` - hash-backed audit records and exports
- `packages/recipes` - guided starter recipes
- `packages/orchestration` - planner/executor/verifier traces
- `packages/memory` - session/project/team memory entries with provenance
- `packages/policy-packs` - org-scoped team policy pack metadata
- `packages/observability` - run health, budget, and failure taxonomy summaries
- `tests` - repository test suite and validation entrypoints


## Validation
- Run `npm install`
- Run `npm run validate:contracts` to validate schema examples and CI contract checks.
- Run `npm run test:smoke` for a local CLI+API smoke path.
- Run `npm test` for preflight engine, approval API, execution adapters, run events, artifacts, audit export, CLI, and smoke checks.
