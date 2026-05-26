import assert from 'assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-api-provider-proxy-route-'));
const secretRefsPath = path.join(tmpRoot, 'provider-secret-refs.json');
const secretStorePath = path.join(tmpRoot, 'provider-secret-store.json');
const providerCatalogPath = path.join(tmpRoot, 'provider-catalog.json');
const apiResolverSecret = 'api-route-resolver-secret';
const apiResolverSecretRef = 'secret://divinity/providers/api-secret-ref-mock/api-key';

writeFileSync(secretRefsPath, JSON.stringify({
  format: 'divinity.provider_secret_refs.v1',
  providers: [
    {
      provider_id: 'api_secret_ref_mock',
      secret_ref: apiResolverSecretRef,
      credential_env_var: 'API_SECRET_REF_MOCK_API_KEY'
    }
  ]
}, null, 2));

writeFileSync(providerCatalogPath, JSON.stringify({
  format: 'divinity.llm_provider_catalog.v1',
  providers: [
    {
      provider_id: 'api_secret_ref_mock',
      display_name: 'API Secret Ref Mock',
      transport: 'chat_completions',
      base_url: 'https://api-secret-ref.example.test/v1',
      auth_modes: ['api_key'],
      credential_env_vars: ['UNSET_API_SECRET_REF_MOCK_API_KEY'],
      supports_custom_base_url: false,
      default_model: 'api-secret-ref-model',
      capabilities: ['chat', 'tool_calls', 'openai_compatible'],
      source: 'operator_config'
    }
  ]
}, null, 2));

