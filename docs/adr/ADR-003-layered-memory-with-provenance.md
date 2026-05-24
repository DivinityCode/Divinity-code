# ADR-003: Layered Memory with Provenance

## Context
Agent memory improves UX but can introduce stale or untrusted context.

## Decision
Implement memory tiers (session, project, team) with source provenance, timestamp, and confidence.

## Alternatives Considered
- Session-only ephemeral memory
- Global unscoped memory

## Consequences
- Better trust and debuggability.
- Requires lifecycle policies (expiry, pinning, conflict resolution).

## Revisit Trigger
If memory conflict or stale-recall incidents exceed acceptable threshold.
