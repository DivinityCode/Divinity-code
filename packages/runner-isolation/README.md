# Runner Isolation Package
Owner: Execution Plane

Defines public runner isolation profiles and deterministic container command plans.

## Current Surface
- `publicRunnerIsolationProfiles()` returns discoverable profile metadata for workspace snapshots and Docker-backed container planning.
- `resolveRunnerIsolationProfile(...)` resolves a requested profile and falls back to `workspace_snapshot`.
- `createContainerCommandPlan(...)` builds a shell-free Docker argv array that bind-mounts the run workspace at `/workspace` with network disabled.

Local execution still defaults to workspace snapshots. The container profile is exposed as a command plan so future execution backends can run the same constrained adapter commands in Docker without changing capability contracts.
