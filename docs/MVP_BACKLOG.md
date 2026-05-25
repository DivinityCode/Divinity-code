# MVP Backlog

## Milestones
- **M1:** Contracts + CLI skeleton
- **M2:** Run lifecycle + policy checks
- **M3:** Dashboard + approvals

## Epic 1: Builder Mode Core (M1-M2)
- [x] CLI init command with project config wizard.
  - Acceptance: creates local project config with policy preset and budget defaults.
- [x] Task command (`divinity run`) accepting objective + repo context.
  - Acceptance: submits valid Task payload and returns `run_id`.
- [x] Local run timeline and structured progress events.
  - Acceptance: emits JSON event envelope with status transitions.
- [x] Patch artifact generation and summary export.
  - Acceptance: outputs artifact metadata containing patch/log/summary/PR-summary URIs.

## Epic 2: Operator Dashboard (M2-M3)
- [x] Task list with status filtering.
  - Acceptance: filter by queued/running/awaiting_approval/completed/failed.
- [x] Run detail page with step-by-step timeline.
  - Acceptance: shows ordered step list with timestamps and statuses.
- [x] Approval queue for high-risk actions.
  - Acceptance: pending approvals can be approved/rejected and state updates propagate.
- [x] Cost/risk badges at task and run level.
  - Acceptance: each run displays risk level and soft/hard budget usage.

## Epic 3: Trust & Policy (M1-M2)
- [x] Permission presets (read-only, scoped-edit, safe-exec, full-exec).
  - Acceptance: presets map to explicit permission arrays in Policy schema.
- [x] Policy engine checks before step execution.
  - Acceptance: high-risk or disallowed step is blocked pre-execution.
- [x] Budget soft/hard cap enforcement.
  - Acceptance: soft cap triggers warning; hard cap pauses run.
- [x] Preflight panel payload contract.
  - Acceptance: includes predicted actions, risk score, and estimated cost.

