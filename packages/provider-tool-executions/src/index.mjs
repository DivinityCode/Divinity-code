import fs from 'fs';
import path from 'path';

function stableIdPart(value) {
  return String(value || '').replace(/[^\w-]+/g, '_');
}

function cleanString(value) {
  return String(value || '').trim();
}

function assertRequired(value, label) {
  if (!cleanString(value)) throw new Error(`${label} must be non-empty`);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function uniqueSorted(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(cleanString)
    .filter(Boolean))]
    .sort();
}

function sameKeys(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertRedactedApproval(approval) {
  if (!isPlainObject(approval)) {
    throw new Error('provider tool execution requires an approved provider tool-call approval');
  }
  if (approval.format && approval.format !== 'divinity.provider_tool_call_approval.v1') {
    throw new Error('provider tool execution requires an approved provider tool-call approval');
  }
  if (approval.decision !== 'approve') {
    throw new Error('provider tool execution requires an approved provider tool-call approval');
  }
  if (approval.arguments_redacted !== true) {
    throw new Error('provider tool execution requires redacted approval arguments');
  }
  for (const rawKey of ['arguments', 'input', 'argument_values']) {
    if (Object.prototype.hasOwnProperty.call(approval, rawKey)) {
      throw new Error('provider tool execution approval must not include raw arguments');
    }
  }
}

function assertArgumentValues({ approvalKeys, argumentValues }) {
  if (!isPlainObject(argumentValues)) {
    throw new Error('provider tool execution requires argument_values object');
  }
  const argumentKeys = Object.keys(argumentValues).map(cleanString).filter(Boolean).sort();
  if (!sameKeys(approvalKeys, argumentKeys)) {
    throw new Error('provider tool execution argument keys must exactly match approved keys');
  }
}

function normalizedOperatorSummary({ operatorSummary, argumentValues }) {
  const summary = cleanString(operatorSummary);
  if (!summary) return '';
  const rawValues = Object.values(isPlainObject(argumentValues) ? argumentValues : {})
    .map(cleanString)
    .filter(Boolean);
  for (const rawValue of rawValues) {
    if (summary.includes(rawValue)) {
      throw new Error('provider tool execution operator summary must not include raw argument values');
    }
  }
  return summary;
}

function executionEnvelope({
  run_id,
  approval,
  argument_keys,
  status,
  adapter,
  actor,
  reason,
  started_at,
  completed_at,
  output_summary,
  output_metadata,
  operator_summary = '',
  error = null,
  index
}) {
  const record = {
    format: 'divinity.provider_tool_execution.v1',
    execution_id: ['provider_tool_execution', run_id, approval.tool_call_id, String(index).padStart(3, '0')]
      .map(stableIdPart)
      .join('_'),
    run_id,
    approval_id: approval.approval_id,
    tool_call_id: approval.tool_call_id,
    provider_id: approval.provider_id,
    transport: approval.transport,
    name: approval.name,
    argument_keys,
    arguments_redacted: true,
    status,
    adapter,
    actor,
    reason,
    started_at,
    completed_at,
    output_summary,
    output_redacted: true,
    output_metadata
  };
  if (operator_summary) {
    record.operator_summary = operator_summary;
    record.operator_summary_source = 'operator';
  }
  if (error) record.error = error;
  return record;
}

function isPathInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readFileExecution({
  run_id,
  approval,
  argument_values,
  workspace_root,
  argument_keys,
  actor,
  reason,
  operator_summary,
  started_at,
  completed_at,
  index
}) {
  const root = path.resolve(cleanString(workspace_root) || process.cwd());
  const target = path.resolve(root, cleanString(argument_values.path));
  if (!isPathInside(target, root) || target === root) {
    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'failed',
      adapter: 'read_file',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'read_file failed; content redacted',
      output_metadata: { content_redacted: true },
      operator_summary,
      error: 'read_file target must stay inside workspace',
      index
    });
  }

  try {
    const content = fs.readFileSync(target, 'utf8');
    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'completed',
      adapter: 'read_file',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'read_file completed; content redacted',
      output_metadata: {
        bytes_read: Buffer.byteLength(content, 'utf8'),
        line_count: content.split(/\r?\n/).length,
        content_redacted: true
      },
      operator_summary,
      index
    });
  } catch (error) {
    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'failed',
      adapter: 'read_file',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'read_file failed; content redacted',
      output_metadata: { content_redacted: true },
      operator_summary,
      error: error?.code ? `read_file failed with ${error.code}` : 'read_file failed',
      index
    });
  }
}

function skippedSearchDirectory(name) {
  return ['.git', 'node_modules', 'dist'].includes(name);
}

