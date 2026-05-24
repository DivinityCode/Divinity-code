import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const response = await fetch(`${baseUrl}/capabilities`);
  assert.equal(response.status, 200);
  const catalog = await response.json();

  assert.equal(catalog.format, 'divinity.capabilities.v1');
  assert.ok(catalog.policies.some(policy => policy.policy_id === 'read_only'));
  assert.ok(catalog.execution_adapters.some(adapter => adapter.adapter === 'package_script'));
  assert.ok(catalog.connector_adapters.some(adapter => adapter.adapter === 'ticket_reference'));
  assert.ok(catalog.starter_recipes.length >= 4);

  console.log(JSON.stringify({ ok: true, test: 'api-capabilities' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
