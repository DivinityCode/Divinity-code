import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const providersResponse = await fetch(`${baseUrl}/providers`);
  assert.equal(providersResponse.status, 200);
  const providers = await providersResponse.json();
  assert.ok(providers.llm_providers.some(provider => provider.provider_id === 'openai_api'));
  assert.ok(providers.llm_providers.every(provider => provider.format === 'divinity.llm_provider.v1'));

  const toolsetsResponse = await fetch(`${baseUrl}/toolsets`);
  assert.equal(toolsetsResponse.status, 200);
  const toolsets = await toolsetsResponse.json();
  assert.ok(toolsets.toolsets.some(toolset => toolset.toolset_id === 'code_execution'));
  assert.ok(toolsets.resolution.tools.includes('read_file'));

  console.log(JSON.stringify({ ok: true, test: 'api-provider-toolsets' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}
