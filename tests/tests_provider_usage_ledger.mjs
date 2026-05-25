import assert from 'assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { createProviderUsageLedger } from '../packages/provider-proxy/src/usage-ledger.mjs';

const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-provider-usage-ledger-'));
const ledgerPath = path.join(tmpRoot, 'provider-usage.json');
const secretPrompt = 'secret prompt should not be in usage ledger';
const secretCredential = 'secret credential should not be in usage ledger';
const secretResponse = 'secret response should not be in usage ledger';

try {
  const ledger = createProviderUsageLedger({
    file_path: ledgerPath,
    now: () => new Date('2026-05-25T12:00:00.000Z')
  });

  const first = ledger.recordUsage({
    provider_id: 'custom_openai_compatible',
    model: 'mock-model',
    transport: 'chat_completions',
    status: 'completed',
    usage: {
      prompt_tokens: 4,
      completion_tokens: 3,
      total_tokens: 7
    },
    prompt: secretPrompt,
    credential: secretCredential,
    output_text: secretResponse
  });

  assert.equal(first.format, 'divinity.provider_usage_record.v1');
  assert.equal(first.provider_id, 'custom_openai_compatible');
  assert.equal(first.model, 'mock-model');
  assert.equal(first.date, '2026-05-25');
  assert.equal(first.request_count, 1);
  assert.equal(first.input_tokens, 4);
  assert.equal(first.output_tokens, 3);
  assert.equal(first.total_tokens, 7);
  assert.equal(first.status, 'completed');

  const second = ledger.recordUsage({
    provider_id: 'custom_openai_compatible',
    model: 'mock-model',
    transport: 'chat_completions',
    status: 'requires_action',
    usage: {
      prompt_tokens: -10,
      completion_tokens: 5
    }
  });

  assert.equal(second.request_count, 2);
  assert.equal(second.input_tokens, 4);
  assert.equal(second.output_tokens, 8);
  assert.equal(second.total_tokens, 12);

  const blockByRequest = ledger.wouldExceedBudget({
    provider_id: 'custom_openai_compatible',
    model: 'mock-model',
    usage_budget: { max_daily_requests: 2 }
  });

  assert.equal(blockByRequest.exceeded, true);
  assert.equal(blockByRequest.reason, 'provider daily request budget exceeded');

  const blockByTotalTokens = ledger.wouldExceedBudget({
    provider_id: 'custom_openai_compatible',
    model: 'mock-model',
    usage_budget: { max_daily_total_tokens: 15 },
    estimated_usage: { total_tokens: 4 }
  });

  assert.equal(blockByTotalTokens.exceeded, true);
  assert.equal(blockByTotalTokens.reason, 'provider daily total token budget exceeded');

  const okBudget = ledger.wouldExceedBudget({
    provider_id: 'custom_openai_compatible',
    model: 'mock-model',
    usage_budget: {
      max_daily_requests: 3,
      max_daily_input_tokens: 10,
      max_daily_output_tokens: 20,
      max_daily_total_tokens: 20
    }
  });

  assert.equal(okBudget.exceeded, false);

  const snapshot = ledger.snapshot();
  assert.equal(snapshot.format, 'divinity.provider_usage_ledger.v1');
  assert.equal(snapshot.providers.custom_openai_compatible.models['mock-model'].days['2026-05-25'].request_count, 2);

  const rawFile = readFileSync(ledgerPath, 'utf8');
  assert.equal(rawFile.includes(secretPrompt), false);
  assert.equal(rawFile.includes(secretCredential), false);
  assert.equal(rawFile.includes(secretResponse), false);
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, test: 'provider-usage-ledger' }));
