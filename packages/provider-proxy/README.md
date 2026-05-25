# Provider Proxy Package

Provider route planning and guarded chat execution for LLM proxy flows.

## Scope
- Selects the first configured, authorized provider candidate from the provider runtime catalog.
- Rotates to another configured candidate when the primary candidate is marked limited.
- Returns route metadata only; it does not call an LLM provider or proxy request bodies.
- Does not return secret values. Route plans include credential environment variable names and configured variable names only.
- Blocks public shared-key candidates and explicit limit-bypass intent.
- Executes OpenAI-compatible `chat_completions` requests through `executeProviderProxyChat()` after route planning succeeds.
- Fails closed for unsupported transports until dedicated handlers are implemented.
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

`executeProviderProxyChat()` supports the first proxy execution path:

- `chat_completions` transport only.
- `POST <base_url>/chat/completions`.
- Request body uses `messages`, `model`, `max_completion_tokens`, and optional `temperature`.
- `max_tokens` is intentionally not used because current OpenAI-compatible chat-completions documentation marks it deprecated in favor of `max_completion_tokens`.
- A live upstream `429` returns `status: "limited"` and does not automatically retry through another provider.
- Prompt and request-body data are sent only to the selected provider endpoint and are not included in the returned result metadata.
- Local `custom_openai_compatible` endpoints can be used without a credential for development and tests. Credentialed catalog providers execute only against their trusted catalog endpoint in this slice.
