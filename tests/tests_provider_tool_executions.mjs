import assert from 'assert/strict';
import { createHash } from 'crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { createProviderToolCallApproval } from '../packages/provider-tool-approvals/src/index.mjs';
import { createProviderToolExecution } from '../packages/provider-tool-executions/src/index.mjs';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-provider-tool-executions-'));
const workspaceRoot = path.join(tmpRoot, 'workspace');
const secretPath = 'secret-approved-file.md';
const secretFileContents = 'secret provider tool execution file contents';
const secretSearchScope = 'secret-search-scope';
const secretSearchPath = path.join(secretSearchScope, 'secret-search-target.md');
const secretSearchQuery = 'secret provider search query';
const secretSearchContents = `visible heading\n${secretSearchQuery}\nsecret provider search file contents`;
const secretListScope = 'secret-list-scope';
const secretListNestedScope = path.join(secretListScope, 'secret-list-nested');
const secretListPath = path.join(secretListNestedScope, 'secret-list-target.md');
const secretListIgnoredPath = path.join(secretListScope, 'dist', 'secret-list-ignored.md');
const secretWriteScope = 'secret-write-scope';
const secretWritePath = path.join(secretWriteScope, 'secret-write-target.md');
const secretWriteContents = 'secret provider write file contents';
const guardedWritePath = path.join(secretWriteScope, 'guarded-write-target.md');
const guardedOriginalContents = 'original guarded content';
const guardedReplacementContents = 'guarded replacement content';

