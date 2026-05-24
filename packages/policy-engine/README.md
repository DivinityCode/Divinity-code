# Policy Engine Package
Owner: Trust & Safety

Evaluates permissions, risk thresholds, and budget gates before execution.

## Current Surface
- `POLICY_PRESETS`: `read_only`, `scoped_edit`, `safe_exec`, and `full_exec`.
- `evaluatePreflight({ task, policy })`: returns decision, risk level, approval flag, predicted actions, budget state, and blocked reasons.
- `resolvePolicy(policyOrId)`: resolves preset ids to policy objects.
