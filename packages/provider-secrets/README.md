# Provider Secrets Package

Provider secret-reference manifest loader and credential resolver factory for hosted provider proxy runtime wiring.

## Scope
- Reads an optional `DIVINITY_PROVIDER_SECRET_REFS_PATH` manifest.
- Stores provider ids, redacted secret reference ids, and environment variable names only.
- Resolves real credential values from the encrypted local store first, then from the runtime environment when a matching provider is selected.
- Resolves real credential values from an injected hosted operator secret-store adapter before falling back to environment variables.
- Writes encrypted local store records when `DIVINITY_PROVIDER_SECRET_STORE_PATH` and `DIVINITY_PROVIDER_SECRET_STORE_KEY` are configured.
- Returns `configured_secret_refs` only when the referenced store record or environment variable is configured.
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

## Store Bootstrap

`DIVINITY_PROVIDER_SECRET_STORE_PATH` and `DIVINITY_PROVIDER_SECRET_STORE_KEY` enable a local encrypted store bootstrap for API-hosted evaluation. Records are encrypted with AES-256-GCM using a key derived from the configured store key. Public store responses expose only provider id, secret ref, credential env var name, algorithm, timestamp, actor, and reason. The store file must not contain plaintext provider credentials.

The API write path requires an `actor` and `reason` so operator-owned credential changes have identity-aware metadata before a managed hosted secret store exists.

## Store Adapters

Secret storage uses an adapter boundary. The default adapter is `local_file`, backed by `DIVINITY_PROVIDER_SECRET_STORE_PATH` and `DIVINITY_PROVIDER_SECRET_STORE_KEY`. Hosted deployments can inject a hosted operator adapter into `storeProviderSecret()`, `providerSecretReadiness()`, and `createProviderCredentialResolver()` while preserving the same redacted response and audit shapes.

`DIVINITY_PROVIDER_SECRET_STORE_BACKEND=hosted_memory` selects an in-memory hosted-style adapter only when `DIVINITY_ENABLE_TEST_SECRET_STORE_BACKEND=1` is also set. This path is for tests and local runtime harnesses only; it is not a production secret manager. Production deployments should inject an approved managed secret-store adapter and keep the manifest as an allowlist of provider ids, secret refs, and credential environment variable names.

Readiness and write responses include `store_backend_id` and `store_backend_kind` so operators can tell which backend is active. They never include the resolved credential value.

## API Runtime Wiring

`apps/api` creates a resolver at process startup and passes it to provider route, chat, and stream execution. Route and chat metadata can include the configured `secret_ref`, but the resolved credential value is used only for upstream provider transport headers and is never returned to clients.

`POST /provider-secrets/store` stores encrypted credentials and records redacted `provider_secret_write` audit records. `GET /provider-secrets/readiness` exposes redacted readiness metadata and records `provider_secret_readiness` audit records. Provider route, chat, and stream operations that select a secret ref record `provider_secret_ref` audit records containing operation, provider id, transport, model, credential env var names, and secret refs only. Audit records must not contain the resolved credential value.
