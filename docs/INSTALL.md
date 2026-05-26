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

Generate the public distribution readiness audit with:

```bash
pnpm run release:public-readiness-audit
pnpm run test:public-readiness-audit
```

Generate a fail-closed registry publish dry-run report with:

```bash
pnpm run release:registry-dry-run
pnpm run test:release-registry-dry-run
```

Generate local binary-launcher review artifacts with:

```bash
pnpm run release:binary
pnpm run test:binary
```

Generate external native binary review artifacts with:

```bash
pnpm run release:native-binary
pnpm run test:native-binary
```

Generate signed native binary review artifacts with:

```bash
pnpm run release:signed-native-binary
pnpm run test:signed-native-binary
```

Generate a blocked GitHub Release binary attachment plan with:

```bash
pnpm run release:binary-attachments
pnpm run test:release-binary-attachments
```

Assemble a release-candidate review bundle with:

```bash
pnpm run release:bundle
pnpm run test:release-bundle
```

Generate local release-candidate signatures with:

```bash
pnpm run release:signatures
pnpm run test:release-signatures
```

Generate the public-promotion preflight report with:

```bash
pnpm run release:promotion-preflight
pnpm run test:release-promotion
```

Validate the guarded public-promotion execution path with:

```bash
pnpm run release:promotion-execute
pnpm run test:release-promotion-execute
```

`release-status` prints the same `divinity.release_artifacts.v1` metadata as JSON. `release:artifacts` writes `dist/release-artifacts.json` with source-checkout, local pnpm-link, package-registry, and binary-download paths. That manifest also includes `divinity.release_gate_clearance.v1`, a blocker-by-blocker audit of package privacy, the README production warning, registry token readiness, GitHub release token/tag readiness, native binary distribution, release signing, and GitHub release-readiness evidence. `release:public-readiness-audit` writes `divinity.release_public_readiness_audit.v1` to `dist/release-public-readiness-audit.json`, recording the package privacy and README warning decisions without changing `package.json`, removing docs warnings, publishing, or uploading files. `release:registry-dry-run` writes `divinity.release_registry_publish_dry_run.v1` metadata to `dist/release-registry-dry-run.json`; it skips npm execution while blockers remain and records only command metadata, blockers, token configured state, and redaction flags. `release:native-binary` writes `divinity.release_native_binary_artifacts.v1` metadata under `dist/native-binary/` with externally built native binary artifacts and `SHA256SUMS` when native build inputs are configured. `release:signed-native-binary` writes `divinity.release_signed_native_binary_artifacts.v1` metadata under `dist/signed-native-binary/` with nested native binary artifacts, detached signatures, and `SHA256SUMS` when native build and signing inputs are configured. `release:binary-attachments` writes `divinity.release_binary_attachment_plan.v1` metadata to `dist/release-binary-attachments.json` with the future GitHub Release upload command, signed-native asset sources, release tag readiness, and GitHub token readiness while never uploading files. `release:bundle` writes `divinity.release_candidate_bundle.v1` metadata under `dist/release-bundle/` with the package tarball, release metadata, binary launcher artifacts, release attestation, and `SHA256SUMS`. `release:signatures` writes `divinity.release_signature_artifacts.v1` metadata under `dist/release-signatures/` with signature files and checksums for the bundle subjects when signing inputs are configured. `release:promotion-preflight` writes `dist/release-promotion-preflight.json` with required promotion artifacts, gate commands, public readiness audit evidence, registry token readiness, GitHub Release attachment readiness, native binary artifact readiness, signing readiness, and blockers. `release:promotion-execute` writes `divinity.release_promotion_execution.v1` to `dist/release-promotion-execution.json`, and only runs npm publish plus GitHub Release upload commands after all blockers clear and `DIVINITY_PUBLIC_RELEASE_CONFIRM=publish` is set. Registry and binary paths remain blocked in these surfaces while the package is private and the non-production warning is active.

Release source provenance is included in both surfaces. It reports the Git commit SHA, branch, repository URL from `package.json`, whether tracked source changes were present, and redaction flags. It ignores untracked files and does not print changed file paths or absolute local paths; if Git metadata is unavailable, provenance is marked unavailable without failing artifact generation.

Release SBOM metadata is included in both surfaces as `divinity.release_sbom.v1`. It is generated from `package.json` and `package-lock.json`, and records package/dependency names, versions, direct/transitive relationship, requested ranges, and license strings when present. It omits local absolute paths, `node_modules` paths, registry URLs, and lockfile integrity values. The SBOM does not unblock registry publishing or binary downloads while release gates remain blocked.

Release gate clearance metadata is a deterministic audit, not a release approval. It lists the current state, required state, evidence command, and evidence artifacts for each blocker while redacting local paths, registry tokens, GitHub release tokens, signing key references, signing identities, and signing secrets. It keeps `public_release_ready: false` until package privacy, the production warning, registry credentials, GitHub Release destination readiness, native binary distribution, signing, and GitHub release-readiness evidence are all resolved.

Public readiness audits are deterministic release checks, not release approvals. `release:public-readiness-audit` keeps `public_release_ready: false` while blockers remain, records whether package publishing and the README warning still require an explicit public-release decision, and stores no local paths, registry token values, GitHub release token values, release tag values, signing key references, signing identities, or signing secrets.

Release signing readiness is reported without leaking signing secrets. Configure `DIVINITY_RELEASE_SIGNING_COMMAND` as an absolute executable path, `DIVINITY_RELEASE_SIGNING_COMMAND_ARGS` as an optional JSON array of strings, and `DIVINITY_RELEASE_SIGNING_KEY_REF` plus `DIVINITY_RELEASE_SIGNING_IDENTITY` as deployment-managed signing references. The generated metadata reports only configured booleans and validation status; it does not store command args, key refs, identities, key material, local paths, or raw signing command paths.