function filesUnderScope(scope) {
  const stat = fs.statSync(scope);
  if (stat.isFile()) return [scope];
  if (!stat.isDirectory()) return [];

  const pending = [scope];
  const files = [];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && skippedSearchDirectory(entry.name)) continue;
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(next);
      } else if (entry.isFile()) {
        files.push(next);
      }
    }
  }
  return files.sort();
}

function searchFilesExecution({
  run_id,
  approval,
  argument_values,
  workspace_root,
  argument_keys,
  actor,
  reason,
  operator_summary,
  started_at,
  completed_at,
  index
}) {
  const root = path.resolve(cleanString(workspace_root) || process.cwd());
  const scope = path.resolve(root, cleanString(argument_values.path));
  if (!isPathInside(scope, root)) {
    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'failed',
      adapter: 'search_files',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'search_files failed; results redacted',
      output_metadata: {
        query_redacted: true,
        paths_redacted: true,
        content_redacted: true
      },
      operator_summary,
      error: 'search_files scope must stay inside workspace',
      index
    });
  }

  try {
    const query = cleanString(argument_values.query).toLowerCase();
    const files = filesUnderScope(scope);
    let matchCount = 0;
    let matchingFilesCount = 0;
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const normalized = content.toLowerCase();
      let fileMatches = 0;
      if (query) {
        let position = normalized.indexOf(query);
        while (position !== -1) {
          fileMatches += 1;
          position = normalized.indexOf(query, position + query.length);
        }
      }
      if (fileMatches > 0) {
        matchingFilesCount += 1;
        matchCount += fileMatches;
      }
    }

    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'completed',
      adapter: 'search_files',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'search_files completed; results redacted',
      output_metadata: {
        files_scanned: files.length,
        match_count: matchCount,
        matching_files_count: matchingFilesCount,
        query_redacted: true,
        paths_redacted: true,
        content_redacted: true
      },
      operator_summary,
      index
    });
  } catch (error) {
    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'failed',
      adapter: 'search_files',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'search_files failed; results redacted',
      output_metadata: {
        query_redacted: true,
        paths_redacted: true,
        content_redacted: true
      },
      operator_summary,
      error: error?.code ? `search_files failed with ${error.code}` : 'search_files failed',
      index
    });
  }
}

function unsupportedExecution({
  run_id,
  approval,
  argument_keys,
  actor,
  reason,
  operator_summary,
  started_at,
  completed_at,
  index
}) {
  return executionEnvelope({
    run_id,
    approval,
    argument_keys,
    status: 'blocked',
    adapter: 'unsupported',
    actor,
    reason,
    started_at,
    completed_at,
    output_summary: 'provider tool execution blocked; adapter unsupported',
    output_metadata: {
      adapter_configured: false,
      output_redacted: true
    },
    operator_summary,
    error: 'unsupported provider tool execution adapter',
    index
  });
}

export function createProviderToolExecution(options = {}) {
  const {
    run_id,
    approval,
    argument_values = null,
    workspace_root = '',
    actor = 'operator',
    reason,
    operator_summary = '',
    started_at = new Date().toISOString(),
    completed_at = new Date().toISOString(),
    index = 1
  } = options;

  assertRedactedApproval(approval);
  const normalizedRunId = cleanString(run_id) || cleanString(approval.run_id) || 'run_unknown';
  assertRequired(approval.approval_id, 'provider tool-call approval id');
  assertRequired(approval.tool_call_id, 'provider tool-call id');
  assertRequired(approval.provider_id, 'provider id');
  assertRequired(approval.transport, 'provider transport');
  assertRequired(approval.name, 'provider tool name');

  const argumentKeys = uniqueSorted(approval.argument_keys);
  assertArgumentValues({ approvalKeys: argumentKeys, argumentValues: argument_values });
  const normalizedActor = cleanString(actor) || 'operator';
  const normalizedReason = cleanString(reason);
  if (!normalizedReason) {
    throw new Error('provider tool execution reason must be non-empty');
  }
  const safeOperatorSummary = normalizedOperatorSummary({
    operatorSummary: operator_summary,
    argumentValues: argument_values
  });

  const common = {
    run_id: normalizedRunId,
    approval,
    argument_keys: argumentKeys,
    actor: normalizedActor,
    reason: normalizedReason,
    operator_summary: safeOperatorSummary,
    started_at,
    completed_at,
    index
  };

  if (approval.name === 'read_file') {
    return readFileExecution({
      ...common,
      argument_values,
      workspace_root
    });
  }

  if (approval.name === 'search_files') {
    return searchFilesExecution({
      ...common,
      argument_values,
      workspace_root
    });
  }

  return unsupportedExecution(common);
}
