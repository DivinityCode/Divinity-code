# Provider Runtime Package

Data-backed, side-effect-free LLM provider metadata and credential readiness helpers.

## Current Catalog
- OpenRouter through chat-completions-compatible transport.
- Anthropic through Anthropic Messages transport.
- OpenAI API through Codex Responses transport.
- Google Gemini through OpenAI-compatible chat completions.
- Groq, Cerebras, Mistral, and GitHub Models as authorized free-tier candidates discovered from public provider lists.
- Custom OpenAI-compatible endpoints, including local no-key endpoints.

## Scope
- Loads provider metadata from `providers.v1.json` instead of embedding endpoint data in source code.
- Exposes public provider identity, transport, base URL, auth modes, credential environment variable names, default model, and capability labels.
- Resolves runtime readiness without returning secret values.
- Does not call live LLM providers, persist credentials, ingest public shared API keys, bypass signup, rotate keys to evade limits, or manage hosted secrets in this slice.
