# CLI App
Owner: Builder Experience

Planned commands: `init`, `run`, `status`, `approve`.

## Current Behavior
- `init` writes `.divinity.json` with the default `safe_exec` policy and budget caps.
- `init --wizard` prompts for policy preset and soft/hard budget caps while keeping prompts on stderr and JSON output on stdout.
- `init --policy scoped_edit --soft-limit 3 --hard-limit 8` writes a config without prompts for scripts and tests.
- `run` emits a task payload, generated `run_id`, lifecycle status, preflight decision metadata, artifact metadata, and a structured event timeline.
