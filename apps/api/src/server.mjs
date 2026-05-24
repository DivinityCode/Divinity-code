import http from 'http';

import { createRunArtifacts, publicArtifactMetadata } from '../../../packages/artifacts/src/index.mjs';
import { createAuditRecord, exportAuditLog } from '../../../packages/audit/src/index.mjs';
import { createInitialRunEvents, createRunEvent } from '../../../packages/events/src/index.mjs';
import { evaluatePreflight, evaluateStepGate } from '../../../packages/policy-engine/src/index.mjs';

const runs = new Map();
const artifacts = new Map();
const auditRecords = [];
const runSubscribers = new Map();
const DEFAULT_SCOPE = { org_id: 'default-org', project_id: 'default-project' };

function configuredApiKeys() {
  const rawKeys = [
    process.env.DIVINITY_API_KEY,
    process.env.DIVINITY_API_KEYS
  ].filter(Boolean).join(',');

  return rawKeys.split(',').map(key => key.trim()).filter(Boolean);
}

function bearerToken(req) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function authenticateRequest(req, res) {
  const apiKeys = configuredApiKeys();
  if (apiKeys.length === 0) return true;

  const token = bearerToken(req);
  if (!token) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    sendJson(res, 401, { error: 'authentication required' });
    return false;
  }

  if (!apiKeys.includes(token)) {
    sendJson(res, 403, { error: 'invalid credentials' });
    return false;
  }

  return true;
}

function taskWithScope(task) {
  return {
    ...task,
    scope: {
      org_id: task?.scope?.org_id || DEFAULT_SCOPE.org_id,
      project_id: task?.scope?.project_id || DEFAULT_SCOPE.project_id
    }
  };
}

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

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
}

function approvalPayload(body) {
  return {
    decision: body.decision,
    actor: body.actor || 'operator',
    reason: body.reason || '',
    decided_at: new Date().toISOString()
  };
}

function recordAudit(entry) {
  const record = createAuditRecord(entry);
  auditRecords.push(record);
  return record;
}

function recordRunAudit(run) {
  recordAudit({
    type: 'run_created',
    run_id: run.run_id,
    created_at: run.events[0]?.created_at,
    payload: {
      task_id: run.task_id,
      status: run.status,
      risk_level: run.risk_level,
      preflight: run.preflight
    }
  });

  for (const event of run.events) {
    recordAudit({
      type: 'run_event',
      run_id: run.run_id,
      created_at: event.created_at,
      payload: event
    });
  }

  for (const artifact of run.artifacts) {
    recordAudit({
      type: 'artifact_record',
      run_id: run.run_id,
      payload: artifact
    });
  }
}

function latestAuditForRun(runId) {
  for (let index = auditRecords.length - 1; index >= 0; index -= 1) {
    if (auditRecords[index].run_id === runId) return auditRecords[index];
  }
  return null;
}

function publicRun(run) {
  const latestAudit = latestAuditForRun(run.run_id);
  return {
    ...run,
    audit: latestAudit
      ? { hash: latestAudit.hash, recorded_at: latestAudit.created_at }
      : null
  };
}

