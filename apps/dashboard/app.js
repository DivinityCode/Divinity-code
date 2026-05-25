const DEFAULT_SCOPE = { org_id: 'default-org', project_id: 'default-project' };

const sampleRuns = [
  {
    run_id: 'run_2026_05_24_0012',
    task_id: 'task_users_pagination',
    objective: 'Add cursor-based pagination to GET /v1/users',
    status: 'awaiting_approval',
    risk_level: 'medium',
    created_at: '2026-05-24T10:12:43.000Z',
    budget: { spent: 12.43, soft: 50, hard: 100 },
    actor: 'ai-agent@divinity',
    task: {
      provider_runtime: {
        provider_id: 'cerebras',
        display_name: 'Cerebras',
        transport: 'chat_completions',
        capabilities: ['chat', 'free_tier_models', 'openai_compatible']
      },
      toolset_resolution: {
        format: 'divinity.toolset_resolution.v1',
        tools: ['read_file', 'search_files', 'web_extract', 'web_search'],
        policy_permissions: ['file:read', 'network:read'],
        risk_summary: {
          highest_risk_level: 'medium',
          high_risk_toolsets: [],
          medium_risk_toolsets: ['file'],
          low_risk_toolsets: ['web']
        },
        provider_capability_checks: [
          {
            provider_id: 'openrouter',
            capability: 'tool_calls',
            status: 'supported',
            required_by_toolsets: ['file', 'web']
          },
          {
            provider_id: 'cerebras',
            capability: 'tool_calls',
            status: 'missing',
            required_by_toolsets: ['file', 'web']
          }
        ],
        operator_controls: [
          {
            control_id: 'approval_required',
            status: 'recommended',
            reason: 'medium-risk file toolset selected for repository changes',
            toolsets: ['file']
          },
          {
            control_id: 'provider_capability_review',
            status: 'required',
            reason: 'provider missing required capability: tool_calls',
            provider_id: 'cerebras',
            capability: 'tool_calls',
            toolsets: ['file', 'web']
          }
        ]
      }
    },
    events: [
      event('evt_001', 'task_created', 'queued', 'Task created', 'Task payload accepted by API.', '2026-05-24T10:12:43.000Z', '120ms'),
      event('evt_002', 'preflight_completed', 'awaiting_approval', 'Preflight requires approval', 'Predicted write and test execution actions.', '2026-05-24T10:12:58.000Z', '2.34s', [
        evidence('inferred', 'task.objective', 'Predicted write and test execution actions.'),
        evidence('observed', 'policy.permissions', 'safe_exec policy grants scoped write and shell execution.')
      ]),
      event('evt_003', 'status_changed', 'awaiting_approval', 'Awaiting approval', 'Manual approval required before execution.', '2026-05-24T10:13:28.000Z', '-'),
      event('evt_004', 'connector_reference_attached', 'awaiting_approval', 'Connector reference attached', 'Ticket context DIV-17 is attached to the run.', '2026-05-24T10:13:33.000Z', '-')
    ],
    decision_trace: decisionTrace('request_operator_approval', 'execute_without_approval', 'Risk threshold requires an operator decision before execution continues.', [
      evidence('inferred', 'task.objective', 'Predicted write and test execution actions.'),
      evidence('observed', 'policy.permissions', 'safe_exec policy grants scoped write and shell execution.')
    ]),
    goals: [
      goalRecord('goal_0012_001', 'All contract examples validate', 'pending', 0.75),
      goalRecord('goal_0012_002', 'Smoke path leaves no repo config behind', 'pending', 0.75)
    ],
    approval_revision: {
      revision_id: 'approval_revision_run_2026_05_24_0012_001',
      run_id: 'run_2026_05_24_0012',
      actor: 'operator@example.com',
      reason: 'Rollback evidence needs to be attached before approval.',
      requested_changes: ['Attach rollback plan', 'Confirm release window'],
      status: 'resubmitted',
      requested_at: '2026-05-24T10:14:12.000Z',
      resubmitted_by: 'builder@example.com',
      resubmission_reason: 'Rollback plan and release window evidence attached.',
      resubmitted_at: '2026-05-24T10:22:41.000Z'
    },
    approval_comments: [
      {
        comment_id: 'approval_comment_run_2026_05_24_0012_001',
        run_id: 'run_2026_05_24_0012',
        actor: 'operator@example.com',
        body: 'Confirm rollback evidence before approving the pagination change.',
        created_at: '2026-05-24T10:14:03.000Z'
      }
    ],
    connector_references: [
      connectorReference('ref_a11ce0000000001', 'ticket_reference', 'ticket', 'DIV-17', 'https://example.test/tickets/DIV-17', 'Pagination ticket'),
      connectorReference('ref_a11ce0000000002', 'docs_reference', 'document', 'SPEC-USERS-PAGING', 'https://example.test/docs/users-pagination', 'Pagination spec')
    ],
    agent_activity: [
      agentActivity('activity_0012_planner', 'planner', 'completed', 0.3),
      agentActivity('activity_0012_executor', 'executor', 'gated', 0.9),
      agentActivity('activity_0012_verifier', 'verifier', 'waiting', 0.3)
    ],
    artifacts: [
      artifact('artifact_patch_0012', 'patch', 'artifact://run_2026_05_24_0012/patch.diff'),
      artifact('artifact_log_0012', 'log', 'artifact://run_2026_05_24_0012/run.log'),
      artifact('artifact_summary_0012', 'summary', 'artifact://run_2026_05_24_0012/summary.md'),
      artifact('artifact_pr_summary_0012', 'pr_summary', 'artifact://run_2026_05_24_0012/pr-summary.md')
    ],
    heartbeats: [],
    last_heartbeat_at: null,
    audit: {
      hash: 'b3f9c8d2e5f4a7d9b2c7e6f0a1b9c8d2f6e7a1b9c8d2e6f4a7d9b2c7e6f0a1b9',
      recorded_at: '2026-05-24T10:13:28.000Z'
    }
  },
  {
    run_id: 'run_2026_05_24_0011',
    task_id: 'task_auth_middleware',
    objective: 'Refactor auth middleware to support API keys',
    status: 'running',
    risk_level: 'low',
    created_at: '2026-05-24T09:47:10.000Z',
    budget: { spent: 8.21, soft: 40, hard: 75 },
    actor: 'ai-agent@divinity',
    events: [
      event('evt_011', 'task_created', 'queued', 'Task created', 'Repository context attached.', '2026-05-24T09:47:10.000Z', '90ms'),
      event('evt_012', 'preflight_completed', 'queued', 'Preflight allowed', 'Read and scoped edit permissions granted.', '2026-05-24T09:47:22.000Z', '1.2s'),
      event('evt_013', 'status_changed', 'running', 'Execution running', 'Implementation loop is applying changes.', '2026-05-24T09:48:01.000Z', '5.26s')
    ],
    decision_trace: decisionTrace('queue_for_execution', 'pause_or_request_approval', 'Preflight allowed the run to enter the execution queue.', [
      evidence('observed', 'policy.permissions', 'safe_exec policy grants scoped write and shell execution.')
    ]),
    goals: [
      goalRecord('goal_0011_001', 'API key middleware remains backward compatible', 'pending', 0.38)
    ],
    approval_revision: {
      revision_id: 'approval_revision_run_2026_05_24_0011_001',
      run_id: 'run_2026_05_24_0011',
      actor: 'operator@example.com',
      reason: 'Need compatibility proof before final approval.',
      requested_changes: ['Attach middleware compatibility evidence'],
      status: 'resubmitted',
      requested_at: '2026-05-24T09:50:01.000Z',
      resubmitted_by: 'builder@example.com',
      resubmission_reason: 'Compatibility smoke evidence attached.',
      resubmitted_at: '2026-05-24T09:55:21.000Z'
    },
    connector_references: [
      connectorReference('ref_a11ce0000000011', 'ci_status', 'ci_run', 'ci-5812', 'https://example.test/ci/5812', 'Middleware CI')
    ],
    artifacts: [
      artifact('artifact_log_0011', 'log', 'artifact://run_2026_05_24_0011/run.log'),
      artifact('artifact_summary_0011', 'summary', 'artifact://run_2026_05_24_0011/summary.md')
    ],
    heartbeats: [
      heartbeat('heartbeat_0011_alive', 'run_2026_05_24_0011', 'executor@divinity', 'alive', 'Execution loop is still active.', '2026-05-24T09:49:01.000Z')
    ],
    last_heartbeat_at: '2026-05-24T09:49:01.000Z',
    audit: {
      hash: '8f3a7c2d5e6f4a1bb3f9c8d2e5f4a7d9b2c7e6f0a1b9c8d2f6e7a1b9c8d2e6f4',
      recorded_at: '2026-05-24T09:48:01.000Z'
    }
  },
  {
    run_id: 'run_2026_05_24_0010',
    task_id: 'task_n_plus_one',
    objective: 'Fix N+1 query in user list endpoint',
    status: 'completed',
    risk_level: 'low',
    created_at: '2026-05-24T08:33:14.000Z',
    budget: { spent: 4.15, soft: 30, hard: 50 },
    actor: 'ai-agent@divinity',
    events: [
      event('evt_101', 'task_created', 'queued', 'Task created', 'Objective normalized.', '2026-05-24T08:33:14.000Z', '80ms'),
      event('evt_102', 'preflight_completed', 'queued', 'Preflight allowed', 'No high-risk action predicted.', '2026-05-24T08:33:23.000Z', '820ms'),
      event('evt_103', 'status_changed', 'completed', 'Completed', 'Patch, log, and summary artifacts exported.', '2026-05-24T08:42:11.000Z', '4.18s')
    ],
    decision_trace: decisionTrace('queue_for_execution', 'pause_or_request_approval', 'Preflight allowed the run to enter the execution queue.', [
      evidence('inferred', 'task.objective', 'No high-risk action predicted.')
    ]),
    goals: [
      goalRecord('goal_0010_001', 'User list query count is stable', 'completed', 0.13),
      goalRecord('goal_0010_002', 'Summary artifact explains the fix', 'completed', 0.12)
    ],
    agent_activity: [
      agentActivity('activity_0010_planner', 'planner', 'completed', 0.05),
      agentActivity('activity_0010_executor', 'executor', 'ready', 0.15),
      agentActivity('activity_0010_verifier', 'verifier', 'completed', 0.05)
    ],
    executions: [
      {
        execution_id: 'exec_0010_readme',
        step_id: 'step_readme',
        adapter: 'file_read',
        status: 'completed',
        exit_code: 0,
        attempt: 1,
        max_attempts: 2,
        retry_of: null,
        target_path: 'README.md',
        stdout: '# Divinity Code',
        stderr: '',
        completed_at: '2026-05-24T08:38:21.000Z'
      },
      {
        execution_id: 'exec_0010_git',
        step_id: 'step_git_status',
        adapter: 'git_status',
        status: 'completed',
        exit_code: 0,
        attempt: 1,
        max_attempts: 2,
        retry_of: null,
        target_path: null,
        stdout: ' M apps/api/src/server.mjs',
        stderr: '',
        completed_at: '2026-05-24T08:39:03.000Z'
      },
      {
        execution_id: 'exec_0010_test',
        step_id: 'step_dashboard_static',
        adapter: 'node_test',
        status: 'completed',
        exit_code: 0,
        attempt: 1,
        max_attempts: 2,
        retry_of: null,
        target_path: 'tests/tests_dashboard_static.mjs',
        stdout: '{"ok":true,"dashboard":"static-shell","runs":6}',
        stderr: '',
        completed_at: '2026-05-24T08:40:19.000Z'
      },
      {
        execution_id: 'exec_0010_contracts',
        step_id: 'step_validate_contracts',
        adapter: 'package_script',
        status: 'completed',
        exit_code: 0,
        attempt: 1,
        max_attempts: 2,
        retry_of: null,
        target_path: 'package.json#scripts.validate:contracts',
        stdout: 'PASS packages/contracts/examples/task.valid.json expected=true',
        stderr: '',
        completed_at: '2026-05-24T08:41:03.000Z'
      }
    ],
    verifications: [
      verification('verify_exec_0010_readme', 'exec_0010_readme', 'step_readme', 'passed'),
      verification('verify_exec_0010_git', 'exec_0010_git', 'step_git_status', 'passed'),
      verification('verify_exec_0010_test', 'exec_0010_test', 'step_dashboard_static', 'passed'),
      verification('verify_exec_0010_contracts', 'exec_0010_contracts', 'step_validate_contracts', 'passed')
    ],
    artifacts: [
      artifact('artifact_patch_0010', 'patch', 'artifact://run_2026_05_24_0010/patch.diff'),
      artifact('artifact_log_0010', 'log', 'artifact://run_2026_05_24_0010/run.log'),
      artifact('artifact_summary_0010', 'summary', 'artifact://run_2026_05_24_0010/summary.md')
    ],
    audit: {
      hash: 'c9e1a8f6d4b2c0e7f5a3d1b9c8e6f4a2d0b7c5e3f1a9d8c6b4e2f0a7d5c3b1aa',
      recorded_at: '2026-05-24T08:42:11.000Z'
    }
  },
  {
    run_id: 'run_2026_05_24_0009',
    task_id: 'task_order_index',
    objective: 'Add missing index for orders.customer_id',
    status: 'failed',
    risk_level: 'medium',
    created_at: '2026-05-24T07:58:05.000Z',
    budget: { spent: 2.31, soft: 20, hard: 40 },
    actor: 'ai-agent@divinity',
    events: [
      event('evt_091', 'task_created', 'queued', 'Task created', 'Database migration task accepted.', '2026-05-24T07:58:05.000Z', '110ms'),
      event('evt_092', 'preflight_completed', 'failed', 'Preflight blocked', 'Migration permission was missing.', '2026-05-24T07:58:16.000Z', '1.04s'),
      event('evt_093', 'status_changed', 'failed', 'Run failed', 'Policy gate blocked execution.', '2026-05-24T07:58:18.000Z', '-')
    ],
    decision_trace: decisionTrace('stop_before_execution', 'execute_disallowed_action', 'Policy or permission checks blocked the requested work before side effects.', [
      evidence('observed', 'policy.permissions', 'Migration permission was missing.')
    ]),
    goals: [
      goalRecord('goal_0009_001', 'Index migration is reviewed before execution', 'blocked', 0.75)
    ],
    artifacts: [
      artifact('artifact_log_0009', 'log', 'artifact://run_2026_05_24_0009/run.log'),
      artifact('artifact_summary_0009', 'summary', 'artifact://run_2026_05_24_0009/summary.md')
    ],
    executions: [
      {
        execution_id: 'exec_0009_readme_first',
        step_id: 'step_retry_readme',
        adapter: 'file_read',
        status: 'failed',
        exit_code: 1,
        attempt: 1,
        max_attempts: 2,
        retry_of: null,
        target_path: 'README.md',
        stdout: '',
        stderr: 'ENOENT: no such file or directory',
        completed_at: '2026-05-24T07:59:11.000Z'
      },
      {
        execution_id: 'exec_0009_readme_retry',
        step_id: 'step_retry_readme',
        adapter: 'file_read',
        status: 'failed',
        exit_code: 1,
        attempt: 2,
        max_attempts: 2,
        retry_of: 'exec_0009_readme_first',
        target_path: 'README.md',
        stdout: '',
        stderr: 'Retry limit reached; operator checkpoint required.',
        completed_at: '2026-05-24T08:00:04.000Z'
      }
    ],
    verifications: [
      verification('verify_exec_0009_first', 'exec_0009_readme_first', 'step_retry_readme', 'failed'),
      verification('verify_exec_0009_retry', 'exec_0009_readme_retry', 'step_retry_readme', 'failed')
    ],
    audit: {
      hash: 'da8f3c7e2b6a1d9f4c8e3b7a2d6f1c9e5b0a4d8f2c6e1b9a3d7f0c4e8b2a6d1a',
      recorded_at: '2026-05-24T07:58:18.000Z'
    }
  },
  {
    run_id: 'run_2026_05_24_0008',
    task_id: 'task_lockfile',
    objective: 'Update dependencies and lockfile',
    status: 'queued',
    risk_level: 'low',
    created_at: '2026-05-24T07:22:45.000Z',
    budget: { spent: 0, soft: 25, hard: 50 },
    actor: 'ai-agent@divinity',
    events: [
      event('evt_081', 'task_created', 'queued', 'Task created', 'Waiting for scheduler capacity.', '2026-05-24T07:22:45.000Z', '-')
    ],
    decision_trace: decisionTrace('queue_for_execution', 'pause_or_request_approval', 'Preflight allowed the run to enter the execution queue.', []),
    goals: [
      goalRecord('goal_0008_001', 'Dependency update keeps lockfile reproducible', 'pending', 0.25)
    ],
    artifacts: [],
    audit: {
      hash: 'f1c9e5b0a4d8f2c6e1b9a3d7f0c4e8b2a6d1da8f3c7e2b6a1d9f4c8e3b7a2d6a',
      recorded_at: '2026-05-24T07:22:45.000Z'
    }
  },
  {
    run_id: 'run_2026_05_24_0007',
    task_id: 'task_rate_limit',
    objective: 'Implement rate limiting for login endpoint',
    status: 'paused',
    risk_level: 'high',
    created_at: '2026-05-24T06:58:32.000Z',
    budget: { spent: 42.14, soft: 60, hard: 90 },
    actor: 'ai-agent@divinity',
    events: [
      event('evt_071', 'task_created', 'queued', 'Task created', 'Security-sensitive endpoint flagged.', '2026-05-24T06:58:32.000Z', '130ms'),
      event('evt_072', 'preflight_completed', 'awaiting_approval', 'Preflight requires approval', 'Scoped edit and safe exec permissions granted.', '2026-05-24T06:58:51.000Z', '2.1s', [
        evidence('inferred', 'task.objective', 'Security-sensitive endpoint work was classified from objective text.'),
        evidence('observed', 'policy.permissions', 'safe_exec policy grants scoped write and shell execution.')
      ]),
      event('evt_073', 'approval_revision_requested', 'awaiting_approval', 'Approval revision requested', 'Operator requested rate-limit rollout evidence.', '2026-05-24T07:02:17.000Z', '6.12s'),
      event('evt_074', 'status_changed', 'paused', 'Paused for revision', 'Run paused until requested approval evidence is resubmitted.', '2026-05-24T07:02:18.000Z', '-')
    ],
    decision_trace: decisionTrace('request_revision', 'approve_without_requested_changes', 'Operator requested revision evidence before the run can return to the approval queue.', [
      evidence('observed', 'policy.permissions', 'safe_exec policy grants scoped write and shell execution.')
    ]),
    goals: [
      goalRecord('goal_0007_001', 'Rate limiting rollout evidence is attached before approval', 'blocked', 1.5)
    ],
    approval_revision: {
      revision_id: 'approval_revision_run_2026_05_24_0007_001',
      run_id: 'run_2026_05_24_0007',
      actor: 'operator@example.com',
      reason: 'Need rollout evidence before approving security-sensitive rate limiting.',
      requested_changes: ['Attach staged rollout plan', 'Confirm lockout rollback steps'],
      status: 'requested',
      requested_at: '2026-05-24T07:02:17.000Z'
    },
    artifacts: [
      artifact('artifact_log_0007', 'log', 'artifact://run_2026_05_24_0007/run.log')
    ],
    audit: {
      hash: 'a4d8f2c6e1b9a3d7f0c4e8b2a6d1da8f3c7e2b6a1d9f4c8e3b7a2d6f1c9e5b0a',
      recorded_at: '2026-05-24T07:02:17.000Z'
    }
  }
];

