# API App
Owner: Control Plane

Control-plane endpoints for task creation, run retrieval, preflight checks, approvals, approval comments, approval revisions, step execution locks, verification, goal records, budget incidents, agent activity, run heartbeats, connector references, artifacts, capabilities, LLM provider and toolset catalogs, provider route planning, provider chat execution, observability, and audit export.

## Authentication
Control-plane routes are public in local development when no API key is configured.
Set `DIVINITY_API_KEY` or comma-separated `DIVINITY_API_KEYS` to require `Authorization: Bearer <key>` on all API routes except `GET /health` and CORS `OPTIONS` preflight requests.

## Current Endpoints
- `GET /health`
- `GET /capabilities`
- `GET /providers`
- `GET /toolsets`
- `POST /provider-proxy/route`
- `POST /provider-proxy/chat`
- `POST /provider-proxy/chat/stream`
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
- `GET /runs/:id/provider-tool-call-approvals`
- `POST /runs/:id/provider-tool-call-approvals`

Task creation normalizes missing scope to `default-org/default-project`; callers can pass `scope.org_id` and `scope.project_id` to associate a run with an org and project.
Task creation and preflight resolve optional `llm_provider` and `toolsets` input into `provider_runtime` and `toolset_resolution` metadata without calling live providers or returning secret values. Toolset resolution includes policy permission unions, risk summaries, selected JSON Schema tool definitions, provider capability checks, and operator controls for public clients and dashboards.
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
Provider and toolset routes expose public catalog metadata only. Provider metadata comes from the built-in catalog plus any reviewed `DIVINITY_PROVIDER_CATALOG_PATH` overlay. These routes do not call live LLM providers, store credentials, or return secret values.
Provider route planning accepts candidate provider ids plus optional limit state, returns `divinity.provider_proxy_route.v1`, and selects only authorized configured providers. It also applies active provider retry windows from the API-scoped provider limit ledger. It does not proxy prompts, call live LLM providers, print secrets, consume public shared keys, or rotate to bypass limits.
Provider chat execution accepts messages, provider candidates, and optional selected toolsets through `toolsets`, `enabled_toolsets`, or `disabled_toolsets`. It reuses route planning, enforces provider/tool compatibility before upstream calls, projects selected tool schemas into the transport-specific upstream `tools` field, supports `chat_completions`, `anthropic_messages`, and `codex_responses` transports, and returns `divinity.provider_proxy_chat_result.v1` without echoing prompts, request bodies, or credential values. Provider-returned tool calls are detected but not executed: the route returns HTTP `202`, result `status: "requires_action"`, redacted `tool_call_requests`, and a required `tool_call_review` operator control. Upstream `429` responses record provider retry windows in memory by default or in `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH` when configured; the ledger stores provider ids and timestamps only, and no repo-root state file is created. Missing credentials, missing required provider `tool_calls` capability, prompt-budget excess, credentialed `base_url` overrides, unsupported future transports, and live `429` responses fail closed with status and `toolset_resolution` metadata.
Provider stream execution is exposed through `POST /provider-proxy/chat/stream`. It returns `text/event-stream`, emits `provider_stream_event` records containing normalized text/tool/reasoning metadata, and ends with `provider_stream_completed` or `provider_stream_failed`. The endpoint forwards only redacted normalized events to clients; it does not stream raw provider request bodies, prompts, credentials, raw tool arguments, or Anthropic thinking/signature content.
Provider tool-call approval recording is exposed through `GET` and `POST /runs/:id/provider-tool-call-approvals`. Posted decisions become `divinity.provider_tool_call_approval.v1` records attached to the run and audit export with type `provider_tool_call_approval`. The route accepts only redacted tool-call request metadata and records approve/reject decisions; it does not execute provider-returned tools.
Observability summaries aggregate run counts, approval backlog, heartbeat liveness, estimated budget usage, org/project scope rollups, risk mix, and policy/budget/execution failure categories.
