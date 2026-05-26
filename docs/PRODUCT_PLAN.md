# Divinity Code Product Plan (Phase 0 -> Phase 3)

## Vision
Build a best-in-class AI engineering platform that combines:
- Deep coding execution (terminal + IDE workflows).
- Multi-agent orchestration (planner/executor/verifier).
- Clear, user-friendly UX with explicit trust, budget, and approvals.

## Phase 0: Foundation (Weeks 1-2)
### Goals
- Define product surfaces and shared contracts.
- Stand up monorepo architecture and development workflow.
- Build first-click onboarding artifacts.

### Deliverables
1. Product requirements baseline (personas, jobs-to-be-done, non-goals).
   - Bootstrap status: documented in [Product Requirements Baseline](PRODUCT_REQUIREMENTS.md).
2. Domain model for tasks/runs/artifacts/policies.
   - Bootstrap status: documented in [Domain Model](DOMAIN_MODEL.md).
3. UI information architecture for Builder Mode and Operator Mode.
   - Bootstrap status: documented in [UI Information Architecture](INFORMATION_ARCHITECTURE.md).
4. MVP backlog with acceptance criteria.
   - Bootstrap status: documented in [MVP Backlog](MVP_BACKLOG.md).

## Phase 1: MVP (Weeks 3-8)
### Goals
- Deliver end-to-end coding workflow with controlled execution.
- Provide operator visibility and approval gates.

### Deliverables
1. **Builder Mode**
   - CLI session lifecycle.
   - Repo-aware task execution.
   - Patch + PR summary artifacts.
   - Bootstrap status: CLI/API runs emit patch, log, summary, and GitHub-ready PR summary artifacts.
   - Bootstrap status: CLI and IDE command surfaces are present, with IDE commands delegating to CLI workflows.
   - Bootstrap status: API can execute policy-approved file-read, git-status, Node test, and constrained package-script steps through the execution adapter surface.
   - Bootstrap status: local-directory tasks execute from per-run workspace snapshots rather than directly from the source path, and explicit Git URLs are shallow-cloned into run workspaces.
   - Bootstrap status: runner isolation profiles expose default workspace snapshot isolation and Docker container-sandbox execution for constrained shell adapters through CLI/API capabilities and workspace metadata.
   - Bootstrap status: run workspaces can be cleaned through the API with timeline/audit evidence.
   - Bootstrap status: API run state can persist to a file-backed store when `DIVINITY_RUN_STORE_PATH` is configured.
   - Bootstrap status: CLI/API capability catalogs expose current policy presets, execution adapters, runner isolation profiles, connector adapters, LLM provider catalogs, toolset catalogs, and starter recipes.
   - Bootstrap status: API step execution records execution locks, rejects overlapping execution attempts, and exposes stale-lock recovery.
   - Bootstrap status: API step execution supports bounded retries for failed allowed steps and records retry attempt metadata for operator review.
   - Bootstrap status: API step execution emits post-execution verifier records into run state, events, audit export, and the operator dashboard.
   - Bootstrap status: API runs accept heartbeat records for liveness reporting and stale-run detection.
   - Bootstrap status: CLI and API runs can attach ticket, docs, and CI connector references with timeline/audit evidence.
2. **Operator Mode**
   - Task queue dashboard.
   - Approval queue for high-risk steps.
   - Run timeline with logs and evidence links.
3. **Safety & Cost Controls**
   - Permission presets.
   - Per-run budget ceilings.
   - Preflight risk panel.

## Phase 2: Differentiators (Weeks 9-14)
### Goals
- Add multi-agent orchestration and robust memory.
- Improve trust through explainability and governance.

### Deliverables
1. Planner/Executor/Verifier pipeline.
   - Bootstrap status: deterministic orchestration trace is emitted by CLI/API runs.
   - Bootstrap status: planner/executor/verifier activity records expose actor, reason, evidence, status, and budget estimates in CLI/API/dashboard surfaces.
   - Bootstrap status: executed API steps now produce deterministic verifier records from observed execution evidence.
2. Layered memory (session/project/team) with provenance.
   - Bootstrap status: session/project/team memory entries are emitted by CLI/API runs.