let runs = sampleRuns;
let runEventSource = null;
let subscribedRunId = null;
let apiRunsLoaded = false;
let observabilitySummary = createObservabilitySummary({ runs });

const state = {
  filter: 'all',
  search: '',
  selectedRunId: runs[0].run_id
};

const selectors = {
  runList: document.querySelector('[data-run-list]'),
  approvalList: document.querySelector('[data-approval-list]'),
  observabilitySummary: document.querySelector('[data-observability-summary]'),
  livenessSummary: document.querySelector('[data-liveness-summary]'),
  failureTaxonomy: document.querySelector('[data-failure-taxonomy]'),
  scopeRollups: document.querySelector('[data-scope-rollups]'),
  statusFilter: document.querySelector('[data-status-filter]'),
  search: document.querySelector('[data-run-search]'),
  toast: document.querySelector('[data-toast]')
};

function event(event_id, type, status, message, detail, created_at, duration, evidence_refs = []) {
  return {
    event_id,
    run_id: '',
    type,
    status,
    message,
    metadata: { detail, duration, evidence_refs },
    created_at
  };
}

function evidence(claim_type, source, summary) {
  return {
    claim_type,
    source,
    summary
  };
}

function artifact(artifact_id, type, uri) {
  return { artifact_id, run_id: '', type, uri };
}

