import assert from 'assert/strict';
import { execFile } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import http from 'http';
import { tmpdir } from 'os';
import path from 'path';
import { promisify } from 'util';

const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-cli-provider-proxy-chat-'));
const repoFixture = path.join(tmpRoot, 'repo');
const usageLedgerPath = path.join(tmpRoot, 'provider-usage-ledger.json');
mkdirSync(repoFixture);
writeFileSync(path.join(repoFixture, 'README.md'), '# Provider Proxy CLI Fixture\n');

process.env.DIVINITY_API_AUTOSTART = '0';
process.env.DIVINITY_WORKSPACE_ROOT = path.join(tmpRoot, 'workspaces');
const { server: apiServer } = await import('../apps/api/src/server.mjs');

const execFileAsync = promisify(execFile);

async function createMockChatServer(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', chunk => rawBody += chunk);
    req.on('end', () => {
      const body = rawBody ? JSON.parse(rawBody) : {};
      requests.push({ req, body });
      if (handler) {
        handler({ req, res, body });
        return;
      }
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        id: 'chatcmpl_cli_mock',
        object: 'chat.completion',
        model: body.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'cli mock response' },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 4,
          completion_tokens: 3,
          total_tokens: 7
        }
      }));
    });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    base_url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    })
  };
}

async function runCli(args, env = {}) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env
      },
      timeout: 5000
    }
  );
  return JSON.parse(stdout);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  return { response, body: await response.json() };
}

function writeSse(res, events) {
  res.statusCode = 200;
  res.setHeader('content-type', 'text/event-stream');
  for (const event of events) {
    if (event.event) res.write(`event: ${event.event}\n`);
    res.write(`data: ${typeof event.data === 'string' ? event.data : JSON.stringify(event.data)}\n\n`);
  }
  res.end();
}

const apiSecret = 'openrouter-secret-value';
const secretPrompt = 'secret prompt for cli proxy';
const toolSecret = 'secret tool argument for cli proxy';
const continuationSecretPath = 'secret-cli-continuation-file.md';
const continuationSecretOutput = 'secret cli continuation file contents';
const continuationExecutionFile = path.join(tmpRoot, 'provider-tool-execution.json');
const invalidContinuationExecutionFile = path.join(tmpRoot, 'provider-tool-execution.invalid.json');
writeFileSync(continuationExecutionFile, `${JSON.stringify({
  format: 'divinity.provider_tool_execution.v1',
  execution_id: 'provider_tool_execution_cli_run_context_call_read_context_001',
  run_id: 'cli_run_context',
  approval_id: 'provider_tool_call_approval_cli_run_context_call_read_context_001',
  tool_call_id: 'call_cli_read_context',
  provider_id: 'custom_openai_compatible',
  transport: 'chat_completions',
  name: 'read_file',
  argument_keys: ['path'],
  arguments_redacted: true,
  argument_values: { path: continuationSecretPath },
  status: 'completed',
  adapter: 'read_file',
  actor: 'cli@example.com',
  reason: 'Approved CLI read-only continuation context.',
  started_at: '2026-05-25T12:10:00Z',
  completed_at: '2026-05-25T12:10:01Z',
  output_summary: 'read_file completed; content redacted',
  output_redacted: true,
  output_metadata: {
    bytes_read: 4096,
    line_count: 40,
    content_redacted: true,
    path: continuationSecretPath,
    raw_output: continuationSecretOutput
  },
  output: continuationSecretOutput
}, null, 2)}\n`);
writeFileSync(invalidContinuationExecutionFile, '{not valid json\n');
const server = await createMockChatServer();
const toolCallServer = await createMockChatServer(({ res }) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'chatcmpl_cli_tool_mock',
    object: 'chat.completion',
    model: 'mock-model',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_cli_search',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: toolSecret })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 4,
      completion_tokens: 3,
      total_tokens: 7
    }
  }));
});
const responsesServer = await createMockChatServer(({ req, res, body }) => {
  assert.equal(req.url, '/responses');
  assert.equal(body.max_output_tokens, 24);
  assert.equal('max_completion_tokens' in body, false);
  assert.equal('max_tokens' in body, false);
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'resp_cli_mock',
    object: 'response',
    status: 'completed',
    model: body.model,
    output: [
      {
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'cli responses mock', annotations: [] }]
      }
    ],
    usage: {
      input_tokens: 4,
      output_tokens: 3,
      total_tokens: 7
    }
  }));
});
const continuationServer = await createMockChatServer(({ req, res, body }) => {
  assert.equal(req.url, '/chat/completions');
  assert.equal(body.model, 'mock-model');
  assert.equal(body.messages.length, 2);
  assert.deepEqual(body.messages[0], { role: 'user', content: secretPrompt });
  const continuation = body.messages[1];
  assert.equal(continuation.role, 'user');
  assert.match(continuation.content, /Approved provider tool execution summaries/);
  assert.match(continuation.content, /provider_tool_execution_cli_run_context_call_read_context_001/);
  assert.match(continuation.content, /call_cli_read_context/);
  assert.match(continuation.content, /read_file/);
  assert.match(continuation.content, /bytes_read/);
  assert.match(continuation.content, /line_count/);
  assert.equal(continuation.content.includes(continuationSecretPath), false);
  assert.equal(continuation.content.includes(continuationSecretOutput), false);

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'chatcmpl_cli_continuation_mock',
    object: 'chat.completion',
    model: body.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'cli continuation response' },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 12,
      completion_tokens: 3,
      total_tokens: 15
    }
  }));
});
const streamServer = await createMockChatServer(({ req, res, body }) => {
  assert.equal(req.url, '/chat/completions');
  assert.equal(body.stream, true);
  assert.equal(body.max_completion_tokens, 16);
  writeSse(res, [
    {
      data: {
        id: 'chatcmpl_cli_stream',
        object: 'chat.completion.chunk',
        model: body.model,
        choices: [{ index: 0, delta: { content: 'cli ' }, finish_reason: null }]
      }
    },
    {
      data: {
        id: 'chatcmpl_cli_stream',
        object: 'chat.completion.chunk',
        model: body.model,
        choices: [{ index: 0, delta: { content: 'stream' }, finish_reason: 'stop' }]
      }
    },
    { data: '[DONE]' }
  ]);
});

