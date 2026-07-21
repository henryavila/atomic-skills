# Automate pure-maestro loop (lazy asset)

Consumed by `skills/core/implement.md` when `isAutomateActive`. Full Steps A–I,
claim validation, complex-task review, evaluationGate, and plan-end gates.

Layer-1 STOP helpers (no spawn): `src/automate-orchestrator-gates.js`.
Layer-2 assert CLI: `scripts/assert-automate-gate.js` (must run before C/E/G/I advances).
Layer-2.5 thin **maestro cursor**: `src/maestro-cursor.js` — durable step pointer under `.atomic-skills/status/automate/<slug>.json` (not Layer 4; no spawn adapters).
Realism note: `docs/kb/automate-orchestrator-realism.md`.

### HARD-GATE — assert-automate-gate before C / E / G / I

Before **spawn** (C), **done-batch** (E), **phase-done** (G), or **finalize/archive** (I), run the Layer-2 CLI (or an equivalent `node` invocation of the same script). **Non-zero exit ⇒ STOP** — do not acquire a second lease, do not call `done`, do not run `phase-done`, do not finalize/archive. Print the `blocked:` reason and fix the underlying gate (lease, claim report, `evaluationGate`, plan-end receipt / `userValidatedAt`, **or illegal maestro cursor step**).

```bash
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/assert-automate-gate.js" \
  --plan <slug> --gate spawn|claims|done|phase-done|finalize [options]
```

| Transition | `--gate` | Required extras |
|------------|----------|-----------------|
| Before acquire/spawn (Step **C**) | `spawn` | default `--status-root` = `.atomic-skills/status`; cursor step **C** |
| Before done-batch / claim close (Step **E**) | `claims` or `done` | `--claim-report <path>`; optional `--check-reachability --reachable-file <shas>` after merge; cursor step **E** (claims also allow D\|D.5) |
| Before `phase-done` (Step **G**) | `phase-done` | plan must carry valid `phases[].evaluationGate` under stamp; cursor step **G** |
| Before finalize/archive (Step **I**) | `finalize` | plan-end receipt + `userValidatedAt` under stamp; cursor step **I** |

Exit **0** + stdout `ok` only when the Layer-1 predicate **and** (under stamp) the maestro cursor step allow. Exit **1** + `blocked: <reason>` forbids advancing.

### Maestro cursor — update on every A–I boundary (Layer 2.5)

Durable file: `.atomic-skills/status/automate/<plan-slug>.json` via `src/maestro-cursor.js` (`ensureCursor`, `advanceCursor`, `writeCursorFile`, `readCursorResult`). Shape: `{ step, phaseId, redispatchCount, claimReportPath?, leasePath?, updatedAt }`.

**Required:** on each pure-maestro boundary, advance the cursor with `advanceCursor` / `writeCursorFile` so assert cannot be fooled by a stale step:

| Boundary event | Cursor `step` after update |
|----------------|----------------------------|
| First automate entry / Step **A** load | `ensureCursor` → **A** (or **B** if handoff already ready) — missing file initializes without throw |
| Step **B** handoff + work-order ready | **B** |
| About to assert spawn / enter **C** | **C** (set before `assert-automate-gate --gate spawn`) |
| Writer exited; collecting claims (**D**) | **D** (+ optional `claimReportPath`) |
| Merge settle (**D.5**) | **D.5** |
| Post-merge re-verify / done-batch (**E**) | **E** (before `assert-automate-gate --gate done`) |
| Evaluation agent (**F**) | **F** |
| About to phase-done (**G**) | **G** (before `assert-automate-gate --gate phase-done`) |
| After successful phase-done | **`awaiting-operator-advance`** (pause until operator continue — F4 hardens spawn refuse) |
| Operator continue / next-phase prep (**H**) | **H** |
| Plan-end finalize path (**I**) | **I** (before `assert-automate-gate --gate finalize`) |
| Re-dispatch code-only fix (from E\|F) | **C** via legal redispatch transition (`redispatchCount`++) — max **2** |