Release signature artifacts are local review artifacts only. `release:signatures` regenerates the release bundle, sends selected bundle subjects to the configured signing command over JSON stdin, writes detached signatures under `dist/release-signatures/signatures/`, and records only relative subject paths, subject digests, signature digests, byte counts, redaction flags, and blockers. It does not publish package tarballs, upload binaries, or store raw signing key references, signing identities, signing command paths, local absolute paths, registry tokens, or provider credentials.

Registry publish readiness is reported without leaking registry tokens. The release metadata records `npm publish --provenance --access public` and `npm publish --dry-run --provenance --access public` as the future registry commands, reports whether `NPM_TOKEN` is configured, and lists blockers while `private: true`, the non-production warning, or token readiness prevent publishing. It does not store the token value or local absolute paths.

Registry publish dry-run artifacts are fail-closed release checks, not publish commands. `release:registry-dry-run` writes `divinity.release_registry_publish_dry_run.v1` and does not execute npm while package privacy, the production warning, or token readiness blockers remain. When those blockers are cleared in a release context, the dry-run path executes `npm publish --dry-run --provenance --access public --json` and records only stdout byte count, stdout sha256, parsed-output status, blockers, and redaction flags. It never stores `NPM_TOKEN`, raw npm output, local paths, or npm executable paths.

Binary release readiness is reported without leaking local paths or signing secrets. `release:binary` writes `divinity.release_binary_artifacts.v1` metadata, Node launcher artifacts, and `SHA256SUMS` under `dist/binary/`; `test:binary` verifies those artifacts and runs the current-platform launcher against `divinity doctor`. These artifacts are not signed native binaries, so `binary_download` stays blocked until native binary packaging and signing gates are cleared.

Native binary artifacts are generated only through an operator-configured external build command. Configure `DIVINITY_NATIVE_BINARY_BUILD_COMMAND` as an absolute executable path and `DIVINITY_NATIVE_BINARY_BUILD_COMMAND_ARGS` as an optional JSON array of strings. `release:native-binary` sends target metadata over JSON stdin, writes `divinity.release_native_binary_artifacts.v1`, native artifact checksums, and relative artifact paths under `dist/native-binary/`, and redacts local paths plus raw build command paths. It does not sign artifacts, publish downloads, or store signing secrets, registry tokens, provider credentials, or absolute paths.

Signed native binary artifacts compose the native build command with the release signing command. Configure both `DIVINITY_NATIVE_BINARY_BUILD_COMMAND` and the release signing environment variables above. `release:signed-native-binary` builds native artifacts under `dist/signed-native-binary/native-binary/`, signs each native target through JSON stdin, writes detached signatures under `dist/signed-native-binary/signatures/`, and records `divinity.release_signed_native_binary_artifacts.v1` with only relative subject paths, subject digests, signature digests, byte counts, blockers, and redaction flags. It does not publish downloads or store signing command paths, signing key references, signing identities, registry tokens, provider credentials, or absolute local paths.

Binary attachment plans are local release checks, not uploads. Configure `DIVINITY_RELEASE_TAG` plus either `GITHUB_TOKEN` or `GH_TOKEN` in a release environment. `release:binary-attachments` records only whether those inputs are configured, the repository slug, the future `gh release upload` command, and relative signed-native asset source paths. It does not upload files, create GitHub releases, store token values, store release tag values, store local paths, or store signing secrets.

Release candidate bundle readiness is reported without leaking local paths or signing secrets. The bundle manifest stores only relative artifact paths, sha256 checksums, byte counts, release blockers, and redaction flags. It does not publish the package tarball or binary artifacts.

Release attestation readiness is reported without leaking local paths or signing secrets. `dist/release-bundle/attestation.json` records package identity, source provenance, release metadata digest, subject artifact digests, release blockers, and blocked signing status so future signing work has a deterministic subject list. It is not a public release signature.

Release promotion preflight is reported without leaking registry tokens, GitHub release tokens, or signing secrets. It never runs `npm publish`, creates signatures, or uploads binaries; it only proves whether the current release candidate has the required artifacts, checks, credentials, release tag, and cleared blockers for a future public promotion.

Release promotion execution is fail-closed. `release:promotion-execute` writes a blocked report by default and refuses to run publish or upload commands while package privacy, the production warning, registry token, GitHub release token/tag, native binary, signing, or explicit confirmation gates remain blocked. When every gate is clear and `DIVINITY_PUBLIC_RELEASE_CONFIRM=publish` is configured by the operator, it runs `npm publish --provenance --access public --json` and `gh release upload "$DIVINITY_RELEASE_TAG" dist/signed-native-binary/* --repo DivinityCode/Divinity-code --clobber`, then records only status, stdout byte counts, stdout sha256 hashes, blocker state, and redaction flags.

The package remains marked `private` while the non-production warning is active. Published package and binary install paths are future release work.

## Verify The Install

```bash
node apps/cli/src/index.mjs doctor --profile source
node apps/cli/src/index.mjs release-status
pnpm run test:package
pnpm run test:public-readiness-audit
pnpm run test:release-registry-dry-run
pnpm run test:release-binary-attachments
pnpm run test:binary
pnpm run test:native-binary
pnpm run test:signed-native-binary
pnpm run test:release-bundle
pnpm run test:release-signatures
pnpm run test:release-promotion
pnpm run test:release-promotion-execute
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
