import assert from 'assert/strict';

import { createExecutionVerification } from '../packages/verification/src/index.mjs';

const baseExecution = {
  execution_id: 'exec_verify_123',
  run_id: 'run_verify_123',
  step_id: 'step_verify',
  adapter: 'package_script',
  status: 'completed',
  exit_code: 0,
  target_path: 'package.json#scripts.test',
  stdout: '{"ok":true}\n',
  stderr: '',
  started_at: '2026-05-24T00:00:00.000Z',
  completed_at: '2026-05-24T00:00:01.000Z'
};

const passed = createExecutionVerification({
  run: { run_id: 'run_verify_123' },
  step: { step_id: 'step_verify' },
  execution: baseExecution,
  started_at: '2026-05-24T00:00:02.000Z',
  completed_at: '2026-05-24T00:00:03.000Z'
});

assert.equal(passed.verification_id, 'verify_exec_verify_123');
assert.equal(passed.result, 'passed');
assert.deepEqual(passed.checks.map(check => check.check_id), [
  'execution_completed',
  'exit_code_zero',
  'output_captured'
]);
assert.ok(passed.checks.every(check => check.status === 'passed'));
assert.ok(passed.evidence_refs.some(evidence => (
  evidence.source === 'execution.exit_code'
    && evidence.claim_type === 'observed'
    && evidence.supports.includes('verification.result')
)));

const failed = createExecutionVerification({
  run: { run_id: 'run_verify_123' },
  step: { step_id: 'step_verify' },
  execution: {
    ...baseExecution,
    execution_id: 'exec_verify_failed',
    status: 'failed',
    exit_code: 2,
    stdout: '',
    stderr: 'fixture failed\n'
  },
  started_at: '2026-05-24T00:00:04.000Z',
  completed_at: '2026-05-24T00:00:05.000Z'
});

assert.equal(failed.verification_id, 'verify_exec_verify_failed');
assert.equal(failed.result, 'failed');
assert.equal(failed.checks.find(check => check.check_id === 'execution_completed').status, 'failed');
assert.equal(failed.checks.find(check => check.check_id === 'exit_code_zero').status, 'failed');
assert.equal(failed.checks.find(check => check.check_id === 'output_captured').status, 'passed');

console.log(JSON.stringify({ ok: true, test: 'verification' }));
