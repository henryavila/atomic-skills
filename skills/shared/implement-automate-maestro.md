# Automate pure-maestro loop (lazy asset)

Consumed by `skills/core/implement.md` when `isAutomateActive`. Full Steps A–I,
claim validation, complex-task review, evaluationGate, and plan-end gates.

Layer-1 STOP helpers (no spawn): `src/automate-orchestrator-gates.js`.
Realism note: `docs/kb/automate-orchestrator-realism.md`.

### Automate mode — pure maestro loop (when `isAutomateActive`)

When `isAutomateActive` is true, **do not** run Mode 1 Step 2 (session codes). After Step 1 hard gates pass, run this **host-thin** spine. The host never edits product source and does not run product diagnostic entrypoints (e.g. `compose`, `build_edl`) except **verbatim** task/exit-gate verifiers. Detail for the phase writer contract: `{{READ_TOOL}} skills/shared/implement-phase-writer.md`. Isolation/lease: `{{READ_TOOL}} skills/shared/worktree-isolation.md` + `src/writer-lease.js`. Evaluation order: `{{READ_TOOL}} skills/shared/implement-phase-evaluator.md`. **Decision log** (durable append path + operator-only decision-review PASS): `{{READ_TOOL}} skills/shared/implement-decision-log.md` + `src/decision-log.js` (`appendDecision` / `listDecisions`).

#### phase-start package (before Step C spawn)

Before acquiring a lease or spawning the phase agent, present a **phase-start package** to the operator:

1. **Phase objective** (from initiative goal / spine).
2. **Task list** — each pending task as **id + title** (and enough context for validate).
3. **Drafted `businessIntent`** — a filled draft of the spine (`value`, `workflow`, `rules`, `outOfScope`, `doneWhen`), never a blank form.

Operator role is **validate-only** for task titles and `businessIntent` (edit allowed, then ratify). **Blank-fill BI** (dumping an empty form for the operator to invent) and **silent auto-PASS** of the drafted package are forbidden. Proceed to spawn only after explicit operator validation (or edited ratification).

