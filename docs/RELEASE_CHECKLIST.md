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
pnpm run test:release-artifacts
```

- [ ] Review release artifact integrity and signing readiness:

```bash
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.artifact_integrity.algorithm, a.artifact_integrity.files.length, a.artifact_signing.status)"
```

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
