---
date: 2026-05-19T19:53:26Z
topic: phase-c-project-plan
artifact: 2f45638..HEAD
skill: review-code-with-codex
reviewer: gpt-5-codex
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 4, emerged: 0}
schema_version: "1.0"
---

# Cross-Model Review — phase-c-project-plan

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
reviewer: gpt-5
pass: blind
schema_version: "1.0"
---

## Summary
The new decomposition/materialization helper can silently produce corrupted plan state for valid inputs: initiative path collisions, duplicate phase IDs, dropped exit gates, and incorrectly parsed colon-separated bullets. These are not style issues; they affect the structured files that later `project-status` workflows rely on.

The test suite covers the happy-path fixture but misses adversarial inputs around identifier uniqueness, long valid slugs, malformed YAML, and documented bullet separator variants.

## Findings

### F-001 [major] Data integrity — src/decompose.js:113-117

**Evidence:**
```js
function deriveInitiativeSlug(planSlug, phaseId, title) {
  const phasePart = String(phaseId || '').toLowerCase();
  const titlePart = slugify(title, 40);
  const base = [planSlug, phasePart, titlePart].filter(Boolean).join('-');
  return slugify(base, 63);
}
```

**Claim:** A valid long `planSlug` can consume the entire 63-character truncation budget, causing every phase initiative to receive the same slug because the `phaseId` suffix is sliced off.

**Impact:** Materialization can return duplicate `.atomic-skills/initiatives/<slug>.md` paths, so a writer can overwrite earlier phase files and leave the Plan referencing multiple phases with the same initiative slug.

**Recommendation:** Reserve space for the phase suffix before truncating, and reject duplicate derived slugs before returning materialized files.

**Confidence:** high

---

### F-002 [major] Correctness — src/decompose.js:331-348

**Evidence:**
```js
      const phaseId = phaseMatch[1].toUpperCase();
      const phaseTitleRaw = (phaseMatch[2] || '').trim();
      const phaseTitle = phaseTitleRaw || phaseId;
      const goal = extractGoal(section.bodyLines);
      const tasks = extractTasks(section.bodyLines);
      const exitGateRaw = extractFirstYamlBlock(section.bodyLines, 'exit_gate')
        ?? extractFirstYamlBlock(section.bodyLines, 'exitGate');
      const exitGates = normalizeExitGateCriteria(exitGateRaw);

      initiatives.push({
        phaseId,
        slug: planSlug ? deriveInitiativeSlug(planSlug, phaseId, phaseTitle) : '',
        title: phaseTitle,
        goal,
        tasks,
        exitGates,
      });
      phaseIds.push(phaseId);
```

**Claim:** Duplicate phase IDs such as two `## F0 — ...` sections are accepted because the parser appends each phase without checking whether `phaseId` was already seen.

**Impact:** The generated Plan can contain ambiguous duplicate phase identifiers; downstream phase selection and dependency interpretation can target the wrong phase or create a self-dependency when the second duplicate depends on the previous `F0`.

**Recommendation:** Track seen phase IDs during decomposition and throw before materialization when a duplicate is found.

**Confidence:** high

---

### F-003 [major] Error handling — src/decompose.js:182-190

**Evidence:**
```js
      if (new RegExp(`^${key}\\s*:`, 'm').test(text)) {
        try {
          const parsed = parseYaml(text);
          if (parsed && typeof parsed === 'object' && parsed[key]) {
            return parsed[key];
          }
        } catch {
          // ignore parse errors — surface as warning at caller level
        }
      }
```

**Claim:** A malformed `exit_gate:` YAML block is silently discarded because parse errors are caught and no warning is actually added to the result.

**Impact:** Exit criteria can disappear from the preview and materialized Plan without any signal, allowing users to confirm an incomplete plan and later skip gates they thought were captured.

**Recommendation:** Return parse failures to `decomposePlan` as warnings or throw with the YAML parse error and phase ID.

**Confidence:** high

---

### F-004 [major] Correctness — src/decompose.js:134-145

**Evidence:**
```js
  // Try to split title/body on em-dash, en-dash, colon, or hyphen with spaces.
  const splitMatch = rest.match(/^(.+?)\s+[-—–:]\s+(.+)$/);
  if (splitMatch) {
    return { id, title: splitMatch[1].trim(), body: splitMatch[2].trim() };
  }
  return { id, title: rest, body: '' };
}

function parseGlossaryBullet(line) {
  const raw = line.replace(/\*+/g, '').trim();
  const m = raw.match(/^(.+?)\s+[-—–:]\s+(.+)$/);
```

**Claim:** Colon-separated bullets like `- API: external contract` and `- Principle: body` do not split because the regex requires whitespace before the colon.

