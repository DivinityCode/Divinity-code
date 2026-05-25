# Referenced Repository Code Examples

_Last refreshed: 2026-05-25_

## Scope
This appendix captures source-level examples from the referenced repositories behind the competitive research:

- [`anthropics/claude-code`](https://github.com/anthropics/claude-code) at `39e853e4074d90f27afdfb7ea601e0fc378bd0c5`
- [`openai/codex`](https://github.com/openai/codex) at `9f42c89c0112771dc29100a6f3fc904049b2655f`
- [`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent) at `af144cd60d2a69d47aa23090b5c51485cff46256`
- [`paperclipai/paperclip`](https://github.com/paperclipai/paperclip) at `96f0279e081ccc2745f3898a5aa9309b4d015def`

The examples are not copied implementation recipes. They are commit-pinned references that show concrete product and architecture patterns Divinity Code can adopt or continue refining.

## Claude Code
Claude Code's public repository is strongest as a plugin, workflow, policy, and support-example reference rather than a full CLI runtime source reference.

| Source path | Pattern observed | Divinity Code implication |
| --- | --- | --- |
| [`plugins/README.md`](https://github.com/anthropics/claude-code/blob/39e853e4074d90f27afdfb7ea601e0fc378bd0c5/plugins/README.md) | Plugin structure makes commands, agents, skills, hooks, MCP config, and README documentation explicit per plugin. | Keep Divinity extension points discoverable through capability catalogs, connector adapters, policy packs, and future plugin manifests instead of burying them in runtime code. |
| [`plugins/code-review/commands/code-review.md`](https://github.com/anthropics/claude-code/blob/39e853e4074d90f27afdfb7ea601e0fc378bd0c5/plugins/code-review/commands/code-review.md) | Review workflow uses phased triage, independent reviewer agents, validation agents, and high-signal filtering before comments are posted. | Divinity's planner/executor/verifier activity model should preserve phase, actor, evidence, and validation status for review-style work. |
| [`plugins/feature-dev/commands/feature-dev.md`](https://github.com/anthropics/claude-code/blob/39e853e4074d90f27afdfb7ea601e0fc378bd0c5/plugins/feature-dev/commands/feature-dev.md) | Feature development is documented as discovery, exploration, clarification, architecture, implementation, review, and summary phases. | Divinity run timelines should make phase transitions visible and keep user-facing checkpoints separate from low-level execution events. |
| [`examples/hooks/bash_command_validator_example.py`](https://github.com/anthropics/claude-code/blob/39e853e4074d90f27afdfb7ea601e0fc378bd0c5/examples/hooks/bash_command_validator_example.py) | Pre-tool hooks validate shell commands before execution and can block unsafe or low-quality command choices. | Divinity's preflight and policy engine should stay ahead of execution adapters and eventually expose hook-like policy extensions. |
| [`examples/settings/settings-strict.json`](https://github.com/anthropics/claude-code/blob/39e853e4074d90f27afdfb7ea601e0fc378bd0c5/examples/settings/settings-strict.json) | Strict settings combine deny lists, managed permission rules, managed hooks, and sandbox network limits. | Divinity policy presets should remain data-first and operator-readable, with clear separation between allowed actions, approvals, denial, and sandbox constraints. |

## OpenAI Codex
Codex provides the deepest implementation reference for a local coding-agent runtime with CLI wrappers, permissions, sandboxing, goals, and app-server protocol contracts.

| Source path | Pattern observed | Divinity Code implication |
| --- | --- | --- |
| [`codex-cli/bin/codex.js`](https://github.com/openai/codex/blob/9f42c89c0112771dc29100a6f3fc904049b2655f/codex-cli/bin/codex.js) | Thin Node launcher resolves the platform-native binary package, amends `PATH`, forwards process arguments, and mirrors child exit status. | Divinity can keep the current Node bootstrap while leaving room for future native binaries or packaged worker runtimes behind the same CLI command. |
| [`codex-rs/README.md`](https://github.com/openai/codex/blob/9f42c89c0112771dc29100a6f3fc904049b2655f/codex-rs/README.md) | Rust CLI docs separate install, config, MCP, notifications, non-interactive exec, sandbox diagnostics, and crate organization. | Divinity docs should keep user quickstart, contributor architecture, and runtime diagnostics distinct as the monorepo grows. |
| [`codex-rs/core/src/goals.rs`](https://github.com/openai/codex/blob/9f42c89c0112771dc29100a6f3fc904049b2655f/codex-rs/core/src/goals.rs) | Goal runtime bridges persisted state, protocol events, budget accounting, continuation steering, and terminal metrics. | Divinity's existing task success criteria can evolve into durable goals only if budget, status, continuation, and evidence remain first-class run state. |
| [`codex-rs/core/src/tools/handlers/goal/create_goal.rs`](https://github.com/openai/codex/blob/9f42c89c0112771dc29100a6f3fc904049b2655f/codex-rs/core/src/tools/handlers/goal/create_goal.rs) and [`update_goal.rs`](https://github.com/openai/codex/blob/9f42c89c0112771dc29100a6f3fc904049b2655f/codex-rs/core/src/tools/handlers/goal/update_goal.rs) | Goal mutations are exposed through constrained tool handlers; update only allows terminal or blocked transitions controlled by policy. | Divinity approval and status routes should continue using explicit transition functions instead of free-form status mutation. |
| [`codex-rs/core/src/config/resolved_permission_profile.rs`](https://github.com/openai/codex/blob/9f42c89c0112771dc29100a6f3fc904049b2655f/codex-rs/core/src/config/resolved_permission_profile.rs) | Permission state distinguishes legacy, built-in, and named profiles while preserving active profile identity and workspace roots. | Divinity's capability catalog and policy packs should retain profile identity and resolved effective permissions separately. |
| [`codex-rs/core/src/exec_policy.rs`](https://github.com/openai/codex/blob/9f42c89c0112771dc29100a6f3fc904049b2655f/codex-rs/core/src/exec_policy.rs) | Execution policy evaluates command rules, sandbox context, approval settings, and command-safety heuristics before prompts or execution. | Divinity's policy engine should stay independent from specific adapters so package scripts, file reads, git commands, and future shell adapters share one gate. |
| [`codex-rs/app-server-protocol/schema/json/v2`](https://github.com/openai/codex/tree/9f42c89c0112771dc29100a6f3fc904049b2655f/codex-rs/app-server-protocol/schema/json/v2) | App/server protocol is schema-generated around thread lifecycle, command exec, config, plugins, skills, permission profiles, and goals. | Divinity's `packages/contracts` approach is aligned; new surfaces should keep schemas and examples ahead of UI or adapter implementation. |

## Hermes Agent
Hermes Agent is a broad Python reference for CLI ergonomics, runtime-provider resolution, memory/skill activation, gateway portability, and ACP-style approvals.

| Source path | Pattern observed | Divinity Code implication |
| --- | --- | --- |
| [`hermes_cli/_parser.py`](https://github.com/NousResearch/hermes-agent/blob/af144cd60d2a69d47aa23090b5c51485cff46256/hermes_cli/_parser.py) | Top-level parser documents chat, setup, auth, gateway, sessions, logs, debug sharing, dashboard, worktree, skills, model, and provider switches in one command surface. | Divinity should keep `doctor`, `recipes`, `capabilities`, and future runtime/gateway commands discoverable from the CLI, not only in docs. |
| [`hermes_cli/doctor.py`](https://github.com/NousResearch/hermes-agent/blob/af144cd60d2a69d47aa23090b5c51485cff46256/hermes_cli/doctor.py) | Doctor diagnostics group environment, provider, gateway, and runtime checks with remediation hints. | Divinity's `doctor` command should continue adding actionable checks as dependencies grow, especially around package managers, Docker, connectors, and credentials. |
| [`hermes_cli/runtime_provider.py`](https://github.com/NousResearch/hermes-agent/blob/af144cd60d2a69d47aa23090b5c51485cff46256/hermes_cli/runtime_provider.py) | Runtime provider resolution is shared across CLI, gateway, cron, local servers, OAuth-backed providers, and external process credentials. | Divinity connector and execution runtime configuration should be resolved once and reused across CLI/API/dashboard paths to avoid divergent behavior. |
| [`acp_adapter/permissions.py`](https://github.com/NousResearch/hermes-agent/blob/af144cd60d2a69d47aa23090b5c51485cff46256/acp_adapter/permissions.py) | Approval callbacks translate external permission outcomes into stable internal semantics such as allow once, allow for session, allow always, and deny. | Divinity approval contracts should keep user decisions semantic and durable even when different frontends or connectors request them. |
| [`agent/agent_init.py`](https://github.com/NousResearch/hermes-agent/blob/af144cd60d2a69d47aa23090b5c51485cff46256/agent/agent_init.py) | Agent initialization wires session persistence, todo state, memory providers, user/profile scoping, and optional skill state before the run loop. | Divinity's planner/executor/verifier and memory packages should keep initialization evidence visible so operators can explain which context influenced a run. |

## Paperclip
Paperclip is the strongest control-plane reference for organizational agent work: adapters, worktrees, approvals, budget policies, heartbeats, and persistent operational state.

| Source path | Pattern observed | Divinity Code implication |
| --- | --- | --- |
| [`cli/src/commands/run.ts`](https://github.com/paperclipai/paperclip/blob/96f0279e081ccc2745f3898a5aa9309b4d015def/cli/src/commands/run.ts) | `run` performs instance resolution, config loading, onboarding fallback, doctor checks, and server startup in one guarded lifecycle. | Divinity should keep `init` and `doctor` close to the execution path so the first run fails with setup evidence rather than hidden runtime errors. |
| [`cli/src/adapters/registry.ts`](https://github.com/paperclipai/paperclip/blob/96f0279e081ccc2745f3898a5aa9309b4d015def/cli/src/adapters/registry.ts) | Adapter registry normalizes Claude, Codex, Cursor, Gemini, Grok, process, HTTP, and other runtime adapters behind one lookup. | Divinity's capabilities catalog is the right place to expose adapter identities before implementing every adapter. |
| [`cli/src/commands/client/approval.ts`](https://github.com/paperclipai/paperclip/blob/96f0279e081ccc2745f3898a5aa9309b4d015def/cli/src/commands/client/approval.ts) | CLI approval commands list, create, approve, reject, request revision, resubmit, and comment against API-backed approval records. | Divinity should eventually expand `approve` into a fuller approval subcommand family while preserving the existing `approve/reject` route semantics. |
| [`cli/src/commands/worktree.ts`](https://github.com/paperclipai/paperclip/blob/96f0279e081ccc2745f3898a5aa9309b4d015def/cli/src/commands/worktree.ts) | Worktree orchestration isolates config, environment, database state, git hooks, ports, and live execution quarantine when seeding parallel instances. | Divinity's run workspaces and runner isolation profiles should keep quarantine, cleanup, and source/target metadata explicit as execution gets more parallel. |
| [`doc/spec/agent-runs.md`](https://github.com/paperclipai/paperclip/blob/96f0279e081ccc2745f3898a5aa9309b4d015def/doc/spec/agent-runs.md) | Agent run protocol separates adapter identity, wakeup source, runtime state, hooks, logs, usage, outcome, and run log storage. | Divinity's Task/Run/Step/Execution/Verification schemas should keep adapter runtime state, logs, usage, and outcome boundaries separate. |
| [`doc/plans/2026-03-14-budget-policies-and-enforcement.md`](https://github.com/paperclipai/paperclip/blob/96f0279e081ccc2745f3898a5aa9309b4d015def/doc/plans/2026-03-14-budget-policies-and-enforcement.md) | Budget plan distinguishes soft alerts, hard stops, billed spend, project/agent/company scopes, incidents, and approvals. | Divinity's budget fields should evolve from simple caps into policy-backed incidents and approval-required hard stops. |

## Development Plan Implications
The code examples reinforce the current bootstrap direction and add these concrete follow-on slices:

1. **Approval command family:** keep existing `approve` behavior, then add list/get/reject/revision/comment subcommands once approval records need operator workflows beyond a single transition.
2. **Runtime adapter registry:** extend `packages/capabilities` and execution adapter metadata before adding new runtime integrations so CLI/API/dashboard all expose the same adapter identity.
3. **Policy-hook bridge:** model hook-like pre-execution checks as policy-pack extensions, preserving deterministic preflight output before any adapter runs.
4. **Durable goal model:** promote task success criteria into optional durable goal state only after budget accounting, continuation behavior, and completion evidence are represented in contracts.
5. **Budget incidents:** add soft/hard budget incident records before adding richer dashboard controls so financial risk state remains auditable.
6. **Worktree isolation hardening:** keep run workspace cleanup/quarantine evidence visible as runner isolation moves from local snapshots toward parallel or remote execution.

## Local Mapping
| External pattern | Current Divinity surface |
| --- | --- |
| Plugin/skill/adapter catalogs | `packages/capabilities`, `packages/connectors`, `packages/policy-packs` |
| Preflight and hook-style checks | `packages/policy-engine`, `packages/execution`, API preflight and step gates |
| Durable task/goal semantics | `packages/contracts/schemas/task.v1.json`, CLI criteria flags, API task persistence |
| App/server schemas | `packages/contracts/schemas`, `packages/contracts/examples`, `tests/scripts_validate_contracts.mjs` |
| Doctor/setup diagnostics | `apps/cli/src/index.mjs`, `tests/tests_cli_doctor.mjs` |
| Runtime adapters and execution records | `packages/execution`, `packages/runner-isolation`, API step execution routes |
| Approval lifecycle | `packages/contracts/schemas/approval.v1.json`, API approval routes, dashboard approval queue |
| Heartbeats and liveness | `packages/heartbeats`, `packages/observability`, dashboard liveness card |
