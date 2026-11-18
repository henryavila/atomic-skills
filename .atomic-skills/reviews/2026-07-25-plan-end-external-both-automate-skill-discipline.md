# Plan-end external-both — automate-skill-discipline

**Mode:** external-both (host=grok → codex family-different; grok same-family skipped; claude not run this session)
**Range:** develop...plan/automate-skill-discipline
**verifiedAt:** 2026-07-25T21:23:36.000Z
**reviewFile:** .atomic-skills/reviews/2026-07-25-plan-end-external-both-automate-skill-discipline.md

## Provider status

| Provider | Status | Notes |
|----------|--------|-------|
| codex | succeeded | `codex review --base develop` (gpt-5.5); 3×P2 + 1×P3 |
| grok | skipped | same-family as host (familyDifferent: false) |
| claude | skipped | not invoked this plan-end; codex leg already family-different success |

## Codex findings (triaged)

| # | Sev | Locus | Disposition |
|---|-----|-------|-------------|
| 1 | P2 | `skills/core/implement.md` (and maestro summary) ordered assert *before* review-code, but `canRunPhaseDone` now requires honest `reviewGate` → deadlock | **FIXED** — review+stamp reviewGate before assert; terminal phase-done last |
| 2 | P2 | `scripts/assert-automate-gate.js` passed `checkReachability: false` when flag omitted, overriding fail-closed default of `canDoneFromAutomateClaims` | **FIXED** — `checkReachability: args.checkReachability !== false`; help + maestro table updated |
| 3 | P2 | `src/phase-review-gate.js` accepted plain `reason` as local override (dogfood fig leaf) | **FIXED** — require non-empty `overrideReason` only; plain `reason` rejected |
| 4 | P3 | `buildEvaluationGate({ status:passed, reportPath })` omitted `verdict: pass` | **FIXED** — default `verdict: pass` when status=passed |

## Residual / non-ship-blocking

- lastAssert write fail-open on FS error (documented; skill still requires `lastAssertAllows`)
- Historical F0–F4 dogfood phases used `reviewGate.mode: local` + `reason` (not `overrideReason`); already closed under dogfood — new closes require overrideReason or both
- Suite: assert-automate-gate + phase-review/evaluation + orchestrator gates green after fixes

## Self-review

- G1 applied — findings cite live file:line from codex + confirmed in tree
- G2 applied — dispositions FIXED only for ship-relevant P2/P3
- Operator user-validation PASS authorized for this plan-end (finalize lifecycle)