function heartbeat(heartbeat_id, run_id, actor, status, message, recorded_at) {
  return { heartbeat_id, run_id, actor, status, message, recorded_at };
}

function connectorReference(reference_id, adapter, resource_type, resource_id, url = '', title = resource_id) {
  const reference = {
    format: 'divinity.connector_reference.v1',
    reference_id,
    run_id: '',
    adapter,
    resource_type,
    resource_id,
    title,
    attached_by: 'operator@divinity',
    attached_at: '2026-05-24T10:12:43.000Z',
    metadata: {}
  };
  if (url) reference.url = url;
  return reference;
}

function goalRecord(goal_id, title, status, budget_estimate_usd) {
  return {
    format: 'divinity.goal.v1',
    goal_id,
    run_id: '',
    task_id: '',
    scope: DEFAULT_SCOPE,
    source: 'task.success_criteria',
    title,
    status,
    budget_estimate_usd,
    evidence_refs: [
      evidence('observed', 'task.success_criteria', title)
    ],
    completion_evidence_refs: []
  };
}

function agentActivity(activity_id, role, status, budget_estimate_usd) {
  return {
    activity_id,
    run_id: '',
    role,
    actor_id: `${role}@divinity`,
    action: `${role} activity`,
    reason: `${role} activity reason`,
    status,
    budget_estimate_usd,
    evidence_refs: [
      evidence('inferred', 'task.objective', `${role} activity is based on objective classification.`)
    ],
    created_at: '2026-05-24T08:33:14.000Z'
  };
}

