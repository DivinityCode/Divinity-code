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

const task = {
  task_id: 'task_api_budget_incident',
  objective: 'Update source files',
  repo: 'github.com/org/repo',
  scope: { org_id: 'acme', project_id: 'platform' },
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 0.1, hard_limit_usd: 0.1 },
  created_at: '2026-05-24T00:00:00Z'
};

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response: createRes, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task)
  });
  assert.equal(createRes.status, 201);
  assert.equal(run.status, 'paused');
  assert.deepEqual(run.budget_incidents.map(incident => incident.threshold), ['soft_limit', 'hard_limit']);
  assert.ok(run.budget_incidents.some(incident => incident.severity === 'hard_stop'));
  assert.ok(run.budget_incidents.every(incident => incident.run_id === run.run_id));

  const { body: storedRun } = await requestJson(`${baseUrl}/runs/${run.run_id}`);
  assert.deepEqual(storedRun.budget_incidents.map(incident => incident.threshold), ['soft_limit', 'hard_limit']);

  const { body: audit } = await requestJson(`${baseUrl}/audit?from=2000-01-01T00:00:00Z&to=2100-01-01T00:00:00Z`);
  const incidentRecords = audit.records.filter(record => record.type === 'budget_incident' && record.run_id === run.run_id);
  assert.equal(incidentRecords.length, 2);
  assert.ok(incidentRecords.some(record => record.payload.threshold === 'hard_limit'));

  console.log(JSON.stringify({ ok: true, test: 'api-budget-incidents' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
