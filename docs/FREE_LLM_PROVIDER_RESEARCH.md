# Free LLM Provider Research

_Last refreshed: 2026-05-25_

## Scope
This note reviews user-referenced public lists for lower-cost testing and non-critical offload:

- [`cheahjs/free-llm-api-resources`](https://github.com/cheahjs/free-llm-api-resources)
- [`mnfst/awesome-free-llm-apis`](https://github.com/mnfst/awesome-free-llm-apis)
- [`alistaitsacle/free-llm-api-keys`](https://github.com/alistaitsacle/free-llm-api-keys)

## Product Decision
Divinity can use public lists to discover legitimate free-tier and trial providers, but it must not consume shared public API keys, bypass signup requirements, evade quotas, or rotate credentials to defeat provider limits.

Allowed provider sources:
- Legitimate providers with documented free tiers, trial credits, or local endpoints.
- Operator-owned API keys stored outside repository files.
- Local OpenAI-compatible endpoints that do not require credentials.
- Provider manifests reviewed into the repo or supplied by an operator-controlled local config.

Excluded provider sources:
- Shared public API keys copied from GitHub READMEs or generated pages.
- Reverse-engineered chatbot endpoints.
- Credential pools whose purpose is no-registration access to someone else's budget.
- Proxy or rotation behavior intended to bypass rate limits, quotas, geography restrictions, signup requirements, or terms of service.

## Findings
`cheahjs/free-llm-api-resources` is a curated list of free or trial API providers and explicitly asks users not to abuse services. It also excludes illegitimate services such as reverse-engineered chatbots. This is usable as research input for provider discovery, subject to each provider's terms and signup requirements.

`mnfst/awesome-free-llm-apis` lists providers with permanent free tiers or trial credits and includes API key pages, base URLs, model names, and rate limits. This is usable as research input for provider catalog candidates, but each provider still requires authorized credentials and limit-aware routing.

`alistaitsacle/free-llm-api-keys` publishes shared short-lived API keys and advertises no-registration usage. Divinity must not ingest those keys, scrape the page, proxy them, rotate through them, or recommend them for production or testing. This repository is useful only as a negative control for the provider-source policy.

## Implementation Implications
- Provider endpoints now live in `packages/provider-runtime/providers.v1.json` instead of being embedded in code.
- `packages/provider-runtime` loads and validates the local provider catalog at runtime, and can merge a reviewed operator overlay from `DIVINITY_PROVIDER_CATALOG_PATH` for legitimate free-tier, trial, or local providers that are not yet in the built-in catalog.
- Provider catalog overlays may add metadata and credential environment variable names only. They must not contain shared public keys, scraped credentials, no-registration key pools, or sources whose purpose is bypass, evasion, or circumvention.
- Task payloads may carry `llm_provider`, `provider_runtime`, `toolsets`, and `toolset_resolution` so provider/tool decisions, selected tool schemas, and operator controls are visible before execution.
- The provider catalog includes authorized free-tier candidates from the research, such as Groq, Cerebras, Mistral, and GitHub Models, but it stores only endpoint metadata and credential environment variable names.
- `packages/provider-secrets` and API `DIVINITY_PROVIDER_SECRET_REFS_PATH` now provide a reviewed secret-reference bridge for hosted runtime credentials. The manifest stores only provider ids, `secret://` reference ids, and environment variable names; credential values remain in environment-backed local development variables, the encrypted `DIVINITY_PROVIDER_SECRET_STORE_PATH` bootstrap, an injected hosted operator secret-store adapter, the `external_command` managed secret-store adapter, or the provider-specific `aws_secrets_manager`, `gcp_secret_manager`, and `azure_key_vault` managed adapters. The AWS, GCP, and Azure adapters require operator-owned secret id maps and keep those deployment secret ids out of public responses and audit records. `POST /provider-secrets/store`, `GET /provider-secrets/readiness`, and provider proxy audit records expose backend id/kind plus operator write/readiness/usage evidence without resolved secret values.
- `packages/provider-proxy` now plans safe provider routes from the trusted catalog and blocks public shared-key sources, missing credentials, unknown providers, and explicit limit-bypass intent.
- CLI `provider-route` and API `POST /provider-proxy/route` expose route-plan metadata only. They do not send prompts, call providers, store credentials, or print secret values.
- `executeProviderProxyChat()`, `executeProviderProxyChatStream()`, CLI `provider-chat`, API `POST /provider-proxy/chat`, and API `POST /provider-proxy/chat/stream` now support OpenAI-compatible Chat Completions, Anthropic Messages, and OpenAI Responses execution behind the same route policy. Tests use local mock servers, not external provider calls.
- Provider chat requests project selected `toolset_resolution.tool_schemas` into provider-specific `tools` fields for Chat Completions, Anthropic Messages, and OpenAI Responses. Results include upstream status, selected provider/model, assistant message or accumulated stream text, finish reason, usage metadata, normalized stream event counts, and toolset compatibility metadata while omitting prompts, request bodies, credential values, raw tool arguments, and Anthropic thinking/signature content.
- Provider-returned tool calls from Chat Completions, Anthropic Messages, and OpenAI Responses are detected but not executed automatically. They return `status: "requires_action"`, redacted `tool_call_requests`, and a required `tool_call_review` operator control.
- Provider tool-call approval records now capture per-call approve/reject decisions as `divinity.provider_tool_call_approval.v1` without storing raw tool arguments.
- Provider tool execution records now consume approved calls as `divinity.provider_tool_execution.v1`. Execution requires fresh operator-supplied argument values, supports `read_file`, `search_files`, `list_files`, and operator-gated `write_file` adapters, accepts optional reviewed `operator_summary` text, stores no raw arguments, paths, filenames, directory names, search queries, or file contents, and records unsupported tools as blocked. The `write_file` adapter writes only inside the workspace and blocks traversal plus protected `.git` and `node_modules` targets.
- Provider chat continuation can now accept approved provider tool execution records as redacted continuation context. The next provider call receives only execution ids, tool call ids, tool names, statuses, adapters, output summaries, optional operator summaries, `read_file` byte/line counts, `search_files` scan/match counts, `list_files` file/directory/depth counts, and `write_file` byte/line counts plus redaction flags; raw arguments, file paths, filenames, directory names, search queries, file contents, raw outputs, prompts, and credentials are not forwarded.
- Provider chat execution enforces selected toolset compatibility before upstream calls; chat-only free-tier candidates cannot be used for toolsets that require provider `tool_calls` support.
- Hosted runtimes can inject a provider `credential_resolver`, and the API runtime can create one from `DIVINITY_PROVIDER_SECRET_REFS_PATH`, so route planning can report configured secret reference ids and chat execution can build upstream provider headers without storing or returning secret values. Local CLI use still relies on environment variables.
- Credentialed provider endpoint overrides fail closed during execution so operator-owned secrets are never forwarded to caller-supplied URLs.
- Provider retry windows can now be tracked in a provider limit ledger. API chat execution uses an in-process ledger by default and optional `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH` persistence; CLI route/chat commands use that file-backed ledger only when configured.
- Provider request/token usage can now be tracked in a provider usage ledger when `DIVINITY_PROVIDER_USAGE_LEDGER_PATH` is configured. The ledger stores daily provider/model request and token totals only; `usage_budget` can enforce daily request/input/output/total token caps before upstream calls.
- A live proxy can bind the hosted secret-store adapter boundary to a managed deployment secret service through the `external_command` adapter or the provider-specific `aws_secrets_manager`, `gcp_secret_manager`, and `azure_key_vault` adapters while preserving fail-closed behavior, actor/reason write metadata, and the current redacted readiness/audit surface.
- Rotation is acceptable for reliability and cost policy across operator-owned credentials; it is not acceptable for evading limits.

## Next Safe Slice
Extend controlled execution toward production operations:
- add more provider-specific managed secret-store adapters while keeping the AWS, GCP, and Azure adapters, generic command adapter, environment variables, and the encrypted local file store as deployment/local fallbacks;
- add more approved tool adapters and richer operator-reviewed result handoff without weakening redaction guarantees;
- keep returning clear `429` or policy errors when limits are reached instead of bypassing them.
