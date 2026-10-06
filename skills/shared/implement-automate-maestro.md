# Automate pure-maestro loop (lazy asset)

Consumed by `skills/core/implement.md` when `isAutomateActive`. Full Steps A–I,
claim validation, complex-task review, evaluationGate, and plan-end gates.

**Automate is the default implement path** (F0 — plan `automate-default-and-operator-gates`).
Bare `implement` / no mode flag + no clear → pure-maestro. **Mode 1** requires explicit
`--mode=1` / `mode:1`. Original opt-in-only principle (archived `implementation-automate-mode`
P1) is **superseded**.

**Gate activation rule (session default + stamp — P7 / critic F-001):** any path that runs
pure-maestro under automate-default MUST feed the same activation into machine gates
(`canRunPhaseDone`, `automatePlanEndGatesOk`, assert finalize, present-before-PASS when F1
lands) via durable stamp **and/or** session `automateActive: true` / `isAutomateActive` —
so first-session-before-stamp cannot skip present-before-PASS or intentVsDelivered. Do not
treat "no stamp yet" as Mode 1 or as gate-off.

Layer-1 STOP helpers (no spawn): `src/automate-orchestrator-gates.js`.
Layer-2 assert CLI: `scripts/assert-automate-gate.js` (must run before C/E/G/I advances).
Layer-2.5 thin **maestro cursor**: `src/maestro-cursor.js` — durable step pointer under `.atomic-skills/status/automate/<slug>.json` (not Layer 4; no spawn adapters).
Layer-3 host-local runner: `scripts/automate-phase-run.js` (`prepare` / `validate`) — work-order, lease, sealed brief, claim validate (no Node spawn; no done).
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
| Before done-batch / claim close (Step **E**) | `claims` or `done` | `--claim-report <path>`; **`done` defaults reachability ON** → pass `--reachable-file <shas>` after merge (shape-only pre-merge → `--gate claims`); cursor step **E** (claims also allow D\|D.5) |
| Before `phase-done` (Step **G**) | `phase-done` | plan must carry valid `phases[].evaluationGate` **and** `phases[].deliveryAuditGate` (audit-delivery; never skippable) under stamp; cursor step **G** |
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
| After successful phase-done | **`awaiting-operator-advance`** via `recordPhaseDonePause` / `recordPhaseDonePauseFile`, then the host calls **`clearContinue` in the same turn** (crash-recovery marker; not an operator question) |
| Next-phase prep (**H**) | **H** only after **`clearContinue` / `clearContinueFile`** with token `operator-continue` (host supplies it; do not ask) |
| Plan-end finalize path (**I**) | **I** (before `assert-automate-gate --gate finalize`) |
| Re-dispatch code-only fix (from E\|F) | **C** via legal redispatch transition (`redispatchCount`++) — max **2** without override; over ceiling requires `operatorOverride: { reason, gate? }` (appends `cursor.operatorOverrides[]` — do **not** hand-edit `redispatchCount` down) |

### Operator continue token (post phase-done pause — HARD)

After successful `phase-done` under durable `executionMode: automate`, the cursor **must** sit at **`awaiting-operator-advance`** (`recordPhaseDonePause` from step **G**). While paused:

- `assert-automate-gate --gate spawn` **refuses** (and `cursorAllowsGate` / `cursorAllowsStepA` refuse).
- Pure-maestro **Step A** (load / next-phase re-entry) **refuses** until continue.
- **Do not** auto-materialize the next phase, auto-run multi-phase, or finalize.

**Continue path (host token — generic ok is not enough; no operator question):**

1. In the same turn as a successful phase-done, call `clearContinue(cursor, { continueToken: 'operator-continue' })` **or** `{ operatorContinue: true }` (constant `OPERATOR_CONTINUE_TOKEN` in `src/maestro-cursor.js`) → `clearContinueFile` → step **H**. Do not ask the operator to continue.
2. From **H**: if the successor is descriptor-only, materialize with the **already ratified plan direction** (see phase-start). Then advance to **A**, or **I** at plan-end. Never jump pause → **C**/spawn without `clearContinue`.

**Never** delete the cursor or lease file to force progress. Illegal jumps (e.g. **C→G**, `done` while step is **B**) are rejected by `isLegalTransition` / `cursorAllowsGate` and by assert under stamp. Non-automate plans do not require a cursor and **must not** call `recordPhaseDonePause` (non-automate phase-done unchanged).

