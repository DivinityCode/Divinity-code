import { createHash } from 'crypto';

export const CONNECTOR_ADAPTERS = [
  {
    adapter: 'ticket_reference',
    description: 'Attach issue, ticket, or project-tracker references to a run.',
    resource_types: ['ticket', 'issue'],
    auth_modes: ['connector', 'token'],
    write_capable: false
  },
  {
    adapter: 'docs_reference',
    description: 'Attach document, knowledge-base, or specification references to a run.',
    resource_types: ['document', 'knowledge_base'],
    auth_modes: ['connector', 'token'],
    write_capable: false
  },
  {
    adapter: 'ci_status',
    description: 'Attach CI workflow, check, or deployment status references to a run.',
    resource_types: ['ci_run', 'check_run', 'deployment'],
    auth_modes: ['connector', 'token'],
    write_capable: false
  }
];

export function publicConnectorAdapters() {
  return CONNECTOR_ADAPTERS.map(adapter => ({
    ...adapter,
    resource_types: [...adapter.resource_types],
    auth_modes: [...adapter.auth_modes]
  }));
}

export function connectorAdapterById(adapterId) {
  return CONNECTOR_ADAPTERS.find(adapter => adapter.adapter === adapterId) || null;
}

function nonEmptyString(value, label) {
  const parsed = String(value || '').trim();
  if (!parsed) throw new Error(`${label} must be a non-empty string`);
  return parsed;
}

function optionalString(value) {
  if (value === undefined || value === null) return null;
  const parsed = String(value).trim();
  return parsed || null;
}

function metadataObject(value) {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('metadata must be an object');
  }
  return { ...value };
}

function connectorReferenceId(record) {
  const hash = createHash('sha256')
    .update(JSON.stringify([
      record.run_id,
      record.adapter,
      record.resource_type,
      record.resource_id,
      record.url || '',
      record.attached_at
    ]))
    .digest('hex');
  return `ref_${hash.slice(0, 16)}`;
}

export function createConnectorReference({
  run_id,
  reference,
  attached_by = 'operator',
  attached_at = new Date().toISOString()
}) {
  const runId = nonEmptyString(run_id, 'run_id');
  const adapterId = nonEmptyString(reference?.adapter, 'adapter');
  const adapter = connectorAdapterById(adapterId);
  if (!adapter) {
    throw new Error(`unknown connector adapter: ${adapterId}`);
  }

  const resourceType = nonEmptyString(reference?.resource_type, 'resource_type');
  if (!adapter.resource_types.includes(resourceType)) {
    throw new Error(`resource_type ${resourceType} is not supported by ${adapterId}`);
  }

  const record = {
    format: 'divinity.connector_reference.v1',
    reference_id: '',
    run_id: runId,
    adapter: adapterId,
    resource_type: resourceType,
    resource_id: nonEmptyString(reference?.resource_id, 'resource_id'),
    attached_by: nonEmptyString(attached_by, 'attached_by'),
    attached_at: nonEmptyString(attached_at, 'attached_at'),
    metadata: metadataObject(reference?.metadata)
  };

  const url = optionalString(reference?.url);
  if (url) record.url = url;
  const title = optionalString(reference?.title);
  if (title) record.title = title;

  record.reference_id = connectorReferenceId(record);
  return record;
}

export function createConnectorReferences({
  run_id,
  references = [],
  attached_by = 'operator',
  attached_at = new Date().toISOString()
}) {
  if (!Array.isArray(references)) {
    throw new Error('connector references must be an array');
  }

  return references.map(reference => createConnectorReference({
    run_id,
    reference,
    attached_by,
    attached_at
  }));
}