**Impact:** Normal markdown bullets are materialized with the definition/body folded into the term/title and a schema-valid TODO fallback, corrupting glossary and principle frontmatter while still passing validation.

**Recommendation:** Parse colon separators with no required preceding whitespace, separately from dash separators that need surrounding spaces.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- Markdown prose review of `skills/en/core/project-plan.md` and `skills/shared/project-plan-assets/minimal-source.template.md`
- aiDeck TypeScript schema drift
- Phase D hooks/MCP work not present in this diff
- Behavior of the pre-existing `project-status` skill body
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The helper can produce schema-valid but semantically corrupted plan state for adversarial inputs that are either valid under the documented contract or only fail in ways the caller cannot see. The canonical schemas validate individual slugs and phase objects, but they do not catch cross-file path collisions, duplicate phase identifiers, or silently dropped exit gates.

The blind-pass findings stand after applying the external constraints. No production caller exists yet, which limits immediate blast radius, but the skill-body runtime snippets are expected to use these helpers for materializing `.atomic-skills/` state.

## Findings

### F-001 [major] Data integrity — src/decompose.js:113-117

**Evidence:**
```js
function deriveInitiativeSlug(planSlug, phaseId, title) {
  const phasePart = String(phaseId || '').toLowerCase();
  const titlePart = slugify(title, 40);
  const base = [planSlug, phasePart, titlePart].filter(Boolean).join('-');
  return slugify(base, 63);
}
```

**Claim:** A valid long `planSlug` can consume the entire truncation budget, causing multiple phase initiatives to derive the same slug because the `phaseId` suffix is sliced off.

**Impact:** Materialization can return duplicate `.atomic-skills/initiatives/<slug>.md` paths; a writer can overwrite earlier phase files while the Plan still records multiple phases, leaving corrupted canonical state that schema validation will not catch.

**Recommendation:** Reserve slug budget for the phase suffix and reject duplicate derived slugs or duplicate relative paths before returning materialized files.

**Confidence:** high

---

### F-002 [major] Correctness — src/decompose.js:331-348

**Evidence:**
```js
      const phaseId = phaseMatch[1].toUpperCase();
      const phaseTitleRaw = (phaseMatch[2] || '').trim();
      const phaseTitle = phaseTitleRaw || phaseId;
      const goal = extractGoal(section.bodyLines);
      const tasks = extractTasks(section.bodyLines);
      const exitGateRaw = extractFirstYamlBlock(section.bodyLines, 'exit_gate')
        ?? extractFirstYamlBlock(section.bodyLines, 'exitGate');
      const exitGates = normalizeExitGateCriteria(exitGateRaw);

      initiatives.push({
        phaseId,
        slug: planSlug ? deriveInitiativeSlug(planSlug, phaseId, phaseTitle) : '',
        title: phaseTitle,
        goal,
        tasks,
        exitGates,
      });
      phaseIds.push(phaseId);
```

**Claim:** Duplicate phase IDs such as two `## F0 — ...` sections are accepted because the parser appends each phase without checking whether `phaseId` was already seen.

**Impact:** The generated Plan can contain ambiguous duplicate phase identifiers; downstream phase selection and dependency interpretation can target the wrong phase or create a self-dependency when a duplicate phase depends on the previous phase with the same ID.

**Recommendation:** Track seen phase IDs during decomposition and throw before materialization when a duplicate is found.

**Confidence:** high

---

### F-003 [major] Error handling — src/decompose.js:182-190

**Evidence:**
```js
      if (new RegExp(`^${key}\\s*:`, 'm').test(text)) {
        try {
          const parsed = parseYaml(text);
          if (parsed && typeof parsed === 'object' && parsed[key]) {
            return parsed[key];
          }
        } catch {
          // ignore parse errors — surface as warning at caller level
        }
      }
```

**Claim:** A malformed `exit_gate:` YAML block is silently discarded because parse errors are caught and no warning is actually added to the result.

**Impact:** Exit criteria can disappear from the preview and materialized Plan without any signal, allowing users to confirm an incomplete plan and later skip gates they thought were captured.

**Recommendation:** Return parse failures to `decomposePlan` as warnings or throw with the YAML parse error and phase ID.

**Confidence:** high

---

### F-004 [major] Correctness — src/decompose.js:134-145

**Evidence:**
```js
  // Try to split title/body on em-dash, en-dash, colon, or hyphen with spaces.
  const splitMatch = rest.match(/^(.+?)\s+[-—–:]\s+(.+)$/);
  if (splitMatch) {
    return { id, title: splitMatch[1].trim(), body: splitMatch[2].trim() };
  }
  return { id, title: rest, body: '' };
}

function parseGlossaryBullet(line) {
  const raw = line.replace(/\*+/g, '').trim();
  const m = raw.match(/^(.+?)\s+[-—–:]\s+(.+)$/);
```

