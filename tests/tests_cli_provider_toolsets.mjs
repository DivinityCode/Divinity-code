import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import path from 'path';

function runCli(...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
  return JSON.parse(output);
}

const providers = runCli('providers');
assert.equal(providers.ok, true);
assert.equal(providers.command, 'providers');
assert.ok(providers.llm_providers.some(provider => provider.provider_id === 'openrouter'));
assert.ok(providers.llm_providers.some(provider => provider.transport === 'anthropic_messages'));

const toolsets = runCli('toolsets');
assert.equal(toolsets.ok, true);
assert.equal(toolsets.command, 'toolsets');
assert.ok(toolsets.toolsets.some(toolset => toolset.toolset_id === 'web'));
assert.ok(toolsets.toolsets.some(toolset => toolset.toolset_id === 'approvals'));
assert.ok(toolsets.resolution.tools.includes('web_search'));

console.log(JSON.stringify({ ok: true, test: 'cli-provider-toolsets' }));