### Operator questions — only these (automate)

Every question uses **{{ASK_USER_QUESTION_TOOL}}**. That variable is the harness adapter: Claude Code `AskUserQuestion tool`, Antigravity `ask_question`, Grok Build `ask_user_question`, Codex a plain-text multi-choice prompt. Decline → re-Ask (bounded) or STOP. Do not recover by telling the operator to type a token in chat.

| Question | When | Options |
|----------|------|---------|
| **Plan direction** | No ratified `businessIntent` yet, `find-weak-business-intent` failed, or the draft would change `value` / `outOfScope` / `doneWhen` | Accept draft \| Edit fields then accept \| Reject |
| **Review disposition** | Blocker, critical, or major still open after the fix loop (max 2) | Accept \| Defer \| Fix |
| **Decision-review** | The decision log has a `tradeoff` or `scope-exit` entry | PASS \| FAIL |
| **Plan-end validation** | Last phase, before finalize | Accept delivery \| Reject |

**Host stamps, no question:** `lessonsState` (`recorded` + path, or `none` on a clean phase); `clearContinue` with `operator-continue` in the same turn as phase-done; `decisionReview status=passed` plus `packagePath` when the log has no `tradeoff` or `scope-exit`; `executionMode: automate` on the first automate-default session.

### Automate mode — pure maestro loop (when `isAutomateActive`)

When `isAutomateActive` is true, **do not** run Mode 1 Step 2 (session codes). After Step 1 hard gates pass, run this **host-thin** spine. The host never edits product source and does not run any **product entrypoint** (product diagnostic or app-run class — e.g. `compose`, `build_edl`, app servers, product diagnostics, `npm run dev` style) except **verbatim** task/exit-gate verifier commands. Host shell is an **open allow host class** (not a closed CLI allowlist) — see hard rules below. Detail for the phase writer contract: `{{READ_TOOL}} skills/shared/implement-phase-writer.md`. Isolation/lease: `{{READ_TOOL}} skills/shared/worktree-isolation.md` + `src/writer-lease.js`. Evaluation order: `{{READ_TOOL}} skills/shared/implement-phase-evaluator.md`. **Decision log** (durable append path + operator-only decision-review PASS): `{{READ_TOOL}} skills/shared/implement-decision-log.md` + `src/decision-log.js` (`appendDecision` / `listDecisions`).

#### phase-start package (Step B and Step H)

The phase-start package runs at **Step B** (first spawn) and **Step H** (successor). Order stays **A → B → C → … → G → H**. After **H**, re-enter the work-order (Step B) then **C**.

**Plan direction is one operator question, at the start.** When the plan has **no ratified `businessIntent` yet**, draft `value`, `workflow`, `rules`, `outOfScope`, `doneWhen` and ask with {{ASK_USER_QUESTION_TOOL}}: **Accept draft | Edit fields then accept | Reject**. That ask is the plan direction. It is the same three options on Claude Code, Codex, Antigravity, and Grok Build. **No durable BI write before accept.** A blank form is forbidden. Reject stops; do not spawn.

**Later phases inherit that direction. Do not re-ask** when a ratified spine already exists and the phase draft keeps the same `value`, `outOfScope`, and `doneWhen`. Run `find-weak-business-intent`. **Exit 0 → write that spine and continue.** Exit non-zero, or the draft changes `value`, `outOfScope`, or `doneWhen` → ask again with the same three options. Task titles stay advisory; a durable title rename requires re-spec.

Then, if the phase is descriptor-only, materialize with that spine, build the work-order, acquire the lease, and spawn one fresh phase writer. The host does not edit product source before the spine is accepted (asked once, or inherited).

**Do not reuse** the previous writer's session or pass host chat history. Concurrent phase writers stay forbidden.

**phase-done does not invent a new direction.** Step H drafts from the ratified plan spine. Handoff `nextAction` is one concrete step: `spawn fresh writer` when the spine is inherited, or `await plan-direction accept` only while that question is open.

**Active initiative handoff preservation:** while a phase initiative is active, preserve its `## Session handoff` across task closes until **phase-done** archives/advances — do **not** strip handoff on individual `done` / task close. Orchestrator state owns handoff refresh; phase writers remain code-only and must not mutate handoff.