3. Decision-trace UX surfaces.
   - Bootstrap status: dashboard run detail renders chosen path, rejected alternative, rationale, and evidence.
4. Team policy packs and audit export.
   - Bootstrap status: org-scoped starter and regulated policy packs are resolved into CLI/API run payloads; audit export is available from the API.
5. Operator observability.
   - Bootstrap status: API and dashboard expose run health, heartbeat liveness, budget utilization, org/project scope rollups, approval backlog, and policy/budget/execution failure taxonomy.
6. External context references.
   - Bootstrap status: connector references attach ticket, docs, and CI context to runs and render in the operator dashboard.

## Phase 3: Production Public Readiness (Weeks 15-22)
### Goals
- Make the platform usable by external builders without repository-specific setup knowledge.
- Convert provider, tool, and runtime configuration into predictable public surfaces.
- Prepare installer, packaging, and support workflows for public adoption.

### Deliverables
1. LLM provider runtime configuration.
   - Bootstrap status: LLM provider metadata and side-effect-free credential readiness are exposed through capabilities, CLI `providers`, API `/providers`, and `doctor`.
   - Bootstrap status: operator-controlled provider catalog overlays can be supplied through `DIVINITY_PROVIDER_CATALOG_PATH` so legitimate free-tier, trial, or local providers can be tested without editing source code or storing secrets in manifests.
   - Bootstrap status: CLI/API task assembly resolves provider runtime metadata from config or request input without printing or storing secret values.
   - Bootstrap status: provider route planning is exposed through CLI `provider-route`, API `POST /provider-proxy/route`, and `packages/provider-proxy`, with explicit blocks for public shared keys and limit-bypass intent.
   - Bootstrap status: OpenAI-compatible Chat Completions, Anthropic Messages, and OpenAI Responses execution is exposed through CLI `provider-chat`, API `POST /provider-proxy/chat`, API `POST /provider-proxy/chat/stream`, `executeProviderProxyChat()`, and `executeProviderProxyChatStream()`, with prompt/secret redaction, raw tool-argument redaction, Anthropic thinking/signature redaction, credentialed endpoint-override blocking, transport-specific token fields, fail-closed `429` handling, managed provider retry-window tracking, and normalized stream metadata.
   - Bootstrap status: provider limit ledgers can be in-process for API runtime or file-backed through `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH`, storing provider ids and retry timestamps without prompts, request bodies, credentials, or repo-root state pollution.
   - Bootstrap status: provider usage ledgers can be file-backed through `DIVINITY_PROVIDER_USAGE_LEDGER_PATH`, storing daily provider/model request and token totals without prompts, request bodies, credentials, response text, raw tool arguments, or repo-root state pollution. `usage_budget` can enforce daily request/input/output/total token caps before upstream calls.
   - Bootstrap status: provider proxy route/chat helpers accept an injected `credential_resolver` for hosted runtimes, exposing only configured secret reference ids in route metadata while using resolver-returned secret values only for upstream transport headers.
   - Bootstrap status: API route, chat, and stream execution create that resolver from `DIVINITY_PROVIDER_SECRET_REFS_PATH`, whose `divinity.provider_secret_refs.v1` manifest stores provider ids, `secret://` references, and environment variable names only.
   - Bootstrap status: API `GET /provider-secrets/readiness` returns redacted `divinity.provider_secret_readiness.v1` metadata, and route/chat/stream operations record redacted `provider_secret_readiness` and `provider_secret_ref` audit records without resolved credential values.
   - Bootstrap status: API `POST /provider-secrets/store` can write AES-256-GCM encrypted local store records with required actor/reason metadata, returning and auditing only redacted `divinity.provider_secret_store_record.v1` metadata.
   - Bootstrap status: provider secret storage is now behind a pluggable adapter boundary; the local AES-256-GCM file store remains the default bootstrap, and hosted operator adapters can be injected while preserving the same redacted route/readiness/write/audit metadata.
   - Bootstrap status: the test-only `hosted_memory` secret-store backend is blocked from runtime configuration unless `DIVINITY_ENABLE_TEST_SECRET_STORE_BACKEND=1` is explicitly set for tests or local harnesses.
   - Bootstrap status: `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=external_command` binds the API to an approved deployment secret manager command through JSON stdin/stdout, absolute executable paths, no shell interpolation, and the same redacted public metadata.
   - Bootstrap status: `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=aws_secrets_manager` adds the first provider-specific managed secret-store adapter through an approved absolute broker command plus a secret id map, while keeping AWS secret ids and resolved values out of public metadata.
   - Bootstrap status: `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=gcp_secret_manager` adds a Google Cloud Secret Manager adapter through the same approved broker-command contract plus a GCP secret id map, while keeping GCP secret ids and resolved values out of public metadata.
   - Bootstrap status: `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=azure_key_vault` adds an Azure Key Vault adapter through the same approved broker-command contract plus an Azure secret id map, while keeping Azure secret ids and resolved values out of public metadata.
   - Bootstrap status: `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=hashicorp_vault` adds a HashiCorp Vault adapter through the same approved broker-command contract plus a Vault secret path map, while keeping Vault paths and resolved values out of public metadata.
   - Bootstrap status: capability discovery and `doctor` now expose redacted provider secret-store backend metadata, including local, managed command, managed cloud, Vault, and test-only backends, while omitting secret values, deployment secret ids, Vault paths, local store paths, and host absolute paths.
   - Next production slice: continue hardening deployment secret-store coverage and public release packaging while preserving the same redacted adapter contract.
