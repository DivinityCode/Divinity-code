# @divinity/release-artifacts

Builds release-readiness metadata for Divinity Code.

- Generates `divinity.release_artifacts.v1` manifests from the package `files` allowlist.
- Records sha256 integrity metadata without including `node_modules`, `dist`, `.divinity*`, provider limit ledgers, or provider usage ledgers.
- Records redacted Git source provenance with commit SHA, branch, tracked-change status, and repository URL from package metadata.
- Records `divinity.release_sbom.v1` metadata from `package.json` and `package-lock.json`, including package/dependency names, versions, direct/transitive relationship, requested ranges, and license strings when present.
- Keeps registry publishing and signed binary paths blocked while `package.json` remains `private: true` and the non-production warning is active.
- Reports redacted signing input readiness from `DIVINITY_RELEASE_SIGNING_COMMAND`, `DIVINITY_RELEASE_SIGNING_COMMAND_ARGS`, `DIVINITY_RELEASE_SIGNING_KEY_REF`, and `DIVINITY_RELEASE_SIGNING_IDENTITY` without storing command args, key refs, identities, or key material in release metadata.
- Reports redacted npm registry publish readiness for `npm publish --provenance --access public`, including `NPM_TOKEN` configured state, blockers, and token/path redaction without storing token values.
- Reports `divinity.release_binary_readiness.v1` metadata for future signed binary downloads, including target filenames, build/smoke command placeholders, checksum and signing requirements, blockers, and path/signing-secret redaction.
- Generates `divinity.release_binary_artifacts.v1` local Node launcher artifacts, `SHA256SUMS`, and `manifest.json` under `dist/binary/` for release-candidate smoke checks.
- Powers both `pnpm run release:artifacts` and CLI `divinity release-status`.

Source provenance ignores untracked files, reports only whether tracked changes exist, and does not include changed file paths or absolute local paths. If Git metadata is unavailable, the manifest reports provenance as unavailable without failing artifact generation.

SBOM metadata omits local absolute paths, `node_modules` paths, registry URLs, and lockfile integrity values. It is release-candidate inventory metadata only; it does not unblock registry publishing or signed binary downloads while release gates remain blocked.

Signing commands must be absolute executable paths. Signing args must be a JSON array of strings. The key reference and identity are exposed only as configured booleans so release-candidate metadata can prove readiness without leaking signing secrets or identities.

Registry publish readiness is metadata only. It keeps package publishing blocked while `private: true`, the non-production warning, or missing `NPM_TOKEN` readiness remains in effect, and it does not print registry tokens or local absolute paths.

Binary release readiness is metadata only. It keeps the `binary_download` artifact blocked until the production warning is cleared and signed native binaries are built. The local `release:binary` path generates Node launcher artifacts and checksums for smoke review, marks them as non-native, and does not read or store signing secrets.
