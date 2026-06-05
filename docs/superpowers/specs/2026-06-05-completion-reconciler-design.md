# Completion Reconciler — keeping `.atomic-skills/` state in sync with reality

**Status:** Design — awaiting user review
**Date:** 2026-06-05
**Skill:** `atomic-skills:project`
**Sequencing:** Spec 1 of 2. Spec 2 (*Phase-end lessons consolidation*) is **structurally blocked** on this one and is captured as a deferred appendix below.

---

## 1. Context & the validated gap

This work began as a request for a *learning-consolidation* feature: at the end of each phase, consolidate lessons learned; at the start of the next, validate them and revise the plan. Deep research (agentic-reflection literature + decades of human after-action practice — see Appendix C) converged on a clear shape for that feature. But validating it against the **actual** skill surfaced a foundation problem that invalidates it as-is:

> **In practice, phases are not marked done when the work is done.** Implementation happens, tasks stay `pending`/`active`, no command closes them, and the drift is only discovered later — by accident — when the user asks for status and the agent retroactively reconciles. The end-of-phase consolidation hook (`phase-done`) therefore never fires at the right moment.

### What exists today (read from source)

| Mechanism | What it does | Where it breaks |
|---|---|---|
| `hooks/session-start.sh` §5 | "🔔 0 pending tasks but status `active` → run `phase-done`" | Only fires when **all** tasks are already `done`. A task never marked (done in code, still `pending`) never trips it. |
| `hooks/session-start.sh` §6 | Scans commit messages for `[T-NNN]`, cross-refs non-done tasks | Depends on commits **tagging the skill's internal task id** — real implementation commits rarely do → finds nothing. |
| `hooks/stop.sh` "State Reconciliation" | Matches task `outputs[].path` against files written this turn → suggests `done` | Depends on `outputs[].path` being **declared** (optional, rarely filled). Only **suggests** via stderr. |
| Reconciliation gate (pre-mutation, router invariant) | Task `active` AND `lastUpdated` >24h → prompts | Only catches `active`. A `pending` task (done in code, never "started" in the tracker) is invisible. Only runs on a mutating command. |
| `verify` (project-verify.md checks 1–6) | schema, legacy, branch, scope, orphans, aideck | **No check for "done in reality, open in state."** "Stranded active" catches the *inverse*. And `verify` is manual. |

### Root cause

The skill's only contact with reality is the **`verifier`** (shell/test) on tasks and exit criteria — the one place that *observes the world* and produces evidence (GATE-R2 in `project-transitions.md`). But verifiers run **only inside `done` / `phase-done` / `archive`** — commands that require manual invocation. So:

- The reality-observation machinery exists but is **locked behind exactly the commands that don't fire**.
- All completion detection is **passive** (suggests, never asserts), **dependent on optional metadata** (commit tags / `outputs.path`), and **has no forced cadence**.
- The completion model is **write-driven, not verify-driven**: closing a task is a manual step decoupled from doing the work.

**The fix is to invert that relationship:** let verifier evidence *trigger* completion detection — actively, deterministically, and on a cadence that does not depend on the user's memory — while keeping the skill's "never fabricate a pass" invariant intact.

---

## 2. Goal & non-goals

### Goal
Keep `.atomic-skills/` task/phase completion in sync with the repository — **best-effort detection from available signals, plus a mechanism that raises the floor so "available signals" is the normal case, not the exception**. Concretely:
1. Completion drift ("done in code, open in state") is **surfaced deterministically** at every status/verify and session start — never discovered by accident.
2. Open work is **nudged to carry a deterministic completion signal at creation** (Component E), so the no-signal blind spot shrinks to near-zero over a project's life.
3. `phase-done` (and thus, later, lessons consolidation) becomes reliably reachable via the existing auto-transition once tasks close.
4. Nothing is closed without honest evidence (GATE-R2 unchanged).

> **Honest scope boundary (not a guarantee):** a task with **no** verifier, **no** declared `outputs[].path`, and **no** id/path-referencing commit is genuinely undetectable — there is no signal to read. This design does not claim to catch that case; it makes it *rare* (Component E) and *surfaced as a coverage gap* rather than silently missed.

### Non-goals
- **Lessons consolidation** — deferred to Spec 2 (Appendix B).
- **Auto-running every verifier unattended** — verifiers stay behind the intrusive-actions y/N prompt. We make detection active; we do **not** make *closing* unattended.
- **Replacing `verify`/`status`/`done`/`phase-done`** — this extends them, not replaces.
- New schema entities. This spec adds **one script + behavior changes**; no new state files.