**Role banner (required):** at Steps **A**, **C**, **D.5**, **E**, **F**, **G**, and **H**, emit a one-line **role banner** stating host-thin maestro (e.g. `ROLE: host-thin pure maestro — dispatch/merge/verify/state only; no product source; no product entrypoint`). Step B runs the package ritual + work-order (no spawn); Step I is plan-end (same host-thin identity; banner optional). The **role banner** is not optional UX — it re-anchors the host before each load-bearing stop.

| Step | Name | Orchestrator action |
|------|------|---------------------|
| **A** | Load phase | Active phase + `businessIntent` + SPEC-admitted pending tasks (Step 1 already hard-gated). |
| **B** | Snapshot handoff → build phase work-order | Write/refresh `## Session handoff` (pre-dispatch checkpoint). Build a **phase work-order** for all pending tasks of **this phase only** (task ids, paths, `scopeBoundary`, `acceptance`, `verifier`). |
| **C** | Spawn phase writer | **HARD-GATE first:** `assert-automate-gate --gate spawn` must exit 0. Then Layer 3 **`automate-phase-run prepare`** (work-order + exclusive lease + sibling WT + sealed brief — never nest under plan WT). Spawn **ONE** code-only **phase writer** with the sealed brief (no host chat history). **Sync-wait** → **`automate-phase-run validate`** before merge. Concurrent phase writers forbidden. **Host product coding under `isAutomateActive` is forbidden**. Full order + Grok recipe: **Step C — runner prepare → spawn → validate** below. |
| **D** | Sync wait → collect claim report | **SYNC WAIT** until the writer exits. Collect the **claim report** (per task: commit SHAs **or** base+head, paths ≥1 for open claims, verifier command + exit + transcript; claimed-pass requires `exitCode === 0`). Parse/validate with `src/claim-report.js` (`parseClaimReport` / `validateClaimReport`) — refuse self-certify; incomplete or overlapping claims do not close tasks. |
| **D.5** | Merge sibling → plan branch | Orchestrator **merges sibling into plan branch before** any task re-verify or `done` (**git-ops only**). Content conflicts ⇒ re-dispatch a code-only fix agent (not hand-edit). Refuse resume mid-merge. Clear writer lease only with the **acquire secret** (`clearLeaseFile(statusRoot, planSlug, secret)` — verifies sha256 against on-disk `tokenHash`; forged public-fields clear fails) after sync-wait + claim collect + **merge settle**. |
| **E** | Post-merge reachability → re-verify → done | **Claim-bound HARD-GATE first:** after D.5 merge settle, prove claim **reachability** on the plan branch, then `assert-automate-gate --gate done --claim-report <path> --check-reachability --reachable-file <shas> [--plan-diff-file <paths> \| --base-ref <prepare-baseRef>]` must exit 0 (`canDoneFromAutomateClaims` / `canCloseTasksFromClaims` — claim-bound under durable stamp; missing/invalid/non-reachable claims block; **plan-tree product fence** fails when product paths on plan branch lack claim path coverage). Every claimed SHA and every `base`/`head` must be an ancestor of plan-branch `HEAD` (`git merge-base --is-ancestor <sha> HEAD` exit 0, or `validateClaimReachability`). Reject missing/non-ancestor claims — re-dispatch writer/fix; do not close on a tree that lacks the claimed commits. **Product fence:** collect `git diff --name-only <baseRef>..HEAD` (baseRef from runner prepare) and pass via `--plan-diff-file` or `--base-ref`; host Mode-1 product commits on the plan branch without claim coverage ⇒ assert done **blocked**. Then for each claimed task **on the MERGED plan tree only** (**post-merge** re-verify mandatory): re-run verifier (verify-claim / `done` path). Verifier fail ⇒ **do not** `done`; re-dispatch code-only fix agent (max **2**) or stop for operator — **never** silent Mode-1 self-code. **Complex path (below):** if `isComplexTask` after computing `destructiveDiff` from the **validated claim range** → `review-code --mode=both` + `complexTaskAllowsDone` (durable both receipt or operator disposition) before `done`. Non-complex → verifier-only GATE-R2. Only on verifier pass (+ complex review clear + durable receipt when required) → orchestrator `done <task-id>`. Phase writer never `done`. |
| **F** | Evaluation agent | When **all** phase tasks are `done`, spawn a separate **evaluation agent** (fresh context, not the writer) — read-only structured pass/fail vs goal + gates + `businessIntent`. Never edits product source or durable plan state. **Must produce an `evaluationReport` on disk under `.atomic-skills/reviews/`** before any gate stamp; path becomes `evaluationGate.reportPath`. Detail: `{{READ_TOOL}} skills/shared/implement-phase-evaluator.md`. On blocker/critical: reopen affected tasks or blocking follow-ups; re-dispatch code-only fix agent (max **2**); re-run verifiers/complex reviews; re-evaluate. Evaluation pass does **not** finalize or auto phase-done. |
| **G** | phase-done | Fixed order (no skip): (1) all phase tasks `done` → (2) evaluation agent → **persist report** → stamp `phases[].evaluationGate` via `buildEvaluationGate` (authenticity R3: `passed` requires non-empty **`reportPath`**; `skipped` requires **`operatorSkip: true` + non-empty reason**) → (3) **Distill lessons** (project-transitions phase-done G1): draft from real failure signals → write `lessons/<initiative-slug>.md` and stamp **`lessonsState: recorded` + `lessonsPath`**, OR stamp **`lessonsState: none`** for a clean phase — **no operator question** (silence is not an answer; the host stamps one of the two) via `buildLessonsState` / `phaseLessonsAllowsClose` → (4) **`review-code --mode=both`** (default under automate) → stamp **`reviewGate`** with `mode: both` (or `both-*` / `external-both`) + `at` + `reviewFile` + **dual-leg authenticity** (`localReceiptPath` + `codexReceiptPath` or `legs[]` with ≥2 **distinct** paths — two legs pointing at the **same** consolidated file fail authenticity; persist each provider's raw output as its own receipt; medium floor: min size, **non-binary**, reject one-line **stub** — `phaseReviewHonesty` / `phaseReviewAuthenticity`); **local** only with non-empty **`overrideReason`**; full skip only with **`operatorSkip: true` + reason** (`phaseReviewAllowsClose`) → (5) **decision-review:** write the package and set `packagePath`. No `tradeoff` or `scope-exit` → stamp `status=passed` + `verifiedAt` + `packagePath` with **no operator question**. A `tradeoff` or `scope-exit` entry → present the body and {{ASK_USER_QUESTION_TOOL}} PASS\|FAIL in the same turn → (6) **`atomic-skills:audit-delivery`** for the phase Intent Package / BI spine → durable report under `.atomic-skills/reviews/` → stamp **`phases[].deliveryAuditGate`** via `buildDeliveryAuditGate` / `deliveryAuditAllowsClose` (`status: passed` + non-empty **`reportPath`** + verdict **`CLOSED\|PARTIAL`** + **`verifiedAt`**; **OPEN never stamps passed**; **no operatorSkip / no status skipped** — skip is illegal; plan-end **`intentVsDelivered` is not a substitute**) → (7) **HARD-GATE:** `assert-automate-gate --gate phase-done` must exit 0 (`canRunPhaseDone` = evaluation **+** lessons **+** review **+** decisionReview **+** `deliveryAuditGate`) → (8) **then** terminal `phase-done` writes. **Phase review mode:** default is **`both`**; `both-*` and **`external-both` also satisfy** `phaseReviewAllowsClose` (stricter multi-provider is OK). **Plan-end** still requires receipt `mode: external-both` (bare `both` fails plan-end). Non-zero assert ⇒ do not run `phase-done`. Skipping distill/ratify/cross-model/decision-review/**audit-delivery** under automate is forbidden. |
| **H** | Next phase | Host **`clearContinue`** with `operator-continue` in the same turn as phase-done → **H**. Do not ask. Then re-enter Step A with a new writer. If the successor is descriptor-only, materialize with the **ratified plan direction** (`find-weak-business-intent` exit 0). Ask again only when that lint fails or `value` / `outOfScope` / `doneWhen` would change. Do not invent a blank spine. |
| **I** | Plan end | After last phase — **fixed order (intent-vs-delivered):** (1) **build surfaces** — `buildIntentSurface` + `buildDeliveredSurface` from plan/initiative + claims/SHAs (`src/plan-end-intent-surface.js`) → (2) **Intent vs delivered brief** into the cross-model context (`buildIntentVsDeliveredBrief` / checklist) → (3) run plan-end **`review-code --mode=external-both` only** (receipt `mode` must be `external-both` — bare `both` fails `planEndReviewOk`) + legs **codex\|grok\|claude** that are family-different (≥1 succeeded) → (4) **stamp receipt** with non-empty **`intentVsDelivered`** rows (`status`: `matched` \| `partial` \| `missing` \| `extra`) + `reviewFile` / `verifiedAt` / legs → (5) **user validates** (`userValidationOk` / `userValidatedAt` — operator-owned; never auto-PASS) via durable stamp gates (`isDurableAutomateActive` / `canFinalizeOrArchive`) → (6) **HARD-GATE:** `assert-automate-gate --gate finalize` must exit 0 → only then finalize/archive. Empty/`missing` `intentVsDelivered` fails `planEndReviewOk` / `automatePlanEndGatesOk` under automate (session default **or** stamp). Skip path under durable automate stays HARD-CLOSED. Plan-end answers **did we build what we planned?** — generic diff review alone does not satisfy **intent-vs-delivered**. Never auto-archive after last phase green. Non-zero assert ⇒ HARD-BLOCK finalize/archive. |
#### Step C — runner prepare → spawn → validate (fixed order)

Under automate, Step C uses the Layer 3 host-local runner. **Order is fixed (HARD):**

1. Advance maestro cursor to **C** (if not already).
2. **`assert-automate-gate --gate spawn`** must exit 0.
3. **`automate-phase-run prepare`** — work-order + lease + sibling WT + sealed brief + spawn instructions.
4. **Host spawn** code-only phase writer (cwd = sibling WT; sealed brief only).
5. **Sync-wait** until writer exits.
6. **`automate-phase-run validate`** — claim report parse/validate (+ optional reachability); print merge commands.
7. Only then D.5 merge → E assert done.

Package-root resolution (same pattern as other scripts in `implement.md`):

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
node "$PKG_ROOT/scripts/automate-phase-run.js" prepare \
  --plan <slug> --phase <phaseId> [--project <id>] \
  --plan-worktree <plan-wt-abs> [--repo-root <repo-root>]
# hold leaseSecret from stdout in memory only — never commit
# read sealedBriefPath; spawn writer with cwd=worktreePath

# after writer exits:
node "$PKG_ROOT/scripts/automate-phase-run.js" validate \
  --claim-report <path> [--plan-branch <plan-branch>] [--writer-branch <branch>] \
  [--check-reachability --reachable-file <shas>]
```

Validate **before** merge/`done`. Non-zero validate ⇒ re-dispatch writer/fix or stop — do not invent claim fields.

**Portable spine (every host):** spawn one **write-capable phase writer** with {{INVESTIGATOR_TOOL}}. cwd = the sibling phase worktree absolute path. Prompt = the sealed brief from prepare (path or full text). No host chat history. Sync-wait, then `automate-phase-run validate`. A read-only explore or research subagent is never this spawn. The four first-class harnesses each add only their argument shape below; the spine above is what remains on every other host.

{{#if ide.claude-code}}
**Claude Code:** call {{INVESTIGATOR_TOOL}} as the write-capable phase writer (product source in the sibling worktree). Do not dispatch a read-only explore subagent for this spawn. cwd = sibling worktree. Prompt = sealed brief. Sync-wait for the claim report.
{{/if}}
{{#if ide.codex}}
**Codex:** call `spawn_agent` as the write-capable phase writer ({{INVESTIGATOR_TOOL}} on this host). cwd = sibling worktree. Prompt = sealed brief. No host chat history. Sync-wait for the claim report. The plan-direction question is the plain-text multi-choice prompt this host already uses for {{ASK_USER_QUESTION_TOOL}}.
{{/if}}
{{#if ide.grok}}
**Grok Build (required tool shape under automate):**

```text
spawn_subagent(
  subagent_type: "general-purpose",   // NOT explore — explore is heavy-reads only
  // isolation / cwd = sibling phase worktree absolute path (never nest under plan WT)
  // prompt / brief = sealed brief from automate-phase-run prepare (path or full text)
  //   (work-order + code-only fence + claim-report shape; NO host chat history)
)
```

Then **sync-wait** until the subagent exits. Collect claim report from the path prepare printed / brief named.

- **`general-purpose`** = phase coding (product source in the sibling worktree).
- **`explore`** = heavy read-only investigation only — never the phase-writer spawn.
- **Host product coding under `isAutomateActive` is forbidden** next to this recipe. Iron Law single-writer-per-worktree applies to the **writer** in the sibling tree; it is **not** permission for the host to Mode-1-code the plan branch while automate is active.
{{/if}}
{{#if ide.antigravity}}
**Antigravity (required tool shape under automate):**

```text
invoke_subagent(
  Subagents: [
    {
      TypeName: "self",               // Full capabilities including write tools & run_command
      Role: "Phase Writer",
      Prompt: "<sealed brief from automate-phase-run prepare (path or full text)>",
      Workspace: "inherit"            // Sibling phase worktree used as cwd
    }
  ]
)
```

Then wait for subagent completion. Collect claim report from the path prepare printed / brief named.

- **`TypeName: "self"`** = phase coding (product source in the sibling worktree).
- **`TypeName: "research"`** = heavy read-only investigation only — never the phase-writer spawn.
- **Host product coding under `isAutomateActive` is forbidden** next to this recipe.
{{/if}}

**Honesty:** skill prose + this recipe make the correct tool call unambiguous; they do **not** process-force spawn. The hard channel is **`scripts/automate-phase-run.js` prepare/validate** + plan-tree product fence on assert done — see `docs/kb/automate-orchestrator-realism.md`.

**Hard rules for the pure maestro path:**

- **Third-party repository.** When unblocking work requires editing a repo that is **not** the active plan's product repo (e.g. this `atomic-skills` package while implementing a plan in another project), the host **must not commit on the checked-out branch**. Create a dedicated branch, or leave the edit uncommitted and return the decision to the operator. Authorization for a *change* is never authorization for a *destination* (dogfood: schema patch landed on `develop` during a foreign-plan session).
- **Host-thin + product entrypoint ban:** under automate the host session never edits product source and never runs a **product entrypoint** for diagnostics or app execution. Policy is **deny product entrypoints + product source edits** — not a closed host-shell allowlist. **Forbidden** examples (outside **verbatim** task/exit-gate verifiers): `compose`, `build_edl`, app servers, product diagnostics CLIs, `npm run dev` / similar app-dev entrypoints, and any product build/run that is not the exact `task.verifier` / exit-gate command text. **Allow host class** (open, illustrative — not exhaustive): plan-branch **git-ops** (merge, worktree add/remove/list, merge-base, status, log, diff, rev-parse, symbolic-ref, explicit-path state microcommits); Atomic Skills **state scripts** (`done` / `phase-done` helpers, refresh-state, validate-state, assert-automate-gate / `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/assert-automate-gate.js"`, decision-log append, **`project-session-todos`**); **Grok session checklist** apply (`todo_write` from the helper payload — **orchestration only**, never close authority / never product edits; phases-only **phase scaffold**, not `T-00N`); **review-code** invocation; and task/exit-gate verifier commands **copied verbatim** from `task.verifier` / exit-gate `verifier.command` (never improvised). Do **not** ban those verbatim verifiers or plan-branch git-ops.
- **Grok phase scaffold reseed (host-thin):** at pure-maestro **start** (Step A after home), after **context compaction**, and whenever write-through closes reseed the board: `refresh-state` → `project-session-todos` → `todo_write` when on Grok. Anchored plan (pickFocus winner) → **`merge: false`** full phase-scaffold replace. Empty focus → skip reseed / no wipe. **anti-proc:** no competing `proc:*` process scaffold while plan-anchored. Claim exclusivity and GATE-R2 unchanged — session todos never close tasks. Contract: `docs/kb/grok-phase-todo-projection.md`.
- **phase-start package order (HARD):** plan direction is asked **once**, when no ratified `businessIntent` exists. Later phases inherit that spine when `find-weak-business-intent` exits 0 and `value` / `outOfScope` / `doneWhen` are unchanged — **do not re-ask**. Blank-fill BI is forbidden. No durable BI write before the first accept. **Session handoff single nextAction** stays mandatory. Preserve the active initiative handoff until phase-done.
- **Role banner** at Steps A, C, D.5, E, F, G, H: one-line host-thin maestro identity before the stop.
- One **fresh phase agent** per phase, **code-only** (forbids `done`, `phase-done`, handoff mutation, any `.atomic-skills/` durable write). Constructed brief only — no host chat history. **Never reuse** the previous phase writer's context after Step H / phase-start.
- Never self-certify; never silent Mode-1 fallback under automate. On product failure under automate, re-dispatch a code-only **fix agent** (max **2**) — the host does not product-debug.
- **decision-review:** write the decision package to disk and set `packagePath`. When the log has **no** `tradeoff` or `scope-exit` entry, stamp `decisionReview status=passed` with `verifiedAt` and that `packagePath` — **no operator question**. When a `tradeoff` or `scope-exit` entry exists, present the package body and ask PASS|FAIL with {{ASK_USER_QUESTION_TOOL}} in the same turn. `decisionReviewAllowsPhaseDone` still fails closed without `packagePresentedAt` or `packagePath`. Evaluation output and review receipts do not replace this stamp.
- **Questions use {{ASK_USER_QUESTION_TOOL}} only** (plan direction, open blocker/critical/major, decision-review when a tradeoff or scope-exit exists, plan-end validation). Decline → re-Ask or STOP. Do not ask the operator to type a token in chat.
- **decision-review FAIL:** stamp `phases[].decisionReview` `{ status: failed, verifiedAt }` and **do not advance** `currentPhase` (no phase-done terminal write until a later operator PASS after fixes).
- Max **2** re-dispatch rounds for verifier/review/evaluator fail, then mandatory operator stop — **unless** the operator supplies a first-class override via `advanceCursor(..., { operatorOverride: { reason, gate? } })`, which is recorded on `cursor.operatorOverrides[]` (audit trail). New work from a **later** gate (evaluation / re-eval / phase review) is the legitimate override case; do **not** mute the ceiling by hand-writing `redispatchCount: 1`.
- Every routing / skip / re-dispatch / scope-exit / review-severity disposition is written to the durable decisions log / handoff decision log.
- Fixed evaluation order: all phase tasks `done` → **evaluation agent** → **write evaluationReport + stamp authentic `evaluationGate` (`reportPath` / `operatorSkip`)** → **distill lessons and stamp `lessonsState` (`recorded`+`lessonsPath` or explicit `none`) with no operator question** → **`review-code --mode=both` + stamp `reviewGate`** → **decision-review** → **`audit-delivery` + stamp `deliveryAuditGate` (`reportPath` + `CLOSED|PARTIAL`; never skippable)** → **`assert-automate-gate --gate phase-done`** → terminal `phase-done` writes. Never assert before review + delivery audit; never forge `status: passed` without `reportPath`; never invent evaluation `skipped` without operator `operatorSkip`+reason; **never skip or operatorSkip `deliveryAuditGate`** (illegal); never omit lessons under automate (silence ≠ zero). Plan-end `intentVsDelivered` ≠ phase `deliveryAuditGate`.
- After last phase: **intent-vs-delivered** first (build surfaces → external-both with Intent vs delivered brief → stamp non-empty `intentVsDelivered`) then the **user validates** implementation (`userValidationOk` / `userValidatedAt` — operator-owned) before finalize/archive (`assert-automate-gate --gate finalize` / `canFinalizeOrArchive` / durable stamp — not session clear alone). Empty `intentVsDelivered` under automate ⇒ HARD-BLOCK finalize. Plan-end inventory is **not** a substitute for per-phase `deliveryAuditGate`.
- Pure STOP helpers (layer-1, no spawn): `src/automate-orchestrator-gates.js` (`canSpawnPhaseWriter`, `canCloseTasksFromClaims`, `canDoneFromAutomateClaims` claim-bound done, `canRunPhaseDone` = evaluation + **lessons** + **deliveryAuditAllowsClose**, `canFinalizeOrArchive`) + `phaseLessonsAllowsClose` / `buildLessonsState` in `src/phase-lessons-gate.js` + `deliveryAuditAllowsClose` / `buildDeliveryAuditGate` in `src/phase-delivery-audit-gate.js` + `complexTaskAllowsDone` in `src/complex-task.js`.
- **Layer-2 assert (required before C/E/G/I):** `scripts/assert-automate-gate.js` — non-zero exit forbids advancing. Step **E** is claim-bound under stamp (`--gate done`).
- **Layer-2.5 maestro cursor:** update on every A–I boundary (`src/maestro-cursor.js`); assert under stamp refuses illegal step; after successful phase-done **`recordPhaseDonePause` → `awaiting-operator-advance`**; Step A / spawn refuse until **`clearContinue` (`operator-continue`)**; never delete cursor/lease to force progress.
- **lastAssert (mutation fence):** `assert-automate-gate --gate done|phase-done` writes `lastAssert: { gate, ok, at }` on the cursor. Before orchestrator mutates task `done` or phase-done terminal state, call **`lastAssertAllows(cursor, 'done'|'phase-done')`** — if ok is false or gate mismatches, **STOP** (do not mark done / do not advance). Forces re-run of assert after every claim/eval change.
- **done complex auto-load:** `assert --gate done` loads the phase initiative and builds `complexTasks` from weight/tags (+ `--complex-receipts` map or `task.reviewReceipt`). Complex without both-mode receipt fails closed.
#### Claim report validation (orchestrator, before any `done`) — claim-bound under stamp

Use `src/claim-report.js` as the single machine definition, then Layer-1/2 claim-bound gates:

1. **`parseClaimReport`** → envelope or task list. **The array key is `tasks`** (canonical). `claims` is accepted as an alias; prefer `tasks` in writer briefs so the host never invents a key the parser drops.
2. **`validateClaimReport`** requires per open claim: `taskId`, commit identity (`commitShas[]` non-empty **or** `base`+`head`), `paths[]`, `verifierCommand`, `exitCode` (number or `null`), `transcript` (string; may be empty).
3. **Reject ambiguous overlapping multi-task SHAs:** each task needs an **exclusive** `commitShas` list **or** a `base`+`head` range — a SHA shared across open claims without exclusive base/head is invalid (`findOverlappingClaimShas`). Do not run `review-code` or `done` on an invalid claim set; re-dispatch the writer/fix agent for a clean report.
4. **Post-merge reachability (HARD, after D.5):** for every open claim, prove each `commitShas[]` entry and each `base`/`head` is reachable on the **merged plan branch** (`git merge-base --is-ancestor <sha> HEAD` → 0, or pure helper `validateClaimReachability(report, reachableSet)`). Missing or non-ancestor claims ⇒ refuse verifier/`done`; re-dispatch.
5. **Claim-bound HARD-GATE:** `assert-automate-gate --gate done --claim-report <path>` (+ `--check-reachability` post-merge) / `canDoneFromAutomateClaims` (reachability default true for pure automate done) must exit ok before each orchestrator `done`.
6. **Plan-tree product fence (HARD under stamp):** under durable stamp, assert `--gate done` **requires** `--plan-diff-file` (paths from `git diff --name-only <baseRef>..HEAD`) **or** `--base-ref` (from runner prepare meta). Omitting both fails closed (`requireProductFence`). Product paths not covered by claim `paths[]` ⇒ assert done fails (`blocked: plan-tree product fence…`). State paths under `.atomic-skills/` do not trip the fence. No chat waiver.
7. Resolve the review pin with `validatedRangeForDone` / `claimRangeFromTask` on the **validated** range only.

#### Complex-task CROSS-MODEL before `done` (automate only)

Predicate: `isComplexTask` from `src/complex-task.js` — `weight >= threshold` (default **3**) OR tags ∩ `{destructive, decommission, drop, complex}` OR **`destructiveDiff === true`**.

Under automate, **before orchestrator `done` on a complex task** (pure helper: `complexTaskAllowsDone`):

1. Compute **`destructiveDiff`** from the **validated claim commit range** (same pin `review-code` will use — DESTRUCTIVE heuristic in `skills/core/review-code.md` over that range). Pass the flag into `isComplexTask({ weight, tags, destructiveDiff })`.
2. If complex → run **`review-code --mode=both`** on that validated range (`resolveReviewRoute` still applies same-family remap).
3. **Severity gate:**
   - **blocker / critical** → **block `done`** until re-dispatch (code-only fix agent, max **2**) or operator disposition recorded in the decisions log.
   - **major** → surface for operator triage; require disposition **`accept` | `defer` | `fix`** recorded before close (do not auto-close majors without a disposition). **Open major findings block phase-done** without that operator token (`majorDispositionAllowsClose` / `canRunPhaseDone`). **Decline ≠ accept:** {{ASK_USER_QUESTION_TOOL}} decline is not disposition accept — re-Ask or STOP; host judgment accept after decline fails the gate.
4. **Durable receipt:** leave a review receipt / evidence path (under `.atomic-skills/reviews/` when written) with **mode both** linked from the decisions log / handoff **before** `done`, or record operator skip with disposition + reason. `complexTaskAllowsDone` must return `ok` — no receipt + complex required ⇒ do not close.
5. **Non-complex tasks** close with **verifier-only** under existing GATE-R2 (`complexTaskAllowsDone` path `verifier-only`) — no forced per-task cross-model `review-code --mode=both`.
