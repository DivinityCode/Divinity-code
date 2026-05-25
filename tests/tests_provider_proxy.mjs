import assert from 'assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

import { createProviderLimitLedger, planProviderProxyRoute } from '../packages/provider-proxy/src/index.mjs';

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

const ledgerNow = new Date('2026-05-25T10:00:00.000Z');
const activeLedger = createProviderLimitLedger({ now: () => ledgerNow });
activeLedger.recordLimit({
  provider_id: 'openrouter',
  retry_after_seconds: 60,
  observed_at: ledgerNow.toISOString()
});

const ledgerRotated = planProviderProxyRoute({
  candidates: ['openrouter', 'groq'],
  env: {
    OPENROUTER_API_KEY: 'openrouter-secret',
    GROQ_API_KEY: 'groq-secret'
  },
  limit_ledger: activeLedger
});

assert.equal(ledgerRotated.status, 'ready');
assert.equal(ledgerRotated.selected_provider_runtime.provider_id, 'groq');
assert.equal(ledgerRotated.rotation_reason, 'provider_limit_reached');
assert.equal(ledgerRotated.candidate_results[0].status, 'limited');
assert.equal(ledgerRotated.candidate_results[0].retry_after_seconds, 60);
assert.equal(JSON.stringify(ledgerRotated).includes('openrouter-secret'), false);
assert.equal(JSON.stringify(ledgerRotated).includes('groq-secret'), false);

const expiredLedger = createProviderLimitLedger({
  initial_state: {
    providers: {
      openrouter: {
        provider_id: 'openrouter',
        observed_at: '2026-05-25T09:00:00.000Z',
        limited_until: '2026-05-25T09:01:00.000Z',
        retry_after_seconds: 60,
        source: 'upstream_429'
      }
    }
  },
  now: () => new Date('2026-05-25T10:00:00.000Z')
});

const expiredReady = planProviderProxyRoute({
  candidates: ['openrouter', 'groq'],
  env: {
    OPENROUTER_API_KEY: 'openrouter-secret',
    GROQ_API_KEY: 'groq-secret'
  },
  limit_ledger: expiredLedger
});

assert.equal(expiredReady.status, 'ready');
assert.equal(expiredReady.selected_provider_runtime.provider_id, 'openrouter');

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

const hostedSecret = 'hosted-openrouter-secret';
const hostedSecretRoute = planProviderProxyRoute({
  candidates: ['openrouter'],
  env: {},
  credential_resolver: {
    configuredSecretRefs(runtime) {
      return runtime.provider_id === 'openrouter'
        ? ['secret://divinity/providers/openrouter/api-key']
        : [];
    },
    resolveCredential(runtime) {
      return runtime.provider_id === 'openrouter' ? hostedSecret : '';
    }
  }
});

assert.equal(hostedSecretRoute.status, 'ready');
assert.equal(hostedSecretRoute.selected_provider_runtime.provider_id, 'openrouter');
assert.deepEqual(hostedSecretRoute.selected_provider_runtime.auth.configured_env_vars, []);
assert.deepEqual(
  hostedSecretRoute.selected_provider_runtime.auth.configured_secret_refs,
  ['secret://divinity/providers/openrouter/api-key']
);
assert.deepEqual(hostedSecretRoute.candidate_results[0].configured_env_vars, []);
assert.deepEqual(
  hostedSecretRoute.candidate_results[0].configured_secret_refs,
  ['secret://divinity/providers/openrouter/api-key']
);
assert.equal(JSON.stringify(hostedSecretRoute).includes(hostedSecret), false);

const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'divinity-provider-proxy-catalog-'));

try {
  const overlayPath = path.join(tmpDir, 'providers-overlay.json');
  writeFileSync(overlayPath, JSON.stringify({
    format: 'divinity.llm_provider_catalog.v1',
    providers: [
      {
        provider_id: 'operator_free_tier_mock',
        display_name: 'Operator Free-Tier Mock',
        transport: 'chat_completions',
        base_url: 'https://example.test/v1',
        auth_modes: ['api_key'],
        credential_env_vars: ['OPERATOR_FREE_TIER_API_KEY'],
        supports_custom_base_url: false,
        default_model: 'operator/free-tier-mock',
        capabilities: ['chat', 'openai_compatible', 'free_tier_models'],
        source: 'operator_config'
      }
    ]
  }, null, 2));

  const overlayRoute = planProviderProxyRoute({
    candidates: ['operator_free_tier_mock'],
    env: {
      DIVINITY_PROVIDER_CATALOG_PATH: overlayPath,
      OPERATOR_FREE_TIER_API_KEY: 'operator-secret'
    }
  });

  assert.equal(overlayRoute.status, 'ready');
  assert.equal(overlayRoute.selected_provider_runtime.provider_id, 'operator_free_tier_mock');
  assert.equal(overlayRoute.selected_provider_runtime.base_url, 'https://example.test/v1');
  assert.equal(overlayRoute.policy.rotation_mode, 'authorized_failover');
  assert.equal(JSON.stringify(overlayRoute).includes('operator-secret'), false);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, test: 'provider-proxy' }));
