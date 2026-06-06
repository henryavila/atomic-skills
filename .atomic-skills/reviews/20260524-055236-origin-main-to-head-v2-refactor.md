---
ref: origin/main..HEAD
range_commits: 3
files_modified: 32
lines_added: 1426
lines_removed: 974
captured_diff_bytes: 199100
mode: both
reviewer_local: claude (self-loop, 3 iterations)
reviewer_codex: gpt-5 (codex-cli 0.130.0)
reviewed_at: 2026-05-24T08:59:08Z
verdict_local: needs_changes (2 critical applied, 5 significant recorded, 4 minor recorded)
verdict_codex_blind: needs_changes (0B/0C/2M/1m/0n)
verdict_codex_final: needs_changes (0B/0C/1M/0m/0n) — 2 dropped via constraints, 1 maintained
framing_delta: -2 (out of 3 blind findings)
---

# Cross-model review — origin/main..HEAD (v2.0.0 refactor)

## Local pass (claude, 3 iterations)

### Critical (applied inline)
- **C1** — `skills/shared/project-status-assets/bootstrap-index.template.md:13` told user to run `atomic-skills:project-status bootstrap --commit` — command removed in refactor. Fixed to `atomic-skills:project-plan discover --commit`.
- **C2 (chained)** — `tests/project-status.test.js:196` asserted substring of the broken pre-fix template. Updated assertion to match new content.

### Significant (recorded, no inline fix — test-coverage gaps)
- T2: `findLegacyOrphans` / `removeLegacyOrphans` (src/install.js:38, 61) — no unit tests
- T3: `validateModuleMeta` (scripts/lib/validate-skills-core.js:459) — no unit tests
- T4: `validateReadmeMentions` (scripts/lib/validate-skills-core.js:425) — no unit tests
- T7: `status({forceProject})` (src/status.js:35) — no test of new branch
- T9: `.husky/pre-commit` — no shell-level test

### Minor (recorded)
- L1: `src/install.js:67` — `parent.startsWith(legacyRoot)` is non-path-aware (no behavior bug in current usage)
- E1: `src/install.js:64` — `try { unlinkSync(full); } catch {}` silent swallow
- S2: `meta/catalog.yaml` `release_highlight` has no validator (only renderer throws)
- T11: `detectPlanShape` (src/bootstrap.js:300) — regex matches phase headings inside code blocks (false positive risk)

## Codex Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 1, nit: 0}
reviewer: gpt-5
pass: blind
schema_version: "1.0"
---

## Summary
The changes add useful generation and cleanup automation, but two executable paths can silently mutate user state beyond the requested commit/install scope. The pre-commit hook stages whole generated files after rewriting them, and the non-interactive installer deletes all files under a legacy namespace without checking whether they are still user-owned or locally modified.

There is also a catalog-contract validation gap: the new top-level catalog version is introduced as part of the schema contract but is never validated, so CI can pass a catalog whose root version disagrees with the expected format.

## Findings

### F-001 [major] Data integrity — .husky/pre-commit:25-28

**Evidence:**
```sh
if echo "$STAGED" | grep -qE "$INPUTS_REGEX"; then
  echo "[husky] catalog inputs changed — regenerating docs"
  npm run generate-docs
  git add README.md src/dashboard/data/skills.generated.ts
fi
```

**Claim:** Committing any staged catalog input also stages all current changes in `README.md` and `src/dashboard/data/skills.generated.ts`, including unrelated unstaged user edits outside generated regions.

**Impact:** A developer can accidentally commit unrelated README prose or dashboard data edits simply by staging `meta/catalog.yaml`, `package.json`, or generator code; the hook rewrites/regenerates and then `git add`s the entire output files without checking for pre-existing unstaged changes.

**Recommendation:** Before regeneration, detect unstaged changes in the generated outputs and abort with instructions, or preserve the index/worktree split and stage only the generator-produced changes.

**Confidence:** high

---

### F-002 [major] Data loss — src/install.js:489-494

**Evidence:**
```js
if (legacyOrphans.length > 0) {
  console.log(`  ${pc.dim(`Cleaning ${legacyOrphans.length} legacy orphan file(s) at obsolete install path(s):`)}`);
  for (const o of legacyOrphans) {
    console.log(`    ${pc.dim('-')} ${relative(basePath, o.path)}`);
  }
  removeLegacyOrphans(basePath, legacyOrphans);
}
```

**Claim:** `install --yes` deletes every file found under obsolete namespace paths without checking manifest ownership, installed hashes, or local modifications.

**Impact:** Users who edited old `.claude/skills/atomic-skills/...` files, or stored related notes/assets under that namespace, lose those files during a normal non-interactive update. The interactive path asks, but `--yes` is exactly the path used for unattended upgrades.

**Recommendation:** Treat legacy files like normal orphans: remove only files proven unmodified from a previous install, or require an explicit cleanup flag / backup path for untracked legacy namespaces.

**Confidence:** high

---

### F-003 [minor] Schema validation — scripts/lib/validate-skills-core.js:523-552

