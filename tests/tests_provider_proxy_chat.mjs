import assert from 'assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import http from 'http';
import { tmpdir } from 'os';
import path from 'path';

import {
  createProviderLimitLedger,
  createProviderUsageLedger,
  executeProviderProxyChat
} from '../packages/provider-proxy/src/index.mjs';

async function createMockChatServer(handler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', chunk => rawBody += chunk);
    req.on('end', async () => {
      const body = rawBody ? JSON.parse(rawBody) : {};
      requests.push({ req, body });
      await handler({ req, res, body });
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

const secretPrompt = 'secret prompt for proxy test';
const apiSecret = 'openrouter-secret-value';

const completedServer = await createMockChatServer(async ({ req, res, body }) => {
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/chat/completions');
  assert.equal(req.headers.authorization, undefined);
  assert.equal(body.model, 'mock-model');
  assert.equal(body.max_completion_tokens, 32);
  assert.deepEqual(body.messages, [{ role: 'user', content: secretPrompt }]);
  assert.deepEqual(body.tools.map(tool => tool.function.name), ['web_extract', 'web_search']);
  assert.equal(body.tools[0].type, 'function');
  assert.equal(body.tools[1].function.parameters.properties.query.type, 'string');

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'chatcmpl_mock',
    object: 'chat.completion',
    model: 'mock-model',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'mock response' },
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

try {
  const providerUsageLedger = createProviderUsageLedger({
    now: () => new Date('2026-05-25T12:00:00.000Z')
  });
  const completed = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: completedServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    enabled_toolsets: ['web'],
    max_completion_tokens: 32,
    usage_ledger: providerUsageLedger
  });

  assert.equal(completed.format, 'divinity.provider_proxy_chat_result.v1');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.provider_id, 'custom_openai_compatible');
  assert.equal(completed.model, 'mock-model');
  assert.equal(completed.message.content, 'mock response');
  assert.equal(completed.finish_reason, 'stop');
  assert.equal(completed.usage.total_tokens, 7);
  assert.equal(completed.usage_ledger_record.provider_id, 'custom_openai_compatible');
  assert.equal(completed.usage_ledger_record.model, 'mock-model');
  assert.equal(completed.usage_ledger_record.request_count, 1);
  assert.equal(completed.usage_ledger_record.input_tokens, 4);
  assert.equal(completed.usage_ledger_record.output_tokens, 3);
  assert.equal(completed.usage_ledger_record.total_tokens, 7);
  assert.equal(completed.toolset_resolution.provider_capability_checks[0].status, 'supported');
  assert.equal(JSON.stringify(completed).includes(secretPrompt), false);
  assert.equal(JSON.stringify(completed).includes(apiSecret), false);

  const blockedByUsageBudget = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: completedServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32,
    usage_ledger: providerUsageLedger,
    usage_budget: { max_daily_requests: 1 }
  });

  assert.equal(blockedByUsageBudget.status, 'blocked');
  assert.match(blockedByUsageBudget.error, /daily request budget/);
  assert.equal(completedServer.requests.length, 1);
  assert.equal(JSON.stringify(blockedByUsageBudget).includes(secretPrompt), false);
  assert.equal(JSON.stringify(blockedByUsageBudget).includes(apiSecret), false);
} finally {
  await completedServer.close();
}

