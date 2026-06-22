# Review — design-brief-source-of-truth F2 (Integração no design-brief)

- **Date:** 2026-06-16T17:02Z
- **Mode:** local (sealed-envelope agent, clean context, anti-framing directive)
- **Ref/scope:** `dc7a9c3..HEAD` (phase F2 diff, `.atomic-skills/` state excluded)
- **Files reviewed:** 7 (`src/app-map/reconstruct.js`, `scripts/app-map-reconstruct.js`, `skills/core/design-brief.md`, `skills/shared/design-brief-assets/anti-contamination.md`, 3 test files)
- **Destructive signal:** false (additive diff, 655+/5-, no file deletes / schema drops) → `--mode=local`
- **Counts:** blocker=0 critical=0 major=2 minor=3
- **Exit-gate G-1 (deterministic):** `node --test test/app-map/reconstruct.test.js test/app-map/design-brief-step2.test.js test/app-map/design-brief-r2.test.js` → 13/13 pass, exit 0.

## Findings

| # | Severity | File:line | Summary |
|---|---|---|---|
| 1 | major | `src/app-map/reconstruct.js:98-108` | `conflictForField` assigns `artefactValue`/`codeValue` by alphabetical position, source-blind. `scanCode` never emits `audience`/`accessTier`, so every conflict value is a doc value — `codeValue` is a second *artefact* value mislabeled as code. Fabricates a code witness in the persisted `conflicts[]`; undermines P2 (provenance honesty). Fix: derive from each tuple's actual `source` provenance; `codeValue: null` when no code witness. |
| 2 | major | `src/app-map/reconstruct.js:99,103-104` | Conflicts with ≥3 distinct values keep only `values[0]`/`values[1]`; a 3rd candidate is dropped from the structured fields. Operator sees 2 of N → "nunca escolher no silêncio" (P2) defeated for the value fields. Fix: carry the full candidate set (needs a richer conflict descriptor than the 2-slot schema shape). |
| 3 | minor | `scripts/app-map-reconstruct.js:45`; `src/app-map/reconstruct.js:106` | CLI `--persist` recomputes raw pages → `conflictForField` hard-codes `resolution:'pending'`; the `toPageFact` pass-through for agent-resolved pages is unreachable via the CLI. Following the documented "ask then --persist" prose, arbitration is never persisted. The 0.2 `resolution` decision-object is never exercised via CLI. Fix: a CLI channel feeding resolved pages, or document arbitration-persistence as programmatic-only. |
| 4 | minor | `src/app-map/reconstruct.js:119,132`; `src/app-map/persist.js:28` | An agent-injected page lacking `evidence` → `computeEvidenceHash(undefined) === computeEvidenceHash(null)` → multiple such pages collapse to one hash → `reRunDelta` staleness dead. Not reachable via current CLI. Fix: require/recompute `evidence` in the pass-through branch or throw. |
| 5 | minor | `scripts/app-map-reconstruct.js:22-25,31` | `--project-id` as the last arg → `args[i+1]` is `undefined`; guard only rejects `=== ''`, so `undefined` passes → silent `basename(appRoot)` fallback. Fix: reject `projectId === undefined` after the flag. |

## Checklist

- Logic bugs: findings #1/#2/#4. Race conditions: clean (synchronous compute). Error handling: minor (unguarded `JSON.parse` of prior catalog fails loud — acceptable). Schema/migrations: clean (emitted page facts schema-valid; `resolution:'pending'` matches schema oneOf; 0.2 `evidenceHash` required+present). API contracts: F1 module calls use exact shapes; diverge→buildCatalog bridge schema-accepted; evidenceHash stable across re-run. File references: all imports resolve. Test coverage: reconstruct.test.js does NOT cover conflict attribution (#1/#2), arbitration persistence (#3), trailing `--project-id` (#5). Prose tests non-tautological (brownfield/greenfield asserts go RED on R2-source removal).

## Disposition

See phase-done thread. Gate mandate = blocker/critical only (0 of each). Majors `#1/#2` concern the persisted `conflicts[]` provenance, which F2's arbitration delta (inventory / reRunDelta page-ids) does **not** currently consume — latent, not breaking F2 acceptance. Disposition recorded with the operator.
