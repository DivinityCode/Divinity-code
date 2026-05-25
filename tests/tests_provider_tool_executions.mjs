import assert from 'assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { createProviderToolCallApproval } from '../packages/provider-tool-approvals/src/index.mjs';
import { createProviderToolExecution } from '../packages/provider-tool-executions/src/index.mjs';

const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-provider-tool-executions-'));
const workspaceRoot = path.join(tmpRoot, 'workspace');
const secretPath = 'secret-approved-file.md';
const secretFileContents = 'secret provider tool execution file contents';
const secretSearchScope = 'secret-search-scope';
const secretSearchPath = path.join(secretSearchScope, 'secret-search-target.md');
const secretSearchQuery = 'secret provider search query';
const secretSearchContents = `visible heading\n${secretSearchQuery}\nsecret provider search file contents`;

mkdirSync(workspaceRoot, { recursive: true });
mkdirSync(path.join(workspaceRoot, secretSearchScope), { recursive: true });
writeFileSync(path.join(workspaceRoot, secretPath), `${secretFileContents}\n`);
writeFileSync(path.join(workspaceRoot, secretSearchPath), `${secretSearchContents}\n`);

const approval = createProviderToolCallApproval({
  run_id: 'run_tool_execution',
  tool_call_id: 'call_read_1',
  provider_id: 'custom_openai_compatible',
  transport: 'chat_completions',
  name: 'read_file',
  argument_keys: ['path'],
  arguments_redacted: true,
  decision: 'approve',
  actor: 'operator@example.com',
  reason: 'Read-only file context is approved.',
  decided_at: '2026-05-25T12:00:00Z',
  index: 1
});

