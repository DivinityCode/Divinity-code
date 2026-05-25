# Domain Model

## Purpose
This document is the Phase 0 domain model baseline for Divinity Code. It defines the core objects that connect Builder Mode, the Control Plane API, Operator Mode, contracts, tests, and documentation.

## Model Principles
- **Contract first:** public surfaces use schema-backed objects before UI-specific or adapter-specific shapes.
- **Run centered:** operational state is anchored to a run so approvals, events, artifacts, executions, verification, audit, and observability can be correlated.
- **Evidence carrying:** policy decisions, execution results, and summaries carry evidence references instead of relying on prose alone.
- **Governance visible:** policy, budget, approval, audit, and liveness state are first-class data, not hidden runtime behavior.
- **Extensible by catalog:** clients discover policy presets, runtime adapters, execution adapters, runner isolation profiles, connector adapters, and recipes through capabilities.

## Core Objects
| Object | Contract | Owner package or surface | Role |
| --- | --- | --- | --- |
| Task | `packages/contracts/schemas/task.v1.json` | CLI/API request surfaces | Captures objective, success criteria, repo context, scope, policy, budget, connector requests, and creation time. |
| Run | `packages/contracts/schemas/run.v1.json` | API run store, CLI run output | Tracks one execution attempt for a task, including lifecycle status and risk level. |
| GoalRecord | `packages/contracts/schemas/goal.v1.json` | Goals package, CLI/API run output, API goal routes | Promotes task success criteria into durable run goals with status, scope, budget allocation, and verifier-backed completion evidence refs. |
| PreflightDecision | `packages/contracts/schemas/preflight.v1.json` | Policy engine | Explains risk, predicted actions, budget estimate, policy hook outcomes, warnings, blocked reasons, approval requirement, and run status before execution. |
| Policy | `packages/contracts/schemas/policy.v1.json` | Policy engine and policy packs | Defines permissions and approval threshold used to gate work. |
| Step | `packages/contracts/schemas/step.v1.json` | API step routes, execution package | Represents a proposed atomic action and its pre-execution gate result. |
| Artifact | `packages/contracts/schemas/artifact.v1.json` | Artifacts package and API artifact routes | Describes patch, log, summary, PR-summary, and evidence payloads generated from run context. |
| BudgetIncident | `packages/contracts/schemas/budget-incident.v1.json` | Budget incidents package, CLI/API run output, audit export | Records soft and hard budget threshold events with scope, cost, limit, status, and evidence. |
| RunEvent | `packages/contracts/schemas/event.v1.json` | Events package, API stream, dashboard timeline | Records lifecycle transitions and operational activity with timestamps and metadata. |
| ApprovalDecision | `packages/contracts/schemas/approval.v1.json` | API approval routes, dashboard approvals | Records approve/reject decisions, actor, reason, and decision time. |
| ApprovalComment | `packages/contracts/schemas/approval-comment.v1.json` | Approval comments package, API approval routes, CLI approval comments | Records operator review comments attached to a run approval workflow. |
| ApprovalRevision | `packages/contracts/schemas/approval-revision.v1.json` | Approval revisions package, API approval routes, CLI approval revision commands | Records requested changes and resubmission metadata for approval workflows that need more evidence before approve/reject. |
| ExecutionRecord | `packages/contracts/schemas/execution.v1.json` | Execution package | Captures adapter, status, exit code, stdout, stderr, started time, and finished time for observed execution. |
| VerificationRecord | `packages/contracts/schemas/verification.v1.json` | Verification package | Captures post-execution verifier checks derived from observed execution evidence. |
| ExecutionLockRecord | `packages/contracts/schemas/execution-lock.v1.json` | Execution locks package | Tracks lock acquire/release/recovery state for run step execution ownership. |
| HeartbeatRecord | `packages/contracts/schemas/heartbeat.v1.json` | Heartbeats package | Tracks liveness signals for runs and stale-run observability. |
| ConnectorReference | `packages/contracts/schemas/connector-reference.v1.json` | Connectors package | Records ticket, docs, and CI context attached to task/run state. |
| AgentActivityRecord | `packages/contracts/schemas/agent-activity.v1.json` | Agent activity package | Makes planner, executor, and verifier activity visible before or around execution. |
| AuditExport | `packages/contracts/schemas/audit.v1.json` | Audit package and API export | Provides immutable audit records and timeframe export shape. |
| ObservabilitySummary | `packages/contracts/schemas/observability.v1.json` | Observability package and dashboard | Aggregates run health, liveness, budget, risk, failure taxonomy, and org/project rollups. |
| CapabilitiesCatalog | `packages/contracts/schemas/capabilities.v1.json` | Capabilities package, CLI/API discovery | Lists supported policies, runtime adapters, execution adapters, isolation profiles, connectors, and recipes. |
| BugReport | `packages/contracts/schemas/bug-report.v1.json` | CLI bug command | Captures local diagnostic evidence and GitHub-ready issue Markdown. |

