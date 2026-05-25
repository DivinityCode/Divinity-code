import assert from 'assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

process.env.DIVINITY_API_AUTOSTART = '0';
const previousCatalogPath = process.env.DIVINITY_PROVIDER_CATALOG_PATH;
const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'divinity-api-provider-catalog-'));
const overlayPath = path.join(tmpDir, 'providers-overlay.json');
writeFileSync(overlayPath, JSON.stringify({
  format: 'divinity.llm_provider_catalog.v1',
  providers: [
    {
      provider_id: 'operator_free_tier_api',
      display_name: 'Operator Free-Tier API',
      transport: 'chat_completions',
      base_url: 'https://api.example.test/v1',
      auth_modes: ['api_key'],
      credential_env_vars: ['OPERATOR_FREE_TIER_API_KEY'],
      supports_custom_base_url: false,
      default_model: 'operator/free-tier-api',
      capabilities: ['chat', 'openai_compatible', 'free_tier_models'],
      source: 'operator_config'
    }
  ]
}, null, 2));
process.env.DIVINITY_PROVIDER_CATALOG_PATH = overlayPath;

const { server } = await import('../apps/api/src/server.mjs');

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const providersResponse = await fetch(`${baseUrl}/providers`);
  assert.equal(providersResponse.status, 200);
  const providers = await providersResponse.json();
  assert.ok(providers.llm_providers.some(provider => provider.provider_id === 'openai_api'));
  assert.ok(providers.llm_providers.some(provider => provider.provider_id === 'operator_free_tier_api'));
  assert.ok(providers.llm_providers.every(provider => provider.format === 'divinity.llm_provider.v1'));

  const toolsetsResponse = await fetch(`${baseUrl}/toolsets`);
  assert.equal(toolsetsResponse.status, 200);
  const toolsets = await toolsetsResponse.json();
  assert.ok(toolsets.toolsets.some(toolset => toolset.toolset_id === 'code_execution'));
  assert.ok(toolsets.resolution.tools.includes('read_file'));

  console.log(JSON.stringify({ ok: true, test: 'api-provider-toolsets' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
  if (previousCatalogPath === undefined) {
    delete process.env.DIVINITY_PROVIDER_CATALOG_PATH;
  } else {
    process.env.DIVINITY_PROVIDER_CATALOG_PATH = previousCatalogPath;
  }
  rmSync(tmpDir, { recursive: true, force: true });
}
