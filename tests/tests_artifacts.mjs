import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { createRunArtifacts } from '../packages/artifacts/src/index.mjs';

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
  const body = await response.json();
  return { response, body };
}

function assertPatchPayload(patchContent, expectedObjective) {
  assert.equal(patchContent.format, 'unified-diff');
  assert.equal(patchContent.target_path, 'DIVINITY_TASK.md');
  assert.match(patchContent.patch, /^diff --git a\/DIVINITY_TASK\.md b\/DIVINITY_TASK\.md/);
  assert.match(patchContent.patch, /\n\+\+\+ b\/DIVINITY_TASK\.md\n/);
  assert.ok(patchContent.patch.includes(`+- Objective: ${expectedObjective}`));

  const gitDir = mkdtempSync(path.join(tmpdir(), 'divinity-patch-apply-test-'));
  try {
    execFileSync('git', ['init'], { cwd: gitDir, stdio: 'ignore' });
    execFileSync('git', ['apply', '--check', '-'], {
      cwd: gitDir,
      input: patchContent.patch,
      encoding: 'utf8'
    });
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
}

{
  const artifacts = createRunArtifacts({
    run_id: 'run_123',
    task: { task_id: 'task_123', objective: 'Review README' },
    status: 'queued',
    preflight: {
      decision: 'allow',
      run_status: 'queued',
      blocked_reasons: [],
      warnings: [],
      evidence_refs: [
        {
          evidence_id: 'evidence_task_objective',
          source: 'task.objective',
          summary: 'Objective indicates review work.',
          supports: ['decision']
        }
      ]
    }
  });

  assert.deepEqual(artifacts.map(artifact => artifact.type), ['patch', 'log', 'summary', 'pr_summary']);
  assert.deepEqual(artifacts.map(artifact => artifact.uri), [
    'artifact://run_123/patch',
    'artifact://run_123/log',
    'artifact://run_123/summary',
    'artifact://run_123/pr_summary'
  ]);
  assert.equal(artifacts[2].content.summary, 'Run run_123 for task task_123 is queued: Review README');
  assert.equal(artifacts[2].content.decision_trace.chosen_path, 'queue_for_execution');
  assert.equal(artifacts[2].content.decision_trace.rejected_alternative, 'pause_or_request_approval');
  assert.equal(artifacts[2].content.decision_trace.evidence_refs[0].source, 'task.objective');
  assert.equal(artifacts[3].content.format, 'github_pull_request_summary');
  assert.match(artifacts[3].content.title, /Review README/);
  assert.match(artifacts[3].content.body, /## Summary/);
  assert.match(artifacts[3].content.body, /## Validation/);
  assert.match(artifacts[3].content.body, /Preflight decision: allow/);
  assert.equal(artifacts[3].content.decision_trace.chosen_path, 'queue_for_execution');
  assertPatchPayload(artifacts[0].content, 'Review README');
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-artifacts-test-'));
try {
  runCli(tmpDir, 'init');
  const cliRun = runCli(tmpDir, 'run', 'Review README');
  assert.deepEqual(cliRun.artifacts.map(artifact => artifact.type), ['patch', 'log', 'summary', 'pr_summary']);
  assert.ok(cliRun.artifacts.every(artifact => artifact.run_id === cliRun.run_id));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

const task = {
  task_id: 'task_artifacts_123',
  objective: 'Review README',
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
  assert.deepEqual(run.artifacts.map(artifact => artifact.type), ['patch', 'log', 'summary', 'pr_summary']);

  const { response: listRes, body: list } = await requestJson(`${baseUrl}/runs/${run.run_id}/artifacts`);
  assert.equal(listRes.status, 200);
  assert.equal(list.run_id, run.run_id);
  assert.deepEqual(list.artifacts.map(artifact => artifact.uri), [
    `artifact://${run.run_id}/patch`,
    `artifact://${run.run_id}/log`,
    `artifact://${run.run_id}/summary`,
    `artifact://${run.run_id}/pr_summary`
  ]);

  const summaryId = list.artifacts.find(artifact => artifact.type === 'summary').artifact_id;
  const { response: artifactRes, body: artifact } = await requestJson(`${baseUrl}/artifacts/${summaryId}`);
  assert.equal(artifactRes.status, 200);
  assert.equal(artifact.artifact_id, summaryId);
  assert.equal(artifact.type, 'summary');
  assert.equal(artifact.content.summary, `Run ${run.run_id} for task ${task.task_id} is queued: ${task.objective}`);
  assert.equal(artifact.content.decision_trace.chosen_path, 'queue_for_execution');
  assert.equal(artifact.content.decision_trace.rejected_alternative, 'pause_or_request_approval');
  assert.ok(artifact.content.decision_trace.evidence_refs.some(evidence => evidence.source === 'task.objective'));

  const patchId = list.artifacts.find(artifact => artifact.type === 'patch').artifact_id;
  const { response: patchRes, body: patchArtifact } = await requestJson(`${baseUrl}/artifacts/${patchId}`);
  assert.equal(patchRes.status, 200);
  assert.equal(patchArtifact.artifact_id, patchId);
  assert.equal(patchArtifact.type, 'patch');
  assertPatchPayload(patchArtifact.content, task.objective);

  const prSummaryId = list.artifacts.find(artifact => artifact.type === 'pr_summary').artifact_id;
  const { response: prSummaryRes, body: prSummaryArtifact } = await requestJson(`${baseUrl}/artifacts/${prSummaryId}`);
  assert.equal(prSummaryRes.status, 200);
  assert.equal(prSummaryArtifact.artifact_id, prSummaryId);
  assert.equal(prSummaryArtifact.type, 'pr_summary');
  assert.equal(prSummaryArtifact.content.format, 'github_pull_request_summary');
  assert.match(prSummaryArtifact.content.title, /Review README/);
  assert.match(prSummaryArtifact.content.body, /## Summary/);
  assert.match(prSummaryArtifact.content.body, /## Validation/);
  assert.match(prSummaryArtifact.content.body, /Preflight decision: allow/);
  assert.equal(prSummaryArtifact.content.decision_trace.chosen_path, 'queue_for_execution');

  console.log(JSON.stringify({ ok: true, test: 'artifacts' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
