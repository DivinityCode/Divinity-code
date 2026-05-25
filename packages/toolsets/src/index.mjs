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
    tools: ['list_files', 'patch_file', 'read_file', 'search_files', 'write_file'],
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

const TOOL_SCHEMAS = {
  web_extract: {
    description: 'Extract readable public web page content from a URL and return source metadata for operator review.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Public URL to fetch and summarize.' }
      },
      required: ['url'],
      additionalProperties: false
    }
  },
  web_search: {
    description: 'Search public web results for a concise query and return source metadata for operator review.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to run against public web results.' }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  patch_file: {
    description: 'Apply a reviewed patch to a repository file after policy approval.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Repository-relative file path to patch.' },
        patch: { type: 'string', description: 'Unified patch text to apply.' }
      },
      required: ['path', 'patch'],
      additionalProperties: false
    }
  },
  list_files: {
    description: 'List repository files under a directory and return redacted shape metadata.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Repository-relative directory or file scope to list.' },
        max_depth: { type: 'integer', minimum: 0, maximum: 20, description: 'Optional maximum directory depth to inspect.' }
      },
      required: ['path'],
      additionalProperties: false
    }
  },
  read_file: {
    description: 'Read a repository file by path for implementation context.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Repository-relative file path to read.' }
      },
      required: ['path'],
      additionalProperties: false
    }
  },
  search_files: {
    description: 'Search repository files for a literal or regex query and return matching paths.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query or regex.' },
        path: { type: 'string', description: 'Repository-relative directory or file scope.' }
      },
      required: ['query', 'path'],
      additionalProperties: false
    }
  },
  write_file: {
    description: 'Write full replacement content to a repository file after policy approval.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Repository-relative file path to write.' },
        content: { type: 'string', description: 'Complete file content to write.' }
      },
      required: ['path', 'content'],
      additionalProperties: false
    }
  },
  process_status: {
    description: 'Inspect status for a previously started local process.',
    input_schema: {
      type: 'object',
      properties: {
        process_id: { type: 'string', description: 'Process or session identifier to inspect.' }
      },
      required: ['process_id'],
      additionalProperties: false
    }
  },
  terminal_command: {
    description: 'Run a constrained terminal command in the approved workspace context.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command line to execute.' }
      },
      required: ['command'],
      additionalProperties: false
    }
  },
  node_test: {
    description: 'Run a focused Node.js test or syntax check command.',
    input_schema: {
      type: 'object',
      properties: {
        test_path: { type: 'string', description: 'Repository-relative test file or script path.' }
      },
      required: ['test_path'],
      additionalProperties: false
    }
  },
  package_script: {
    description: 'Run an approved package manager script from the repository manifest.',
    input_schema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'Package script name to run.' }
      },
      required: ['script'],
      additionalProperties: false
    }
  },
  browser_console: {
    description: 'Collect browser console diagnostics for a rendered application.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    }
  },
  browser_navigate: {
    description: 'Navigate a controlled browser session to a URL for verification.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open in the controlled browser.' }
      },
      required: ['url'],
      additionalProperties: false
    }
  },
  browser_snapshot: {
    description: 'Capture a structured browser snapshot for rendered UI verification.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    }
  },
  memory_read: {
    description: 'Read approved project memory entries relevant to the current task.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Memory search query.' }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  memory_write: {
    description: 'Write a provenance-tagged memory note after explicit operator approval.',
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Memory scope such as session, project, or team.' },
        content: { type: 'string', description: 'Memory note content.' }
      },
      required: ['scope', 'content'],
      additionalProperties: false
    }
  },
  delegate_task: {
    description: 'Delegate a bounded task to another agent worker and record the requested objective.',
    input_schema: {
      type: 'object',
      properties: {
        objective: { type: 'string', description: 'Concrete delegated objective.' }
      },
      required: ['objective'],
      additionalProperties: false
    }
  },
  record_agent_activity: {
    description: 'Record planner, executor, verifier, or subagent activity for observability.',
    input_schema: {
      type: 'object',
      properties: {
        phase: { type: 'string', description: 'Activity phase name.' },
        status: { type: 'string', description: 'Current status for the activity.' }
      },
      required: ['phase', 'status'],
      additionalProperties: false
    }
  },
  attach_connector_reference: {
    description: 'Attach an external connector reference to the current run for traceability.',
    input_schema: {
      type: 'object',
      properties: {
        connector_id: { type: 'string', description: 'Connector identifier.' },
        reference: { type: 'string', description: 'External ticket, doc, CI, or URL reference.' }
      },
      required: ['connector_id', 'reference'],
      additionalProperties: false
    }
  },
  list_connector_references: {
    description: 'List connector references already attached to a run or project scope.',
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Run, project, or organization scope to inspect.' }
      },
      required: ['scope'],
      additionalProperties: false
    }
  },
  approve_run: {
    description: 'Approve a gated run or action after operator review.',
    input_schema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Run identifier to approve.' },
        reason: { type: 'string', description: 'Approval reason recorded for audit.' }
      },
      required: ['run_id', 'reason'],
      additionalProperties: false
    }
  },
  comment_on_approval: {
    description: 'Add an operator comment to an approval workflow.',
    input_schema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Run identifier for the approval thread.' },
        comment: { type: 'string', description: 'Comment text to record.' }
      },
      required: ['run_id', 'comment'],
      additionalProperties: false
    }
  },
  reject_run: {
    description: 'Reject a gated run or action after operator review.',
    input_schema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Run identifier to reject.' },
        reason: { type: 'string', description: 'Rejection reason recorded for audit.' }
      },
      required: ['run_id', 'reason'],
      additionalProperties: false
    }
  },
  request_approval_revision: {
    description: 'Request changes before an approval can proceed.',
    input_schema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Run identifier for the revision request.' },
        requested_changes: { type: 'string', description: 'Concrete changes required before approval.' }
      },
      required: ['run_id', 'requested_changes'],
      additionalProperties: false
    }
  }
};

