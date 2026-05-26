# @divinity/release-artifacts

Builds release-readiness metadata for Divinity Code.

- Generates `divinity.release_artifacts.v1` manifests from the package `files` allowlist.
- Records sha256 integrity metadata without including `node_modules`, `dist`, `.divinity*`, provider limit ledgers, or provider usage ledgers.
- Records redacted Git source provenance with commit SHA, branch, tracked-change status, and repository URL from package metadata.
- Records `divinity.release_sbom.v1` metadata from `package.json` and `package-lock.json`, including package/dependency names, versions, direct/transitive relationship, requested ranges, and license strings when present.
- Reports `divinity.release_gate_clearance.v1` metadata with current state, required state, evidence command, and evidence artifacts for each public-release blocker.
- Keeps registry publishing and signed binary paths blocked while `package.json` remains `private: true` and the non-production warning is active.
- Reports redacted signing input readiness from `DIVINITY_RELEASE_SIGNING_COMMAND`, `DIVINITY_RELEASE_SIGNING_COMMAND_ARGS`, `DIVINITY_RELEASE_SIGNING_KEY_REF`, and `DIVINITY_RELEASE_SIGNING_IDENTITY` without storing command args, key refs, identities, or key material in release metadata.
- Reports redacted npm registry publish readiness for `npm publish --provenance --access public`, including `NPM_TOKEN` configured state, blockers, and token/path redaction without storing token values.
- Reports `divinity.release_binary_readiness.v1` metadata for future signed binary downloads, including target filenames, build/smoke command placeholders, checksum and signing requirements, blockers, and path/signing-secret redaction.
- Generates `divinity.release_binary_artifacts.v1` local Node launcher artifacts, `SHA256SUMS`, and `manifest.json` under `dist/binary/` for release-candidate smoke checks.
- Generates `divinity.release_native_binary_artifacts.v1` native binary artifacts through `DIVINITY_NATIVE_BINARY_BUILD_COMMAND`, plus `SHA256SUMS` and `manifest.json` under `dist/native-binary/` for release-candidate review.
- Generates `divinity.release_signed_native_binary_artifacts.v1` native binary signatures through the native build and release signing commands, plus `SHA256SUMS` and `manifest.json` under `dist/signed-native-binary/` for release-candidate review.
- Reports `divinity.release_candidate_bundle_readiness.v1` metadata and generates `divinity.release_candidate_bundle.v1` review bundles under `dist/release-bundle/`.
- Reports `divinity.release_attestation_readiness.v1` metadata and writes `divinity.release_attestation.v1` as `dist/release-bundle/attestation.json`.
- Reports `divinity.release_signature_artifacts_readiness.v1` metadata and writes `divinity.release_signature_artifacts.v1` as `dist/release-signatures/manifest.json` when signing inputs are configured.
- Reports and writes `divinity.release_promotion_preflight.v1` metadata for blocked public package and signed binary promotion checks.
- Powers both `pnpm run release:artifacts` and CLI `divinity release-status`.

Source provenance ignores untracked files, reports only whether tracked changes exist, and does not include changed file paths or absolute local paths. If Git metadata is unavailable, the manifest reports provenance as unavailable without failing artifact generation.

SBOM metadata omits local absolute paths, `node_modules` paths, registry URLs, and lockfile integrity values. It is release-candidate inventory metadata only; it does not unblock registry publishing or signed binary downloads while release gates remain blocked.

Release gate clearance is metadata only. It keeps `public_release_ready: false` while blockers remain, and records package privacy, production warning, registry token readiness, native binary distribution, release signing, and GitHub Release Readiness evidence without storing local paths, registry token values, signing key references, signing identities, or signing secrets.

Signing commands must be absolute executable paths. Signing args must be a JSON array of strings. The key reference and identity are exposed only as configured booleans so release-candidate metadata can prove readiness without leaking signing secrets or identities.

Registry publish readiness is metadata only. It keeps package publishing blocked while `private: true`, the non-production warning, or missing `NPM_TOKEN` readiness remains in effect, and it does not print registry tokens or local absolute paths.

Binary release readiness is metadata only. It keeps the `binary_download` artifact blocked until the production warning is cleared and signed native binaries are built. The local `release:binary` path generates Node launcher artifacts and checksums for smoke review, marks them as non-native, and does not read or store signing secrets.

Native binary artifacts are external-command outputs, not public downloads. `pnpm run release:native-binary` requires `DIVINITY_NATIVE_BINARY_BUILD_COMMAND` to be an absolute executable path and `DIVINITY_NATIVE_BINARY_BUILD_COMMAND_ARGS` to be a JSON array of strings when present. The build command receives target metadata and an output directory over JSON stdin, then `packages/release-artifacts` verifies returned artifacts, writes `divinity.release_native_binary_artifacts.v1`, and stores relative artifact paths, sha256 values, byte counts, blockers, and redaction flags. It intentionally excludes local absolute paths, raw build command paths, registry tokens, signing secrets, and provider credentials.

Signed native binary artifacts are local review artifacts, not public downloads. `pnpm run release:signed-native-binary` requires both the native build command and release signing command configuration. It builds native artifacts under `dist/signed-native-binary/native-binary/`, sends each target to the signing command over JSON stdin, writes detached signatures under `dist/signed-native-binary/signatures/`, and records `divinity.release_signed_native_binary_artifacts.v1` with relative subject paths, subject digests, signature digests, byte counts, blockers, and redaction flags. It intentionally excludes local absolute paths, raw build command paths, signing command paths, signing key references, signing identities, registry tokens, and provider credentials.

Release candidate bundles are local review artifacts only. `pnpm run release:bundle` writes `release-artifacts.json`, a package tarball from `npm pack`, binary launcher metadata, binary checksums, release attestation, a bundle-level `SHA256SUMS`, and `manifest.json` under `dist/release-bundle/`. The bundle manifest stores relative paths, sha256 values, byte counts, and blockers without local absolute paths, `node_modules` paths, registry tokens, or signing secret references. `pnpm run test:release-bundle` verifies those files and keeps public package publishing plus signed native binary downloads blocked until release gates clear.

Release attestation is signable provenance metadata, not a public release signature. `attestation.json` records package identity, source provenance, release metadata digest, subject artifact digests, release blockers, and blocked signing status. It intentionally excludes absolute paths, `node_modules` paths, registry tokens, signing key references, signing identities, and provider credentials.

Release signature artifacts are detached local review signatures, not a public release. `pnpm run release:signatures` regenerates the release-candidate bundle, sends selected bundle subjects to the configured signing command over JSON stdin, writes signature files plus `SHA256SUMS` under `dist/release-signatures/`, and records `divinity.release_signature_artifacts.v1` metadata with relative subject paths, subject digests, signature digests, byte counts, redaction flags, and blockers. It intentionally excludes local absolute paths, signing command paths, command args, signing key references, signing identities, registry tokens, and provider credentials.

Release promotion preflight is a deterministic blocker report, not a publish command. `pnpm run release:promotion-preflight` writes `dist/release-promotion-preflight.json` with package-registry and signed-binary promotion targets, required local artifacts, gate commands, registry token readiness, signing readiness, and blockers. It does not run `npm publish`, upload binaries, or store raw registry tokens, signing key references, signing identities, local paths, or provider credentials.
