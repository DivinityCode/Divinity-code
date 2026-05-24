# ADR-002: Planner/Executor/Verifier Agent Topology

## Context
Single-agent loops are simpler but less reliable on complex multi-step tasks.

## Decision
Use planner/executor/verifier pipeline with human approval gates for high-risk actions.

## Alternatives Considered
- Single generalist agent
- Planner+executor without verifier

## Consequences
- Better reliability and auditability.
- Higher orchestration complexity and operational cost.

## Revisit Trigger
If verifier false-positive rate blocks >30% of successful runs.