| Step | Name | Orchestrator action |
|------|------|---------------------|
| **A** | Load phase | Active phase + `businessIntent` + SPEC-admitted pending tasks (Step 1 already hard-gated). |
| **B** | Snapshot handoff → build phase work-order + phase-start package | Write/refresh `## Session handoff` (pre-dispatch checkpoint). Build a **phase work-order** for all pending tasks of **this phase only** (task ids, paths, `scopeBoundary`, `acceptance`, `verifier`). Present the **phase-start package** (objective + task list id/title + **drafted** `businessIntent`) for operator **validate-only** (edit allowed). Do not spawn until validated. |
| **C** | Spawn phase writer | **Acquire writer lease** with exclusive create (`acquireLeaseFile` / `writeLeaseFile` in `src/writer-lease.js` — `wx` / O_EXCL; returns `{ path, secret, lease }`; on-disk stores `tokenHash` only, mode `0o600`; fail if file already present). Hold the **secret** in memory for clear. Cut a **sibling** phase worktree from the git **common-dir** / primary root — **never nest** under `.worktrees/<plan-slug>/…`. Spawn **ONE fresh phase agent** (code-only **phase writer**) with a **constructed brief** (work-order + scoped context — **MUST NOT** include orchestrator chat history). One fresh agent per phase; concurrent phase writers forbidden even if `parallelismAllowed`. |
| **D** | Sync wait → collect claim report | **SYNC WAIT** until the writer exits. Collect the **claim report** (per task: commit SHAs **or** base+head, paths ≥1 for open claims, verifier command + exit + transcript; claimed-pass requires `exitCode === 0`). Parse/validate with `src/claim-report.js` (`parseClaimReport` / `validateClaimReport`) — refuse self-certify; incomplete or overlapping claims do not close tasks. |
| **D.5** | Merge sibling → plan branch | Orchestrator **merges sibling into plan branch before** any task re-verify or `done` (**git-ops only**). Content conflicts ⇒ re-dispatch a code-only fix agent (not hand-edit). Refuse resume mid-merge. Clear writer lease only with the **acquire secret** (`clearLeaseFile(statusRoot, planSlug, secret)` — verifies sha256 against on-disk `tokenHash`; forged public-fields clear fails) after sync-wait + claim collect + **merge settle**. |
| **E** | Post-merge reachability → re-verify → done | After merge settle, **prove claim reachability on the plan branch** before any verifier/`done`: every claimed SHA and every `base`/`head` must be an ancestor of plan-branch `HEAD` (`git merge-base --is-ancestor <sha> HEAD` exit 0, or `validateClaimReachability` with that reachable set). Reject missing/non-ancestor claims — re-dispatch writer/fix; do not close on a tree that lacks the claimed commits. Then for each claimed task **on the MERGED plan tree only** (**post-merge** re-verify mandatory): re-run verifier (verify-claim / `done` path). Verifier fail ⇒ **do not** `done`; re-dispatch code-only fix agent (max **2**) or stop for operator — **never** silent Mode-1 self-code. **Complex path (below):** if `isComplexTask` after computing `destructiveDiff` from the **validated claim range** → `review-code --mode=both` on that range before `done`. Non-complex → verifier-only GATE-R2. Only on verifier pass (+ complex review clear + durable receipt when required) → orchestrator `done <task-id>`. |
| **F** | Evaluation agent | When **all** phase tasks are `done`, spawn a separate **evaluation agent** (fresh context, not the writer) — read-only structured pass/fail vs goal + gates + `businessIntent`. Never edits product source or project state. Detail: `{{READ_TOOL}} skills/shared/implement-phase-evaluator.md`. On blocker/critical: reopen affected tasks or blocking follow-ups; re-dispatch code-only fix agent (max **2**); re-run verifiers/complex reviews; re-evaluate. |
| **G** | decision-review → phase-done | Fixed order: tasks done → evaluation agent → stamp `phases[].evaluationGate` via `buildEvaluationGate` / `canRunPhaseDone` (**`canRunPhaseDone` = evaluationGate only** — it does **not** assert decision-review; decision-review remains a separate **operator hardgate** until F3 machine-stamps it) → **decision-review** mandatory **manual hardgate** (operator validates agent decisions in the decision log; **agents never write decision-review PASS** — only the **operator PASS** closes the gate; silent auto-PASS forbidden) → **then** `phase-done` with `review-code --mode=both` (F2 wires transition default). **Not** `external-both` here — that mode is plan-end only (Step I). Durable decisions log visible for audit. |
| **H** | Next phase | Re-enter Step A with a **new fresh phase agent** (+ later a new evaluator); prior contexts discarded. Concurrent phase writers forbidden. **Materialize is not auto-run:** if the successor is descriptor-only, `phase-done` advance offers `project materialize` with a **phase-start package** (**drafted** BI for operator **validate-only** — never blank-fill); Step A HARD-refuses until initiative exists. Automate executes materialized phases — it does not invent spine. |
| **I** | Plan end | After last phase: plan-end **`review-code --mode=external-both` only** (receipt `mode` must be `external-both` — bare `both` fails `planEndReviewOk`) + legs **codex\|grok\|claude** that are family-different → **`planEndReviewOk`** + **user validates** (`userValidationOk`) via durable stamp gates (`isDurableAutomateActive` / `canFinalizeOrArchive`) → only then finalize/archive. Never auto-archive after last phase green. |

**Hard rules for the pure maestro path:**

