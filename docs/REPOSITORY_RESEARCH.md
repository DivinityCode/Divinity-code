# Competitive Repository Research (Claude Code, Codex, Hermes Agent, Paperclip)

_Last refreshed: 2026-05-24_

## Scope
This research covers the referenced GitHub repositories and public project documentation for:
- [`anthropics/claude-code`](https://github.com/anthropics/claude-code)
- [`openai/codex`](https://github.com/openai/codex)
- [`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent)
- [`paperclipai/paperclip`](https://github.com/paperclipai/paperclip)

The goal is to translate repo-level patterns into product and implementation decisions for Divinity Code.

## Current Repo Signals
| Repo | Primary language | Latest observed release | Positioning signal |
| --- | --- | --- | --- |
| `anthropics/claude-code` | Shell | `v2.1.150` | Terminal-native coding agent with IDE and GitHub adjacency. |
| `openai/codex` | Rust | `rust-v0.133.0` | Lightweight local coding agent spanning CLI, IDE, app, and web surfaces. |
| `NousResearch/hermes-agent` | Python | `v2026.5.16` | Self-improving multi-channel agent with memory, skills, schedulers, and portable runtimes. |
| `paperclipai/paperclip` | TypeScript | `v2026.517.0` | Agent-management control plane for goals, budgets, governance, heartbeats, and audit trails. |

## 1) Claude Code
### Observed strengths
- Product promise is narrow and memorable: a terminal agent that understands the codebase, performs routine tasks, explains code, and handles git workflows.
- Installation is treated as core product UX, with first-party installers across macOS, Linux, Windows, Homebrew, WinGet, and a deprecated npm path.
- The README connects terminal use, IDE use, and GitHub tagging without fragmenting the core mental model.
- Plugins are a first-class extension surface rather than a hidden internal detail.
- Bug reporting is embedded in the workflow through an in-product `/bug` command.

### Product takeaways for Divinity Code
1. Preserve a keyboard-first Builder Mode where the fastest path is `divinity init` -> `divinity run`.
2. Treat installer and environment diagnostics as MVP work, not post-MVP polish.
3. Keep git-native outputs: run summaries, validation commands, patch artifacts, and PR-ready descriptions.
4. Make extension points explicit early: policy presets, tool adapters, and future plugins should be discoverable.

## 2) Codex
### Observed strengths
- Clearly separates local CLI, IDE extension, desktop app, and cloud/web agent surfaces while keeping one product identity.
- Quickstart is short and practical: installer script first, package managers second, binary releases as fallback.
- The project emphasizes local execution and direct developer loops.
- Apache-2.0 licensing and Rust implementation signal a serious open-source CLI foundation.
- Docs are prominent and split by usage, installation/building, and contribution paths.

### Product takeaways for Divinity Code
1. Use one shared Task/Run/Preflight model across CLI, API, dashboard, and future IDE surfaces.
2. Keep CLI output structured JSON-friendly so other tools and dashboards can consume it.
3. Make local verification cheap enough to run before every PR.
4. Separate user docs from contributor docs once implementation grows beyond this bootstrap.

## 3) Hermes Agent
### Observed strengths
- Differentiates around persistent learning loops: memories, skill creation, skill refinement, session search, and user modeling.
- Supports many interaction channels from one gateway process: CLI, Telegram, Discord, Slack, WhatsApp, Signal, and more.
- Runtime portability is a core feature: local, Docker, SSH, Singularity, Modal, Daytona, and Vercel Sandbox.
- Subagents and parallel workstreams are part of the core operating model.
- The command surface includes setup, doctor, tools, model switching, gateway setup, and migration flows.

### Product takeaways for Divinity Code
1. Design memory as provenance-first data, not opaque long-term context.
2. Make subagent delegation observable: who did what, why, with what evidence, and under which budget.
3. Add a `doctor`-style diagnostic command before deep integrations.
4. Keep runtime abstractions portable enough for local worktrees now and cloud runners later.

## 4) Paperclip
### Observed strengths
- Models agent work as organizational work: goals, org charts, budgets, governance, tickets, heartbeats, and audit trails.
- Dashboard framing is operational rather than chat-centric.
- Budget enforcement, approvals, execution locks, and recovery are core control-plane responsibilities.
- Supports multiple agent adapters instead of assuming one agent runtime.
- Emphasizes persistent state, task context, and immutable activity over ephemeral conversations.

### Product takeaways for Divinity Code
1. Operator Mode should manage runs and approvals, not just display chat.
2. Every run should be tied to policy, budget, risk, evidence, and artifact metadata.
3. Approval gates need to be explicit data contracts before the dashboard is built.
4. Cost/risk state should be present in both CLI and API responses from the start.

## Cross-Repo Convergence
1. **Fast local builder loop:** install, initialize, run, verify, summarize.
2. **Shared contract model:** one Task/Run/Preflight vocabulary across every surface.
3. **Trust-first execution:** policy preflight, risk labels, budget checks, approval state, and immutable records.
4. **Operator visibility:** queue, timeline, audit trail, cost/risk, and intervention controls.
5. **Extensible agent runtime:** adapters, plugins, memory, skills, and portable execution backends.

## Implementation Decisions Adopted
1. Add preflight decisions as a first-class contract before dashboard work.
2. Return preflight risk, budget, approval, and block state from CLI and API flows.
3. Add policy presets for `read_only`, `scoped_edit`, `safe_exec`, and `full_exec`.
4. Keep smoke tests local and deterministic by using temp workspaces.
5. Keep documentation current with observed repo signals and implementation status.

## Build Slices Adopted From Research
1. **Approval queue:** implemented run storage with an in-memory default, opt-in file-backed persistence, approval-required runs, and approve/reject transitions.
2. **Run event envelope:** implemented structured status events across CLI/API and dashboard consumption.
3. **Artifact metadata and payloads:** implemented patch/log/summary artifact records with retrievable patch, log, and summary content.
4. **Execution workspaces:** implemented per-run local snapshots, explicit Git URL clones, and cleanup for API execution.
5. **Operator dashboard shell:** implemented task filtering, run detail, approval queue, cost/risk badges, artifacts, audit metadata, and live API updates.
6. **Diagnostics:** implemented `divinity doctor` for Node, npm, git, package manifest, and API server source readiness checks.
7. **Operator observability:** implemented run health, budget utilization, approval backlog, and policy/budget/execution failure taxonomy summaries in the API and dashboard.
8. **Execution adapter expansion:** implemented constrained package-script execution for Node-based package scripts without shell interpolation.
9. **Capability discovery:** implemented a shared `divinity.capabilities.v1` catalog so clients can discover policy presets, execution adapters, runner isolation profiles, connector adapters, and starter recipes.
10. **Post-execution verification:** implemented `divinity.verification.v1` records so executed steps carry verifier results through run state, events, audit, and dashboard rendering.
11. **Observable agent activity:** implemented `divinity.agent_activity.v1` records so planner, executor, and verifier work carries actor, reason, evidence, status, and budget estimates.
12. **Run heartbeats:** implemented `divinity.heartbeat.v1` records, `POST /runs/:id/heartbeat`, liveness fields in observability summaries, and a dashboard liveness card for heartbeat and stale-run visibility.
13. **Execution locks and recovery:** implemented `divinity.execution_lock.v1` records so API step execution has explicit lock acquire/release/recovery evidence and rejects overlapping execution attempts.
14. **Connector adapter discovery:** implemented ticket, docs, and CI connector adapter metadata in the shared capabilities catalog to keep external context extension points explicit.
15. **Connector reference attachments:** implemented `divinity.connector_reference.v1` records, CLI initial references, API attach/list routes, timeline/audit evidence, and dashboard rendering for ticket, docs, and CI context.
16. **Scope observability rollups:** implemented org/project run counts, approval backlog, and budget utilization rollups in `divinity.observability.v1`, API output, and dashboard rendering.
17. **Runner isolation profiles:** implemented workspace snapshot and Docker container-sandbox profile discovery, run workspace isolation metadata, and deterministic Docker argv planning for future container-backed execution.