const hostedSecret = 'hosted-openrouter-secret';
const hostedSecretServer = await createMockChatServer(async ({ req, res, body }) => {
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/chat/completions');
  assert.equal(req.headers.authorization, `Bearer ${hostedSecret}`);
  assert.equal(body.model, 'hosted-secret-model');
  assert.deepEqual(body.messages, [{ role: 'user', content: secretPrompt }]);

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'chatcmpl_hosted_secret_mock',
    object: 'chat.completion',
    model: 'hosted-secret-model',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'hosted secret response' },
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

const hostedSecretTmp = mkdtempSync(path.join(tmpdir(), 'divinity-hosted-secret-provider-'));
try {
  const overlayPath = path.join(hostedSecretTmp, 'providers-overlay.json');
  writeFileSync(overlayPath, JSON.stringify({
    format: 'divinity.llm_provider_catalog.v1',
    providers: [
      {
        provider_id: 'hosted_secret_mock',
        display_name: 'Hosted Secret Mock',
        transport: 'chat_completions',
        base_url: hostedSecretServer.base_url,
        auth_modes: ['api_key'],
        credential_env_vars: ['HOSTED_SECRET_MOCK_API_KEY'],
        supports_custom_base_url: false,
        default_model: 'hosted-secret-model',
        capabilities: ['chat', 'tool_calls', 'openai_compatible'],
        source: 'operator_config'
      }
    ]
  }, null, 2));

  const hostedSecretCompleted = await executeProviderProxyChat({
    candidates: ['hosted_secret_mock'],
    env: { DIVINITY_PROVIDER_CATALOG_PATH: overlayPath },
    requested_model: 'hosted-secret-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32,
    credential_resolver: {
      configuredSecretRefs(runtime) {
        return runtime.provider_id === 'hosted_secret_mock'
          ? ['secret://divinity/providers/hosted-secret-mock/api-key']
          : [];
      },
      resolveCredential(runtime) {
        return runtime.provider_id === 'hosted_secret_mock' ? hostedSecret : '';
      }
    }
  });

  assert.equal(hostedSecretCompleted.status, 'completed');
  assert.equal(hostedSecretCompleted.provider_id, 'hosted_secret_mock');
  assert.equal(hostedSecretCompleted.message.content, 'hosted secret response');
  assert.deepEqual(
    hostedSecretCompleted.route.selected_provider_runtime.auth.configured_secret_refs,
    ['secret://divinity/providers/hosted-secret-mock/api-key']
  );
  assert.equal(JSON.stringify(hostedSecretCompleted).includes(hostedSecret), false);
  assert.equal(JSON.stringify(hostedSecretCompleted).includes(secretPrompt), false);
  assert.equal(hostedSecretServer.requests.length, 1);
} finally {
  rmSync(hostedSecretTmp, { recursive: true, force: true });
  await hostedSecretServer.close();
}

const toolSecret = 'secret tool argument value';
const continuationSecretPath = 'secret-continuation-file.md';
const continuationSecretOutput = 'secret continuation file contents';
const continuationSecretListPath = 'secret-continuation-list-scope';
const toolCallServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'chatcmpl_tool_mock',
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
              id: 'call_search_1',
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

try {
  const toolCallResult = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: toolCallServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32
  });

  assert.equal(toolCallResult.status, 'requires_action');
  assert.equal(toolCallResult.tool_call_requests[0].name, 'web_search');
  assert.deepEqual(toolCallResult.tool_call_requests[0].argument_keys, ['query']);
  assert.equal(toolCallResult.tool_call_requests[0].arguments_redacted, true);
  assert.equal(toolCallResult.operator_controls[0].control_id, 'tool_call_review');
  assert.equal(JSON.stringify(toolCallResult).includes(toolSecret), false);
  assert.equal(JSON.stringify(toolCallResult).includes(secretPrompt), false);
  assert.equal(JSON.stringify(toolCallResult).includes(apiSecret), false);
} finally {
  await toolCallServer.close();
}

