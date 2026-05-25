import assert from 'assert/strict';
import { execFile } from 'child_process';
import http from 'http';
import path from 'path';
import { promisify } from 'util';

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

const apiSecret = 'openrouter-secret-value';
const secretPrompt = 'secret prompt for cli proxy';
const server = await createMockChatServer();
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

try {
  const completed = await runCli([
    'provider-chat',
    '--provider', 'custom_openai_compatible',
    '--base-url', server.base_url,
    '--model', 'mock-model',
    '--message', secretPrompt,
    '--max-completion-tokens', '32'
  ], {
    CUSTOM_LLM_API_KEY: apiSecret
  });

  assert.equal(completed.ok, true);
  assert.equal(completed.command, 'provider-chat');
  assert.equal(completed.result.format, 'divinity.provider_proxy_chat_result.v1');
  assert.equal(completed.result.status, 'completed');
  assert.equal(completed.result.message.content, 'cli mock response');
  assert.equal(server.requests.length, 1);
  assert.equal(JSON.stringify(completed).includes(secretPrompt), false);
  assert.equal(JSON.stringify(completed).includes(apiSecret), false);

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
} finally {
  await server.close();
  await responsesServer.close();
}

console.log(JSON.stringify({ ok: true, test: 'cli-provider-proxy-chat' }));
