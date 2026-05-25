# Policy Packs Package
Owner: Trust & Safety

Defines built-in team policy packs and resolves pack metadata from task scope.

## Current Surface
- `TEAM_POLICY_PACKS` contains starter and regulated org-level policy packs.
- Policy packs can declare data-only `pre_execution_hooks` that the policy engine evaluates before execution adapters run.
- `resolvePolicyPackForTask(...)` selects a pack by `scope.org_id` and falls back to the starter pack.
