# Release Checklist

Divinity Code is not production-ready while the README warning remains in place. Use this checklist for public preview releases, internal tagged builds, or release-candidate branches.

## Preflight

- [ ] README warning review: decide whether the heavy active development warning still applies. Do not remove it without a completion audit.
- [ ] Confirm branch state:

```bash
git status --short --branch
```

- [ ] Run the conflict marker scan:

```bash
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
```

- [ ] Run whitespace checks:

```bash
git diff --check
```

- [ ] Run root pollution checks:

```bash
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files"
test ! -e .divinity.json
test ! -e .divinity-provider-limits.json
test ! -e .divinity-provider-usage.json
git check-ignore -q dist/release-artifacts.json
```

## Required Local Verification

- [ ] Runtime and source doctor profiles:

```bash
node apps/cli/src/index.mjs doctor
node apps/cli/src/index.mjs doctor --profile source
node apps/cli/src/index.mjs release-status
```

- [ ] Contract validation:

```bash
pnpm run validate:contracts
```

- [ ] Package manifest and CLI bin smoke:

```bash
pnpm run test:package
pnpm run test:package-tarball
```

- [ ] Deprecation/current-surface audit:

```bash
pnpm run test:deprecations
```

- [ ] Release artifact manifest:

```bash
pnpm run release:artifacts
pnpm run release:binary
pnpm run test:binary
pnpm run test:release-artifacts
pnpm run test:release-status
```

- [ ] Review release artifact integrity and signing readiness:

```bash
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.source_provenance.status, a.source_provenance.short_commit_sha, a.source_provenance.tracked_changes)"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.release_sbom.status, a.release_sbom.component_count, a.release_sbom.redacts_local_paths)"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.artifact_integrity.algorithm, a.artifact_integrity.files.length, a.artifact_signing.status)"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.artifact_signing.configuration.status, a.artifact_signing.configuration.ready_when_release_gates_clear)"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.registry_publish_readiness.status, a.registry_publish_readiness.token_configured, a.registry_publish_readiness.blockers.join(','))"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.binary_release_readiness.status, a.binary_release_readiness.supported_targets.length, a.binary_release_readiness.blockers.join(','))"
```

- [ ] Confirm source provenance reports the expected commit and does not expose changed file paths or absolute local paths.
- [ ] Confirm `divinity.release_sbom.v1` was generated from `package.json` and `package-lock.json`, includes package/dependency names, versions, direct/transitive relationship, requested ranges, and license strings when present, and does not expose local absolute paths, `node_modules` paths, registry URLs, or lockfile integrity values.
- [ ] If testing release signing readiness, configure `DIVINITY_RELEASE_SIGNING_COMMAND` as an absolute executable path, `DIVINITY_RELEASE_SIGNING_COMMAND_ARGS` as a JSON array of strings, and signing key/identity references through `DIVINITY_RELEASE_SIGNING_KEY_REF` and `DIVINITY_RELEASE_SIGNING_IDENTITY`. Confirm the generated metadata reports readiness without printing those values.
- [ ] If testing registry publish readiness, configure `NPM_TOKEN` in the environment and confirm the generated metadata reports only `token_configured: true`, never the token value.
- [ ] Confirm `divinity.release_binary_artifacts.v1` exists under `dist/binary/`, `SHA256SUMS` matches generated launcher bytes, and `manifest.json` stores no local absolute paths or signing secret references.
- [ ] Confirm `divinity.release_binary_readiness.v1` lists generated Node launcher targets, blocked public-download status, checksum/signing requirements, and blockers; it must not expose local paths, signing key references, or generated binary contents.
- [ ] Do not publish package registry tarballs or signed binary downloads while `artifact_signing.status` is `blocked`.

- [ ] Provider proxy and tool governance checks:

```bash
pnpm run test:providers
```

- [ ] CLI/API smoke checks:

```bash
pnpm run test:smoke
```

- [ ] Full suite:

```bash
pnpm test
```

## Documentation Gates

- [ ] Public onboarding docs pass:

```bash
pnpm run test:public-docs
```

- [ ] Install, quickstart, upgrade, release checklist, provider research, product plan, and README all describe current command names.
- [ ] No public doc recommends shared API keys, no-signup key pools, reverse-engineered provider endpoints, quota-bypass rotation, unsupported global npm installs, or npx execution.
- [ ] Provider docs still state that live credentials must be operator-owned and stored outside repository files.

## GitHub Gates

- [ ] Open a pull request against `main`.
- [ ] Wait for GitHub Actions to pass.
- [ ] Confirm the PR head SHA before merging.
- [ ] Squash-merge only after local and GitHub checks are green.
- [ ] Sync local `main` after merge and rerun focused verification for the changed area.
