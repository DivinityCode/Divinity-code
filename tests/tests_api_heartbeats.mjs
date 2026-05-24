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

  const { body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_heartbeat',
      objective: 'Read the repository README',
      repo: 'github.com/org/repo',
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-25T00:00:00Z'
    })
  });

  const { response: heartbeatRes, body: heartbeatPayload } = await requestJson(`${baseUrl}/runs/${run.run_id}/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({
      actor: 'executor@divinity',
      status: 'alive',
      message: 'Processing workspace snapshot.'
    })
  });
  assert.equal(heartbeatRes.status, 200);
  assert.equal(heartbeatPayload.heartbeat.run_id, run.run_id);
  assert.equal(heartbeatPayload.heartbeat.actor, 'executor@divinity');
  assert.equal(heartbeatPayload.heartbeat.status, 'alive');
  assert.equal(heartbeatPayload.run.last_heartbeat_at, heartbeatPayload.heartbeat.recorded_at);
  assert.equal(heartbeatPayload.run.heartbeats.length, 1);

  const { body: storedRun } = await requestJson(`${baseUrl}/runs/${run.run_id}`);
  assert.equal(storedRun.heartbeats.length, 1);
  assert.equal(storedRun.last_heartbeat_at, heartbeatPayload.heartbeat.recorded_at);

  const { body: timeline } = await requestJson(`${baseUrl}/runs/${run.run_id}/events`);
  assert.ok(timeline.events.some(event => (
    event.type === 'heartbeat_recorded'
      && event.metadata.heartbeat_id === heartbeatPayload.heartbeat.heartbeat_id
  )));

  const { body: audit } = await requestJson(`${baseUrl}/audit`);
  assert.ok(audit.records.some(record => (
    record.type === 'heartbeat_record'
      && record.run_id === run.run_id
      && record.payload.heartbeat_id === heartbeatPayload.heartbeat.heartbeat_id
  )));

  const { body: observability } = await requestJson(`${baseUrl}/observability`);
  assert.equal(observability.liveness.heartbeat_count, 1);
  assert.ok(Array.isArray(observability.liveness.stale_run_ids));

  console.log(JSON.stringify({ ok: true, test: 'api-heartbeats' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
