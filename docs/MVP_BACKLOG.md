# MVP Backlog

## Milestones
- **M1:** Contracts + CLI skeleton
- **M2:** Run lifecycle + policy checks
- **M3:** Dashboard + approvals

## Epic 1: Builder Mode Core (M1-M2)
- [ ] CLI init command with project config wizard.  
  - Acceptance: creates local project config with policy preset and budget defaults.
- [ ] Task command (`divinity run`) accepting objective + repo context.  
  - Acceptance: submits valid Task payload and returns `run_id`.
- [ ] Local run timeline and structured progress events.  
  - Acceptance: emits JSON event envelope with status transitions.
- [ ] Patch artifact generation and summary export.  
  - Acceptance: outputs artifact metadata containing patch/log/summary URIs.

## Epic 2: Operator Dashboard (M2-M3)
- [ ] Task list with status filtering.  
  - Acceptance: filter by queued/running/awaiting_approval/completed/failed.
- [ ] Run detail page with step-by-step timeline.  
  - Acceptance: shows ordered step list with timestamps and statuses.
- [ ] Approval queue for high-risk actions.  
  - Acceptance: pending approvals can be approved/rejected and state updates propagate.
- [ ] Cost/risk badges at task and run level.  
  - Acceptance: each run displays risk level and soft/hard budget usage.

## Epic 3: Trust & Policy (M1-M2)
- [ ] Permission presets (read-only, scoped-edit, safe-exec, full-exec).  
  - Acceptance: presets map to explicit permission arrays in Policy schema.
- [ ] Policy engine checks before step execution.  
  - Acceptance: high-risk or disallowed step is blocked pre-execution.
- [ ] Budget soft/hard cap enforcement.  
  - Acceptance: soft cap triggers warning; hard cap pauses run.
- [ ] Preflight panel payload contract.  
  - Acceptance: includes predicted actions, risk score, and estimated cost.

## Epic 4: Explainability (M2-M3)
- [ ] Action-to-evidence linking model.  
  - Acceptance: each major decision includes at least one evidence reference.
- [ ] Decision trace summaries.  
  - Acceptance: run summary includes chosen path and rejected alternative.
- [ ] Fact vs inference labeling.  
  - Acceptance: UI/CLI marks statements as observed or inferred.

## Epic 5: Platform (M1-M3)
- [ ] Auth + org/project model.  
  - Acceptance: task is associated with org and project scope.
- [ ] Artifact storage and retrieval API.  
  - Acceptance: artifact metadata and payload retrieval endpoint work.
- [ ] Event stream for live updates.  
  - Acceptance: dashboard receives status updates in near real time.
- [ ] Audit export endpoint.  
  - Acceptance: exports immutable run audit log for selected timeframe.

## Blocking Dependencies
- Contract schemas must be stable before API/CLI integration.
- Shared event envelope required before dashboard live timeline.
- Policy engine decisions required before approval queue can be validated.

## Definition of Done (MVP)
- End-to-end flow: create task -> run -> approval -> artifact output.
- Reproducible logs for each run.
- Budget and policy checks enforced in all execution paths.
- Minimum 4 guided starter recipes in onboarding.

## Demo Script
1. Initialize project with safe policy preset.
2. Submit task from CLI and receive run ID.
3. Observe run entering `awaiting_approval` for high-risk step.
4. Approve from dashboard and watch run continue.
5. Export patch/log/summary artifacts and audit record.