function verification(verification_id, execution_id, step_id, result) {
  return {
    verification_id,
    run_id: '',
    step_id,
    execution_id,
    status: 'completed',
    result,
    checks: [
      {
        check_id: 'execution_completed',
        status: result === 'passed' ? 'passed' : 'failed',
        summary: `Verifier observed execution result ${result}.`
      }
    ],
    evidence_refs: [
      evidence('observed', 'execution.exit_code', `Verifier result ${result} for ${execution_id}.`)
    ]
  };
}

function decisionTrace(chosen_path, rejected_alternative, rationale, evidence_refs = []) {
  return { chosen_path, rejected_alternative, rationale, evidence_refs };
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function rounded(value) {
  return Number(safeNumber(value).toFixed(2));
}

function runBudget(run) {
  return {
    estimated_cost_usd: safeNumber(run.preflight?.budget?.estimated_cost_usd ?? run.budget?.spent),
    soft_limit_usd: safeNumber(run.task?.budget?.soft_limit_usd ?? run.budget?.soft),
    hard_limit_usd: safeNumber(run.task?.budget?.hard_limit_usd ?? run.budget?.hard)
  };
}

function runScope(run) {
  const scope = run.task?.scope || run.scope || DEFAULT_SCOPE;
  return {
    org_id: String(scope.org_id || DEFAULT_SCOPE.org_id).trim() || DEFAULT_SCOPE.org_id,
    project_id: String(scope.project_id || DEFAULT_SCOPE.project_id).trim() || DEFAULT_SCOPE.project_id
  };
}

function emptyCounts(values) {
  return Object.fromEntries(values.map(value => [value, 0]));
}

function emptyScopeRollup(scope) {
  return {
    scope,
    run_count: 0,
    approvals_pending: 0,
    estimated_cost_usd: 0,
    soft_limit_usd: 0,
    hard_limit_usd: 0,
    status_counts: emptyCounts(['queued', 'running', 'awaiting_approval', 'paused', 'completed', 'failed']),
    risk_counts: emptyCounts(['low', 'medium', 'high', 'critical'])
  };
}

function addRunToScopeRollup(rollup, run, budget) {
  rollup.run_count += 1;
  if (run.status === 'awaiting_approval') rollup.approvals_pending += 1;
  if (rollup.status_counts[run.status] != null) rollup.status_counts[run.status] += 1;
  if (rollup.risk_counts[run.risk_level] != null) rollup.risk_counts[run.risk_level] += 1;
  rollup.estimated_cost_usd += budget.estimated_cost_usd;
  rollup.soft_limit_usd += budget.soft_limit_usd;
  rollup.hard_limit_usd += budget.hard_limit_usd;
}

function finalizeScopeRollup(rollup) {
  const estimatedCost = rounded(rollup.estimated_cost_usd);
  const softLimit = rounded(rollup.soft_limit_usd);
  const hardLimit = rounded(rollup.hard_limit_usd);
  return {
    ...rollup,
    estimated_cost_usd: estimatedCost,
    soft_limit_usd: softLimit,
    hard_limit_usd: hardLimit,
    soft_limit_utilization: softLimit ? rounded(estimatedCost / softLimit) : 0,
    hard_limit_utilization: hardLimit ? rounded(estimatedCost / hardLimit) : 0
  };
}

function sortedScopeRollups(map) {
  return Array.from(map.values()).sort((left, right) => {
    const leftKey = left.scope.project_id ? `${left.scope.org_id}/${left.scope.project_id}` : left.scope.org_id;
    const rightKey = right.scope.project_id ? `${right.scope.org_id}/${right.scope.project_id}` : right.scope.org_id;
    return leftKey.localeCompare(rightKey);
  }).map(finalizeScopeRollup);
}

function createScopeRollups(sourceRuns) {
  const orgRollups = new Map();
  const projectRollups = new Map();

  for (const run of sourceRuns) {
    const scope = runScope(run);
    const budget = runBudget(run);
    const orgKey = scope.org_id;
    const projectKey = `${scope.org_id}/${scope.project_id}`;

    if (!orgRollups.has(orgKey)) {
      orgRollups.set(orgKey, emptyScopeRollup({ level: 'org', org_id: scope.org_id }));
    }
    if (!projectRollups.has(projectKey)) {
      projectRollups.set(projectKey, emptyScopeRollup({
        level: 'project',
        org_id: scope.org_id,
        project_id: scope.project_id
      }));
    }

    addRunToScopeRollup(orgRollups.get(orgKey), run, budget);
    addRunToScopeRollup(projectRollups.get(projectKey), run, budget);
  }

  return [
    ...sortedScopeRollups(orgRollups),
    ...sortedScopeRollups(projectRollups)
  ];
}

function classifyRunFailure(run) {
  const blockedReasons = run.preflight?.blocked_reasons || [];
  if (run.status === 'paused' || blockedReasons.some(reason => reason.includes('budget') || reason.includes('cost'))) {
    return 'budget';
  }

  const executions = run.executions || [];
  if (executions.some(execution => execution.status === 'failed')) return 'execution';

  if (run.status === 'failed' && (
    run.preflight?.decision === 'block'
    || blockedReasons.some(reason => reason.startsWith('permission_denied'))
    || /policy/i.test(run.decision_trace?.rationale || '')
  )) {
    return 'policy';
  }

  if (run.status === 'failed') return 'unknown';
  return null;
}

function latestHeartbeatAt(run) {
  const heartbeats = Array.isArray(run.heartbeats) ? run.heartbeats : [];
  return heartbeats
    .map(item => item.recorded_at)
    .filter(Boolean)
    .sort()
    .at(-1) || run.last_heartbeat_at || null;
}

function staleRunIds(sourceRuns, generated_at, staleAfterMs = 5 * 60 * 1000) {
  const activeStatuses = new Set(['queued', 'running', 'awaiting_approval']);
  const generatedMs = Date.parse(generated_at);
  if (!Number.isFinite(generatedMs)) return [];

  return sourceRuns.filter(run => {
    if (!activeStatuses.has(run.status)) return false;
    const lastSeenAt = latestHeartbeatAt(run) || run.created_at;
    const lastSeenMs = Date.parse(lastSeenAt);
    return Number.isFinite(lastSeenMs) && generatedMs - lastSeenMs > staleAfterMs;
  }).map(run => run.run_id);
}

function createObservabilitySummary({ runs: sourceRuns, generated_at = new Date().toISOString() }) {
  const status_counts = Object.fromEntries(['queued', 'running', 'awaiting_approval', 'paused', 'completed', 'failed'].map(status => [status, 0]));
  const risk_counts = Object.fromEntries(['low', 'medium', 'high', 'critical'].map(risk => [risk, 0]));
  const failureBuckets = new Map(['policy', 'budget', 'execution', 'unknown'].map(category => [category, []]));
  let estimatedCost = 0;
  let softLimit = 0;
  let hardLimit = 0;
  let heartbeatCount = 0;

  for (const run of sourceRuns) {
    if (status_counts[run.status] != null) status_counts[run.status] += 1;
    if (risk_counts[run.risk_level] != null) risk_counts[run.risk_level] += 1;
    heartbeatCount += Array.isArray(run.heartbeats) ? run.heartbeats.length : 0;
    const budget = runBudget(run);
    estimatedCost += budget.estimated_cost_usd;
    softLimit += budget.soft_limit_usd;
    hardLimit += budget.hard_limit_usd;

    const failureCategory = classifyRunFailure(run);
    if (failureCategory) failureBuckets.get(failureCategory).push(run.run_id);
  }

  const staleRuns = staleRunIds(sourceRuns, generated_at);

  return {
    format: 'divinity.observability.v1',
    generated_at,
    totals: {
      run_count: sourceRuns.length,
      approvals_pending: status_counts.awaiting_approval,
      estimated_cost_usd: rounded(estimatedCost),
      soft_limit_usd: rounded(softLimit),
      hard_limit_usd: rounded(hardLimit)
    },
    status_counts,
    risk_counts,
    budget: {
      soft_limit_utilization: softLimit ? rounded(estimatedCost / softLimit) : 0,
      hard_limit_utilization: hardLimit ? rounded(estimatedCost / hardLimit) : 0
    },
    liveness: {
      heartbeat_count: heartbeatCount,
      stale_run_count: staleRuns.length,
      stale_run_ids: staleRuns
    },
    failure_taxonomy: ['policy', 'budget', 'execution', 'unknown'].map(category => ({
      category,
      count: failureBuckets.get(category).length,
      run_ids: failureBuckets.get(category)
    })).filter(item => item.count > 0),
    scope_rollups: createScopeRollups(sourceRuns)
  };
}

function apiBaseUrl() {
  const params = new URLSearchParams(window.location.search);
  const base = params.get('api') || '';
  return base.replace(/\/$/, '');
}

function normalizeApiEvent(runEvent) {
  return {
    ...runEvent,
    metadata: {
      ...runEvent.metadata,
      detail: runEvent.metadata?.detail || runEvent.message,
      duration: runEvent.metadata?.duration || '-'
    }
  };
}

function normalizeApiRun(run) {
  const budget = run.task?.budget || run.preflight?.budget || {};
  const createdAt = run.created_at || run.events?.[0]?.created_at || new Date().toISOString();
  const stepExecutions = (run.steps || []).map(step => step.execution).filter(Boolean);
  const stepVerifications = (run.steps || []).map(step => step.verification).filter(Boolean);
  return {
    run_id: run.run_id,
    task_id: run.task_id,
    objective: run.task?.objective || run.task_id || run.run_id,
    status: run.status,
    risk_level: run.risk_level,
    created_at: createdAt,
    budget: {
      spent: run.preflight?.budget?.estimated_cost_usd || 0,
      soft: budget.soft_limit_usd || 0,
      hard: budget.hard_limit_usd || 0
    },
    actor: run.approval?.actor || 'api',
    events: (run.events || []).map(normalizeApiEvent),
    decision_trace: decisionTraceForRun(run),
    goals: run.goals || [],
    approval_revision: run.approval_revision || null,
    approval_comments: run.approval_comments || [],
    agent_activity: run.agent_activity || [],
    toolset_resolution: run.task?.toolset_resolution || run.toolset_resolution || null,
    provider_runtime: run.task?.provider_runtime || run.provider_runtime || null,
    executions: run.executions || stepExecutions,
    verifications: run.verifications || stepVerifications,
    artifacts: run.artifacts || [],
    connector_references: run.connector_references || [],
    heartbeats: run.heartbeats || [],
    last_heartbeat_at: run.last_heartbeat_at || null,
    audit: {
      hash: run.audit?.hash || '0'.repeat(64),
      recorded_at: run.audit?.recorded_at || createdAt
    }
  };
}

function decisionTraceForRun(run) {
  if (run.decision_trace) return run.decision_trace;
  const evidenceRefs = run.preflight?.evidence_refs || [];

  if (run.status === 'awaiting_approval') {
    return decisionTrace('request_operator_approval', 'execute_without_approval', 'Risk threshold requires an operator decision before execution continues.', evidenceRefs);
  }

  if (run.status === 'paused') {
    if (run.approval_revision?.status === 'requested') {
      return decisionTrace('request_revision', 'approve_without_requested_changes', 'Operator requested revision evidence before the run can return to the approval queue.', evidenceRefs);
    }
    return decisionTrace('pause_for_budget_review', 'continue_past_hard_budget_cap', 'Hard budget cap enforcement pauses execution before additional work starts.', evidenceRefs);
  }

  if (run.status === 'failed') {
    return decisionTrace('stop_before_execution', 'execute_disallowed_action', 'Policy or permission checks blocked the requested work before side effects.', evidenceRefs);
  }

  return decisionTrace('queue_for_execution', 'pause_or_request_approval', 'Preflight allowed the run to enter the execution queue.', evidenceRefs);
}

function replaceRun(nextRun) {
  const index = runs.findIndex(run => run.run_id === nextRun.run_id);
  if (index === -1) {
    runs = [nextRun, ...runs];
  } else {
    runs = runs.map(run => run.run_id === nextRun.run_id ? nextRun : run);
  }
  observabilitySummary = createObservabilitySummary({ runs });
}

function closeRunStream() {
  if (!runEventSource) return;
  runEventSource.close();
  runEventSource = null;
  subscribedRunId = null;
}

function subscribeToSelectedRun() {
  const base = apiBaseUrl();
  const runId = state.selectedRunId;
  if (!base || !apiRunsLoaded || !runId || typeof EventSource === 'undefined' || subscribedRunId === runId) return;

  closeRunStream();
  subscribedRunId = runId;
  runEventSource = new EventSource(`${base}/runs/${runId}/stream`);

  const handleUpdate = (event) => {
    const updated = normalizeApiRun(JSON.parse(event.data));
    hydrateRunReferences([updated]);
    replaceRun(updated);
    state.selectedRunId = updated.run_id;
    render();
  };

  runEventSource.addEventListener('run_snapshot', handleUpdate);
  runEventSource.addEventListener('run_updated', handleUpdate);
  runEventSource.addEventListener('error', () => {
    showToast('Live event stream disconnected; use refresh to reload run state');
    closeRunStream();
  });
}

function hydrateRunReferences(sourceRuns) {
  for (const run of sourceRuns) {
    for (const runEvent of run.events) runEvent.run_id = run.run_id;
    for (const runArtifact of run.artifacts) runArtifact.run_id = run.run_id;
    for (const connector of run.connector_references || []) connector.run_id = run.run_id;
    for (const goal of run.goals || []) goal.run_id = run.run_id;
    if (run.approval_revision) run.approval_revision.run_id = run.run_id;
    for (const comment of run.approval_comments || []) comment.run_id = run.run_id;
    for (const activity of run.agent_activity || []) activity.run_id = run.run_id;
    for (const runVerification of run.verifications || []) runVerification.run_id = run.run_id;
    for (const runHeartbeat of run.heartbeats || []) runHeartbeat.run_id = run.run_id;
  }
}

async function loadApiRuns() {
  const base = apiBaseUrl();
  if (!base) return;

  try {
    const response = await fetch(`${base}/runs`);
    if (!response.ok) throw new Error(`GET /runs returned ${response.status}`);
    const payload = await response.json();
    const apiRuns = (payload.runs || []).map(normalizeApiRun);
    if (!apiRuns.length) {
      apiRunsLoaded = false;
      closeRunStream();
      showToast('API connected; no runs are available yet');
      return;
    }
    hydrateRunReferences(apiRuns);
    runs = apiRuns;
    apiRunsLoaded = true;
    observabilitySummary = await loadApiObservability(base);
    state.selectedRunId = apiRuns[0].run_id;
    showToast(`Loaded ${apiRuns.length} run${apiRuns.length === 1 ? '' : 's'} from API`);
    render();
  } catch (error) {
    apiRunsLoaded = false;
    closeRunStream();
    showToast(`API unavailable; using sample data (${error.message})`);
  }
}

async function loadApiObservability(base) {
  try {
    const response = await fetch(`${base}/observability`);
    if (!response.ok) throw new Error(`GET /observability returned ${response.status}`);
    return await response.json();
  } catch (error) {
    showToast(`API observability unavailable; deriving metrics from runs (${error.message})`);
    return createObservabilitySummary({ runs });
  }
}

function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
}

