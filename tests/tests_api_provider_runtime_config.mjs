import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  return { response, body: await response.json() };
}

const task = {
  task_id: 'task_provider_runtime_config',
  objective: 'Read the repository README',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  llm_provider: {
    provider_id: 'custom_openai_compatible',
    base_url: 'http://127.0.0.1:11434/v1',
    model: 'llama3.1'
  },
  toolsets: {
    enabled: ['web', 'file'],
    disabled: ['file']
  },
  created_at: '2026-05-25T00:00:00Z'
};

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task)
  });

  assert.equal(response.status, 201);
  assert.equal(run.task.llm_provider.provider_id, 'custom_openai_compatible');
  assert.equal(run.task.provider_runtime.provider_id, 'custom_openai_compatible');
  assert.equal(run.task.provider_runtime.base_url, 'http://127.0.0.1:11434/v1');
  assert.equal(run.task.provider_runtime.model, 'llama3.1');
  assert.equal(run.task.provider_runtime.auth.mode, 'none');
  assert.equal(run.task.provider_runtime.auth.credential_configured, true);
  assert.deepEqual(run.task.toolset_resolution.tools, ['web_extract', 'web_search']);
  assert.deepEqual(run.task.toolset_resolution.policy_permissions, ['network:read']);
  assert.equal(run.task.toolset_resolution.risk_summary.highest_risk_level, 'low');
  assert.deepEqual(run.task.toolset_resolution.provider_capability_checks, [
    {
      provider_id: 'custom_openai_compatible',
      capability: 'tool_calls',
      status: 'supported',
      required_by_toolsets: ['web']
    }
  ]);
  assert.deepEqual(run.task.toolset_resolution.operator_controls, []);

  const { body: storedRun } = await requestJson(`${baseUrl}/runs/${run.run_id}`);
  assert.equal(storedRun.task.provider_runtime.provider_id, 'custom_openai_compatible');
  assert.deepEqual(storedRun.task.toolset_resolution.tools, ['web_extract', 'web_search']);
  assert.deepEqual(storedRun.task.toolset_resolution.policy_permissions, ['network:read']);

  const { response: badProviderResponse, body: badProvider } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      ...task,
      task_id: 'task_bad_provider',
      llm_provider: { provider_id: 'missing_provider' }
    })
  });
  assert.equal(badProviderResponse.status, 400);
  assert.match(badProvider.error, /unknown LLM provider/);

  console.log(JSON.stringify({ ok: true, test: 'api-provider-runtime-config' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}
