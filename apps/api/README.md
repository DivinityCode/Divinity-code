# API App
Owner: Control Plane

Control-plane endpoints for task creation, run retrieval, preflight checks, approvals, step execution locks, verification, goal records, budget incidents, agent activity, run heartbeats, connector references, artifacts, capabilities, observability, and audit export.

## Authentication
Control-plane routes are public in local development when no API key is configured.
Set `DIVINITY_API_KEY` or comma-separated `DIVINITY_API_KEYS` to require `Authorization: Bearer <key>` on all API routes except `GET /health` and CORS `OPTIONS` preflight requests.

## Current Endpoints
- `GET /health`
- `GET /capabilities`
- `GET /audit`
- `GET /observability`
- `POST /preflight`
- `POST /tasks`
- `GET /approvals`
- `GET /runs/:id`
- `GET /runs/:id/events`
- `GET /runs/:id/stream`
- `GET /runs/:id/artifacts`
- `GET /runs/:id/connectors`
- `GET /artifacts/:artifact_id`
- `POST /runs/:id/connectors`
- `POST /runs/:id/steps`
- `POST /runs/:id/steps/:step_id/execute`
- `POST /runs/:id/execution-locks/recover`
- `POST /runs/:id/heartbeat`
- `POST /runs/:id/approval`

Task creation normalizes missing scope to `default-org/default-project`; callers can pass `scope.org_id` and `scope.project_id` to associate a run with an org and project.
Task creation converts submitted `success_criteria` into durable run `goals` records with initial status, evidence references, and budget estimate allocation.
Task creation includes deterministic planner, executor, and verifier activity records with actor, reason, evidence references, and budget estimates.
Task creation and step gates add budget incident records when estimated cost exceeds soft or hard caps; these records are included on run payloads and audit exports.
Step execution requires a pending step whose pre-execution check is allowed; execution lock, execution, and verifier records are written back to the run, event timeline, and audit export.
Execution lock conflicts return `409` with the active lock payload so clients can avoid overlapping run execution.
Execution lock recovery marks expired active locks as `stale`, clears `active_execution_lock`, and records recovery event/audit evidence.
Run heartbeat posts append liveness records, update `last_heartbeat_at`, emit `heartbeat_recorded` events, and add `heartbeat_record` audit entries.
Connector reference posts attach ticket, docs, or CI context to a run, emit `connector_reference_attached` events, and add `connector_reference` audit entries.
Capabilities expose the current policy presets, constrained execution adapters, runner isolation profiles, connector adapters, and starter recipe summaries for CLI/API/dashboard discovery.
Observability summaries aggregate run counts, approval backlog, heartbeat liveness, estimated budget usage, org/project scope rollups, risk mix, and policy/budget/execution failure categories.