function statusClass(status) {
  return `status-${status}`;
}

function statusLabel(status, compact = false) {
  if (compact && status === 'awaiting_approval') return 'awaiting';
  return status;
}

function goalStatusClass(status) {
  if (status === 'blocked') return 'status-paused';
  if (status === 'completed') return 'status-completed';
  return 'status-queued';
}

function riskClass(risk) {
  return `risk-${risk}`;
}

function filteredRuns() {
  return runs.filter(run => {
    const statusMatch = state.filter === 'all' || run.status === state.filter;
    const searchText = `${run.run_id} ${run.objective} ${run.task_id}`.toLowerCase();
    return statusMatch && searchText.includes(state.search.toLowerCase());
  });
}

function countByStatus(status) {
  if (status === 'all') return runs.length;
  return runs.filter(run => run.status === status).length;
}

function budgetPercent(run) {
  if (!run.budget.soft) return 0;
  return Math.min(100, Math.round((run.budget.spent / run.budget.soft) * 100));
}

function renderCounts() {
  for (const node of document.querySelectorAll('[data-count]')) {
    node.textContent = countByStatus(node.dataset.count);
  }

  const approvalCount = runs.filter(run => run.status === 'awaiting_approval').length;
  for (const node of document.querySelectorAll('[data-approval-count]')) {
    node.textContent = approvalCount;
  }
}