const RISK_RANK = {
  low: 1,
  medium: 2,
  high: 3
};

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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function highestRisk(toolsets) {
  return toolsets.reduce((current, toolset) => (
    RISK_RANK[toolset.risk_level] > RISK_RANK[current] ? toolset.risk_level : current
  ), 'low');
}

function riskSummary(toolsets) {
  const byRisk = {
    high: [],
    medium: [],
    low: []
  };
  for (const toolset of toolsets) {
    byRisk[toolset.risk_level].push(toolset.toolset_id);
  }
  return {
    highest_risk_level: toolsets.length > 0 ? highestRisk(toolsets) : 'low',
    high_risk_toolsets: byRisk.high.sort(),
    medium_risk_toolsets: byRisk.medium.sort(),
    low_risk_toolsets: byRisk.low.sort()
  };
}

function toolSchemaFor(toolName, toolsets) {
  const definition = TOOL_SCHEMAS[toolName];
  if (!definition) {
    throw new Error(`missing tool schema: ${toolName}`);
  }
  const owningToolsets = toolsets.filter(toolset => toolset.tools.includes(toolName));
  return {
    name: toolName,
    description: definition.description,
    input_schema: cloneJson(definition.input_schema),
    toolsets: owningToolsets.map(toolset => toolset.toolset_id).sort(),
    risk_level: highestRisk(owningToolsets),
    policy_permissions: uniqueSorted(owningToolsets.flatMap(toolset => toolset.policy_permissions))
  };
}

function toolSchemasFor(toolsets, tools) {
  return tools.map(toolName => toolSchemaFor(toolName, toolsets));
}

function providerCapabilityChecks(toolsets, providerRuntime) {
  if (!providerRuntime) return [];
  const requiredByCapability = new Map();
  for (const toolset of toolsets) {
    const capabilities = toolset.tools.length > 0 ? ['tool_calls'] : [];
    for (const capability of capabilities) {
      if (!requiredByCapability.has(capability)) requiredByCapability.set(capability, []);
      requiredByCapability.get(capability).push(toolset.toolset_id);
    }
  }
  const providerCapabilities = new Set(Array.isArray(providerRuntime.capabilities) ? providerRuntime.capabilities : []);
  return [...requiredByCapability.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([capability, requiredByToolsets]) => ({
      provider_id: String(providerRuntime.provider_id || ''),
      capability,
      status: providerCapabilities.has(capability) ? 'supported' : 'missing',
      required_by_toolsets: uniqueSorted(requiredByToolsets)
    }));
}

function operatorControls(toolsets, capabilityChecks) {
  const controls = [];
  const highRiskToolsets = toolsets
    .filter(toolset => toolset.risk_level === 'high')
    .map(toolset => toolset.toolset_id)
    .sort();
  if (highRiskToolsets.length > 0) {
    controls.push({
      control_id: 'approval_required',
      status: 'recommended',
      reason: 'high-risk toolsets selected',
      toolsets: highRiskToolsets
    });
  }

  for (const check of capabilityChecks.filter(candidate => candidate.status === 'missing')) {
    controls.push({
      control_id: 'provider_capability_review',
      status: 'required',
      reason: `provider missing required capability: ${check.capability}`,
      provider_id: check.provider_id,
      capability: check.capability,
      toolsets: [...check.required_by_toolsets]
    });
  }

  return controls;
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

export function resolveToolsets({ enabled_toolsets = null, disabled_toolsets = [], provider_runtime = null } = {}) {
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
  const capabilityChecks = providerCapabilityChecks(resolvedToolsets, provider_runtime);

  return {
    format: 'divinity.toolset_resolution.v1',
    toolsets: resolvedToolsets.map(cloneToolset),
    tools,
    tool_schemas: toolSchemasFor(resolvedToolsets, tools),
    policy_permissions: uniqueSorted(resolvedToolsets.flatMap(toolset => toolset.policy_permissions)),
    risk_summary: riskSummary(resolvedToolsets),
    provider_capability_checks: capabilityChecks,
    operator_controls: operatorControls(resolvedToolsets, capabilityChecks)
  };
}
