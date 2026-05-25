# Provider Secrets Package

Provider secret-reference manifest loader and credential resolver factory for hosted provider proxy runtime wiring.

## Scope
- Reads an optional `DIVINITY_PROVIDER_SECRET_REFS_PATH` manifest.
- Stores provider ids, redacted secret reference ids, and environment variable names only.
- Resolves real credential values from the runtime environment when a matching provider is selected.
- Returns `configured_secret_refs` only when the referenced environment variable is configured.
- Builds `divinity.provider_secret_readiness.v1` metadata for operator checks without exposing secret values.
- Rejects raw credential fields, public shared-key wording, no-signup key pools, and limit-bypass or evasion wording.

## Manifest

```json
{
  "format": "divinity.provider_secret_refs.v1",
  "providers": [
    {
      "provider_id": "openrouter",
      "secret_ref": "secret://divinity/providers/openrouter/api-key",
      "credential_env_var": "OPENROUTER_API_KEY"
    }
  ]
}
```

The manifest is not a secret store. It must not contain credential values, bearer tokens, passwords, shared public keys, scraped no-signup keys, or bypass pools. Actual values stay in the host environment or a managed operator secret store that projects the value into the named environment variable.

## API Runtime Wiring

`apps/api` creates a resolver at process startup and passes it to provider route, chat, and stream execution. Route and chat metadata can include the configured `secret_ref`, but the resolved credential value is used only for upstream provider transport headers and is never returned to clients.

`GET /provider-secrets/readiness` exposes redacted readiness metadata and records `provider_secret_readiness` audit records. Provider route, chat, and stream operations that select a secret ref record `provider_secret_ref` audit records containing operation, provider id, transport, model, credential env var names, and secret refs only. Audit records must not contain the resolved credential value.
