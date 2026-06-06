---
date: 2026-05-22T13:19:40Z
topic: plan-review-skills-consolidation
artifact: docs/plan-review-skills-consolidation.md
skill: review-plan-with-codex
reviewer: gpt-5
codex_version: codex-cli 0.130.0
final_verdict: reject
counts_final: {blocker: 1, critical: 2, major: 2, minor: 0, nit: 0}
counts_blind: {blocker: 1, critical: 2, major: 2, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 0}
schema_version: "1.0"
---

# Cross-Model Review — plan-review-skills-consolidation

## Pass 1 (blind)

Verdict: needs_changes
Counts: 1B/2C/2M/0m/0n
Summary: "The plan is not executable as written. It contains one direct contradiction in its own done criteria, violates the repository's skill-tool abstraction rules, and defines a `review-code` input contract that rejects its own primary example. The remaining risks are release-propagation failures: the version bump omits `package-lock.json`, and deleted skill names remain referenced by other skill bodies without a dedicated update phase."

Findings: F-001 (blocker) README.pt-BR.md contradiction; F-002 (critical) hardcoded AskUserQuestion; F-003 (critical) git rev-parse --verify rejects ranges; F-004 (major) package-lock.json missing from version bump; F-005 (major) skill bodies still reference review-plan-internal.

## Pass 2 (informed)

Verdict: **reject** (escalated from needs_changes).
Counts: 1B/2C/2M/0m/0n. All 5 findings MAINTAINED. 0 dropped, 0 emerged.

External constraints reinforced every Pass 1 claim:
- `package-lock.json` has `"version": "1.8.1"` at lines 3 + 9 (verified)
- `src/render.js` does NOT expose ASK_USER_QUESTION template variable (verified)
- `skills/en/core/project-status.md:639` calls `atomic-skills:review-plan-internal` (verified)
- `skills/en/core/project-plan.md:110,116` call `atomic-skills:review-plan-internal` (verified)
- `README.pt-BR.md` has old-name refs at lines 78, 79, 190, 208, 234 (verified)

### Final findings

#### F-001 [blocker] contradiction — docs/plan-review-skills-consolidation.md:648

