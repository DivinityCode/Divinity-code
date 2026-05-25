# CLI App
Owner: Builder Experience

Commands: `init`, `run`, `status`, `approvals`, `approval`, `approve`, `reject`, `approval-comment`, `approval-comments`, `approval-revision`, `approval-resubmit`, `goal-complete`, `capabilities`, `providers`, `provider-route`, `provider-chat`, `toolsets`, `recipes`, `doctor`, `bug`.

## Current Behavior
- `init` writes `.divinity.json` with the default `safe_exec` policy, budget caps, org/project scope, default LLM provider, and default toolset preferences.
- `init --wizard` prompts for policy preset, soft/hard budget caps, and org/project scope while keeping prompts on stderr and JSON output on stdout.
- `init --policy scoped_edit --soft-limit 3 --hard-limit 8 --org acme --project platform --provider groq --model llama-3.3-70b-versatile` writes a config without prompts for scripts and tests.
- `init` output includes the built-in starter recipes for onboarding.
- `run` emits a task payload, generated `run_id`, lifecycle status, preflight decision metadata, provider runtime metadata, toolset resolution metadata, durable goal records, budget incident records, connector references, agent activity records, artifact metadata, and a structured event timeline; hard budget cap excess returns `paused`.
- `run --connector ticket_reference:ticket:DIV-17:https://example.test/tickets/DIV-17 "Read the repository README"` attaches initial ticket/docs/CI context to the task and resolved run output.
- `run --criteria "All tests pass" --success-criteria "Docs updated" "Implement policy trace"` attaches explicit success criteria to the task payload and creates matching run `goals` records with evidence and budget allocation.
- `status <run_id> --api http://127.0.0.1:3000` fetches a stored API run and returns its lifecycle status plus the run payload; without `--api`, `status` keeps the local queued placeholder for scripts.
- `approvals --api http://127.0.0.1:3000` lists approval-required runs from the control-plane API.
- `approval <run_id> --api http://127.0.0.1:3000` fetches approval state, latest approval revision, approval comments, and the current run payload without mutating the run.
- `approve <run_id> --api http://127.0.0.1:3000 --actor operator@example.com --reason "reviewed"` approves an API-backed run and returns the updated run payload.
- `reject <run_id> --api http://127.0.0.1:3000 --actor operator@example.com --reason "unsafe"` rejects an API-backed run; without `--api`, `approve` and `reject` emit local structured decision payloads for scripts.
- `approval-comment <run_id> --api http://127.0.0.1:3000 --actor operator@example.com --body "needs verifier output"` attaches an API-backed approval review comment; without `--api`, it emits a local structured comment payload for scripts.
- `approval-comments <run_id> --api http://127.0.0.1:3000` lists approval comments for an API-backed run.
- `approval-revision <run_id> --api http://127.0.0.1:3000 --actor operator@example.com --reason "needs rollback evidence" --change "attach rollback plan"` requests revision on an API-backed approval run and moves it to `paused`; without `--api`, it emits a local structured revision payload for scripts.
- `approval-resubmit <run_id> --api http://127.0.0.1:3000 --actor builder@example.com --reason "rollback evidence attached"` resubmits a paused approval revision back to `awaiting_approval`; without `--api`, it emits a local structured resubmission payload for scripts.
- `goal-complete <run_id> <goal_id> --api http://127.0.0.1:3000 --verification <verification_id>` completes an API-backed run goal only when the verification record passed; without `--api`, it emits a local structured completion payload for scripts.
- `capabilities` lists supported policy presets, execution adapters, runner isolation profiles, connector adapters, LLM providers, toolsets, and starter recipe summaries as `divinity.capabilities.v1`.
- `providers` lists contract-shaped LLM provider metadata loaded from `packages/provider-runtime/providers.v1.json` without resolving or printing secret values.
- `provider-route --candidate openrouter --candidate groq` plans an authorized provider route as `divinity.provider_proxy_route.v1`, selecting only configured providers and blocking public shared-key or limit-bypass routing intent.
- `provider-chat --provider openrouter --message "hello"` executes a non-streaming provider request only after route planning succeeds; output omits prompts, request bodies, and credential values. Supported transports are OpenAI-compatible Chat Completions, Anthropic Messages, and OpenAI Responses. Use `--max-completion-tokens` for Chat Completions or `--max-output-tokens` for Responses/Anthropic-style output caps. Credentialed providers use their catalog endpoint, while `--base-url` is reserved for no-key local custom development endpoints.
- `toolsets` lists public toolset metadata and the default tool resolution.
- `recipes` lists the built-in guided starter recipes.
- `doctor` reports Node, optional npm, optional pnpm/Corepack fallback, aggregate package-manager readiness, optional Docker runtime readiness for container-sandbox execution, installed dependencies, AJV validator dependencies, git, package manifest, provider and toolset catalog readiness, optional LLM provider credential readiness, and API server source readiness as structured JSON.
- `bug "summary"` emits a `divinity.bug_report.v1` payload with a GitHub-ready Markdown body, environment details, git status, and the same setup diagnostics used by `doctor`.