const continuationServer = await createMockChatServer(async ({ req, res, body }) => {
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/chat/completions');
  assert.equal(body.model, 'mock-model');
  assert.equal(body.messages.length, 2);
  assert.deepEqual(body.messages[0], { role: 'user', content: secretPrompt });
  const continuation = body.messages[1];
  assert.equal(continuation.role, 'user');
  assert.match(continuation.content, /Approved provider tool execution summaries/);
  assert.match(continuation.content, /provider_tool_execution_run_context_call_read_context_001/);
  assert.match(continuation.content, /call_read_context/);
  assert.match(continuation.content, /read_file/);
  assert.match(continuation.content, /completed/);
  assert.match(continuation.content, /Operator reviewed the read result/);
  assert.match(continuation.content, /bytes_read/);
  assert.match(continuation.content, /line_count/);
  assert.match(continuation.content, /search_files/);
  assert.match(continuation.content, /match_count/);
  assert.match(continuation.content, /matching_files_count/);
  assert.match(continuation.content, /files_scanned/);
  assert.match(continuation.content, /list_files/);
  assert.match(continuation.content, /files_listed/);
  assert.match(continuation.content, /directories_scanned/);
  assert.match(continuation.content, /max_depth/);
  assert.equal(continuation.content.includes(continuationSecretPath), false);
  assert.equal(continuation.content.includes(continuationSecretOutput), false);
  assert.equal(continuation.content.includes('secret continuation search query'), false);
  assert.equal(continuation.content.includes('secret-continuation-search-result.md'), false);
  assert.equal(continuation.content.includes(continuationSecretListPath), false);
  assert.equal(continuation.content.includes('secret-continuation-list-target.md'), false);

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'chatcmpl_continuation_mock',
    object: 'chat.completion',
    model: 'mock-model',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'continuation response' },
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

try {
  const continued = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: continuationServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32,
    provider_tool_executions: [
      {
        format: 'divinity.provider_tool_execution.v1',
        execution_id: 'provider_tool_execution_run_context_call_read_context_001',
        run_id: 'run_context',
        approval_id: 'provider_tool_call_approval_run_context_call_read_context_001',
        tool_call_id: 'call_read_context',
        provider_id: 'custom_openai_compatible',
        transport: 'chat_completions',
        name: 'read_file',
        argument_keys: ['path'],
        arguments_redacted: true,
        argument_values: { path: continuationSecretPath },
        status: 'completed',
        adapter: 'read_file',
        actor: 'operator@example.com',
        reason: 'Approved read-only continuation context.',
        operator_summary: 'Operator reviewed the read result: safe route configuration context is available.',
        started_at: '2026-05-25T12:10:00Z',
        completed_at: '2026-05-25T12:10:01Z',
        output_summary: 'read_file completed; content redacted',
        output_redacted: true,
        output_metadata: {
          bytes_read: 1024,
          line_count: 12,
          content_redacted: true,
          path: continuationSecretPath,
          raw_output: continuationSecretOutput
        },
        output: continuationSecretOutput
      },
      {
        format: 'divinity.provider_tool_execution.v1',
        execution_id: 'provider_tool_execution_run_context_call_search_context_002',
        run_id: 'run_context',
        approval_id: 'provider_tool_call_approval_run_context_call_search_context_002',
        tool_call_id: 'call_search_context',
        provider_id: 'custom_openai_compatible',
        transport: 'chat_completions',
        name: 'search_files',
        argument_keys: ['path', 'query'],
        arguments_redacted: true,
        argument_values: { path: 'secret-continuation-search-scope', query: 'secret continuation search query' },
        status: 'completed',
        adapter: 'search_files',
        actor: 'operator@example.com',
        reason: 'Approved redacted search continuation context.',
        operator_summary: 'Operator reviewed the search result: two implementation references were found.',
        started_at: '2026-05-25T12:10:02Z',
        completed_at: '2026-05-25T12:10:03Z',
        output_summary: 'search_files completed; results redacted',
        output_redacted: true,
        output_metadata: {
          files_scanned: 7,
          match_count: 3,
          matching_files_count: 2,
          query_redacted: true,
          paths_redacted: true,
          content_redacted: true,
          query: 'secret continuation search query',
          matched_path: 'secret-continuation-search-result.md'
        }
      },
      {
        format: 'divinity.provider_tool_execution.v1',
        execution_id: 'provider_tool_execution_run_context_call_list_context_003',
        run_id: 'run_context',
        approval_id: 'provider_tool_call_approval_run_context_call_list_context_003',
        tool_call_id: 'call_list_context',
        provider_id: 'custom_openai_compatible',
        transport: 'chat_completions',
        name: 'list_files',
        argument_keys: ['path', 'max_depth'],
        arguments_redacted: true,
        argument_values: { path: continuationSecretListPath, max_depth: 2 },
        status: 'completed',
        adapter: 'list_files',
        actor: 'operator@example.com',
        reason: 'Approved redacted listing continuation context.',
        operator_summary: 'Operator reviewed the listing result: repository shape context is available.',
        started_at: '2026-05-25T12:10:04Z',
        completed_at: '2026-05-25T12:10:05Z',
        output_summary: 'list_files completed; paths redacted',
        output_redacted: true,
        output_metadata: {
          files_listed: 4,
          directories_scanned: 3,
          max_depth: 2,
          paths_redacted: true,
          content_redacted: true,
          path: continuationSecretListPath,
          filename: 'secret-continuation-list-target.md'
        }
      }
    ]
  });

  assert.equal(continued.status, 'completed');
  assert.equal(continued.output_text, 'continuation response');
  assert.equal(continuationServer.requests.length, 1);
  assert.equal(JSON.stringify(continued).includes(continuationSecretPath), false);
  assert.equal(JSON.stringify(continued).includes(continuationSecretOutput), false);
  assert.equal(JSON.stringify(continued).includes(continuationSecretListPath), false);
  assert.equal(JSON.stringify(continued).includes(secretPrompt), false);
  assert.equal(JSON.stringify(continued).includes(apiSecret), false);
} finally {
  await continuationServer.close();
}

const promptBudgetContinuationServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'chatcmpl_prompt_budget_continuation',
    object: 'chat.completion',
    model: 'mock-model',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'should be blocked before upstream' },
        finish_reason: 'stop'
      }
    ]
  }));
});

try {
  const blockedByContinuationBudget = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: promptBudgetContinuationServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: 'hi' }],
    provider_tool_executions: [
      {
        format: 'divinity.provider_tool_execution.v1',
        execution_id: 'provider_tool_execution_run_context_call_long_context_001',
        run_id: 'run_context',
        approval_id: 'provider_tool_call_approval_run_context_call_long_context_001',
        tool_call_id: 'call_long_context',
        provider_id: 'custom_openai_compatible',
        transport: 'chat_completions',
        name: 'read_file',
        argument_keys: ['path'],
        arguments_redacted: true,
        status: 'completed',
        adapter: 'read_file',
        actor: 'operator@example.com',
        reason: 'Approved long context.',
        started_at: '2026-05-25T12:10:00Z',
        completed_at: '2026-05-25T12:10:01Z',
        output_summary: 'read_file completed; content redacted with a long safe summary for budget accounting',
        output_redacted: true,
        output_metadata: { bytes_read: 4096, line_count: 80, content_redacted: true }
      }
    ],
    request_budget: { max_prompt_chars: 5 },
    max_completion_tokens: 32
  });

  assert.equal(blockedByContinuationBudget.status, 'blocked');
  assert.match(blockedByContinuationBudget.error, /prompt budget/);
  assert.equal(promptBudgetContinuationServer.requests.length, 0);
  assert.equal(JSON.stringify(blockedByContinuationBudget).includes(continuationSecretOutput), false);
} finally {
  await promptBudgetContinuationServer.close();
}

const limitedServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 429;
  res.setHeader('content-type', 'application/json');
  res.setHeader('retry-after', '11');
  res.end(JSON.stringify({ error: { message: 'rate limited' } }));
});

try {
  const limited = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: limitedServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32
  });

  assert.equal(limited.status, 'limited');
  assert.equal(limited.upstream_status, 429);
  assert.equal(limited.retry_after_seconds, 11);
  assert.equal(limitedServer.requests.length, 1);
  assert.equal(JSON.stringify(limited).includes(secretPrompt), false);
  assert.equal(JSON.stringify(limited).includes(apiSecret), false);
} finally {
  await limitedServer.close();
}

const ledgerLimitedServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 429;
  res.setHeader('content-type', 'application/json');
  res.setHeader('retry-after', '60');
  res.end(JSON.stringify({ error: { message: 'rate limited' } }));
});

const ledgerBackupServer = await createMockChatServer(async ({ req, res, body }) => {
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/v1/messages');
  assert.equal(body.model, 'claude-mock');
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'msg_ledger_backup',
    type: 'message',
    role: 'assistant',
    model: 'claude-mock',
    content: [{ type: 'text', text: 'ledger backup response' }],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 5,
      output_tokens: 4
    }
  }));
});

