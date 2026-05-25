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

const defaultResolved = resolveToolsets();
assert.ok(defaultResolved.toolsets.some(toolset => toolset.toolset_id === 'web'));
assert.ok(defaultResolved.tools.includes('read_file'));
assert.equal(defaultResolved.toolsets.some(toolset => toolset.toolset_id === 'terminal'), false);

assert.throws(
  () => resolveToolsets({ enabled_toolsets: ['unknown'] }),
  /unknown toolset/
);

console.log(JSON.stringify({ ok: true, test: 'toolsets' }));
