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
