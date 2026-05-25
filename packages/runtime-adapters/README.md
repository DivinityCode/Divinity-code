# Runtime Adapters Package

Defines agent runtime adapter metadata exposed through `divinity.capabilities.v1`.

## Current Catalog
- `divinity_local` for the built-in Divinity CLI/API runtime.
- `claude_local` for an authenticated Claude Code CLI runtime.
- `codex_local` for an authenticated Codex CLI runtime.
- `generic_process` for configured process adapters without first-party parsing.

Runtime adapters identify which agent runtime can own work. Execution adapters remain the lower-level approved step executors such as file reads, git status, Node tests, and package scripts.
