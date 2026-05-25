# Runner Isolation Package
Owner: Execution Plane

Defines public runner isolation profiles and deterministic container command plans.

## Current Surface
- `publicRunnerIsolationProfiles()` returns discoverable profile metadata for workspace snapshots and Docker-backed constrained command execution.
- `resolveRunnerIsolationProfile(...)` resolves a requested profile and falls back to `workspace_snapshot`.
- `createContainerCommandPlan(...)` builds a shell-free Docker argv array that bind-mounts the run workspace at `/workspace` with network disabled.

Local execution still defaults to workspace snapshots. When a run workspace records `container_sandbox`, constrained shell adapters in `packages/execution` invoke the generated Docker argv without shell interpolation. If Docker is not available, the execution record fails with the runtime error in `stderr`.
