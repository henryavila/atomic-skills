# Code Review — deadline-burnup-forecast F0 (phase-done gate)

- **Ref/scope:** `ecf72cf..HEAD` (phase diff, code subset: scripts/ tests/ meta/schemas/ project-transitions.md)
- **Mode:** local (sealed-envelope agent, clean context) — DESTRUCTIVE signal false (additive: 4124 ins / 19 del, no file deletions) ⇒ local per phase-done step 6 (G5)
- **Files reviewed:** 9
- **Passes (local):** 2
- **Counts (local):** blocker: 0, critical: 1, major: 1, minor: 1 → **all fixed**
- **Reviewed at (post-fix):** `7c593f7`

## Findings (all applied)

| # | Finding | Severity | File:line | Action |
|---|---------|----------|-----------|--------|
| 1 | `normalize()` wrote `entry.actuals` verbatim → could persist an append-only line its own schema (`additionalProperties:false`, numeric-only) rejects; phase-done prose feeds arbitrary `<phase aggregate actuals>` straight in | critical | scripts/append-completion.js:78 (pre-fix) | applied — added `normalizeActuals()` (closed numeric keys, finite values) validated BEFORE write |
| 2 | `task-done` event accepted/wrote `taskId: null` — task completion with no task attribution silently valid | major | scripts/append-completion.js:75; meta/schemas/completion-event.schema.json:19-22 (pre-fix) | applied — `normalize` requires non-empty `taskId` for `task-done`; schema `if/then` enforces it; `phase-done`/`reconcile` null taskId still valid |
| 3 | `ts` accepted any non-empty string (no date-time constraint) — unparseable ts frozen immutably | minor | scripts/append-completion.js:70 (pre-fix) | applied — `normalize` rejects a ts that `Date.parse` returns NaN for |

## Verification

- Full F0 suite + adjacent schema/state tests: `node --test tests/append-completion.test.js tests/completion-event-schema.test.js tests/emit-on-transition.test.js tests/transition-emits.test.js tests/aideck-state-schema.test.js` → **35 pass, 0 fail**.
- 7 regression tests added (5 writer in append-completion.test.js, 2 schema if/then in completion-event-schema.test.js).

## Self-review against code-quality gates

- **G1 read-before-claim:** each fix pasted the exact `normalize()` source region before editing (append-completion.js:60-111 re-read post-fix).
- **G2 soft-language:** fix descriptions/commit state what the fix does (validates / requires / rejects); no should/probably/may.
- **G3 anti-tautology:** each new assertion has a breaking mutation — remove the actuals key-check → "unknown actuals field" test stops throwing; remove the taskId guard → "rejects task-done with no taskId" stops throwing; drop the schema `if/then` → "rejects task-done with null taskId" flips `ok` to true; remove the ts guard → "unparseable ts" stops throwing.
- **G4 fixture realism:** fixtures mirror the real `appendCompletion` record shape (the same fields the live `done`/`phase-done` transitions pass); N/A external data.
- **G7 anti-premature-abstraction:** one local helper `normalizeActuals` introduced, used at its single call site for clarity within `normalize` — not a speculative cross-file abstraction.
