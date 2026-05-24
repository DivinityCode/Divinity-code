import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  const body = await response.json();
  return { response, body };
}

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response: createRes, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_connectors',
      objective: 'Read the repository README',
      repo: 'github.com/org/repo',
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-24T00:00:00Z'
    })
  });
  assert.equal(createRes.status, 201);
  assert.deepEqual(run.connector_references, []);

  const { response: attachRes, body: attachPayload } = await requestJson(`${baseUrl}/runs/${run.run_id}/connectors`, {
    method: 'POST',
    body: JSON.stringify({
      adapter: 'ticket_reference',
      resource_type: 'ticket',
      resource_id: 'DIV-42',
      url: 'https://example.test/tickets/DIV-42',
      title: 'Connector references API test',
      metadata: { priority: 'medium' },
      attached_by: 'operator@divinity'
    })
  });
  assert.equal(attachRes.status, 201);
  assert.equal(attachPayload.connector_reference.format, 'divinity.connector_reference.v1');
  assert.equal(attachPayload.connector_reference.run_id, run.run_id);
  assert.equal(attachPayload.connector_reference.adapter, 'ticket_reference');
  assert.equal(attachPayload.connector_reference.resource_id, 'DIV-42');
  assert.equal(attachPayload.connector_reference.attached_by, 'operator@divinity');
  assert.equal(attachPayload.run.connector_references.length, 1);

  const { response: listRes, body: listPayload } = await requestJson(`${baseUrl}/runs/${run.run_id}/connectors`);
  assert.equal(listRes.status, 200);
  assert.deepEqual(listPayload.connector_references.map(reference => reference.reference_id), [
    attachPayload.connector_reference.reference_id
  ]);

  const { body: timeline } = await requestJson(`${baseUrl}/runs/${run.run_id}/events`);
  assert.ok(timeline.events.some(event => (
    event.type === 'connector_reference_attached'
      && event.metadata.reference_id === attachPayload.connector_reference.reference_id
  )));

  const { body: audit } = await requestJson(`${baseUrl}/audit`);
  assert.ok(audit.records.some(record => (
    record.type === 'connector_reference'
      && record.run_id === run.run_id
      && record.payload.reference_id === attachPayload.connector_reference.reference_id
  )));

  const { response: badAdapterRes, body: badAdapter } = await requestJson(`${baseUrl}/runs/${run.run_id}/connectors`, {
    method: 'POST',
    body: JSON.stringify({
      adapter: 'unknown_connector',
      resource_type: 'ticket',
      resource_id: 'DIV-43'
    })
  });
  assert.equal(badAdapterRes.status, 400);
  assert.match(badAdapter.error, /unknown connector adapter/);

  console.log(JSON.stringify({ ok: true, test: 'api-connectors' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
