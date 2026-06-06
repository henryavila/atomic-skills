---
date: 2026-05-19T18:52:14Z
topic: phase-b-3level-model
artifact: 34391b4^..HEAD
skill: review-code-with-codex
reviewer: gpt-5-codex
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 1, minor: 1, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
framing_delta: {dropped: 4, maintained: 0, emerged: 2}
schema_version: "1.0"
---

# Cross-Model Review — phase-b-3level-model

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The changes add validation and migration paths, but the validator does not enforce key invariants that the skill workflow depends on, and migration can emit partially anchored or lossy state. The default validator also skips archived state files, leaving a class of state corruption invisible to the new `validate-state` gate.

## Findings

### F-001 [major] schema soundness — meta/schemas/common.schema.json:81-89

**Evidence:**
```json
      "required": ["id", "description", "status"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "description": { "type": "string", "minLength": 1 },
        "verifier": { "$ref": "#/$defs/exitCriterionVerifier" },
        "status": { "type": "string", "enum": ["pending", "met", "deferred"] },
        "metAt": { "$ref": "#/$defs/isoTimestamp" },
        "deferredReason": { "type": "string" },
        "evidence": {
```

**Claim:** A criterion with `status: met` and a `verifier` but no `evidence` or `metAt` validates successfully.

**Impact:** `npm run validate-state` can accept phase gates as met even though the documented verifier workflow says evidence is required, allowing a phase or plan to appear complete without captured verification output.

**Recommendation:** Add conditional schema rules: when `status` is `met`, require `metAt`; when `status` is `met` and `verifier` is present, require `evidence` with `passed: true`; when `status` is `deferred`, require `deferredReason`.

**Confidence:** high

---

### F-002 [major] migration correctness — src/migrate.js:145-147

**Evidence:**
```js
  if (opts.parentPlan) {
    out.parentPlan = opts.parentPlan;
    if (opts.phaseId) out.phaseId = opts.phaseId;
  }
```

**Claim:** `migrateLegacyInitiative(legacy, { parentPlan: 'x' })` produces an initiative with `parentPlan` but no `phaseId`.

**Impact:** The output represents neither a valid standalone initiative nor a usable phase initiative: `done` will treat it as plan-anchored, but `phase-done` aborts because `phaseId` is missing. The schema also permits this partial state, so validation will not catch it.

**Recommendation:** Reject partial plan membership in `migrateLegacyInitiative` and add a schema dependency requiring `parentPlan` and `phaseId` to appear together.

**Confidence:** high

---

### F-003 [major] data integrity — src/migrate.js:162-164

**Evidence:**
```js
  out.stack = stackArr
    .map(mapStackFrame)
    .filter((f) => f != null && f.id != null && f.openedAt);
```

**Claim:** Legacy stack frames without `opened_at`/`openedAt` are silently dropped during migration.

**Impact:** A legacy file with an otherwise valid active frame but a missing timestamp loses stack history and possibly the current work frame during migration, contradicting the no-data-loss migration requirement.

**Recommendation:** Do not filter stack frames away silently; either synthesize `openedAt` from the migration timestamp and preserve the frame, or throw a migration error that names the offending frame.

**Confidence:** high

---

### F-004 [minor] validation coverage — scripts/validate-state.js:129-139

**Evidence:**
```js
    if (stat.isDirectory()) {
      for (const sub of ['plans', 'initiatives']) {
        const subDir = join(absPath, sub);
        if (!existsSync(subDir) || !statSync(subDir).isDirectory()) continue;
        for (const entry of readdirSync(subDir)) {
          if (!entry.endsWith('.md')) continue;
          const filePath = join(subDir, entry);
          if (seen.has(filePath)) continue;
          targets.push(filePath);
          seen.add(filePath);
```

**Claim:** Directory validation only scans `plans/*.md` and `initiatives/*.md`, skipping `plans/archive/*.md` and `initiatives/archive/*.md`.

**Impact:** Running `npm run validate-state -- .atomic-skills` can report all state valid while archived plans or initiatives contain invalid schema, stale legacy fields, or failed migrations.

**Recommendation:** Include archive subdirectories in the default directory scan, or document and implement an explicit `--active-only` mode while making the default validate all state files.

**Confidence:** medium

## Questions (non-findings)

- meta/schemas/initiative.schema.json:73 — Should `tasks[].id` be unique within an initiative, or is duplicate task ID handling intentionally left outside JSON Schema?

## Out of scope

- Aideck TypeScript schema drift.
- Hook rewrite behavior.
- New `project-plan` skill behavior.
- Removed `skills/pt/` content.

## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
After applying the external constraints, the blind-pass schema/workflow and archive-scan findings do not stand. The remaining issues are in the bootstrap conversion path and in the claimed fixture-validation coverage: bootstrap can still emit canonical initiatives with schema-invalid timestamps, and the validation tests do not actually exercise every non-invalid fixture as specified.

## Findings

### F-001 [major] data integrity — skills/shared/project-status-assets/bootstrap-draft.template.md:7-10

