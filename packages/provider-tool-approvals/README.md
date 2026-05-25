# Provider Tool Approvals Package

Creates redacted operator decision records for provider-returned tool calls.

## Scope
- `createProviderToolCallApproval()` creates `divinity.provider_tool_call_approval.v1` records from redacted provider tool-call request metadata.
- Decisions are `approve` or `reject` and include actor, reason, timestamp, provider id, transport, tool name, tool call id, and sorted argument keys.
- Raw argument values are rejected and never returned.
- This package records approval evidence only; it does not execute tools.
