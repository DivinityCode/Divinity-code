import assert from 'assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

import {
  loadProviderCatalog,
  providerById,
  providerCredentialReadiness,
  publicLlmProviders,
  resolveProviderRuntime
} from '../packages/provider-runtime/src/index.mjs';

const providers = publicLlmProviders();
const providerIds = providers.map(provider => provider.provider_id);

for (const providerId of [
  'openrouter',
  'anthropic',
  'openai_api',
  'google_gemini',
  'groq',
  'cerebras',
  'mistral',
  'github_models',
  'custom_openai_compatible',
  'custom_anthropic_compatible',
  'custom_openai_responses'
]) {
  assert.ok(providerIds.includes(providerId), `missing provider ${providerId}`);
}
assert.deepEqual(loadProviderCatalog().map(provider => provider.provider_id), providerIds);

for (const provider of providers) {
  assert.equal(provider.format, 'divinity.llm_provider.v1');
  assert.equal(typeof provider.provider_id, 'string');
  assert.equal(typeof provider.display_name, 'string');
  assert.ok(['chat_completions', 'anthropic_messages', 'codex_responses'].includes(provider.transport));
  assert.ok(Array.isArray(provider.auth_modes));
  assert.ok(Array.isArray(provider.credential_env_vars));
  assert.equal(typeof provider.supports_custom_base_url, 'boolean');
  assert.ok(Array.isArray(provider.capabilities));
}

assert.equal(providerById('anthropic').transport, 'anthropic_messages');
assert.equal(providerById('groq').base_url, 'https://api.groq.com/openai/v1');
assert.equal(providerById('missing'), null);

const anthropicRuntime = resolveProviderRuntime({
  provider_id: 'anthropic',
  env: { ANTHROPIC_API_KEY: 'secret-anthropic-key' }
});
assert.equal(anthropicRuntime.format, 'divinity.provider_runtime.v1');
assert.equal(anthropicRuntime.provider_id, 'anthropic');
assert.equal(anthropicRuntime.transport, 'anthropic_messages');
assert.equal(anthropicRuntime.base_url, 'https://api.anthropic.com');
assert.equal(anthropicRuntime.auth.credential_configured, true);
assert.deepEqual(anthropicRuntime.auth.configured_env_vars, ['ANTHROPIC_API_KEY']);
assert.equal(JSON.stringify(anthropicRuntime).includes('secret-anthropic-key'), false);

const customRuntime = resolveProviderRuntime({
  provider_id: 'custom_openai_compatible',
  base_url: 'http://127.0.0.1:11434/v1',
  model: 'llama3.1'
});
assert.equal(customRuntime.transport, 'chat_completions');
assert.equal(customRuntime.base_url, 'http://127.0.0.1:11434/v1');
assert.equal(customRuntime.model, 'llama3.1');
assert.equal(customRuntime.auth.mode, 'none');
assert.equal(customRuntime.auth.credential_required, false);
assert.equal(customRuntime.auth.credential_configured, true);

const customAnthropicRuntime = resolveProviderRuntime({
  provider_id: 'custom_anthropic_compatible',
  base_url: 'http://127.0.0.1:11435',
  model: 'local-claude'
});
assert.equal(customAnthropicRuntime.transport, 'anthropic_messages');
assert.equal(customAnthropicRuntime.base_url, 'http://127.0.0.1:11435');
assert.equal(customAnthropicRuntime.model, 'local-claude');
assert.equal(customAnthropicRuntime.auth.mode, 'none');
assert.equal(customAnthropicRuntime.auth.credential_required, false);
assert.equal(customAnthropicRuntime.auth.credential_configured, true);

const customResponsesRuntime = resolveProviderRuntime({
  provider_id: 'custom_openai_responses',
  base_url: 'http://127.0.0.1:11436/v1',
  model: 'local-responses'
});
assert.equal(customResponsesRuntime.transport, 'codex_responses');
assert.equal(customResponsesRuntime.base_url, 'http://127.0.0.1:11436/v1');
assert.equal(customResponsesRuntime.model, 'local-responses');
assert.equal(customResponsesRuntime.auth.mode, 'none');
assert.equal(customResponsesRuntime.auth.credential_required, false);
assert.equal(customResponsesRuntime.auth.credential_configured, true);

assert.throws(
  () => resolveProviderRuntime({ provider_id: 'missing' }),
  /unknown LLM provider/
);

