import { createHash } from 'crypto';

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(',')}}`;
  }

  return JSON.stringify(value);
}

export function createAuditRecord({ type, run_id, created_at = new Date().toISOString(), payload }) {
  const hashPayload = { type, run_id, created_at, payload };
  const hash = createHash('sha256').update(stableStringify(hashPayload)).digest('hex');

  return {
    audit_id: `audit_${hash.slice(0, 16)}`,
    type,
    run_id,
    created_at,
    payload,
    hash
  };
}

export function exportAuditLog({ records, from, to }) {
  const fromTime = from ? Date.parse(from) : Number.NEGATIVE_INFINITY;
  const toTime = to ? Date.parse(to) : Number.POSITIVE_INFINITY;
  const filtered = records.filter(record => {
    const createdTime = Date.parse(record.created_at);
    return createdTime >= fromTime && createdTime <= toTime;
  });

  return {
    format: 'divinity.audit.v1',
    exported_at: new Date().toISOString(),
    filters: {
      from: from || null,
      to: to || null
    },
    records: filtered
  };
}