**Never** delete the cursor or lease file to force progress. Illegal jumps (e.g. **C→G**, `done` while step is **B**) are rejected by `isLegalTransition` / `cursorAllowsGate` and by assert under stamp. Non-automate plans do not require a cursor.

### Automate mode — pure maestro loop (when `isAutomateActive`)

When `isAutomateActive` is true, **do not** run Mode 1 Step 2 (session codes). After Step 1 hard gates pass, run this spine. Detail for the phase writer contract: `{{READ_TOOL}} skills/shared/implement-phase-writer.md`. Isolation/lease: `{{READ_TOOL}} skills/shared/worktree-isolation.md` + `src/writer-lease.js`. Evaluation order: `{{READ_TOOL}} skills/shared/implement-phase-evaluator.md`.

| Step | Name | Orchestrator action |
|------|------|---------------------|
| **A** | Load phase | Active phase + `businessIntent` + SPEC-admitted pending tasks (Step 1 already hard-gated). |
| **B** | Snapshot handoff → build phase work-order | Write/refresh `## Session handoff` (pre-dispatch checkpoint). Build a **phase work-order** for all pending tasks of **this phase only** (task ids, paths, `scopeBoundary`, `acceptance`, `verifier`). |
| **C** | Spawn phase writer | **HARD-GATE first:** `assert-automate-gate --gate spawn` must exit 0 (`canSpawnPhaseWriter` / lease missing). Then **Acquire writer lease** with exclusive create (`acquireLeaseFile` / `writeLeaseFile` in `src/writer-lease.js` — `wx` / O_EXCL; returns `{ path, secret, lease }`; on-disk stores `tokenHash` only, mode `0o600`; fail if file already present). Hold the **secret** in memory for clear. Cut a **sibling** phase worktree from the git **common-dir** / primary root — **never nest** under `.worktrees/<plan-slug>/…`. Spawn **ONE** code-only **phase writer** with a **constructed brief** (work-order + scoped context — **MUST NOT** include orchestrator chat history). Concurrent phase writers forbidden even if `parallelismAllowed`. |
| **D** | Sync wait → collect claim report | **SYNC WAIT** until the writer exits. Collect the **claim report** (per task: commit SHAs **or** base+head, paths ≥1 for open claims, verifier command + exit + transcript; claimed-pass requires `exitCode === 0`). Parse/validate with `src/claim-report.js` (`parseClaimReport` / `validateClaimReport`) — refuse self-certify; incomplete or overlapping claims do not close tasks. |
| **D.5** | Merge sibling → plan branch | Orchestrator **merges sibling into plan branch before** any task re-verify or `done` (**git-ops only**). Content conflicts ⇒ re-dispatch a code-only fix agent (not hand-edit). Refuse resume mid-merge. Clear writer lease only with the **acquire secret** (`clearLeaseFile(statusRoot, planSlug, secret)` — verifies sha256 against on-disk `tokenHash`; forged public-fields clear fails) after sync-wait + claim collect + **merge settle**. |
| **E** | Post-merge reachability → re-verify → done | **Claim-bound HARD-GATE first:** after D.5 merge settle, prove claim **reachability** on the plan branch, then `assert-automate-gate --gate done --claim-report <path> --check-reachability --reachable-file <shas>` must exit 0 (`canDoneFromAutomateClaims` / `canCloseTasksFromClaims` — claim-bound under durable stamp; missing/invalid/non-reachable claims block). Every claimed SHA and every `base`/`head` must be an ancestor of plan-branch `HEAD` (`git merge-base --is-ancestor <sha> HEAD` exit 0, or `validateClaimReachability`). Reject missing/non-ancestor claims — re-dispatch writer/fix; do not close on a tree that lacks the claimed commits. Then for each claimed task **on the MERGED plan tree only** (**post-merge** re-verify mandatory): re-run verifier (verify-claim / `done` path). Verifier fail ⇒ **do not** `done`; re-dispatch code-only fix agent (max **2**) or stop for operator — **never** silent Mode-1 self-code. **Complex path (below):** if `isComplexTask` after computing `destructiveDiff` from the **validated claim range** → `review-code --mode=both` + `complexTaskAllowsDone` (durable both receipt or operator disposition) before `done`. Non-complex → verifier-only GATE-R2. Only on verifier pass (+ complex review clear + durable receipt when required) → orchestrator `done <task-id>`. Phase writer never `done`. |
| **F** | Evaluation agent | When **all** phase tasks are `done`, spawn a separate **evaluation agent** (fresh context, not the writer) — read-only structured pass/fail vs goal + gates + `businessIntent`. Never edits product source or durable plan state. **Must produce an `evaluationReport` on disk under `.atomic-skills/reviews/`** before any gate stamp; path becomes `evaluationGate.reportPath`. Detail: `{{READ_TOOL}} skills/shared/implement-phase-evaluator.md`. On blocker/critical: reopen affected tasks or blocking follow-ups; re-dispatch code-only fix agent (max **2**); re-run verifiers/complex reviews; re-evaluate. Evaluation pass does **not** finalize or auto phase-done. |
| **G** | phase-done | Fixed order: tasks done → evaluation agent → **persist report** → stamp `phases[].evaluationGate` via `buildEvaluationGate` (authenticity R3: `passed` requires non-empty **`reportPath`**; `skipped` requires **`operatorSkip: true` + non-empty reason** — forge without them is rejected by `evaluationGateHonesty` / `phaseEvaluationAllowsClose` / GATE-R4) / `canRunPhaseDone` → **HARD-GATE:** `assert-automate-gate --gate phase-done` must exit 0 → **then** `phase-done` with `review-code --mode=both` (F2 wires transition default). **Not** `external-both` here — that mode is plan-end only (Step I). Durable decisions log visible for audit. Non-zero assert ⇒ do not run `phase-done`. |
| **H** | Next phase | Re-enter Step A with a new writer (+ later a new evaluator); prior contexts discarded. Concurrent phase writers forbidden. **Materialize is not auto-run:** if the successor is descriptor-only, `phase-done` advance offers `project materialize` (operator fills `businessIntent`); Step A HARD-refuses until initiative exists. Automate executes materialized phases — it does not invent spine. |
| **I** | Plan end | After last phase: plan-end **`review-code --mode=external-both` only** (receipt `mode` must be `external-both` — bare `both` fails `planEndReviewOk`) + legs **codex\|grok\|claude** that are family-different → **`planEndReviewOk`** + **user validates** (`userValidationOk`) via durable stamp gates (`isDurableAutomateActive` / `canFinalizeOrArchive`) → **HARD-GATE:** `assert-automate-gate --gate finalize` must exit 0 → only then finalize/archive. Never auto-archive after last phase green. Non-zero assert ⇒ HARD-BLOCK finalize/archive. |

