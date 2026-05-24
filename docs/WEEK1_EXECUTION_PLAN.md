# Week 1 Execution Plan

## Objective
Start implementation with a contract-first vertical slice that proves end-to-end task creation and run status rendering.

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
