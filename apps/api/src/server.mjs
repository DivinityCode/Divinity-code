import http from 'http';

import { createRunArtifacts, publicArtifactMetadata } from '../../../packages/artifacts/src/index.mjs';
import { createInitialRunEvents, createRunEvent } from '../../../packages/events/src/index.mjs';
import { evaluatePreflight } from '../../../packages/policy-engine/src/index.mjs';

const runs = new Map();
const artifacts = new Map();

function readJson(req, callback) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    callback(JSON.parse(body || '{}'));
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

function approvalPayload(body) {
  return {
    decision: body.decision,
    actor: body.actor || 'operator',
    reason: body.reason || '',
    decided_at: new Date().toISOString()
  };
}

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && req.url === '/approvals') {
    sendJson(res, 200, {
      runs: Array.from(runs.values()).filter(run => run.status === 'awaiting_approval')
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/preflight') {
    readJson(req, (task) => {
      sendJson(res, 200, evaluatePreflight({ task }));
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/tasks') {
    readJson(req, (task) => {
      const preflight = evaluatePreflight({ task });
      const runId = `run_${Date.now()}`;
      const status = preflight.decision === 'requires_approval'
        ? 'awaiting_approval'
        : preflight.decision === 'block'
          ? 'failed'
          : 'queued';
      const runArtifacts = createRunArtifacts({ run_id: runId, task, status });
      const run = {
        run_id: runId,
        task_id: task.task_id || 'unknown',
        status,
        risk_level: preflight.risk_level,
        preflight,
        artifacts: runArtifacts.map(publicArtifactMetadata),
        events: createInitialRunEvents({ run_id: runId, task, preflight, status })
      };
      for (const artifact of runArtifacts) {
        artifacts.set(artifact.artifact_id, artifact);
      }
      runs.set(run.run_id, run);
      sendJson(res, 201, run);
    });
    return;
  }

  const approvalMatch = req.url.match(/^\/runs\/([^/]+)\/approval$/);
  if (req.method === 'POST' && approvalMatch) {
    const run = runs.get(approvalMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    if (run.status !== 'awaiting_approval') {
      sendJson(res, 409, { error: 'run is not awaiting approval' });
      return;
    }

    readJson(req, (body) => {
      if (body.decision !== 'approve' && body.decision !== 'reject') {
        sendJson(res, 400, { error: 'approval decision must be approve or reject' });
        return;
      }

      run.approval = approvalPayload(body);
      run.events.push(createRunEvent({
        run_id: run.run_id,
        type: 'approval_decided',
        status: run.status,
        message: `Approval decision: ${body.decision}`,
        metadata: run.approval
      }));
      run.status = body.decision === 'approve' ? 'queued' : 'failed';
      run.events.push(createRunEvent({
        run_id: run.run_id,
        type: 'status_changed',
        status: run.status,
        message: `Run status changed to ${run.status}`,
        metadata: { decision: body.decision }
      }));
      sendJson(res, 200, run);
    });
    return;
  }

  const eventsMatch = req.url.match(/^\/runs\/([^/]+)\/events$/);
  if (req.method === 'GET' && eventsMatch) {
    const run = runs.get(eventsMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    sendJson(res, 200, { run_id: run.run_id, events: run.events });
    return;
  }

  const runArtifactsMatch = req.url.match(/^\/runs\/([^/]+)\/artifacts$/);
  if (req.method === 'GET' && runArtifactsMatch) {
    const run = runs.get(runArtifactsMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    sendJson(res, 200, { run_id: run.run_id, artifacts: run.artifacts });
    return;
  }

  const artifactMatch = req.url.match(/^\/artifacts\/([^/]+)$/);
  if (req.method === 'GET' && artifactMatch) {
    const artifact = artifacts.get(artifactMatch[1]);
    if (!artifact) {
      sendJson(res, 404, { error: 'artifact not found' });
      return;
    }

    sendJson(res, 200, artifact);
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/runs/')) {
    const runId = req.url.split('/').pop();
    const run = runs.get(runId);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }
    sendJson(res, 200, run);
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

if (process.env.DIVINITY_API_AUTOSTART !== '0') {
  server.listen(3000, () => console.log('API listening on :3000'));
}

export { server };
