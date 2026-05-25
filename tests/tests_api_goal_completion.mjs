import assert from 'assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  return { response, body: await response.json() };
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-api-goal-completion-test-'));

try {
  writeFileSync(path.join(tmpDir, 'README.md'), '# Goal Completion Fixture\n');

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_goal_completion',
      objective: 'Read the repository README',
      repo: tmpDir,
      policy_id: 'full_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      success_criteria: ['README evidence is verified'],
      created_at: '2026-05-25T00:00:00Z'
    })
  });
  assert.equal(run.goals.length, 1);
  assert.equal(run.goals[0].status, 'pending');

  const { body: stepCreated } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_goal_readme', action: 'Read README' })
  });
  assert.equal(stepCreated.step.status, 'pending');

  const { body: executed } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps/step_goal_readme/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(executed.verification.result, 'passed');

  const { response: completeRes, body: completed } = await requestJson(`${baseUrl}/runs/${run.run_id}/goals/${run.goals[0].goal_id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ verification_id: executed.verification.verification_id })
  });
  assert.equal(completeRes.status, 200);
  assert.equal(completed.goal.status, 'completed');
  assert.equal(completed.goal.completion_evidence_refs[0].source, 'verification.result');
  assert.equal(completed.run.goals[0].status, 'completed');

  const { body: timeline } = await requestJson(`${baseUrl}/runs/${run.run_id}/events`);
  assert.ok(timeline.events.some(event => (
    event.type === 'goal_completed'
      && event.metadata.goal_id === run.goals[0].goal_id
      && event.metadata.verification_id === executed.verification.verification_id
  )));

  const { body: audit } = await requestJson(`${baseUrl}/audit`);
  assert.ok(audit.records.some(record => (
    record.type === 'goal_record'
      && record.run_id === run.run_id
      && record.payload.goal_id === run.goals[0].goal_id
      && record.payload.status === 'completed'
  )));

  const { response: duplicateRes, body: duplicate } = await requestJson(`${baseUrl}/runs/${run.run_id}/goals/${run.goals[0].goal_id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ verification_id: executed.verification.verification_id })
  });
  assert.equal(duplicateRes.status, 409);
  assert.equal(duplicate.error, 'goal is already completed');

  console.log(JSON.stringify({ ok: true, test: 'api-goal-completion' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  rmSync(tmpDir, { recursive: true, force: true });
}
