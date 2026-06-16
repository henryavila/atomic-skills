# Review — multiplan-focus-resolution F0 (phase-done)

- **Mode:** local (sealed-context agent), `--mode=local`
- **Range:** `72c7f35..HEAD`, path-limited to the 8 phase deliverables (app-map/design-brief siblings excluded — already reviewed under their own phase-done)
- **Destructive signal:** false (no deletions) → local mode
- **Reviewed at:** HEAD `4304a20` (review run); fixes committed as `a194db1`
- **Verdict:** APPROVED-WITH-FIXES — 1 real logic finding fixed, 1 doc-accuracy finding fixed, minors recorded

## Findings + disposition

| # | Severity | File:line | Claim | Disposition |
|---|----------|-----------|-------|-------------|
| 1 | major | scripts/emit-focus.js:124 | Branch known, but every active plan branched elsewhere → `claimers=[]` (`ambiguous=false`) yet `pool=activePlans` surfaced a foreign-tree plan as focus with no marker. | **FIXED** (a194db1): `pickFocus` returns `{plan:null, unclaimed:true}`; digest emits `plan:null` + `flags.unclaimedBranch`. New test pins it. |
| 2 | major | docs/design/statusline-focus-integration.md (agent cited §1.2/§3.1; real loci lines 62/90-92/117-119) | Doc says focus is "a fase marcada `current:true`"; code selects by branch>unbranched>recency. Agent's line numbers were partly fabricated — substance verified true against the file. | **FIXED** (a194db1): doc rewritten to the tree-relative branch/recency contract + unclaimedBranch/bind. |
| 3 | minor | scripts/emit-focus.js:97 | recency tiebreak is lexicographic `localeCompare` over `lastUpdated`; mixed-precision/offset timestamps can sort wrong. | RECORDED — follow-up. State timestamps are `…Z` by convention; not fixed now. |
| 4 | minor | tests/focus-digest.test.js | `unbranched` claimer arm pinned by a single test. | MITIGATED — new bind/unclaimed tests broaden coverage. |
| 5 | minor | meta/schemas/focus.schema.json | schema description silent on the foreign-tree case. | FIXED indirectly — `unclaimedBranch` description added. |
| 6 | nit | cross-file | verify WARN (unanchored) vs implement degraded no-op framing seam. | RECORDED — cosmetic. |
| 7 | nit | design doc §3.1 | chip pseudocode predates D6 `⧉`. | RECORDED — consumer (claudebar) concern, shipped under T-004. |

## Operator note (G1)

Finding #2 cited section/line numbers that did NOT match the file (the agent hallucinated `§1.2 line 90-92` / a `project_chip()` at `§3.1 lines 209-220`). Verified against the actual file before acting: the *substance* (current:true vs branch/recency) was real at lines 62/90-92/117-119; the *locations* were wrong. Read-before-claim caught it — no fix was applied on a hallucinated locus.

## Fixes applied this session

- `scripts/emit-focus.js` — `pickFocus` unclaimed-branch path; `buildFocusDigest` emits `unclaimedBranch`.
- `scripts/bind-plan-branch.js` (new) — stamp branch onto a plan + re-emit focus.
- `meta/schemas/focus.schema.json` — `flags.unclaimedBranch`.
- `tests/focus-digest.test.js` — 3 new tests (unclaimed, bind round-trip, stampBranch). 11/11 green.
- `docs/design/statusline-focus-integration.md` — focus-selection contract corrected.

### Self-review against code-quality gates

- G1 read-before-claim: each fix pasted/verified against source; finding #2's hallucinated loci rejected, real loci verified.
- G2 soft-language: fix descriptions state behavior (no should/probably).
- G3 anti-tautology: each new assertion names a breaking mutation (drop `...unbranched`; flip `unclaimed` path; reverse recency sort).
- G4 fixture realism: N/A — fixtures are state frontmatter, mirrored from real plan.md shape.
- G7 anti-premature-abstraction: `bindPlanBranch`/`stampBranch` are the single new sites; no speculative helper.
