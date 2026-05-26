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

`release-status` prints the same `divinity.release_artifacts.v1` metadata as JSON. `release:artifacts` writes `dist/release-artifacts.json` with source-checkout, local pnpm-link, package-registry, and binary-download paths. Registry and binary paths remain blocked in both surfaces while the package is private and the non-production warning is active.

The package remains marked `private` while the non-production warning is active. Published package and binary install paths are future release work.

## Verify The Install

```bash
node apps/cli/src/index.mjs doctor --profile source
node apps/cli/src/index.mjs release-status
pnpm run test:package
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
