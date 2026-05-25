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
   - Bootstrap status: CLI/API task assembly resolves provider runtime metadata from config or request input without printing or storing secret values.
   - Bootstrap status: provider route planning is exposed through CLI `provider-route`, API `POST /provider-proxy/route`, and `packages/provider-proxy`, with explicit blocks for public shared keys and limit-bypass intent.
   - Bootstrap status: non-streaming OpenAI-compatible Chat Completions, Anthropic Messages, and OpenAI Responses execution is exposed through CLI `provider-chat`, API `POST /provider-proxy/chat`, and `executeProviderProxyChat()`, with prompt/secret redaction, raw tool-argument redaction, credentialed endpoint-override blocking, transport-specific token fields, and fail-closed `429` handling.
   - Next production slice: add managed rate-limit storage, streaming, approved hosted secret integration, and approved tool execution loops behind the same route policy.
2. Toolset governance.
   - Bootstrap status: public toolset metadata and default resolution are exposed through capabilities, CLI `toolsets`, API `/toolsets`, and `doctor`.
   - Bootstrap status: CLI/API task assembly carries toolset resolution metadata on task/run payloads.
   - Bootstrap status: toolset resolution now carries policy permission unions, risk summaries, provider `tool_calls` capability checks, and operator-control recommendations/requirements on task/run payloads.
   - Bootstrap status: provider chat execution enforces selected toolset compatibility before upstream calls and returns `toolset_resolution` metadata on completed or blocked proxy results.
   - Bootstrap status: provider-returned tool calls are detected across Chat Completions, Anthropic Messages, and OpenAI Responses, then returned as `requires_action` with redacted `tool_call_requests` and required `tool_call_review` operator controls instead of being executed automatically.
   - Bootstrap status: dashboard run detail and approval cards render provider/toolset operator controls from `task.toolset_resolution`.
   - Next production slice: add approval recording and approved live tool execution loops.
3. Public onboarding and release packaging.
   - Next production slice: add install/upgrade docs, release artifacts, environment bootstrap checks, and a first-run quickstart that does not require repo internals.
4. Hosted/identity/billing boundary.
   - Non-goal for the current bootstrap: hosted identity, billing, and managed secrets are not implemented until local provider/tool/runtime behavior is stable.

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
