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
- `packages/provider-runtime` loads and validates the local provider catalog at runtime.
- Task payloads may carry `llm_provider`, `provider_runtime`, `toolsets`, and `toolset_resolution` so provider/tool decisions are visible before execution.
- The provider catalog includes authorized free-tier candidates from the research, such as Groq, Cerebras, Mistral, and GitHub Models, but it stores only endpoint metadata and credential environment variable names.
- `packages/provider-proxy` now plans safe provider routes from the trusted catalog and blocks public shared-key sources, missing credentials, unknown providers, and explicit limit-bypass intent.
- CLI `provider-route` and API `POST /provider-proxy/route` expose route-plan metadata only. They do not send prompts, call providers, store credentials, or print secret values.
- A future live proxy should terminate client requests, reuse the provider-proxy policy, enforce per-provider rate limits, redact secrets from logs, and fail closed when no compliant route is available.
- Rotation is acceptable for reliability and cost policy across operator-owned credentials; it is not acceptable for evading limits.

## Next Safe Slice
Extend the provider proxy from route planning to controlled execution:
- accept only provider ids present in the trusted local catalog;
- read credentials from environment or an approved secret store;
- apply per-provider request and token budgets;
- record which provider/model handled each request without logging prompts or secrets by default;
- return clear `429` or policy errors when limits are reached instead of bypassing them.