function renderObservability() {
  const summary = observabilitySummary || createObservabilitySummary({ runs });
  selectors.observabilitySummary.innerHTML = `
    <div>
      <dt>Runs</dt>
      <dd>${summary.totals.run_count}</dd>
    </div>
    <div>
      <dt>Pending</dt>
      <dd>${summary.totals.approvals_pending}</dd>
    </div>
    <div>
      <dt>Est. Cost</dt>
      <dd>${formatCurrency(summary.totals.estimated_cost_usd)}</dd>
    </div>
    <div>
      <dt>Soft Use</dt>
      <dd>${Math.round(summary.budget.soft_limit_utilization * 100)}%</dd>
    </div>
  `;
  selectors.livenessSummary.innerHTML = renderLivenessSummary(summary.liveness);
  selectors.scopeRollups.innerHTML = renderScopeRollups(summary.scope_rollups);
  selectors.failureTaxonomy.innerHTML = renderFailureTaxonomy(summary.failure_taxonomy);
}

function renderLivenessSummary(liveness = { heartbeat_count: 0, stale_run_count: 0, stale_run_ids: [] }) {
  return `
    <article class="liveness-card">
      <div>
        <strong>${liveness.heartbeat_count}</strong>
        <span>heartbeats</span>
      </div>
      <div>
        <strong>${liveness.stale_run_count}</strong>
        <span>stale runs</span>
      </div>
      <code>${(liveness.stale_run_ids || []).join(', ') || 'none'}</code>
    </article>
  `;
}

function renderFailureTaxonomy(items = []) {
  if (!items.length) return '<div class="empty-state">No failures are classified.</div>';

  return items.map(item => `
    <article class="taxonomy-item">
      <div>
        <strong>${item.category}</strong>
        <span>${item.count} run${item.count === 1 ? '' : 's'}</span>
      </div>
      <code>${item.run_ids.join(', ')}</code>
    </article>
  `).join('');
}

function renderScopeRollups(items = []) {
  if (!items.length) return '<div class="empty-state">No scope rollups are available.</div>';

  return items.map(item => {
    const label = item.scope.level === 'org'
      ? item.scope.org_id
      : `${item.scope.org_id}/${item.scope.project_id}`;
    return `
      <article class="scope-rollup-item">
        <div>
          <strong>${label}</strong>
          <span>${item.scope.level}</span>
        </div>
        <dl>
          <div><dt>Runs</dt><dd>${item.run_count}</dd></div>
          <div><dt>Pending</dt><dd>${item.approvals_pending}</dd></div>
          <div><dt>Cost</dt><dd>${formatCurrency(item.estimated_cost_usd)}</dd></div>
          <div><dt>Soft Use</dt><dd>${Math.round(item.soft_limit_utilization * 100)}%</dd></div>
        </dl>
      </article>
    `;
  }).join('');
}

function renderRunList() {
  const rows = filteredRuns().map(run => `
    <tr class="run-row ${run.run_id === state.selectedRunId ? 'selected' : ''}" data-run-id="${run.run_id}" tabindex="0">
      <td>
        <span class="run-radio">
          <span class="radio-dot" aria-hidden="true"></span>
          ${run.run_id.replace('run_', 'RUN-')}
        </span>
      </td>
      <td class="objective-cell">${run.objective}</td>
      <td><span class="status-pill ${statusClass(run.status)}">${statusLabel(run.status, true)}</span></td>
      <td><span class="risk-pill ${riskClass(run.risk_level)}">${run.risk_level}</span></td>
      <td>
        <span class="budget-cell">
          <span>${formatCurrency(run.budget.spent)} / ${formatCurrency(run.budget.soft)}</span>
          <span class="budget-bar" aria-hidden="true"><span style="width:${budgetPercent(run)}%"></span></span>
        </span>
      </td>
    </tr>
  `).join('');

  selectors.runList.innerHTML = rows || `
    <tr class="run-row">
      <td colspan="5" class="empty-state">No runs match the current filter.</td>
    </tr>
  `;

  for (const row of selectors.runList.querySelectorAll('[data-run-id]')) {
    row.addEventListener('click', () => selectRun(row.dataset.runId));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectRun(row.dataset.runId);
      }
    });
  }
}

function selectedRun() {
  return runs.find(run => run.run_id === state.selectedRunId) || runs[0];
}

function renderRunDetail() {
  const run = selectedRun();
  document.querySelector('[data-selected-run-id]').textContent = run.run_id.replace('run_', 'RUN-');
  document.querySelector('[data-selected-objective]').textContent = run.objective;
  document.querySelector('[data-selected-created]').textContent = formatDate(run.created_at);
  document.querySelector('[data-selected-soft]').textContent = formatCurrency(run.budget.soft);
  document.querySelector('[data-selected-hard]').textContent = formatCurrency(run.budget.hard);
  document.querySelector('[data-selected-risk]').innerHTML = `<span class="risk-pill ${riskClass(run.risk_level)}">${run.risk_level}</span>`;

  const status = document.querySelector('[data-selected-status]');
  status.textContent = statusLabel(run.status);
  status.className = `status-pill ${statusClass(run.status)}`;

  document.querySelector('[data-event-timeline]').innerHTML = run.events.map(renderEvent).join('');
  document.querySelector('[data-decision-trace]').innerHTML = renderDecisionTrace(run.decision_trace);
  document.querySelector('[data-operator-control-list]').innerHTML = renderOperatorControls(run);
  document.querySelector('[data-goal-list]').innerHTML = renderGoals(run);
  document.querySelector('[data-approval-revision]').innerHTML = renderApprovalRevision(run);
  document.querySelector('[data-approval-comment-list]').innerHTML = renderApprovalComments(run);
  document.querySelector('[data-connector-reference-list]').innerHTML = renderConnectorReferences(run);
  document.querySelector('[data-agent-activity-list]').innerHTML = renderAgentActivity(run);
  document.querySelector('[data-execution-list]').innerHTML = renderExecutions(run);
  document.querySelector('[data-artifact-list]').innerHTML = renderArtifacts(run);
  document.querySelector('[data-audit-hash]').textContent = run.audit.hash;
  document.querySelector('[data-audit-recorded]').textContent = formatDate(run.audit.recorded_at);
}

