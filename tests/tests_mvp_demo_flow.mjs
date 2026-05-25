import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

function runCli(tmpDir, ...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    { cwd: tmpDir, encoding: 'utf8' }
  );
  return JSON.parse(output);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  return { response, body: await response.json() };
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-mvp-demo-flow-'));

try {
  writeFileSync(path.join(tmpDir, 'README.md'), '# MVP Demo Fixture\n\nApproval-gated execution evidence.\n');
  execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });

  const initResult = runCli(tmpDir, 'init', '--policy', 'safe_exec');
  assert.equal(initResult.ok, true);
  assert.equal(initResult.config.policy_id, 'safe_exec');
  assert.equal(initResult.config_path, path.join(tmpDir, '.divinity.json'));
  assert.equal(existsSync(path.join(tmpDir, '.divinity.json')), true);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response: createRes, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_mvp_demo_flow',
      objective: 'Run a migration shell command',
      repo: tmpDir,
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      success_criteria: ['README evidence is verified after approval'],
      created_at: '2026-05-25T00:00:00Z'
    })
  });
  assert.equal(createRes.status, 201);
  assert.equal(run.status, 'awaiting_approval');
  assert.equal(run.preflight.decision, 'requires_approval');
  assert.equal(run.artifacts.length, 4);
  assert.equal(run.goals.length, 1);

  const { response: queueRes, body: queue } = await requestJson(`${baseUrl}/approvals`);
  assert.equal(queueRes.status, 200);
  assert.equal(queue.runs.length, 1);
  assert.equal(queue.runs[0].run_id, run.run_id);

  const { response: approveRes, body: approvedRun } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval`, {
    method: 'POST',
    body: JSON.stringify({
      decision: 'approve',
      actor: 'operator@example.com',
      reason: 'MVP demo approval'
    })
  });
  assert.equal(approveRes.status, 200);
  assert.equal(approvedRun.status, 'queued');
  assert.equal(approvedRun.approval.decision, 'approve');

  const { body: emptyQueue } = await requestJson(`${baseUrl}/approvals`);
  assert.equal(emptyQueue.runs.length, 0);

  const { response: stepRes, body: stepPayload } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_mvp_readme', action: 'Read README' })
  });
  assert.equal(stepRes.status, 201);
  assert.equal(stepPayload.step.status, 'pending');

  const { response: executeRes, body: executed } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps/step_mvp_readme/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(executeRes.status, 200);
  assert.equal(executed.execution.status, 'completed');
  assert.equal(executed.execution.adapter, 'file_read');
  assert.match(executed.execution.stdout, /Approval-gated execution evidence/);
  assert.equal(executed.verification.result, 'passed');

  const { response: artifactsRes, body: artifactList } = await requestJson(`${baseUrl}/runs/${run.run_id}/artifacts`);
  assert.equal(artifactsRes.status, 200);
  assert.deepEqual(artifactList.artifacts.map(artifact => artifact.type), ['patch', 'log', 'summary', 'pr_summary']);

  const summaryId = artifactList.artifacts.find(artifact => artifact.type === 'summary').artifact_id;
  const { response: summaryRes, body: summaryArtifact } = await requestJson(`${baseUrl}/artifacts/${summaryId}`);
  assert.equal(summaryRes.status, 200);
  assert.equal(summaryArtifact.content.decision_trace.chosen_path, 'request_operator_approval');

  const prSummaryId = artifactList.artifacts.find(artifact => artifact.type === 'pr_summary').artifact_id;
  const { response: prSummaryRes, body: prSummaryArtifact } = await requestJson(`${baseUrl}/artifacts/${prSummaryId}`);
  assert.equal(prSummaryRes.status, 200);
  assert.equal(prSummaryArtifact.content.format, 'github_pull_request_summary');
  assert.match(prSummaryArtifact.content.body, /Preflight decision: requires_approval/);

  const { response: eventsRes, body: timeline } = await requestJson(`${baseUrl}/runs/${run.run_id}/events`);
  assert.equal(eventsRes.status, 200);
  assert.ok(timeline.events.some(event => event.type === 'approval_decided'));
  assert.ok(timeline.events.some(event => event.type === 'step_executed'));
  assert.ok(timeline.events.some(event => event.type === 'step_verified'));

  const { response: auditRes, body: audit } = await requestJson(`${baseUrl}/audit?from=2000-01-01T00:00:00Z&to=2100-01-01T00:00:00Z`);
  assert.equal(auditRes.status, 200);
  assert.equal(audit.format, 'divinity.audit.v1');
  assert.ok(audit.records.some(record => record.type === 'run_created' && record.run_id === run.run_id));
  assert.ok(audit.records.some(record => record.type === 'approval_decision' && record.payload.decision === 'approve'));
  assert.ok(audit.records.some(record => record.type === 'artifact_record' && record.payload.type === 'pr_summary'));
  assert.ok(audit.records.some(record => record.type === 'execution_record' && record.payload.execution_id === executed.execution.execution_id));
  assert.ok(audit.records.some(record => record.type === 'verification_record' && record.payload.verification_id === executed.verification.verification_id));

  console.log(JSON.stringify({ ok: true, test: 'mvp-demo-flow' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  rmSync(tmpDir, { recursive: true, force: true });
}