mkdirSync(workspaceRoot, { recursive: true });
mkdirSync(path.join(workspaceRoot, secretSearchScope), { recursive: true });
mkdirSync(path.join(workspaceRoot, secretListNestedScope), { recursive: true });
mkdirSync(path.join(workspaceRoot, secretListScope, 'dist'), { recursive: true });
mkdirSync(path.join(workspaceRoot, secretWriteScope), { recursive: true });
writeFileSync(path.join(workspaceRoot, secretPath), `${secretFileContents}\n`);
writeFileSync(path.join(workspaceRoot, secretSearchPath), `${secretSearchContents}\n`);
writeFileSync(path.join(workspaceRoot, secretListPath), 'secret list file contents\n');
writeFileSync(path.join(workspaceRoot, secretListIgnoredPath), 'secret ignored list file contents\n');

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

  const listApproval = createProviderToolCallApproval({
    run_id: 'run_tool_execution',
    tool_call_id: 'call_list_files_1',
    provider_id: 'custom_openai_compatible',
    transport: 'chat_completions',
    name: 'list_files',
    argument_keys: ['path', 'max_depth'],
    arguments_redacted: true,
    decision: 'approve',
    actor: 'operator@example.com',
    reason: 'Read-only repository shape listing is approved.',
    decided_at: '2026-05-25T12:03:00Z',
    index: 6
  });

  const listExecution = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: listApproval,
    argument_values: { path: secretListScope, max_depth: 4 },
    workspace_root: workspaceRoot,
    actor: 'operator@example.com',
    reason: 'Execute the approved redacted repository listing.',
    operator_summary: 'Operator reviewed the listing result: scoped project files are present.',
    started_at: '2026-05-25T12:03:01Z',
    completed_at: '2026-05-25T12:03:02Z',
    index: 6
  });

  assert.equal(listExecution.status, 'completed');
  assert.equal(listExecution.adapter, 'list_files');
  assert.equal(listExecution.operator_summary, 'Operator reviewed the listing result: scoped project files are present.');
  assert.equal(listExecution.operator_summary_source, 'operator');
  assert.deepEqual(listExecution.argument_keys, ['max_depth', 'path']);
  assert.equal(listExecution.output_redacted, true);
  assert.equal(listExecution.output_metadata.files_listed, 1);
  assert.equal(listExecution.output_metadata.directories_scanned, 2);
  assert.equal(listExecution.output_metadata.max_depth, 4);
  assert.equal(listExecution.output_metadata.paths_redacted, true);
  assert.equal(listExecution.output_metadata.content_redacted, true);
  assert.equal(JSON.stringify(listExecution).includes(secretListScope), false);
  assert.equal(JSON.stringify(listExecution).includes('secret-list-nested'), false);
  assert.equal(JSON.stringify(listExecution).includes('secret-list-target.md'), false);
  assert.equal(JSON.stringify(listExecution).includes('secret ignored list file contents'), false);

  const listTraversal = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: listApproval,
    argument_values: { path: '../outside-list', max_depth: 1 },
    workspace_root: workspaceRoot,
    reason: 'List path traversal must fail closed.',
    index: 7
  });

  assert.equal(listTraversal.status, 'failed');
  assert.equal(listTraversal.adapter, 'list_files');
  assert.match(listTraversal.error, /workspace/);
  assert.equal(JSON.stringify(listTraversal).includes('../outside-list'), false);

  const writeApproval = createProviderToolCallApproval({
    run_id: 'run_tool_execution',
    tool_call_id: 'call_write_file_1',
    provider_id: 'custom_openai_compatible',
    transport: 'chat_completions',
    name: 'write_file',
    argument_keys: ['path', 'content'],
    arguments_redacted: true,
    decision: 'approve',
    actor: 'operator@example.com',
    reason: 'Repository file write is approved.',
    decided_at: '2026-05-26T12:04:00Z',
    index: 8
  });

  const writeExecution = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: writeApproval,
    argument_values: { path: secretWritePath, content: secretWriteContents },
    workspace_root: workspaceRoot,
    actor: 'operator@example.com',
    reason: 'Execute the approved redacted repository write.',
    operator_summary: 'Operator reviewed the write request: safe replacement content is approved.',
    started_at: '2026-05-26T12:04:01Z',
    completed_at: '2026-05-26T12:04:02Z',
    index: 8
  });

  assert.equal(writeExecution.status, 'completed');
  assert.equal(writeExecution.adapter, 'write_file');
  assert.equal(writeExecution.operator_summary, 'Operator reviewed the write request: safe replacement content is approved.');
  assert.equal(writeExecution.operator_summary_source, 'operator');
  assert.deepEqual(writeExecution.argument_keys, ['content', 'path']);
  assert.equal(writeExecution.output_redacted, true);
  assert.deepEqual(writeExecution.output_metadata, {
    bytes_written: 35,
    line_count: 1,
    path_redacted: true,
    content_redacted: true
  });
  assert.equal(readFileSync(path.join(workspaceRoot, secretWritePath), 'utf8'), secretWriteContents);
  assert.equal(JSON.stringify(writeExecution).includes(secretWritePath), false);
  assert.equal(JSON.stringify(writeExecution).includes(secretWriteContents), false);

  writeFileSync(path.join(workspaceRoot, guardedWritePath), guardedOriginalContents);
  const guardedWriteApproval = createProviderToolCallApproval({
    run_id: 'run_tool_execution',
    tool_call_id: 'call_guarded_write_file_1',
    provider_id: 'custom_openai_compatible',
    transport: 'chat_completions',
    name: 'write_file',
    argument_keys: ['path', 'content', 'expected_sha256'],
    arguments_redacted: true,
    decision: 'approve',
    actor: 'operator@example.com',
    reason: 'Repository file write with stale-file guard is approved.',
    decided_at: '2026-05-26T12:05:00Z',
    index: 9
  });

  const guardedWriteExecution = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: guardedWriteApproval,
    argument_values: {
      path: guardedWritePath,
      content: guardedReplacementContents,
      expected_sha256: sha256(guardedOriginalContents)
    },
    workspace_root: workspaceRoot,
    actor: 'operator@example.com',
    reason: 'Execute the approved guarded write request.',
    operator_summary: 'Operator reviewed the guarded write request: file precondition matches.',
    started_at: '2026-05-26T12:05:01Z',
    completed_at: '2026-05-26T12:05:02Z',
    index: 9
  });

  assert.equal(guardedWriteExecution.status, 'completed');
  assert.equal(guardedWriteExecution.adapter, 'write_file');
  assert.deepEqual(guardedWriteExecution.argument_keys, ['content', 'expected_sha256', 'path']);
  assert.equal(guardedWriteExecution.output_metadata.expected_sha256_checked, true);
  assert.equal(guardedWriteExecution.output_metadata.expected_sha256_matched, true);
  assert.equal(guardedWriteExecution.output_metadata.expected_sha256_redacted, true);
  assert.equal(readFileSync(path.join(workspaceRoot, guardedWritePath), 'utf8'), guardedReplacementContents);
  assert.equal(JSON.stringify(guardedWriteExecution).includes(guardedWritePath), false);
  assert.equal(JSON.stringify(guardedWriteExecution).includes(guardedOriginalContents), false);
  assert.equal(JSON.stringify(guardedWriteExecution).includes(guardedReplacementContents), false);
  assert.equal(JSON.stringify(guardedWriteExecution).includes(sha256(guardedOriginalContents)), false);

  const staleWriteExecution = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: guardedWriteApproval,
    argument_values: {
      path: guardedWritePath,
      content: 'stale content must not be written',
      expected_sha256: sha256(guardedOriginalContents)
    },
    workspace_root: workspaceRoot,
    actor: 'operator@example.com',
    reason: 'Reject stale guarded write request.',
    started_at: '2026-05-26T12:05:03Z',
    completed_at: '2026-05-26T12:05:04Z',
    index: 10
  });

  assert.equal(staleWriteExecution.status, 'failed');
  assert.equal(staleWriteExecution.adapter, 'write_file');
  assert.match(staleWriteExecution.error, /expected_sha256/);
  assert.equal(staleWriteExecution.output_metadata.expected_sha256_checked, true);
  assert.equal(staleWriteExecution.output_metadata.expected_sha256_matched, false);
  assert.equal(staleWriteExecution.output_metadata.expected_sha256_redacted, true);
  assert.equal(readFileSync(path.join(workspaceRoot, guardedWritePath), 'utf8'), guardedReplacementContents);
  assert.equal(JSON.stringify(staleWriteExecution).includes(guardedWritePath), false);
  assert.equal(JSON.stringify(staleWriteExecution).includes('stale content must not be written'), false);
  assert.equal(JSON.stringify(staleWriteExecution).includes(sha256(guardedOriginalContents)), false);

  const invalidGuardWriteExecution = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: guardedWriteApproval,
    argument_values: {
      path: guardedWritePath,
      content: 'invalid guard content must not be written',
      expected_sha256: 'not-a-sha'
    },
    workspace_root: workspaceRoot,
    actor: 'operator@example.com',
    reason: 'Reject invalid guarded write request.',
    started_at: '2026-05-26T12:05:05Z',
    completed_at: '2026-05-26T12:05:06Z',
    index: 11
  });

  assert.equal(invalidGuardWriteExecution.status, 'failed');
  assert.equal(invalidGuardWriteExecution.adapter, 'write_file');
  assert.match(invalidGuardWriteExecution.error, /expected_sha256/);
  assert.equal(invalidGuardWriteExecution.output_metadata.expected_sha256_checked, true);
  assert.equal(invalidGuardWriteExecution.output_metadata.expected_sha256_matched, false);
  assert.equal(invalidGuardWriteExecution.output_metadata.expected_sha256_redacted, true);
  assert.equal(readFileSync(path.join(workspaceRoot, guardedWritePath), 'utf8'), guardedReplacementContents);
  assert.equal(JSON.stringify(invalidGuardWriteExecution).includes(guardedWritePath), false);
  assert.equal(JSON.stringify(invalidGuardWriteExecution).includes('invalid guard content must not be written'), false);
  assert.equal(JSON.stringify(invalidGuardWriteExecution).includes('not-a-sha'), false);

  const uppercaseGuardWriteExecution = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: guardedWriteApproval,
    argument_values: {
      path: guardedWritePath,
      content: 'uppercase guard content must not be written',
      expected_sha256: sha256(guardedReplacementContents).toUpperCase()
    },
    workspace_root: workspaceRoot,
    actor: 'operator@example.com',
    reason: 'Reject uppercase guarded write request.',
    started_at: '2026-05-26T12:05:07Z',
    completed_at: '2026-05-26T12:05:08Z',
    index: 12
  });

  assert.equal(uppercaseGuardWriteExecution.status, 'failed');
  assert.equal(uppercaseGuardWriteExecution.adapter, 'write_file');
  assert.match(uppercaseGuardWriteExecution.error, /expected_sha256/);
  assert.equal(uppercaseGuardWriteExecution.output_metadata.expected_sha256_checked, true);
  assert.equal(uppercaseGuardWriteExecution.output_metadata.expected_sha256_matched, false);
  assert.equal(uppercaseGuardWriteExecution.output_metadata.expected_sha256_redacted, true);
  assert.equal(readFileSync(path.join(workspaceRoot, guardedWritePath), 'utf8'), guardedReplacementContents);
  assert.equal(JSON.stringify(uppercaseGuardWriteExecution).includes(guardedWritePath), false);
  assert.equal(JSON.stringify(uppercaseGuardWriteExecution).includes('uppercase guard content must not be written'), false);
  assert.equal(JSON.stringify(uppercaseGuardWriteExecution).includes(sha256(guardedReplacementContents).toUpperCase()), false);

  const writeTraversal = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: writeApproval,
    argument_values: { path: '../outside-write.md', content: secretWriteContents },
    workspace_root: workspaceRoot,
    reason: 'Write path traversal must fail closed.',
    index: 13
  });

  assert.equal(writeTraversal.status, 'failed');
  assert.equal(writeTraversal.adapter, 'write_file');
  assert.match(writeTraversal.error, /workspace/);
  assert.equal(JSON.stringify(writeTraversal).includes('../outside-write.md'), false);
  assert.equal(JSON.stringify(writeTraversal).includes(secretWriteContents), false);

  const protectedWrite = createProviderToolExecution({
    run_id: 'run_tool_execution',
    approval: writeApproval,
    argument_values: { path: '.git/config', content: secretWriteContents },
    workspace_root: workspaceRoot,
    reason: 'Protected workspace paths must fail closed.',
    index: 14
  });

  assert.equal(protectedWrite.status, 'failed');
  assert.equal(protectedWrite.adapter, 'write_file');
  assert.match(protectedWrite.error, /protected/);
  assert.equal(JSON.stringify(protectedWrite).includes('.git/config'), false);
  assert.equal(JSON.stringify(protectedWrite).includes(secretWriteContents), false);
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, test: 'provider-tool-executions' }));
