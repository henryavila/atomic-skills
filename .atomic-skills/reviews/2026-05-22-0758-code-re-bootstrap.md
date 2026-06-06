---
date: 2026-05-22T10:58:05Z
topic: code-re-bootstrap
artifact: "HEAD~2..HEAD (commits fb85832 + 9d683c7)"
skill: review-code-with-codex
reviewer: GPT-5
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 2, minor: 1, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 1, minor: 1, nit: 0}
framing_delta: {dropped: 1, maintained: 2, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — code-re-bootstrap

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 1, minor: 1, nit: 0}
reviewer: GPT-5
pass: blind
schema_version: "1.0"
---

### Summary
The detector added in `src/migrate.js` is overbroad: it treats any user-ratified context whose `solves` starts with the migration prefix as still migrated, violating the stated idempotence constraint and risking repeated prompts or overwrites.

The `re-bootstrap` prompt also instructs agents to interpolate project-controlled title-derived text directly into a shell command. A crafted parked/emerged title can turn the documented read-only evidence step into command execution.

### Findings

- F-001-blind [major] Correctness — src/migrate.js:110-113 — prefix-only detector misclassifies user-edited contexts starting with the prefix.
- F-002-blind [critical] Security — skills/en/core/project-status.md:755 — title interpolated into `git log --grep="<top-keyword>"` without escaping = shell injection.
- F-003-blind [minor] Correctness — skills/en/core/project-status.md:788+836 — "skip stays in scope-creep until handled" contradicts the post-loop note that says scope-creep only flags after staleContextDays.

### Pass 1 question

- skills/en/core/project-status.md:816 — Should this reference the canonical `meta/schemas/common.schema.json#/$defs/context` instead of the cross-repo `aideck` validator?

## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 1, nit: 0}
reviewer: GPT-5
pass: informed
schema_version: "1.0"
---

### Summary
The main correctness issue is that `isMigratedPlaceholder` uses only a prose prefix in a user-editable field as its marker. That violates the stated idempotence requirement for user-ratified contexts that intentionally start with the same phrase, and can cause repeated prompts or replacement of already-ratified context.

The `re-bootstrap` instructions also create a local command-injection risk by directing agents to place title-derived text into a shell command without escaping. A separate documentation consistency issue points validation at an out-of-repo schema path even though the canonical contract for this repo is `meta/schemas/common.schema.json`.

### Findings

#### F-001 [major] Correctness — src/migrate.js:110

**Evidence:**
```js
export function isMigratedPlaceholder(context) {
  if (context == null || typeof context !== 'object') return false;
  if (typeof context.solves !== 'string') return false;
  return context.solves.startsWith(MIGRATION_PLACEHOLDER_PREFIX);
}
```

**Claim:** A user-edited context with `solves: "(migrated from legacy schema) but this is my real explanation..."` is incorrectly classified as a migration placeholder because detection only checks a user-editable prose prefix.

**Impact:** `re-bootstrap` can re-prompt or replace already-ratified user context, breaking the stated idempotence requirement and preventing a legitimate articulation from starting with that phrase.

**Recommendation:** Detect only the exact generated placeholder shape, or add an unambiguous non-prose migration marker, and add a negative test for a user-ratified context starting with the prefix.

**Confidence:** high

#### F-002 [major] Security — skills/en/core/project-status.md:755

**Evidence:**
```md
- If keywords list is non-empty: {{BASH_TOOL}} `git log --oneline -10 --grep="<top-keyword>"` (1 call). **Skip this call when keywords list is empty**.
```

**Claim:** `top-keyword` comes from parked/emerged titles in user-controlled initiative state, and the instruction interpolates it into a shell command without specifying escaping or argv-safe invocation.

**Impact:** Running `re-bootstrap` on adversarial local initiative content can turn the intended read-only evidence step into arbitrary command execution under the AI IDE agent's normal permissions.

**Recommendation:** Require strict keyword allowlisting before shell use and specify safe shell escaping or an argv-style command construction; reject quotes, `$`, backticks, semicolons, pipes, and newlines.

**Confidence:** high

#### F-003 [minor] Cross-file consistency — skills/en/core/project-status.md:816

**Evidence:**
```md
**Validation** (mirror `contextSchema` in `aideck/src/schemas/validators/project-status.ts`):
```

**Claim:** The skill body points implementers at an out-of-repo `aideck` validator even though the canonical schema contract for this repository is `meta/schemas/common.schema.json`.

**Impact:** Future edits to the prompt can drift from the actual repo schema, and agents following the runtime instructions may validate against the wrong source when the two disagree.

**Recommendation:** Reference `meta/schemas/common.schema.json#/$defs/context` as the canonical validation source.

**Confidence:** high

### Pass 2 reconciliation

