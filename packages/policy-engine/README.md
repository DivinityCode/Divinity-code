# Policy Engine Package
Owner: Trust & Safety

Evaluates permissions, risk thresholds, and budget gates before execution.

## Current Surface
- `POLICY_PRESETS`: `read_only`, `scoped_edit`, `safe_exec`, and `full_exec`.
- `evaluatePreflight({ task, policy, policyPack })`: returns decision, derived run status, risk level, approval flag, predicted actions, budget state, policy hook outcomes, soft-cap warnings, blocked reasons, and observed/inferred evidence references.
- `evaluateStepGate({ run, step, policy, policyPack })`: reuses the same policy, budget, and policy-hook model for a proposed execution step and returns `allowed` or `blocked` with inferred step-action evidence before side effects run.
- `runStatusForDecision(decision)`: maps hard budget caps to `paused`, approval gates to `awaiting_approval`, policy blocks to `failed`, and allowed work to `queued`.
- `resolvePolicy(policyOrId)`: resolves preset ids to policy objects.
