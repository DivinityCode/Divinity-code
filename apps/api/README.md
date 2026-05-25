# API App
Owner: Control Plane

Control-plane endpoints for task creation, run retrieval, preflight checks, approvals, approval comments, approval revisions, step execution locks, verification, goal records, budget incidents, agent activity, run heartbeats, connector references, artifacts, capabilities, LLM provider and toolset catalogs, observability, and audit export.

## Authentication
Control-plane routes are public in local development when no API key is configured.
Set `DIVINITY_API_KEY` or comma-separated `DIVINITY_API_KEYS` to require `Authorization: Bearer <key>` on all API routes except `GET /health` and CORS `OPTIONS` preflight requests.

## Current Endpoints
- `GET /health`
- `GET /capabilities`
- `GET /providers`
- `GET /toolsets`
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
- `POST /runs/:id/goals/:goal_id/complete`
- `POST /runs/:id/execution-locks/recover`
- `POST /runs/:id/heartbeat`
- `GET /runs/:id/approval`
- `POST /runs/:id/approval`
- `GET /runs/:id/approval/comments`
- `POST /runs/:id/approval/comments`
- `POST /runs/:id/approval/revision`
- `POST /runs/:id/approval/resubmit`

Task creation normalizes missing scope to `default-org/default-project`; callers can pass `scope.org_id` and `scope.project_id` to associate a run with an org and project.
Task creation converts submitted `success_criteria` into durable run `goals` records with initial status, evidence references, and budget estimate allocation.
Goal completion requires a passed verification record from the same run; `POST /runs/:id/goals/:goal_id/complete` appends completion evidence, emits `goal_completed`, and writes a `goal_record` audit entry.
Task creation includes deterministic planner, executor, and verifier activity records with actor, reason, evidence references, and budget estimates.
Task creation and step gates add budget incident records when estimated cost exceeds soft or hard caps; these records are included on run payloads and audit exports.
Step execution requires a pending step whose pre-execution check is allowed; execution lock, execution, and verifier records are written back to the run, event timeline, and audit export.
Failed allowed steps can be retried with `{ "retry": true }` until the bounded execution attempt limit is reached; retry execution records include `attempt`, `max_attempts`, and `retry_of`.
Execution lock conflicts return `409` with the active lock payload so clients can avoid overlapping run execution.
Execution lock recovery marks expired active locks as `stale`, clears `active_execution_lock`, and records recovery event/audit evidence.
Run heartbeat posts append liveness records, update `last_heartbeat_at`, emit `heartbeat_recorded` events, and add `heartbeat_record` audit entries.
Connector reference posts attach ticket, docs, or CI context to a run, emit `connector_reference_attached` events, and add `connector_reference` audit entries.
Approval snapshot reads return approval-required state, the approval decision when present, the latest approval revision when present, approval comments, and the current run payload without mutating state.
Approval comment posts attach review notes to a run, emit `approval_comment_added` events, and add `approval_comment` audit entries without changing approve/reject state.
Approval revision posts move an `awaiting_approval` run to `paused`, emit `approval_revision_requested` and `status_changed` events, and add `approval_revision` audit entries. Approval resubmission moves a paused revision-requested run back to `awaiting_approval`, emits `approval_resubmitted` and `status_changed` events, and updates the same revision record.
Capabilities expose the current policy presets, constrained execution adapters, runner isolation profiles, connector adapters, LLM providers, toolsets, and starter recipe summaries for CLI/API/dashboard discovery.
Provider and toolset routes expose public catalog metadata only. They do not call live LLM providers, store credentials, or return secret values.
Observability summaries aggregate run counts, approval backlog, heartbeat liveness, estimated budget usage, org/project scope rollups, risk mix, and policy/budget/execution failure categories.
