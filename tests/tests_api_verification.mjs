import assert from 'assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

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

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-api-verification-test-'));

try {
  writeFileSync(path.join(tmpDir, 'README.md'), '# Verification Fixture\n');
  mkdirSync(path.join(tmpDir, 'scripts'));
  writeFileSync(path.join(tmpDir, 'scripts', 'fail.mjs'), "console.error('fixture failed');\nprocess.exit(2);\n");
  writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    scripts: {
      'fixture:fail': 'node scripts/fail.mjs'
    }
  }, null, 2));

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_verification',
      objective: 'Verify execution evidence',
      repo: tmpDir,
      policy_id: 'full_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-24T00:00:00Z'
    })
  });

  const { body: readStep } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_read_for_verification', action: 'Read README' })
  });
  assert.equal(readStep.step.status, 'pending');

  const { response: readExecuteRes, body: readExecuted } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps/step_read_for_verification/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(readExecuteRes.status, 200);
  assert.equal(readExecuted.execution.status, 'completed');
  assert.equal(readExecuted.verification.result, 'passed');
  assert.equal(readExecuted.step.verification.verification_id, readExecuted.verification.verification_id);
  assert.ok(readExecuted.run.verifications.some(record => record.verification_id === readExecuted.verification.verification_id));

  const { body: failStep } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_fail_for_verification', action: 'Run package script fixture:fail' })
  });
  assert.equal(failStep.step.status, 'pending');

  const { response: failExecuteRes, body: failExecuted } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps/step_fail_for_verification/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(failExecuteRes.status, 200);
  assert.equal(failExecuted.execution.status, 'failed');
  assert.equal(failExecuted.verification.result, 'failed');
  assert.ok(failExecuted.verification.checks.some(check => (
    check.check_id === 'exit_code_zero' && check.status === 'failed'
  )));

  const { body: timeline } = await requestJson(`${baseUrl}/runs/${run.run_id}/events`);
  const verificationEvents = timeline.events.filter(event => event.type === 'step_verified');
  assert.equal(verificationEvents.length, 2);
  assert.deepEqual(verificationEvents.map(event => event.metadata.result), ['passed', 'failed']);

  const { body: audit } = await requestJson(`${baseUrl}/audit`);
  assert.ok(audit.records.some(record => (
    record.type === 'verification_record'
      && record.run_id === run.run_id
      && record.payload.verification_id === failExecuted.verification.verification_id
  )));

  console.log(JSON.stringify({ ok: true, test: 'api-verification' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  rmSync(tmpDir, { recursive: true, force: true });
}
