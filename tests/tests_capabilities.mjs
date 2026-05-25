import assert from 'assert/strict';

import { createCapabilitiesCatalog } from '../packages/capabilities/src/index.mjs';

const catalog = createCapabilitiesCatalog({ generated_at: '2026-05-24T00:00:00.000Z' });

assert.equal(catalog.format, 'divinity.capabilities.v1');
assert.equal(catalog.generated_at, '2026-05-24T00:00:00.000Z');

assert.deepEqual(catalog.policies.map(policy => policy.policy_id), [
  'read_only',
  'scoped_edit',
  'safe_exec',
  'full_exec'
]);
assert.ok(catalog.policies.every(policy => Array.isArray(policy.permissions)));
assert.ok(catalog.policies.every(policy => typeof policy.approval_threshold === 'string'));

assert.deepEqual(catalog.execution_adapters.map(adapter => adapter.adapter), [
  'file_read',
  'git_status',
  'node_test',
  'package_script',
  'manual'
]);
assert.ok(catalog.execution_adapters.every(adapter => adapter.description));
assert.ok(catalog.execution_adapters.every(adapter => Array.isArray(adapter.action_types)));
assert.equal(catalog.execution_adapters.find(adapter => adapter.adapter === 'package_script').shell_interpolation, false);

assert.deepEqual(catalog.runtime_adapters.map(adapter => adapter.adapter), [
  'divinity_local',
  'claude_local',
  'codex_local',
  'generic_process'
]);
assert.ok(catalog.runtime_adapters.every(adapter => adapter.description));
assert.ok(catalog.runtime_adapters.every(adapter => ['local', 'external'].includes(adapter.kind)));
assert.ok(catalog.runtime_adapters.every(adapter => typeof adapter.requires_auth === 'boolean'));
assert.ok(catalog.runtime_adapters.every(adapter => Array.isArray(adapter.capabilities)));
assert.ok(catalog.runtime_adapters.find(adapter => adapter.adapter === 'divinity_local').capabilities.includes('json_output'));
assert.ok(catalog.runtime_adapters.find(adapter => adapter.adapter === 'claude_local').capabilities.includes('resumable_session'));
assert.ok(catalog.runtime_adapters.find(adapter => adapter.adapter === 'codex_local').capabilities.includes('structured_events'));

assert.deepEqual(catalog.llm_providers.map(provider => provider.provider_id), [
  'openrouter',
  'anthropic',
  'openai_api',
  'google_gemini',
  'custom_openai_compatible'
]);
assert.ok(catalog.llm_providers.every(provider => provider.format === 'divinity.llm_provider.v1'));
assert.ok(catalog.llm_providers.every(provider => provider.transport));
assert.ok(catalog.llm_providers.every(provider => Array.isArray(provider.credential_env_vars)));

assert.deepEqual(catalog.toolsets.map(toolset => toolset.toolset_id), [
  'web',
  'file',
  'terminal',
  'code_execution',
  'browser',
  'memory',
  'delegation',
  'connectors',
  'approvals'
]);
assert.ok(catalog.toolsets.every(toolset => toolset.format === 'divinity.toolset.v1'));
assert.ok(catalog.toolsets.every(toolset => Array.isArray(toolset.tools)));

assert.deepEqual(catalog.runner_isolation_profiles.map(profile => profile.profile_id), [
  'workspace_snapshot',
  'container_sandbox'
]);
assert.equal(catalog.runner_isolation_profiles.find(profile => profile.profile_id === 'workspace_snapshot').requires_runtime, false);
assert.equal(catalog.runner_isolation_profiles.find(profile => profile.profile_id === 'container_sandbox').runtime, 'docker');
assert.equal(catalog.runner_isolation_profiles.find(profile => profile.profile_id === 'container_sandbox').network, 'none');

assert.deepEqual(catalog.connector_adapters.map(adapter => adapter.adapter), [
  'ticket_reference',
  'docs_reference',
  'ci_status'
]);
assert.ok(catalog.connector_adapters.every(adapter => adapter.description));
assert.ok(catalog.connector_adapters.every(adapter => Array.isArray(adapter.resource_types)));
assert.ok(catalog.connector_adapters.every(adapter => Array.isArray(adapter.auth_modes)));
assert.ok(catalog.connector_adapters.every(adapter => typeof adapter.write_capable === 'boolean'));

assert.ok(catalog.starter_recipes.length >= 4);
assert.equal(new Set(catalog.starter_recipes.map(recipe => recipe.recipe_id)).size, catalog.starter_recipes.length);
assert.ok(catalog.starter_recipes.every(recipe => recipe.policy_id));

console.log(JSON.stringify({ ok: true, test: 'capabilities' }));
