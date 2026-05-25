import assert from 'assert/strict';

import { planProviderProxyRoute } from '../packages/provider-proxy/src/index.mjs';

const ready = planProviderProxyRoute({
  candidates: ['openrouter', 'groq'],
  env: {
    OPENROUTER_API_KEY: 'openrouter-secret',
    GROQ_API_KEY: 'groq-secret'
  }
});

assert.equal(ready.format, 'divinity.provider_proxy_route.v1');
assert.equal(ready.status, 'ready');
assert.equal(ready.selected_provider_runtime.provider_id, 'openrouter');
assert.equal(JSON.stringify(ready).includes('openrouter-secret'), false);
assert.equal(JSON.stringify(ready).includes('groq-secret'), false);
assert.equal(ready.policy.allow_public_shared_keys, false);
assert.equal(ready.policy.allow_limit_bypass, false);

const rotated = planProviderProxyRoute({
  candidates: ['openrouter', 'groq'],
  env: {
    OPENROUTER_API_KEY: 'openrouter-secret',
    GROQ_API_KEY: 'groq-secret'
  },
  limit_state: {
    openrouter: { limit_reached: true, retry_after_seconds: 60 }
  }
});

assert.equal(rotated.status, 'ready');
assert.equal(rotated.selected_provider_runtime.provider_id, 'groq');
assert.equal(rotated.rotation_reason, 'provider_limit_reached');

const bypass = planProviderProxyRoute({
  candidates: ['openrouter', 'groq'],
  rotation_intent: 'bypass_limits',
  env: {
    OPENROUTER_API_KEY: 'openrouter-secret',
    GROQ_API_KEY: 'groq-secret'
  }
});

assert.equal(bypass.status, 'blocked');
assert.match(bypass.error, /limit bypass/);

const quotaBypass = planProviderProxyRoute({
  candidates: ['openrouter', 'groq'],
  rotation_intent: 'quota_bypass',
  env: {
    OPENROUTER_API_KEY: 'openrouter-secret',
    GROQ_API_KEY: 'groq-secret'
  }
});

assert.equal(quotaBypass.status, 'blocked');
assert.match(quotaBypass.error, /limit bypass/);

const publicSharedKey = planProviderProxyRoute({
  candidates: [{ provider_id: 'openrouter', source: 'public_shared_key' }],
  env: { OPENROUTER_API_KEY: 'openrouter-secret' }
});

assert.equal(publicSharedKey.status, 'blocked');
assert.match(publicSharedKey.error, /public shared keys/);

const missingCredentials = planProviderProxyRoute({
  candidates: ['groq'],
  env: {}
});

assert.equal(missingCredentials.status, 'blocked');
assert.match(missingCredentials.error, /configured credentials/);

console.log(JSON.stringify({ ok: true, test: 'provider-proxy' }));