function renderDecisionTrace(trace) {
  return `
    <dl>
      <div>
        <dt>Chosen</dt>
        <dd>${trace.chosen_path}</dd>
      </div>
      <div>
        <dt>Rejected</dt>
        <dd>${trace.rejected_alternative}</dd>
      </div>
    </dl>
    <p>${trace.rationale}</p>
    ${renderEvidenceLabels(trace.evidence_refs)}
  `;
}

function renderEvent(runEvent) {
  const tone = runEvent.status === 'failed'
    ? 'fail'
    : runEvent.status === 'awaiting_approval'
      ? 'warn'
      : 'success';
  const icon = tone === 'fail' ? '!' : tone === 'warn' ? '!' : 'ok';

  return `
    <li class="timeline-event">
      <time class="event-time" datetime="${runEvent.created_at}">${formatTime(runEvent.created_at)}</time>
      <span class="event-dot ${tone}" aria-hidden="true">${icon}</span>
      <span class="event-copy">
        <strong>${runEvent.message}</strong>
        <span>${runEvent.metadata.detail}</span>
        ${renderEvidenceLabels(runEvent.metadata.evidence_refs)}
      </span>
      <span class="event-duration">${runEvent.metadata.duration}</span>
    </li>
  `;
}

function renderEvidenceLabels(evidenceRefs = []) {
  if (!evidenceRefs.length) return '';

  return `
    <span class="claim-list">
      ${evidenceRefs.map(evidence => `
        <span class="claim-chip claim-${evidence.claim_type}" title="${evidence.source}: ${evidence.summary}">
          ${evidence.claim_type === 'observed' ? 'Observed' : 'Inferred'}
        </span>
      `).join('')}
    </span>
  `;
}

function renderArtifacts(run) {
  if (!run.artifacts.length) {
    return '<li class="empty-state">Artifacts will appear after execution starts.</li>';
  }

  return run.artifacts.map(item => `
    <li class="artifact-item">
      <span class="artifact-icon" aria-hidden="true">[]</span>
      <span>${item.uri.split('/').pop()}</span>
      <span>${item.type}</span>
    </li>
  `).join('');
}

function renderConnectorReferences(run) {
  const references = run.connector_references || [];
  if (!references.length) {
    return '<li class="empty-state">Connector references appear when tickets, docs, or CI context is attached.</li>';
  }

  return references.map(reference => `
    <li class="connector-reference-item">
      <span class="connector-adapter">${reference.adapter}</span>
      <span class="connector-copy">
        <strong>${reference.title || reference.resource_id}</strong>
        <span>${reference.resource_type} / ${reference.resource_id}</span>
      </span>
      ${reference.url ? `<a href="${reference.url}" target="_blank" rel="noreferrer">Open</a>` : '<span class="connector-missing-link">No link</span>'}
    </li>
  `).join('');
}

function runToolsetResolution(run) {
  return run.toolset_resolution || run.task?.toolset_resolution || null;
}

function runOperatorControls(run) {
  const resolution = runToolsetResolution(run);
  return Array.isArray(resolution?.operator_controls) ? resolution.operator_controls : [];
}

function operatorControlStatusClass(control) {
  if (control.status === 'required') return 'status-failed';
  if (control.status === 'recommended') return 'status-awaiting_approval';
  return 'status-queued';
}

function renderOperatorControlMeta(control) {
  const parts = [];
  if (control.provider_id) parts.push(`provider ${control.provider_id}`);
  if (control.capability) parts.push(`capability ${control.capability}`);
  if (Array.isArray(control.toolsets) && control.toolsets.length) parts.push(`toolsets ${control.toolsets.join(', ')}`);
  return parts.map(part => `<span>${part}</span>`).join('');
}

function renderOperatorControls(run) {
  const resolution = runToolsetResolution(run);
  if (!resolution) {
    return '<li class="empty-state">Operator controls appear when provider and toolset governance metadata is attached.</li>';
  }

  const controls = runOperatorControls(run);
  const permissions = Array.isArray(resolution.policy_permissions) ? resolution.policy_permissions : [];
  const checks = Array.isArray(resolution.provider_capability_checks) ? resolution.provider_capability_checks : [];
  const renderedControls = controls.map(control => `
    <li class="operator-control-item">
      <span class="status-pill ${operatorControlStatusClass(control)}">${control.status}</span>
      <span class="operator-control-copy">
        <strong>${control.control_id}</strong>
        <span>${control.reason || 'No reason recorded.'}</span>
      </span>
      <span class="operator-control-meta">${renderOperatorControlMeta(control)}</span>
    </li>
  `).join('');
  const renderedChecks = checks.map(check => `
    <li class="operator-control-item">
      <span class="status-pill ${check.status === 'missing' ? 'status-failed' : 'status-completed'}">${check.status}</span>
      <span class="operator-control-copy">
        <strong>${check.provider_id} / ${check.capability}</strong>
        <span>Required by ${(check.required_by_toolsets || []).join(', ') || 'no toolsets recorded'}</span>
      </span>
      <span class="operator-control-meta"><span>provider capability check</span></span>
    </li>
  `).join('');
  const renderedPermissions = permissions.length
    ? `<li class="operator-permissions"><strong>Policy permissions</strong><span>${permissions.join(', ')}</span></li>`
    : '';

  return renderedControls || renderedChecks || renderedPermissions
    ? `${renderedControls}${renderedChecks}${renderedPermissions}`
    : '<li class="empty-state">No operator controls are required for this run.</li>';
}

function renderGoals(run) {
  const goals = run.goals || [];
  if (!goals.length) {
    return '<li class="empty-state">Goals appear when task success criteria are attached.</li>';
  }

  return goals.map(goal => `
    <li class="goal-item">
      <span class="goal-copy">
        <strong>${goal.title}</strong>
        <span>${goal.source} / ${goal.goal_id}</span>
      </span>
      <span class="status-pill ${goalStatusClass(goal.status)}">${goal.status}</span>
      <span class="goal-budget">${formatCurrency(goal.budget_estimate_usd || 0)}</span>
      ${renderEvidenceLabels(goal.evidence_refs)}
    </li>
  `).join('');
}

function renderApprovalComments(run) {
  const comments = run.approval_comments || [];
  if (!comments.length) {
    return '<li class="empty-state">Approval comments appear when operators add review context.</li>';
  }

  return comments.map(comment => `
    <li class="approval-comment-item">
      <span class="approval-comment-copy">
        <strong>${comment.actor}</strong>
        <span>${comment.body}</span>
      </span>
      <time datetime="${comment.created_at}">${formatDate(comment.created_at)}</time>
    </li>
  `).join('');
}

