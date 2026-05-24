# Competitive Repository Research (Claude Code, Codex, Hermes Agent, Paperclip)

_Last updated: 2026-05-24_

## Scope
This document captures findings from the primary GitHub repositories and public project docs for:
- `anthropics/claude-code`
- `openai/codex`
- `NousResearch/hermes-agent`
- `paperclipai/paperclip`

Goal: translate repo-level strengths into actionable product decisions for Divinity Code.

## 1) Claude Code (`anthropics/claude-code`)
### Observed strengths
- Clear positioning as a terminal-native coding agent with IDE/GitHub adjacency.
- Strong install/onboarding emphasis across OSes.
- Focused promise: execute routine tasks, explain code, and manage git workflows.

### Product takeaways for Divinity Code
1. Keep a keyboard-first terminal experience as a first-class surface.
2. Treat install/upgrade reliability as product work, not a docs afterthought.
3. Pair agent output with git-native workflows (commit/PR-ready summaries).

## 2) Codex (`openai/codex`)
### Observed strengths
- Explicitly supports multiple surfaces: CLI, IDE integrations, and app/web entrypoints.
- Excellent quickstart ergonomics and package manager install paths.
- Consistent framing around local execution with practical developer loops.

### Product takeaways for Divinity Code
1. Build one shared task model used by CLI, IDE, and dashboard.
2. Offer frictionless install paths (shell installer + package managers).
3. Prioritize local-repo context and fast edit/test iteration cycles.

## 3) Hermes Agent (`NousResearch/hermes-agent`)
### Observed strengths
- Strong differentiation around self-improving loops (skills + memory evolution).
- Broad deployment/runtime flexibility (local, container, remote/cloud options).
- Multi-channel interaction model and explicit subagent parallelization patterns.

### Product takeaways for Divinity Code
1. Implement layered memory with provenance and controllable persistence.
2. Support delegated subagents and parallel execution as core primitives.
3. Design for portability (local-first + cloud runners with consistent UX).

## 4) Paperclip (`paperclipai/paperclip`)
### Observed strengths
- Product direction emphasizes agent management for teams, not only solo coding.
- Organization-level framing suggests dashboards, oversight, and workflow governance.
- Repository organization indicates app + docs + website separation (productized motion).

### Product takeaways for Divinity Code
1. Add a robust operator dashboard (queue, approvals, run analytics).
2. Make governance explicit (policies, audit trails, role-aware controls).
3. Treat documentation and onboarding as continuously shipped product components.

## Cross-Repo Convergence (What "best in class" should combine)
1. **Builder excellence:** terminal and IDE depth for day-to-day engineering work.
2. **Operator excellence:** project-wide visibility, approvals, and budget controls.
3. **Agent orchestration:** planner/executor/verifier + subagent parallelism.
4. **Trust architecture:** explicit permissions, risk preflight, and immutable audit traces.
5. **Memory quality:** useful long-term memory with provenance, expiry, and user override.

## Implementation Decisions to Adopt Immediately
1. Standardize a run contract with explicit lifecycle states.
2. Introduce policy checks before any side-effecting step.
3. Require evidence links for each major agent decision.
4. Add cost/risk badges to every run surface (CLI + dashboard).
5. Keep all outputs PR-ready (diff summary, commands executed, validation signals).

## Proposed Next Build Slice (2-week execution)
### Week 1
- Define JSON schemas for Task, Run, Step, Artifact, Policy.
- Scaffold CLI command group (`init`, `run`, `status`, `approve`).
- Implement local run event stream and structured logging.

### Week 2
- Build dashboard pages: task list, run timeline, approval queue.
- Add preflight risk and budget estimation panel.
- Implement one approval gate path for high-risk shell/file operations.

## Open Questions
- Which default policy preset should new projects start with?
- What confidence threshold triggers automatic verifier escalation?
- Which memory entries are auto-expired vs user-pinned?
