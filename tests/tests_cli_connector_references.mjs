import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

function runCli(tmpDir, ...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    { cwd: tmpDir, encoding: 'utf8' }
  );
  return JSON.parse(output);
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-cli-connectors-test-'));

try {
  runCli(tmpDir, 'init');
  const result = runCli(
    tmpDir,
    'run',
    '--connector',
    'ticket_reference:ticket:DIV-17:https://example.test/tickets/DIV-17',
    'Read',
    'the',
    'repository',
    'README'
  );

  assert.equal(result.ok, true);
  assert.equal(result.command, 'run');
  assert.equal(result.task.objective, 'Read the repository README');
  assert.deepEqual(result.task.connector_references, [
    {
      adapter: 'ticket_reference',
      resource_type: 'ticket',
      resource_id: 'DIV-17',
      url: 'https://example.test/tickets/DIV-17'
    }
  ]);
  assert.equal(result.connector_references.length, 1);
  assert.equal(result.connector_references[0].format, 'divinity.connector_reference.v1');
  assert.equal(result.connector_references[0].run_id, result.run_id);
  assert.equal(result.connector_references[0].adapter, 'ticket_reference');
  assert.equal(result.connector_references[0].resource_id, 'DIV-17');

  console.log(JSON.stringify({ ok: true, test: 'cli-connector-references' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
