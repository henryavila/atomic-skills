# Implement --mode=automate: dogfood + deterministic no-skip gates

**When:** 2026-07-21 · plan `automate-skill-discipline` on `plan/automate-skill-discipline`

## Decision

Pure-maestro must fail closed with **machine gates**, not prose alone. Dogfood of multi-phase automate skipped lessons, phase review `both`, and cursor discipline; hardening closed those skips.

## Dogfood skips (what went wrong)

| Skipped step | Symptom |
|--------------|---------|
| Lessons distill/ratify | No `lessons/` files; silence ≠ `lessonsState: none` |
| `review-code --mode=both` | `reviewGate.mode: local` without real both |
| Maestro cursor A–I | Assert done failed with step A forbids E; closes still happened without lastAssert |
| Claim base/head chain | Shared endpoints failed `validateClaimReport` exclusivity |
| Plan-end external-both | Not run until finalize (OK if plan still active) |

## Hardening landed (Layer 1–2.5)

1. **Lessons** — `src/phase-lessons-gate.js`; `canRunPhaseDone` + preflight + assert require `lessonsState: recorded`+`lessonsPath` or `none`
2. **Phase review both** — `src/phase-review-gate.js`; mode both (or local+`overrideReason`, or skip+`operatorSkip`)
3. **Complex done** — `canDoneFromAutomateClaims({ complexTasks })`; assert `--gate done` **auto-loads** initiative via `src/automate-complex-from-initiative.js`
4. **lastAssert** — assert writes `{ gate, ok, at }` on maestro cursor; skill must call `lastAssertAllows` before mutating done/phase-done
5. **Cursor** — spawn/done/phase-done/finalize step match; `awaiting-operator-advance` after phase-done

## Operator rules (future sessions)

- Under automate, **do not hand off materialize** to the user as “you run materialize” — maestro Step H orchestrates (BI still operator authority, can draft from ratified source when mandate is full-plan automate).
- **Never** `git add` `.atomic-skills/status/writer-leases/*.secret` or runtime lease residue.

## Curta F0 dogfood follow-ups (2026-07-27)

Landed after `docs/handoffs/automate-dogfood-curta-f0.md`:

1. `appendDecision` **throws** (fail-loud); `tryAppendDecision` for non-throwing
2. Claim report accepts `claims[]` as alias of `tasks[]`
3. phase-done identity derives from `initiative` when `phase` slice lacks parentPlan/phaseId
4. `validate-state <plan-dir>` collects plan.md + phases + **archive**
5. Maestro `operatorOverrides` for redispatch over `MAX_REDISPATCH=2` (no hand-reset of counter)
6. Hard rule: third-party repo → no commit on checked-out branch
7. Automate successor: **pointer-only** (`pending`), never `active` without initiative
8. Dual-leg receipts must be **distinct** paths; phase may use `external-both`; plan-end still requires it
9. Backup branch `backup/local-lessons-schema-0c9f7288` deleted (`lessonsVerifiedAt` not incorporated)
- Plan finalize still requires `external-both` + `userValidatedAt` (already hard in finalize).
- Assert must run **before** mutating `currentPhase` / terminal state.

## Key paths

- `scripts/assert-automate-gate.js`
- `src/phase-lessons-gate.js`, `src/phase-review-gate.js`, `src/maestro-cursor.js`, `src/automate-complex-from-initiative.js`
- `docs/kb/automate-orchestrator-realism.md`