- **Host-thin:** session never edits product source and never runs product diagnostic entrypoints except **verbatim** verifiers (pure maestro).
- **phase-start package** before spawn: phase objective + task list (id + title) + **drafted** `businessIntent`; operator is **validate-only** (edit allowed). Blank-fill BI and silent auto-PASS of the draft are forbidden.
- One **fresh phase agent** per phase, **code-only** (forbids `done`, `phase-done`, handoff mutation, any `.atomic-skills/` durable write). Constructed brief only — no host chat history.
- Never self-certify; never silent Mode-1 fallback under automate.
- **decision-review** is a mandatory **manual hardgate** before `phase-done` under automate. **Agents never write decision-review PASS**; only the **operator PASS** closes it.
- Max **2** re-dispatch rounds for verifier/review/evaluator fail, then mandatory operator stop.
- **Decision log append before continue (HARD):** every **re-dispatch**, **skip**, **review disposition** (`accept`/`defer`/`fix`), **scope-exit**, and **product/eng tradeoff** (behavior change outside pure task text) must append a decision log entry via `appendDecision` (or equivalent durable write to the phase decision-log path) **before** continuing the loop, re-spawning, or closing. Chat / handoff bullets alone do **not** count. Path + shape: `skills/shared/implement-decision-log.md` → `.atomic-skills/projects/<project-id>/<plan-slug>/decisions/<phaseId>.jsonl`. Categories at minimum: `routing`, `tradeoff`, `review-disposition`, `scope-exit`, `manual-gate-delegation`, `env`. Include the decision log path (or resolve it) in the phase work-order / constructed brief so the writer can cite tradeoffs; the **host** owns durable append for routing/skip/disposition/scope-exit/tradeoff under host-thin automate (phase writer remains code-only and must not mutate plan.md status).
- Every routing / skip / re-dispatch / scope-exit / product-tradeoff / review-severity disposition is written to the durable **decision log** (JSONL) and may be summarized in the handoff decision log.
- Fixed evaluation order: all phase tasks `done` → **evaluation agent** → stamp `evaluationGate` (check **`canRunPhaseDone`** — **evaluationGate only**; does **not** cover decision-review) → **decision-review** (operator PASS; separate operator hardgate until F3) → phase-done `review-code --mode=both`.
- After last phase the **user validates** implementation before finalize/archive (`canFinalizeOrArchive` / durable stamp — not session clear alone).
- Pure STOP helpers (layer-1, no spawn): `src/automate-orchestrator-gates.js` (`canSpawnPhaseWriter`, `canCloseTasksFromClaims`, `canRunPhaseDone` = evaluationGate predicate only, `canFinalizeOrArchive`).

#### Claim report validation (orchestrator, before any `done`)

Use `src/claim-report.js` as the single machine definition:

1. **`parseClaimReport`** → envelope or task list.
2. **`validateClaimReport`** requires per open claim: `taskId`, commit identity (`commitShas[]` non-empty **or** `base`+`head`), `paths[]`, `verifierCommand`, `exitCode` (number or `null`), `transcript` (string; may be empty).
3. **Reject ambiguous overlapping multi-task SHAs:** each task needs an **exclusive** `commitShas` list **or** a `base`+`head` range — a SHA shared across open claims without exclusive base/head is invalid (`findOverlappingClaimShas`). Do not run `review-code` or `done` on an invalid claim set; re-dispatch the writer/fix agent for a clean report.
4. **Post-merge reachability (HARD, after D.5):** for every open claim, prove each `commitShas[]` entry and each `base`/`head` is reachable on the **merged plan branch** (`git merge-base --is-ancestor <sha> HEAD` → 0, or pure helper `validateClaimReachability(report, reachableSet)`). Missing or non-ancestor claims ⇒ refuse verifier/`done`; re-dispatch.
5. Resolve the review pin with `validatedRangeForDone` / `claimRangeFromTask` on the **validated** range only.

#### Complex-task CROSS-MODEL before `done` (automate only)

Predicate: `isComplexTask` from `src/complex-task.js` — `weight >= threshold` (default **3**) OR tags ∩ `{destructive, decommission, drop, complex}` OR **`destructiveDiff === true`**.

Under automate, **before orchestrator `done` on a complex task**:

1. Compute **`destructiveDiff`** from the **validated claim commit range** (same pin `review-code` will use — DESTRUCTIVE heuristic in `skills/core/review-code.md` over that range). Pass the flag into `isComplexTask({ weight, tags, destructiveDiff })`.
2. If complex → run **`review-code --mode=both`** on that validated range (`resolveReviewRoute` still applies same-family remap).
3. **Severity gate:**
   - **blocker / critical** → **block `done`** until re-dispatch (code-only fix agent, max **2**) or operator disposition recorded in the **decision log** (`category: review-disposition` or `routing`) **before continuing**.
   - **major** → surface for operator triage; require disposition **`accept` | `defer` | `fix`** recorded as a **decision log** entry **before** close (do not auto-close majors without a disposition).
4. **Durable receipt:** leave a review receipt / evidence path (under `.atomic-skills/reviews/` when written) linked from the decision log (`evidencePath`) / handoff **before** `done`. No receipt + complex required ⇒ do not close.
5. **Non-complex tasks** close with **verifier-only** under existing GATE-R2 — no forced per-task cross-model `review-code --mode=both`.

