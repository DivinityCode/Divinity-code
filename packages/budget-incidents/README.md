# Budget Incidents Package

Creates auditable soft and hard budget incident records from preflight or step-gate decisions.

## Current Surface
- `createBudgetIncidents(...)` returns `divinity.budget_incident.v1` records when soft or hard budget caps are exceeded.
- Incidents carry run/task/scope identity, threshold, severity, estimated cost, limit, status, and supporting budget evidence refs.
