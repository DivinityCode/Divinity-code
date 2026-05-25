# CLI App
Owner: Builder Experience

Commands: `init`, `run`, `status`, `approvals`, `approve`, `reject`, `approval-comment`, `approval-comments`, `capabilities`, `recipes`, `doctor`, `bug`.

## Current Behavior
- `init` writes `.divinity.json` with the default `safe_exec` policy, budget caps, and org/project scope.
- `init --wizard` prompts for policy preset, soft/hard budget caps, and org/project scope while keeping prompts on stderr and JSON output on stdout.
- `init --policy scoped_edit --soft-limit 3 --hard-limit 8 --org acme --project platform` writes a config without prompts for scripts and tests.
- `init` output includes the built-in starter recipes for onboarding.
- `run` emits a task payload, generated `run_id`, lifecycle status, preflight decision metadata, durable goal records, budget incident records, connector references, agent activity records, artifact metadata, and a structured event timeline; hard budget cap excess returns `paused`.
- `run --connector ticket_reference:ticket:DIV-17:https://example.test/tickets/DIV-17 "Read the repository README"` attaches initial ticket/docs/CI context to the task and resolved run output.
- `run --criteria "All tests pass" --success-criteria "Docs updated" "Implement policy trace"` attaches explicit success criteria to the task payload and creates matching run `goals` records with evidence and budget allocation.
- `approvals --api http://127.0.0.1:3000` lists approval-required runs from the control-plane API.
- `approve <run_id> --api http://127.0.0.1:3000 --actor operator@example.com --reason "reviewed"` approves an API-backed run and returns the updated run payload.
- `reject <run_id> --api http://127.0.0.1:3000 --actor operator@example.com --reason "unsafe"` rejects an API-backed run; without `--api`, `approve` and `reject` emit local structured decision payloads for scripts.
- `approval-comment <run_id> --api http://127.0.0.1:3000 --actor operator@example.com --body "needs verifier output"` attaches an API-backed approval review comment; without `--api`, it emits a local structured comment payload for scripts.
- `approval-comments <run_id> --api http://127.0.0.1:3000` lists approval comments for an API-backed run.
- `capabilities` lists supported policy presets, execution adapters, runner isolation profiles, connector adapters, and starter recipe summaries as `divinity.capabilities.v1`.
- `recipes` lists the built-in guided starter recipes.
- `doctor` reports Node, optional npm, optional pnpm/Corepack fallback, aggregate package-manager readiness, optional Docker runtime readiness for container-sandbox execution, installed dependencies, AJV validator dependencies, git, package manifest, and API server source readiness as structured JSON.
- `bug "summary"` emits a `divinity.bug_report.v1` payload with a GitHub-ready Markdown body, environment details, git status, and the same setup diagnostics used by `doctor`.
