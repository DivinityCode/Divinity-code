# Execution Package
Owner: Execution Plane

Runs policy-approved steps through constrained local adapters.

## Current Surface
- `resolveExecutionAdapter(step)` maps a gated step to the adapter that can execute it.
- `executeStep(...)` requires a pending step with an `allow` pre-execution decision before any adapter runs.
- The `file_read` adapter reads `README.md` from the run workspace and returns an `ExecutionRecord` with stdout, stderr, exit code, timestamps, and target path.
- The `git_status` adapter runs `git status --short` in the run workspace through `spawnSync` without shell interpolation.
- The `node_test` adapter runs whitelisted Node test scripts with `process.execPath` and does not accept arbitrary shell text.