2. Toolset governance.
   - Bootstrap status: public toolset metadata and default resolution are exposed through capabilities, CLI `toolsets`, API `/toolsets`, and `doctor`.
   - Bootstrap status: CLI/API task assembly carries toolset resolution metadata on task/run payloads.
   - Bootstrap status: toolset resolution now carries policy permission unions, risk summaries, provider `tool_calls` capability checks, and operator-control recommendations/requirements on task/run payloads.
   - Bootstrap status: provider chat execution enforces selected toolset compatibility before upstream calls and returns `toolset_resolution` metadata on completed or blocked proxy results.
   - Bootstrap status: selected tool schemas are projected into Chat Completions, Anthropic Messages, and OpenAI Responses request bodies so providers can request tool calls while execution remains operator-gated.
   - Bootstrap status: provider-returned tool calls are detected across Chat Completions, Anthropic Messages, and OpenAI Responses, then returned as `requires_action` with redacted `tool_call_requests` and required `tool_call_review` operator controls instead of being executed automatically.
   - Bootstrap status: per-tool-call approve/reject decisions are represented as `divinity.provider_tool_call_approval.v1` records through CLI `provider-tool-approval` and API `GET`/`POST /runs/:id/provider-tool-call-approvals`, with raw arguments still redacted.
   - Bootstrap status: approved provider tool execution is represented as `divinity.provider_tool_execution.v1` records through CLI `provider-tool-execute` and API `GET`/`POST /runs/:id/provider-tool-executions`; adapters support `read_file`, `search_files`, `list_files`, and operator-gated `write_file`, require fresh operator-supplied arguments matching approved keys, redact arguments/output, and record unsupported tools as blocked.
   - Bootstrap status: provider chat continuation accepts approved provider tool execution records through API `provider_tool_executions` or CLI `--tool-execution-file`, appending only redacted execution summaries, optional operator summaries, and safe `read_file`/`search_files`/`list_files`/`write_file` metadata to the next model request.
   - Bootstrap status: dashboard run detail and approval cards render provider/toolset operator controls from `task.toolset_resolution`.
   - Next production slice: add a signed release artifact path after the production warning and package-private gates are cleared.
