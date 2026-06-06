---
date: 2026-05-22T09:52:11-03:00
topic: plan-re-bootstrap
artifact: docs/plan-re-bootstrap.md
skill: review-plan-with-codex
reviewer: gpt-5
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 6, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — plan-re-bootstrap

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5
pass: blind
schema_version: "1.0"
---

## Summary
The plan is viable only after tightening several dependency and coverage gaps. The largest risks are that the documented command promises behavior that no phase implements, and the proposed test patch as written can break the existing test module.

Several command behaviors are underspecified enough that two implementers would produce materially different results, especially around pasted edits, no-keyword evidence gathering, and configuration handling.

## Findings (blind)

### F-001 [major] dependency breaks — docs/plan-re-bootstrap.md:80-83

**Claim:** The proposed test insertion can create a duplicate `migrateLegacyInitiative` import binding in `tests/migrate.test.js`.

**Impact:** If applied literally, the module can fail to parse with a duplicate lexical declaration before any tests run, blocking `npm test`.

**Recommendation:** Change the plan to update the existing `../src/migrate.js` import to include `isMigratedPlaceholder` instead of adding a second import block at the end.

**Confidence:** high

### F-002 [major] coverage gap — docs/plan-re-bootstrap.md:147-149

**Claim:** The plan claims `scope-creep` flags migrated placeholder contexts, but no phase updates the `scope-creep` section to detect `isMigratedPlaceholder`.

**Impact:** Skipped or remaining placeholder items may not appear in `scope-creep`, so the user loses the advertised recovery path after `skip` or partial batch completion.

**Recommendation:** Add a phase that updates `scope-creep` to list parked/emerged items whose context passes `isMigratedPlaceholder`, or remove every claim that `scope-creep` flags placeholders.

**Confidence:** high

### F-003 [major] contradiction — docs/plan-re-bootstrap.md:175-184

**Claim:** The evidence flow requires `<top-keyword>` even when the extraction rules produce zero keywords.

**Impact:** For normal prose titles without identifiers, paths, CamelCase, or kebab-case symbols, the command either runs an invalid/empty `git log --grep` or different agents invent incompatible fallbacks.

**Recommendation:** Specify the zero-keyword behavior explicitly, including whether to skip grep/git-log, derive fallback terms from title words, or halt for user input.

**Confidence:** high

### F-004 [major] ambiguity — docs/plan-re-bootstrap.md:206-218

**Claim:** "Paste edits" has no canonical syntax or validation rule.

**Impact:** One implementation may accept loose prose, another may require YAML-like fields, and malformed or partial context can be written inconsistently across agents.

**Recommendation:** Define a strict pasted-edit format, required fields, validation errors, and retry behavior before write.

**Confidence:** high

### F-005 [major] dependency breaks — docs/plan-re-bootstrap.md:237

**Claim:** The plan introduces `reBootstrapExcludes` configuration but does not add any pre-flight step to load it or any evidence step to apply it.

**Impact:** Users can add the advertised config and still get polluted evidence, or implementers may handle the config differently because the command body only hardcodes `node_modules`, `dist`, and `.git`.

**Recommendation:** Add explicit steps to read `.atomic-skills/status/config.json`, merge `reBootstrapExcludes` with defaults, and apply the resulting patterns to every grep/read candidate.

**Confidence:** high

## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 6, minor: 0, nit: 0}
reviewer: gpt-5
pass: informed
schema_version: "1.0"
---

## Summary
The plan still needs changes before implementation. The informed constraints confirm the strongest blind-pass risks: the test import patch conflicts with the existing module, `scope-creep` does not currently flag fresh migration placeholders, and the advertised config key is not wired into the command flow.

One additional issue emerges from the repository tool-abstraction rule: the proposed skill text introduces hardcoded tool prose inside `.md` command bodies. That violates the repository's skill-file contract even though the concrete command examples use template variables.

## Findings (final)

### F-001 [major] dependency breaks — docs/plan-re-bootstrap.md:80

**Claim:** The proposed test insertion duplicates an existing `migrateLegacyInitiative` import binding in `tests/migrate.test.js`.

**Impact:** If applied literally, `npm test` can fail at module parse time with a duplicate lexical declaration before the new tests run.

**Recommendation:** Change the plan to modify the existing `../src/migrate.js` import to add `isMigratedPlaceholder`, not add a second import block.

**Confidence:** high

### F-002 [major] coverage gap — docs/plan-re-bootstrap.md:147

**Claim:** The plan claims `scope-creep` flags placeholders, but current `scope-creep` behavior is based on `lastReviewedAt` aging, and migration sets placeholder `lastReviewedAt` to now.

**Impact:** Freshly skipped or remaining placeholder items will not appear in `scope-creep` until they age past `staleContextDays`, so the documented recovery path is false immediately after migration or partial batch completion.

**Recommendation:** Either add a task to update `scope-creep` placeholder detection, or remove all claims that placeholder items stay in or are flagged by `scope-creep`.

