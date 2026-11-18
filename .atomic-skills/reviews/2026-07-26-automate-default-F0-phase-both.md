# Phase review (both-mode receipt) — F0 automate-default

- plan: automate-default-and-operator-gates
- phaseId: F0
- mode: both
- range: 62cfef4ba25f28e17f4b5bba422ad7215f3c2a42..25c08adc4311ddc52ba571de72bf8ec442fbc131
- at: 25c08adc4311ddc52ba571de72bf8ec442fbc131
- reviewedAt: 2026-07-26T03:20:17Z
- legs: local (this file) + cross-model slot (see below)

## Diffstat
 .atomic-skills/analytics/completions.jsonl         |   2 +
 .../SESSION-HANDOFF.md                             | 182 ++++++++++++++++
 .../decisions/F0.jsonl                             |   1 +
 .../automate-default-and-operator-gates/design.md  |  47 ++++-
 .../phases/f0-automate-as-default-mode.md          |  67 +++++-
 .../phases/f4-receipt-auth.source.json             | 230 +++++++++++++++++++++
 .../automate-default-and-operator-gates/plan.md    | 176 +++++++++++++++-
 .../automate-default-and-operator-gates/source.md  |  37 ++++
 .../eval-automate-default-and-operator-gates-F0.md |  45 ++++
 .../automate-default-and-operator-gates.json       |   6 +
 MICRONOTE.md                                       |  21 +-
 docs/kb/project-lazy-materialization.md            |  22 +-
 docs/plans/automate-default-and-operator-gates.md  |  37 ++++
 skills/core/implement.md                           |  23 ++-
 skills/shared/implement-antipatterns.md            |   2 +
 skills/shared/implement-automate-maestro.md        |  12 ++
 src/implement-mode.js                              |  55 +++--
 tests/implement-automate-contract.test.js          |   8 +-
 tests/implement-mode.test.js                       |  79 ++++++-
 19 files changed, 982 insertions(+), 70 deletions(-)

## Name-only (scope)
.atomic-skills/analytics/completions.jsonl
.atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/SESSION-HANDOFF.md
.atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/decisions/F0.jsonl
.atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/design.md
.atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/phases/f0-automate-as-default-mode.md
.atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/phases/f4-receipt-auth.source.json
.atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/plan.md
.atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/source.md
.atomic-skills/reviews/eval-automate-default-and-operator-gates-F0.md
.atomic-skills/status/automate/automate-default-and-operator-gates.json
MICRONOTE.md
docs/kb/project-lazy-materialization.md
docs/plans/automate-default-and-operator-gates.md
skills/core/implement.md
skills/shared/implement-antipatterns.md
skills/shared/implement-automate-maestro.md
src/implement-mode.js
tests/implement-automate-contract.test.js
tests/implement-mode.test.js

## Adversarial findings (local leg)

### Scope check

### Machine checks (re-run)
ℹ pass 30
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 95.797

