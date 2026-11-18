# Review geral — grok-phase-todo-projection

- **When:** 2026-07-25T01:31:50.000Z
- **Range:** develop..20069ee2c1d286b69350643bd05443c5c4d0158e (`4f48fb5a..20069ee2c1d286b69350643bd05443c5c4d0158e`)
- **Modes:** local (explore adversarial) + external codex (`codex review --base develop`)
- **Claude leg:** not run (CLI hang / not used this pass)
- **Product files:** 15 paths, ~2070 LOC product delta

## Verdict (consolidated)

**approve-with-caveats** for product helper/tests core; **fail** if measuring schema-valid committed state + contract/prose alignment as hard ship bar.

| Leg | Counts (approx) | Notes |
|-----|-----------------|-------|
| Local | critical 2, major 5, minor 4, note 3 | Contract vs code precedence; lint presence-only; test gaps |
| Codex | P2×4, P3×1 | Schema invalid plan/state; PROJECT-STATUS stale; phase-done reseed timing; statusline NUL |

## Local — critical / major (must-fix candidates)

| Sev | file:line | Claim |
|-----|-----------|-------|
| critical | docs/kb/grok-phase-todo-projection.md:61-66 | Status precedence in KB is `paused → current/active → done`; code is `paused → done\|archived → current` (`scripts/project-session-todos.js:298-304`) |
| critical | docs/kb/grok-phase-todo-projection.md:64 | KB says current/`active` → in_progress; code only `phase.id === currentPhase` |
| major | scripts/lint-transition-emits.js:130-153 | Presence-only; no order refresh → helper → todo_write |
| major | scripts/lint-transition-emits.js:49-52 | reconcile not required for project-session-todos |
| major | scripts/project-session-todos.js:292-304 | Status from descriptor only; initiative status ignored |
| major | tests/project-session-todos.test.js | Always `branch: null`; no unclaimed/multi-plan branch fixtures |
| major | tests/transition-emits.test.js:395-418 | Order asserted on live prose only, not lint fixtures |

## Codex — P2 / P3 (verified sample)

| Sev | file:line | Claim | Spot-check |
|-----|-----------|-------|------------|
| P2 | plan.md | `validatorId`, `lessonsState` fail schema additionalProperties | **Confirmed** via `validate-state.js plan.md` |
| P2 | archive F1/F4 | `signal: verifier` on tasks fails schema | **Confirmed** |
| P2 | PROJECT-STATUS.md:25 | plan listed active F0 while plan is done F4 | **Confirmed** |
| P2 | project-transitions.md:266 | post-close projection before successor materialize (Mode 1 path) | Open design risk |
| P3 | statusline-focus-integration.md:205 | jq join empties NUL delimiter vs IFS=\\0 reader | Open |

## Cross-validation note

`validate-state` on nested plan also reports missing initiatives for done phases when archive path is not resolved as matching initiative (cross-validation) — separate from additionalProperties failures.

## What looks solid (second pass)

- Archive rollups nested + flat after plan-end-fix
- Empty-focus merge:true no-wipe
- Helper read-only / no session plan.json writes
- SessionStart hint-only
- Core golden tests for labels, paused, counter bump, merge:false winner

## Recommended dispositions

1. **fix (docs):** align Status mapping section with `mapPhaseTodoStatus`
2. **fix (schema/state):** strip or schema-admit `validatorId`, `lessonsState`, `signal`; fix PROJECT-STATUS row
3. **fix or accept:** lint order + reconcile projection requirement
4. **defer/accept:** Mode 1 second reseed after materialize; statusline snippet

## Provider status

- local: succeeded
- codex: succeeded (familyDifferent)
- claude: skipped
- grok: N/A same-family as host for external-both second leg

