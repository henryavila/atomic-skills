---
date: 2026-06-16T07:49:45-03:00
topic: design-brief-source-of-truth-f0
artifact: 4f05a79..b739a81 (F0 phase diff — app-map schema + validator + validate-state wiring)
skill: review-code
reviewer: gpt-5 (codex) + local agent (clean-context)
codex_version: codex-cli 0.139.0
final_verdict: needs_changes → all findings addressed
counts_final: {blocker: 0, critical: 0, major: 3, minor: 3}
counts_blind: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 2, emerged: 0}
mode: both
schema_version: "1.0"
---

# Cross-Model Review — design-brief-source-of-truth F0 (phase-done gate)

Phase F0 (Schema e validação do catálogo app-map). Reviewed range `4f05a79..b739a81`
(code only, `.atomic-skills/` excluded). Mode `both`: local clean-context agent → codex
two-pass sealed envelope on the same captured diff. Destructive-diff signal: **false**
(purely additive, +604/−3, 0 file deletions, 0 drop tokens) — `both` chosen by operator
because the catalog format is an expensive-to-reverse one-way door.

## Local phase (clean-context agent)

verdict: findings_exist — counts: major=1, minor=3

| # | Severity | File:line | Finding | Disposition |
|---|----------|-----------|---------|-------------|
| L-1 | major | `test/app-map/*.test.js` vs `package.json:21` | New tests live in `test/` (singular) but `npm test` globbed `tests/*.test.js` (plural, flat) → F0 tests never ran in CI. | **FIXED** — broadened glob to `'tests/**/*.test.js' 'test/**/*.test.js'` (commit 08b844d). app-map tests now gate. |
| L-2 | minor | `scripts/validate-state.js:231,244,580` | A `.json` catalog whose name ≠ `app-map.json` routes to the markdown validator → misleading "cannot infer kind from path". | RECORDED — edge case (operator pointing at a renamed file). No action. |
| L-3 | minor | `test/app-map/validate-state.test.js:19-49` | EPERM fallback re-implements `main()`'s exit logic → tautological on sandboxed runners. | RECORDED — only the EPERM path is affected; normal CI runs the real script. No action. |
| L-4 | minor | `scripts/validate-state.js:231` | Dir walk skips a symlinked `app-map.json` (`Dirent.isFile()` false) while a direct symlink arg is stat-followed → inconsistent. | RECORDED — edge case; no cycle/perf hazard (symlinked dirs also skipped). No action. |

## Pass 1 (blind) — codex gpt-5

verdict: needs_changes — counts: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}

- **F-001 [major] correctness — app-map.schema.json:10-14** — `schemaVersion` accepts any non-empty string (`"999"` passes). Validate-state can false-green an unsupported contract version. Rec: const/enum the version.
- **F-002 [major] data integrity — app-map.schema.json:29-32** — duplicate `pages[].id` passes (no uniqueness check). Consumers keying by id get an ambiguous IA while validate-state reports valid. Rec: post-schema uniqueness check + test.

## Pass 2 (informed) — codex gpt-5

verdict: needs_changes — counts_final: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
reconciliation: dropped 0, maintained 2 (both refined), emerged 0.

- **F-001 maintained+refined** — recommendation changed `const` → **enum `["0.1"]`** to match the repo convention (`common.schema.json#/$defs/schemaVersion` is an enum, not a const, for version coexistence). Add a test proving `"0.2"`/`"999"` fail.
- **F-002 maintained+refined** — citation moved to `src/app-map/validate.js` (sub-field uniqueness is inexpressible in JSON Schema draft 2020-12 → must be a post-schema code check in the shared validator).

## Fixes applied in this session

- **L-1 (major) FIXED** — `package.json` test glob broadened to gate `test/app-map/` (commit 08b844d). Verified: `npm test` now runs the 8 app-map tests, all pass.
- **F-001 (major) FIXED** — `meta/schemas/app-map.schema.json` `schemaVersion` → `enum ["0.1"]`; negative test `app-map schema rejects an unsupported schemaVersion` added (commit 009a95b). The catalog is otherwise valid in the test, so the assertion has teeth (G3).
- **F-002 (major) FIXED** — `src/app-map/validate.js` `validateAppMap` now runs `duplicatePageIdErrors()` post-schema, returning an Ajv-shaped error (`keyword: duplicatePageId`, `instancePath: /pages/N/id`) so both `assertValidAppMap` and `validateAppMapFile` surface it; test `assertValidAppMap rejects duplicate canonical page ids` added (commit 009a95b). The duplicated page is schema-valid, so the assertion has teeth (G3).
- **L-2/L-3/L-4 (minor)** — recorded, no action (edge cases / sandbox-only path).

Re-verification after fixes (on merged primary `009a95b`):
- F0 exit gate `node --test test/app-map/schema.test.js test/app-map/validate.test.js && npm run validate-state test/fixtures` → 8/8 pass + 1 app-map catalog valid, exit 0.
- `node --test test/app-map/validate-state.test.js` → 2/2.
- `npm test` → 867 tests, 849 pass, 10 fail — all 10 pre-existing/environmental (install/skill-count fail in main repo too; dashboard-bundle fail only in worktree without `dist/dashboard`); **zero app-map failures**.

## Self-review against code-quality gates

- **G1 read-before-claim**: each fix pasted the actual source lines (schemaVersion block, validateAppMap body, package.json test script) before editing; findings verified at file:line.
- **G2 soft-language**: fix descriptions state what the fix does; no should/probably/may.
- **G3 anti-tautology**: both new tests use an otherwise-valid catalog with a single injected defect — removing the enum (F-001) or the uniqueness check (F-002) makes the test fail. Named mutations confirmed.
- **G4 fixture realism**: N/A — fixtures are catalog shapes mirroring the design contract; no external data sampled.
- **G7 anti-premature-abstraction**: one small helper (`duplicatePageIdErrors`) introduced for one concrete check, not speculative.

## Briefings (sealed, anti-framed)

Both passes consumed the byte-identical captured diff `4f05a79..b739a81` (code only). The
codex Pass-1 briefing carried no intent, no mention of the local pass, and the anti-framing
directive; Pass-2 added only externally-verifiable constraints (the repo schemaVersion enum
convention; the draft-2020-12 sub-field-uniqueness limitation) + the Pass-1 output for
reconciliation. Briefing files: `/tmp/codex-briefing-pass1-db-final.md`, `/tmp/codex-briefing-pass2-db-final.md`.
