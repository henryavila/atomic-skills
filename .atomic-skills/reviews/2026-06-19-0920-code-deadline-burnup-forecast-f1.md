# Code review — deadline-burnup-forecast F1 (closedAt forward-only: auditor soft + emissão)

- **When:** 2026-06-19T09:20Z
- **Mode:** local (sealed-envelope, anti-framing, no intent) — DESTRUCTIVE signal = false (purely additive: +291/-2, the 2 deletions are benign fixture reformatting; no whole-file delete, no schema/data drop) ⇒ cross-model not required (G5).
- **Range:** `0c64ed5..5a735b9` (F1 activation commit → F1 impl HEAD), code files only.
- **Subject:** `scripts/find-unclosed-done.js` (new), `tests/find-unclosed-done.test.js` (new), `scripts/emit-consumer-state.js` (buildState task projection), `tests/emit-consumer-state.test.js`, `meta/schemas/aideck-state.schema.json` (`$defs.tasks`), `assets/aideck-consumer/schema.json` (regenerated bundle).
- **Reviewer:** fresh general-purpose agent, clean context, no intent. Independently ran the tests (18 pass), ran the detector on live data (exit 0), confirmed `build:aideck-schema --check` green, and simulated a stale bundle to prove the new `validateAideckState` assertion is load-bearing.

## Verdict: APPROVED — no blockers

**Counts: 0B / 0C / 0M / 3m** (3 LOW/minor, all advisory).

The implementation is correct and the tests are genuine (no false-greens):
- The archive-exclusion test would genuinely fail if the scan recursed (the offender lives only under `phases/archive/`).
- The whitespace pair (`'  …Z  '` present vs `'   '` absent) actually exercises the `hasText` trim logic, not mere presence.
- The round-trip `validateAideckState` assertion is load-bearing: a stale bundle missing the new props is rejected by `additionalProperties:false` because the emitter always emits them (emitter↔schema sync genuinely tested).

## Findings (all LOW — dispositioned, none block the phase)

### m1 — round-trip fixture never carries a `null` closedAt end-to-end
`tests/emit-consumer-state.test.js:215-220` — the round-trip fixture writes only a task WITH a non-null `closedAt`; the `null` (legacy) projection is never validated through `validateAideckState`. **Disposition: ACCEPTED-AS-IS.** The null projection IS covered by the `buildState` unit test (`:171`, asserts `Object.hasOwn` + `=== null`), and the null value validates fine. Coverage nicety, not a hole. Recorded; not worth shifting the review range for a LOW already covered elsewhere.

### m2 — `closedAt`/`lastUpdated` admitted in `properties` but not added to `tasks.required`
`meta/schemas/aideck-state.schema.json:99-102` (+ bundle) — unlike every other task field, the two new fields are optional in the schema. Harmless today (the emitter always emits them via `?? null`), but a future emitter path that conditionally omitted them would silently pass the gap this feature exists to prevent. **Disposition: DEFERRED TO F4 (lesson recorded).** This is deliberate: F1 keeps closedAt **soft** (principle P3 forward-only); promoting the projection-schema contract to `required` is a hardening step that belongs with F4 (where closedAt is promoted soft→hard at GATE-R2). Applying it now would also (a) overshoot T-003's ratified acceptance ("admite"/allow, not require) and (b) shift the review range for a LOW. Captured as lesson L-001 `appliesTo F4`.

### m3 (design note, not a defect) — archived done-tasks are projected with `closedAt:null` but never flagged by the auditor
The auditor (`find-unclosed-done.js`) excludes `phases/archive/` (non-recursive scan) while the emitter's `readTree` descends into it (`emit-consumer-state.js:96`), so an archived legacy done-task is projected with `closedAt:null` yet never audited. **Disposition: INTENTIONAL & CONSISTENT.** Per the docstring and D2 (forward-only): the auditor measures only the LIVE instrumentation gap; archived legacy is grandfathered and must not drown the signal. The emitter projecting `null` for it is the honest-legacy behavior (P3). No action.

## Self-review against code-quality gates

- **G1 read-before-claim:** each F1 task closed against a verifier run pasted into its evidence; the reviewer independently re-ran the suite (18 pass) + detector + bundle `--check` before this verdict.
- **G2 soft-language:** verdict is evidence-backed (pass counts, exit codes, load-bearing simulation) — no "should/probably/works".
- **G6 reference-or-strike:** every finding carries a verbatim `file:line`.
