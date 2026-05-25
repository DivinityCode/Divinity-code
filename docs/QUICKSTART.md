# Quickstart

This path is for a local development checkout. It keeps provider secrets out of files and uses deterministic smoke checks before any live provider calls.

## 1. Install And Verify

```bash
git clone https://github.com/DivinityCode/Divinity-code.git
cd Divinity-code
corepack enable
pnpm install
pnpm run validate:contracts
pnpm run test:smoke
```

## 2. Initialize Builder Mode

```bash
node apps/cli/src/index.mjs init
```

The installed binary name is `divinity`; from a source checkout, use `node apps/cli/src/index.mjs` for the same commands.

```bash
pnpm link --global
divinity init
divinity doctor
```

If you do not want to link the checkout globally, replace `divinity` with `node apps/cli/src/index.mjs` in the commands below.

`divinity doctor` reports Node, package-manager readiness, dependencies, provider catalog readiness, optional Docker readiness, and provider credential readiness without printing secret values.

## 3. Inspect Providers And Toolsets

```bash
divinity providers
divinity toolsets
divinity provider-route --candidate openrouter --candidate groq
```

Provider route planning does not send prompts or call live LLM providers. It checks catalog metadata, credential readiness, route policy, and active provider limit ledgers.

## 4. Run A Local Task

```bash
divinity run "Inspect this repository and summarize the current validation commands" \
  --success-criteria "Summary names contract validation and smoke tests"
```

The local run path emits structured task, run, goal, event, memory, orchestration, artifact, and budget metadata.

## 5. Check Status

```bash
divinity status <run_id>
```

With an API server running, use:

```bash
divinity status <run_id> --api http://127.0.0.1:3000
```

## 6. Optional Provider Chat Smoke

Use only operator-owned credentials:

```bash
export OPENROUTER_API_KEY=...
divinity provider-chat \
  --provider openrouter \
  --model openai/gpt-4o-mini \
  --message "Return one sentence describing this repository."
```

Do not use public shared keys, no-signup key pools, or rotation intended to bypass provider limits.

## 7. Before Opening A PR

```bash
pnpm run validate:contracts
pnpm run test:package
pnpm run test:providers
pnpm run test:smoke
pnpm test
```
