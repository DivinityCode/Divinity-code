# Contracts Changelog

## v1.41.0
- Added `ProviderUsageLedger` schema and examples for redacted provider/model request and token usage aggregates.

## v1.40.0
- Added `ProviderToolExecution` schema and examples for approved, redacted provider tool execution records.
- Added optional `provider_tool_executions` arrays to Run records.
- Added `provider_tool_execution` audit records.

## v1.39.0
- Added `ProviderToolCallApproval` schema and examples for redacted provider tool-call approve/reject decisions.
- Added optional `provider_tool_call_approvals` arrays to Run records.
- Added `provider_tool_call_approval` audit records.

## v1.38.0
- Added optional Task provider runtime and toolset resolution metadata for provider-aware run setup.
- Expanded provider ids in capability/task metadata to include authorized free-tier provider candidates from public research lists.

## v1.37.0
- Added LLM provider and toolset metadata to `CapabilitiesCatalog`.
- Updated capabilities examples so provider and toolset catalog discovery is contract-visible.

## v1.36.0
- Added `ExecutionRecord.attempt`, `max_attempts`, and `retry_of` for bounded execution retry evidence.
- Updated Step embedded execution records to carry the same retry metadata.

## v1.35.0
- Added optional `GoalRecord.completed_at` for verifier-backed completion mutations.
- Added `goal_completed` run events and `goal_record` audit entries for constrained goal completion evidence.

## v1.34.0
- Added `ApprovalRevision` schema and examples for approval revision request and resubmission records.
- Added optional `approval_revision` payloads to Run records.
- Added `approval_revision_requested` and `approval_resubmitted` run events plus `approval_revision` audit records.

## v1.33.0
- Added `ApprovalComment` schema and examples for approval discussion records.
- Added `approval_comment_added` run events and `approval_comment` audit records.
- Added optional `approval_comments` arrays to Run payloads.

## v1.32.0
- Added `GoalRecord` schema and examples for task success criteria promoted into durable run goals.
- Added optional `goals` arrays to the Run schema for bootstrap goal visibility.

## v1.31.0
- Added `BudgetIncident` schema and examples for soft/hard budget threshold records.
- Added `budget_incident` audit record type for immutable financial-risk evidence.

## v1.30.0
- Added `policy_hooks` to PreflightDecision so policy-pack pre-execution hook outcomes are contract-visible.
- Updated preflight examples and validation coverage for policy hook evidence.

## v1.29.0
- Added optional Task `success_criteria` arrays for explicit run acceptance signals.

## v1.28.0
- Added `BugReport` schema and examples for CLI-generated, GitHub-ready bug reports with environment, git, and diagnostic evidence.

## v1.27.0
- Added `pr_summary` as an Artifact type for PR-ready run summaries.

## v1.26.0
- Added runner isolation profile metadata to `CapabilitiesCatalog` for workspace snapshot and Docker container-sandbox discovery.

## v1.25.0
- Added `scope_rollups` to `ObservabilitySummary` for org/project run counts, approval backlog, and budget utilization.

## v1.24.0
- Added `ConnectorReference` schema and examples for run-level ticket, docs, and CI context.
- Added optional Task `connector_references` requests and `connector_reference_attached` run events.

## v1.23.0
- Added connector adapter metadata to `CapabilitiesCatalog` for ticket, docs, and CI references.

## v1.22.0
- Added `ExecutionLockRecord` schema and examples for per-run execution ownership.
- Added `execution_lock_acquired`, `execution_lock_recovered`, and `execution_lock_released` run events plus `execution_lock_record` audit entries.

## v1.21.0
- Added `HeartbeatRecord` schema and examples for run liveness reporting.
- Added `heartbeat_recorded` run events, `heartbeat_record` audit entries, and observability liveness fields.

## v1.20.0
- Added `AgentActivityRecord` schema and examples for observable planner/executor/verifier activity.

## v1.19.0
- Added `VerificationRecord` schema and examples for post-execution verifier evidence.
- Added `step_verified` run events and `verification_record` audit entries.

## v1.18.0
- Added `CapabilitiesCatalog` schema and examples for policy preset, execution adapter, and starter recipe discovery.

## v1.17.0
- Added `package_script` as an ExecutionRecord adapter for constrained Node-based package script execution.

## v1.16.0
- Added `ObservabilitySummary` schema and examples for run health, budget utilization, approval backlog, and failure taxonomy reporting.

## v1.15.0
- Added `workspace_cleaned` run events for execution workspace lifecycle tracking.

## v1.14.0
- Added `node_test` as an ExecutionRecord adapter for constrained Node test command execution.

## v1.13.0
- Added `git_status` as an ExecutionRecord adapter for constrained git status command execution.

## v1.12.0
- Added ExecutionRecord schema and examples for execution adapter outputs.
- Added `step_executed` run events and `execution_record` audit entries.
- Added optional Step `execution` payload for completed or failed step execution evidence.

## v1.11.0
- Added required Task `scope.org_id` and `scope.project_id` fields for org/project run association.

## v1.10.0
- Added `claim_type` to evidence references so outputs can distinguish observed facts from inferred classifications.

## v1.9.0
- Added `evidence_refs` to PreflightDecision and Step pre-execution checks.
- Evidence references identify the source, summary, and supported decision fields for policy and budget outcomes.

## v1.8.0
- Added `paused` run and event status for hard budget cap enforcement.
- Added `run_status` to PreflightDecision so policy decisions map deterministically to lifecycle states.

## v1.7.0
- Expanded Step schema with `blocked` status and `pre_execution_check` metadata for policy-gated steps.
- Added Step valid/invalid examples and repository-level validation checks.

## v1.6.0
- Added AuditExport schema and examples for immutable run audit exports.
- Added repository-level validation checks for audit valid/invalid examples.

## v1.5.0
- Added artifact valid/invalid examples to lock patch/log/summary metadata shape.
- Added repository-level validation checks for artifact examples.

## v1.4.0
- Added RunEvent schema and examples for timeline events.
- Added repository-level validation checks for event valid/invalid examples.

## v1.3.0
- Added ApprovalDecision schema and examples for approve/reject transitions.
- Added repository-level validation checks for approval valid/invalid examples.

## v1.2.0
- Added PreflightDecision schema and examples for risk, budget, approval, and block decisions.
- Added repository-level validation checks for preflight valid/invalid examples.

## v1.1.0
- Added run contract example payloads (valid/invalid).
- Added repository-level contract validation script support.

## v1.0.0
- Initial schema set: Task, Run, Step, Artifact, Policy.
- Added lifecycle states and risk/budget fields needed for MVP preflight and approvals.