## Relationships
| Relationship | Cardinality | Notes |
| --- | --- | --- |
| Task -> Run | One task can create many runs | API `POST /tasks` creates a run from task input; CLI `run` emits one local run payload. |
| Run -> GoalRecord | Zero or more goals | Each non-empty success criterion creates one goal record at run assembly time; passed verifier evidence can complete a pending goal. |
| Run -> PreflightDecision | One required decision per run | Preflight determines lifecycle status before execution starts. |
| Run -> Step | Zero or more steps | API `POST /runs/:id/steps` adds gated steps. |
| Step -> ExecutionRecord | Zero or one execution in current bootstrap | Execution only occurs after policy gates allow the step. |
| ExecutionRecord -> VerificationRecord | Zero or one verifier record per execution | The verifier records observed status, exit-code, and output checks. |
| Run -> Artifact | Zero or more artifacts | Patch, log, summary, and PR-summary artifacts are generated for CLI/API runs. |
| Run -> BudgetIncident | Zero or more incidents | Soft and hard budget threshold events are attached to run state and audit records. |
| Run -> RunEvent | One or more events | Events record task creation, preflight, status changes, approvals, execution, verification, locks, heartbeats, connectors, and cleanup. |
| Run -> ApprovalDecision | Zero or one active decision | Approval is required only when preflight or step gates require operator intervention. |
| Run -> ApprovalComment | Zero or more comments | Operators can add review context without changing approval state. |
| Run -> ApprovalRevision | Zero or one latest revision | Operators can pause an approval for requested changes; builders can resubmit it to the approval queue. |
| Run -> ConnectorReference | Zero or more references | References can be included at task creation or attached later. |
| Run -> HeartbeatRecord | Zero or more heartbeats | Heartbeats feed liveness and stale-run summaries. |
| Run -> ExecutionLockRecord | Zero or more locks | Locks prevent overlapping execution and preserve recovery evidence. |
| Run -> AuditRecord | Many audit records | Audit entries are hash-backed and exportable through `GET /audit`. |

## Lifecycle
1. **Task creation:** Builder or API client submits objective, success criteria, repo, scope, policy, budget, and optional connector references.
2. **Preflight:** Policy engine infers actions, estimates risk/cost, checks policy permissions, policy-pack hooks, and budget caps, and returns decision plus evidence.
3. **Run assembly:** API/CLI resolves policy pack, goal records, budget incidents, orchestration trace, agent activity, memory provenance, connector references, artifacts, and initial events.
4. **Approval gate:** High-risk allowed work enters `awaiting_approval`; blocked work fails or pauses before execution.
5. **Step gate:** API step creation evaluates action-level policy and budget constraints.
6. **Execution lock:** API acquires a run/step lock before execution and records release or recovery.
7. **Execution and verification:** Adapter output becomes an execution record, then verifier checks become verification evidence.
8. **Observability and audit:** Events, audit records, heartbeats, artifacts, and summaries make the run inspectable by dashboard and export routes.

## Surface Placement
| Object group | Builder CLI | Control Plane API | Operator Dashboard |
| --- | --- | --- | --- |
| Task, Run, Goals, Preflight | `run` output | `/tasks`, `/preflight`, `/runs/:id` | run queue and selected-run header/detail |
| Policy and Capabilities | `capabilities`, `doctor` readiness context | `/capabilities` | capability-informed labels and operator context |
| Events, Goals, and Approvals | event array in `run`; `goal-complete`, `approvals`, `approval`, `approve`, `reject`, `approval-comment`, `approval-comments`, `approval-revision`, `approval-resubmit` | `/runs/:id/events`, `/runs/:id/goals/:goal_id/complete`, `/approvals`, `/runs/:id/approval`, `/runs/:id/approval/comments`, `/runs/:id/approval/revision`, `/runs/:id/approval/resubmit` | timeline, goal panel, and approval panel |
| Artifacts | artifact metadata in `run` | `/runs/:id/artifacts`, `/artifacts/:id` | artifact panel |
| Execution and Verification | not directly executed by CLI bootstrap | `/runs/:id/steps`, `/runs/:id/steps/:step_id/execute` | execution and verification panels |
| Audit and Observability | not primary in CLI bootstrap | `/audit`, `/observability` | audit metadata and observability region |

## Contract Index
- Task examples: `packages/contracts/examples/task.valid.json`, `packages/contracts/examples/task.invalid.json`
- Run examples: `packages/contracts/examples/run.valid.json`, `packages/contracts/examples/run.invalid.json`
- Goal examples: `packages/contracts/examples/goal.valid.json`, `packages/contracts/examples/goal.invalid.json`
- Step examples: `packages/contracts/examples/step.valid.json`, `packages/contracts/examples/step.invalid.json`
- Artifact examples: `packages/contracts/examples/artifact.valid.json`, `packages/contracts/examples/artifact.invalid.json`
- Budget incident examples: `packages/contracts/examples/budget-incident.valid.json`, `packages/contracts/examples/budget-incident.invalid.json`
- Approval comment examples: `packages/contracts/examples/approval-comment.valid.json`, `packages/contracts/examples/approval-comment.invalid.json`
- Approval revision examples: `packages/contracts/examples/approval-revision.valid.json`, `packages/contracts/examples/approval-revision.invalid.json`
- Policy schema: `packages/contracts/schemas/policy.v1.json`
- Validation entrypoint: `tests/scripts_validate_contracts.mjs`
- Smoke entrypoint: `tests/scripts_smoke_api.mjs`

## Acceptance Criteria
- Product Plan Phase 0 deliverable #2 links to this document.
- Architecture references this document as the canonical domain model baseline.
- README lists this document alongside product requirements, IA, architecture, backlog, research, and execution plan.
- Every core model object has a schema or explicit owner package/surface identified here.
