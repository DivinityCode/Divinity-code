# Upgrade Guide

Use this procedure when updating an existing local checkout.

## 1. Confirm Worktree State

```bash
git status --short --branch
```

Commit or stash local work before upgrading.

## 2. Pull The Latest Main

```bash
git switch main
git pull --ff-only origin main
```

If the pull is not a fast-forward, inspect the branch history before continuing.

## 3. Refresh Dependencies

Preferred:

```bash
corepack enable
pnpm install
```

If pnpm is cached but not on `PATH`:

```bash
node ~/.cache/node/corepack/v1/pnpm/9.15.4/bin/pnpm.cjs install
```

`npm` is optional. Use `npm install` only when npm is available and you intentionally want the npm lockfile install path.

## 4. Validate Contracts And Behavior

```bash
pnpm run validate:contracts
pnpm run test:providers
pnpm run test:smoke
pnpm test
```

The provider test suite uses local mock servers for proxy behavior and does not require live LLM credentials.

## 5. Run A Deprecation Review

Before relying on new behavior, run the automated deprecation audit:

```bash
pnpm run test:deprecations
```

This gate checks public action docs, release artifact metadata, and provider proxy token-field usage for known stale or unsafe instructions.

Optional manual follow-up:

- Check `docs/REPOSITORY_RESEARCH.md` for the latest observed upstream release signals.
- Check `docs/FREE_LLM_PROVIDER_RESEARCH.md` for current provider-source policy.
- Check `docs/PRODUCT_PLAN.md` for implemented and remaining production-readiness slices.
- Search for deprecated local instructions not yet covered by the audit:

```bash
rg -n "deprecated|deprecation|npm install -g|npx[[:space:]]+divinity" README.md docs apps packages tests
```

Deprecated upstream references may appear in research notes when explicitly marked as upstream status. Do not turn those into install instructions.

## 6. Recheck Optional State

If you use file-backed local state, confirm those paths still point outside committed source:

- `DIVINITY_RUN_STORE_PATH`
- `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH`
- `DIVINITY_PROVIDER_USAGE_LEDGER_PATH`

Do not commit generated `.divinity*.json` state files.