---

## 3. Design

Five components, all reusing existing skill patterns (deterministic zero-token detector + gate + the GATE-R2 evidence model), plus the loop-close: **A** detect (read-only), **B** report + a dedicated `reconcile` verb (mutating), **C** hook strengthening, **D** the honesty rule, **E** signal-at-creation.

### Component A — `scripts/detect-completion.js` (deterministic, zero-token)

The single source of "what looks done but isn't marked." Replaces the scattered, brittle heuristics in both hooks with one shared, reliable detector that the hooks and commands all call.

**Input:** defaults to the active initiative of the active project; `--project <project-id>` selects the project (required to disambiguate when `.atomic-skills/projects/` holds more than one — a plan-slug is unique only *within* a project folder, not across the tree); `--slug <slug>` / `--plan <plan-slug>` widen *within* the resolved project; `--json` for machine output. Project resolution is nested-first, the same way the router/hooks already resolve the active project.

**A completion signal is NOT a verifier's existence.** A `verifier:` field is written *before any work starts*; its mere presence says nothing about whether the work is done — it is the **closing mechanism**, used at reconciliation time, never a *detection* signal. Detection keys only on evidence that the deliverable **changed**. Per non-`done` task and per `pending` exit-criterion, classify (strongest first):

| Class | Signal (deterministic, exact) | Strength |
|---|---|---|
| `output-exists` | a path in the entry's structured `outputs[].path` exists on disk **and** has a git-mtime/commit newer than the entry's `lastUpdated`. **Only `outputs[].path`** — never free-text `acceptance[]` prose (unparseable, false-positive prone). | strong |
| `commit-ref` | a commit after the entry's `lastUpdated`/`started` whose message contains the **exact entry id** (e.g. `T-003`) **or** touches an **exact declared `outputs[].path`**. No title-token / substring matching (matches unrelated commits). | heuristic |
| `none` | no signal | not surfaced |

**Output (`--json`):**
```json
{
  "projectId": "<project-id>",
  "initiative": "<slug>",
  "initiativePath": ".atomic-skills/projects/<project-id>/<plan-slug>/phases/f2-<slug>.md",
  "candidates": [
    { "kind": "task", "id": "T-003", "title": "...",
      "evidence": "output-exists", "paths": ["src/x.js"],
      "hasVerifier": true, "verifier": { "kind": "test", "runner": "...", "pattern": "..." } },
    { "kind": "criterion", "id": "C-1", "description": "...",
      "evidence": "commit-ref", "commit": "<sha>", "hasVerifier": false }
  ],
  "drift": true
}
```
Every candidate carries `projectId`, the resolved `initiativePath` (so downstream `status`/`reconcile`/hooks have a safe, unambiguous write target — never a bare slug), and `hasVerifier` (which closing path applies — see Component B). `drift` is `true` iff any candidate exists. Pure read; no mutation. Exits non-zero when `drift` is true (composes into scripts/CI the way `find-missing-summaries.js` does).

**Determinism:** no LLM. The class is computed from frontmatter + filesystem + `git log` only. The detector **never runs a verifier** — running one is intrusive and belongs to the `reconcile` closing path (Component B).

### Component B — detect (read-only) + a dedicated `reconcile` verb (mutating)

Today the drift is discovered at status time *by accident*. We make the **detection** deterministic without breaking the read-only contract of `verify`/`status`, and we put **all mutation** behind one explicit verb.

**Read-only surfaces (NO mutation — preserves existing contracts).** `detect-completion` runs read-only; none of these write state:
- **No-args summary** — prints one extra line when `drift`: `DRIFT  N task(s)/gate(s) look done — run \`reconcile\``. No prompt (keeps the cheap path cheap).
- **`status` (all views: bare / `--terminal` / `--browser`)** — renders the view, and when `drift` appends a non-blocking **offer**: `N item(s) look done — reconcile now? (y/N)`. On `y` it routes to `reconcile`. The view itself never mutates (the y/N is the intrusive-actions gate, consistent with the rest of the skill).
- **`verify`** — stays strictly READ-ONLY per its documented contract (`project-verify.md` §Mutation policy). It gains **check #7 "completion drift"** that only *reports*: `WARN completion: N task(s)/gate(s) look done in the repo but are still open — run \`reconcile\`.` `verify --fix` is **not** extended to reconcile (it remains schema-normalization only).

