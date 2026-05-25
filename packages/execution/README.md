# Execution Package
Owner: Execution Plane

Runs policy-approved steps through constrained adapters.

## Current Surface
- `resolveExecutionAdapter(step)` maps a gated step to the adapter that can execute it.
- `executeStep(...)` requires a pending step with an `allow` pre-execution decision before any first attempt; failed allowed steps can be retried only within the bounded attempt state. API callers acquire execution locks before invoking it.
- `createExecutionAttemptState(...)` caps execution attempts at two by default and records `attempt`, `max_attempts`, and `retry_of` metadata on every execution record.
- The `file_read` adapter reads `README.md` from the run workspace and returns an `ExecutionRecord` with stdout, stderr, exit code, timestamps, and target path.
- The `git_status` adapter runs `git status --short` in the run workspace through `spawnSync` without shell interpolation.
- The `node_test` adapter runs whitelisted Node test scripts with `process.execPath` and does not accept arbitrary shell text.
- The `package_script` adapter runs explicitly named package scripts only when each command is a workspace-relative `node <file>.mjs` command, splitting `&&` chains without shell interpolation.
- For workspaces whose runner isolation profile is `container_sandbox`, `git_status`, `node_test`, and `package_script` execute through the Docker argv plan from `packages/runner-isolation` instead of running directly on the host. If Docker is unavailable, the adapter returns a failed execution record with the runtime error in `stderr`.