**Hard rules for the pure maestro path:**

- Session never edits product source (pure maestro).
- One phase writer per phase, **code-only** (forbids `done`, `phase-done`, handoff mutation, any `.atomic-skills/` durable write).
- Never self-certify; never silent Mode-1 fallback under automate.
- Max **2** re-dispatch rounds for verifier/review/evaluator fail, then mandatory operator stop.
- Every routing / skip / re-dispatch / scope-exit / review-severity disposition is written to the durable decisions log / handoff decision log.
- Fixed evaluation order: all phase tasks `done` → **evaluation agent** → **write evaluationReport + stamp authentic `evaluationGate` (`reportPath` / `operatorSkip`)** → `assert-automate-gate --gate phase-done` → phase-done `review-code --mode=both`. Never forge `status: passed` without `reportPath`; never invent `skipped` without operator `operatorSkip`+reason.
- After last phase the **user validates** implementation before finalize/archive (`assert-automate-gate --gate finalize` / `canFinalizeOrArchive` / durable stamp — not session clear alone).
- Pure STOP helpers (layer-1, no spawn): `src/automate-orchestrator-gates.js` (`canSpawnPhaseWriter`, `canCloseTasksFromClaims`, `canDoneFromAutomateClaims` claim-bound done, `canRunPhaseDone`, `canFinalizeOrArchive`) + `complexTaskAllowsDone` in `src/complex-task.js`.
- **Layer-2 assert (required before C/E/G/I):** `scripts/assert-automate-gate.js` — non-zero exit forbids advancing. Step **E** is claim-bound under stamp (`--gate done`).
- **Layer-2.5 maestro cursor:** update on every A–I boundary (`src/maestro-cursor.js`); assert under stamp refuses illegal step; after phase-done prefer step **`awaiting-operator-advance`**; never delete cursor/lease to force progress.

