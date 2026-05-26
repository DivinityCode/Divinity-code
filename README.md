# Divinity Code

Divinity Code is an AI engineering platform designed to combine best-in-class coding execution, multi-agent orchestration, and a user-friendly trust-first UX.

> ⚠️ **WARNING: Divinity Code is under heavy active development and is not yet ready for production use. It should only be used if you know what you're doing.**

## Current Status
Bootstrap development is integrated on `main`. The repo now includes contract validation, CLI/API run flows with explicit task success criteria, durable goal records with verifier-backed completion, policy and budget gates, budget incident records, policy-pack pre-execution hook checks, approval transitions, approval comments, approval revision/resubmission records, execution locks, bounded execution retries, execution adapter and verifier records, observable planner/executor/verifier activity, run heartbeats, isolated local and Git URL execution workspaces with cleanup, runner isolation profiles with Docker-backed constrained command execution, patch/log/summary/PR-summary artifacts, structured bug reports, release status metadata, audit export, operator dashboard surfaces, starter recipes, diagnostics, orchestration traces, memory provenance, team policy packs, constrained package-script execution, discoverable runtime, connector, LLM provider, provider secret-store backend, toolset governance, provider route-planning, and provider chat-execution surfaces, run-level connector references, org/project observability rollups, a shared capabilities catalog, and opt-in file-backed API run storage.

## Documents
- [Install Guide](docs/INSTALL.md)
- [Quickstart](docs/QUICKSTART.md)
- [Upgrade Guide](docs/UPGRADE.md)
- [Release Checklist](docs/RELEASE_CHECKLIST.md)
- [Product Plan](docs/PRODUCT_PLAN.md)
- [Product Requirements Baseline](docs/PRODUCT_REQUIREMENTS.md)
- [UI Information Architecture](docs/INFORMATION_ARCHITECTURE.md)
- [Domain Model](docs/DOMAIN_MODEL.md)
- [Architecture Draft](docs/ARCHITECTURE.md)
- [MVP Backlog](docs/MVP_BACKLOG.md)
- [Competitive Repository Research](docs/REPOSITORY_RESEARCH.md)
- [Referenced Repository Code Examples](docs/REPOSITORY_CODE_EXAMPLES.md)
- [Free LLM Provider Research](docs/FREE_LLM_PROVIDER_RESEARCH.md)
- [Week 1 Execution Plan](docs/WEEK1_EXECUTION_PLAN.md)

## Implemented Surfaces
1. Builder CLI: `init`, `run`, API-backed `status`, `approvals`, `approval`, `approve`, `reject`, `approval-comment`, `approval-comments`, `approval-revision`, `approval-resubmit`, `goal-complete`, `capabilities`, `providers`, `provider-route`, `provider-chat`, `provider-tool-approval`, `provider-tool-execute`, `toolsets`, `recipes`, `doctor`, `release-status`, and `bug`. `init` and `run` carry provider/tool runtime metadata without storing secret values; `capabilities` and `doctor` expose redacted provider secret-store backend discovery; `provider-chat` enforces selected toolset compatibility before upstream calls and can add redacted approved tool execution summaries as continuation context.
2. IDE extension scaffold: task run, dashboard launch, and doctor commands delegated to the repo-local CLI.
3. Control Plane API: health, capabilities, provider, provider secret-store, and toolset catalogs, provider secret readiness and store endpoints, provider route planning, provider chat execution, preflight, task creation, run retrieval, approvals, approval comments, approval revisions, goal completion, step gates and execution locks, verifier evidence, run heartbeats, connector references, artifacts, audit export, and live run streams.
4. Operator dashboard: run queue, approvals, approval comments, approval revisions, run timeline, decision trace, goal records, connector references, agent activity, execution and verification evidence with retry attempts, liveness summary, artifacts, audit metadata, and API-backed live updates.


