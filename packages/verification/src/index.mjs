function evidenceRef({ evidence_id, source, summary, supports }) {
  return {
    evidence_id,
    source,
    claim_type: 'observed',
    summary,
    supports
  };
}

function check(check_id, passed, summary) {
  return {
    check_id,
    status: passed ? 'passed' : 'failed',
    summary
  };
}

export function createExecutionVerification({
  run,
  step,
  execution,
  started_at = new Date().toISOString(),
  completed_at = new Date().toISOString()
}) {
  const checks = [
    check(
      'execution_completed',
      execution?.status === 'completed',
      `Execution status was ${execution?.status || 'unknown'}.`
    ),
    check(
      'exit_code_zero',
      execution?.exit_code === 0,
      `Execution exit code was ${execution?.exit_code ?? 'unknown'}.`
    ),
    check(
      'output_captured',
      Boolean(execution?.stdout || execution?.stderr || execution?.target_path),
      'Execution produced stdout, stderr, or a target path for review.'
    )
  ];
  const result = checks.every(item => item.status === 'passed') ? 'passed' : 'failed';

  return {
    verification_id: `verify_${execution.execution_id}`,
    run_id: run.run_id,
    step_id: step.step_id,
    execution_id: execution.execution_id,
    status: 'completed',
    result,
    checks,
    evidence_refs: [
      evidenceRef({
        evidence_id: `evidence_${execution.execution_id}_status`,
        source: 'execution.status',
        summary: `Execution ${execution.execution_id} completed with status ${execution.status}.`,
        supports: ['verification.result', 'checks.execution_completed']
      }),
      evidenceRef({
        evidence_id: `evidence_${execution.execution_id}_exit_code`,
        source: 'execution.exit_code',
        summary: `Execution ${execution.execution_id} exited with code ${execution.exit_code}.`,
        supports: ['verification.result', 'checks.exit_code_zero']
      })
    ],
    started_at,
    completed_at
  };
}