## Current Implementation Notes
- CLI `run` now returns `run_id`, status, task payload, and preflight decision metadata.
- CLI `run --connector adapter:resource_type:resource_id[:url]` attaches initial ticket/docs/CI context to task and run output.
- CLI `run --criteria "..."` and `run --success-criteria "..."` attach explicit success criteria to the task payload.
- CLI/API run payloads include durable goal records derived from success criteria, with evidence refs and budget allocation for each criterion.
- CLI/API can complete a goal only with passed verifier evidence from the same run through `goal-complete` and `POST /runs/:id/goals/:goal_id/complete`.
- CLI `status <run_id> --api <base-url>` fetches stored API run status while preserving the local queued placeholder without `--api`.
- CLI `approval <run_id> --api <base-url>` fetches stored approval state, comments, and run payload without mutating the run.
- CLI `approval-revision <run_id> --api <base-url>` requests changes on an approval run and moves it to `paused`; CLI `approval-resubmit <run_id> --api <base-url>` returns the run to `awaiting_approval`.
- CLI `init` supports default, flag-driven, and prompt-driven project config creation for policy preset, soft/hard budget caps, and org/project scope.
- CLI `doctor` defaults to runtime-safe setup diagnostics for installed or linked package use, while `doctor --profile source` adds source-checkout checks for installed dependencies, AJV validator dependencies, package manifest, and API server source readiness.
- CLI `bug` emits `divinity.bug_report.v1` with a GitHub-ready Markdown body, environment details, git status, and local doctor diagnostics for in-workflow issue reporting.
- CLI `capabilities` reports supported policy presets, runtime adapters, execution adapters, runner isolation profiles, connector adapters, and starter recipes for extension discovery.
- IDE extension scaffold contributes task run, dashboard launch, and doctor commands that delegate to the repo-local CLI.
- API exposes `POST /preflight`; `POST /tasks` records preflight metadata and moves high-risk allowed work to `awaiting_approval`.
- API `POST /tasks` preserves submitted task success criteria through run storage and retrieval.
- API goal completion emits `goal_completed` events and `goal_record` audit entries.
- API task creation normalizes missing org/project scope to `default-org/default-project`; configured API keys protect control-plane routes when `DIVINITY_API_KEY` or `DIVINITY_API_KEYS` is set.
- Preflight and step-gate decisions evaluate policy-pack pre-execution hooks into deterministic hook outcomes, warnings, blocks, and observed evidence before execution adapters run.
- CLI/API run payloads include budget incident records when soft or hard budget caps are exceeded, and API audit export records those incidents as immutable evidence.
- API exposes `GET /runs`, `GET /approvals`, `GET /runs/:id/approval`, `POST /runs/:id/approval`, `/runs/:id/approval/comments`, `/runs/:id/approval/revision`, and `/runs/:id/approval/resubmit` for dashboard loading, approval snapshots, approve/reject transitions, revision/resubmission transitions, and approval review context.
- API exposes `GET /capabilities` for policy, runtime adapter, execution adapter, runner isolation profile, connector adapter, and starter recipe discovery.
- API exposes `GET /runs/:id/connectors` and `POST /runs/:id/connectors` for run-level ticket/docs/CI context attachments.
- API run state can be backed by a file snapshot when `DIVINITY_RUN_STORE_PATH` is set; the default remains in-memory for local deterministic demos.
- API exposes `POST /runs/:id/steps` to run policy and budget gates before a step can enter pending execution.
- API exposes `POST /runs/:id/steps/:step_id/execute` for policy-approved step execution through constrained adapters.
- API step execution supports bounded retries for failed allowed steps and records attempt metadata on each execution record.
- API step execution records per-run execution locks and rejects overlapping execution attempts with the active lock payload.
- API exposes `POST /runs/:id/execution-locks/recover` to mark expired locks stale and preserve recovery evidence.
- API exposes `POST /runs/:id/heartbeat` to append run liveness records, update `last_heartbeat_at`, and preserve heartbeat timeline/audit evidence.
- API connector references emit `connector_reference_attached` events and `connector_reference` audit entries.
- API approval comments emit `approval_comment_added` events and `approval_comment` audit entries.
- API approval revision requests emit `approval_revision_requested` events, pause runs, and create `approval_revision` audit entries; approval resubmissions emit `approval_resubmitted` events and return runs to `awaiting_approval`.
- API execution uses per-run local snapshots or shallow Git URL clones; workspaces exclude `node_modules`, preserve Git metadata for Git adapters, and record the selected runner isolation profile. When `container_sandbox` is selected, constrained shell adapters execute through the Docker command plan with network disabled.
- API step execution now creates verifier records with observed status, exit-code, and output-capture checks; `step_verified` timeline events and `verification_record` audit records preserve the result.
- API exposes `POST /runs/:id/workspace/cleanup` to remove managed workspaces and record `workspace_cleaned` events.
- Execution adapters currently cover workspace `README.md` reads, `git status --short`, whitelisted Node test scripts, and constrained Node-based package scripts for approved command steps. Shell-backed adapters use Docker when the run workspace selects `container_sandbox`; missing Docker produces a failed execution record instead of falling back silently to host execution.
- Hard budget cap excess now maps to `paused` for CLI/API runs and pauses an API run when a proposed step exceeds the hard cap.
- Soft and hard budget cap excess creates `divinity.budget_incident.v1` records with scope, threshold, cost, limit, status, and evidence refs.
- CLI and API expose structured run events; dashboard can subscribe to live selected-run updates through API server-sent events.
- API step execution records `execution_lock_acquired`/`execution_lock_recovered`/`execution_lock_released`/`step_executed`/`step_verified` events and `execution_lock_record`/`execution_record`/`verification_record` audit entries.
- CLI and API expose patch/log/summary/PR-summary artifact metadata; patch artifacts include deterministic unified-diff payloads and PR summary artifacts include GitHub-ready Markdown generated from run context.
- CLI and API run payloads include deterministic planner/executor/verifier orchestration traces with evidence references.
- CLI and API run payloads include planner/executor/verifier activity records with actor, reason, status, evidence references, and budget estimates.
- CLI and API run payloads include session/project/team memory entries with provenance, confidence, and stable IDs.
- CLI and API run payloads include resolved team policy pack metadata by org scope.
- API exposes `GET /audit` for hash-backed run audit exports with optional timeframe filters.
- API exposes `GET /observability` for run health, heartbeat liveness, approval backlog, budget utilization, org/project scope rollups, risk mix, and failure taxonomy summaries.
- Dashboard shell exists at `apps/dashboard` with contract-shaped local sample data plus opt-in API loading through `?api=<base-url>` for task filtering, run timeline, goal records, approval decisions, approval comments, approval revisions, cost/risk badges, observability, scope rollups, liveness summaries, agent activity, execution and verification evidence including retry attempts, artifacts, audit metadata, and live updates.
- Dashboard run detail renders connector references for attached ticket, docs, and CI context.
- Missing permissions still produce blocked preflight decisions; soft caps emit `estimated_cost_exceeds_soft_limit` warnings.
- Preflight and step-gate decision payloads include evidence references for the objective/action, policy permissions, policy hooks, and budget limits.
- Summary artifacts include decision traces with chosen path, rejected alternative, rationale, and evidence references.
- Dashboard run detail renders decision traces with chosen path, rejected alternative, rationale, and supporting evidence.
- Evidence references label objective/action classifications as `inferred` and policy/budget values as `observed`; dashboard timeline events render observed/inferred chips.
- CLI onboarding exposes four guided starter recipes through `init` output and the `recipes` command.

## Epic 4: Explainability (M2-M3)
- [x] Action-to-evidence linking model.
  - Acceptance: each major decision includes at least one evidence reference.
- [x] Decision trace summaries.
  - Acceptance: run summary includes chosen path and rejected alternative.
- [x] Fact vs inference labeling.
  - Acceptance: UI/CLI marks statements as observed or inferred.

## Epic 5: Platform (M1-M3)
- [x] Auth + org/project model.
  - Acceptance: task is associated with org/project scope, and configured API keys require bearer auth for control-plane routes.
- [x] Artifact storage and retrieval API.
  - Acceptance: artifact metadata and payload retrieval endpoint work.
- [x] Event stream for live updates.
  - Acceptance: dashboard receives status updates in near real time.
- [x] Audit export endpoint.
  - Acceptance: exports immutable run audit log for selected timeframe.

## Blocking Dependencies
- Contract schemas must be stable before API/CLI integration.
- Shared event envelope required before dashboard live timeline.
- Policy engine decisions required before approval queue can be validated.

## Definition of Done (MVP)
- End-to-end flow: create task -> run -> approval -> artifact output. `[x]` Covered by `tests/tests_mvp_demo_flow.mjs`.
- Reproducible logs for each run.
- Budget and policy checks enforced in all execution paths.
- Minimum 4 guided starter recipes in onboarding. `[x]`

## Demo Script
1. Initialize project with safe policy preset.
2. Submit task from CLI and receive run ID.
3. Observe run entering `awaiting_approval` for high-risk step.
4. Approve from dashboard and watch run continue.
5. Export patch/log/summary/PR-summary artifacts and audit record.

Automated demo coverage lives in `tests/tests_mvp_demo_flow.mjs` and runs through `npm run test:mvp`, `npm run test:smoke`, and `npm test`.
