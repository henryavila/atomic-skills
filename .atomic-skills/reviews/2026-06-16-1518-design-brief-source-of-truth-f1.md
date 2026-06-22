# Review — design-brief-source-of-truth F1 (local adversarial, sealed envelope)

- **Ref reviewed:** `5d8efe9` (F1 implementation commit — `feat(app-map): implement F1 reconstruction pipeline`)
- **Mode:** local (same-model sealed envelope via clean-context agent; no intent leak)
- **Date:** 2026-06-16T15:18Z
- **Files reviewed:** 6 source modules + schema + 5 test suites (fixtures/state excluded as non-code)
- **Verdict:** findings_exist — **1 critical, 4 major, 2 minor** (all runtime-confirmed by the reviewer)

## Findings & disposition

| # | Severity | File:line | Finding | Disposition |
|---|---|---|---|---|
| 1 | critical | `src/app-map/persist.js:62` | `emitCatalog` wrote without `mkdirSync` → ENOENT on first run (target `.atomic-skills/app-map/` absent); masked by injected `writeFile` stub in tests. | **FIXED** — `mkdir = mkdirSync` (after validation), + regression test `emit creates the target dir on a fresh tree` using real `writeFileSync` against `mkdtempSync` dir. |
| 3 | major | `src/app-map/sources.js:161-176` | Heading candidate + an inline prose line naming the SAME page in one doc double-emitted → `diverge` reported a phantom doc-vs-doc conflict (the anti-fatigue regression the feature targets). | **FIXED** — `mergeFileCandidates` folds same-page candidates within ONE file (first-wins per field; cross-source divergence preserved because merge is per-file). Regression test `a page named twice within one doc merges to a single candidate`. |
| 4 | major | `src/app-map/confirm.js:58` | High-risk loop stored `ask(...)` unconditionally; an `undefined` answer → opaque `TypeError: …'choice'` after pages already mutated (batch path was guarded, high-risk was not). | **FIXED** — same descriptive `resolution missing for delta item` guard as the batch path. Regression test `a missing high-risk answer throws a descriptive error, not a TypeError`. |
| 5 | major | `src/app-map/code-scan.js:55-58` | `app/page.tsx` (Next app-router root route) rejected by `name !== 'app'` → home/landing route silently omitted. | **FIXED** — root route maps to id `home`. Regression: brownfield fixture `app/page.tsx` + assertion in `scanCode enumerates …`. |
| 6 | minor | `src/app-map/sources.js` | `Page: ***` → empty page name candidate → pollutes delta / would hard-fail emit (schema `id minLength 1`). | **FIXED** — empty-name candidates filtered in `extractCandidates`. Regression test `an empty page name is dropped`. |
| 7 | minor | `src/app-map/sources.js:43` | `INLINE_NAMED_PAGE` captured the leading article ("The Search page" → "The Search") → key `the-search`, never joins code `search`. | **FIXED** — leading article stripped for inline named pages. Regression test `a leading article is stripped from an inline page name`. |
| 2 | major→**minor (reassessed)** | `src/app-map/diverge.js:~120` | `scanCode` duplicate ids: `diverge` keeps `[0]`, drops the rest. | **NOTED, no fix.** Re-assessed: the dropped page is a *secondary, redundant code-evidence path for the SAME logical page* (e.g. pages-router + app-router of one route), not a distinct page, and not a conflict-resolution choice — so it is not a P2 violation. Existence (`confirmed`/`code-only`) is still correct; only one of two evidence paths for one logical page is cited. Low impact; deferred as a known limitation for F2 (when code-side field mining lands). |

## Verifier after fixes

- Exit-gate G-1: `node --test test/app-map/{sources,code-scan,diverge,confirm,persist}.test.js` → `tests 26, pass 26, fail 0, exit 0`.
- Full app-map suite (incl. F0 schema/validate/validate-state): `tests 36, pass 36, fail 0` — the conditional `0.1→0.2` schema bump kept F0 0.1 valid.

## Self-review against code-quality gates

- **G1 read-before-claim:** for each fix, read the cited `file:line` and confirmed the mechanism before editing (persist.js:62 ENOENT, sources.js:161-176 double-emit, confirm.js:58 unguarded, code-scan.js:55 root reject, sources.js:43 article).
- **G2 soft-language:** fix descriptions state what the fix does (mkdir before write; guard; map root → home; filter empty; strip article; merge per-file). No should/probably/may.
- **G3 anti-tautology:** each regression test names a breaking mutation — drop the `mkdir` → ENOENT (test #1 fails); remove the merge → 2 Billing candidates (test #3 fails); remove the guard → TypeError not the matched message (test #4 fails); revert root→home → `home` absent (test #5); remove empty filter → empty-value candidate present (test #6); keep article → `The Search` present (test #7).
- **G4 fixture realism:** fixtures mirror real conventions (Next app/pages router, Vue view, BMAD/README/ADR doc shapes). `app/page.tsx`, `bmad/overlap.md`, `no-convention/edge.md` are minimal but structurally real.
- **G7 anti-premature-abstraction:** `mergeFileCandidates`/`pageKey` added because the double-emission affects every multi-mention doc (not a 1-off); no speculative helpers introduced.
