# CLI App
Owner: Builder Experience

Planned commands: `init`, `run`, `status`, `approve`, `capabilities`, `recipes`, `doctor`.

## Current Behavior
- `init` writes `.divinity.json` with the default `safe_exec` policy, budget caps, and org/project scope.
- `init --wizard` prompts for policy preset, soft/hard budget caps, and org/project scope while keeping prompts on stderr and JSON output on stdout.
- `init --policy scoped_edit --soft-limit 3 --hard-limit 8 --org acme --project platform` writes a config without prompts for scripts and tests.
- `init` output includes the built-in starter recipes for onboarding.
- `run` emits a task payload, generated `run_id`, lifecycle status, preflight decision metadata, connector references, agent activity records, artifact metadata, and a structured event timeline; hard budget cap excess returns `paused`.
- `run --connector ticket_reference:ticket:DIV-17:https://example.test/tickets/DIV-17 "Read the repository README"` attaches initial ticket/docs/CI context to the task and resolved run output.
- `capabilities` lists supported policy presets, execution adapters, runner isolation profiles, connector adapters, and starter recipe summaries as `divinity.capabilities.v1`.
- `recipes` lists the built-in guided starter recipes.
- `doctor` reports Node, optional npm, optional pnpm/Corepack fallback, aggregate package-manager readiness, installed dependencies, AJV validator dependencies, git, package manifest, and API server source readiness as structured JSON.