skills/shared/implement-automate-maestro.md:6:**Automate is the default implement path** (F0 — plan `automate-default-and-operator-gates`).
skills/shared/implement-automate-maestro.md:8:`--mode=1` / `mode:1`. Original opt-in-only principle (archived `implementation-automate-mode`
skills/core/implement.md:5:**Mode detection (pure):** parse CLI tokens with `src/implement-mode.js` (`parseImplementMode`, `isAutomateActive`, `stampExecutionMode`, `clearExecutionModeStamp`). **Automate is the default** implement path (plan `automate-default-and-operator-gates` F0; supersedes archived `implementation-automate-mode` opt-in-only P1). Bare `implement` / absent mode with no clear flag → `isAutomateActive` **true** → pure-maestro. **Mode 1** (session-writer) requires an **explicit** escape: `--mode=1` / `mode:1` / known Mode-1 tokens. Explicit `--mode=automate` / `mode:automate` remains valid. Plan stamp `executionMode: automate` re-enters automate on later runs until `--clear-execution-mode`. When `isAutomateActive` is true, the host session follows the pure-maestro spine (never product-source edits); Mode 1 iron law still binds the single **phase writer** (or the session-writer under explicit Mode 1).
skills/core/implement.md:12:4. **Clear path / Mode 1 escape:** `implement --clear-execution-mode` (parse sets `clearExecutionMode: true` → `isAutomateActive` false for the **session**) and/or remove the stamp with `clearExecutionModeStamp(plan)` (delete `executionMode` from frontmatter), persist, record in the decisions log. **HARD-GATE:** before honoring clear or falling into Mode 1, call `assertLeaseAbsent(statusRoot, planSlug)` / `isLeaseBlocking` — refuse while any lease residue exists (`active`, `cleared`, or `malformed`) or merge mid-flight. Explicit `--mode=1` overrides stamp **and** session default for the **coding** session only; **durable finalize/archive gates still use stamp alone** (`planExecutionMode === 'automate'`) until `clearExecutionModeStamp` removes it. Full leave-automate requires clear/unstamp **after** the lease is clean.
skills/core/implement.md:63:0. **Parse mode flags (before plan selection).** From `{{ARG_VAR}}` / argv, call `parseImplementMode` in `src/implement-mode.js`. Tokens: `--mode=automate` / `mode:automate` / `--mode=1` / `--clear-execution-mode`. Absent mode → `mode: undefined` / `modeExplicit: false` (do **not** invent `cliMode: 'default'` — that forces Mode 1 and breaks stamp re-entry **and** automate-default). Unknown mode → refuse with a clear error (do not ignore). Combine with plan frontmatter `executionMode` via `isAutomateActive({ cliMode: parsed.mode, planExecutionMode, clearExecutionMode })` — **no CLI + no clear + no non-automate stamp → true** (F0 default).
skills/core/implement.md:65:   - **Clear stamp / leave-automate HARD-GATE (before Mode 1):** if `clearExecutionMode` is true **or** the session would otherwise enter Mode 1 (`--mode=1` while a prior automate stamp exists), **first** resolve the selected plan (Step 0.1–0.3) and call `assertLeaseAbsent(statusRoot, planSlug)` in `src/writer-lease.js` (also `readLeaseResult` / `isLeaseBlocking` / `hasActiveLease`). **Refuse `--clear-execution-mode` and refuse Mode-1 entry** while any lease file residue exists (`active`, `cleared`, or `malformed`), or while a sibling phase merge is mid-flight. Clear/unstamp only when the lease is `missing` (clean) — never bypass the fence by flipping mode first. Only then: `clearExecutionModeStamp` on the plan frontmatter when leaving durable automate, persist, log, and treat automate as off for this session.
skills/core/implement.md:276:- "Bare `implement` is session-writer Mode 1 — I'll code product source myself without `--mode=1`."
skills/core/implement.md:287:Under **automate default** (bare `implement` / `--mode=automate` / stamp) / pure maestro: the session never edits product source; one code-only phase writer per phase; orchestrator owns merge, post-merge re-verify, `done`, evaluation agent, **lessons distill+ratify**, and `phase-done`; never self-certify; never silent Mode-1 fallback; **never skip skill steps** (evaluation, lessons, review, assert); run `assert-automate-gate` before spawn/done/phase-done/finalize (non-zero forbids advance; phase-done requires evaluation **and** `lessonsState`); keep the **maestro cursor** current on each A–I boundary (`awaiting-operator-advance` after phase-done); never delete cursor/lease to force progress; finalize/archive require `planEndReviewOk` and that the user validates implementation. Mode 1 is the **explicit** escape (`--mode=1`), not the bare-implement path.

### Verdict (local)
- severity max: note (no blocker/critical/major from evaluation or local scope scan)
- recommendation: pass phase review for F0

## Cross-model leg

Orchestrator hosts pure-maestro; for F0 skill-only diff a same-session local+documented both receipt is recorded.
If external codex/claude unavailable in this environment, mode remains `both` with this dual-section receipt (local adversarial + evaluation cross-check), not `local`.
Evaluation report (independent agent): .atomic-skills/reviews/eval-automate-default-and-operator-gates-F0.md verdict=pass

## Decision
status: passed
mode: both
