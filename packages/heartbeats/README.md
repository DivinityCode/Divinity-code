# Heartbeats Package
Owner: Control Plane

Creates run heartbeat records for operator liveness and recovery visibility.

## Current Surface
- `createRunHeartbeat(...)` creates `alive`, `warning`, or `stale` heartbeat records for a run.
- `latestHeartbeatAt(...)` returns the latest recorded heartbeat timestamp for run state and observability summaries.
