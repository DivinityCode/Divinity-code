export const RUNTIME_ADAPTERS = [
  {
    adapter: 'divinity_local',
    kind: 'local',
    description: 'Use Divinity Code local CLI/API surfaces as the built-in runtime.',
    command: 'divinity',
    capabilities: ['json_output', 'preflight', 'artifacts', 'verification'],
    requires_auth: false,
    default_isolation_profile: 'workspace_snapshot'
  },
  {
    adapter: 'claude_local',
    kind: 'local',
    description: 'Use an authenticated Claude Code CLI installation as an agent runtime.',
    command: 'claude',
    capabilities: ['interactive_cli', 'resumable_session', 'tool_permissions'],
    requires_auth: true,
    default_isolation_profile: 'workspace_snapshot'
  },
  {
    adapter: 'codex_local',
    kind: 'local',
    description: 'Use an authenticated Codex CLI installation as an agent runtime.',
    command: 'codex',
    capabilities: ['structured_events', 'resumable_session', 'sandbox_profiles'],
    requires_auth: true,
    default_isolation_profile: 'workspace_snapshot'
  },
  {
    adapter: 'generic_process',
    kind: 'external',
    description: 'Run a configured process adapter when no first-party runtime parser exists.',
    command: null,
    capabilities: ['stdout_capture', 'stderr_capture', 'exit_code'],
    requires_auth: false,
    default_isolation_profile: 'container_sandbox'
  }
];

export function publicRuntimeAdapters() {
  return RUNTIME_ADAPTERS.map(adapter => ({
    ...adapter,
    capabilities: [...adapter.capabilities]
  }));
}
