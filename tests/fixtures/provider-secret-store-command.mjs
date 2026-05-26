import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

function send(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

async function readRequest() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return JSON.parse(input || '{}');
}

function readStore(storePath) {
  if (!existsSync(storePath)) {
    return { secrets: [] };
  }
  return JSON.parse(readFileSync(storePath, 'utf8'));
}

function writeStore(storePath, store) {
  mkdirSync(path.dirname(storePath), { recursive: true });
  writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`);
}

const storePath = process.env.DIVINITY_TEST_MANAGED_SECRET_STORE_PATH || '';
if (!storePath) {
  send({ ok: false, error: 'DIVINITY_TEST_MANAGED_SECRET_STORE_PATH is required' });
  process.exit(0);
}

const request = await readRequest();
const store = readStore(storePath);

if (request.action === 'store') {
  const nextSecrets = store.secrets.filter(secret => secret.secret_ref !== request.secret_ref);
  nextSecrets.push({
    provider_id: request.provider_id,
    secret_ref: request.secret_ref,
    credential_env_var: request.credential_env_var,
    secret_value: request.secret_value,
    updated_at: request.updated_at,
    updated_by: request.actor,
    reason: request.reason
  });
  nextSecrets.sort((left, right) => String(left.secret_ref).localeCompare(String(right.secret_ref)));
  writeStore(storePath, { secrets: nextSecrets });
  send({ ok: true });
} else if (request.action === 'configured_refs') {
  send({
    ok: true,
    secret_refs: store.secrets.map(secret => secret.secret_ref)
  });
} else if (request.action === 'resolve') {
  const record = store.secrets.find(secret => secret.secret_ref === request.secret_ref);
  send({
    ok: true,
    secret_value: record?.secret_value || ''
  });
} else {
  send({ ok: false, error: `unsupported action: ${request.action}` });
}
