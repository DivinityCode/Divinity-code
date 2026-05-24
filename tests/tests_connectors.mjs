import assert from 'assert/strict';

import { CONNECTOR_ADAPTERS, publicConnectorAdapters } from '../packages/connectors/src/index.mjs';

assert.deepEqual(CONNECTOR_ADAPTERS.map(adapter => adapter.adapter), [
  'ticket_reference',
  'docs_reference',
  'ci_status'
]);

for (const adapter of publicConnectorAdapters()) {
  assert.equal(typeof adapter.description, 'string');
  assert.ok(adapter.description.length > 0);
  assert.ok(Array.isArray(adapter.resource_types));
  assert.ok(adapter.resource_types.length > 0);
  assert.ok(Array.isArray(adapter.auth_modes));
  assert.ok(adapter.auth_modes.length > 0);
  assert.equal(typeof adapter.write_capable, 'boolean');
}

const publicCopy = publicConnectorAdapters();
publicCopy[0].resource_types.push('mutated');
assert.equal(CONNECTOR_ADAPTERS[0].resource_types.includes('mutated'), false);

console.log(JSON.stringify({ ok: true, test: 'connectors' }));
