import assert from 'assert/strict';
import path from 'path';

import {
  createContainerCommandPlan,
  publicRunnerIsolationProfiles,
  resolveRunnerIsolationProfile
} from '../packages/runner-isolation/src/index.mjs';

const profiles = publicRunnerIsolationProfiles();

assert.deepEqual(profiles.map(profile => profile.profile_id), [
  'workspace_snapshot',
  'container_sandbox'
]);
assert.equal(profiles.find(profile => profile.profile_id === 'workspace_snapshot').requires_runtime, false);
assert.equal(profiles.find(profile => profile.profile_id === 'container_sandbox').runtime, 'docker');
assert.equal(profiles.find(profile => profile.profile_id === 'container_sandbox').network, 'none');
assert.equal(resolveRunnerIsolationProfile({ profile_id: 'missing' }).profile_id, 'workspace_snapshot');

const plan = createContainerCommandPlan({
  workspacePath: '/tmp/divinity-workspace',
  command: ['node', 'tests/tests_dashboard_static.mjs']
});

assert.equal(plan.profile_id, 'container_sandbox');
assert.equal(plan.runtime, 'docker');
assert.equal(plan.shell_interpolation, false);
assert.deepEqual(plan.command, ['node', 'tests/tests_dashboard_static.mjs']);
assert.ok(plan.argv.includes('--network'));
assert.ok(plan.argv.includes('none'));
assert.ok(plan.argv.includes('type=bind,source=/tmp/divinity-workspace,target=/workspace'));
assert.deepEqual(plan.argv.slice(-2), ['node', 'tests/tests_dashboard_static.mjs']);
assert.equal(path.isAbsolute(plan.workspace_mount.source), true);

assert.throws(() => createContainerCommandPlan({
  workspacePath: '/tmp/divinity-workspace',
  command: 'node tests/tests_dashboard_static.mjs'
}), /command must be a non-empty argv array/);

console.log(JSON.stringify({ ok: true, test: 'runner-isolation' }));
