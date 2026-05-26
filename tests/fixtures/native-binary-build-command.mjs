import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  const request = JSON.parse(input || '{}');
  const artifactDirectory = path.join(request.output_directory, 'artifacts');
  mkdirSync(artifactDirectory, { recursive: true });

  const artifacts = request.targets.map(target => {
    const artifactPath = path.join(artifactDirectory, target.filename);
    writeFileSync(artifactPath, [
      'divinity-native-binary-fixture-v1',
      `platform=${target.platform}`,
      `arch=${target.arch}`,
      `filename=${target.filename}`,
      ''
    ].join('\n'));
    return {
      platform: target.platform,
      arch: target.arch,
      filename: target.filename,
      path: `artifacts/${target.filename}`,
      artifact_type: 'native_binary',
      native_binary: true
    };
  });

  process.stdout.write(`${JSON.stringify({
    ok: true,
    artifact_type: 'native_binary',
    artifacts
  })}\n`);
});