try {
  const providerLimitLedger = createProviderLimitLedger({
    now: () => new Date('2026-05-25T10:00:00.000Z')
  });

  const limited = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: ledgerLimitedServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32,
    limit_ledger: providerLimitLedger
  });

  assert.equal(limited.status, 'limited');
  assert.equal(limited.retry_after_seconds, 60);
  assert.equal(limited.limit_ledger_record.provider_id, 'custom_openai_compatible');
  assert.equal(limited.limit_ledger_record.retry_after_seconds, 60);
  assert.equal(JSON.stringify(limited).includes(secretPrompt), false);
  assert.equal(JSON.stringify(limited).includes(apiSecret), false);

  const rerouted = await executeProviderProxyChat({
    candidates: [
      { provider_id: 'custom_openai_compatible', base_url: ledgerLimitedServer.base_url },
      { provider_id: 'custom_anthropic_compatible', base_url: ledgerBackupServer.base_url }
    ],
    env: {
      CUSTOM_LLM_API_KEY: apiSecret,
      CUSTOM_ANTHROPIC_API_KEY: apiSecret
    },
    requested_model: 'claude-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_output_tokens: 32,
    limit_ledger: providerLimitLedger
  });

  assert.equal(rerouted.status, 'completed');
  assert.equal(rerouted.provider_id, 'custom_anthropic_compatible');
  assert.equal(rerouted.output_text, 'ledger backup response');
  assert.equal(ledgerLimitedServer.requests.length, 1);
  assert.equal(ledgerBackupServer.requests.length, 1);
  assert.equal(rerouted.route.candidate_results[0].status, 'limited');
  assert.equal(rerouted.route.candidate_results[0].retry_after_seconds, 60);
  assert.equal(JSON.stringify(rerouted).includes(secretPrompt), false);
  assert.equal(JSON.stringify(rerouted).includes(apiSecret), false);
} finally {
  await ledgerLimitedServer.close();
  await ledgerBackupServer.close();
}

const exfilServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 500;
  res.end(JSON.stringify({ error: 'should not be called' }));
});

try {
  const exfilBlocked = await executeProviderProxyChat({
    candidates: [{ provider_id: 'openrouter', base_url: exfilServer.base_url }],
    env: { OPENROUTER_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32
  });

  assert.equal(exfilBlocked.status, 'blocked');
  assert.match(exfilBlocked.error, /base_url overrides/);
  assert.equal(exfilServer.requests.length, 0);
  assert.equal(JSON.stringify(exfilBlocked).includes(apiSecret), false);
} finally {
  await exfilServer.close();
}

const anthropicExfilServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 500;
  res.end(JSON.stringify({ error: 'should not be called' }));
});

try {
  const exfilBlocked = await executeProviderProxyChat({
    candidates: [{ provider_id: 'anthropic', base_url: anthropicExfilServer.base_url }],
    env: { ANTHROPIC_API_KEY: 'anthropic-secret' },
    requested_model: 'claude-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32
  });

  assert.equal(exfilBlocked.status, 'blocked');
  assert.match(exfilBlocked.error, /base_url overrides/);
  assert.equal(anthropicExfilServer.requests.length, 0);
  assert.equal(JSON.stringify(exfilBlocked).includes('anthropic-secret'), false);
} finally {
  await anthropicExfilServer.close();
}

const responsesExfilServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 500;
  res.end(JSON.stringify({ error: 'should not be called' }));
});

try {
  const exfilBlocked = await executeProviderProxyChat({
    candidates: [{ provider_id: 'openai_api', base_url: responsesExfilServer.base_url }],
    env: { OPENAI_API_KEY: 'openai-secret' },
    requested_model: 'gpt-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32
  });

  assert.equal(exfilBlocked.status, 'blocked');
  assert.match(exfilBlocked.error, /base_url overrides/);
  assert.equal(responsesExfilServer.requests.length, 0);
  assert.equal(JSON.stringify(exfilBlocked).includes('openai-secret'), false);
} finally {
  await responsesExfilServer.close();
}

const incompatiblePrompt = 'secret prompt for incompatible provider toolset';

const incompatibleToolset = await executeProviderProxyChat({
  candidates: ['cerebras'],
  env: { CEREBRAS_API_KEY: 'cerebras-secret' },
  requested_model: 'gpt-oss-120b',
  messages: [{ role: 'user', content: incompatiblePrompt }],
  enabled_toolsets: ['web'],
  request_budget: { max_prompt_chars: 1 }
});

