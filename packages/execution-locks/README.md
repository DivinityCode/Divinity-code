# Execution Locks Package
Owner: Control Plane

Creates per-run execution locks so operators can see when a step owns the execution lane.

## Current Surface
- `createExecutionLock(...)` creates a locked record for a run and step.
- `activeExecutionLock(...)` returns the current non-expired locked record.
- `recoverStaleExecutionLocks(...)` marks expired locked records as `stale` and refreshes `active_execution_lock`.
- `releaseExecutionLock(...)` marks a lock as released, failed, or stale.
