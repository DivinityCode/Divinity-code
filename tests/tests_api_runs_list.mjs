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

const highRiskTask = {
  task_id: 'task_runs_list_approval',
  objective: 'Run a migration shell command',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:00:00Z'
};

const lowRiskTask = {
  task_id: 'task_runs_list_read',
  objective: 'Read the repository README',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:01:00Z'
};

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response: optionsRes } = await requestJson(`${baseUrl}/runs`, { method: 'OPTIONS' });
  assert.equal(optionsRes.status, 204);
  assert.equal(optionsRes.headers.get('access-control-allow-origin'), '*');

  const { body: firstRun } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(highRiskTask)
  });
  const { body: secondRun } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(lowRiskTask)
  });

  const { response: listRes, body: list } = await requestJson(`${baseUrl}/runs`);
  assert.equal(listRes.status, 200);
  assert.equal(list.runs.length, 2);
  assert.deepEqual(list.runs.map(run => run.run_id), [firstRun.run_id, secondRun.run_id]);
  assert.equal(list.runs[0].task.objective, highRiskTask.objective);
  assert.equal(list.runs[0].created_at, list.runs[0].events[0].created_at);
  assert.match(list.runs[0].audit.hash, /^[a-f0-9]{64}$/);
  assert.match(list.runs[0].audit.recorded_at, /^\d{4}-\d{2}-\d{2}T/);

  const { body: approvals } = await requestJson(`${baseUrl}/approvals`);
  assert.equal(approvals.runs.length, 1);
  assert.equal(approvals.runs[0].run_id, firstRun.run_id);
  assert.equal(approvals.runs[0].task.objective, highRiskTask.objective);

  console.log(JSON.stringify({ ok: true, test: 'api-runs-list' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
