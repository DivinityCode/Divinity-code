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
- Resolves enabled and disabled toolset ids into a sorted tool list plus provider-neutral JSON Schema `tool_schemas` for the selected tools.
- Tool schemas expose only names, descriptions, input schemas, owning toolsets, risk levels, and policy permissions; they do not include prompts, credentials, endpoints, or execution results.
- The default `file` toolset includes redacted read-only context tools such as `read_file`, `search_files`, and `list_files`, plus write/patch tool ids that still require policy approval before execution.
- Does not execute tools or bypass policy gates.
