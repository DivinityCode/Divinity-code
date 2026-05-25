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
- Merges an optional operator-controlled catalog overlay from `DIVINITY_PROVIDER_CATALOG_PATH`.
- Exposes public provider identity, transport, base URL, auth modes, credential environment variable names, default model, and capability labels.
- Resolves runtime readiness without returning secret values.
- Rejects provider sources that advertise public shared keys, bypass, evasion, or circumvention.
- Does not call live LLM providers, persist credentials, ingest public shared API keys, bypass signup, rotate keys to evade limits, or manage hosted secrets in this slice.

## Operator Catalog Overlays
Set `DIVINITY_PROVIDER_CATALOG_PATH` to a reviewed JSON manifest when testing an authorized free-tier, trial, or local provider that is not in the built-in catalog. The manifest uses the same shape as `providers.v1.json` and stores only metadata and credential environment variable names.

```json
{
  "format": "divinity.llm_provider_catalog.v1",
  "providers": [
    {
      "provider_id": "operator_free_tier",
      "display_name": "Operator Free-Tier Provider",
      "transport": "chat_completions",
      "base_url": "https://provider.example/v1",
      "auth_modes": ["api_key"],
      "credential_env_vars": ["OPERATOR_FREE_TIER_API_KEY"],
      "supports_custom_base_url": false,
      "default_model": "provider/free-model",
      "capabilities": ["chat", "openai_compatible", "free_tier_models"],
      "source": "operator_config"
    }
  ]
}
```

Overlay entries can add new provider ids or replace built-in ids after validation. API keys remain outside the manifest and must be supplied through the named environment variables or a future approved secret store.