## Repo Layout
- `apps/cli` - Builder Mode CLI
- `apps/ide-extension` - Builder Mode IDE extension scaffold
- `apps/api` - Control Plane API
- `apps/dashboard` - Operator Mode dashboard
- `packages/contracts` - versioned task/run/policy/capability/approval-comment/approval-revision/verification/agent-activity/execution-lock/heartbeat/connector-reference/budget-incident/goal/bug-report schemas
- `packages/agent-activity` - observable planner/executor/verifier activity records
- `packages/capabilities` - shared policy, runtime adapter, execution adapter, connector adapter, LLM provider, provider secret-store backend, toolset, and recipe capability catalog
- `packages/runtime-adapters` - agent runtime adapter metadata for Divinity, local CLI runtimes, and generic processes
- `packages/provider-runtime` - data-backed LLM provider catalog and side-effect-free credential readiness helpers
- `packages/provider-secrets` - redacted provider secret-reference manifests, secret-store backend discovery, encrypted store bootstrap, API credential resolver wiring, readiness metadata, and audit helpers
- `packages/provider-proxy` - safe LLM provider route planning and guarded Chat Completions, Anthropic Messages, and OpenAI Responses execution with shared-key and limit-bypass blocks
- `packages/toolsets` - toolset catalog, default resolution, policy permission, provider capability, and operator-control metadata helpers
- `packages/connectors` - ticket, docs, and CI connector adapter metadata and run reference helpers
- `packages/policy-engine` - trust and budget gate evaluation
- `packages/execution` - policy-approved step execution adapters
- `packages/execution-locks` - per-run execution lock records for control-plane execution ownership
- `packages/runner-isolation` - workspace snapshot and container sandbox profile metadata
- `packages/verification` - post-execution verifier records from observed execution evidence
- `packages/heartbeats` - run liveness heartbeat records for API and observability flows
- `packages/workspaces` - per-run local/Git URL workspaces and cleanup for execution
- `packages/run-store` - in-memory and file-backed API run state snapshots
- `packages/events` - shared run event model
- `packages/artifacts` - patch/log/summary/PR-summary artifact payloads
- `packages/audit` - hash-backed audit records and exports
- `packages/budget-incidents` - soft/hard budget incident records with supporting evidence
- `packages/goals` - durable goal records derived from task success criteria
- `packages/approval-comments` - structured approval review comments for run approval workflows
- `packages/approval-revisions` - structured approval revision request and resubmission records
- `packages/recipes` - guided starter recipes
- `packages/release-artifacts` - release readiness manifest and status metadata
- `packages/orchestration` - planner/executor/verifier traces
- `packages/memory` - session/project/team memory entries with provenance
- `packages/policy-packs` - org-scoped team policy pack metadata and pre-execution hook declarations
- `packages/observability` - run health, liveness, budget, org/project rollup, and failure taxonomy summaries
- `tests` - repository test suite and validation entrypoints


## Validation
- Run `corepack enable` and `pnpm install`
- If `pnpm` is unavailable but cached Corepack pnpm is present, run scripts with `node ~/.cache/node/corepack/v1/pnpm/<version>/bin/pnpm.cjs <script>`.
- Run `pnpm run validate:contracts` to validate schema examples and CI contract checks.
- Run `pnpm run test:package` to validate package metadata and the `divinity` CLI bin target.
- Run `node apps/cli/src/index.mjs release-status` for a read-only release readiness view.
- Run `pnpm run release:artifacts` to generate `dist/release-artifacts.json` for release-candidate review.
- Run `pnpm run release:binary` to generate local Node launcher artifacts and checksums for release-candidate binary smoke review.
- Run `pnpm run test:binary` to validate those launcher artifacts without publishing signed native downloads.
- Run `pnpm run release:bundle` to assemble a local release-candidate review bundle with the package tarball, release metadata, binary launcher artifacts, release attestation, and checksums.
- Run `pnpm run test:release-bundle` to validate the bundle manifest, attestation, redaction guarantees, package tarball, binary metadata, and checksums without publishing.
- Run `pnpm run release:promotion-preflight` to generate a blocked public-promotion preflight manifest before any package publish or signed binary release.
- Run `pnpm run test:release-promotion` to validate promotion blockers, required artifacts, gate commands, and secret redaction.
- Run `pnpm run test:release-artifacts` to validate the generated release artifact manifest, install-path gates, signing, registry publish, binary release readiness, bundle readiness metadata, attestation readiness metadata, and promotion preflight metadata.
- Run `pnpm run test:release-status` to validate the CLI release readiness surface.
- Run `pnpm run test:public-docs` to validate public install, quickstart, upgrade, and release checklist docs.
- Run `pnpm run test:github-workflows` to validate GitHub Actions use Node 22, clean installs, and the `Release Readiness` gate.
- Run `pnpm run test:smoke` for the local MVP demo flow plus CLI/API smoke path.
- Run `pnpm run test:providers` for focused LLM provider catalog coverage.
- Run `pnpm run test:toolsets` for focused toolset catalog coverage.
- Run `pnpm run test:goals` for focused success-criteria-to-goal and verifier-backed completion coverage.
- Run `pnpm run test:approval` for focused approval decision, approval comment, and approval revision coverage.
- Run `pnpm test` for preflight engine, approval API, execution adapters, run events, artifacts, audit export, CLI, and smoke checks.