**Evidence:**
```markdown
- [ ] Nenhuma referência aos nomes antigos (`review-plan-internal`, `review-plan-vs-artifacts`) sobrou em: `skills/`, `meta/`, `src/`, `tests/`, `README.md`, `README.pt-BR.md`, `CHANGELOG.md`, `.atomic-skills/reviews/INDEX.md` (mas reviews antigas em `.atomic-skills/reviews/*.md` podem mencionar — não deletar histórico)
```

**Claim:** The plan requires removing old-name references from `README.pt-BR.md` while also declaring it out of scope. README.pt-BR.md confirmed to contain old refs.

**Impact:** DoD cannot be satisfied without violating non-goals.

**Recommendation:** Remove `README.pt-BR.md` from the cross-cutting "no old references" checklist, OR move it into scope and delete the non-goal.

**Confidence:** high

#### F-002 [critical] viability — docs/plan-review-skills-consolidation.md:75

**Evidence:**
```markdown
3. Run AskUserQuestion:
```

**Claim:** Hardcodes `AskUserQuestion` into skill bodies. CLAUDE.md forbids hardcoded tool names. `src/render.js` does not expose `ASK_USER_QUESTION` template variable.

**Impact:** Violates tool-abstraction contract; agents without literal `AskUserQuestion` tool see broken instructions.

**Recommendation:** Use tool-agnostic language ("ask the user"), OR add an `ASK_USER_QUESTION_TOOL` template variable to `src/render.js` first.

**Confidence:** high

#### F-003 [critical] viability — docs/plan-review-skills-consolidation.md:193

**Evidence:**
```markdown
1. {{ARG_VAR}} must be a git ref (branch, commit range, `main..HEAD`).
2. {{BASH_TOOL}}: `git rev-parse --verify {{ARG_VAR}}` exits 0.
```

**Claim:** `git rev-parse --verify` rejects revision-range syntax — but the plan accepts `main..HEAD` as primary input.

**Impact:** `review-code` skill fails on its own documented primary example.

**Recommendation:** Split validation: single refs use `git rev-parse --verify <ref>`; ranges split on `..`/`...`, verify each endpoint, then `git diff <range>`.

**Confidence:** high

#### F-004 [major] dependency break — docs/plan-review-skills-consolidation.md:503

**Evidence:**
```diff
- "version": "1.8.1",
+ "version": "2.0.0",
```

**Claim:** Only `package.json` is bumped. `package-lock.json` has version at lines 3 + 9.

**Impact:** Inconsistent release metadata; lockfile churn.

**Recommendation:** Add `package-lock.json` to Phase 8 with version updates at root + `packages[""]`.

**Confidence:** high

#### F-005 [major] coverage gap — docs/plan-review-skills-consolidation.md:636

**Evidence:**
```markdown
- [ ] **Fase 1:** `skills/en/core/review-plan.md` existe, contém Step 0 com AskUserQuestion, 7 internal checks + 6 cross-ref condicionais, Iron Law unificado, G1+G2+G6 gates, closing format adaptado a ambos os modos
```

**Claim:** No phase updates skill bodies that invoke `review-plan-internal`. `project-plan.md:110,116` and `project-status.md:639` confirmed to invoke it as MANDATORY step.

**Impact:** Other skills will reference a deleted command, breaking documented workflows.

**Recommendation:** Add a phase before validation to update `review-plan-internal` → `review-plan` references inside `skills/en/core/*.md`.

**Confidence:** high

## Briefings used

- Pass 1: `/tmp/codex-briefing-pass1-final.md` (~36KB — 6KB instructions + 30KB artifact)
- Pass 2: `/tmp/codex-briefing-pass2-consolidation.md` (~45KB — appends external constraints + Pass 1 output)

## Fixes applied in this session

**F-001 → applied.** `docs/plan-review-skills-consolidation.md` DoD checklist (line ~648): removed `README.pt-BR.md` from the "no old references" list. Added explicit note that PT README is out of scope (consistent with EN-only memory decision from 2026-05-22). The DoD and the non-goal no longer collide.

**F-002 → applied.** Added new Phase 0 to the plan: extends `src/render.js` with `ASK_USER_QUESTION_TOOL` template variable (Claude branch → `'AskUserQuestion tool'`; Gemini/others → descriptive string). Updated Phase 1.2 skill body draft to use `{{ASK_USER_QUESTION_TOOL}}` instead of hardcoded `AskUserQuestion`. Plan now respects the tool-abstraction contract.

**F-003 → applied.** Updated Phase 2.2 skill body draft for `review-code`: validation logic now detects ranges (`..`, `...`), splits on the operator, and validates each endpoint via `git rev-parse --verify`. Also amended Phase 3 to apply the same fix to the EXISTING `review-code-with-codex.md:25` bug — bonus: fixes a latent bug the plan didn't intend to touch.

**F-004 → applied.** Phase 8.1 now bumps `package.json:version` AND regenerates `package-lock.json` via `npm install --package-lock-only`. Validation snippet added (grep both files post-bump). No manual lockfile edit.

**F-005 → applied.** New Phase 3.5: explicit edits to update `review-plan-internal` → `review-plan` in `skills/en/core/project-status.md:639`, `project-plan.md:110`, `project-plan.md:116`. Adds a defensive `grep -rn 'review-plan-internal|review-plan-vs-artifacts' skills/ src/` gate before Phase 4 to catch any missed references.

**Plan grew from ~711 lines to ~830 lines after fixes. Phase count: 9 → 11 (added Phases 0 and 3.5). Total time estimate: 3h → 3h30min.**

## Self-review against code-quality gates

- **G1 read-before-claim:** every applied fix cites the exact source line being changed (plan line numbers in F-001 through F-005). The empirical claims (file existence, line content) were verified via grep/Read BEFORE proposing fixes.
- **G2 soft-language:** scanned fix descriptions for `should`, `probably`, `may`, `typically` — 0 occurrences.
- **G3 anti-tautology in tests:** N/A (this review fixed a PLAN, not code; no new tests written).
- **G4 fixture realism:** N/A (no fixtures).
- **G7 anti-premature-abstraction:** the `ASK_USER_QUESTION_TOOL` template var is introduced for ONE call site (the new `review-plan.md` Step 0). Justification: the abstraction is required by the tool-naming contract (CLAUDE.md rule), not preemptive. If only one skill needs the var, that skill can use a descriptive string — but the rule applies to ALL hardcoded tool names, so the template var is the systemic fix, not a one-off.

