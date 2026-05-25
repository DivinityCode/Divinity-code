# Provider Proxy Package

Provider route planning and guarded chat execution for LLM proxy flows.

## Scope
- Selects the first configured, authorized provider candidate from the provider runtime catalog.
- Rotates to another configured candidate when the primary candidate is marked limited.
- Returns route metadata only; it does not call an LLM provider or proxy request bodies.
- Does not return secret values. Route plans include credential environment variable names and configured variable names only.
- Blocks public shared-key candidates and explicit limit-bypass intent.
- Executes OpenAI-compatible Chat Completions, Anthropic Messages, and OpenAI Responses requests through `executeProviderProxyChat()` after route planning succeeds.
- Fails closed for unsupported future transports until dedicated handlers are implemented.
- Returns response metadata without echoing prompts, request bodies, or credential values.
- Blocks credentialed provider `base_url` overrides during execution so operator-owned API keys are not forwarded to caller-supplied endpoints.

## Policy

`planProviderProxyRoute()` returns `format: "divinity.provider_proxy_route.v1"` with:

- `status: "ready"` and `selected_provider_runtime` when a configured provider is available.
- `status: "blocked"` and `error` when no safe route is available.
- `policy.allow_public_shared_keys: false`
- `policy.allow_limit_bypass: false`
- `policy.rotation_mode: "authorized_failover"`

Rotation is for authorized failover across operator-configured credentials. It is not a mechanism to bypass provider signup, quotas, rate limits, or terms.

## Chat Execution

`executeProviderProxyChat()` supports the non-streaming proxy execution paths:

- `chat_completions`: `POST <base_url>/chat/completions` with `messages`, `model`, `max_completion_tokens`, and optional `temperature`.
- `anthropic_messages`: `POST <base_url>/v1/messages` with `messages`, optional top-level `system`, `model`, `max_tokens`, optional `temperature`, `anthropic-version: 2023-06-01`, and `x-api-key` when credentials are required.
- `codex_responses`: `POST <base_url>/responses` with `input`, optional `instructions`, `model`, `max_output_tokens`, and optional `temperature`.
- OpenAI-compatible Chat Completions does not use deprecated `max_tokens`; OpenAI Responses uses `max_output_tokens`; Anthropic Messages uses its current `max_tokens` field.
- A live upstream `429` returns `status: "limited"` and does not automatically retry through another provider.
- Prompt and request-body data are sent only to the selected provider endpoint and are not included in the returned result metadata.
- Local custom endpoints can be used without a credential for development and tests. Credentialed catalog providers execute only against their trusted catalog endpoint in this slice.

Transport shapes are anchored to current official provider docs:
- OpenAI Responses: https://developers.openai.com/api/reference/responses/create
- OpenAI Chat Completions: https://developers.openai.com/api/reference/chat/create
- Anthropic Messages: https://platform.claude.com/docs/en/build-with-claude/working-with-messages
