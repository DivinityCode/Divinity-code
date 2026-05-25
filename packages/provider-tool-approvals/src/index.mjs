function stableIdPart(value) {
  return String(value || '').replace(/[^\w-]+/g, '_');
}

function cleanString(value) {
  return String(value || '').trim();
}

function rawArgumentKeys(source) {
  return ['arguments', 'input', 'argument_values'].filter(key => (
    Object.prototype.hasOwnProperty.call(source, key)
  ));
}

function normalizeToolCallRequest(input) {
  const source = input?.tool_call_request && typeof input.tool_call_request === 'object'
    ? input.tool_call_request
    : input;
  const rawKeys = rawArgumentKeys(source);
  if (rawKeys.length > 0) {
    throw new Error('provider tool-call request must not include raw arguments');
  }
  if (source.arguments_redacted !== true) {
    throw new Error('provider tool-call request arguments must be redacted');
  }

  return {
    tool_call_id: cleanString(source.tool_call_id),
    provider_id: cleanString(source.provider_id),
    transport: cleanString(source.transport),
    name: cleanString(source.name),
    argument_keys: [...new Set((Array.isArray(source.argument_keys) ? source.argument_keys : [])
      .map(cleanString)
      .filter(Boolean))]
      .sort()
  };
}

function assertRequired(value, label) {
  if (!cleanString(value)) throw new Error(`${label} must be non-empty`);
}

export function createProviderToolCallApproval(options = {}) {
  const {
    run_id,
    tool_call_request = null,
    tool_call_id = '',
    provider_id = '',
    transport = '',
    name = '',
    argument_keys = [],
    arguments_redacted = false,
    decision,
    actor = 'operator',
    reason,
    decided_at = new Date().toISOString(),
    index = 1,
    ...extra
  } = options;
  const rawDirectKeys = rawArgumentKeys(extra);
  if (rawDirectKeys.length > 0) {
    throw new Error('provider tool-call request must not include raw arguments');
  }
  const normalizedDecision = cleanString(decision);
  if (normalizedDecision !== 'approve' && normalizedDecision !== 'reject') {
    throw new Error('provider tool-call approval decision must be approve or reject');
  }
  const normalizedReason = cleanString(reason);
  if (!normalizedReason) {
    throw new Error('provider tool-call approval reason must be non-empty');
  }

  const toolCall = normalizeToolCallRequest({
    tool_call_request: tool_call_request || {
      tool_call_id,
      provider_id,
      transport,
      name,
      argument_keys,
      arguments_redacted
    }
  });
  const normalizedRunId = cleanString(run_id) || 'run_unknown';
  assertRequired(toolCall.tool_call_id, 'provider tool-call id');
  assertRequired(toolCall.provider_id, 'provider id');
  assertRequired(toolCall.transport, 'provider transport');
  assertRequired(toolCall.name, 'provider tool name');

  return {
    format: 'divinity.provider_tool_call_approval.v1',
    approval_id: ['provider_tool_call_approval', normalizedRunId, toolCall.tool_call_id, String(index).padStart(3, '0')]
      .map(stableIdPart)
      .join('_'),
    run_id: normalizedRunId,
    tool_call_id: toolCall.tool_call_id,
    provider_id: toolCall.provider_id,
    transport: toolCall.transport,
    name: toolCall.name,
    argument_keys: toolCall.argument_keys,
    arguments_redacted: true,
    decision: normalizedDecision,
    actor: cleanString(actor) || 'operator',
    reason: normalizedReason,
    decided_at
  };
}