function sendSse(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function subscribeToRun(runId, res) {
  if (!runSubscribers.has(runId)) {
    runSubscribers.set(runId, new Set());
  }

  runSubscribers.get(runId).add(res);
  return () => {
    const subscribers = runSubscribers.get(runId);
    if (!subscribers) return;
    subscribers.delete(res);
    if (subscribers.size === 0) runSubscribers.delete(runId);
  };
}

function broadcastRun(run, event = 'run_updated') {
  const subscribers = runSubscribers.get(run.run_id);
  if (!subscribers) return;

  for (const res of subscribers) {
    sendSse(res, event, publicRun(run));
  }
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (!authenticateRequest(req, res)) return;

  if (req.method === 'GET' && req.url === '/runs') {
    sendJson(res, 200, {
      runs: Array.from(runs.values()).map(publicRun)
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/approvals') {
    sendJson(res, 200, {
      runs: Array.from(runs.values()).filter(run => run.status === 'awaiting_approval').map(publicRun)
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/audit')) {
    const url = new URL(req.url, 'http://127.0.0.1');
    sendJson(res, 200, exportAuditLog({
      records: auditRecords,
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to')
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/preflight') {
    readJson(req, (task) => {
      sendJson(res, 200, evaluatePreflight({ task: taskWithScope(task) }));
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/tasks') {
    readJson(req, (task) => {
      const scopedTask = taskWithScope(task);
      const preflight = evaluatePreflight({ task: scopedTask });
      const runId = `run_${Date.now()}`;
      const status = preflight.run_status;
      const runArtifacts = createRunArtifacts({ run_id: runId, task: scopedTask, status, preflight });
      const events = createInitialRunEvents({ run_id: runId, task: scopedTask, preflight, status });
      const run = {
        run_id: runId,
        task_id: scopedTask.task_id || 'unknown',
        task: scopedTask,
        created_at: events[0]?.created_at || new Date().toISOString(),
        status,
        risk_level: preflight.risk_level,
        preflight,
        artifacts: runArtifacts.map(publicArtifactMetadata),
        events,
        steps: []
      };
      for (const artifact of runArtifacts) {
        artifacts.set(artifact.artifact_id, artifact);
      }
      runs.set(run.run_id, run);
      recordRunAudit(run);
      sendJson(res, 201, publicRun(run));
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
      recordAudit({
        type: 'approval_decision',
        run_id: run.run_id,
        created_at: run.approval.decided_at,
        payload: run.approval
      });
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
      for (const event of run.events.slice(-2)) {
        recordAudit({
          type: 'run_event',
          run_id: run.run_id,
          created_at: event.created_at,
          payload: event
        });
      }
      const payload = publicRun(run);
      broadcastRun(run);
      sendJson(res, 200, payload);
    });
    return;
  }

  const stepsMatch = req.url.match(/^\/runs\/([^/]+)\/steps$/);
  if (req.method === 'POST' && stepsMatch) {
    const run = runs.get(stepsMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    readJson(req, (body) => {
      const check = evaluateStepGate({
        run,
        step: body
      });
      const step = {
        step_id: body.step_id || `step_${Date.now()}`,
        run_id: run.run_id,
        action: body.action || '',
        status: check.status === 'allowed' ? 'pending' : 'blocked',
        pre_execution_check: check
      };

      run.steps.push(step);

      if (check.run_status === 'paused') {
        run.status = 'paused';
        run.events.push(createRunEvent({
          run_id: run.run_id,
          type: 'status_changed',
          status: 'paused',
          message: 'Run paused by hard budget cap',
          metadata: {
            blocked_reasons: check.blocked_reasons,
            estimated_cost_usd: check.budget.estimated_cost_usd,
            hard_limit_usd: check.budget.hard_limit_usd
          }
        }));
        recordRunAudit(run);
        broadcastRun(run);
        sendJson(res, 409, { error: 'run paused by hard budget cap', step, run: publicRun(run) });
      } else if (check.decision === 'allow') {
        broadcastRun(run);
        sendJson(res, 201, { step });
      } else if (check.decision === 'requires_approval') {
        broadcastRun(run);
        sendJson(res, 409, { error: 'step requires approval before execution', step });
      } else {
        broadcastRun(run);
        sendJson(res, 403, { error: 'step blocked by policy', step });
      }
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

  const streamMatch = req.url.match(/^\/runs\/([^/]+)\/stream$/);
  if (req.method === 'GET' && streamMatch) {
    const run = runs.get(streamMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    sendSse(res, 'run_snapshot', publicRun(run));
    const unsubscribe = subscribeToRun(run.run_id, res);
    req.on('close', unsubscribe);
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
    sendJson(res, 200, publicRun(run));
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

if (process.env.DIVINITY_API_AUTOSTART !== '0') {
  server.listen(3000, () => console.log('API listening on :3000'));
}

export { server };
