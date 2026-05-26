import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

function stableIdPart(value) {
  return String(value || '').replace(/[^\w-]+/g, '_');
}

function cleanString(value) {
  return String(value || '').trim();
}

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function cleanExpectedSha256(value) {
  return cleanString(value);
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

function hasProtectedWriteSegment(targetPath, rootPath) {
  return path.relative(rootPath, targetPath)
    .split(path.sep)
    .some(segment => ['.git', 'node_modules'].includes(segment));
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

function normalizedMaxDepth(value) {
  if (value === undefined || value === null || cleanString(value) === '') return 20;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 20;
  return Math.min(Math.floor(numeric), 20);
}

function listFilesExecution({
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
  const scopeInput = cleanString(argument_values.path);
  const scope = path.resolve(root, scopeInput);
  const maxDepth = normalizedMaxDepth(argument_values.max_depth);
  if (!scopeInput || !isPathInside(scope, root)) {
    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'failed',
      adapter: 'list_files',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'list_files failed; paths redacted',
      output_metadata: {
        max_depth: maxDepth,
        paths_redacted: true,
        content_redacted: true
      },
      operator_summary,
      error: 'list_files scope must stay inside workspace',
      index
    });
  }

  try {
    const stat = fs.statSync(scope);
    let filesListed = 0;
    let directoriesScanned = 0;
    if (stat.isFile()) {
      filesListed = 1;
    } else if (stat.isDirectory()) {
      const pending = [{ directory: scope, depth: 0 }];
      while (pending.length > 0) {
        const current = pending.pop();
        directoriesScanned += 1;
        for (const entry of fs.readdirSync(current.directory, { withFileTypes: true })) {
          if (entry.isDirectory() && skippedSearchDirectory(entry.name)) continue;
          if (entry.isFile()) {
            filesListed += 1;
          } else if (entry.isDirectory() && current.depth < maxDepth) {
            pending.push({
              directory: path.join(current.directory, entry.name),
              depth: current.depth + 1
            });
          }
        }
      }
    } else {
      return executionEnvelope({
        run_id,
        approval,
        argument_keys,
        status: 'failed',
        adapter: 'list_files',
        actor,
        reason,
        started_at,
        completed_at,
        output_summary: 'list_files failed; paths redacted',
        output_metadata: {
          max_depth: maxDepth,
          paths_redacted: true,
          content_redacted: true
        },
        operator_summary,
        error: 'list_files scope must be a file or directory',
        index
      });
    }

    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'completed',
      adapter: 'list_files',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'list_files completed; paths redacted',
      output_metadata: {
        files_listed: filesListed,
        directories_scanned: directoriesScanned,
        max_depth: maxDepth,
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
      adapter: 'list_files',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'list_files failed; paths redacted',
      output_metadata: {
        max_depth: maxDepth,
        paths_redacted: true,
        content_redacted: true
      },
      operator_summary,
      error: error?.code ? `list_files failed with ${error.code}` : 'list_files failed',
      index
    });
  }
}

function writeFileExecution({
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
  const targetInput = cleanString(argument_values.path);
  const target = path.resolve(root, targetInput);
  const content = String(argument_values.content ?? '');
  const expectedSha256 = cleanExpectedSha256(argument_values.expected_sha256);
  const failedPreconditionMetadata = {
    path_redacted: true,
    content_redacted: true,
    expected_sha256_checked: true,
    expected_sha256_matched: false,
    expected_sha256_redacted: true
  };
  if (!targetInput || !isPathInside(target, root) || target === root) {
    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'failed',
      adapter: 'write_file',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'write_file failed; content redacted',
      output_metadata: {
        path_redacted: true,
        content_redacted: true
      },
      operator_summary,
      error: 'write_file target must stay inside workspace',
      index
    });
  }
  if (hasProtectedWriteSegment(target, root)) {
    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'failed',
      adapter: 'write_file',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'write_file failed; content redacted',
      output_metadata: {
        path_redacted: true,
        content_redacted: true
      },
      operator_summary,
      error: 'write_file target must not use protected workspace paths',
      index
    });
  }
  if (expectedSha256 && !/^[a-f0-9]{64}$/.test(expectedSha256)) {
    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'failed',
      adapter: 'write_file',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'write_file failed; content redacted',
      output_metadata: failedPreconditionMetadata,
      operator_summary,
      error: 'write_file expected_sha256 must be a lowercase 64-character sha256 hex digest',
      index
    });
  }
  if (expectedSha256) {
    let existingContent;
    try {
      existingContent = fs.readFileSync(target);
    } catch {
      return executionEnvelope({
        run_id,
        approval,
        argument_keys,
        status: 'failed',
        adapter: 'write_file',
        actor,
        reason,
        started_at,
        completed_at,
        output_summary: 'write_file failed; content redacted',
        output_metadata: failedPreconditionMetadata,
        operator_summary,
        error: 'write_file expected_sha256 target was unavailable',
        index
      });
    }
    if (sha256Bytes(existingContent) !== expectedSha256) {
      return executionEnvelope({
        run_id,
        approval,
        argument_keys,
        status: 'failed',
        adapter: 'write_file',
        actor,
        reason,
        started_at,
        completed_at,
        output_summary: 'write_file failed; content redacted',
        output_metadata: failedPreconditionMetadata,
        operator_summary,
        error: 'write_file expected_sha256 did not match current file content',
        index
      });
    }
  }

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'completed',
      adapter: 'write_file',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'write_file completed; content redacted',
      output_metadata: {
        bytes_written: Buffer.byteLength(content, 'utf8'),
        line_count: content.split(/\r?\n/).length,
        path_redacted: true,
        content_redacted: true,
        ...(expectedSha256 ? {
          expected_sha256_checked: true,
          expected_sha256_matched: true,
          expected_sha256_redacted: true
        } : {})
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
      adapter: 'write_file',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'write_file failed; content redacted',
      output_metadata: {
        path_redacted: true,
        content_redacted: true
      },
      operator_summary,
      error: error?.code ? `write_file failed with ${error.code}` : 'write_file failed',
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

  if (approval.name === 'list_files') {
    return listFilesExecution({
      ...common,
      argument_values,
      workspace_root
    });
  }

  if (approval.name === 'write_file') {
    return writeFileExecution({
      ...common,
      argument_values,
      workspace_root
    });
  }

  return unsupportedExecution(common);
}
