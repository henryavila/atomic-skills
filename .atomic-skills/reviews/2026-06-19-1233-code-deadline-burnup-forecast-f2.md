# Code review — F2 (Peso por task: proxy estrutural + rollups)

- **Plan:** deadline-burnup-forecast
- **Phase:** F2
- **Mode:** local (DESTRUCTIVE signal false — 302 ins / 3 del, no whole-file deletion, no schema/data DROP)
- **Range reviewed:** `5d31fc3..f8ad8a8` (base = commit before phase `started` 2026-06-19T11:20:50Z)
- **Reviewed at:** 2026-06-19T12:33:22Z
- **Remediation HEAD:** `ee960c9`
- **Verdict:** APPROVED

## Scope (code only; `.atomic-skills/` rollup backfill out of scope)
meta/schemas/{initiative,aideck-state}.schema.json · assets/aideck-consumer/schema.json (generated) · scripts/{compute-rollups,emit-consumer-state,find-unweighted-tasks}.js · tests/{compute-rollups,emit-consumer-state,find-unweighted-tasks}.test.js · skills/shared/project-assets/project-create-plan.md

## Findings
- **Blockers:** 0
- **Criticals:** 0
- **Majors:** 0
- **Minors:** 2 — BOTH APPLIED (commit `ee960c9`):
  1. `tests/compute-rollups.test.js` — the `weight >= 0` clamp was untested (negative/NaN). → added a case asserting NaN/Infinity/-5 default to 1.
  2. `scripts/compute-rollups.js:36` — `weightOf` let `Infinity` through; `JSON.stringify(Infinity) === "null"` would break the consumer schema's `type: number`. → predicate hardened to `Number.isFinite(t?.weight) && t.weight >= 0`.

## Confirmations (reviewer-run probes)
- `node --test` on the 3 phase test files: 21 pass / 0 fail (pre-remediation). Post-remediation: 20 in the G-1 chain (schema-drift 1 + compute-rollups 4 + emit 15), 0 fail.
- `node scripts/build-aideck-consumer-schema.mjs --check`: up to date, exit 0 — bundle consistent with both source schemas.
- `validateAideckState` round-trip asserts `ok === true` / `errors === []` on a fixture carrying weighted rollups + per-task weights (genuine, not false-green).
- `weightOf` adversarial probe: negative/NaN/±Infinity/string/bool/null/missing → 1; `weight:0` → 0; float 1.5 → 1.5.
- Idempotency: run1 changed, run2/3 no-diff; canonical key order stable.
- Auditor: nested + flat `archive/` skipped; flags absent + non-number weight; accepts `weight:0`; CLI exit 1 missing / 0 clean.
- Backward-compat: no field added to any `required` array; `weight` lives in source schema only (not emitted in the `tasks` projection), rolled up into weightDone/weightTotal.