3. Public onboarding and release packaging.
   - Bootstrap status: public install, quickstart, upgrade, and release checklist docs are linked from the README and guarded by `test:public-docs`.
   - Bootstrap status: package metadata declares the `divinity` CLI bin target, Node engine, pnpm package manager, repository, files allowlist, and package-lock root metadata, guarded by `test:package`.
   - Bootstrap status: `test:package-tarball` packs the release candidate into a local npm tarball, installs it into a temporary consumer project, and verifies the installed `divinity` CLI works outside the source checkout.
   - Bootstrap status: `divinity doctor` now defaults to a runtime-safe profile for installed or linked package use outside the repo root, while `doctor --profile source` preserves contributor diagnostics for repo internals.
   - Bootstrap status: `release:artifacts` generates `dist/release-artifacts.json` with source checkout, local pnpm-link, local package-tarball, package-registry, and binary-download install paths plus release gates, guarded by `test:release-artifacts`.
   - Bootstrap status: `divinity release-status` exposes the same release readiness, install-path, integrity, signing, package-private, and non-production warning metadata without writing files, guarded by `test:release-status`.
   - Bootstrap status: `test:deprecations` guards public docs, release artifact gates, and provider proxy token-field guidance against deprecated install/provider instructions.
   - Bootstrap status: release artifacts now include redacted Git source provenance with commit SHA, branch, tracked-change status, and path redaction guarantees, guarded by `test:release-artifacts` and `test:release-status`.
   - Bootstrap status: release artifacts now include deterministic `divinity.release_sbom.v1` package/dependency inventory from `package.json` and `package-lock.json`, omitting local paths, `node_modules` paths, registry URLs, and lockfile integrity values.
   - Bootstrap status: release artifacts now include sha256 source integrity entries and explicit signing readiness metadata, blocked while the non-production warning and `private: true` gates remain active.
   - Bootstrap status: release signing input readiness is now explicit and redacted through absolute signing command, JSON-array args, key-reference, and identity configuration metadata, without storing those values or unblocking publishing while gates remain active.
   - Bootstrap status: release artifacts now include redacted npm registry publish readiness metadata with provenance publish commands, `NPM_TOKEN` configured state, blockers, and token/path redaction while publishing remains blocked.
   - Bootstrap status: release artifacts now include `divinity.release_binary_readiness.v1` metadata with target filenames, future build/smoke commands, checksum/signing requirements, blockers, and path/signing-secret redaction while signed binary downloads remain blocked.
   - Bootstrap status: `release:binary` now generates `divinity.release_binary_artifacts.v1` local Node launcher artifacts plus `SHA256SUMS`, and `test:binary` smokes the current-platform launcher while public signed native binary downloads remain blocked.
   - Bootstrap status: `release:bundle` now generates a local `divinity.release_candidate_bundle.v1` review bundle with package tarball, release metadata, binary launcher metadata, and bundle checksums, guarded by `test:release-bundle` while public package and signed binary distribution remain blocked.
   - Bootstrap status: release bundles now include `divinity.release_attestation.v1` provenance metadata with subject digests and blocked signing status, so the future signed artifact path has deterministic inputs before release gates are cleared.
   - Bootstrap status: `release:promotion-preflight` now generates `divinity.release_promotion_preflight.v1` with required artifacts, release gates, registry token readiness, signing readiness, and blockers before any package publish or signed binary release can proceed.
   - Next production slice: add actual published package and signed binary artifacts after the production warning and `private: true` release gates are cleared.
4. Hosted/identity/billing boundary.
   - Non-goal for the current bootstrap: hosted identity, billing, and managed secret-store operations are not implemented until local provider/tool/runtime behavior is stable.

## Success Metrics
- Time-to-first-value: < 10 minutes from signup to first completed task.
- Task completion rate: > 75% for defined MVP task set.
- Human override rate at approval gates: < 25% (indicates trust calibration).
- Mean user satisfaction for UX clarity: >= 4.5/5.

## Risks & Mitigation
- **Risk:** Tooling breadth creates complexity.
  - **Mitigation:** Strict phased scope and feature flag rollout.
- **Risk:** Multi-agent unreliability.
  - **Mitigation:** Verifier gate + bounded retries + mandatory human checkpoints.
  - Bootstrap status: verifier records and bounded execution retry metadata are present; retry exhaustion returns a deterministic operator checkpoint instead of looping.
- **Risk:** Cost unpredictability.
  - **Mitigation:** Budget caps, preflight estimates, auto-pause policies.
