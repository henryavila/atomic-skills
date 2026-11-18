# Evaluation report — brainstorm-hardening F1

**planSlug:** brainstorm-hardening  
**phaseId:** F1  
**phaseTitle:** Expand lint-design and skill docs contract  
**verdict:** pass  
**at:** 090b5d7fac54811950dda0f2eaee60ed5f12d008  
**evaluatedAt:** 2026-07-30T16:51:59Z  
**productCommits:**
- `105990b6` feat(lint-design): require Context, Non-goals, Interview sections
- `ddcc883d` docs(brainstorm): document lint-design required sections
- `d1b21407` feat(brainstorm-hardening): merge F1 phase writer (T-004..T-005)
- `090b5d7f` chore(project): checkpoint brainstorm-hardening F1 T-004 T-005  

**phaseFile:** `.atomic-skills/projects/atomic-skills/brainstorm-hardening/phases/f1-expand-lint-design-and-skill-docs-contr.md`  
**planFile:** `.atomic-skills/projects/atomic-skills/brainstorm-hardening/plan.md`

## Findings

1. **severity:** note · **area:** exit-gate · **gateId:** G-F1-1 · **summary:** `node --test tests/lint-design.test.js` → exit 0; 26 pass / 0 fail / 5 suites / duration_ms ~114. Re-run on evaluator HEAD `090b5d7f` matches task evidence recorded at `d1b21407` (also 26/0).
2. **severity:** note · **area:** product · **path:** `scripts/lint-design.js` · **summary:** `REQUIRED` always includes Context (`/\bcontext\b/`), Non-goals (`/non[-\s]+goals?/`), Interview (`/\binterview\b/`), Decisions (`/\bdecisions?\b/`), Chosen approach (`/chosen[-\s]+approach/`). Blast radius remains `migrationOnly: true`. Empty/placeholder bodies still fail via `hasRealContent` + `PLACEHOLDER_LINE`.
3. **severity:** note · **area:** tests · **path:** `tests/lint-design.test.js` · **summary:** Contract locks missing and empty sections for the three new always-required keys: `RED: missing Context`, `RED: missing Non-goals`, `RED: missing Interview`, `RED: empty Context / Non-goals / Interview bodies fail`. Prior Decisions / Chosen approach / Blast radius coverage retained. GOOD fixture includes all five always-required sections with real content.
4. **severity:** note · **area:** live-contract · **summary:** Evaluator ad-hoc strip of each always-required section produces exact violation strings (`missing required section "Context|Non-goals|Interview|Decisions|Chosen approach".`). Placeholder-only Context/Interview/Non-goals bodies produce `present but empty` violations. Non-migration GOOD doc yields `[]`; migration without Blast radius yields the migration-only violation only.
5. **severity:** note · **area:** docs · **path:** `docs/skills/brainstorm.md` · **summary:** Documents that `lint-design` always requires **Context**, **Non-goals**, **Interview**, **Decisions**, and **Chosen approach** (real content, not empty/TODO); **Blast radius** migration-only. Purpose section repeats the same section set. T-005 shell verifier (`rg` on tests + docs) exit 0.
6. **severity:** note · **area:** product · **path:** `meta/catalog.json`, `meta/catalog.yaml`, `site/dist/skills/brainstorm/index.html` · **summary:** Catalog/generated site surfaces updated in `ddcc883d` / merge `d1b21407` alongside docs — docs contract not left only in free-form markdown.
7. **severity:** note · **area:** scope · **summary:** F1 product file set is `scripts/lint-design.js`, `tests/lint-design.test.js`, `docs/skills/brainstorm.md` (+ catalog/site sync). No `scripts/design-gates.js`, no `scripts/assert-creation-stage.js`, no `scripts/find-missing-design-process.js`, no `scripts/find-weak-design.js`, no `skills/shared/project-assets/new-plan/stage-6.md`. `scripts/lint-source.js` untouched in F1 commit range. No `projects/**/design.md` mass-edit in product commits `105990b6` / `ddcc883d`.
8. **severity:** note · **area:** rules · **summary:** Decisions and Chosen approach remain always-required. Blast radius stays migration-only (`migrationOnly: true`; tests prove non-migration ignores it and migration enforces it). No design-gates or creation-stage logic in lint-design.js or its tests.
9. **severity:** note · **area:** skill-prose lag · **path:** `skills/core/brainstorm.md` · **summary:** Body still says sections are mandatory "and expanding toward Interview / Context / Non-goals as required" while listing those sections under "Plus, for a usable design". That parenthetical is stale relative to F1 (`REQUIRED` already enforces them). Not a G-F1-1 failure (T-005 scoped docs to `docs/skills/brainstorm.md`); residual prose debt for a follow-up edit, not a contract hole.
10. **severity:** note · **area:** tests · **path:** `tests/lint-design.test.js` L79–87 · **summary:** Test name/comment says "five always-required violations" while asserting `v.length === 4` (Context present; four missing). Assertion is correct; wording is off by one. Non-blocking.

