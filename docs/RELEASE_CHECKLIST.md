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
pnpm run release:public-readiness-audit
pnpm run test:public-readiness-audit
pnpm run release:environment-readiness
pnpm run test:release-environment-readiness
pnpm run release:registry-dry-run
pnpm run test:release-registry-dry-run
pnpm run release:binary-attachments
pnpm run test:release-binary-attachments
pnpm run release:binary
pnpm run test:binary
pnpm run release:native-binary
pnpm run test:native-binary
pnpm run release:signed-native-binary
pnpm run test:signed-native-binary
pnpm run release:bundle
pnpm run test:release-bundle
pnpm run release:signatures
pnpm run test:release-signatures
pnpm run release:promotion-preflight
pnpm run test:release-promotion
pnpm run release:promotion-execute
pnpm run test:release-promotion-execute
pnpm run test:release-artifacts
pnpm run test:release-status
```

- [ ] Review release artifact integrity and signing readiness:

```bash
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.source_provenance.status, a.source_provenance.short_commit_sha, a.source_provenance.tracked_changes)"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.release_sbom.status, a.release_sbom.component_count, a.release_sbom.redacts_local_paths)"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.release_gate_clearance.status, a.release_gate_clearance.public_release_ready, a.release_gate_clearance.blockers.join(','))"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.release_public_readiness_audit.status, a.release_public_readiness_audit.decision_required, a.release_public_readiness_audit.blockers.join(','))"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.release_environment_readiness.status, a.release_environment_readiness.environment_ready, a.release_environment_readiness.blockers.join(','))"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.artifact_integrity.algorithm, a.artifact_integrity.files.length, a.artifact_signing.status)"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.artifact_signing.configuration.status, a.artifact_signing.configuration.ready_when_release_gates_clear)"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.registry_publish_readiness.status, a.registry_publish_readiness.token_configured, a.registry_publish_readiness.blockers.join(','))"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.release_registry_publish_dry_run.status, a.release_registry_publish_dry_run.dry_run_executed, a.release_registry_publish_dry_run.blockers.join(','))"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.release_binary_attachment_plan.status, a.release_binary_attachment_plan.token_configured, a.release_binary_attachment_plan.release_tag_configured, a.release_binary_attachment_plan.blockers.join(','))"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.binary_release_readiness.status, a.binary_release_readiness.supported_targets.length, a.binary_release_readiness.blockers.join(','))"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.binary_release_readiness.native_build_pipeline.status, a.binary_release_readiness.native_build_pipeline.command)"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.binary_release_readiness.signed_native_binary_pipeline.status, a.binary_release_readiness.signed_native_binary_pipeline.command)"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.release_candidate_bundle.status, a.release_candidate_bundle.output_directory, a.release_candidate_bundle.blockers.join(','))"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.release_attestation.status, a.release_attestation.attestation_path, a.release_attestation.blockers.join(','))"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.release_signature_artifacts.status, a.release_signature_artifacts.output_directory, a.release_signature_artifacts.blockers.join(','))"
node -e "const a=require('./dist/release-artifacts.json'); console.log(a.release_promotion_preflight.status, a.release_promotion_preflight.public_release_ready, a.release_promotion_preflight.blockers.join(','))"
node -e "const b=require('./dist/release-bundle/manifest.json'); console.log(b.status, b.artifacts.length, b.blockers.join(','))"
node -e "const t=require('./dist/release-bundle/attestation.json'); console.log(t.status, t.subject_count, t.signing.status)"
node -e "const s=require('./dist/release-signatures/manifest.json'); console.log(s.status, s.signatures.length, s.blockers.join(','))"
node -e "const n=require('./dist/native-binary/manifest.json'); console.log(n.status, n.artifacts.length, n.blockers.join(','))"
node -e "const sn=require('./dist/signed-native-binary/manifest.json'); console.log(sn.status, sn.signatures.length, sn.blockers.join(','))"
node -e "const r=require('./dist/release-public-readiness-audit.json'); console.log(r.status, r.decision_required, r.blockers.join(','))"
node -e "const e=require('./dist/release-environment-readiness.json'); console.log(e.status, e.environment_ready, e.blockers.join(','))"
node -e "const p=require('./dist/release-promotion-preflight.json'); console.log(p.status, p.release_gates.length, p.blockers.join(','))"
node -e "const x=require('./dist/release-promotion-execution.json'); console.log(x.status, x.execution_attempted, x.blockers.join(','))"
```

- [ ] Confirm source provenance reports the expected commit and does not expose changed file paths or absolute local paths.
- [ ] Confirm `divinity.release_sbom.v1` was generated from `package.json` and `package-lock.json`, includes package/dependency names, versions, direct/transitive relationship, requested ranges, and license strings when present, and does not expose local absolute paths, `node_modules` paths, registry URLs, or lockfile integrity values.
- [ ] Confirm `divinity.release_gate_clearance.v1` reports `public_release_ready: false` while blockers remain, lists package privacy, production warning, registry token, GitHub release token/tag readiness, native binary distribution, release signing, and GitHub release-readiness evidence items, and stores no local absolute paths, registry tokens, GitHub release tokens, signing key references, signing identities, or signing secrets.
- [ ] Confirm `divinity.release_public_readiness_audit.v1` exists under `dist/release-public-readiness-audit.json`, reports package privacy and README warning decision state, stays blocked while public release blockers remain, and stores no local absolute paths, registry tokens, GitHub release tokens, release tag values, signing key references, signing identities, or signing secrets.
- [ ] Confirm `divinity.release_environment_readiness.v1` exists under `dist/release-environment-readiness.json`, reports configured-state metadata for registry tokens, GitHub Release tokens, release tag, explicit publish confirmation, native build inputs, and signing inputs, and stores no local absolute paths, registry tokens, GitHub release tokens, release tag values, signing key references, signing identities, command paths, or provider credentials.
- [ ] If testing release signing readiness, configure `DIVINITY_RELEASE_SIGNING_COMMAND` as an absolute executable path, `DIVINITY_RELEASE_SIGNING_COMMAND_ARGS` as a JSON array of strings, and signing key/identity references through `DIVINITY_RELEASE_SIGNING_KEY_REF` and `DIVINITY_RELEASE_SIGNING_IDENTITY`. Confirm the generated metadata reports readiness without printing those values.
- [ ] If testing registry publish readiness, configure `NPM_TOKEN` in the environment and confirm the generated metadata reports only `token_configured: true`, never the token value.
- [ ] Confirm `divinity.release_registry_publish_dry_run.v1` exists under `dist/release-registry-dry-run.json`, skips npm execution while blockers remain, and stores no registry token values, raw npm output, local paths, or npm executable paths.
- [ ] If testing binary attachment readiness, configure `DIVINITY_RELEASE_TAG` plus either `GITHUB_TOKEN` or `GH_TOKEN` in the environment and confirm the generated metadata reports only configured booleans, never the token value or release tag value.
- [ ] Confirm `divinity.release_binary_attachment_plan.v1` exists under `dist/release-binary-attachments.json`, lists the future GitHub Release upload command and signed-native asset sources, skips upload while blockers remain, and stores no GitHub token values, release tag values, local paths, or signing secrets.
- [ ] Confirm `divinity.release_binary_artifacts.v1` exists under `dist/binary/`, `SHA256SUMS` matches generated launcher bytes, and `manifest.json` stores no local absolute paths or signing secret references.
- [ ] Confirm `divinity.release_binary_readiness.v1` lists generated Node launcher targets, blocked public-download status, checksum/signing requirements, and blockers; it must not expose local paths, signing key references, or generated binary contents.
- [ ] Confirm `divinity.release_native_binary_artifacts.v1` exists under `dist/native-binary/` when native build inputs are configured, lists Linux, macOS, and Windows native binary targets with checksums, and stores no local absolute paths, build command paths, signing key references, registry tokens, or provider credentials.
- [ ] Confirm `divinity.release_signed_native_binary_artifacts.v1` exists under `dist/signed-native-binary/` when native build and signing inputs are configured, lists detached signatures for each native binary target, and stores no local absolute paths, build command paths, signing command paths, signing key references, signing identities, registry tokens, or provider credentials.
- [ ] Confirm `divinity.release_candidate_bundle.v1` exists under `dist/release-bundle/`, includes the package tarball, release metadata, binary metadata, and bundle `SHA256SUMS`, and stores no local absolute paths, `node_modules` paths, registry tokens, or signing secret references.
- [ ] Confirm `divinity.release_attestation.v1` exists under `dist/release-bundle/attestation.json`, lists package/release/binary subjects with sha256 digests, reports blocked signing status, and stores no local absolute paths, `node_modules` paths, registry tokens, signing key references, or signing identities.
- [ ] Confirm `divinity.release_signature_artifacts.v1` exists under `dist/release-signatures/`, lists detached signatures for release metadata, package tarball, binary metadata, checksums, and attestation subjects, and stores no local absolute paths, signing command paths, signing key references, signing identities, registry tokens, or provider credentials.
- [ ] Confirm `divinity.release_promotion_preflight.v1` exists under `dist/release-promotion-preflight.json`, lists required artifacts, the public readiness audit, and release gates, reports `public_release_ready: false` while blockers remain, and stores no local absolute paths, registry tokens, GitHub release tokens, signing key references, signing identities, or provider credentials.
- [ ] Confirm `divinity.release_promotion_execution.v1` exists under `dist/release-promotion-execution.json`, refuses to run publish/upload commands while blockers or missing `DIVINITY_PUBLIC_RELEASE_CONFIRM=publish` remain, and stores no local absolute paths, registry tokens, GitHub release tokens, release tag values, raw npm output, command paths, signing key references, signing identities, or provider credentials.
- [ ] Do not publish package registry tarballs, create GitHub releases, or upload signed binary downloads while `artifact_signing.status` is `blocked`.

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
- [ ] Wait for GitHub Actions to pass, including `Contracts Validation` and `Release Readiness`.
- [ ] Confirm `.github/workflows/release-readiness.yml` ran the release-readiness command set: `npm run validate:contracts`, public docs, deprecations, providers, package/tarball, public readiness audit, registry dry-run, binary attachment planning, binary, native binary, signed native binary, release bundle, release signatures, release promotion preflight, release promotion execution guard, release artifacts, release status, smoke, and full `npm test`.
- [ ] Run the local workflow guard:

```bash
pnpm run test:github-workflows
```

- [ ] Confirm the PR head SHA before merging.
- [ ] Squash-merge only after local and GitHub checks are green.
- [ ] Sync local `main` after merge and rerun focused verification for the changed area.