#### Claim report validation (orchestrator, before any `done`) — claim-bound under stamp

Use `src/claim-report.js` as the single machine definition, then Layer-1/2 claim-bound gates:

1. **`parseClaimReport`** → envelope or task list.
2. **`validateClaimReport`** requires per open claim: `taskId`, commit identity (`commitShas[]` non-empty **or** `base`+`head`), `paths[]`, `verifierCommand`, `exitCode` (number or `null`), `transcript` (string; may be empty).
3. **Reject ambiguous overlapping multi-task SHAs:** each task needs an **exclusive** `commitShas` list **or** a `base`+`head` range — a SHA shared across open claims without exclusive base/head is invalid (`findOverlappingClaimShas`). Do not run `review-code` or `done` on an invalid claim set; re-dispatch the writer/fix agent for a clean report.
4. **Post-merge reachability (HARD, after D.5):** for every open claim, prove each `commitShas[]` entry and each `base`/`head` is reachable on the **merged plan branch** (`git merge-base --is-ancestor <sha> HEAD` → 0, or pure helper `validateClaimReachability(report, reachableSet)`). Missing or non-ancestor claims ⇒ refuse verifier/`done`; re-dispatch.
5. **Claim-bound HARD-GATE:** `assert-automate-gate --gate done --claim-report <path>` (+ `--check-reachability` post-merge) / `canDoneFromAutomateClaims` (reachability default true for pure automate done) must exit ok before each orchestrator `done`.
6. Resolve the review pin with `validatedRangeForDone` / `claimRangeFromTask` on the **validated** range only.

#### Complex-task CROSS-MODEL before `done` (automate only)

Predicate: `isComplexTask` from `src/complex-task.js` — `weight >= threshold` (default **3**) OR tags ∩ `{destructive, decommission, drop, complex}` OR **`destructiveDiff === true`**.

Under automate, **before orchestrator `done` on a complex task** (pure helper: `complexTaskAllowsDone`):

1. Compute **`destructiveDiff`** from the **validated claim commit range** (same pin `review-code` will use — DESTRUCTIVE heuristic in `skills/core/review-code.md` over that range). Pass the flag into `isComplexTask({ weight, tags, destructiveDiff })`.
2. If complex → run **`review-code --mode=both`** on that validated range (`resolveReviewRoute` still applies same-family remap).
3. **Severity gate:**
   - **blocker / critical** → **block `done`** until re-dispatch (code-only fix agent, max **2**) or operator disposition recorded in the decisions log.
   - **major** → surface for operator triage; require disposition **`accept` | `defer` | `fix`** recorded before close (do not auto-close majors without a disposition).
4. **Durable receipt:** leave a review receipt / evidence path (under `.atomic-skills/reviews/` when written) with **mode both** linked from the decisions log / handoff **before** `done`, or record operator skip with disposition + reason. `complexTaskAllowsDone` must return `ok` — no receipt + complex required ⇒ do not close.
5. **Non-complex tasks** close with **verifier-only** under existing GATE-R2 (`complexTaskAllowsDone` path `verifier-only`) — no forced per-task cross-model `review-code --mode=both`.