**Evidence:**
```js
export function validateCatalog(data, options = {}) {
  const report = {
    totalSkills: 0,
    totalIssues: 0,
    failedSkills: 0,
    failures: [], // [{location, issues[]}]
    versionsSeen: new Set(),
    parseError: null,
  };

  if (data == null || typeof data !== 'object') {
    report.parseError = 'catalog.yaml root is not an object';
    return report;
  }

  const skills = collectSkills(data);
  if (skills.length === 0) {
    report.parseError = 'no skill entries found in catalog.yaml';
    return report;
  }

  report.totalSkills = skills.length;
  const knownNames = new Set(skills.map((s) => s.key));

  const perSkillFailures = new Map(); // location -> { location, issues[] }

  for (const skill of skills) {
    const issues = validateSkill(skill.key, skill.entry, knownNames);
    if (skill.entry?.schema_version) {
      report.versionsSeen.add(skill.entry.schema_version);
```

**Claim:** The new root `version: '0.2'` field is never required or checked, so a catalog with `version: '0.1'`, a typo, or no root version can still validate if each skill entry has `schema_version: '0.2'`.

**Impact:** CI can accept a catalog whose advertised root schema is incompatible with the generator/validator contract, allowing downstream tools that key off the top-level version to misinterpret the file.

**Recommendation:** Validate `data.version` in `validateCatalog`: require it, require it to be a string, and reject anything outside the accepted catalog root versions.

**Confidence:** high

---

## Codex Pass 2 (informed, after constraints)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
reviewer: gpt-5
pass: informed
schema_version: "1.0"
---

## Summary
After applying the external constraints, the root-version finding is invalid because the new root `version` is documentation-only, and the legacy cleanup finding is invalid as originally framed because `--yes` is explicitly automated and cleanup is namespace-scoped to atomic-skills territory.

One data-integrity issue remains: the local pre-commit hook stages whole generated output files after regeneration. Because the README generator preserves static prose outside markers, any pre-existing unstaged static README edits become staged when an unrelated catalog input is committed.

## Findings

### F-001 [major] Data integrity — .husky/pre-commit:25

**Evidence:**
```sh
if echo "$STAGED" | grep -qE "$INPUTS_REGEX"; then
  echo "[husky] catalog inputs changed — regenerating docs"
  npm run generate-docs
  git add README.md src/dashboard/data/skills.generated.ts
fi
```

**Claim:** Staging any catalog input causes the hook to stage all current changes in `README.md` and `src/dashboard/data/skills.generated.ts`, including unrelated unstaged edits preserved outside generated regions.

**Impact:** A developer can accidentally commit unrelated README prose or dashboard data changes while committing only `meta/catalog.yaml`, `package.json`, `src/config.js`, or generator code; this contaminates commit scope and can publish unintended edits.

**Recommendation:** Before regeneration, abort if generated outputs have unstaged changes, or preserve index/worktree separation and stage only deterministic generated-region updates.

**Confidence:** high

---

## Pass 2 reconciliation

### Dropped from blind pass
- F-002-blind: Dropped because the constraints establish that `--yes` is documented automation, legacy cleanup is limited to `<legacy-dir>/atomic-skills/**`, and files inside that namespace are conventionally atomic-skills-owned.
- F-003-blind: Dropped because the constraints establish that root `version: '0.2'` has no downstream consumer and is documentation-only, so not validating it cannot currently break a reader.

### Maintained
- F-001-blind → F-001: The constraints confirm the hook is local-only and generated regions are deterministic, but they also confirm `git add README.md src/dashboard/data/skills.generated.ts` stages whatever exists after regeneration. Because static README edits outside markers are preserved byte-for-byte, unrelated unstaged edits can still be swept into the commit.

### Emerged
- None.

## Fixes applied in this session

| ID | Source | Severity | File | Action |
|---|---|---|---|---|
| C1 | local | critical | skills/shared/project-status-assets/bootstrap-index.template.md:13 | applied |
| C2 | local (chained) | critical | tests/project-status.test.js:196 | applied |
| cosmetic | local | minor | src/bootstrap.js:2 | applied (docstring) |
| F-001 (Pass 2 maintained) | codex | major | .husky/pre-commit:25 | applied (guard against unstaged generator outputs) |

## Self-review against code-quality gates

- **G1 read-before-claim**: Read tool ran on each file before Edit for all 4 fixes (verified file:line content in advance).
- **G2 soft-language**: scanned fix descriptions for ban list — 0 occurrences of `should/probably/may/typically`.
- **G3 anti-tautology**: no new test assertions added (only updated C2 to track command rename — mutation that fails test: gen emits old `bootstrap --commit` again).
- **G4 fixture realism**: N/A — no new fixtures.
- **G7 anti-premature-abstraction**: no new helper introduced in the F-001 fix; guard is inline in the hook (single site).

## Test deltas

- Before review: 425 tests, all green.
- After review: 425 tests, all green.
- validate-catalog: green.

## Artifacts (raw codex outputs)

- Pass 1 briefing: /tmp/codex-output-pass1-20260524-055236.md.replace(/output/, 'briefing').replace(/pass1/, 'briefing-pass1')
- Pass 1 output: /tmp/codex-output-pass1-20260524-055236.md
- Pass 2 briefing: /tmp/codex-briefing-pass2-20260524-055236.md
- Pass 2 output: /tmp/codex-output-pass2-20260524-055236.md

(Briefings live in /tmp/ and are not git-tracked. The codex outputs above are embedded verbatim in this review file as the audit trail.)
