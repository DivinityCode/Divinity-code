export const TOOLSETS = [
  {
    toolset_id: 'web',
    description: 'Research and content extraction tools for public web context.',
    tools: ['web_extract', 'web_search'],
    default_enabled: true,
    risk_level: 'low',
    policy_permissions: ['network:read']
  },
  {
    toolset_id: 'file',
    description: 'Repository file read, write, patch, and search tools.',
    tools: ['patch_file', 'read_file', 'search_files', 'write_file'],
    default_enabled: true,
    risk_level: 'medium',
    policy_permissions: ['file:read', 'file:write']
  },
  {
    toolset_id: 'terminal',
    description: 'Terminal command and process execution tools.',
    tools: ['process_status', 'terminal_command'],
    default_enabled: false,
    risk_level: 'high',
    policy_permissions: ['shell:execute']
  },
  {
    toolset_id: 'code_execution',
    description: 'Constrained test and script execution tools.',
    tools: ['node_test', 'package_script'],
    default_enabled: true,
    risk_level: 'medium',
    policy_permissions: ['test:run']
  },
  {
    toolset_id: 'browser',
    description: 'Browser automation tools for rendered app verification.',
    tools: ['browser_console', 'browser_navigate', 'browser_snapshot'],
    default_enabled: false,
    risk_level: 'medium',
    policy_permissions: ['browser:control', 'network:read']
  },
  {
    toolset_id: 'memory',
    description: 'Provenance-first session, project, and team memory tools.',
    tools: ['memory_read', 'memory_write'],
    default_enabled: true,
    risk_level: 'medium',
    policy_permissions: ['memory:read', 'memory:write']
  },
  {
    toolset_id: 'delegation',
    description: 'Planner, executor, verifier, and subagent delegation tools.',
    tools: ['delegate_task', 'record_agent_activity'],
    default_enabled: true,
    risk_level: 'medium',
    policy_permissions: ['agent:delegate']
  },
  {
    toolset_id: 'connectors',
    description: 'Attach ticket, documentation, and CI context references.',
    tools: ['attach_connector_reference', 'list_connector_references'],
    default_enabled: true,
    risk_level: 'low',
    policy_permissions: ['connector:read']
  },
  {
    toolset_id: 'approvals',
    description: 'Approval queue inspection, comments, revision requests, and decisions.',
    tools: ['approve_run', 'comment_on_approval', 'reject_run', 'request_approval_revision'],
    default_enabled: true,
    risk_level: 'high',
    policy_permissions: ['approval:decide', 'approval:read']
  }
];

function cloneToolset(toolset) {
  return {
    format: 'divinity.toolset.v1',
    toolset_id: toolset.toolset_id,
    description: toolset.description,
    tools: [...toolset.tools],
    default_enabled: toolset.default_enabled,
    risk_level: toolset.risk_level,
    policy_permissions: [...toolset.policy_permissions]
  };
}

function assertKnownToolset(toolsetId) {
  const toolset = TOOLSETS.find(candidate => candidate.toolset_id === toolsetId);
  if (!toolset) {
    throw new Error(`unknown toolset: ${toolsetId}`);
  }
  return toolset;
}

export function publicToolsets() {
  return TOOLSETS.map(cloneToolset);
}

export function toolsetById(toolsetId) {
  const normalized = String(toolsetId || '').trim();
  const toolset = TOOLSETS.find(candidate => candidate.toolset_id === normalized);
  return toolset ? cloneToolset(toolset) : null;
}

export function resolveToolsets({ enabled_toolsets = null, disabled_toolsets = [] } = {}) {
  const enabledIds = enabled_toolsets === null
    ? TOOLSETS.filter(toolset => toolset.default_enabled).map(toolset => toolset.toolset_id)
    : enabled_toolsets.map(value => String(value || '').trim()).filter(Boolean);
  const disabledIds = disabled_toolsets.map(value => String(value || '').trim()).filter(Boolean);

  for (const toolsetId of [...enabledIds, ...disabledIds]) {
    assertKnownToolset(toolsetId);
  }

  const disabled = new Set(disabledIds);
  const resolvedToolsets = enabledIds
    .filter(toolsetId => !disabled.has(toolsetId))
    .map(assertKnownToolset);
  const tools = [...new Set(resolvedToolsets.flatMap(toolset => toolset.tools))].sort();

  return {
    format: 'divinity.toolset_resolution.v1',
    toolsets: resolvedToolsets.map(cloneToolset),
    tools
  };
}