const readiness = providerCredentialReadiness({
  env: {
    OPENROUTER_API_KEY: 'router-key',
    GROQ_API_KEY: 'groq-key',
    GOOGLE_API_KEY: ''
  }
});
assert.equal(readiness.format, 'divinity.provider_credential_readiness.v1');
assert.equal(readiness.any_configured, true);
assert.ok(readiness.providers.find(provider => provider.provider_id === 'openrouter').credential_configured);
assert.ok(readiness.providers.find(provider => provider.provider_id === 'groq').credential_configured);
assert.equal(readiness.providers.find(provider => provider.provider_id === 'custom_openai_compatible').credential_required, false);
assert.equal(readiness.providers.find(provider => provider.provider_id === 'custom_anthropic_compatible').credential_required, false);
assert.equal(readiness.providers.find(provider => provider.provider_id === 'custom_openai_responses').credential_required, false);

const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'divinity-provider-catalog-'));

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
      },
      {
        provider_id: 'groq',
        display_name: 'Operator Groq Override',
        transport: 'chat_completions',
        base_url: 'https://operator-groq.example.test/v1',
        auth_modes: ['api_key'],
        credential_env_vars: ['OPERATOR_GROQ_API_KEY'],
        supports_custom_base_url: false,
        default_model: 'operator/groq-override',
        capabilities: ['chat', 'tool_calls', 'openai_compatible', 'free_tier_models'],
        source: 'operator_config'
      }
    ]
  }, null, 2));

  const overlayEnv = {
    DIVINITY_PROVIDER_CATALOG_PATH: overlayPath,
    OPERATOR_FREE_TIER_API_KEY: 'operator-secret',
    OPERATOR_GROQ_API_KEY: 'operator-groq-secret'
  };
  const overlayProviders = publicLlmProviders({ env: overlayEnv });
  assert.ok(overlayProviders.some(provider => provider.provider_id === 'operator_free_tier_mock'));
  assert.equal(overlayProviders.filter(provider => provider.provider_id === 'groq').length, 1);
  assert.equal(providerById('operator_free_tier_mock', { env: overlayEnv }).base_url, 'https://example.test/v1');
  assert.equal(providerById('groq', { env: overlayEnv }).base_url, 'https://operator-groq.example.test/v1');

  const overlayRuntime = resolveProviderRuntime({
    provider_id: 'operator_free_tier_mock',
    env: overlayEnv
  });
  assert.equal(overlayRuntime.provider_id, 'operator_free_tier_mock');
  assert.equal(overlayRuntime.base_url, 'https://example.test/v1');
  assert.equal(overlayRuntime.auth.credential_configured, true);
  assert.deepEqual(overlayRuntime.auth.configured_env_vars, ['OPERATOR_FREE_TIER_API_KEY']);
  assert.equal(JSON.stringify(overlayRuntime).includes('operator-secret'), false);

  const groqOverrideRuntime = resolveProviderRuntime({
    provider_id: 'groq',
    env: overlayEnv
  });
  assert.equal(groqOverrideRuntime.base_url, 'https://operator-groq.example.test/v1');
  assert.equal(groqOverrideRuntime.model, 'operator/groq-override');
  assert.deepEqual(groqOverrideRuntime.auth.configured_env_vars, ['OPERATOR_GROQ_API_KEY']);
  assert.equal(JSON.stringify(groqOverrideRuntime).includes('operator-groq-secret'), false);

  const badOverlayPath = path.join(tmpDir, 'providers-bad-overlay.json');
  writeFileSync(badOverlayPath, JSON.stringify({
    format: 'divinity.llm_provider_catalog.v1',
    providers: [
      {
        provider_id: 'shared_key_pool',
        display_name: 'Shared Key Pool',
        transport: 'chat_completions',
        base_url: 'https://example.test/v1',
        auth_modes: ['api_key'],
        credential_env_vars: ['SHARED_KEY_POOL_API_KEY'],
        supports_custom_base_url: false,
        default_model: 'shared/key-pool',
        capabilities: ['chat'],
        source: 'public_shared_key_pool'
      }
    ]
  }, null, 2));

  assert.throws(
    () => loadProviderCatalog({ overlayPath: badOverlayPath }),
    /public shared keys/
  );
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, test: 'provider-runtime' }));