try {
  const execution = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval,
    argument_values: { path: secretPath },
    workspace_root: workspaceRoot,
    actor: 'operator@example.com',
    reason: 'Execute the approved read-only file request.',
    operator_summary: 'Operator reviewed the file result: safe configuration context is available.',
    started_at: '2026-05-25T12:01:00Z',
    completed_at: '2026-05-25T12:01:01Z',
    index: 1
  });

  assert.equal(execution.format, 'divinity.provider_tool_execution.v1');
  assert.equal(execution.execution_id, 'provider_tool_execution_run_tool_execution_call_read_1_001');
  assert.equal(execution.run_id, 'run_tool_execution');
  assert.equal(execution.approval_id, approval.approval_id);
  assert.equal(execution.tool_call_id, 'call_read_1');
  assert.equal(execution.provider_id, 'custom_openai_compatible');
  assert.equal(execution.transport, 'chat_completions');
  assert.equal(execution.name, 'read_file');
  assert.deepEqual(execution.argument_keys, ['path']);
  assert.equal(execution.arguments_redacted, true);
  assert.equal(execution.status, 'completed');
  assert.equal(execution.adapter, 'read_file');
  assert.equal(execution.actor, 'operator@example.com');
  assert.equal(execution.reason, 'Execute the approved read-only file request.');
  assert.equal(execution.operator_summary, 'Operator reviewed the file result: safe configuration context is available.');
  assert.equal(execution.operator_summary_source, 'operator');
  assert.equal(execution.started_at, '2026-05-25T12:01:00Z');
  assert.equal(execution.completed_at, '2026-05-25T12:01:01Z');
  assert.equal(execution.output_redacted, true);
  assert.deepEqual(execution.output_metadata, {
    bytes_read: 45,
    line_count: 2,
    content_redacted: true
  });
  assert.equal(JSON.stringify(execution).includes(secretPath), false);
  assert.equal(JSON.stringify(execution).includes(secretFileContents), false);

  assert.throws(() => createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval,
    argument_values: { path: secretPath },
    workspace_root: workspaceRoot,
    reason: 'Raw argument values must not appear in operator summaries.',
    operator_summary: `Operator reviewed ${secretPath}.`
  }), /operator summary must not include raw argument values/);

  const unsupported = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: {
      ...approval,
      approval_id: 'provider_tool_call_approval_run_tool_execution_call_search_1_002',
      tool_call_id: 'call_search_1',
      name: 'web_search',
      argument_keys: ['query']
    },
    argument_values: { query: 'secret web search query' },
    workspace_root: workspaceRoot,
    reason: 'Unsupported tools must not execute automatically.',
    index: 2
  });

  assert.equal(unsupported.status, 'blocked');
  assert.equal(unsupported.adapter, 'unsupported');
  assert.equal(unsupported.output_redacted, true);
  assert.match(unsupported.error, /unsupported provider tool execution adapter/);
  assert.equal(JSON.stringify(unsupported).includes('secret web search query'), false);

  assert.throws(() => createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: {
      ...approval,
      decision: 'reject'
    },
    argument_values: { path: secretPath },
    workspace_root: workspaceRoot,
    reason: 'Rejected approvals cannot execute.'
  }), /approved provider tool-call approval/);

  assert.throws(() => createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval,
    argument_values: { file: secretPath },
    workspace_root: workspaceRoot,
    reason: 'Argument keys do not match.'
  }), /argument keys must exactly match/);

  const traversal = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval,
    argument_values: { path: '../outside.md' },
    workspace_root: workspaceRoot,
    reason: 'Path traversal must fail closed.',
    index: 3
  });

  assert.equal(traversal.status, 'failed');
  assert.equal(traversal.adapter, 'read_file');
  assert.match(traversal.error, /workspace/);
  assert.equal(JSON.stringify(traversal).includes('../outside.md'), false);

  const searchApproval = createProviderToolCallApproval({
    run_id: 'run_tool_execution',
    tool_call_id: 'call_search_files_1',
    provider_id: 'custom_openai_compatible',
    transport: 'chat_completions',
    name: 'search_files',
    argument_keys: ['query', 'path'],
    arguments_redacted: true,
    decision: 'approve',
    actor: 'operator@example.com',
    reason: 'Read-only repository search is approved.',
    decided_at: '2026-05-25T12:02:00Z',
    index: 4
  });

  const searchExecution = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: searchApproval,
    argument_values: { path: secretSearchScope, query: secretSearchQuery },
    workspace_root: workspaceRoot,
    actor: 'operator@example.com',
    reason: 'Execute the approved redacted repository search.',
    operator_summary: 'Operator reviewed the search result: related implementation references were found.',
    started_at: '2026-05-25T12:02:01Z',
    completed_at: '2026-05-25T12:02:02Z',
    index: 4
  });

  assert.equal(searchExecution.status, 'completed');
  assert.equal(searchExecution.adapter, 'search_files');
  assert.equal(searchExecution.operator_summary, 'Operator reviewed the search result: related implementation references were found.');
  assert.equal(searchExecution.operator_summary_source, 'operator');
  assert.deepEqual(searchExecution.argument_keys, ['path', 'query']);
  assert.equal(searchExecution.output_redacted, true);
  assert.equal(searchExecution.output_metadata.files_scanned, 1);
  assert.equal(searchExecution.output_metadata.match_count, 1);
  assert.equal(searchExecution.output_metadata.matching_files_count, 1);
  assert.equal(searchExecution.output_metadata.query_redacted, true);
  assert.equal(searchExecution.output_metadata.paths_redacted, true);
  assert.equal(searchExecution.output_metadata.content_redacted, true);
  assert.equal(JSON.stringify(searchExecution).includes(secretSearchScope), false);
  assert.equal(JSON.stringify(searchExecution).includes('secret-search-target.md'), false);
  assert.equal(JSON.stringify(searchExecution).includes(secretSearchQuery), false);
  assert.equal(JSON.stringify(searchExecution).includes(secretSearchContents), false);

  const searchTraversal = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: searchApproval,
    argument_values: { path: '../outside-search', query: secretSearchQuery },
    workspace_root: workspaceRoot,
    reason: 'Search path traversal must fail closed.',
    index: 5
  });

  assert.equal(searchTraversal.status, 'failed');
  assert.equal(searchTraversal.adapter, 'search_files');
  assert.match(searchTraversal.error, /workspace/);
  assert.equal(JSON.stringify(searchTraversal).includes('../outside-search'), false);
  assert.equal(JSON.stringify(searchTraversal).includes(secretSearchQuery), false);
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, test: 'provider-tool-executions' }));
