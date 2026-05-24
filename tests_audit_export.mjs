import assert from 'assert/strict';

import { createAuditRecord } from './packages/audit/src/index.mjs';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('./apps/api/src/server.mjs');

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  const body = await response.json();
  return { response, body };
}

{
  const record = createAuditRecord({
    type: 'run_event',
    run_id: 'run_123',
    created_at: '2026-05-24T00:00:00Z',
    payload: { status: 'queued' }
  });

  assert.match(record.audit_id, /^audit_/);
  assert.equal(record.type, 'run_event');
  assert.equal(record.run_id, 'run_123');
  assert.match(record.hash, /^[a-f0-9]{64}$/);
}

const task = {
  task_id: 'task_audit_123',
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
    body: JSON.stringify(task)
  });

  await requestJson(`${baseUrl}/runs/${run.run_id}/approval`, {
    method: 'POST',
    body: JSON.stringify({
      decision: 'approve',
      actor: 'operator@example.com',
      reason: 'approved for audit export test'
    })
  });

  const { response: exportRes, body: audit } = await requestJson(`${baseUrl}/audit?from=2000-01-01T00:00:00Z&to=2100-01-01T00:00:00Z`);
  assert.equal(exportRes.status, 200);
  assert.equal(audit.format, 'divinity.audit.v1');
  assert.equal(audit.filters.from, '2000-01-01T00:00:00Z');
  assert.equal(audit.filters.to, '2100-01-01T00:00:00Z');
  assert.ok(audit.records.length >= 8);
  assert.ok(audit.records.every(record => /^[a-f0-9]{64}$/.test(record.hash)));
  assert.ok(audit.records.some(record => record.type === 'run_created' && record.run_id === run.run_id));
  assert.ok(audit.records.some(record => record.type === 'approval_decision' && record.payload.decision === 'approve'));
  assert.ok(audit.records.some(record => record.type === 'artifact_record' && record.payload.type === 'summary'));

  const { body: emptyAudit } = await requestJson(`${baseUrl}/audit?from=2999-01-01T00:00:00Z`);
  assert.equal(emptyAudit.records.length, 0);

  console.log(JSON.stringify({ ok: true, test: 'audit-export' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
