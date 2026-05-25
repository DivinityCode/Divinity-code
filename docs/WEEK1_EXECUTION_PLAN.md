# Week 1 Execution Plan

## Objective
Start implementation with a contract-first vertical slice that proves end-to-end task creation and run status rendering.

## Current Bootstrap Status
The Week 1 vertical slice is implemented on `main` and has expanded beyond the original dry-run scope. Current evidence lives in:
- [Product Requirements Baseline](PRODUCT_REQUIREMENTS.md)
- [Domain Model](DOMAIN_MODEL.md)
- [UI Information Architecture](INFORMATION_ARCHITECTURE.md)
- [MVP Backlog](MVP_BACKLOG.md)
- [Architecture Draft](ARCHITECTURE.md)
- [Competitive Repository Research](REPOSITORY_RESEARCH.md)

## Track Status
| Track | Original checkpoint | Current status | Evidence |
| --- | --- | --- | --- |
| Contracts | Schema handshake with CLI/API/Dashboard teams | Implemented and extended across Task, Run, Step, Artifact, Policy, Preflight, Approval, Event, Audit, Execution, Verification, Heartbeat, Connector, Capabilities, Observability, Agent Activity, Bug Report, and related examples. | `packages/contracts/schemas`, `packages/contracts/examples`, `tests/scripts_validate_contracts.mjs` |
| CLI Bootstrap | CLI can submit a mock Task payload | Implemented Builder CLI commands for `init`, `run`, `status`, `approve`, `capabilities`, `recipes`, `doctor`, and `bug`; `run` emits structured task/run/preflight/artifact/event data. | `apps/cli/src/index.mjs`, `apps/cli/README.md`, `tests/tests_cli_*.mjs` |
| API Bootstrap | API accepts and validates Task schema | Implemented health, preflight, task creation, run retrieval/listing, approvals, steps, execution, workspaces, artifacts, connectors, heartbeats, observability, audit, and event streams. | `apps/api/src/server.mjs`, `tests/tests_api_*.mjs` |
| Dashboard Bootstrap | Dashboard displays queued/running/completed states | Implemented operator dashboard bootstrap with run queue, approval queue, approval comments, selected-run detail, evidence, artifacts, liveness, observability, connector references, execution, verification, and API-backed live updates. | `apps/dashboard`, `tests/tests_dashboard_static.mjs` |
| Policy/Cost Preflight | One approval gate path for high-risk actions | Implemented policy presets, risk classification, budget warnings/blocks, evidence refs, approval-required runs, hard-cap pause behavior, and step gates. | `packages/policy-engine`, `tests/tests_policy_*.mjs`, `tests/tests_api_preflight.mjs` |

## Tracks
### 1) Contracts (Owner: Platform)
- Day 1: Draft v1 JSON schemas for Task/Run/Step/Artifact/Policy.
- Day 2: Add valid/invalid examples and schema validation command.
- Day 3: Publish contract changelog + semantic version policy.
- Checkpoint: schema handshake with CLI/API/Dashboard teams.

### 2) CLI Bootstrap (Owner: Builder Experience)
- Day 1: Scaffold command surface: `init`, `run`, `status`, `approve`.
- Day 2: Implement local config bootstrap and dry-run mode.
- Day 3: Emit run events to stdout in structured JSON.
- Checkpoint: CLI can submit a mock Task payload.

### 3) API Bootstrap (Owner: Control Plane)
- Day 1: Create service skeleton and health endpoint.
- Day 2: Add `POST /tasks` and `GET /runs/:id` with in-memory store.
- Day 3: Add policy preflight endpoint and lifecycle state transitions.
- Checkpoint: API accepts and validates Task schema.

### 4) Dashboard Bootstrap (Owner: Operator Experience)
- Day 1: Create app shell and auth placeholder.
- Day 2: Implement task list + run detail route.
- Day 3: Render run timeline from mock event stream.
- Checkpoint: Dashboard displays queued/running/completed states.

### 5) Policy/Cost Preflight (Owner: Trust & Safety)
- Day 1: Define risk model (low/medium/high/critical).
- Day 2: Define soft/hard budget thresholds and behaviors.
- Day 3: Add preflight decision payload contract and mock evaluator.
- Checkpoint: one approval gate path for high-risk actions.

## Integration Checkpoints
1. **Schema handshake (Day 2):** all tracks consume the same v1 contracts.
2. **Event handshake (Day 3):** CLI/API/dashboard share run event envelope.
3. **Dry-run walkthrough (Day 5):** create task -> preflight -> run timeline.

## End-of-Week Success Criteria
- CLI command group exists and runs locally.
- API validates `Task` and returns `Run` with lifecycle state.
- Dashboard renders run status and timeline using mock/API data.
- Policy preflight can block or require approval for high-risk steps.

## Current Validation Gates
- `npm run validate:contracts` or cached-pnpm equivalent validates contract schemas and examples.
- `npm run test:smoke` or cached-pnpm equivalent runs the MVP demo flow plus deterministic CLI/API smoke path from temp workspaces.
- `npm test` or cached-pnpm equivalent runs policy, API, CLI, execution, workspace, observability, dashboard, IDE, contract, and smoke coverage.
- Hygiene gates before publish: conflict-marker scan, `git diff --check`, JSON parse check for manifests/contracts, and root cleanup check for stray `tests_*.mjs` or `scripts_*.mjs` files.

## Follow-On Development Path
1. Keep closing plan/documentation gaps only when they map to a concrete artifact or stale statement.
2. Prefer branch-sized feature slices with tests under `tests/`, schema examples under `packages/contracts/examples`, and documentation updates in the same PR.
3. Preserve the shared Task/Run/Preflight vocabulary across CLI, API, dashboard, IDE, and future user/contributor docs.
4. Use the research takeaways to prioritize installer/readiness UX, durable goal context, observable delegation, portable runtimes, and operator governance before broader integrations.
