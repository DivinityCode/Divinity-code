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
  - Acceptance: outputs artifact metadata containing patch/log/summary URIs.

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
- CLI `init` supports default, flag-driven, and prompt-driven project config creation for policy preset, soft/hard budget caps, and org/project scope.
- CLI `doctor` reports Node, npm, git, package manifest, and API server source readiness for local setup diagnostics.
- IDE extension scaffold contributes task run, dashboard launch, and doctor commands that delegate to the repo-local CLI.
- API exposes `POST /preflight`; `POST /tasks` records preflight metadata and moves high-risk allowed work to `awaiting_approval`.
- API task creation normalizes missing org/project scope to `default-org/default-project`; configured API keys protect control-plane routes when `DIVINITY_API_KEY` or `DIVINITY_API_KEYS` is set.
- API exposes `GET /runs`, `GET /approvals`, and `POST /runs/:id/approval` for dashboard loading and approve/reject transitions.
- API exposes `POST /runs/:id/steps` to run policy and budget gates before a step can enter pending execution.
- Hard budget cap excess now maps to `paused` for CLI/API runs and pauses an API run when a proposed step exceeds the hard cap.
- CLI and API expose structured run events; dashboard can subscribe to live selected-run updates through API server-sent events.
- CLI and API expose patch/log/summary artifact metadata; patch artifacts include deterministic unified-diff payloads generated from run context.
- CLI and API run payloads include deterministic planner/executor/verifier orchestration traces with evidence references.
- CLI and API run payloads include session/project/team memory entries with provenance, confidence, and stable IDs.
- CLI and API run payloads include resolved team policy pack metadata by org scope.
- API exposes `GET /audit` for hash-backed run audit exports with optional timeframe filters.
- Dashboard shell exists at `apps/dashboard` with contract-shaped local sample data plus opt-in API loading through `?api=<base-url>` for task filtering, run timeline, approval decisions, cost/risk badges, artifacts, audit metadata, and live updates.
- Missing permissions still produce blocked preflight decisions; soft caps emit `estimated_cost_exceeds_soft_limit` warnings.
- Preflight and step-gate decision payloads include evidence references for the objective/action, policy permissions, and budget limits.
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
- End-to-end flow: create task -> run -> approval -> artifact output.
- Reproducible logs for each run.
- Budget and policy checks enforced in all execution paths.
- Minimum 4 guided starter recipes in onboarding. `[x]`

## Demo Script
1. Initialize project with safe policy preset.
2. Submit task from CLI and receive run ID.
3. Observe run entering `awaiting_approval` for high-risk step.
4. Approve from dashboard and watch run continue.
5. Export patch/log/summary artifacts and audit record.
