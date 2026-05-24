import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';

const STORE_VERSION = 1;

function emptySnapshot() {
  return {
    version: STORE_VERSION,
    runs: [],
    artifacts: [],
    auditRecords: []
  };
}

function normalizeSnapshot(snapshot) {
  return {
    version: snapshot?.version || STORE_VERSION,
    runs: Array.isArray(snapshot?.runs) ? snapshot.runs : [],
    artifacts: Array.isArray(snapshot?.artifacts) ? snapshot.artifacts : [],
    auditRecords: Array.isArray(snapshot?.auditRecords) ? snapshot.auditRecords : []
  };
}

function loadSnapshot(filePath) {
  if (!filePath || !existsSync(filePath)) return emptySnapshot();

  try {
    return normalizeSnapshot(JSON.parse(readFileSync(filePath, 'utf8')));
  } catch (error) {
    throw new Error(`Unable to load run store at ${filePath}: ${error.message}`);
  }
}

function mapById(records, idField) {
  return new Map(records
    .filter(record => record && typeof record[idField] === 'string')
    .map(record => [record[idField], record]));
}

export function createRunStore(options = {}) {
  const filePath = options.filePath || '';
  const snapshot = loadSnapshot(filePath);
  const runs = mapById(snapshot.runs, 'run_id');
  const artifacts = mapById(snapshot.artifacts, 'artifact_id');
  const auditRecords = [...snapshot.auditRecords];

  return {
    filePath: filePath || null,
    runs,
    artifacts,
    auditRecords,
    persist() {
      if (!filePath) return;

      mkdirSync(path.dirname(filePath), { recursive: true });
      const payload = {
        version: STORE_VERSION,
        runs: Array.from(runs.values()),
        artifacts: Array.from(artifacts.values()),
        auditRecords
      };
      const tempPath = `${filePath}.${process.pid}.tmp`;
      writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`);
      renameSync(tempPath, filePath);
    }
  };
}

export function createConfiguredRunStore(env = process.env) {
  return createRunStore({ filePath: env.DIVINITY_RUN_STORE_PATH || '' });
}