**Claim:** Colon-separated bullets like `- API: external contract` and `- Principle: body` do not split because the regex requires whitespace before the colon.

**Impact:** Documented markdown inputs are materialized with the definition or body folded into the term or title, plus a schema-valid TODO fallback, corrupting glossary and principle frontmatter while still passing validation.

**Recommendation:** Parse colon separators with no required preceding whitespace, separately from dash separators that require surrounding spaces.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- Markdown prose review of `skills/en/core/project-plan.md` and `skills/shared/project-plan-assets/minimal-source.template.md`
- Style, naming, and formatting unless they hide substantive issues
- aiDeck TypeScript schema drift
- Phase D hooks/MCP work not present in this diff
- Behavior of the pre-existing `project-status` skill body
- Files not in the diff or its direct dependents

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-004-final [major] — same

### Emerged

- _(none)_
## Briefings used

<details>
<summary>Pass 1 briefing</summary>

Stored at `/tmp/codex-briefing-pass1-20260519-194428.md` (86 KB; includes full diff).
Pass 1 instructions only (briefing minus diff): ~6 KB.

</details>

<details>
<summary>Pass 2 briefing</summary>

Stored at `/tmp/codex-briefing-pass2-20260519-194428.md` (97 KB; Pass 1 briefing + external constraints + Pass 1 output + reconciliation prompt).

</details>

## Fixes applied in this session

- **F-001 [major] Data integrity — APPLIED**
  - `src/decompose.js`: `deriveInitiativeSlug` now reserves budget for the phase suffix before truncating (`planBudget = SLUG_MAX - phaseChunk`), so long plan slugs no longer slice off `-f0` / `-f1` / `-f2`.
  - `src/decompose.js`: `materializeDecomposition` tracks `seenSlugs` + `seenPaths` and throws on any derived-path collision instead of silently overwriting earlier files.
  - `tests/decompose.test.js`: 2 new regression tests
    1. `derives distinct initiative slugs even when planSlug consumes near-full 63-char budget` (60-char planSlug, 3 phases, all distinct, all match `^[a-z][a-z0-9-]{1,63}$`).
    2. `materializeDecomposition throws on derived-path collision rather than overwriting`.

- **F-002 [major] Correctness — APPLIED**
  - `src/decompose.js`: the phase-section branch in `decomposePlan` now checks `phaseIds.includes(phaseId)` BEFORE pushing and throws with the offending H2 text on a duplicate.
  - `tests/decompose.test.js`: 2 new regression tests
    1. `throws when source markdown declares the same phase id twice` (two `## F0 — ...` sections).
    2. False-positive guard: unique `F0` + `F1` does not throw.

- **F-003 [major] Error handling — APPLIED**
  - `src/decompose.js`: `extractFirstYamlBlock(bodyLines, key, warnings, phaseId)` now accepts the `warnings` array + `phaseId`. On YAML parse failure it pushes `` `Malformed <key>: YAML block in phase <phaseId> — dropped from decompose. Parser said: <first line>` `` instead of swallowing silently. Callers (`decomposePlan`'s phase loop) thread `warnings` + `phaseId` through.
  - `tests/decompose.test.js`: 2 new regression tests
    1. Source with an unclosed YAML string inside `exit_gate:` block produces a warning naming the phase; decompose still succeeds with zero exitGates.
    2. False-positive guard: well-formed exit_gate (the canonical fixture) does NOT generate a Malformed warning.

- **F-004 [major] Correctness — APPLIED**
  - `src/decompose.js`: introduced `splitOnSeparator(text)` with two separate regexes:
    - `DASH_SEP_RE = /^(.+?)\s+[-—–]\s+(.+)$/` — dashes still require whitespace both sides (so hyphenated words like `well-known` survive).
    - `COLON_SEP_RE = /^([^:]+?)\s*:\s+(.+)$/` — colon allows zero whitespace before; requires whitespace after; uses `[^:]` to anchor on the first colon and avoid greedy backtracking.
  - Both `parsePrincipleBullet` and `parseGlossaryBullet` now call `splitOnSeparator` (dash tried first, then colon).
  - `tests/decompose.test.js`: 3 new regression tests
    1. `- Term: definition` glossary bullets split correctly.
    2. `- Principle title: body` principle bullets split correctly.
    3. Regression guard: `well-known term: definition` keeps the hyphenated head intact.

Post-fix verification:
- `npm test` exits 0 with **280 passing** (was 271 before fixes, +9 regression tests).
- `npm run validate-skills` exits 0 (13 skills).
- `npm run validate-state tests/fixtures/state` exits 0.
