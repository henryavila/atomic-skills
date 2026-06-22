---
date: 2026-06-17T20:30:00Z
topic: wlf-f4-cross-wt-collision
artifact: a1bdd01..HEAD (scripts/cross-wt-gate.js, tests/cross-wt-gate.test.js, project-finalize.md, project-transitions.md)
skill: review-code
reviewer: gpt-5-codex
codex_version: codex-cli 0.139.0
final_verdict: needs_changes (all findings resolved)
counts_final: {blocker: 0, critical: 0, major: 2, minor: 2, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 2, minor: 1, nit: 0}
framing_delta: {dropped: 0, maintained: 3, emerged: 1}
schema_version: "1.0"
mode: both
---

# Cross-Model Review — wlf-f4-cross-wt-collision (phase-done F4)

Phase F4 review gate (`--mode=both`, lesson-driven: contract/procedure change on an
additive diff per design-brief L-001 / wlf-f1/f2/f3 L-001). Subject = the 4 F4 source
files; `.atomic-skills/` state + generated docs excluded.

## Local review (sealed-envelope, same-model clean context)

verdict: findings_exist · counts: major=2 minor=4 · passes: 2

| # | Severity | File:line | Summary | Resolution |
|---|----------|-----------|---------|------------|
| L1 | major | cross-wt-gate.js:167 + test:179 | OR-guard `hasDetectedFlag \|\| length===0` had no isolating test (the one skip test satisfied both halves) | FIXED — 2 isolating tests added (flag-half precedence + length-half) |
| L2 | major | cross-wt-gate.js:185 + test:227 | `!result` half untested; it alone protected the never-throws contract | FIXED — reclassified (see codex F-003) + test added |
| L3 | minor | transitions.md:290 | doc destructured `{integrationRef,baseRef}` from `resolveBaseRef(...)` without handling its `null` return | FIXED — null-guard guidance documented |
| L4 | minor | finalize.md:108-110 | doc overstated detector genericity ("Java/JS/Python/Go") vs the 3 sources actually parsed | FIXED — claim narrowed; WARN-skip behaviour stated |
| L5 | minor | cross-wt-gate.js:78 | `detectPyproject` matched bare substring `/pytest/` (false-match comment / `pytest-cov`) → spurious BLOCK | FIXED — anchored to `[tool.pytest` or quoted dep token; negative test added |
| L6 | minor | finalize.md:111-119 | documented "fixed order" omitted the 4 `block` outcomes | FIXED — block outcomes listed in the order |

## Pass 1 (blind)

verdict: needs_changes · counts: {blocker: 0, critical: 0, major: 2, minor: 1, nit: 0} · reviewer: gpt-5-codex

- **F-001 [major] error handling — cross-wt-gate.js:148-168** — `crossWtGate` returns `pass` when `mergeProbe()` returns `undefined`/`null`/`{}` (indeterminate non-conflict falls through to command execution). Violates fail-closed. Confidence: high.
- **F-002 [major] API contract — cross-wt-gate.js:133-138** — `crossWtGate(null)` throws `TypeError` (the `= {}` default only covers `undefined`), violating the documented "Never throws" contract. Confidence: high.
- **F-003 [minor] doc correctness — finalize.md:196-203** — Step 4 still said the archive teardown wiring was an "open follow-up" using `isTeardownSafe({ branch, baseRef })`, contradicting the T-003 wiring in transitions.md. Confidence: high.

## Pass 2 (informed)

verdict: needs_changes · counts: {blocker: 0, critical: 0, major: 2, minor: 2, nit: 0} · reviewer: gpt-5-codex

reconciliation: dropped _(none)_ · maintained F-001/F-002/F-003-blind · **emerged F-003-final**.

- **F-001 [major]** — MAINTAINED (fail-closed constraint confirms indeterminate merge must block).
- **F-002 [major]** — MAINTAINED (never-throws constraint confirms `crossWtGate(null)` is a violation).
- **F-003 [minor] error handling — cross-wt-gate.js:184-192 (EMERGED)** — a malformed `runner` result (`undefined`/`null`/no numeric `exitCode`) is misclassified as `project-command-failed` (a real build failure) instead of a blocking indeterminate adapter state. Confidence: medium.
- **F-004 [minor] doc correctness — finalize.md:196-203** — MAINTAINED (stale "open follow-up" vs the now-wired consumer).

## Fixes applied in this session

All findings resolved on the phase branch (single-threaded, post-review):

- **codex F-001 (fail-closed merge)** → `cross-wt-gate.js`: after the conflict check, require an explicit `mergeResult.conflict === false`; any other result → `{ outcome:'error', gate:'block', reason:'merge-indeterminate' }`. Tests: `undefined`/`null`/`{}`/`{conflict:'maybe'}` → block (not pass).
- **codex F-002 (never-throws)** → `cross-wt-gate.js`: `crossWtGate(options = {})` normalizes `null`/non-object to `{}` inside the body before destructuring. Tests: `crossWtGate(null|42|'nope')` → doesNotThrow, `null` → no-op.
- **codex F-003 + local L2 (runner classification)** → `cross-wt-gate.js`: a malformed runner result (`!result || typeof result.exitCode !== 'number'`) → `{ gate:'block', reason:'runner-malformed-result' }`, distinct from a genuine numeric-nonzero `fail`. Test added; the cross-model reconciliation upgraded local L2's "assert fail" to the principled "block".
- **local L1 (OR-guard isolation)** → `cross-wt-gate.test.js`: 2 isolating tests (flag-half precedence with a populated map; length-half with no `detected` key).
- **local L5 (pyproject anchor)** → `cross-wt-gate.js`: `[tool.pytest` config section OR quoted `pytest` dep token `(?![\w-])`; negative tests for comment-mention and `pytest-cov`.
- **local L4 + L6 (finalize doc)** → `project-finalize.md`: genericity claim narrowed to the 3 parsed sources + WARN-skip; the 4 `block` outcomes added to the documented decision order.
- **codex F-003/F-004 (finalize Step 4)** → `project-finalize.md`: Step 4 rewritten — the handoff is wired (both halves), pointing to the archive Step 5 consumer.
- **local L3 (resolveBaseRef null)** → `project-transitions.md`: documented the `null` return path (call `isTeardownSafe({ branch, prIdentity })` → `blocked('indeterminate-base')`, do not destructure null).

Post-fix verification (merged primary): `node --test tests/cross-wt-gate.test.js` → **tests 22, pass 22, fail 0, exit 0**; `grep` anchors + `npm run validate-skills` (All 15 skills valid) exit 0 for both G-2 and the T-003 chain.

## Self-review against code-quality gates

- G1 read-before-claim: each fix pasted/located its source lines before editing (cross-wt-gate.js signature, merge/runner guards, detectPyproject; the two doc Step sections).
- G2 soft-language: fix descriptions state what the fix does; no should/probably/may.
- G3 anti-tautology: each new test names the mutation it kills (drop the fail-closed guard → indeterminate merge passes → test red; drop `!result`/typeof guard → malformed runner reported as fail → test red; revert null-normalize → `crossWtGate(null)` throws → test red; bare `/pytest/` → `pytest-cov` detected → negative test red).
- G4 fixture realism: pyproject fixtures use real TOML shapes (`[tool.pytest.ini_options]`, `dependencies = ["pytest>=7.0"]`, `"pytest-cov"`).
- G7 anti-premature-abstraction: no new helper introduced; fixes are inline in the existing functions.
