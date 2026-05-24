import assert from 'assert/strict';
import fs from 'fs';

const manifest = JSON.parse(fs.readFileSync('apps/ide-extension/package.json', 'utf8'));
const source = fs.readFileSync('apps/ide-extension/src/extension.mjs', 'utf8');
const readme = fs.readFileSync('apps/ide-extension/README.md', 'utf8');

assert.equal(manifest.name, 'divinity-code-ide-extension');
assert.equal(manifest.publisher, 'divinity-code');
assert.equal(manifest.main, './src/extension.mjs');
assert.ok(Array.isArray(manifest.activationEvents));
assert.ok(manifest.activationEvents.includes('onCommand:divinity.runTask'));
assert.ok(manifest.activationEvents.includes('onCommand:divinity.openDashboard'));

const commandIds = new Set((manifest.contributes?.commands || []).map(command => command.command));
assert.ok(commandIds.has('divinity.runTask'));
assert.ok(commandIds.has('divinity.openDashboard'));
assert.ok(commandIds.has('divinity.showDoctor'));

assert.match(source, /export (async )?function activate/);
assert.match(source, /divinity\.runTask/);
assert.match(source, /divinity\.openDashboard/);
assert.match(source, /divinity\.showDoctor/);
assert.match(source, /createTerminal/);

assert.match(readme, /Run Task/);
assert.match(readme, /Open Dashboard/);
assert.match(readme, /Doctor/);

console.log(JSON.stringify({ ok: true, test: 'ide-extension-static' }));