## businessIntentCheck

| Field | Result | Evidence |
|-------|--------|----------|
| **value** | pass | lint-design rejects designs missing Context, Non-goals, or Interview; also rejects empty/placeholder bodies under those headings. Tests + live strip/empty checks confirm. |
| **workflow** | pass | T-004 expanded `REQUIRED` + tests (status done, shell evidence exit 0 at `d1b21407`). T-005 fixture coverage + `docs/skills/brainstorm.md` (status done, `rg` verifier exit 0). Merge commit `d1b21407` lands both. |
| **rules** | pass | No design-gates/creation-stage logic. No lint-source SPEC change. No mass-edit of historical `projects/*/design.md`. Decisions + Chosen approach remain always-required. Blast radius migration-only. |
| **outOfScope** | pass | F2 artifacts absent on disk: design-gates scripts, assert-creation-stage, stage-N split (`new-plan/stage-6.md` missing), Stage 8 review-plan rewrite not in F1 diffs. |
| **doneWhen** | pass | G-F1-1 green: suite rejects missing Interview / Non-goals / Context; tests cover missing and empty cases. |

## exitGates

- **G-F1-1:** pass — exit code 0  
  - Command (verbatim): `node --test tests/lint-design.test.js`  
  - Pattern (plan): `tests/lint-design.test.js` (kind: test, runner: node)  
  - Evidence (evaluator re-run at HEAD `090b5d7f`):  
    - `ℹ tests 26`  
    - `ℹ suites 5`  
    - `ℹ pass 26`  
    - `ℹ fail 0`  
    - `ℹ duration_ms 113.598333`  
  - Evidence (task T-004 claim at `d1b21407`): 26 pass / 0 fail / duration_ms ~122 — same suite shape.  
  - Contract checks beyond exit code:  
    - `REQUIRED` includes Context, Non-goals, Interview with `migrationOnly: false`  
    - RED tests exist for missing Context / Non-goals / Interview  
    - RED test exists for empty Context / Non-goals / Interview bodies  
    - Docs state the new always-required set  

## Scope check

| Task | Outputs exist | scopeBoundary held | Re-run verifier |
|------|---------------|--------------------|-----------------|
| T-004 | `scripts/lint-design.js`, `tests/lint-design.test.js` | No design-gates/creation-stage; no lint-source.js change | `node --test tests/lint-design.test.js` → exit 0 (26/0) |
| T-005 | `tests/lint-design.test.js`, `docs/skills/brainstorm.md` | No mass-edit of historical `projects/*/design.md` | `rg -q 'Interview\|Non-goals\|Context' tests/lint-design.test.js && rg -q 'lint-design\|Non-goals\|Interview' docs/skills/brainstorm.md` → exit 0 |

**scopeBoundary exclusions held:** design-gates logic absent; creation-stage logic absent; lint-source SPEC untouched; historical design.md files not rewritten in F1 product commits; Decisions + Chosen approach still required; Blast radius still migration-only.

## Task re-verification (evaluator)

| Task | Claim exitCode | Claim commit | Re-run exitCode | Notes |
|------|----------------|--------------|-----------------|-------|
| T-004 | 0 | d1b21407 | 0 | 26 tests pass; REQUIRED array verified by source read |
| T-005 | 0 | d1b21407 | 0 | tests + docs mention Context/Non-goals/Interview |

## REQUIRED array (source of truth at HEAD)

```js
const REQUIRED = [
  { key: 'context', label: 'Context', re: /\bcontext\b/, migrationOnly: false },
  { key: 'non-goals', label: 'Non-goals', re: /non[-\s]+goals?/, migrationOnly: false },
  { key: 'interview', label: 'Interview', re: /\binterview\b/, migrationOnly: false },
  { key: 'decisions', label: 'Decisions', re: /\bdecisions?\b/, migrationOnly: false },
  { key: 'chosen-approach', label: 'Chosen approach', re: /chosen[-\s]+approach/, migrationOnly: false },
  { key: 'blast-radius', label: 'Blast radius', re: /blast[-\s]+radius/, migrationOnly: true },
];
```

## Summary

F1 phase goal is met on HEAD `090b5d7f`. `scripts/lint-design.js` always requires Context, Non-goals, and Interview with real content; Decisions and Chosen approach remain; Blast radius stays migration-only. `tests/lint-design.test.js` locks missing-section and empty-body failures for the new sections (26/26 green). `docs/skills/brainstorm.md` documents the expanded lint contract. Task T-004 and T-005 are done with re-verified shell evidence. Out-of-scope F2 work (design-gates, assert-creation-stage, stage-N split, Stage 8) is absent as product. Residual note: `skills/core/brainstorm.md` still says "expanding toward" the new sections — docs surface is correct; skill parenthetical is stale prose, not an exit-gate miss.

**blockers:** none

**verdict:** pass  
**reportPath:** `.atomic-skills/reviews/eval-brainstorm-hardening-F1.md`
