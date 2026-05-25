import http from 'http';

import { createAgentActivityRecords } from '../../../packages/agent-activity/src/index.mjs';
import { createApprovalComment } from '../../../packages/approval-comments/src/index.mjs';
import { createApprovalRevision, resubmitApprovalRevision } from '../../../packages/approval-revisions/src/index.mjs';
import { createRunArtifacts, publicArtifactMetadata } from '../../../packages/artifacts/src/index.mjs';
import { createAuditRecord, exportAuditLog } from '../../../packages/audit/src/index.mjs';
import { createBudgetIncidents } from '../../../packages/budget-incidents/src/index.mjs';
import { createCapabilitiesCatalog } from '../../../packages/capabilities/src/index.mjs';
import { createConnectorReference, createConnectorReferences } from '../../../packages/connectors/src/index.mjs';
import { createInitialRunEvents, createRunEvent } from '../../../packages/events/src/index.mjs';
import { createExecutionAttemptState, executeStep } from '../../../packages/execution/src/index.mjs';
import {
  activeExecutionLock,
  createExecutionLock,
  recoverStaleExecutionLocks,
  releaseExecutionLock
} from '../../../packages/execution-locks/src/index.mjs';
import { createRunHeartbeat, latestHeartbeatAt } from '../../../packages/heartbeats/src/index.mjs';
import { completeGoalRecord, createGoalRecords } from '../../../packages/goals/src/index.mjs';
import { createRunMemoryEntries } from '../../../packages/memory/src/index.mjs';
import { createObservabilitySummary } from '../../../packages/observability/src/index.mjs';
import { createOrchestrationTrace } from '../../../packages/orchestration/src/index.mjs';
import { resolvePolicyPackForTask } from '../../../packages/policy-packs/src/index.mjs';
import { evaluatePreflight, evaluateStepGate } from '../../../packages/policy-engine/src/index.mjs';
import {
  createConfiguredProviderLimitLedger,
  executeProviderProxyChat,
  executeProviderProxyChatStream,
  planProviderProxyRoute
} from '../../../packages/provider-proxy/src/index.mjs';
import { createProviderToolCallApproval } from '../../../packages/provider-tool-approvals/src/index.mjs';
import { createConfiguredRunStore } from '../../../packages/run-store/src/index.mjs';
import { createExecutionVerification } from '../../../packages/verification/src/index.mjs';
import { cleanupRunWorkspace, createRunWorkspace, executionCwdForRun } from '../../../packages/workspaces/src/index.mjs';
import { publicLlmProviders, resolveProviderRuntime } from '../../../packages/provider-runtime/src/index.mjs';
import { publicToolsets, resolveToolsets } from '../../../packages/toolsets/src/index.mjs';

const runStore = createConfiguredRunStore();
const { runs, artifacts, auditRecords } = runStore;
const providerLimitLedger = createConfiguredProviderLimitLedger(process.env, { memoryFallback: true });
const runSubscribers = new Map();
const DEFAULT_SCOPE = { org_id: 'default-org', project_id: 'default-project' };
const DEFAULT_ENABLED_TOOLSETS = resolveToolsets().toolsets.map(toolset => toolset.toolset_id);
const DEFAULT_RUNTIME_CONFIG = {
  llm_provider: {
    provider_id: 'openrouter',
    model: 'openai/gpt-4o-mini'
  },
  toolsets: {
    enabled: DEFAULT_ENABLED_TOOLSETS,
    disabled: []
  }
};

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

function normalizedRuntimeProvider(source = {}) {
  const provider = {
    ...DEFAULT_RUNTIME_CONFIG.llm_provider,
    ...source
  };
  const normalized = {
    provider_id: String(provider.provider_id || '').trim(),
    model: String(provider.model || '').trim()
  };
  const baseUrl = String(provider.base_url || '').trim();
  if (baseUrl) normalized.base_url = baseUrl;
  return normalized;
}

function normalizedToolsets(source = {}) {
  return {
    enabled: Array.isArray(source.enabled)
      ? source.enabled.map(value => String(value || '').trim()).filter(Boolean)
      : [...DEFAULT_RUNTIME_CONFIG.toolsets.enabled],
    disabled: Array.isArray(source.disabled)
      ? source.disabled.map(value => String(value || '').trim()).filter(Boolean)
      : [...DEFAULT_RUNTIME_CONFIG.toolsets.disabled]
  };
}

