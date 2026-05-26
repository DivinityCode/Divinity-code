import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  const request = JSON.parse(input || '{}');
  const artifactBytes = readFileSync(request.input_path);
  const signature = [
    'divinity-test-signature-v1',
    `artifact_id=${request.artifact_id}`,
    `artifact_kind=${request.artifact_kind}`,
    `sha256=${request.sha256}`,
    `payload_sha256=${createHash('sha256').update(artifactBytes).digest('hex')}`,
    ''
  ].join('\n');

  writeFileSync(request.signature_path, signature);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    signature_path: request.signature_path,
    signature_algorithm: 'test-fixture'
  })}\n`);
});
