# Provider Tool Executions
Owner: Runtime Governance

Creates `divinity.provider_tool_execution.v1` records from approved provider tool-call approvals.

The package requires an approved, redacted `divinity.provider_tool_call_approval.v1` record and fresh `argument_values` supplied at execution time. The argument keys must exactly match the approval record, and raw argument values are never copied into the returned execution record.

Current adapters:
- `read_file`: reads a workspace-relative file after path containment checks and stores only output summary metadata such as byte and line counts.
- unsupported tools: return a `blocked` execution record instead of executing.

Execution records are audit evidence. They are not automatic model-driven tool loops, do not reconstruct redacted provider arguments, and do not persist file contents.
