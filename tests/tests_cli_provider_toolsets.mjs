import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

function runCli(args, env = {}) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, ...env }
    }
  );
  return JSON.parse(output);
}

const providers = runCli(['providers']);
assert.equal(providers.ok, true);
assert.equal(providers.command, 'providers');
assert.ok(providers.llm_providers.some(provider => provider.provider_id === 'openrouter'));
assert.ok(providers.llm_providers.some(provider => provider.transport === 'anthropic_messages'));

const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'divinity-cli-provider-catalog-'));

try {
  const overlayPath = path.join(tmpDir, 'providers-overlay.json');
  writeFileSync(overlayPath, JSON.stringify({
    format: 'divinity.llm_provider_catalog.v1',
    providers: [
      {
        provider_id: 'operator_free_tier_cli',
        display_name: 'Operator Free-Tier CLI',
        transport: 'chat_completions',
        base_url: 'https://cli.example.test/v1',
        auth_modes: ['api_key'],
        credential_env_vars: ['OPERATOR_FREE_TIER_CLI_API_KEY'],
        supports_custom_base_url: false,
        default_model: 'operator/free-tier-cli',
        capabilities: ['chat', 'openai_compatible', 'free_tier_models'],
        source: 'operator_config'
      }
    ]
  }, null, 2));

  const overlayProviders = runCli(['providers'], { DIVINITY_PROVIDER_CATALOG_PATH: overlayPath });
  assert.ok(overlayProviders.llm_providers.some(provider => provider.provider_id === 'operator_free_tier_cli'));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

const toolsets = runCli(['toolsets']);
assert.equal(toolsets.ok, true);
assert.equal(toolsets.command, 'toolsets');
assert.ok(toolsets.toolsets.some(toolset => toolset.toolset_id === 'web'));
assert.ok(toolsets.toolsets.some(toolset => toolset.toolset_id === 'approvals'));
assert.ok(toolsets.resolution.tools.includes('web_search'));

console.log(JSON.stringify({ ok: true, test: 'cli-provider-toolsets' }));
