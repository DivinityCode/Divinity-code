# Divinity Code Product Plan (Phase 0 -> Phase 2)

## Vision
Build a best-in-class AI engineering platform that combines:
- Deep coding execution (terminal + IDE workflows).
- Multi-agent orchestration (planner/executor/verifier).
- Clear, user-friendly UX with explicit trust, budget, and approvals.

## Phase 0: Foundation (Weeks 1-2)
### Goals
- Define product surfaces and shared contracts.
- Stand up monorepo architecture and development workflow.
- Build first-click onboarding artifacts.

### Deliverables
1. Product requirements baseline (personas, jobs-to-be-done, non-goals).
2. Domain model for tasks/runs/artifacts/policies.
3. UI information architecture for Builder Mode and Operator Mode.
4. MVP backlog with acceptance criteria.

## Phase 1: MVP (Weeks 3-8)
### Goals
- Deliver end-to-end coding workflow with controlled execution.
- Provide operator visibility and approval gates.

### Deliverables
1. **Builder Mode**
   - CLI session lifecycle.
   - Repo-aware task execution.
   - Patch + PR summary artifacts.
   - Bootstrap status: CLI and IDE command surfaces are present, with IDE commands delegating to CLI workflows.
   - Bootstrap status: API can execute policy-approved file-read, git-status, Node test, and constrained package-script steps through the execution adapter surface.
   - Bootstrap status: local-directory tasks execute from per-run workspace snapshots rather than directly from the source path, and explicit Git URLs are shallow-cloned into run workspaces.
   - Bootstrap status: run workspaces can be cleaned through the API with timeline/audit evidence.
   - Bootstrap status: API run state can persist to a file-backed store when `DIVINITY_RUN_STORE_PATH` is configured.
   - Bootstrap status: CLI/API capability catalogs expose current policy presets, execution adapters, connector adapters, and starter recipes.
   - Bootstrap status: API step execution records execution locks, rejects overlapping execution attempts, and exposes stale-lock recovery.
   - Bootstrap status: API step execution emits post-execution verifier records into run state, events, audit export, and the operator dashboard.
   - Bootstrap status: API runs accept heartbeat records for liveness reporting and stale-run detection.
2. **Operator Mode**
   - Task queue dashboard.
   - Approval queue for high-risk steps.
   - Run timeline with logs and evidence links.
3. **Safety & Cost Controls**
   - Permission presets.
   - Per-run budget ceilings.
   - Preflight risk panel.

## Phase 2: Differentiators (Weeks 9-14)
### Goals
- Add multi-agent orchestration and robust memory.
- Improve trust through explainability and governance.

### Deliverables
1. Planner/Executor/Verifier pipeline.
   - Bootstrap status: deterministic orchestration trace is emitted by CLI/API runs.
   - Bootstrap status: planner/executor/verifier activity records expose actor, reason, evidence, status, and budget estimates in CLI/API/dashboard surfaces.
   - Bootstrap status: executed API steps now produce deterministic verifier records from observed execution evidence.
2. Layered memory (session/project/team) with provenance.
   - Bootstrap status: session/project/team memory entries are emitted by CLI/API runs.
3. Decision-trace UX surfaces.
   - Bootstrap status: dashboard run detail renders chosen path, rejected alternative, rationale, and evidence.
4. Team policy packs and audit export.
   - Bootstrap status: org-scoped starter and regulated policy packs are resolved into CLI/API run payloads; audit export is available from the API.
5. Operator observability.
   - Bootstrap status: API and dashboard expose run health, heartbeat liveness, budget utilization, approval backlog, and policy/budget/execution failure taxonomy.

## Success Metrics
- Time-to-first-value: < 10 minutes from signup to first completed task.
- Task completion rate: > 75% for defined MVP task set.
- Human override rate at approval gates: < 25% (indicates trust calibration).
- Mean user satisfaction for UX clarity: >= 4.5/5.

## Risks & Mitigation
- **Risk:** Tooling breadth creates complexity.
  - **Mitigation:** Strict phased scope and feature flag rollout.
- **Risk:** Multi-agent unreliability.
  - **Mitigation:** Verifier gate + bounded retries + mandatory human checkpoints.
- **Risk:** Cost unpredictability.
  - **Mitigation:** Budget caps, preflight estimates, auto-pause policies.