**Evidence:**
```yaml
proposedAt: REPLACE_PROPOSED_AT
proposedBucket: REPLACE_PROPOSED_BUCKET
started: REPLACE_STARTED_DATE
lastUpdated: REPLACE_LAST_UPDATED
```

**Claim:** A bootstrap draft generated with a date-only `started` value can be committed unchanged by `draftToInitiative`, which updates `lastUpdated` but does not normalize or validate `started`.

**Impact:** Normal bootstrap commit can write `.atomic-skills/initiatives/<slug>.md` with `started: 2026-04-10`, which violates the new `isoTimestamp` schema requiring a full timestamp with timezone; `npm run validate-state` then fails on the newly committed canonical initiative.

**Recommendation:** Replace `REPLACE_STARTED_DATE` with an ISO timestamp marker or normalize `started` inside `draftToInitiative`, and add a regression test using a date-only draft value.

**Confidence:** medium

---

### F-002 [minor] test coverage — tests/validate-state.test.js:51-62

**Evidence:**
```js
test('valid plan fixture passes schema validation', () => {
  const validators = buildValidators();
  const result = validateFile(join(FIXTURES, 'plans', 'v3-redesign.md'), validators);
  assert.equal(result.ok, true, `expected ok, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.kind, 'plan');
});

test('valid initiative fixture passes schema validation', () => {
  const validators = buildValidators();
  const result = validateFile(join(FIXTURES, 'initiatives', 'v3-f0-foundation-repair.md'), validators);
  assert.equal(result.ok, true, `expected ok, got errors: ${JSON.stringify(result.errors)}`);
  assert.equal(result.kind, 'initiative');
});
```

**Claim:** `tests/validate-state.test.js` hard-codes two fixture files instead of validating every fixture under `tests/fixtures/state/` excluding `invalid/`.

**Impact:** Adding or changing a fixture outside those two paths can silently escape schema validation in the test suite, so the executable-spec constraint that fixture regressions are caught is false.

**Recommendation:** Replace the two hard-coded positive fixture tests with a directory-walk test over canonical fixture directories, and explicitly segregate or exclude legacy fixtures by name if they are not meant to validate as 0.1 state.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- Aideck TypeScript schema drift.
- Hook rewrite behavior.
- New `project-plan` skill behavior.
- Removed `skills/pt/` content.

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [major] schema soundness — DROPPED: The external constraint states that "status: met requires evidence" is a skill-body workflow invariant, not an intended JSON Schema invariant.
- F-002-blind [major] migration correctness — DROPPED: The external constraint states that `{ parentPlan }` without `phaseId` is not user-reachable and is internal-API misuse.
- F-003-blind [major] data integrity — DROPPED: The external constraint states that legacy stack frames are assumed to carry `opened_at`, and the migrator must not emit schema-invalid missing-`openedAt` frames.
- F-004-blind [minor] validation coverage — DROPPED: The external constraint states that non-recursive archive scanning is intentional and archived files are validated through explicit arguments.

### Maintained

- _(none)_

### Emerged

- F-001-final [major] data integrity — emerged: The bootstrap-draft constraint clarifies drafts are non-canonical, so the commit conversion path must produce schema-valid canonical timestamps.
- F-002-final [minor] test coverage — emerged: The external constraint says `validate-state.test.js` validates every non-invalid fixture, but the artifact only validates two hard-coded fixture files.

## Briefings used

<details>
<summary>Pass 1 briefing</summary>

Stored at `/tmp/codex-briefing-pass1-20260519-153847.md` (177 KB; includes full diff).
Pass 1 instructions only (briefing minus diff): ~4 KB.

</details>

<details>
<summary>Pass 2 briefing</summary>

Stored at `/tmp/codex-briefing-pass2-20260519-153847.md` (189 KB; Pass 1 briefing + external constraints + Pass 1 output + reconciliation prompt).

</details>

## Fixes applied in this session

- **F-001 [major] data integrity — APPLIED**
  - `skills/shared/project-status-assets/bootstrap-draft.template.md:9`: marker `REPLACE_STARTED_DATE` → `REPLACE_STARTED_ISO_TIMESTAMP`
  - `skills/shared/project-status-assets/bootstrap-archived.template.md:8`: same rename
  - `src/bootstrap.js`: added `coerceToIsoTimestamp()` helper + applied it to `started` inside `draftToInitiative` so bare-date drafts produce schema-valid canonical timestamps on commit
  - `tests/bootstrap.test.js`: 3 new regression tests
    1. `normalizes date-only \`started\` to a full ISO timestamp`
    2. `preserves full ISO \`started\` unchanged`
    3. `committed draft (date-only started) passes schema validation end-to-end`
  - `tests/project-status.test.js`: marker assertion updated to `REPLACE_STARTED_ISO_TIMESTAMP`
- **F-002 [minor] test coverage — APPLIED**
  - `tests/validate-state.test.js`: replaced 2 hardcoded positive-fixture asserts with `listCanonicalFixtures()` directory-walk over `tests/fixtures/state/{plans,initiatives}/*.md` (non-recursive — `invalid/` and `legacy/` correctly excluded). Any new positive fixture added is now auto-validated.

Post-fix verification: `npm test` exits 0 with 226 passing (was 224 before fixes).
