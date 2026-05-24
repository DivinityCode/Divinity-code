import assert from 'assert/strict';

import {
  CONNECTOR_ADAPTERS,
  createConnectorReference,
  createConnectorReferences
} from '../packages/connectors/src/index.mjs';

assert.ok(CONNECTOR_ADAPTERS.some(adapter => adapter.adapter === 'ticket_reference'));

const attachedAt = '2026-05-24T12:00:00.000Z';
const reference = createConnectorReference({
  run_id: 'run_connector_reference',
  attached_by: 'operator@divinity',
  attached_at: attachedAt,
  reference: {
    adapter: 'ticket_reference',
    resource_type: 'ticket',
    resource_id: 'DIV-17',
    url: 'https://example.test/tickets/DIV-17',
    title: 'Investigate connector context',
    metadata: { priority: 'high' }
  }
});

assert.equal(reference.format, 'divinity.connector_reference.v1');
assert.match(reference.reference_id, /^ref_[a-f0-9]{16}$/);
assert.equal(reference.run_id, 'run_connector_reference');
assert.equal(reference.adapter, 'ticket_reference');
assert.equal(reference.resource_type, 'ticket');
assert.equal(reference.resource_id, 'DIV-17');
assert.equal(reference.url, 'https://example.test/tickets/DIV-17');
assert.equal(reference.title, 'Investigate connector context');
assert.deepEqual(reference.metadata, { priority: 'high' });
assert.equal(reference.attached_by, 'operator@divinity');
assert.equal(reference.attached_at, attachedAt);

const references = createConnectorReferences({
  run_id: 'run_connector_reference',
  references: [
    { adapter: 'docs_reference', resource_type: 'document', resource_id: 'SPEC-1' },
    { adapter: 'ci_status', resource_type: 'ci_run', resource_id: 'CI-100' }
  ],
  attached_at: attachedAt
});
assert.deepEqual(references.map(item => item.adapter), ['docs_reference', 'ci_status']);

assert.throws(() => createConnectorReference({
  run_id: 'run_connector_reference',
  reference: { adapter: 'unknown_connector', resource_type: 'ticket', resource_id: 'DIV-17' }
}), /unknown connector adapter/);

assert.throws(() => createConnectorReference({
  run_id: 'run_connector_reference',
  reference: { adapter: 'ticket_reference', resource_type: 'deployment', resource_id: 'DIV-17' }
}), /resource_type/);

assert.throws(() => createConnectorReference({
  run_id: 'run_connector_reference',
  reference: { adapter: 'ticket_reference', resource_type: 'ticket', resource_id: '' }
}), /resource_id/);

console.log(JSON.stringify({ ok: true, test: 'connector-references' }));
