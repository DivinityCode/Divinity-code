# Contracts Changelog

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