**Confidence:** high

### F-003 [major] contradiction — docs/plan-re-bootstrap.md:175

**Claim:** The evidence flow requires `<top-keyword>` later, but does not define behavior when the title yields zero keywords.

**Impact:** Prose-only titles can produce an empty target list, causing invalid or inconsistent `git log --grep="<top-keyword>"` behavior across implementations.

**Recommendation:** Specify zero-keyword behavior explicitly: skip evidence commands, derive fallback title terms, or halt for user input.

**Confidence:** high

### F-004 [major] ambiguity — docs/plan-re-bootstrap.md:209

**Claim:** The pasted-edit path has no canonical syntax, required fields, validation rule, or retry behavior.

**Impact:** Different implementations may accept different shapes and write malformed or partial context blocks.

**Recommendation:** Define the exact pasted-edit format, required fields, parse failures, and re-prompt behavior before write.

**Confidence:** high

### F-005 [major] dependency breaks — docs/plan-re-bootstrap.md:237

**Claim:** The plan advertises `reBootstrapExcludes` but never adds command steps to load or apply it.

**Impact:** Users can configure the canonical status config and still get polluted evidence, or different implementers may apply exclusions inconsistently.

**Recommendation:** Add explicit pre-flight steps to read `.atomic-skills/status/config.json`, merge `reBootstrapExcludes` with defaults, and apply the resulting patterns to every grep/read candidate.

**Confidence:** high

### F-006 [major] coverage gap — docs/plan-re-bootstrap.md:158

**Claim:** The proposed skill body uses hardcoded tool/action prose in a skill `.md` file instead of the repository-required `{{READ_TOOL}}` / related placeholders.

**Impact:** The skill can violate the repository's skill-file contract and fail compatibility review even though later evidence-gathering bullets use `{{GREP_TOOL}}`, `{{READ_TOOL}}`, and `{{BASH_TOOL}}`.

**Recommendation:** Rewrite skill-body operational steps to use the required template variables wherever a tool action is described.

**Confidence:** high

## Questions (non-findings)

- docs/plan-re-bootstrap.md:159 — Should future schema versions such as `0.2` get the same "legacy" abort message, or a distinct unsupported-version error?
- docs/plan-re-bootstrap.md:231 — Should ratified items be saved after each item or only once after the full loop completes?

## Out of scope

- Style, naming, and formatting choices in the plan
- Changes to `migrateLegacyInitiative` beyond the proposed constant extraction
- Any changes to aideck, JSON Schema, package version, or a `migrate --rearticulate` flag

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-004-final [major] — same
- F-005-blind → F-005-final [major] — same

### Emerged

- F-006-final [major] coverage gap — emerged: the external tool-abstraction constraint makes hardcoded tool/action prose in the proposed skill body a substantive compatibility issue.

## Briefings used

<details>
<summary>Pass 1 briefing</summary>

See `/tmp/codex-briefing-pass1-20260521-095211.md` (plan artifact + non-goals + standard template).

</details>

<details>
<summary>Pass 2 briefing</summary>

See `/tmp/codex-briefing-pass2-20260521-095211.md` (7 external constraints verifying claims against codebase + Pass 1 output).

</details>

## Fixes applied in this session

- F-001 (major) — APPLIED. `docs/plan-re-bootstrap.md` Fase 2 restructured: 2a says "estender o import existente na linha 9" with example, 2b appends tests. No duplicate `migrateLegacyInitiative` import.
- F-002 (major) — APPLIED. Removed false claim "scope-creep flags these" from "When to run" + post-loop summary. Added honest note that fresh placeholders only appear in scope-creep after `staleContextDays`. Suggested earlier discovery: grep for placeholder prefix or check `isMigratedPlaceholder` directly.
- F-003 (major) — APPLIED. Added explicit zero-keyword fallback: 3 longest non-stopword tokens (≥6 chars) from title with EN+PT stopword list. If STILL 0: skip entire evidence step, mark draft `[no evidence — title too generic]`. `git log` step made conditional on non-empty keywords list.
- F-004 (major) — APPLIED. New section "Pasted-edit canonical format" defines exact YAML shape (`solves`, `trigger`, `assumesStillValid?`), required vs forbidden keys, length validation mirroring `contextSchema`, parse-failure behavior (specific error + re-prompt + 3-strike auto-cancel).
- F-005 (major) — APPLIED. New pre-flight step 3 reads `.atomic-skills/status/config.json` and builds `excludes` list merging defaults with `config.reBootstrapExcludes`. Evidence step references this list. Honest-limits paragraph updated to confirm wiring.
- F-006 (major) — APPLIED. New section operational steps use `{{READ_TOOL}}`/`{{WRITE_TOOL}}`/`{{GREP_TOOL}}`/`{{BASH_TOOL}}` consistently. Note: line 290 (inside the copy of existing `### migrate <slug>` section) keeps "Load X. Parse frontmatter." prose to stay consistent with the rest of the skill body — out of scope to restyle a pre-existing section.
