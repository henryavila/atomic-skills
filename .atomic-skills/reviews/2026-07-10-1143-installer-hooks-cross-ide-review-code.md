---
date: 2026-07-10T11:43:03-03:00
topic: installer-hooks-cross-ide-review-code
artifact: origin/main..HEAD
skill: review-code
reviewer: local-clean-context + gpt-5-codex
codex_version: codex-cli 0.143.0
final_verdict: needs_changes -> all fixed
counts_final: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 1, emerged: 0}
schema_version: "1.0"
---

# Cross-Model Review - installer-hooks-cross-ide

## Scope

- Requested argument: `installer-hooks-cross-ide`
- Resolved review surface: `origin/main..HEAD`
- Captured diff: `/var/folders/r0/8k53rmgj5h10v9kwk5xhxwhw0000gn/T/codex-review-installer-hooks-cross-ide-20260710-XXXXXX.6qfOtYaqlx/captured.diff`
- Captured files: `/var/folders/r0/8k53rmgj5h10v9kwk5xhxwhw0000gn/T/codex-review-installer-hooks-cross-ide-20260710-XXXXXX.6qfOtYaqlx/captured-files.txt`
- Files reviewed: 37
- Mode: both
- Note: the first inline Codex briefing exceeded the model context window, so the Codex pass used a smaller sealed briefing pointing at the same captured diff file. Codex was instructed not to run `git diff`.

## Local Pass

verdict: findings_exist
total_findings: 3
counts: blocker=0 critical=0 major=3 minor=0
passes: 2

| # | Finding | Severity | File:line | Action |
|---|---------|----------|-----------|--------|
| 1 | `PROJECT-STATUS.md` advertised the closed plan as active F2 while the plan is `done` at F3. | major | `.atomic-skills/projects/atomic-skills/PROJECT-STATUS.md:23` | applied |
| 2 | Soft enforcement registered `Stop` despite defining Soft as `SessionStart` + `PreToolUse` only. | major | `skills/shared/project-assets/project-setup.md:57` | applied |
| 3 | Hook config examples omitted the required top-level `hooks` object. | major | `skills/shared/project-assets/project-setup.md:64` | applied |

## Codex Pass 1 (blind)

```markdown
---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The project state index is stale relative to the plan state added in the same diff. It advertises `installer-hooks-cross-ide` as an active F2 plan/initiative, while the canonical plan frontmatter marks the plan `done` at F3 and the F3 phase is archived.

## Findings

### F-001 [major] data integrity - .atomic-skills/projects/atomic-skills/PROJECT-STATUS.md:4-23

**Claim:** The status index reports an active F2 plan and initiative even though `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md:6-10` marks the plan `done` with `currentPhase: F3`.

**Impact:** Session/status consumers will surface stale F2 work as current, including the wrong next action, while the actual plan is complete.

**Recommendation:** Regenerate or manually reconcile `PROJECT-STATUS.md` from the canonical plan state.

**Confidence:** high
```

## Codex Pass 2 (informed)

```markdown
---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The revealed constraints confirm that `.atomic-skills/projects/atomic-skills/PROJECT-STATUS.md` and `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md` are canonical project-state files, so the blind data-integrity finding stands.

## Findings

### F-001 [major] data integrity - .atomic-skills/projects/atomic-skills/PROJECT-STATUS.md:4-47

**Claim:** The project status index reports an active F2 plan and initiative even though `.atomic-skills/projects/atomic-skills/installer-hooks-cross-ide/plan.md:6-10` marks the same plan `done` at `currentPhase: F3`.

**Impact:** Status consumers will surface stale F2 work and the wrong next action, which can send future operators back into an already archived phase and corrupt focus selection or subsequent project transitions.

**Recommendation:** Reconcile `PROJECT-STATUS.md` from the canonical plan state: set active counts to zero for this plan, remove the F2 active initiative row, move `installer-hooks-cross-ide` to Done Plans with F3 / 4/4, and add the F2/F3 archives to Recently Archived as appropriate.

**Confidence:** high

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind -> F-001-final [major] - same

### Emerged

- _(none)_
```

## Fixes applied in this session

| Finding | Files changed | Fix |
|---|---|---|
| local #1 / codex F-001 | `.atomic-skills/projects/atomic-skills/PROJECT-STATUS.md` | Set `activePlans`/`activeInitiatives` to 0, moved `installer-hooks-cross-ide` to Done Plans as F3 4/4, removed stale F2 active initiative, and added F2/F3 archive rows. |
| local #2 | `skills/shared/project-assets/project-setup.md`, `tests/project.test.js` | Split Soft and Strict hook instructions: Soft registers `SessionStart` + `PreToolUse`; Strict additionally registers `Stop`. Added a regression asserting Soft does not contain `stop.sh`. |
| local #3 | `skills/shared/project-assets/project-setup.md`, `skills/shared/project-assets/hooks/README.md`, `.atomic-skills/status/hooks/README.md`, `tests/project.test.js` | Wrapped hook examples in the required top-level `hooks` object and added assertions for that shape. |

## Verification

- `node --test tests/project.test.js` -> 58 tests passed.
- `node scripts/validate-state.js` -> 163 files valid, 25 plans cross-validated, 1 routing config valid.
- `node scripts/refresh-state.js` -> digest no active plan.
- `node --test tests/project.test.js tests/install-uninstall-roundtrip.test.js tests/install.test.js tests/detect.test.js tests/cli.test.js tests/config.test.js` -> 145 tests passed.
- `npm run test:hooks` -> session-start 38 passed, stop 43 passed, pre-write 70 passed, pre-commit 5 passed.

## Self-review against code-quality gates

- G1 read-before-claim: applied. Read before/after sources for each fix: `PROJECT-STATUS.md:4-59`, `project-setup.md:57-82`, `hooks/README.md:41-50`, and `tests/project.test.js:353-397`.
- G2 soft-language: scanned this fix log for banned soft-language; 0 occurrences in fix descriptions.
- G3 anti-tautology: new assertions fail if Soft includes `stop.sh`, if Strict omits `stop.sh`, or if hook JSON examples omit `"hooks": {`.
- G4 fixture realism: N/A - no new external-data fixture was added; tests inspect installed project assets from the real source tree.
- G7 anti-premature-abstraction: no new helper introduced.
