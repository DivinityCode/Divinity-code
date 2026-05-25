# Provider Proxy Package

Pure provider route planning for future LLM proxy execution.

## Scope
- Selects the first configured, authorized provider candidate from the provider runtime catalog.
- Rotates to another configured candidate when the primary candidate is marked limited.
- Returns route metadata only; it does not call an LLM provider or proxy request bodies.
- Does not return secret values. Route plans include credential environment variable names and configured variable names only.
- Blocks public shared-key candidates and explicit limit-bypass intent.

## Policy

`planProviderProxyRoute()` returns `format: "divinity.provider_proxy_route.v1"` with:

- `status: "ready"` and `selected_provider_runtime` when a configured provider is available.
- `status: "blocked"` and `error` when no safe route is available.
- `policy.allow_public_shared_keys: false`
- `policy.allow_limit_bypass: false`
- `policy.rotation_mode: "authorized_failover"`

Rotation is for authorized failover across operator-configured credentials. It is not a mechanism to bypass provider signup, quotas, rate limits, or terms.
