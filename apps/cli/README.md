# CLI App
Owner: Builder Experience

Planned commands: `init`, `run`, `status`, `approve`.

## Current Behavior
- `init` writes `.divinity.json` with the default `safe_exec` policy, budget caps, and org/project scope.
- `init --wizard` prompts for policy preset, soft/hard budget caps, and org/project scope while keeping prompts on stderr and JSON output on stdout.
- `init --policy scoped_edit --soft-limit 3 --hard-limit 8 --org acme --project platform` writes a config without prompts for scripts and tests.
- `run` emits a task payload, generated `run_id`, lifecycle status, preflight decision metadata, artifact metadata, and a structured event timeline; hard budget cap excess returns `paused`.
