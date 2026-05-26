# @divinity/release-artifacts

Builds release-readiness metadata for Divinity Code.

- Generates `divinity.release_artifacts.v1` manifests from the package `files` allowlist.
- Records sha256 integrity metadata without including `node_modules`, `dist`, `.divinity*`, provider limit ledgers, or provider usage ledgers.
- Records redacted Git source provenance with commit SHA, branch, tracked-change status, and repository URL from package metadata.
- Keeps registry publishing and signed binary paths blocked while `package.json` remains `private: true` and the non-production warning is active.
- Reports redacted signing input readiness from `DIVINITY_RELEASE_SIGNING_COMMAND`, `DIVINITY_RELEASE_SIGNING_COMMAND_ARGS`, `DIVINITY_RELEASE_SIGNING_KEY_REF`, and `DIVINITY_RELEASE_SIGNING_IDENTITY` without storing command args, key refs, identities, or key material in release metadata.
- Powers both `pnpm run release:artifacts` and CLI `divinity release-status`.

Source provenance ignores untracked files, reports only whether tracked changes exist, and does not include changed file paths or absolute local paths. If Git metadata is unavailable, the manifest reports provenance as unavailable without failing artifact generation.

Signing commands must be absolute executable paths. Signing args must be a JSON array of strings. The key reference and identity are exposed only as configured booleans so release-candidate metadata can prove readiness without leaking signing secrets or identities.
