# Review — reversible-installer F0 (Effect Kernel + file reconciler)

- **Mode:** local (same-model sealed envelope; clean-context agent, anti-framing)
- **Ref/scope:** `86c7278..f92c7c0` (phase diff, code subject: `src/kernel/`, `test/kernel/`, `package.json`)
- **Destructive signal:** false (purely additive — 6 new files + 1-line package.json) → `--mode=local`
- **Files reviewed:** 6 code files (3 src + 3 test) + package.json
- **Counts:** blocker 0, critical 0, major 2, minor 1
- **Final status:** approved with fixes (2 major fixed + verified; 1 minor recorded)
- **Fixes committed at:** `8869e31`

## Findings

| # | Severity | File:line | Finding | Disposition |
|---|---|---|---|---|
| 1 | major | src/kernel/journal.js:1-7 | `readEffects`/`replayReverse` crash on a `null` manifest — `Object.hasOwn(null,…)` throws; `readManifest` returns `null` for a never-installed project. A revert driven off `readManifest()` would crash instead of being a no-op. | **FIXED** — `manifest == null \|\| !Object.hasOwn(...)` guard. Regression test `treats a null manifest (never installed) as an empty journal`. |
| 2 | major | src/kernel/reconciler.js:48,61 | Unsanitized `desired[].path` with a `..` segment escapes `basePath`; `apply` writes / `revert` unlinks outside the install root — breaks the data-safety invariant (P3) for the reusable kernel. | **FIXED** — `resolveWithinBase` containment guard throws on escape, applied in both `apply` and `revert`. Hermetic, mutation-killed regression test `refuses paths that escape basePath on apply and revert`. |
| 3 | minor | src/kernel/reconciler.js:14-23 | `classifyFile` returns `'unchanged'` when all three hashes are `undefined` (`undefined === undefined`). Latent — no production caller passes undefined hashes yet. | **RECORDED**, no fix (minor; no caller). Tracked for the phase that wires the reconciler to real manifest entries. |

## G3 mutation-kill (finding #2 fix)

- Target: `src/kernel/reconciler.js` apply/revert (`resolveWithinBase` → `join`).
- Injected mutation (bypass guard) → `refuses paths that escape basePath` went RED (fail 1/4); reverted → GREEN (4/4); zero `/tmp/escapee.txt` leak (test made hermetic via nested basePath under the afterEach-cleaned tempDir).

## Self-review against code-quality gates

- **G1 read-before-claim:** each fix pasted the cited source lines (journal.js:1-7, reconciler.js:48,61) before editing.
- **G2 soft-language:** fix descriptions/commit scanned for ban list — 0 occurrences.
- **G3 anti-tautology:** both new tests named the mutation that breaks them; #2 verified by an actual inject→RED→revert→GREEN cycle.
- **G4 fixture realism:** N/A — kernel unit tests use in-memory/temp-dir state, no external data fixture.
- **G7 anti-premature-abstraction:** `resolveWithinBase` is one helper for 2 call sites (apply+revert) of the SAME function + its definition; not a speculative abstraction.

## Verification

- `node --test test/kernel/reconciler.test.js` → 4/4 (exit 0)
- `node --test test/kernel/effect.test.js` → 4/4 (exit 0)
- `node --test test/kernel/journal.test.js` → 5/5 (exit 0)
- `npm test` → 834 tests, 820 pass, 2 fail (pre-existing dashboard-bundle prerequisites, identical at parent `850746a`; zero kernel regression).