assert.equal(incompatibleToolset.status, 'blocked');
assert.match(incompatibleToolset.error, /provider missing required tool capability/);
assert.equal(incompatibleToolset.toolset_resolution.provider_capability_checks[0].status, 'missing');
assert.equal(
  incompatibleToolset.toolset_resolution.operator_controls[0].control_id,
  'provider_capability_review'
);
assert.equal(JSON.stringify(incompatibleToolset).includes(incompatiblePrompt), false);
assert.equal(JSON.stringify(incompatibleToolset).includes('cerebras-secret'), false);

const anthropicServer = await createMockChatServer(async ({ req, res, body }) => {
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/v1/messages');
  assert.equal(req.headers.authorization, undefined);
  assert.equal(req.headers['x-api-key'], undefined);
  assert.equal(req.headers['anthropic-version'], '2023-06-01');
  assert.equal(body.model, 'claude-mock');
  assert.equal(body.system, 'system safety prompt');
  assert.equal(body.max_tokens, 64);
  assert.equal('max_completion_tokens' in body, false);
  assert.deepEqual(body.messages, [{ role: 'user', content: secretPrompt }]);
  assert.deepEqual(body.tools.map(tool => tool.name), ['web_extract', 'web_search']);
  assert.equal(body.tools[1].input_schema.properties.query.type, 'string');

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'msg_mock',
    type: 'message',
    role: 'assistant',
    model: 'claude-mock',
    content: [{ type: 'text', text: 'anthropic mock response' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 5,
      output_tokens: 4
    }
  }));
});

try {
  const completed = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_anthropic_compatible', base_url: anthropicServer.base_url }],
    env: { CUSTOM_ANTHROPIC_API_KEY: apiSecret },
    requested_model: 'claude-mock',
    messages: [
      { role: 'system', content: 'system safety prompt' },
      { role: 'user', content: secretPrompt }
    ],
    enabled_toolsets: ['web'],
    max_completion_tokens: 64
  });

  assert.equal(completed.status, 'completed');
  assert.equal(completed.provider_id, 'custom_anthropic_compatible');
  assert.equal(completed.transport, 'anthropic_messages');
  assert.equal(completed.message.content[0].text, 'anthropic mock response');
  assert.equal(completed.output_text, 'anthropic mock response');
  assert.equal(completed.finish_reason, 'end_turn');
  assert.equal(completed.usage.input_tokens, 5);
  assert.equal(JSON.stringify(completed).includes(secretPrompt), false);
  assert.equal(JSON.stringify(completed).includes(apiSecret), false);
} finally {
  await anthropicServer.close();
}

const anthropicToolServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'msg_tool_mock',
    type: 'message',
    role: 'assistant',
    model: 'claude-mock',
    content: [
      { type: 'text', text: 'I need to inspect a file.' },
      {
        type: 'tool_use',
        id: 'toolu_read_1',
        name: 'read_file',
        input: { path: toolSecret }
      }
    ],
    stop_reason: 'tool_use',
    usage: {
      input_tokens: 5,
      output_tokens: 4
    }
  }));
});

try {
  const toolCallResult = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_anthropic_compatible', base_url: anthropicToolServer.base_url }],
    env: { CUSTOM_ANTHROPIC_API_KEY: apiSecret },
    requested_model: 'claude-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_output_tokens: 64
  });

  assert.equal(toolCallResult.status, 'requires_action');
  assert.equal(toolCallResult.tool_call_requests[0].tool_call_id, 'toolu_read_1');
  assert.equal(toolCallResult.tool_call_requests[0].name, 'read_file');
  assert.deepEqual(toolCallResult.tool_call_requests[0].argument_keys, ['path']);
  assert.equal(toolCallResult.message.content[1].input_redacted, true);
  assert.equal(toolCallResult.operator_controls[0].control_id, 'tool_call_review');
  assert.equal(JSON.stringify(toolCallResult).includes(toolSecret), false);
  assert.equal(JSON.stringify(toolCallResult).includes(secretPrompt), false);
  assert.equal(JSON.stringify(toolCallResult).includes(apiSecret), false);
} finally {
  await anthropicToolServer.close();
}

