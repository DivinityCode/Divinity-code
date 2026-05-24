# API App
Owner: Control Plane

Control-plane endpoints for task creation, run retrieval, preflight checks, approvals, step execution, verification, agent activity, artifacts, capabilities, observability, and audit export.

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
- `GET /artifacts/:artifact_id`
- `POST /runs/:id/steps`
- `POST /runs/:id/steps/:step_id/execute`
- `POST /runs/:id/approval`

Task creation normalizes missing scope to `default-org/default-project`; callers can pass `scope.org_id` and `scope.project_id` to associate a run with an org and project.
Task creation includes deterministic planner, executor, and verifier activity records with actor, reason, evidence references, and budget estimates.
Step execution requires a pending step whose pre-execution check is allowed; execution and verifier records are written back to the run, event timeline, and audit export.
Capabilities expose the current policy presets, constrained execution adapters, and starter recipe summaries for CLI/API/dashboard discovery.
Observability summaries aggregate run counts, approval backlog, estimated budget usage, risk mix, and policy/budget/execution failure categories.
