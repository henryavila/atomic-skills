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
Guarantee that `.atomic-skills/` task/phase completion stays in sync with the repository, so that:
1. The user never silently accumulates "done in code, open in state" drift.
2. `phase-done` (and thus, later, lessons consolidation) fires at the right moment via the existing auto-transition.
3. Nothing is closed without honest evidence.

### Non-goals
- **Lessons consolidation** — deferred to Spec 2 (Appendix B).
- **Auto-running every verifier unattended** — verifiers stay behind the intrusive-actions y/N prompt. We make detection active; we do **not** make *closing* unattended.
- **Replacing `verify`/`status`/`done`/`phase-done`** — this extends them, not replaces.
- New schema entities. This spec adds **one script + behavior changes**; no new state files.

---

## 3. Design

Four components, all reusing existing skill patterns (deterministic zero-token detector + gate + the GATE-R2 evidence model), plus the loop-close.

### Component A — `scripts/detect-completion.js` (deterministic, zero-token)

The single source of "what looks done but isn't marked." Replaces the scattered, brittle heuristics in both hooks with one shared, reliable detector that the hooks and commands all call.

**Input:** the active initiative file (default), or `--slug <slug>` / `--plan <plan-slug>` to widen; `--json` for machine output.

**Per non-`done` task and per `pending` exit-criterion, classify an evidence class (strongest first):**

| Class | Signal | Strength |
|---|---|---|
| `verifier-available` | the entry has a `shell`/`test` `verifier:` | strongest — running it yields GATE-R2 evidence |
| `output-exists` | `outputs[].path` (or `acceptance[]`-referenced paths) exist on disk **and** changed since the entry's `lastUpdated` | strong heuristic |
| `commit-ref` | a commit since the entry's `lastUpdated`/`started` references the entry (id, output path, or title token) | heuristic |
| `none` | no signal | not surfaced |

**Output (`--json`):**
```json
{
  "initiative": "<slug>",
  "candidates": [
    { "kind": "task", "id": "T-003", "title": "...",
      "evidence": "verifier-available", "verifier": { "kind": "test", "runner": "...", "pattern": "..." } },
    { "kind": "criterion", "id": "C-1", "description": "...",
      "evidence": "output-exists", "paths": ["src/x.js"] }
  ],
  "drift": true
}
```
`drift` is `true` iff any candidate is not `none`. Pure read; no mutation. Exits non-zero when `drift` is true (so it composes into scripts/CI the same way `find-missing-summaries.js` does).

**Determinism:** no LLM. The class is computed from frontmatter + filesystem + `git log` only. The *running* of a `verifier-available` verifier (which is intrusive) is **not** done here — the detector only reports that one is available.

### Component B — completion-reconciliation pause-point (the enforcement)

Today the drift is discovered at status time *by accident*. We make that deterministic.

- **Cadence boundary (respects the cheap path).** The no-args summary stays cheap and non-blocking: it runs `detect-completion` and prints **one extra line** — `DRIFT  N task(s)/gate(s) look done — run \`status\` to reconcile` — and stops. It does **not** prompt. Only the **full `status`** and **`verify`** run the interactive reconciliation below. This preserves the router's "no-args is cheap, does not prompt/open browser" contract.
- **Full `status` and `verify` run `detect-completion` FIRST.** If `drift` is true, they **HALT** before rendering a "green" view and walk the user through a reconciliation prompt — one structured `{{ASK_USER_QUESTION_TOOL}}` per candidate (batch oldest 4 first, mirroring the existing reconciliation gate), options:
  - **Run verifier** (only offered for `verifier-available`) → executes the existing Verifier execution pattern (`project-transitions.md`), writes GATE-R2 `evidence`, and on pass sets the entry `done`/`met`.
  - **Mark done** → closes via the normal `done <id>` flow (incl. auto-transition).
  - **Still open** → bumps `lastUpdated` (acknowledges, resets the signal clock).
  - **Skip** → no change.
- This is the Gawande pause-point applied to completion: it runs **every** status/verify, not by luck.
- **`verify` gains check #7 "completion drift"** so the coherence report names it explicitly:
  `WARN completion: N task(s)/gate(s) look done in the repo but are still open — reconcile before relying on status.`

### Component C — hook strengthening (shared detector, still fail-open)

- **`session-start.sh`** calls `detect-completion` (deterministic) instead of the brittle `[T-NNN]` commit scan (§6) and the all-tasks-done check (§5 stays as a complementary nudge). The session's first context line becomes an accurate *"N tasks look done — run `status` to reconcile."*
- **`stop.sh`** "State Reconciliation" delegates its candidate-finding to `detect-completion` so it no longer depends solely on `outputs[].path`.
- **Hooks remain fail-open and non-blocking** (the existing contract): a detector error, missing Node, or malformed state exits 0 / emits nothing. Hooks never run verifiers (intrusive + slow); they only surface the deterministic candidate list.

### Component D — honesty rule (no fabricated closes)

- An entry is **auto-recordable as done/met only when a deterministic `shell`/`test` verifier passes** (reuses GATE-R2: real run, `evidence.passed === true`, and for `test` `testsCollected > 0`).
- Every other class (`output-exists`, `commit-ref`) is a **human-confirmed candidate** via the intrusive-actions y/N — never auto-closed.
- This is a strict extension of the existing invariant: verifier evidence moves from being only the *gate* of completion to also being the *trigger* of its detection. `validate-state` GATE-R2 is unchanged and still enforces the met-invariant.

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

- `detect-completion`: fixtures with (a) a task carrying a passing `test` verifier, (b) a task with `outputs[].path` that exists+changed, (c) a task referenced by a recent commit, (d) a task with no signal → assert each lands in the right class and `drift` flips correctly. Assert pure-read (no file mutation) and the non-zero exit on drift.
- Honesty rule: assert `output-exists`/`commit-ref` candidates are NEVER auto-closed; only a real passing verifier flips status, and a *failing* verifier leaves it open with failed evidence.
- Hook fail-open: malformed state / missing Node → exit 0, no output.
- `verify` check #7: drift present → WARN line emitted; clean → no finding.

---

## 6. Out of scope / future work

- **Spec 2 — Phase-end lessons consolidation** (Appendix B). Build after this ships.
- Rigorous with-memory-vs-without A/B retention evaluation (research-grade; Appendix C) — explicitly deferred.
- Root-cause *prevention* (nudging every new task to declare a `verifier` or `outputs[].path` so detection always has a deterministic signal) — optional, light, can fold into `new-task`/decompose later.

---

## Appendix A — files touched

- **New:** `scripts/detect-completion.js`, `tests/detect-completion.test.js`.
- **Modified (skill bodies):** `skills/shared/project-assets/project-view.md` (status pause-point), `skills/shared/project-assets/project-verify.md` (check #7), `skills/core/project.md` (resident note that status/verify reconcile completion first).
- **Modified (hooks):** `hooks/session-start.sh`, `hooks/stop.sh` (delegate to the shared detector; stay fail-open).
- **Unchanged:** schemas, `validate-state` GATE-R2, `done`/`phase-done` procedures (they are *reached* more reliably, not rewritten).

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
