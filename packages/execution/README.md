# Execution Package
Owner: Execution Plane

Runs policy-approved steps through constrained local adapters.

## Current Surface
- `resolveExecutionAdapter(step)` maps a gated step to the adapter that can execute it.
- `executeStep(...)` requires a pending step with an `allow` pre-execution decision before any adapter runs.
- The initial `file_read` adapter reads `README.md` from the run workspace and returns an `ExecutionRecord` with stdout, stderr, exit code, timestamps, and target path.
