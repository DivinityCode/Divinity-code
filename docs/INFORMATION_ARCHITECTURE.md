# UI Information Architecture

## Purpose
This document defines how Builder Mode and Operator Mode expose the shared Task/Run/Preflight model to users. It is the navigation and information hierarchy baseline for CLI, IDE, dashboard, and future web surfaces.

## Principles
- **Objective first:** every surface starts from the task objective, success criteria, repository, policy, budget, and current lifecycle status.
- **Trust before action:** risk, policy, budget, approvals, evidence, and audit state appear before execution controls.
- **One run vocabulary:** CLI JSON, API payloads, dashboard panels, and IDE commands use the same object names and lifecycle states.
- **Operator density:** dashboard views favor scan-friendly queues, compact evidence, and clear intervention controls over marketing-style pages.
- **No hidden side effects:** execution, approval, workspace cleanup, and connector attachment surfaces must show what will be recorded.

## Top-Level Surface Map
| Surface | Primary user | Entry point | Primary objects | Current status |
| --- | --- | --- | --- | --- |
| Builder CLI | Builder | `divinity init`, `divinity run` | Config, Task, Run, Preflight, Artifact | Implemented |
| Builder IDE | Builder | IDE command palette | Task submission, dashboard launch, diagnostics | Scaffolded |
| Control Plane API | Operator, platform administrator | HTTP routes | Run store, approvals, steps, artifacts, audit, observability | Implemented |
| Operator Dashboard | Operator | Static shell or `?api=<base-url>` | Run queue, selected run, approvals, evidence, artifacts | Implemented bootstrap |

## Builder Mode IA
### Primary Navigation
1. **Initialize:** configure policy, budget, and org/project scope.
2. **Run:** submit objective, success criteria, repo context, and optional connector references.
3. **Inspect:** read preflight status, run id, policy pack, events, artifacts, and diagnostics from structured output.
4. **Report:** generate a structured bug report with environment, git, and doctor evidence.

### CLI Command Hierarchy
| Command | Information shown | User decision supported |
| --- | --- | --- |
| `init` | Config path, policy, budget, scope, starter recipes | Confirm local setup and onboarding defaults |
| `run` | Task payload, preflight, status, policy pack, orchestration, activity, memory, artifacts, events | Decide whether the run is safe to continue or needs approval |
| `status` | Current lifecycle status placeholder | Check queued state in the bootstrap CLI |
| `approvals` / `approve` / `reject` | API-backed approval queue and local structured approval decisions | Exercise approval command surface and operator transitions |
| `capabilities` | Policy presets, adapters, isolation profiles, connectors, recipes | Discover supported extension points |
| `recipes` | Starter recipe summaries | Select first-run workflows |
| `doctor` | Local readiness checks | Diagnose setup before deeper work |
| `bug` | GitHub-ready issue body and diagnostics | Report reproducible local failures |

### IDE Command Hierarchy
| Command | Delegates to | Information shown |
| --- | --- | --- |
| Run Divinity Task | CLI `run` | Objective submission and returned run JSON |
| Open Dashboard | Local dashboard surface | Operator Mode visibility from the editor |
| Run Doctor | CLI `doctor` | Local setup diagnostics |

## Operator Mode IA
### Primary Regions
1. **Run Queue:** status filters, approval backlog, risk, budget, and scope summary.
2. **Run Detail:** selected task, success criteria, preflight decision, timeline, evidence, connector references, agent activity, execution records, verification records, artifacts, audit metadata, and workspace state.
3. **Approvals:** approve/reject actions with actor and reason, visible only for approval-required runs.
4. **Observability:** liveness, stale-run indicators, budget utilization, risk mix, failure taxonomy, and org/project rollups.
5. **Artifacts:** patch, log, summary, and PR-summary metadata with retrievable payload routes.

### Dashboard Navigation Model
| User question | Primary panel | Required evidence |
| --- | --- | --- |
| What needs attention? | Run Queue and Approvals | status, risk level, approval-required state |
| Why is this run blocked or waiting? | Preflight and Decision Trace | blocked reasons, warnings, evidence references |
| What changed or will change? | Artifacts | patch/log/summary/PR-summary metadata and payloads |
| Who or what acted? | Agent Activity and Timeline | actor id, action, reason, status, timestamps |
| Did execution actually happen? | Execution and Verification | adapter, exit code, stdout/stderr summaries, verifier checks |
| Is the run still alive? | Liveness and Observability | heartbeat status, latest heartbeat, stale-run buckets |
| What external context is attached? | Connector References | adapter, resource type/id, URL, attach audit event |

## Shared Object Placement
| Object | Builder CLI | API | Dashboard |
| --- | --- | --- | --- |
| Task | `run` output | `POST /tasks`, stored run task | selected run header/detail |
| Success criteria | `task.success_criteria` | stored run task | selected run detail |
| Preflight | `run` output | `/preflight`, stored run preflight | decision panel and timeline |
| Events | `run` output | `/runs/:id/events`, stream | timeline |
| Artifacts | metadata in `run` output | `/runs/:id/artifacts`, `/artifacts/:id` | artifact panel |
| Approvals | `approvals`, `approve`, and `reject` CLI commands | `/approvals`, `/runs/:id/approval` | approval queue and action panel |
| Observability | not primary | `/observability` | observability region |
| Audit | not primary | `/audit` | audit metadata and export affordance |

## First-Click Onboarding Flow
1. Builder runs `divinity init`.
2. Builder reviews starter recipes and chooses a scoped task.
3. Builder runs `divinity run --criteria "..." "objective"`.
4. CLI returns run id, preflight status, risk, budget, and artifacts.
5. If approval is required, Operator opens dashboard and filters approval queue.
6. Operator inspects evidence, approves or rejects, and can export audit history.

## IA Acceptance Criteria
- README links the IA beside product plan, requirements, architecture, backlog, research, and execution plan.
- Product Plan Phase 0 deliverable #3 points to this document.
- Each implemented surface has a documented entry point, primary objects, and supported user decision.
- Dashboard detail hierarchy includes success criteria, evidence, connector references, execution, verification, artifacts, audit, and liveness.
