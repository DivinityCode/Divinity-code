# Provider Proxy Package

Provider route planning and guarded chat execution for LLM proxy flows.

## Scope
- Selects the first configured, authorized provider candidate from the provider runtime catalog.
- Rotates to another configured candidate when the primary candidate is marked limited by caller state or by the managed provider limit ledger.
- Returns route metadata only; it does not call an LLM provider or proxy request bodies.
- Does not return secret values. Route plans include credential environment variable names and configured variable names only.
- Blocks public shared-key candidates and explicit limit-bypass intent.
- Executes OpenAI-compatible Chat Completions, Anthropic Messages, and OpenAI Responses requests through `executeProviderProxyChat()` or `executeProviderProxyChatStream()` after route planning succeeds.
- Fails closed for unsupported future transports until dedicated handlers are implemented.
- Returns response metadata without echoing prompts, request bodies, credential values, raw tool arguments, or Anthropic thinking/signature content.
- Blocks credentialed provider `base_url` overrides during execution so operator-owned API keys are not forwarded to caller-supplied endpoints.
- Provides `createProviderLimitLedger()` and `createConfiguredProviderLimitLedger()` for storing provider retry windows without prompts, request bodies, credentials, or provider response bodies.

## Policy

`planProviderProxyRoute()` returns `format: "divinity.provider_proxy_route.v1"` with:

- `status: "ready"` and `selected_provider_runtime` when a configured provider is available.
- `status: "blocked"` and `error` when no safe route is available.
- `policy.allow_public_shared_keys: false`
- `policy.allow_limit_bypass: false`
- `policy.rotation_mode: "authorized_failover"`

Rotation is for authorized failover across operator-configured credentials. It is not a mechanism to bypass provider signup, quotas, rate limits, or terms.

## Provider Limit Ledger

`createProviderLimitLedger()` stores active provider retry windows as `format: "divinity.provider_limit_ledger.v1"`. Each provider entry contains only:

- `provider_id`
- `observed_at`
- `limited_until`
- `retry_after_seconds`
- `source`

`planProviderProxyRoute()` merges active ledger entries with caller-supplied `limit_state`. Expired entries do not block routing. `executeProviderProxyChat()` and `executeProviderProxyChatStream()` record upstream `429` responses when a ledger is supplied and return a redacted `limit_ledger_record` in the limited result.

`createConfiguredProviderLimitLedger(process.env)` uses `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH` for optional file-backed persistence. The API uses an in-process ledger by default and can persist it when the env var is set. The CLI only uses the file-backed ledger when the env var is set, so ordinary commands do not create repo-root state files.

## Chat Execution

`executeProviderProxyChat()` supports the non-streaming proxy execution paths:

- `chat_completions`: `POST <base_url>/chat/completions` with `messages`, `model`, `max_completion_tokens`, and optional `temperature`.
- `anthropic_messages`: `POST <base_url>/v1/messages` with `messages`, optional top-level `system`, `model`, `max_tokens`, optional `temperature`, `anthropic-version: 2023-06-01`, and `x-api-key` when credentials are required.
- `codex_responses`: `POST <base_url>/responses` with `input`, optional `instructions`, `model`, `max_output_tokens`, and optional `temperature`.
- Selected `toolset_resolution.tool_schemas` are projected into provider-specific `tools` request fields: Chat Completions uses nested function tools, Anthropic Messages uses `input_schema`, and OpenAI Responses uses top-level function tools with `parameters`.
- OpenAI-compatible Chat Completions does not use deprecated `max_tokens`; OpenAI Responses uses `max_output_tokens`; Anthropic Messages uses its current `max_tokens` field.
- A live upstream `429` returns `status: "limited"`, records a provider retry window when a ledger is supplied, and does not automatically retry through another provider in the same request.
- Provider-returned tool calls are detected but not executed automatically by the proxy. Chat Completions `message.tool_calls`, Anthropic Messages `tool_use` content blocks, and OpenAI Responses `function_call` output items return `status: "requires_action"`, redacted `tool_call_requests`, and a required `tool_call_review` operator control. Approved execution is handled downstream by provider tool-call approval and execution records.
- Prompt and request-body data are sent only to the selected provider endpoint and are not included in the returned result metadata.
- Local custom endpoints can be used without a credential for development and tests. Credentialed catalog providers execute only against their trusted catalog endpoint in this slice.

`executeProviderProxyChatStream()` uses the same route, credential, endpoint override, toolset compatibility, selected tool schema projection, prompt budget, output budget, and limit-ledger checks as non-streaming chat execution, then sets `stream: true` on the upstream request. It returns `format: "divinity.provider_proxy_stream_result.v1"` with accumulated `output_text`, redacted `stream_events`, `event_counts`, usage when available, and the same redacted tool-call governance metadata.

Streaming normalizes provider SSE events instead of forwarding raw provider events:

- Chat Completions `choices[].delta.content` becomes `text_delta`; streamed `delta.tool_calls` become redacted `tool_call_delta` metadata.
- Anthropic `content_block_delta` text becomes `text_delta`; `input_json_delta` becomes redacted tool metadata; `thinking_delta` and `signature_delta` are counted as `redacted_reasoning_delta` without exposing their content.
- OpenAI Responses `response.output_text.delta` becomes `text_delta`; `response.output_item.added` and function-call argument events become redacted tool metadata.
- Unknown SSE events are ignored. `[DONE]` terminators are not returned.

Transport shapes are anchored to current official provider docs:
- OpenAI Responses: https://developers.openai.com/api/docs/guides/function-calling
- OpenAI Chat Completions: https://api.openai.com/v1/chat/completions
- Anthropic tool definitions: https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
- OpenAI Responses streaming events: https://developers.openai.com/api/reference/resources/responses/streaming-events
- Anthropic Messages streaming: https://platform.claude.com/docs/en/api/messages-streaming