function renderApprovalRevision(run) {
  const revision = run.approval_revision;
  if (!revision) {
    return '<div class="empty-state">Approval revision requests appear when operators ask for changes before deciding.</div>';
  }

  const changes = (revision.requested_changes || []).map(change => `<li>${change}</li>`).join('');
  const resubmission = revision.status === 'resubmitted'
    ? `
      <div>
        <dt>Resubmitted</dt>
        <dd>${revision.resubmitted_by || 'operator'} / ${formatDate(revision.resubmitted_at)}</dd>
      </div>
      <p>${revision.resubmission_reason || 'No resubmission reason provided.'}</p>
    `
    : '';

  return `
    <article class="approval-revision-card">
      <div class="approval-revision-header">
        <span class="status-pill ${revision.status === 'requested' ? 'status-paused' : 'status-awaiting_approval'}">${revision.status}</span>
        <time datetime="${revision.requested_at}">${formatDate(revision.requested_at)}</time>
      </div>
      <strong>${revision.reason}</strong>
      <dl>
        <div>
          <dt>Requested by</dt>
          <dd>${revision.actor}</dd>
        </div>
        ${resubmission}
      </dl>
      <ul>${changes || '<li>No specific changes listed.</li>'}</ul>
    </article>
  `;
}

function renderAgentActivity(run) {
  const activity = run.agent_activity || [];
  if (!activity.length) {
    return '<li class="empty-state">Agent activity records appear after planning starts.</li>';
  }

  return activity.map(item => `
    <li class="agent-activity-item">
      <span class="activity-role">${item.role}</span>
      <span class="activity-copy">
        <strong>${item.actor_id}</strong>
        <span>${item.reason}</span>
      </span>
      <span class="status-pill status-${item.status === 'gated' || item.status === 'waiting' ? 'paused' : 'completed'}">${item.status}</span>
      <span class="activity-budget">$${item.budget_estimate_usd.toFixed(2)}</span>
    </li>
  `).join('');
}

function renderExecutions(run) {
  const executions = run.executions || [];
  if (!executions.length) {
    return '<li class="empty-state">Execution records appear after approved steps run.</li>';
  }

  const verificationsByExecution = new Map((run.verifications || []).map(record => [record.execution_id, record]));
  return executions.map(item => `
    <li class="execution-item">
      <span class="execution-main">
        <strong>${item.adapter}</strong>
        <span>${item.step_id}</span>
      </span>
      <span class="status-pill ${item.status === 'completed' ? 'status-completed' : 'status-failed'}">${item.status}</span>
      ${renderVerificationResult(verificationsByExecution.get(item.execution_id))}
      <span class="execution-meta">exit ${item.exit_code}${item.target_path ? ` - ${item.target_path}` : ''}</span>
      ${renderRetryMetadata(item)}
      <code class="execution-output">${(item.stdout || item.stderr || '').split('\n')[0] || '-'}</code>
    </li>
  `).join('');
}

function renderRetryMetadata(item) {
  const attempt = Number(item.attempt || 1);
  const maxAttempts = Number(item.max_attempts || 1);
  const retryOf = item.retry_of || '';
  const retryText = retryOf ? `retry of ${retryOf}` : 'first attempt';
  return `
    <span class="retry-chip">
      attempt ${attempt}/${maxAttempts} - ${retryText}
    </span>
  `;
}

function renderVerificationResult(record) {
  if (!record) return '<span class="verification-chip verification-pending">verify pending</span>';
  return `
    <span class="verification-chip verification-${record.result}">
      verify ${record.result}
    </span>
  `;
}

function renderApprovalQueue() {
  const approvals = runs.filter(run => run.status === 'awaiting_approval');
  selectors.approvalList.innerHTML = approvals.map(run => `
    <article class="approval-card" data-approval-run="${run.run_id}">
      <div>
        <h3>${run.run_id.replace('run_', 'RUN-')}</h3>
        <p>${run.objective}</p>
      </div>
      <dl>
        <div>
          <dt>Risk</dt>
          <dd><span class="risk-pill ${riskClass(run.risk_level)}">${run.risk_level}</span></dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>${formatCurrency(run.budget.spent)} / ${formatCurrency(run.budget.soft)}</dd>
        </div>
      </dl>
      ${renderApprovalControlSummary(run)}
      <div class="approval-actions">
        <button class="approve-button" type="button" data-decision="approve">Approve</button>
        <button class="reject-button" type="button" data-decision="reject">Reject</button>
      </div>
    </article>
  `).join('') || '<div class="empty-state">No approvals are pending.</div>';

  for (const card of selectors.approvalList.querySelectorAll('[data-approval-run]')) {
    for (const button of card.querySelectorAll('[data-decision]')) {
      button.addEventListener('click', () => decideApproval(card.dataset.approvalRun, button.dataset.decision));
    }
  }
}

function renderApprovalControlSummary(run) {
  const controls = runOperatorControls(run);
  if (!controls.length) return '';
  const required = controls.filter(control => control.status === 'required').length;
  const recommended = controls.filter(control => control.status === 'recommended').length;
  return `
    <div class="approval-control-summary">
      <span>${required} required</span>
      <span>${recommended} recommended</span>
    </div>
  `;
}

function selectRun(runId) {
  state.selectedRunId = runId;
  render();
}

async function decideApproval(runId, decision) {
  const run = runs.find(item => item.run_id === runId);
  if (!run || run.status !== 'awaiting_approval') return;

  const base = apiBaseUrl();
  if (base) {
    try {
      const response = await fetch(`${base}/runs/${runId}/approval`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision,
          actor: 'dashboard',
          reason: `Dashboard ${decision} action`
        })
      });
      if (!response.ok) throw new Error(`POST approval returned ${response.status}`);
      const updated = normalizeApiRun(await response.json());
      hydrateRunReferences([updated]);
      replaceRun(updated);
      state.selectedRunId = updated.run_id;
      showToast(`${updated.run_id.replace('run_', 'RUN-')} ${decision === 'approve' ? 'approved' : 'rejected'} by dashboard`);
      render();
      return;
    } catch (error) {
      showToast(`Approval API failed: ${error.message}`);
      return;
    }
  }

  run.status = decision === 'approve' ? 'queued' : 'failed';
  run.events.push(event(
    `evt_${Date.now()}`,
    'approval_decided',
    run.status,
    `Approval decision: ${decision}`,
    `Operator ${decision}d the requested action.`,
    new Date().toISOString(),
    '-'
  ));
  run.audit = {
    hash: `${run.audit.hash.slice(0, 56)}${decision === 'approve' ? 'a110ed01' : 'b10ced01'}`,
    recorded_at: new Date().toISOString()
  };
  state.selectedRunId = run.run_id;
  showToast(`${run.run_id.replace('run_', 'RUN-')} ${decision === 'approve' ? 'approved' : 'rejected'} by operator`);
  render();
}

function showToast(message) {
  selectors.toast.textContent = message;
  selectors.toast.hidden = false;
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    selectors.toast.hidden = true;
  }, 2400);
}

function render() {
  observabilitySummary = apiRunsLoaded ? observabilitySummary : createObservabilitySummary({ runs });
  renderCounts();
  renderObservability();
  renderRunList();
  renderRunDetail();
  renderApprovalQueue();
  subscribeToSelectedRun();
}

selectors.statusFilter.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;

  state.filter = button.dataset.filter;
  for (const item of selectors.statusFilter.querySelectorAll('[data-filter]')) {
    const isActive = item === button;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-selected', String(isActive));
  }
  renderRunList();
});

selectors.search.addEventListener('input', (event) => {
  state.search = event.target.value;
  renderRunList();
});

document.querySelector('[data-refresh-button]').addEventListener('click', () => {
  const base = apiBaseUrl();
  if (base) {
    loadApiRuns();
  } else {
    showToast('Dashboard refreshed from local contract sample data');
  }
});

hydrateRunReferences(runs);

render();
loadApiRuns();
