import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

async function readSseEvent(reader, timeoutMs = 2000) {
  const decoder = new TextDecoder();
  let buffer = '';
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const read = await Promise.race([
      reader.read(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timed out waiting for SSE event')), 250))
    ]);

    if (read.done) throw new Error('SSE stream ended');
    buffer += decoder.decode(read.value, { stream: true });
    const boundary = buffer.indexOf('\n\n');
    if (boundary === -1) continue;

    const raw = buffer.slice(0, boundary);
    const event = raw.split('\n').find(line => line.startsWith('event: '))?.slice(7);
    const data = raw.split('\n').find(line => line.startsWith('data: '))?.slice(6);
    return { event, data: JSON.parse(data) };
  }

  throw new Error('timed out waiting for SSE event');
}

const highRiskTask = {
  task_id: 'task_stream_approval',
  objective: 'Run a migration shell command',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:00:00Z'
};

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(highRiskTask)
  });

  const stream = await fetch(`${baseUrl}/runs/${run.run_id}/stream`, {
    headers: { accept: 'text/event-stream' }
  });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get('content-type'), /^text\/event-stream/);
  assert.equal(stream.headers.get('access-control-allow-origin'), '*');

  const reader = stream.body.getReader();
  try {
    const snapshot = await readSseEvent(reader);
    assert.equal(snapshot.event, 'run_snapshot');
    assert.equal(snapshot.data.run_id, run.run_id);
    assert.equal(snapshot.data.status, 'awaiting_approval');
    assert.equal(snapshot.data.events.length, 3);

    await requestJson(`${baseUrl}/runs/${run.run_id}/approval`, {
      method: 'POST',
      body: JSON.stringify({
        decision: 'approve',
        actor: 'operator@example.com',
        reason: 'stream test approval'
      })
    });

    const update = await readSseEvent(reader);
    assert.equal(update.event, 'run_updated');
    assert.equal(update.data.run_id, run.run_id);
    assert.equal(update.data.status, 'queued');
    assert.equal(update.data.approval.decision, 'approve');
    assert.equal(update.data.events.at(-1).type, 'status_changed');
  } finally {
    await reader.cancel();
  }

  console.log(JSON.stringify({ ok: true, test: 'api-event-stream' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
