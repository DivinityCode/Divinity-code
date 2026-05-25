import fs from 'fs';
import path from 'path';

const LEDGER_FORMAT = 'divinity.provider_usage_ledger.v1';
const RECORD_FORMAT = 'divinity.provider_usage_record.v1';
const BUDGET_CHECK_FORMAT = 'divinity.provider_usage_budget_check.v1';

function emptyLedgerState() {
  return {
    format: LEDGER_FORMAT,
    providers: {}
  };
}

function cleanString(value) {
  return String(value || '').trim();
}

function safeObjectKey(value) {
  const clean = cleanString(value);
  return ['__proto__', 'constructor', 'prototype'].includes(clean) ? '' : clean;
}

function positiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function validDate(value, fallback) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function usageCounts(usage = {}) {
  const inputTokens = positiveInteger(usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = positiveInteger(usage.output_tokens ?? usage.completion_tokens);
  const totalTokens = positiveInteger(usage.total_tokens) || inputTokens + outputTokens;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens
  };
}

function normalizeDay(value, fallbackDate) {
  const date = cleanString(value?.date) || fallbackDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const recordedAt = validDate(value?.last_recorded_at, new Date(`${date}T00:00:00.000Z`));
  return {
    date,
    request_count: positiveInteger(value?.request_count),
    input_tokens: positiveInteger(value?.input_tokens),
    output_tokens: positiveInteger(value?.output_tokens),
    total_tokens: positiveInteger(value?.total_tokens),
    last_recorded_at: recordedAt.toISOString()
  };
}

function normalizeState(value) {
  const state = emptyLedgerState();
  const providers = value?.providers && typeof value.providers === 'object'
    ? value.providers
    : {};

  for (const [providerId, provider] of Object.entries(providers)) {
    const cleanProviderId = safeObjectKey(provider?.provider_id || providerId);
    if (!cleanProviderId) continue;
    const models = provider?.models && typeof provider.models === 'object'
      ? provider.models
      : {};
    const normalizedProvider = {
      provider_id: cleanProviderId,
      models: {}
    };

    for (const [modelId, model] of Object.entries(models)) {
      const cleanModel = safeObjectKey(model?.model || modelId);
      if (!cleanModel) continue;
      const days = model?.days && typeof model.days === 'object'
        ? model.days
        : {};
      const normalizedModel = {
        model: cleanModel,
        days: {}
      };

      for (const [date, day] of Object.entries(days)) {
        const normalizedDay = normalizeDay(day, date);
        if (normalizedDay) normalizedModel.days[normalizedDay.date] = normalizedDay;
      }

      normalizedProvider.models[cleanModel] = normalizedModel;
    }

    state.providers[cleanProviderId] = normalizedProvider;
  }

  if (value?.updated_at) {
    const updatedAt = validDate(value.updated_at, null);
    if (updatedAt) state.updated_at = updatedAt.toISOString();
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

function ensureDay(state, providerId, model, date) {
  if (!state.providers[providerId]) {
    state.providers[providerId] = {
      provider_id: providerId,
      models: {}
    };
  }
  if (!state.providers[providerId].models[model]) {
    state.providers[providerId].models[model] = {
      model,
      days: {}
    };
  }
  if (!state.providers[providerId].models[model].days[date]) {
    state.providers[providerId].models[model].days[date] = {
      date,
      request_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      last_recorded_at: `${date}T00:00:00.000Z`
    };
  }
  return state.providers[providerId].models[model].days[date];
}

function publicUsageRecord({ provider_id, model, date, day, status, recorded_at }) {
  return {
    format: RECORD_FORMAT,
    provider_id,
    model,
    date,
    request_count: day.request_count,
    input_tokens: day.input_tokens,
    output_tokens: day.output_tokens,
    total_tokens: day.total_tokens,
    status: cleanString(status) || 'completed',
    recorded_at
  };
}

function publicBudgetCheck({ provider_id, model, date, current, projected, exceeded, reason = '' }) {
  return {
    format: BUDGET_CHECK_FORMAT,
    provider_id,
    model,
    date,
    exceeded,
    reason,
    current,
    projected
  };
}

function budgetValue(usageBudget, key) {
  return positiveInteger(usageBudget?.[key]);
}

export function createProviderUsageLedger({
  initial_state = null,
  file_path = '',
  now = () => new Date()
} = {}) {
  const ledgerPath = cleanString(file_path);
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

  function currentDay(providerId, model, date) {
    const state = readState();
    return state.providers[providerId]?.models?.[model]?.days?.[date] || {
      date,
      request_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      last_recorded_at: `${date}T00:00:00.000Z`
    };
  }

  return {
    format: LEDGER_FORMAT,
    file_path_configured: Boolean(ledgerPath),

    recordUsage({
      provider_id,
      model,
      usage = {},
      status = 'completed',
      observed_at = ''
    } = {}) {
      const providerId = safeObjectKey(provider_id);
      const modelId = safeObjectKey(model);
      if (!providerId || !modelId) return null;

      const recordedAt = validDate(observed_at || currentDate(), currentDate());
      const date = dayKey(recordedAt);
      const counts = usageCounts(usage);
      const state = readState();
      const day = ensureDay(state, providerId, modelId, date);
      day.request_count += 1;
      day.input_tokens += counts.input_tokens;
      day.output_tokens += counts.output_tokens;
      day.total_tokens += counts.total_tokens;
      day.last_recorded_at = recordedAt.toISOString();
      writeState(state);

      return publicUsageRecord({
        provider_id: providerId,
        model: modelId,
        date,
        day,
        status,
        recorded_at: recordedAt.toISOString()
      });
    },

    wouldExceedBudget({
      provider_id,
      model,
      usage_budget = {},
      estimated_usage = {}
    } = {}) {
      const providerId = safeObjectKey(provider_id);
      const modelId = safeObjectKey(model);
      const date = dayKey(currentDate());
      const current = currentDay(providerId, modelId, date);
      const estimate = {
        request_count: positiveInteger(estimated_usage.request_count) || 1,
        ...usageCounts(estimated_usage)
      };
      const projected = {
        request_count: current.request_count + estimate.request_count,
        input_tokens: current.input_tokens + estimate.input_tokens,
        output_tokens: current.output_tokens + estimate.output_tokens,
        total_tokens: current.total_tokens + estimate.total_tokens
      };

      const checks = [
        ['max_daily_requests', 'request_count', 'provider daily request budget exceeded'],
        ['max_daily_input_tokens', 'input_tokens', 'provider daily input token budget exceeded'],
        ['max_daily_output_tokens', 'output_tokens', 'provider daily output token budget exceeded'],
        ['max_daily_total_tokens', 'total_tokens', 'provider daily total token budget exceeded']
      ];

      for (const [budgetKey, countKey, reason] of checks) {
        const limit = budgetValue(usage_budget, budgetKey);
        if (limit > 0 && projected[countKey] > limit) {
          return publicBudgetCheck({
            provider_id: providerId,
            model: modelId,
            date,
            current,
            projected,
            exceeded: true,
            reason
          });
        }
      }

      return publicBudgetCheck({
        provider_id: providerId,
        model: modelId,
        date,
        current,
        projected,
        exceeded: false
      });
    },

    snapshot() {
      return normalizeState(readState());
    }
  };
}

export function createConfiguredProviderUsageLedger(env = process.env, { memoryFallback = false } = {}) {
  const filePath = cleanString(env?.DIVINITY_PROVIDER_USAGE_LEDGER_PATH);
  if (!filePath && !memoryFallback) return null;
  return createProviderUsageLedger({ file_path: filePath });
}
