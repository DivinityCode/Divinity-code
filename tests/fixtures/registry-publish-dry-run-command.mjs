const payload = {
  ok: true,
  command: 'fixture-registry-publish-dry-run',
  args: process.argv.slice(2),
  cwd: process.cwd(),
  token_seen: Boolean(process.env.NPM_TOKEN),
  token_value: process.env.NPM_TOKEN || ''
};

process.stdout.write(`${JSON.stringify(payload)}\n`);
