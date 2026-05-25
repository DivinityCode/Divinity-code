import assert from 'assert/strict';

import { createProviderToolCallApproval } from '../packages/provider-tool-approvals/src/index.mjs';

const secretArgumentValue = 'secret-provider-tool-argument';
const request = {
  format: 'divinity.provider_tool_call_request.v1',
  tool_call_id: 'call_search_1',
  provider_id: 'custom_openai_compatible',
  transport: 'chat_completions',
  name: 'web_search',
  argument_keys: ['query', 'scope'].reverse(),
  arguments_redacted: true,
  status: 'requires_operator_approval'
};

{
  const approval = createProviderToolCallApproval({
    run_id: 'run_tool_approval',
    tool_call_request: request,
    decision: 'approve',
    actor: 'operator@example.com',
    reason: 'Public documentation search is approved.',
    decided_at: '2026-05-25T12:00:00Z',
    index: 1
  });

  assert.equal(approval.format, 'divinity.provider_tool_call_approval.v1');
  assert.equal(approval.approval_id, 'provider_tool_call_approval_run_tool_approval_call_search_1_001');
  assert.equal(approval.run_id, 'run_tool_approval');
  assert.equal(approval.tool_call_id, 'call_search_1');
  assert.equal(approval.provider_id, 'custom_openai_compatible');
  assert.equal(approval.transport, 'chat_completions');
  assert.equal(approval.name, 'web_search');
  assert.deepEqual(approval.argument_keys, ['query', 'scope']);
  assert.equal(approval.arguments_redacted, true);
  assert.equal(approval.decision, 'approve');
  assert.equal(approval.actor, 'operator@example.com');
  assert.equal(approval.reason, 'Public documentation search is approved.');
  assert.equal(approval.decided_at, '2026-05-25T12:00:00Z');
  assert.equal(JSON.stringify(approval).includes(secretArgumentValue), false);
}

{
  const rejection = createProviderToolCallApproval({
    run_id: 'run_tool_approval',
    tool_call_id: 'call_patch_1',
    provider_id: 'custom_openai_responses',
    transport: 'codex_responses',
    name: 'patch_file',
    argument_keys: ['file'],
    arguments_redacted: true,
    decision: 'reject',
    actor: '',
    reason: 'Do not patch files from a provider tool call.',
    decided_at: '2026-05-25T12:01:00Z',
    index: 2
  });

  assert.equal(rejection.approval_id, 'provider_tool_call_approval_run_tool_approval_call_patch_1_002');
  assert.equal(rejection.decision, 'reject');
  assert.equal(rejection.actor, 'operator');
}

assert.throws(() => createProviderToolCallApproval({
  run_id: 'run_tool_approval',
  tool_call_request: request,
  decision: 'maybe',
  reason: 'invalid'
}), /provider tool-call approval decision must be approve or reject/);

assert.throws(() => createProviderToolCallApproval({
  run_id: 'run_tool_approval',
  tool_call_request: {
    ...request,
    arguments_redacted: false
  },
  decision: 'approve',
  reason: 'invalid'
}), /provider tool-call request arguments must be redacted/);

assert.throws(() => createProviderToolCallApproval({
  run_id: 'run_tool_approval',
  tool_call_request: {
    ...request,
    arguments: JSON.stringify({ query: secretArgumentValue })
  },
  decision: 'approve',
  reason: 'invalid'
}), /provider tool-call request must not include raw arguments/);

assert.throws(() => createProviderToolCallApproval({
  run_id: 'run_tool_approval',
  tool_call_id: 'call_direct_raw',
  provider_id: 'custom_openai_compatible',
  transport: 'chat_completions',
  name: 'web_search',
  argument_keys: ['query'],
  arguments_redacted: true,
  arguments: JSON.stringify({ query: secretArgumentValue }),
  decision: 'approve',
  reason: 'invalid'
}), /provider tool-call request must not include raw arguments/);

console.log(JSON.stringify({ ok: true, test: 'provider-tool-approvals' }));