#### Dropped from blind pass

- F-003-blind [minor] Correctness — DROPPED: the supplied diff's `re-bootstrap` text no longer contains the contradictory "skip stays in scope-creep" wording, and the external constraint confirms `scope-creep` is age-based only.
  - **Reviewer note:** the diff DOES still contain `- \`skip\` keep placeholder; this item stays in scope-creep until handled` (skill body line 788). Pass 2 dropped this in error. Re-surfacing as a candidate fix below.

#### Maintained

- F-001-blind → F-001-final [major] — same.
- F-002-blind → F-002-final [major] — severity changed from critical to major because the external constraints limit exposure to local user-controlled initiative content and the user's normal AI IDE permission scope.

#### Emerged

- F-003-final [minor] Cross-file consistency — emerged: the external constraints identify this repo's schema as canonical, making the `aideck` validator reference a concrete drift risk.

## Briefings used

Pass 1 briefing: `/tmp/codex-briefing-pass1-rebootstrap.md` (~20KB, includes diff + constraints + non-goals)
Pass 2 briefing: `/tmp/codex-briefing-pass2-rebootstrap.md` (~30KB, appends external constraints + Pass 1 output)

## Fixes applied in this session

**F-001 → applied.** `src/migrate.js`:
- Source before edit (lines 99-114):
  ```js
  const MIGRATION_PLACEHOLDER_PREFIX = '(migrated from legacy schema)';
  export function isMigratedPlaceholder(context) {
    if (context == null || typeof context !== 'object') return false;
    if (typeof context.solves !== 'string') return false;
    return context.solves.startsWith(MIGRATION_PLACEHOLDER_PREFIX);
  }
  ```
- Source after edit:
  ```js
  const MIGRATION_PLACEHOLDER_PREFIX = '(migrated from legacy schema)';
  const MIGRATION_PLACEHOLDER_SUFFIX = 're-ratify to articulate the real problem this addresses.';
  export function isMigratedPlaceholder(context) {
    if (context == null || typeof context !== 'object') return false;
    if (typeof context.solves !== 'string') return false;
    return context.solves.startsWith(MIGRATION_PLACEHOLDER_PREFIX)
        && context.solves.endsWith(MIGRATION_PLACEHOLDER_SUFFIX);
  }
  ```
- `migrationContext()` was updated to reference both constants so the generator stays in sync with the detector.
- Two new negative tests (`tests/migrate.test.js`): `rejects user-edited solves that only matches the prefix` and `rejects solves that only matches the suffix`. Each test fails if either anchor is removed from the detector.
- Pre-existing idempotence fixture updated to use the full generated string (was using only `'(migrated from legacy schema) ...'` truncated form, which no longer matches the two-anchor detector).

**F-002 → applied.** `skills/en/core/project-status.md` evidence-gathering step now mandates keyword sanitization (`^[A-Za-z0-9._/-]+$`) before any keyword is interpolated into the `{{BASH_TOOL}}` git log invocation. Added a clarifying note that `{{GREP_TOOL}}` takes its pattern as a structured tool arg and is therefore safe without sanitization.

**F-003 → applied.** `skills/en/core/project-status.md` line ~816 now references `meta/schemas/common.schema.json#/$defs/context` instead of the cross-repo `aideck/src/schemas/validators/project-status.ts`.

**F-bonus (re-surfaced from Pass 1 F-003-blind) → applied.** Skip-action description in the ratify gate options changed from "this item stays in scope-creep until handled" to "re-run `re-bootstrap` to handle later (scope-creep only flags it after `staleContextDays`, default 14)" — resolves the internal contradiction with the post-loop reminder.

**Test result after fixes:** `npm run validate-skills` ✓ (13/13), `npm test` ✓ (375/375, +2 new negative tests for F-001).

## Self-review against code-quality gates

- **G1 read-before-claim:** pasted source lines before/after for F-001. F-002, F-003, F-bonus are skill-body prose edits; the Edit tool's `old_string` already contained the exact text being changed.
- **G2 soft-language:** scanned this block for `should`, `probably`, `may`, `typically` — 0 occurrences.
- **G3 anti-tautology:** the new F-001 negative tests each kill a specific mutation of the detector: removing `startsWith(PREFIX)` passes the suffix-only fixture but the prefix-only test catches it; removing `endsWith(SUFFIX)` does the inverse. Either one-anchor regression fails one of the two new tests.
- **G4 fixture realism:** the F-001 fixtures are constructed from the actual literal strings produced by `migrationContext()` (read from `src/migrate.js` after edit). Not sampled from disk — the source IS the canonical generator.
- **G7 anti-premature-abstraction:** added one constant (`MIGRATION_PLACEHOLDER_SUFFIX`), no helpers. The detector remained inline.