const responsesServer = await createMockChatServer(async ({ req, res, body }) => {
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/responses');
  assert.equal(req.headers.authorization, undefined);
  assert.equal(body.model, 'gpt-mock');
  assert.equal(body.instructions, 'responses system prompt');
  assert.equal(body.max_output_tokens, 48);
  assert.equal('max_completion_tokens' in body, false);
  assert.equal('max_tokens' in body, false);
  assert.deepEqual(body.input, [{ role: 'user', content: secretPrompt }]);
  assert.deepEqual(body.tools.map(tool => tool.name), ['web_extract', 'web_search']);
  assert.equal(body.tools[0].type, 'function');
  assert.equal(body.tools[1].parameters.properties.query.type, 'string');

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'resp_mock',
    object: 'response',
    status: 'completed',
    model: 'gpt-mock',
    output: [
      {
        type: 'message',
        id: 'msg_resp_mock',
        status: 'completed',
        role: 'assistant',
        content: [
          { type: 'output_text', text: 'responses mock response', annotations: [] }
        ]
      }
    ],
    usage: {
      input_tokens: 6,
      output_tokens: 5,
      total_tokens: 11
    }
  }));
});

try {
  const completed = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_responses', base_url: responsesServer.base_url }],
    env: { CUSTOM_RESPONSES_API_KEY: apiSecret },
    requested_model: 'gpt-mock',
    messages: [
      { role: 'system', content: 'responses system prompt' },
      { role: 'user', content: secretPrompt }
    ],
    enabled_toolsets: ['web'],
    max_output_tokens: 48
  });

  assert.equal(completed.status, 'completed');
  assert.equal(completed.provider_id, 'custom_openai_responses');
  assert.equal(completed.transport, 'codex_responses');
  assert.equal(completed.message.content[0].text, 'responses mock response');
  assert.equal(completed.output_text, 'responses mock response');
  assert.equal(completed.finish_reason, 'completed');
  assert.equal(completed.usage.total_tokens, 11);
  assert.equal(JSON.stringify(completed).includes(secretPrompt), false);
  assert.equal(JSON.stringify(completed).includes(apiSecret), false);
} finally {
  await responsesServer.close();
}

const responsesToolServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'resp_tool_mock',
    object: 'response',
    status: 'completed',
    model: 'gpt-mock',
    output: [
      {
        type: 'function_call',
        id: 'fc_1',
        call_id: 'call_patch_1',
        name: 'patch_file',
        arguments: JSON.stringify({ file: toolSecret })
      }
    ],
    usage: {
      input_tokens: 6,
      output_tokens: 5,
      total_tokens: 11
    }
  }));
});

try {
  const toolCallResult = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_responses', base_url: responsesToolServer.base_url }],
    env: { CUSTOM_RESPONSES_API_KEY: apiSecret },
    requested_model: 'gpt-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_output_tokens: 48
  });

  assert.equal(toolCallResult.status, 'requires_action');
  assert.equal(toolCallResult.tool_call_requests[0].tool_call_id, 'call_patch_1');
  assert.equal(toolCallResult.tool_call_requests[0].name, 'patch_file');
  assert.deepEqual(toolCallResult.tool_call_requests[0].argument_keys, ['file']);
  assert.equal(toolCallResult.operator_controls[0].control_id, 'tool_call_review');
  assert.equal(JSON.stringify(toolCallResult).includes(toolSecret), false);
  assert.equal(JSON.stringify(toolCallResult).includes(secretPrompt), false);
  assert.equal(JSON.stringify(toolCallResult).includes(apiSecret), false);
} finally {
  await responsesToolServer.close();
}

const budgetServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 500;
  res.end(JSON.stringify({ error: 'should not be called' }));
});

try {
  const budgetBlocked = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: budgetServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    messages: [{ role: 'user', content: secretPrompt }],
    request_budget: { max_prompt_chars: 3, max_completion_tokens: 32 }
  });

  assert.equal(budgetBlocked.status, 'blocked');
  assert.match(budgetBlocked.error, /prompt budget/);
  assert.equal(budgetServer.requests.length, 0);
} finally {
  await budgetServer.close();
}

console.log(JSON.stringify({ ok: true, test: 'provider-proxy-chat' }));
