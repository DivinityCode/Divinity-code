# @divinity/release-artifacts

Builds release-readiness metadata for Divinity Code.

- Generates `divinity.release_artifacts.v1` manifests from the package `files` allowlist.
- Records sha256 integrity metadata without including `node_modules`, `dist`, `.divinity*`, provider limit ledgers, or provider usage ledgers.
- Keeps registry publishing and signed binary paths blocked while `package.json` remains `private: true` and the non-production warning is active.
- Powers both `pnpm run release:artifacts` and CLI `divinity release-status`.
