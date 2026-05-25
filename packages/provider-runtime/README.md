# Provider Runtime Package

Side-effect-free LLM provider metadata and credential readiness helpers.

## Current Catalog
- OpenRouter through chat-completions-compatible transport.
- Anthropic through Anthropic Messages transport.
- OpenAI API through Codex Responses transport.
- Google Gemini through OpenAI-compatible chat completions.
- Custom OpenAI-compatible endpoints, including local no-key endpoints.

## Scope
- Exposes public provider identity, transport, base URL, auth modes, credential environment variable names, default model, and capability labels.
- Resolves runtime readiness without returning secret values.
- Does not call live LLM providers, persist credentials, or manage hosted secrets in this slice.
