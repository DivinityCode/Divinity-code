# Product Requirements Baseline

## Purpose
This baseline defines who Divinity Code is for, what work it must help them complete, and what is intentionally out of scope while the platform matures from bootstrap into the MVP.

## Primary Personas
### Builder
- **Profile:** Developer or technical founder working inside a local repository.
- **Main need:** Turn a scoped engineering objective into a reviewed, verifiable change without losing local control.
- **Current surfaces:** CLI, IDE extension commands, task payloads, local validation, PR-ready artifacts, and structured bug reports.
- **Success signal:** Can initialize a repo, submit a task with success criteria and context references, inspect risk/budget status, and receive artifacts that are usable in a normal git workflow.

### Operator
- **Profile:** Engineering lead, reviewer, or platform operator responsible for supervising multiple agent runs.
- **Main need:** Understand what each run is doing, why it is allowed or blocked, where approval is needed, and what evidence supports the state.
- **Current surfaces:** API, dashboard, approval queue, run timeline, audit export, observability rollups, connector references, execution locks, and verification records.
- **Success signal:** Can triage queued and approval-required runs, inspect evidence and artifacts, approve or reject risky work, and export immutable audit history.

### Platform Administrator
- **Profile:** Person configuring policy, execution, and governance defaults for a team or organization.
- **Main need:** Keep agent work bounded by policy, budget, isolation, authentication, and reproducible diagnostics.
- **Current surfaces:** Policy presets, team policy packs, budget caps, API authentication, file-backed run storage, runner isolation profiles, doctor diagnostics, and capability discovery.
- **Success signal:** Can select safe defaults, verify local readiness, discover supported adapters, and rely on deterministic records for debugging and governance.

## Jobs To Be Done
### Builder Mode
1. Initialize a repository with predictable policy, budget, and scope defaults.
2. Submit a task with objective, repo context, success criteria, and optional ticket/docs/CI references.
3. Receive a structured run response with preflight risk, lifecycle status, policy pack, orchestration trace, agent activity, memory provenance, artifacts, and events.
4. Run deterministic local checks before publishing changes.
5. Produce GitHub-ready summaries and bug reports without leaving the command workflow.

### Operator Mode
1. List runs by status and identify approval backlog.
2. Inspect a selected run's timeline, evidence references, connector context, execution records, verification records, liveness, audit metadata, and artifacts.
3. Approve or reject high-risk work with actor, reason, and timestamp evidence.
4. Monitor health, budget utilization, stale runs, risk mix, failure taxonomy, and org/project rollups.
5. Export audit records for a selected timeframe.

### Platform Governance
1. Apply policy and budget gates before execution.
2. Route approved execution through managed workspaces and explicit runner isolation profiles.
3. Record execution locks so concurrent execution is observable and recoverable.
4. Preserve provenance for memory, decisions, artifacts, connector context, and verification results.
5. Discover supported policy presets, execution adapters, runner isolation profiles, connector adapters, and starter recipes through a shared capabilities contract.

## MVP Requirements
- **Contract-first surfaces:** CLI, API, dashboard, and IDE commands must share Task, Run, Preflight, Event, Artifact, Policy, and capability vocabulary.
- **Trust-first execution:** Risk, budget, policy, approval, evidence, and audit state must be visible before side effects.
- **Deterministic verification:** Local validation and smoke paths must run without polluting the repository root.
- **Operational dashboard:** Operator Mode must manage run status, approval decisions, evidence, liveness, artifacts, and audit metadata.
- **Extensible runtime:** Execution adapters, connector references, runner isolation profiles, recipes, and policy packs must be discoverable rather than hard-coded by clients.

## Non-Goals
- General chat assistant UX as the primary product surface.
- Unbounded autonomous execution without policy, budget, approval, and audit records.
- Supporting every programming language, package manager, CI provider, or ticket system in the bootstrap.
- Secret management, billing, organization administration, or production identity provider integration beyond configured API bearer keys.
- Cloud execution, hosted multi-tenant data storage, or marketplace/plugin distribution before the local and control-plane contracts are stable.
- Replacing GitHub review workflows; Divinity should generate PR-ready evidence and artifacts that fit existing review systems.

## Acceptance Baseline
- A new contributor can trace the product intent from this document to `docs/PRODUCT_PLAN.md`, `docs/MVP_BACKLOG.md`, and `docs/ARCHITECTURE.md`.
- Every implemented bootstrap surface can be mapped to at least one persona job above.
- Future feature proposals must state which persona and job they serve, which non-goal boundary they avoid, and which verification command proves the slice.