**`reconcile` (NEW mutating subcommand — the only completion-mutation path).** Subject to the standard pre-mutation gates (migration check, reconciliation gate). It runs `detect-completion`, then for each candidate (batch oldest 4 first, mirroring the existing reconciliation gate) presents a `{{ASK_USER_QUESTION_TOOL}}` whose options are **verifier-aware** (this is what keeps GATE-R2 intact):
  - **Candidate `hasVerifier: true`** → options `Run verifier` / `Still open` / `Skip`. **There is no "mark done" shortcut** — the only close path is running the verifier (existing Verifier execution pattern in `project-transitions.md`), which writes GATE-R2 `evidence` and, on pass, sets the entry `done`/`met`. A failing verifier leaves it open. This is forced by GATE-R2: an entry *with* a `shell`/`test`/`query` verifier cannot become `done`/`met` without passing evidence.
  - **Candidate `hasVerifier: false`** → options `Mark done` / `Still open` / `Skip`. `Mark done` is the manual-acknowledgement path (tasks → the `done <id>` flow incl. auto-transition; criteria → the "no verifier present → manual ack" path → `met`). GATE-R2 does **not** gate verifier-absent entries, so manual ack is valid here.
  - **`Still open`** → bumps `lastUpdated` (acknowledges, resets the signal clock so the same candidate doesn't re-surface immediately).
  - **`Skip`** → no change.

This is the Gawande pause-point applied to completion — but as an explicit verb, so `status`/`verify` keep their read-only semantics and the user is never trapped (every candidate has a valid action for its verifier state).

### Component C — hook strengthening (shared detector, still fail-open)

- **`session-start.sh`** calls `detect-completion` (deterministic) instead of the brittle `[T-NNN]` commit scan (§6) and the all-tasks-done check (§5 stays as a complementary nudge). The session's first context line becomes an accurate *"N tasks look done — run `reconcile`."*
- **`stop.sh`** "State Reconciliation" delegates its candidate-finding to `detect-completion` so it no longer depends solely on its own ad-hoc `outputs[].path` scan.
- **Hooks remain fail-open and non-blocking** (the existing contract): a detector error, missing Node, or malformed state exits 0 / emits nothing. Hooks never run verifiers and never mutate; they only surface the deterministic candidate list.

### Component D — honesty rule (no fabricated closes)

- **Detection never closes anything.** `detect-completion` is read-only; it produces *candidates*, never state changes. Closing happens only inside `reconcile` (Component B), behind the user's per-candidate disposition.
- **An entry with a `shell`/`test`/`query` verifier can reach `done`/`met` only via a real passing run** (GATE-R2 unchanged: `evidence.passed === true`, and for `test` `testsCollected > 0`). The `reconcile` flow enforces this by offering *only* `Run verifier` (no manual shortcut) for `hasVerifier: true` candidates.
- **A verifier-absent entry** closes by manual acknowledgement (GATE-R2 does not gate it). The `output-exists`/`commit-ref` signal is the *reason to ask*, never the close itself.
- Net: the detection signal (changed deliverable) and the close authority (passing verifier *or* explicit human ack) are kept **separate** — which is precisely the conflation the blind review flagged.

### Component E — signal-at-creation (raises the detection floor)

Detection can only see tasks that carry a deterministic signal. To keep the `none` blind spot rare (the honest-scope caveat in §2), every task-creating path **nudges** the author to give the task a detectable close-signal at creation:

- At decompose (`project-create-plan.md` Stage 6) and at `new-task`/`promote`: if a task has neither a `verifier` nor at least one `outputs[].path`, surface a **soft prompt** — *"T-00x has no completion signal (verifier or outputs.path); add one so it can be auto-detected as done?"*. The user may decline (some tasks are genuinely unverifiable) — it is a nudge, not a hard gate.
- A deterministic detector, `node scripts/find-signalless-tasks.js` (zero-token, exits non-zero, lists offenders), makes the gap auditable for backfill — the same pattern as `find-missing-summaries.js`.
- This is the mechanism that turns the §2 goal from "guarantee" (false) into "best-effort with a shrinking blind spot" (honest): over a project's life, signal-less open tasks trend toward zero.

### Loop close → `phase-done` → (later) lessons

No new mechanism: once tasks reliably reach `done`, the **existing** auto-transition in `done` ("last task of `<plan>/<phase>` closed → run `phase-done`?") fires at the right time. That is the hook Spec 2's lessons consolidation will extend. This spec's job is solely to make that moment *reliably reachable*.

---

## 4. Error handling & edge cases

- **Fail-open everywhere a hook calls it.** The session must never be blocked by detector failure.
- **No verifier + no outputs + no commit signal** → `none`; the task is left untouched (we do not guess).
- **`output-exists` false positives** (a file touched for an unrelated reason) → that is exactly why this class is *human-confirmed*, never auto-closed.
- **Blocked tasks** are surfaced as open (a `blocked` task is unfinished work — consistent with `count_pending_tasks` already counting `blocked`).
- **Standalone initiatives** (degenerate 1-phase plans) have no `phase-done`; their reconciliation routes to `archive`'s gate-resolution, which already runs verifiers.
- **Performance:** `detect-completion` is O(open entries); `git log` is bounded (`--since` the oldest open entry's `lastUpdated`, capped at e.g. 50 commits).

---

## 5. Testing strategy

Follows the existing test pattern (`tests/uninstall.test.js`): Node built-in test runner, tmp-dir fixtures, `HOME`/CWD isolation.

- `detect-completion` classes: fixtures with (a) a task whose `outputs[].path` exists+changed → `output-exists`; (b) a task whose exact id appears in a recent commit → `commit-ref`; (c) a task with a `verifier:` but **no changed output and no commit** → `none` (assert verifier presence alone NEVER produces a candidate — the F-001 regression); (d) a task whose only signal is `acceptance[]` prose mentioning a path → `none` (assert prose is not parsed — the F-006 regression). Assert pure-read (no mutation) and non-zero exit on drift.
- Multi-project disambiguation (F-005): two projects with the **same plan-slug**; assert `--project` selects the right one and every candidate carries `projectId` + resolved `initiativePath`; assert bare invocation resolves the *active* project.
- `reconcile` verifier-aware disposition (F-003/F-004): assert a `hasVerifier: true` candidate offers `Run verifier` only (no manual "mark done"); a passing run → `done`/`met` with evidence; a failing run leaves it open. A `hasVerifier: false` candidate offers `Mark done` (manual ack) and closes via the `done` flow. Assert `status`/`verify` themselves perform **no** mutation.
- `verify` check #7 is report-only: drift present → WARN line, **zero state writes**; clean → no finding.
- Hook fail-open: malformed state / missing Node → exit 0, no output, no mutation.
- Component E: `find-signalless-tasks.js` lists a task lacking both `verifier` and `outputs[].path` and exits non-zero; a task with either passes.

---

## 6. Out of scope / future work

- **Spec 2 — Phase-end lessons consolidation** (Appendix B). Build after this ships.
- Rigorous with-memory-vs-without A/B retention evaluation (research-grade; Appendix C) — explicitly deferred.
- **Auto-running verifiers unattended** — `reconcile` always asks before running a verifier (intrusive-actions rule); a fully-automatic close path is out of scope.
- **`kind: query` verifiers as a close path** — deferred-by-design in this repo (no DB connection; see `project-transitions.md`). A `commit-ref`/`output-exists` candidate that *only* has a `query` verifier reconciles via manual ack or `deferred`, never a fabricated row count.

---

## Appendix A — files touched

- **New:** `scripts/detect-completion.js`, `scripts/find-signalless-tasks.js`, `tests/detect-completion.test.js`, `tests/reconcile.test.js`.
- **New `reconcile` subcommand:** add to the router grammar + dispatch table in `skills/core/project.md`; procedure in `skills/shared/project-assets/project-transitions.md` (it mutates task/gate status, so it belongs with the other transition verbs).
- **Modified (skill bodies):** `skills/shared/project-assets/project-view.md` (status surfaces the drift line + read-only y/N offer to run `reconcile`; no-args drift line), `skills/shared/project-assets/project-verify.md` (check #7 — **report-only**, no `--fix` extension), `skills/shared/project-assets/project-create-plan.md` + `project-emergence.md` (Component E signal-at-creation nudge), `skills/core/project.md` (resident note: status/verify *detect & report* completion drift read-only; `reconcile` is the mutation path).
- **Modified (hooks):** `hooks/session-start.sh`, `hooks/stop.sh` (delegate candidate-finding to the shared detector; stay fail-open; never mutate).
- **Unchanged (contracts preserved):** schemas, `validate-state` GATE-R2, `done`/`phase-done` procedures, and `verify`'s read-only mutation policy (`verify --fix` stays schema-normalization only). These are *reached* more reliably, not rewritten.

---

## Appendix B — Spec 2 (deferred): Phase-end lessons consolidation — locked decisions

Preserved so the validated design is not lost. Build as its own spec after Spec 1 ships.

- **Storage:** one lessons file **per initiative**, keyed by the initiative's unique `slug` (anti-collision, inherited from `new initiative`'s duplicate-abort): `.atomic-skills/projects/<project-id>/<plan-slug>/lessons/<initiative-slug>.md`. A directory at plan level — survives phase archival; keeps `plan.md` lean; one file per initiative is the correct grain because the **initiative** (not the phase descriptor) is the unit that produces work, and `split-phase` fans one phase into many initiatives. New `meta/schemas/lesson.schema.json`, validated by `validate-state`.
- **Per-lesson shape:** `statement` + `corrective` (locus + corrective action, per Self-Refine), `scope: local | reusable`, `appliesTo: [<phaseId>...]` (forward refs anchor on **phaseId** — it exists at plan-authoring time, the future initiative's slug does not; `split-phase` rewrites refs), `status: open | closed`, `owner`, `evidence` (link to the source phase's self-review), `confidence` (ExpeL vote: born 2, dies at 0), `validatedAt` (stale-check stamp). `appliesTo: []` = all future phases.
- **Enumeration:** `scripts/list-lessons.js` (deterministic, zero-token) — emits the distilled set of `scope: reusable` + `status: open` lessons whose `appliesTo` matches the phase about to start. Only the distillate reaches the LLM (push-not-pull; no token bloat).
- **Capture (end of phase):** agent **drafts** lessons at `phase-done` from real failure signals (review-code findings, reopened/blocked tasks, deferred gates, the diff, user corrections), presents a `Proposed lessons:` block; user **ratifies/edits/rejects** (the existing ratify-gate pattern). Selective + capped + blameless. Extends the existing `## Self-review against code-quality gates` block.
- **Phase-start gate (enforcement):** **hard gate with explicit, recorded override.** When the next initiative activates, `list-lessons.js` feeds the distillate; each applicable lesson must be dispositioned via `{{ASK_USER_QUESTION_TOOL}}` — **Apply** (→ task/exit-gate; "identified→applied"), **Keep** (revalidated, `validatedAt` stamped), **Stale** (`status: closed` + `staleReason`; CUPMem write-time adjudication), **Reject** (with reason). The phase does not activate until applicable lessons are dispositioned, unless `--skip-lessons` is passed (records `Lessons review: SKIPPED (reason)` — silent skip forbidden, mirroring `--skip-review`).
- **Measurement (deterministic, v1):** `list-lessons.js --stats` → per-plan burndown (`identified/applied/open/closed/stale`, Google-SRE created-vs-closed), **apply-rate** (proxy for captured→learned), **recurrence flag** (`recurrenceOf: L-00x` when a new lesson rhymes with a prior one — high recurrence = learning isn't sticking; this is the user's success criterion made visible). Surfaced on the aiDeck dashboard.

---

## Appendix C — research basis (validated, citable)

Convergent findings from AI-agent and human-process literature; both arrive at the same enforcement rules.

- **Push-not-pull / write-only repos fail:** NASA LLIS (OIG review); a pull model degrades as the corpus grows → surface lessons *into* the next planning step. Knoco "lessons identified ≠ lessons learned" (behavior change is the bar).
- **Gate the next phase on prior-lesson review:** Easy Agile natural experiment — tracking open action items raised completion **40%→65%**. Google SRE: *"an unreviewed postmortem might as well never have existed"*; owner + tracked closure + created-vs-closed burndown.
- **Pause-point forcing function:** Gawande / WHO surgical checklist (−36% complications) — a checklist works at a mandatory pause point (Do-Confirm).
- **Selective admission beats add-all:** experience-following study (arXiv 2505.16067) — storing everything ~3× worse than strict-evaluator admission; success-rate-over-time slope is the signal.
- **Verify-before-store:** Voyager (arXiv 2305.16291) — only verified skills enter the library.
- **Actionable = locus + corrective action:** Self-Refine (arXiv 2303.17651).
- **Vote-based curation against poisoned lessons:** ExpeL (arXiv 2308.10144) — insight born with count 2; upvote/downvote; removed at 0.
- **Stale-belief adjudication at write time:** STALE/CUPMem (arXiv 2605.06527, preprint — flagged) — the *retrieve-vs-act gap* (models retrieve the new fact but still act on the stale premise; Premise Resistance ~30%); fix is write-time Keep/Replace/Archive-stale/Unknown with propagation to dependent beliefs.
- **Failure-triggered verbal reflection in episodic memory:** Reflexion (arXiv 2303.11366); bounded buffer to avoid context bloat.