function taskWithRuntimeConfig(task, config = DEFAULT_RUNTIME_CONFIG) {
  const llmProvider = normalizedRuntimeProvider(task.llm_provider || config.llm_provider);
  const toolsets = normalizedToolsets(task.toolsets || config.toolsets);
  const providerRuntime = resolveProviderRuntime({
    provider_id: llmProvider.provider_id,
    model: llmProvider.model,
    base_url: llmProvider.base_url
  });
  const toolsetResolution = resolveToolsets({
    enabled_toolsets: toolsets.enabled,
    disabled_toolsets: toolsets.disabled,
    provider_runtime: providerRuntime
  });

  return {
    ...task,
    llm_provider: llmProvider,
    toolsets,
    provider_runtime: providerRuntime,
    toolset_resolution: toolsetResolution
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
  persistRunStore();
  return record;
}

function persistRunStore() {
  runStore.persist();
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

  for (const connectorReference of run.connector_references || []) {
    recordAudit({
      type: 'connector_reference',
      run_id: run.run_id,
      created_at: connectorReference.attached_at,
      payload: connectorReference
    });
  }

  recordBudgetIncidents(run, run.budget_incidents || []);
}

function recordBudgetIncidents(run, incidents) {
  for (const incident of incidents) {
    recordAudit({
      type: 'budget_incident',
      run_id: run.run_id,
      created_at: incident.created_at,
      payload: incident
    });
  }
}

function recordExecutionLock(run, lock, eventType, message) {
  const event = createRunEvent({
    run_id: run.run_id,
    type: eventType,
    status: run.status,
    message,
    metadata: {
      lock_id: lock.lock_id,
      step_id: lock.step_id,
      actor: lock.actor,
      status: lock.status
    }
  });
  run.events.push(event);
  recordAudit({
    type: 'execution_lock_record',
    run_id: run.run_id,
    created_at: lock.released_at || lock.locked_at,
    payload: lock
  });
  recordAudit({
    type: 'run_event',
    run_id: run.run_id,
    created_at: event.created_at,
    payload: event
  });
}

function recoverRunExecutionLocks(run) {
  const recoveredLocks = recoverStaleExecutionLocks({ run });
  for (const lock of recoveredLocks) {
    recordExecutionLock(run, lock, 'execution_lock_recovered', `Execution lock recovered for ${lock.step_id}`);
  }
  return recoveredLocks;
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

function approvalSnapshot(run) {
  return {
    run_id: run.run_id,
    status: run.status,
    approval_required: run.status === 'awaiting_approval',
    approval: run.approval || null,
    revision: run.approval_revision || null,
    comments: run.approval_comments || [],
    run: publicRun(run)
  };
}

function requestedChangesFromBody(body) {
  return [
    ...(Array.isArray(body.requested_changes) ? body.requested_changes : [body.requested_changes]),
    ...(Array.isArray(body.changes) ? body.changes : [body.changes]),
    body.requested_change,
    body.change
  ].map(value => String(value || '').trim()).filter(Boolean);
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

  if (req.method === 'GET' && req.url === '/capabilities') {
    sendJson(res, 200, createCapabilitiesCatalog());
    return;
  }

  if (req.method === 'GET' && req.url === '/providers') {
    sendJson(res, 200, { llm_providers: publicLlmProviders() });
    return;
  }

  if (req.method === 'GET' && req.url === '/toolsets') {
    sendJson(res, 200, { toolsets: publicToolsets(), resolution: resolveToolsets() });
    return;
  }

  if (req.method === 'POST' && req.url === '/provider-proxy/route') {
    readJson(req, (body) => {
      const route = planProviderProxyRoute({
        candidates: body.candidates,
        limit_state: body.limit_state,
        limit_ledger: providerLimitLedger,
        rotation_intent: body.rotation_intent,
        requested_model: body.requested_model || body.model
      });
      sendJson(res, route.status === 'ready' ? 200 : 400, { route });
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/provider-proxy/chat') {
    readJson(req, async (body) => {
      try {
        const result = await executeProviderProxyChat({
          candidates: body.candidates,
          limit_state: body.limit_state,
          limit_ledger: providerLimitLedger,
          rotation_intent: body.rotation_intent,
          requested_model: body.requested_model || body.model,
          messages: body.messages,
          max_completion_tokens: body.max_completion_tokens,
          max_output_tokens: body.max_output_tokens,
          request_budget: body.request_budget,
          toolsets: body.toolsets,
          enabled_toolsets: body.enabled_toolsets,
          disabled_toolsets: body.disabled_toolsets,
          temperature: body.temperature
        });
        const statusCode = result.status === 'completed'
          ? 200
          : result.status === 'requires_action'
            ? 202
            : result.status === 'limited'
              ? 429
              : result.status === 'failed'
                ? 502
                : 400;
        sendJson(res, statusCode, { result });
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
    });
    return;
  }

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

  if (req.method === 'GET' && req.url === '/observability') {
    sendJson(res, 200, createObservabilitySummary({
      runs: Array.from(runs.values())
    }));
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
      try {
        const scopedTask = taskWithRuntimeConfig(taskWithScope(task));
        const policyPack = resolvePolicyPackForTask(scopedTask);
        sendJson(res, 200, evaluatePreflight({ task: scopedTask, policyPack }));
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/provider-proxy/chat/stream') {
    readJson(req, async (body) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const result = await executeProviderProxyChatStream({
          candidates: body.candidates,
          limit_state: body.limit_state,
          limit_ledger: providerLimitLedger,
          rotation_intent: body.rotation_intent,
          requested_model: body.requested_model || body.model,
          messages: body.messages,
          max_completion_tokens: body.max_completion_tokens,
          max_output_tokens: body.max_output_tokens,
          request_budget: body.request_budget,
          toolsets: body.toolsets,
          enabled_toolsets: body.enabled_toolsets,
          disabled_toolsets: body.disabled_toolsets,
          temperature: body.temperature,
          on_event: event => sendSse(res, 'provider_stream_event', { event })
        });
        const finalEvent = result.status === 'failed'
          ? 'provider_stream_failed'
          : 'provider_stream_completed';
        sendSse(res, finalEvent, { result });
      } catch (error) {
        sendSse(res, 'provider_stream_failed', { error: error.message });
      } finally {
        res.end();
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/tasks') {
    readJson(req, (task) => {
      let scopedTask;
      try {
        scopedTask = taskWithRuntimeConfig(taskWithScope(task));
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      const policyPack = resolvePolicyPackForTask(scopedTask);
      const preflight = evaluatePreflight({ task: scopedTask, policyPack });
      const runId = `run_${Date.now()}`;
      const status = preflight.run_status;
      const runArtifacts = createRunArtifacts({ run_id: runId, task: scopedTask, status, preflight });
      const events = createInitialRunEvents({ run_id: runId, task: scopedTask, preflight, status });
      const createdAt = events[0]?.created_at || new Date().toISOString();
      const budgetIncidents = createBudgetIncidents({
        run_id: runId,
        task: scopedTask,
        preflight,
        source: 'preflight',
        created_at: createdAt
      });
      let connectorReferences = [];
      try {
        connectorReferences = createConnectorReferences({
          run_id: runId,
          references: scopedTask.connector_references || [],
          attached_by: 'task',
          attached_at: createdAt
        });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      const goals = createGoalRecords({
        run_id: runId,
        task: scopedTask,
        preflight,
        status,
        created_at: createdAt
      });
      const run = {
        run_id: runId,
        task_id: scopedTask.task_id || 'unknown',
        task: scopedTask,
        created_at: createdAt,
        status,
        risk_level: preflight.risk_level,
        preflight,
        budget_incidents: budgetIncidents,
        policy_pack: policyPack,
        orchestration: createOrchestrationTrace({ run_id: runId, task: scopedTask, status, preflight }),
        goals,
        agent_activity: createAgentActivityRecords({
          run_id: runId,
          task: scopedTask,
          status,
          preflight,
          created_at: createdAt
        }),
        memory: createRunMemoryEntries({ run_id: runId, task: scopedTask, preflight, recorded_at: createdAt }),
        artifacts: runArtifacts.map(publicArtifactMetadata),
        connector_references: connectorReferences,
        events,
        heartbeats: [],
        last_heartbeat_at: null,
        execution_locks: [],
        active_execution_lock: null,
        executions: [],
        verifications: [],
        approval_comments: [],
        provider_tool_call_approvals: [],
        steps: [],
        workspace: createRunWorkspace({ runId, repoPath: scopedTask.repo })
      };
      for (const artifact of runArtifacts) {
        artifacts.set(artifact.artifact_id, artifact);
      }
      runs.set(run.run_id, run);
      recordRunAudit(run);
      persistRunStore();
      sendJson(res, 201, publicRun(run));
    });
    return;
  }

  const connectorsMatch = req.url.match(/^\/runs\/([^/]+)\/connectors$/);
  if (connectorsMatch) {
    const run = runs.get(connectorsMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, {
        run_id: run.run_id,
        connector_references: run.connector_references || []
      });
      return;
    }

    if (req.method === 'POST') {
      readJson(req, (body) => {
        try {
          const connectorReference = createConnectorReference({
            run_id: run.run_id,
            reference: body,
            attached_by: body.attached_by || 'operator',
            attached_at: body.attached_at || new Date().toISOString()
          });

          run.connector_references = run.connector_references || [];
          run.connector_references.push(connectorReference);

          const event = createRunEvent({
            run_id: run.run_id,
            type: 'connector_reference_attached',
            status: run.status,
            message: `Connector reference attached: ${connectorReference.adapter}`,
            metadata: {
              reference_id: connectorReference.reference_id,
              adapter: connectorReference.adapter,
              resource_type: connectorReference.resource_type,
              resource_id: connectorReference.resource_id
            }
          });
          run.events.push(event);

          recordAudit({
            type: 'connector_reference',
            run_id: run.run_id,
            created_at: connectorReference.attached_at,
            payload: connectorReference
          });
          recordAudit({
            type: 'run_event',
            run_id: run.run_id,
            created_at: event.created_at,
            payload: event
          });

          persistRunStore();
          broadcastRun(run);
          sendJson(res, 201, { connector_reference: connectorReference, run: publicRun(run) });
        } catch (error) {
          sendJson(res, 400, { error: error.message });
        }
      });
      return;
    }
  }

  const approvalCommentsMatch = req.url.match(/^\/runs\/([^/]+)\/approval\/comments$/);
  if (approvalCommentsMatch) {
    const run = runs.get(approvalCommentsMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, {
        run_id: run.run_id,
        comments: run.approval_comments || []
      });
      return;
    }

    if (req.method === 'POST') {
      readJson(req, (body) => {
        try {
          const comments = run.approval_comments || [];
          const comment = createApprovalComment({
            run_id: run.run_id,
            actor: body.actor || 'operator',
            body: body.body || body.comment,
            created_at: body.created_at || new Date().toISOString(),
            index: comments.length + 1
          });
          run.approval_comments = comments;
          run.approval_comments.push(comment);

          const event = createRunEvent({
            run_id: run.run_id,
            type: 'approval_comment_added',
            status: run.status,
            message: `Approval comment added by ${comment.actor}`,
            metadata: {
              comment_id: comment.comment_id,
              actor: comment.actor
            }
          });
          run.events.push(event);

          recordAudit({
            type: 'approval_comment',
            run_id: run.run_id,
            created_at: comment.created_at,
            payload: comment
          });
          recordAudit({
            type: 'run_event',
            run_id: run.run_id,
            created_at: event.created_at,
            payload: event
          });

          persistRunStore();
          broadcastRun(run);
          sendJson(res, 201, { comment, run: publicRun(run) });
        } catch (error) {
          sendJson(res, 400, { error: error.message });
        }
      });
      return;
    }
  }

  const providerToolCallApprovalsMatch = req.url.match(/^\/runs\/([^/]+)\/provider-tool-call-approvals$/);
  if (providerToolCallApprovalsMatch) {
    const run = runs.get(providerToolCallApprovalsMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, {
        run_id: run.run_id,
        approvals: run.provider_tool_call_approvals || []
      });
      return;
    }

    if (req.method === 'POST') {
      readJson(req, (body) => {
        try {
          const approvals = run.provider_tool_call_approvals || [];
          const approval = createProviderToolCallApproval({
            ...body,
            run_id: run.run_id,
            index: approvals.length + 1
          });
          run.provider_tool_call_approvals = approvals;
          run.provider_tool_call_approvals.push(approval);
          recordAudit({
            type: 'provider_tool_call_approval',
            run_id: run.run_id,
            created_at: approval.decided_at,
            payload: approval
          });

          persistRunStore();
          broadcastRun(run);
          sendJson(res, 201, { approval, run: publicRun(run) });
        } catch (error) {
          sendJson(res, 400, { error: error.message });
        }
      });
      return;
    }
  }

  const approvalRevisionMatch = req.url.match(/^\/runs\/([^/]+)\/approval\/(revision|resubmit)$/);
  if (req.method === 'POST' && approvalRevisionMatch) {
    const run = runs.get(approvalRevisionMatch[1]);
    const action = approvalRevisionMatch[2];
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    if (action === 'revision' && run.status !== 'awaiting_approval') {
      sendJson(res, 409, { error: 'run is not awaiting approval' });
      return;
    }

    if (action === 'resubmit' && (
      run.status !== 'paused' ||
      !run.approval_revision ||
      run.approval_revision.status !== 'requested'
    )) {
      sendJson(res, 409, { error: 'run does not have a requested approval revision' });
      return;
    }

    readJson(req, (body) => {
      try {
        if (action === 'revision') {
          const revision = createApprovalRevision({
            run_id: run.run_id,
            actor: body.actor || 'operator',
            reason: body.reason,
            requested_changes: requestedChangesFromBody(body)
          });
          run.approval_revision = revision;
          recordAudit({
            type: 'approval_revision',
            run_id: run.run_id,
            created_at: revision.requested_at,
            payload: revision
          });
          run.events.push(createRunEvent({
            run_id: run.run_id,
            type: 'approval_revision_requested',
            status: run.status,
            message: 'Approval revision requested',
            metadata: revision
          }));
          run.status = 'paused';
          run.events.push(createRunEvent({
            run_id: run.run_id,
            type: 'status_changed',
            status: run.status,
            message: 'Run status changed to paused',
            metadata: { approval_revision: revision.revision_id }
          }));
        } else {
          const revision = resubmitApprovalRevision(run.approval_revision, {
            actor: body.actor || 'operator',
            reason: body.reason || ''
          });
          run.approval_revision = revision;
          recordAudit({
            type: 'approval_revision',
            run_id: run.run_id,
            created_at: revision.resubmitted_at,
            payload: revision
          });
          run.events.push(createRunEvent({
            run_id: run.run_id,
            type: 'approval_resubmitted',
            status: run.status,
            message: 'Approval revision resubmitted',
            metadata: revision
          }));
          run.status = 'awaiting_approval';
          run.events.push(createRunEvent({
            run_id: run.run_id,
            type: 'status_changed',
            status: run.status,
            message: 'Run status changed to awaiting_approval',
            metadata: { approval_revision: revision.revision_id }
          }));
        }

        for (const event of run.events.slice(-2)) {
          recordAudit({
            type: 'run_event',
            run_id: run.run_id,
            created_at: event.created_at,
            payload: event
          });
        }
        persistRunStore();
        const payload = publicRun(run);
        broadcastRun(run);
        sendJson(res, 200, payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
    });
    return;
  }

  const approvalMatch = req.url.match(/^\/runs\/([^/]+)\/approval$/);
  if (req.method === 'GET' && approvalMatch) {
    const run = runs.get(approvalMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    sendJson(res, 200, approvalSnapshot(run));
    return;
  }

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
      persistRunStore();
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
      const budgetIncidents = createBudgetIncidents({
        run_id: run.run_id,
        task: run.task,
        preflight: check,
        source: 'step_gate',
        step,
        created_at: new Date().toISOString()
      });

      run.steps.push(step);
      run.budget_incidents = run.budget_incidents || [];
      run.budget_incidents.push(...budgetIncidents);

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
        persistRunStore();
        broadcastRun(run);
        sendJson(res, 409, { error: 'run paused by hard budget cap', step, run: publicRun(run) });
      } else if (check.decision === 'allow') {
        recordBudgetIncidents(run, budgetIncidents);
        persistRunStore();
        broadcastRun(run);
        sendJson(res, 201, { step });
      } else if (check.decision === 'requires_approval') {
        recordBudgetIncidents(run, budgetIncidents);
        persistRunStore();
        broadcastRun(run);
        sendJson(res, 409, { error: 'step requires approval before execution', step });
      } else {
        recordBudgetIncidents(run, budgetIncidents);
        persistRunStore();
        broadcastRun(run);
        sendJson(res, 403, { error: 'step blocked by policy', step });
      }
    });
    return;
  }

  const stepExecuteMatch = req.url.match(/^\/runs\/([^/]+)\/steps\/([^/]+)\/execute$/);
  if (req.method === 'POST' && stepExecuteMatch) {
    const run = runs.get(stepExecuteMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    const step = run.steps.find(candidate => candidate.step_id === stepExecuteMatch[2]);
    if (!step) {
      sendJson(res, 404, { error: 'step not found' });
      return;
    }

    readJson(req, (body) => {
      const attemptState = createExecutionAttemptState({
        run,
        step,
        retry: Boolean(body.retry)
      });
      if (!attemptState.allowed) {
        sendJson(res, 409, { error: attemptState.error, retry: attemptState.retry });
        return;
      }

      run.execution_locks = run.execution_locks || [];
      recoverRunExecutionLocks(run);
      const activeLock = activeExecutionLock(run);
      if (activeLock) {
        run.active_execution_lock = activeLock;
        sendJson(res, 409, { error: 'run has active execution lock', lock: activeLock });
        return;
      }

      run.active_execution_lock = null;
      const lock = createExecutionLock({ run, step });
      run.execution_locks.push(lock);
      run.active_execution_lock = lock;
      recordExecutionLock(run, lock, 'execution_lock_acquired', `Execution lock acquired for ${step.step_id}`);
      persistRunStore();
      broadcastRun(run);

      try {
        const execution = executeStep({ run, step, cwd: executionCwdForRun(run), attemptState });
        const verification = createExecutionVerification({ run, step, execution });
        step.status = execution.status;
        step.execution = execution;
        step.verification = verification;
        run.executions.push(execution);
        run.verifications = run.verifications || [];
        run.verifications.push(verification);
        recordAudit({
          type: 'execution_record',
          run_id: run.run_id,
          created_at: execution.completed_at,
          payload: execution
        });
        recordAudit({
          type: 'verification_record',
          run_id: run.run_id,
          created_at: verification.completed_at,
          payload: verification
        });

        const event = createRunEvent({
          run_id: run.run_id,
          type: 'step_executed',
          status: run.status,
          message: `Step ${step.step_id} execution ${execution.status}`,
          metadata: {
            step_id: step.step_id,
            execution_id: execution.execution_id,
            adapter: execution.adapter,
            exit_code: execution.exit_code,
            attempt: execution.attempt,
            retry_of: execution.retry_of
          }
        });
        run.events.push(event);
        const verificationEvent = createRunEvent({
          run_id: run.run_id,
          type: 'step_verified',
          status: run.status,
          message: `Step ${step.step_id} verification ${verification.result}`,
          metadata: {
            step_id: step.step_id,
            execution_id: execution.execution_id,
            verification_id: verification.verification_id,
            result: verification.result
          }
        });
        run.events.push(verificationEvent);
        recordAudit({
          type: 'run_event',
          run_id: run.run_id,
          created_at: event.created_at,
          payload: event
        });
        recordAudit({
          type: 'run_event',
          run_id: run.run_id,
          created_at: verificationEvent.created_at,
          payload: verificationEvent
        });
        const releasedLock = releaseExecutionLock({ lock, status: 'released' });
        Object.assign(lock, releasedLock);
        run.active_execution_lock = null;
        recordExecutionLock(run, lock, 'execution_lock_released', `Execution lock released for ${step.step_id}`);
        persistRunStore();
        broadcastRun(run);
        sendJson(res, 200, { execution, verification, step, lock, run: publicRun(run) });
      } catch (error) {
        const failedLock = releaseExecutionLock({ lock, status: 'failed' });
        Object.assign(lock, failedLock);
        run.active_execution_lock = null;
        recordExecutionLock(run, lock, 'execution_lock_released', `Execution lock failed for ${step.step_id}`);
        persistRunStore();
        broadcastRun(run);
        sendJson(res, 409, { error: error.message, step });
      }
    });
    return;
  }

  const lockRecoverMatch = req.url.match(/^\/runs\/([^/]+)\/execution-locks\/recover$/);
  if (req.method === 'POST' && lockRecoverMatch) {
    const run = runs.get(lockRecoverMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    run.execution_locks = run.execution_locks || [];
    const recoveredLocks = recoverRunExecutionLocks(run);
    persistRunStore();
    broadcastRun(run);
    sendJson(res, 200, { recovered_locks: recoveredLocks, run: publicRun(run) });
    return;
  }

  const heartbeatMatch = req.url.match(/^\/runs\/([^/]+)\/heartbeat$/);
  if (req.method === 'POST' && heartbeatMatch) {
    const run = runs.get(heartbeatMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    readJson(req, (body) => {
      try {
        const heartbeat = createRunHeartbeat({
          run,
          actor: body.actor,
          status: body.status || 'alive',
          message: body.message
        });
        run.heartbeats = run.heartbeats || [];
        run.heartbeats.push(heartbeat);
        run.last_heartbeat_at = latestHeartbeatAt(run);

        recordAudit({
          type: 'heartbeat_record',
          run_id: run.run_id,
          created_at: heartbeat.recorded_at,
          payload: heartbeat
        });

        const event = createRunEvent({
          run_id: run.run_id,
          type: 'heartbeat_recorded',
          status: run.status,
          message: `Heartbeat ${heartbeat.status} from ${heartbeat.actor}`,
          metadata: {
            heartbeat_id: heartbeat.heartbeat_id,
            actor: heartbeat.actor,
            status: heartbeat.status
          }
        });
        run.events.push(event);
        recordAudit({
          type: 'run_event',
          run_id: run.run_id,
          created_at: event.created_at,
          payload: event
        });
        persistRunStore();
        broadcastRun(run);
        sendJson(res, 200, { heartbeat, run: publicRun(run) });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
    });
    return;
  }

  const workspaceCleanupMatch = req.url.match(/^\/runs\/([^/]+)\/workspace\/cleanup$/);
  if (req.method === 'POST' && workspaceCleanupMatch) {
    const run = runs.get(workspaceCleanupMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    const cleanup = cleanupRunWorkspace(run.workspace);
    if (!cleanup.cleaned) {
      sendJson(res, 409, { error: 'workspace cleanup skipped', workspace: cleanup });
      return;
    }

    run.workspace = {
      ...run.workspace,
      cleaned: true,
      cleaned_at: cleanup.cleaned_at
    };
    const event = createRunEvent({
      run_id: run.run_id,
      type: 'workspace_cleaned',
      status: run.status,
      message: 'Run workspace cleaned',
      metadata: {
        path: cleanup.path
      }
    });
    run.events.push(event);
    recordAudit({
      type: 'workspace_cleaned',
      run_id: run.run_id,
      created_at: cleanup.cleaned_at,
      payload: cleanup
    });
    recordAudit({
      type: 'run_event',
      run_id: run.run_id,
      created_at: event.created_at,
      payload: event
    });
    persistRunStore();
    broadcastRun(run);
    sendJson(res, 200, { workspace: cleanup, run: publicRun(run) });
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

  const goalCompleteMatch = req.url.match(/^\/runs\/([^/]+)\/goals\/([^/]+)\/complete$/);
  if (req.method === 'POST' && goalCompleteMatch) {
    const run = runs.get(goalCompleteMatch[1]);
    const goalId = goalCompleteMatch[2];
    if (!run) {
      sendJson(res, 404, { error: 'run not found' });
      return;
    }

    const goalIndex = (run.goals || []).findIndex(goal => goal.goal_id === goalId);
    if (goalIndex === -1) {
      sendJson(res, 404, { error: 'goal not found' });
      return;
    }

    if (run.goals[goalIndex].status === 'completed') {
      sendJson(res, 409, { error: 'goal is already completed' });
      return;
    }

    readJson(req, (body) => {
      const verificationId = String(body.verification_id || '').trim();
      if (!verificationId) {
        sendJson(res, 400, { error: 'verification_id is required' });
        return;
      }

      const verification = (run.verifications || []).find(record => record.verification_id === verificationId);
      if (!verification) {
        sendJson(res, 404, { error: 'verification not found' });
        return;
      }

      try {
        const goal = completeGoalRecord(run.goals[goalIndex], { verification });
        run.goals[goalIndex] = goal;
        recordAudit({
          type: 'goal_record',
          run_id: run.run_id,
          created_at: goal.completed_at,
          payload: goal
        });
        const event = createRunEvent({
          run_id: run.run_id,
          type: 'goal_completed',
          status: run.status,
          message: `Goal ${goal.goal_id} completed`,
          metadata: {
            goal_id: goal.goal_id,
            verification_id: verification.verification_id
          }
        });
        run.events.push(event);
        recordAudit({
          type: 'run_event',
          run_id: run.run_id,
          created_at: event.created_at,
          payload: event
        });
        persistRunStore();
        const payload = { goal, run: publicRun(run) };
        broadcastRun(run);
        sendJson(res, 200, payload);
      } catch (error) {
        sendJson(res, 409, { error: error.message });
      }
    });
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
