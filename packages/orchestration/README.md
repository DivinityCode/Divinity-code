# Orchestration Package
Owner: Intelligence Services

Creates deterministic planner/executor/verifier trace payloads for run orchestration.

## Current Surface
- `createOrchestrationTrace(...)` produces a three-stage pipeline trace with planner steps, executor readiness, verifier result, and evidence references.
