# Verification Package
Owner: Intelligence Services

Creates deterministic post-execution verifier records from constrained execution evidence.

## Current Surface
- `createExecutionVerification(...)` evaluates an `ExecutionRecord` with observed status, exit code, and captured output checks.
- Verification records are attached to API steps/runs, emitted as run events, and exported through audit records.
