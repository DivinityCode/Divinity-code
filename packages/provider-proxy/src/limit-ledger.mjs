import fs from 'fs';
import path from 'path';

const LEDGER_FORMAT = 'divinity.provider_limit_ledger.v1';

function emptyLedgerState() {
  return {
    format: LEDGER_FORMAT,
    providers: {}
  };
}

function validDate(value, fallback) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function positiveSeconds(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.ceil(parsed);
}

function cleanProviderId(providerId) {
  return String(providerId || '').trim();
}

function normalizeRecord(record, fallbackProviderId = '') {
  const providerId = cleanProviderId(record?.provider_id || fallbackProviderId);
  if (!providerId) return null;
  const limitedUntil = validDate(record?.limited_until, null);
  if (!limitedUntil) return null;
  const observedAt = validDate(record?.observed_at, limitedUntil);
  return {
    provider_id: providerId,
    observed_at: observedAt.toISOString(),
    limited_until: limitedUntil.toISOString(),
    retry_after_seconds: positiveSeconds(record?.retry_after_seconds),
    source: String(record?.source || 'upstream_429').trim() || 'upstream_429'
  };
}

function normalizeState(value) {
  const state = emptyLedgerState();
  const providers = value?.providers && typeof value.providers === 'object'
    ? value.providers
    : {};

  for (const [providerId, record] of Object.entries(providers)) {
    const normalized = normalizeRecord(record, providerId);
    if (normalized) state.providers[normalized.provider_id] = normalized;
  }

  return state;
}

function readJsonFile(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return emptyLedgerState();
    return normalizeState(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return emptyLedgerState();
  }
}

function writeJsonFile(filePath, state) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`);
}

function publicRecord(record) {
  return {
    provider_id: record.provider_id,
    observed_at: record.observed_at,
    limited_until: record.limited_until,
    retry_after_seconds: record.retry_after_seconds,
    source: record.source
  };
}

export function createProviderLimitLedger({
  initial_state = null,
  file_path = '',
  now = () => new Date()
} = {}) {
  const ledgerPath = String(file_path || '').trim();
  let memoryState = normalizeState(initial_state || emptyLedgerState());

  function currentDate() {
    return validDate(now(), new Date());
  }

  function readState() {
    return ledgerPath ? readJsonFile(ledgerPath) : memoryState;
  }

  function writeState(state) {
    const nextState = normalizeState({
      ...state,
      updated_at: currentDate().toISOString()
    });
    if (ledgerPath) {
      writeJsonFile(ledgerPath, nextState);
    } else {
      memoryState = nextState;
    }
    return nextState;
  }

  return {
    format: LEDGER_FORMAT,
    file_path_configured: Boolean(ledgerPath),

    activeLimitState() {
      const currentMs = currentDate().getTime();
      const state = readState();
      const active = {};

      for (const record of Object.values(state.providers)) {
        const limitedUntilMs = Date.parse(record.limited_until);
        if (!Number.isFinite(limitedUntilMs) || limitedUntilMs <= currentMs) continue;
        active[record.provider_id] = {
          limit_reached: true,
          retry_after_seconds: Math.ceil((limitedUntilMs - currentMs) / 1000),
          limited_until: record.limited_until,
          source: 'managed_ledger'
        };
      }

      return active;
    },

    recordLimit({ provider_id, retry_after_seconds, observed_at = '' } = {}) {
      const providerId = cleanProviderId(provider_id);
      const retryAfterSeconds = positiveSeconds(retry_after_seconds);
      if (!providerId || retryAfterSeconds <= 0) return null;

      const observedAt = validDate(observed_at || currentDate(), currentDate());
      const limitedUntil = new Date(observedAt.getTime() + retryAfterSeconds * 1000);
      const state = readState();
      const record = {
        provider_id: providerId,
        observed_at: observedAt.toISOString(),
        limited_until: limitedUntil.toISOString(),
        retry_after_seconds: retryAfterSeconds,
        source: 'upstream_429'
      };
      state.providers[providerId] = record;
      writeState(state);
      return publicRecord(record);
    },

    snapshot() {
      return normalizeState(readState());
    }
  };
}

export function createConfiguredProviderLimitLedger(env = process.env, { memoryFallback = false } = {}) {
  const filePath = String(env?.DIVINITY_PROVIDER_LIMIT_LEDGER_PATH || '').trim();
  if (!filePath && !memoryFallback) return null;
  return createProviderLimitLedger({ file_path: filePath });
}
