---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The v0.3 validation path has malformed-input and data-integrity regressions. A non-object skill entry can now crash validation instead of returning a structured failure; the existing `new-skill` scaffold now emits entries that are invalid for the current v0.3 catalog and writes them before validation; and the Iron Law cross-check accepts an empty body section while claiming catalog/body consistency.

## Findings

### F-001 [major] Error handling — scripts/lib/validate-skills-core.js:741-748

**Evidence:**
```js
    const issues = validateSkill(skill.key, skill.entry, knownNames);
    if (
      requireIronLawField &&
      (skill.entry == null ||
        !('iron_law' in skill.entry) ||
        skill.entry.iron_law === undefined)
    ) {
      issues.push('missing required field: iron_law');
```

**Claim:** `validateCatalog` throws a `TypeError` for non-null primitive skill entries under v0.3 because the `in` operator is used before confirming `skill.entry` is an object.

**Impact:** A malformed catalog such as `core.demo: bad` crashes the validator instead of producing a normal validation report, so CLI callers can lose useful diagnostics and any wrapper expecting `report.failures` receives an exception path instead.

**Recommendation:** Guard the required `iron_law` check with the same object validation semantics as `validateSkill`, e.g. treat `entry == null || typeof entry !== 'object' || Array.isArray(entry)` as missing/invalid before using `in`; add a v0.3 test for primitive and array entries.

**Confidence:** high

---

### F-002 [major] Backward compatibility / rollback — scripts/lib/scaffold-skill.js:89-115

**Evidence:**
```js
export function buildSkillEntry(name, fields) {
  const lines = [
    `  ${name}:`,
    `    name: ${name}`,
    `    title: ${sq(fields.title)}`,
    `    description: ${sq(fields.description)}`,
    `    purpose: ${sq(fields.purpose)}`,
    `    when_to_use:`,
    ...fields.when_to_use.map((x) => `      - ${sq(x)}`),
    `    when_not_to_use:`,
    ...fields.when_not_to_use.map((x) => `      - ${sq(x)}`),
    `    examples:`,
    ...fields.examples.flatMap((ex) => [
      `      - command: ${sq(ex.command)}`,
      `        description: ${sq(ex.description)}`,
    ]),
    `    related: []`,
    `    tags: [core]`,
    `    ide_compatibility: [claude-code, gemini, cursor]`,
    `    requires_args: false`,
    `    mutates_repo: false`,
    `    network_required: false`,
    `    one_liner: ${sq(fields.one_liner)}`,
    `    emoji: ${sq(fields.emoji)}`,
    `    version_added: ${sq(fields.version_added)}`,
    `    schema_version: '0.2'`,
  ];
```

**Claim:** The scaffolded catalog entry omits `iron_law`, which is required by the current root `version: '0.3'` catalog.

**Impact:** `npm run new-skill` writes a new body and catalog entry, then validation fails because the entry lacks `iron_law`; the command leaves an invalid, dirty worktree instead of producing a committable scaffold.

**Recommendation:** Add `iron_law` to `defaultFields` and `buildSkillEntry`, use the same value as the first body Iron Law line, and test `planScaffold`/`new-skill` against a v0.3 fixture. Validate the planned catalog before writing or roll back written files on validation failure.

**Confidence:** high

---

### F-003 [major] Data integrity — scripts/lib/validate-skills-core.js:499-507

**Evidence:**
```js
      const body = readFileSync(bodyPath, 'utf8');
      if (requireIronLaw && !/^## Iron Law\b/m.test(body)) {
        issues.push(`skill body missing canonical \`## Iron Law\` section: ${bodyPath}`);
      }
      if (crossCheckIronLaw) {
        const catalogLaw =
          typeof skill.entry?.iron_law === 'string' ? skill.entry.iron_law : null;
        const bodyLaw = extractIronLawFromBody(body);
        if (catalogLaw != null && bodyLaw != null) {
```

**Claim:** The v0.3 cross-check skips validation when the body has a `## Iron Law` heading but no extractable first non-empty law line.

**Impact:** A skill body with an empty Iron Law section passes the header check and avoids the mismatch check, so validation can report success while the agent-facing skill body is missing the non-negotiable rule that the catalog claims is synchronized.

**Recommendation:** When `crossCheckIronLaw` is enabled and catalog `iron_law` is present, fail if `extractIronLawFromBody(body)` returns `null`; alternatively make `requireIronLaw` require an extractable first line rather than just a heading. Add a test for `## Iron Law` followed immediately by another heading or EOF.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- Site HTML / generate-site, slim README layout, deploy, and style-only documentation nits per briefing.