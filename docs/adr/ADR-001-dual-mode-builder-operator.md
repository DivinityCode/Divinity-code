# ADR-001: Dual-Mode Product (Builder + Operator)

## Context
Developers need fast local coding loops while teams need governance and oversight.

## Decision
Ship two first-class surfaces:
- Builder Mode (CLI/IDE)
- Operator Mode (web dashboard)

## Alternatives Considered
- CLI-only product
- Dashboard-only orchestration product

## Consequences
- Increases initial platform scope but reduces long-term fragmentation.
- Requires shared task/run contracts across surfaces.

## Revisit Trigger
If >70% of usage remains single-surface for two consecutive quarters.