try {
  await new Promise(resolve => apiServer.listen(0, '127.0.0.1', resolve));
  const { port } = apiServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const { body: approvalRun } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_cli_provider_tool_approval',
      objective: 'Review a CLI provider tool approval',
      repo: repoFixture,
      policy_id: 'safe_exec',
      created_at: '2026-05-25T12:00:00Z'
    })
  });

  const completed = await runCli([
    'provider-chat',
    '--provider', 'custom_openai_compatible',
    '--base-url', server.base_url,
    '--model', 'mock-model',
    '--message', secretPrompt,
    '--max-completion-tokens', '32'
  ], {
    CUSTOM_LLM_API_KEY: apiSecret,
    DIVINITY_PROVIDER_USAGE_LEDGER_PATH: usageLedgerPath
  });

  assert.equal(completed.ok, true);
  assert.equal(completed.command, 'provider-chat');
  assert.equal(completed.result.format, 'divinity.provider_proxy_chat_result.v1');
  assert.equal(completed.result.status, 'completed');
  assert.equal(completed.result.message.content, 'cli mock response');
  assert.equal(completed.result.usage_ledger_record.provider_id, 'custom_openai_compatible');
  assert.equal(completed.result.usage_ledger_record.model, 'mock-model');
  assert.equal(completed.result.usage_ledger_record.request_count, 1);
  assert.equal(completed.result.usage_ledger_record.input_tokens, 4);
  assert.equal(completed.result.usage_ledger_record.output_tokens, 3);
  assert.equal(completed.result.usage_ledger_record.total_tokens, 7);
  assert.equal(server.requests.length, 1);
  assert.equal(JSON.stringify(completed).includes(secretPrompt), false);
  assert.equal(JSON.stringify(completed).includes(apiSecret), false);

  const usageBlocked = await runCli([
    'provider-chat',
    '--provider', 'custom_openai_compatible',
    '--base-url', server.base_url,
    '--model', 'mock-model',
    '--message', secretPrompt,
    '--max-completion-tokens', '32',
    '--max-daily-requests', '1'
  ], {
    CUSTOM_LLM_API_KEY: apiSecret,
    DIVINITY_PROVIDER_USAGE_LEDGER_PATH: usageLedgerPath
  });

  assert.equal(usageBlocked.ok, false);
  assert.equal(usageBlocked.result.status, 'blocked');
  assert.match(usageBlocked.result.error, /daily request budget/);
  assert.equal(server.requests.length, 1);
  assert.equal(JSON.stringify(usageBlocked).includes(secretPrompt), false);
  assert.equal(JSON.stringify(usageBlocked).includes(apiSecret), false);

  const continuationCompleted = await runCli([
    'provider-chat',
    '--provider', 'custom_openai_compatible',
    '--base-url', continuationServer.base_url,
    '--model', 'mock-model',
    '--message', secretPrompt,
    '--max-completion-tokens', '32',
    '--tool-execution-file', continuationExecutionFile
  ], {
    CUSTOM_LLM_API_KEY: apiSecret
  });

  assert.equal(continuationCompleted.ok, true);
  assert.equal(continuationCompleted.result.status, 'completed');
  assert.equal(continuationCompleted.result.output_text, 'cli continuation response');
  assert.equal(continuationServer.requests.length, 1);
  assert.equal(JSON.stringify(continuationCompleted).includes(continuationSecretPath), false);
  assert.equal(JSON.stringify(continuationCompleted).includes(continuationSecretOutput), false);
  assert.equal(JSON.stringify(continuationCompleted).includes(secretPrompt), false);
  assert.equal(JSON.stringify(continuationCompleted).includes(apiSecret), false);

  const invalidContinuationFile = await runCli([
    'provider-chat',
    '--provider', 'custom_openai_compatible',
    '--base-url', continuationServer.base_url,
    '--model', 'mock-model',
    '--message', secretPrompt,
    '--tool-execution-file', invalidContinuationExecutionFile
  ], {
    CUSTOM_LLM_API_KEY: apiSecret
  });

  assert.equal(invalidContinuationFile.ok, false);
  assert.match(invalidContinuationFile.error, /failed to read provider tool execution file/);
  assert.equal(continuationServer.requests.length, 1);
  assert.equal(JSON.stringify(invalidContinuationFile).includes(continuationSecretOutput), false);
  assert.equal(JSON.stringify(invalidContinuationFile).includes(apiSecret), false);

  const toolCall = await runCli([
    'provider-chat',
    '--provider', 'custom_openai_compatible',
    '--base-url', toolCallServer.base_url,
    '--model', 'mock-model',
    '--message', secretPrompt,
    '--max-completion-tokens', '32'
  ], {
    CUSTOM_LLM_API_KEY: apiSecret
  });

  assert.equal(toolCall.ok, false);
  assert.equal(toolCall.result.status, 'requires_action');
  assert.equal(toolCall.result.tool_call_requests[0].name, 'web_search');
  assert.deepEqual(toolCall.result.tool_call_requests[0].argument_keys, ['query']);
  assert.equal(toolCall.result.tool_call_requests[0].arguments_redacted, true);
  assert.equal(toolCall.result.operator_controls[0].control_id, 'tool_call_review');
  assert.equal(JSON.stringify(toolCall).includes(toolSecret), false);
  assert.equal(JSON.stringify(toolCall).includes(secretPrompt), false);
  assert.equal(JSON.stringify(toolCall).includes(apiSecret), false);

  const blocked = await runCli([
    'provider-chat',
    '--provider', 'custom_openai_compatible',
    '--base-url', server.base_url,
    '--message', secretPrompt,
    '--max-prompt-chars', '3'
  ], {
    CUSTOM_LLM_API_KEY: apiSecret
  });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.result.status, 'blocked');
  assert.match(blocked.result.error, /prompt budget/);
  assert.equal(server.requests.length, 1);

  const exfilBlocked = await runCli([
    'provider-chat',
    '--provider', 'openrouter',
    '--base-url', server.base_url,
    '--message', secretPrompt,
    '--max-completion-tokens', '32'
  ], {
    OPENROUTER_API_KEY: apiSecret
  });

  assert.equal(exfilBlocked.ok, false);
  assert.equal(exfilBlocked.result.status, 'blocked');
  assert.match(exfilBlocked.result.error, /base_url overrides/);
  assert.equal(server.requests.length, 1);
  assert.equal(JSON.stringify(exfilBlocked).includes(apiSecret), false);

  const incompatiblePrompt = 'secret prompt for cli incompatible provider';
  const incompatible = await runCli([
    'provider-chat',
    '--provider', 'cerebras',
    '--toolset', 'web',
    '--message', incompatiblePrompt,
    '--max-prompt-chars', '1'
  ], {
    CEREBRAS_API_KEY: 'cerebras-secret'
  });

  assert.equal(incompatible.ok, false);
  assert.equal(incompatible.error, undefined);
  assert.equal(incompatible.result.status, 'blocked');
  assert.match(incompatible.result.error, /provider missing required tool capability/);
  assert.equal(incompatible.result.toolset_resolution.provider_capability_checks[0].status, 'missing');
  assert.equal(
    incompatible.result.toolset_resolution.operator_controls[0].control_id,
    'provider_capability_review'
  );
  assert.equal(JSON.stringify(incompatible).includes(incompatiblePrompt), false);
  assert.equal(JSON.stringify(incompatible).includes('cerebras-secret'), false);

  const responsesCompleted = await runCli([
    'provider-chat',
    '--provider', 'custom_openai_responses',
    '--base-url', responsesServer.base_url,
    '--model', 'gpt-mock',
    '--message', secretPrompt,
    '--max-output-tokens', '24'
  ], {
    CUSTOM_RESPONSES_API_KEY: apiSecret
  });

  assert.equal(responsesCompleted.ok, true);
  assert.equal(responsesCompleted.result.status, 'completed');
  assert.equal(responsesCompleted.result.transport, 'codex_responses');
  assert.equal(responsesCompleted.result.output_text, 'cli responses mock');
  assert.equal(responsesServer.requests.length, 1);
  assert.equal(JSON.stringify(responsesCompleted).includes(secretPrompt), false);
  assert.equal(JSON.stringify(responsesCompleted).includes(apiSecret), false);

  const streamCompleted = await runCli([
    'provider-chat',
    '--provider', 'custom_openai_compatible',
    '--base-url', streamServer.base_url,
    '--model', 'mock-model',
    '--message', secretPrompt,
    '--max-completion-tokens', '16',
    '--stream'
  ], {
    CUSTOM_LLM_API_KEY: apiSecret
  });

  assert.equal(streamCompleted.ok, true);
  assert.equal(streamCompleted.result.format, 'divinity.provider_proxy_stream_result.v1');
  assert.equal(streamCompleted.result.status, 'completed');
  assert.equal(streamCompleted.result.output_text, 'cli stream');
  assert.equal(streamCompleted.result.event_counts.text_delta, 2);
  assert.equal(streamServer.requests.length, 1);
  assert.equal(JSON.stringify(streamCompleted).includes(secretPrompt), false);
  assert.equal(JSON.stringify(streamCompleted).includes(apiSecret), false);

  const localToolApproval = await runCli([
    'provider-tool-approval',
    'run_cli_tool_approval',
    '--tool-call-id', 'call_cli_search',
    '--provider', 'custom_openai_compatible',
    '--transport', 'chat_completions',
    '--name', 'web_search',
    '--argument-key', 'query',
    '--decision', 'approve',
    '--actor', 'cli@example.com',
    '--reason', 'Public search approved.'
  ]);

  assert.equal(localToolApproval.ok, true);
  assert.equal(localToolApproval.command, 'provider-tool-approval');
  assert.equal(localToolApproval.approval.format, 'divinity.provider_tool_call_approval.v1');
  assert.equal(localToolApproval.approval.tool_call_id, 'call_cli_search');
  assert.deepEqual(localToolApproval.approval.argument_keys, ['query']);
  assert.equal(localToolApproval.approval.arguments_redacted, true);

  const localToolExecution = await runCli([
    'provider-tool-execute',
    'run_cli_tool_execution',
    '--approval-id', 'provider_tool_call_approval_run_cli_tool_execution_call_cli_read_001',
    '--tool-call-id', 'call_cli_read',
    '--provider', 'custom_openai_compatible',
    '--transport', 'chat_completions',
    '--name', 'read_file',
    '--argument-key', 'path',
    '--argument', 'path=README.md',
    '--workspace', repoFixture,
    '--actor', 'cli@example.com',
    '--reason', 'Execute approved read-only file request.'
  ]);

  assert.equal(localToolExecution.ok, true);
  assert.equal(localToolExecution.command, 'provider-tool-execute');
  assert.equal(localToolExecution.execution.format, 'divinity.provider_tool_execution.v1');
  assert.equal(localToolExecution.execution.tool_call_id, 'call_cli_read');
  assert.equal(localToolExecution.execution.status, 'completed');
  assert.equal(localToolExecution.execution.adapter, 'read_file');
  assert.equal(localToolExecution.execution.arguments_redacted, true);
  assert.equal(localToolExecution.execution.output_redacted, true);
  assert.equal(JSON.stringify(localToolExecution).includes('README.md'), false);
  assert.equal(JSON.stringify(localToolExecution).includes('Provider Proxy CLI Fixture'), false);

  const apiToolApproval = await runCli([
    'provider-tool-approval',
    approvalRun.run_id,
    '--api', baseUrl,
    '--tool-call-id', 'call_cli_api_search',
    '--provider', 'custom_openai_compatible',
    '--transport', 'chat_completions',
    '--name', 'web_search',
    '--argument-key', 'query',
    '--decision', 'reject',
    '--actor', 'cli@example.com',
    '--reason', 'Reject provider tool execution from CLI test.'
  ]);

  assert.equal(apiToolApproval.ok, true);
  assert.equal(apiToolApproval.status_code, 201);
  assert.equal(apiToolApproval.approval.run_id, approvalRun.run_id);
  assert.equal(apiToolApproval.approval.decision, 'reject');
  assert.equal(apiToolApproval.run.provider_tool_call_approvals.length, 1);

  const apiReadApproval = await runCli([
    'provider-tool-approval',
    approvalRun.run_id,
    '--api', baseUrl,
    '--tool-call-id', 'call_cli_api_read',
    '--provider', 'custom_openai_compatible',
    '--transport', 'chat_completions',
    '--name', 'read_file',
    '--argument-key', 'path',
    '--decision', 'approve',
    '--actor', 'cli@example.com',
    '--reason', 'Approve read-only execution from CLI test.'
  ]);

  assert.equal(apiReadApproval.ok, true);
  assert.equal(apiReadApproval.approval.decision, 'approve');

  const apiToolExecution = await runCli([
    'provider-tool-execute',
    approvalRun.run_id,
    '--api', baseUrl,
    '--approval-id', apiReadApproval.approval.approval_id,
    '--argument', 'path=README.md',
    '--actor', 'cli@example.com',
    '--reason', 'Execute approved API read-only tool request.'
  ]);

  assert.equal(apiToolExecution.ok, true);
  assert.equal(apiToolExecution.status_code, 201);
  assert.equal(apiToolExecution.execution.run_id, approvalRun.run_id);
  assert.equal(apiToolExecution.execution.approval_id, apiReadApproval.approval.approval_id);
  assert.equal(apiToolExecution.execution.status, 'completed');
  assert.equal(apiToolExecution.execution.arguments_redacted, true);
  assert.equal(apiToolExecution.execution.output_redacted, true);
  assert.equal(apiToolExecution.run.provider_tool_executions.length, 1);
  assert.equal(JSON.stringify(apiToolExecution).includes('README.md'), false);
  assert.equal(JSON.stringify(apiToolExecution).includes('Provider Proxy CLI Fixture'), false);
} finally {
  await server.close();
  await toolCallServer.close();
  await responsesServer.close();
  await continuationServer.close();
  await streamServer.close();
  if (apiServer.listening) {
    await new Promise((resolve, reject) => {
      apiServer.close(error => error ? reject(error) : resolve());
    });
  }
  rmSync(tmpRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, test: 'cli-provider-proxy-chat' }));
