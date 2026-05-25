import assert from 'assert/strict';

import {
  publicToolsets,
  resolveToolsets,
  toolsetById
} from '../packages/toolsets/src/index.mjs';

const toolsets = publicToolsets();
const toolsetIds = toolsets.map(toolset => toolset.toolset_id);

assert.deepEqual(toolsetIds, [
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

for (const toolset of toolsets) {
  assert.equal(toolset.format, 'divinity.toolset.v1');
  assert.equal(typeof toolset.toolset_id, 'string');
  assert.equal(typeof toolset.description, 'string');
  assert.ok(Array.isArray(toolset.tools));
  assert.ok(toolset.tools.length > 0);
  assert.equal(typeof toolset.default_enabled, 'boolean');
  assert.ok(['low', 'medium', 'high'].includes(toolset.risk_level));
  assert.ok(Array.isArray(toolset.policy_permissions));
}

assert.equal(toolsetById('web').risk_level, 'low');
assert.equal(toolsetById('missing'), null);

const resolved = resolveToolsets({
  enabled_toolsets: ['web', 'file'],
  disabled_toolsets: ['file']
});
assert.deepEqual(resolved.toolsets.map(toolset => toolset.toolset_id), ['web']);
assert.deepEqual(resolved.tools, ['web_extract', 'web_search']);
assert.deepEqual(resolved.policy_permissions, ['network:read']);
assert.equal(resolved.risk_summary.highest_risk_level, 'low');
assert.deepEqual(resolved.risk_summary.low_risk_toolsets, ['web']);

const defaultResolved = resolveToolsets();
assert.ok(defaultResolved.toolsets.some(toolset => toolset.toolset_id === 'web'));
assert.ok(defaultResolved.tools.includes('read_file'));
assert.equal(defaultResolved.toolsets.some(toolset => toolset.toolset_id === 'terminal'), false);
assert.ok(defaultResolved.policy_permissions.includes('file:read'));
assert.equal(defaultResolved.risk_summary.highest_risk_level, 'high');
assert.ok(defaultResolved.operator_controls.some(control => control.control_id === 'approval_required'));

const missingProviderCapabilities = resolveToolsets({
  enabled_toolsets: ['web'],
  provider_runtime: {
    provider_id: 'cerebras',
    capabilities: ['chat']
  }
});
assert.deepEqual(missingProviderCapabilities.provider_capability_checks, [
  {
    provider_id: 'cerebras',
    capability: 'tool_calls',
    status: 'missing',
    required_by_toolsets: ['web']
  }
]);
assert.ok(
  missingProviderCapabilities.operator_controls.some(control => (
    control.control_id === 'provider_capability_review' &&
    control.status === 'required'
  ))
);

const supportedProviderCapabilities = resolveToolsets({
  enabled_toolsets: ['web'],
  provider_runtime: {
    provider_id: 'openrouter',
    capabilities: ['chat', 'tool_calls']
  }
});
assert.deepEqual(supportedProviderCapabilities.provider_capability_checks, [
  {
    provider_id: 'openrouter',
    capability: 'tool_calls',
    status: 'supported',
    required_by_toolsets: ['web']
  }
]);

assert.throws(
  () => resolveToolsets({ enabled_toolsets: ['unknown'] }),
  /unknown toolset/
);

console.log(JSON.stringify({ ok: true, test: 'toolsets' }));
