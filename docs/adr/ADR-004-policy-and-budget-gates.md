# ADR-004: Policy and Budget Gates Before Execution

## Context
Unbounded tool execution can cause security and cost failures.

## Decision
Apply policy and budget checks before side-effecting steps; require approval when thresholds are exceeded.

## Alternatives Considered
- Post-execution auditing only
- Manual approval for every action

## Consequences
- Safer defaults and clearer trust model.
- Added friction for advanced users unless override flows are designed well.

## Revisit Trigger
If user drop-off from preflight friction exceeds onboarding targets.