process.env.DIVINITY_API_AUTOSTART = '0';
process.env.DIVINITY_PROVIDER_SECRET_REFS_PATH = secretRefsPath;
process.env.DIVINITY_PROVIDER_SECRET_STORE_BACKEND = 'hosted_memory';
process.env.DIVINITY_ENABLE_TEST_SECRET_STORE_BACKEND = '1';
process.env.DIVINITY_PROVIDER_SECRET_STORE_PATH = secretStorePath;
process.env.DIVINITY_PROVIDER_SECRET_STORE_KEY = 'api-route-secret-store-key';
process.env.DIVINITY_PROVIDER_CATALOG_PATH = providerCatalogPath;
delete process.env.API_SECRET_REF_MOCK_API_KEY;
process.env.OPENROUTER_API_KEY = 'openrouter-secret';
process.env.GROQ_API_KEY = 'groq-secret';
const { server } = await import('../apps/api/src/server.mjs');

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  return { response, body: await response.json() };
}

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response: writeSecretResponse, body: writeSecretBody } = await requestJson(`${baseUrl}/provider-secrets/store`, {
    method: 'POST',
    body: JSON.stringify({
      provider_id: 'api_secret_ref_mock',
      secret_ref: apiResolverSecretRef,
      credential_env_var: 'API_SECRET_REF_MOCK_API_KEY',
      secret_value: apiResolverSecret,
      actor: 'operator@example.com',
      reason: 'Configure API provider secret store fixture'
    })
  });

  assert.equal(writeSecretResponse.status, 201);
  assert.equal(writeSecretBody.secret.format, 'divinity.provider_secret_store_record.v1');
  assert.equal(writeSecretBody.secret.provider_id, 'api_secret_ref_mock');
  assert.equal(writeSecretBody.secret.secret_ref, apiResolverSecretRef);
  assert.equal(writeSecretBody.secret.store_backend_id, 'hosted_memory');
  assert.equal(writeSecretBody.secret.store_backend_kind, 'hosted_operator');
  assert.equal(writeSecretBody.secret.updated_by, 'operator@example.com');
  assert.equal(writeSecretBody.secret.reason, 'Configure API provider secret store fixture');
  assert.equal(JSON.stringify(writeSecretBody).includes(apiResolverSecret), false);
  assert.equal(existsSync(secretStorePath) && readFileSync(secretStorePath, 'utf8').includes(apiResolverSecret), false);

  const { response: readinessResponse, body: readinessBody } = await requestJson(`${baseUrl}/provider-secrets/readiness`);
  assert.equal(readinessResponse.status, 200);
  assert.equal(readinessBody.readiness.format, 'divinity.provider_secret_readiness.v1');
  assert.equal(readinessBody.readiness.manifest_configured, true);
  assert.equal(readinessBody.readiness.store_configured, true);
  assert.equal(readinessBody.readiness.store_backend_id, 'hosted_memory');
  assert.equal(readinessBody.readiness.store_backend_kind, 'hosted_operator');
  assert.equal(readinessBody.readiness.any_configured, true);
  assert.deepEqual(readinessBody.readiness.providers, [
    {
      provider_id: 'api_secret_ref_mock',
      secret_ref: apiResolverSecretRef,
      credential_env_var: 'API_SECRET_REF_MOCK_API_KEY',
      credential_configured: true,
      credential_source: 'store'
    }
  ]);
  assert.equal(JSON.stringify(readinessBody).includes(apiResolverSecret), false);

  const { response: secretRefResponse, body: secretRefBody } = await requestJson(`${baseUrl}/provider-proxy/route`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: ['api_secret_ref_mock']
    })
  });

  assert.equal(secretRefResponse.status, 200);
  assert.equal(secretRefBody.route.status, 'ready');
  assert.equal(secretRefBody.route.selected_provider_runtime.provider_id, 'api_secret_ref_mock');
  assert.deepEqual(secretRefBody.route.selected_provider_runtime.auth.configured_env_vars, []);
  assert.deepEqual(secretRefBody.route.selected_provider_runtime.auth.configured_secret_refs, [apiResolverSecretRef]);
  assert.deepEqual(secretRefBody.route.candidate_results[0].configured_env_vars, []);
  assert.deepEqual(secretRefBody.route.candidate_results[0].configured_secret_refs, [apiResolverSecretRef]);
  assert.equal(JSON.stringify(secretRefBody).includes(apiResolverSecret), false);

  const { body: audit } = await requestJson(`${baseUrl}/audit`);
  assert.ok(audit.records.some(record => (
    record.type === 'provider_secret_write'
      && record.run_id === 'control_plane'
      && record.payload.format === 'divinity.provider_secret_write_audit.v1'
      && record.payload.provider_id === 'api_secret_ref_mock'
      && record.payload.secret_ref === apiResolverSecretRef
      && record.payload.store_backend_id === 'hosted_memory'
      && record.payload.store_backend_kind === 'hosted_operator'
      && record.payload.updated_by === 'operator@example.com'
      && record.payload.reason === 'Configure API provider secret store fixture'
  )));
  assert.ok(audit.records.some(record => (
    record.type === 'provider_secret_readiness'
      && record.run_id === 'control_plane'
      && record.payload.format === 'divinity.provider_secret_readiness_audit.v1'
      && record.payload.any_configured === true
      && record.payload.providers.some(provider => (
        provider.provider_id === 'api_secret_ref_mock'
          && provider.secret_ref === apiResolverSecretRef
          && provider.credential_configured === true
      ))
  )));
  assert.ok(audit.records.some(record => (
    record.type === 'provider_secret_ref'
      && record.run_id === 'control_plane'
      && record.payload.format === 'divinity.provider_secret_ref_audit.v1'
      && record.payload.operation === 'route'
      && record.payload.provider_id === 'api_secret_ref_mock'
      && record.payload.configured_secret_refs.includes(apiResolverSecretRef)
  )));
  assert.equal(JSON.stringify(audit).includes(apiResolverSecret), false);

  const { response, body } = await requestJson(`${baseUrl}/provider-proxy/route`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: ['openrouter', 'groq'],
      limit_state: {
        openrouter: { limit_reached: true, retry_after_seconds: 60 }
      }
    })
  });

  assert.equal(response.status, 200);
  assert.equal(body.route.format, 'divinity.provider_proxy_route.v1');
  assert.equal(body.route.status, 'ready');
  assert.equal(body.route.selected_provider_runtime.provider_id, 'groq');
  assert.equal(JSON.stringify(body).includes('openrouter-secret'), false);
  assert.equal(JSON.stringify(body).includes('groq-secret'), false);

  const { response: blockedResponse, body: blocked } = await requestJson(`${baseUrl}/provider-proxy/route`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: ['openrouter'],
      rotation_intent: 'bypass_limits'
    })
  });

  assert.equal(blockedResponse.status, 400);
  assert.equal(blocked.route.status, 'blocked');
  assert.match(blocked.route.error, /limit bypass/);

  console.log(JSON.stringify({ ok: true, test: 'api-provider-proxy' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
  rmSync(tmpRoot, { recursive: true, force: true });
}
