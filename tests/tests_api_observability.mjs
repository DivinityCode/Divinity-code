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

function task(task_id, objective, policy_id, budget) {
  return {
    task_id,
    objective,
    repo: 'github.com/org/repo',
    policy_id,
    budget,
    created_at: '2026-05-24T00:00:00Z'
  };
}

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task('task_observe_read', 'Read the repository README', 'safe_exec', {
      soft_limit_usd: 2,
      hard_limit_usd: 4
    }))
  });
  await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task('task_observe_policy', 'Run a migration shell command', 'read_only', {
      soft_limit_usd: 3,
      hard_limit_usd: 6
    }))
  });
  await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task('task_observe_budget', 'Run a migration shell command', 'full_exec', {
      soft_limit_usd: 0.1,
      hard_limit_usd: 0.1
    }))
  });
  await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task('task_observe_approval', 'Run a migration shell command', 'safe_exec', {
      soft_limit_usd: 5,
      hard_limit_usd: 10
    }))
  });

  const { response, body } = await requestJson(`${baseUrl}/observability`);
  assert.equal(response.status, 200);
  assert.equal(body.format, 'divinity.observability.v1');
  assert.equal(body.totals.run_count, 4);
  assert.equal(body.totals.approvals_pending, 1);
  assert.equal(body.status_counts.queued, 1);
  assert.equal(body.status_counts.failed, 1);
  assert.equal(body.status_counts.paused, 1);
  assert.equal(body.status_counts.awaiting_approval, 1);
  assert.equal(body.risk_counts.high, 3);
  assert.equal(body.totals.estimated_cost_usd, 4.75);
  assert.equal(body.failure_taxonomy.find(item => item.category === 'policy').count, 1);
  assert.equal(body.failure_taxonomy.find(item => item.category === 'budget').count, 1);

  console.log(JSON.stringify({ ok: true, test: 'api-observability' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
