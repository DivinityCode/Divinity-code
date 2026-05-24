# Observability Package

Builds `divinity.observability.v1` summaries from run state for operator metrics.

## Scope
- Aggregate status, risk, approval, and budget totals across runs.
- Count run heartbeats and identify active runs whose latest heartbeat or creation timestamp is stale.
- Classify failed or paused runs into policy, budget, execution, or unknown failure categories.
- Support both API run payloads and dashboard-normalized run objects.
