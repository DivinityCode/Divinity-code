# Toolsets Package

Public toolset catalog and deterministic default tool resolution.

## Current Catalog
- `web`
- `file`
- `terminal`
- `code_execution`
- `browser`
- `memory`
- `delegation`
- `connectors`
- `approvals`

## Scope
- Exposes tool group descriptions, included tool ids, default enablement, risk levels, and required policy permissions.
- Resolves enabled and disabled toolset ids into a sorted tool list.
- Does not execute tools or bypass policy gates.
