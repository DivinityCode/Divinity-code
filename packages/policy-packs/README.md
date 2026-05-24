# Policy Packs Package
Owner: Trust & Safety

Defines built-in team policy packs and resolves pack metadata from task scope.

## Current Surface
- `TEAM_POLICY_PACKS` contains starter and regulated org-level policy packs.
- `resolvePolicyPackForTask(...)` selects a pack by `scope.org_id` and falls back to the starter pack.
