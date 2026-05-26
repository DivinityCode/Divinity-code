# Install Guide

Divinity Code is under heavy active development. Use this guide for local evaluation and contributor workflows, not production deployment.

## Supported Local Prerequisites

- Git.
- Node.js 22 or newer.
- Corepack pnpm. This is the preferred path when `npm` is missing or unavailable.
- npm is optional. If `npm` is not on `PATH`, use the Corepack pnpm commands below.
- Docker is optional and only required for Docker-backed runner isolation checks.

## Clone

```bash
git clone https://github.com/DivinityCode/Divinity-code.git
cd Divinity-code
```

## Install Dependencies

Preferred:

```bash
corepack enable
pnpm install
```

Fallback when Corepack has already cached pnpm but no shim is on `PATH`:

```bash
node ~/.cache/node/corepack/v1/pnpm/9.15.4/bin/pnpm.cjs install
```

If `npm` is available, `npm install` can also install the same package-lock based dependency set, but it is not required for local verification.

## Link The Local CLI

The package manifest exposes a `divinity` bin target at `apps/cli/src/index.mjs`. For source-checkout evaluation, either call the CLI directly:

```bash
node apps/cli/src/index.mjs doctor
```

or link the package with pnpm:

```bash
pnpm link --global
divinity doctor
```

Plain `divinity doctor` runs runtime-safe checks from any directory. Inside a source checkout, use `divinity doctor --profile source` or `node apps/cli/src/index.mjs doctor --profile source` for contributor diagnostics that require repo files and installed dev dependencies.

Review current release readiness without writing files:

```bash
node apps/cli/src/index.mjs release-status
```

Generate release-candidate install metadata with:

```bash
pnpm run release:artifacts
```

Generate local binary-launcher review artifacts with:

```bash
pnpm run release:binary
pnpm run test:binary
```

Assemble a release-candidate review bundle with:

```bash
pnpm run release:bundle
pnpm run test:release-bundle
```

`release-status` prints the same `divinity.release_artifacts.v1` metadata as JSON. `release:artifacts` writes `dist/release-artifacts.json` with source-checkout, local pnpm-link, package-registry, and binary-download paths. `release:bundle` writes `divinity.release_candidate_bundle.v1` metadata under `dist/release-bundle/` with the package tarball, release metadata, binary launcher artifacts, release attestation, and `SHA256SUMS`. Registry and binary paths remain blocked in these surfaces while the package is private and the non-production warning is active.

Release source provenance is included in both surfaces. It reports the Git commit SHA, branch, repository URL from `package.json`, whether tracked source changes were present, and redaction flags. It ignores untracked files and does not print changed file paths or absolute local paths; if Git metadata is unavailable, provenance is marked unavailable without failing artifact generation.

Release SBOM metadata is included in both surfaces as `divinity.release_sbom.v1`. It is generated from `package.json` and `package-lock.json`, and records package/dependency names, versions, direct/transitive relationship, requested ranges, and license strings when present. It omits local absolute paths, `node_modules` paths, registry URLs, and lockfile integrity values. The SBOM does not unblock registry publishing or binary downloads while release gates remain blocked.

Release signing readiness is reported without leaking signing secrets. Configure `DIVINITY_RELEASE_SIGNING_COMMAND` as an absolute executable path, `DIVINITY_RELEASE_SIGNING_COMMAND_ARGS` as an optional JSON array of strings, and `DIVINITY_RELEASE_SIGNING_KEY_REF` plus `DIVINITY_RELEASE_SIGNING_IDENTITY` as deployment-managed signing references. The generated metadata reports only configured booleans and validation status; it does not store command args, key refs, identities, key material, package signatures, or binary signatures.

Registry publish readiness is reported without leaking registry tokens. The release metadata records `npm publish --provenance --access public` and `npm publish --dry-run --provenance --access public` as the future registry commands, reports whether `NPM_TOKEN` is configured, and lists blockers while `private: true`, the non-production warning, or token readiness prevent publishing. It does not store the token value or local absolute paths.

Binary release readiness is reported without leaking local paths or signing secrets. `release:binary` writes `divinity.release_binary_artifacts.v1` metadata, Node launcher artifacts, and `SHA256SUMS` under `dist/binary/`; `test:binary` verifies those artifacts and runs the current-platform launcher against `divinity doctor`. These artifacts are not signed native binaries, so `binary_download` stays blocked until native binary packaging and signing gates are cleared.

Release candidate bundle readiness is reported without leaking local paths or signing secrets. The bundle manifest stores only relative artifact paths, sha256 checksums, byte counts, release blockers, and redaction flags. It does not publish the package tarball or binary artifacts.

Release attestation readiness is reported without leaking local paths or signing secrets. `dist/release-bundle/attestation.json` records package identity, source provenance, release metadata digest, subject artifact digests, release blockers, and blocked signing status so future signing work has a deterministic subject list. It is not a public release signature.

The package remains marked `private` while the non-production warning is active. Published package and binary install paths are future release work.

## Verify The Install

```bash
node apps/cli/src/index.mjs doctor --profile source
node apps/cli/src/index.mjs release-status
pnpm run test:package
pnpm run test:binary
pnpm run test:release-bundle
pnpm run test:release-artifacts
pnpm run test:release-status
pnpm run validate:contracts
pnpm run test:smoke
pnpm test
```

If pnpm is not on `PATH`, replace `pnpm` with:

```bash
node ~/.cache/node/corepack/v1/pnpm/9.15.4/bin/pnpm.cjs
```

## Provider Credentials

Provider metadata is public, but secrets stay outside the repository.

- Use `divinity providers` to inspect known providers.
- Set operator-owned credentials in environment variables such as `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, or provider-specific variables shown by `divinity providers`.
- Use `DIVINITY_PROVIDER_CATALOG_PATH` only for reviewed local provider metadata overlays. Do not put API key values in catalog files.
- Public shared keys, no-signup key pools, reverse-engineered endpoints, and quota-bypass rotation are intentionally unsupported.

## Optional Local State

The default CLI path should not create repo-root state files during verification. Optional file-backed state is controlled by explicit environment variables:

- `DIVINITY_RUN_STORE_PATH`
- `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH`
- `DIVINITY_PROVIDER_USAGE_LEDGER_PATH`

Use temp directories for smoke tests and local experiments when possible.

## Troubleshooting

- `npm: command not found`: use Corepack pnpm. npm is optional.
- `pnpm: command not found`: run `corepack enable`, or call the cached pnpm CLI through Node as shown above.
- Provider route says credentials are missing: set an operator-owned API key for the selected provider, then rerun `divinity provider-route`.
- Docker isolation checks fail: install Docker or use non-Docker runner isolation profiles for local tests.
