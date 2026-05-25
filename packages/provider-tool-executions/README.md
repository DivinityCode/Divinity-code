# Provider Tool Executions
Owner: Runtime Governance

Creates `divinity.provider_tool_execution.v1` records from approved provider tool-call approvals.

The package requires an approved, redacted `divinity.provider_tool_call_approval.v1` record and fresh `argument_values` supplied at execution time. The argument keys must exactly match the approval record, and raw argument values are never copied into the returned execution record.

Operators may attach an optional `operator_summary` for reviewed, safe handoff back to the provider. The summary is rejected when it contains exact raw argument values, and continuation context still omits file paths, search queries, filenames, contents, and raw outputs.

Current adapters:
- `read_file`: reads a workspace-relative file after path containment checks and stores only output summary metadata such as byte and line counts.
- `search_files`: searches workspace-relative files after path containment checks and stores only redacted counts for scanned files, matches, and matching files.
- `list_files`: lists workspace-relative file tree shape after path containment checks and stores only redacted counts for files, directories, and maximum depth.
- `write_file`: writes full replacement content to a workspace-relative file after path containment checks, blocks protected `.git` and `node_modules` paths, and stores only byte/line counts plus path/content redaction flags.
- unsupported tools: return a `blocked` execution record instead of executing.

Execution records are audit evidence. They are not automatic model-driven tool loops, do not reconstruct redacted provider arguments, and do not persist file contents or file paths.
