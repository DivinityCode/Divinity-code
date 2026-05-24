# Agent Activity Package
Owner: Intelligence Services

Creates deterministic planner, executor, and verifier activity records for observable multi-agent work.

## Current Surface
- `createAgentActivityRecords(...)` returns contract-shaped activity records with actor, role, action, reason, status, budget estimate, and evidence references.
- CLI/API run payloads include these records so clients can inspect who did what, why, with what evidence, and under which estimated budget.
