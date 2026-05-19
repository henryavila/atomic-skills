# Atomic Skills — Migration Plan v2

> Canonical implementation plan for the redesign decided in the 2026-05-19 design session.
> This document is the menu. Execution happens in `.atomic-skills/initiatives/` once project-status is bootstrapped on THIS repo.

## Context

In May 2026 a design session identified that:

1. `project-status` skill is **silent during planning** — 843 lines of structured plan got created in sda-v2 without the skill being invoked once.
2. The skill is **too flat** for real multi-phase work (no Plan level, only flat initiatives).
3. There is **no visual interface** for the bird's-eye-+zoom mental model the skill was supposed to enable.
4. **PT+EN parallel maintenance** of skills creates translation drift and double cost without measurable benefit.

The session produced two artifacts:

- **aiDeck** (new sibling package at `/Volumes/External/code/aideck/`): AI-native dashboard runtime with MCP, HTTP, SSE.
- **This migration plan**: changes needed in atomic-skills to leverage aiDeck and address the flat-model and bilingual problems.

For full design rationale see [`aideck/docs/why.md`](../../aideck/docs/why.md). Decisions log: [`aideck/docs/decisions.md`](../../aideck/docs/decisions.md).

## Reference test target

After all phases land, the test target is the **sda-v2 v3-redesign plan** (9 phases, 61 sub-phases, 70+ tasks). If the redesigned atomic-skills + aiDeck can host this plan natively, the migration succeeded.

## Inviolable principles

1. **Files canonical**: skills always work without aiDeck. aiDeck is an optimization layer, never a dependency.
2. **Backward compat preserved**: existing standalone initiatives (without `parent_plan`) continue functioning.
3. **EN-canonical**: skill source in English; communication language is per-repo configuration.
4. **One commit per atomic change**: each phase below maps to a focused PR / commit batch.
5. **Test before ship**: each phase has a verifiable exit gate.

## Phases overview

```
Phase A — Independent of aiDeck (can ship standalone)
  A.T-000  [DONE] Migrate YAML parser to `yaml` npm package
           (Promoted from B.T-001 — prerequisite for enriched skills.yaml)
  A.T-001  [DONE] Enrich meta/skills.yaml with metadata per spec (12 skills)
  A.T-002  [DONE] Installer language refactor (PT removal + repurpose)
  A.T-003  [DONE] Skill validation script (scripts/validate-skills.js)
  A.T-004  [DONE] scope:paths detection helper (scripts/detect-scope.js)
           Skill-body integration deferred to Phase B (B.T-005)

Phase B — project-status redesign (3-level hierarchy)
  B.T-002  [DONE] New schema (Plan / Initiative / Task) matching aiDeck
  B.T-003  [DONE] Templates for plans/ and initiatives/ directories
  B.T-004  [DONE] Migration script for legacy initiatives (one-time on save)
  B.T-005  [DONE] Update project-status.md skill body (3-level commands)
  B.T-006  [DONE] Exit gates + verifiers infrastructure

Phase C — project-plan skill (new)
  C.T-001  Create skills/en/core/project-plan.md
  C.T-002  Markdown decompose logic (H2/H3 → Plan + Initiatives + Tasks)
  C.T-003  Superpowers integration (optional delegation)
  C.T-004  `adopt` command for retroactive plan capture

Phase D — Hooks rewrite + aiDeck deep integration
  D.T-001  SessionStart hook v2 (3-level + dashboard URL hint)
  D.T-002  Stop hook v2 (drift detection via scope:paths)
  D.T-003  Phase-transition hooks (auto-detect last-task-done)
  D.T-004  MCP client wrapper (graceful degradation)
```

---

## Phase A — Independent of aiDeck

**Goal**: ship value immediately without waiting for aiDeck implementation. These tasks pay dividends even before aiDeck v0.1 lands.

**Dependencies**: none.

**Exit gate**: all 12 skills have valid metadata; installer asks language as communication preference; validation script passes.

### A.T-000 — [DONE] Migrate YAML parser to `yaml` npm package

**Status**: completed in this session.

**Rationale for reordering** (originally B.T-001): the enriched `meta/skills.yaml` requires arrays, inline objects, and block-style lists — features the custom `src/yaml.js` parser explicitly did not support. So this was promoted to a Phase A prerequisite. Confirmed by running the existing `src/yaml.js` against the new `meta/skills.yaml` shape: it mangled arrays to `{}`, examples to last-object-only, and inline lists to strings.

**Changes applied**:
- Added `yaml` ^2.5.0 to `dependencies`
- `src/install.js`, `src/detect.js`: replaced `import { parse as parseYaml } from './yaml.js'` with `from 'yaml'`
- Deleted `src/yaml.js` and `tests/yaml.test.js`
- Updated `skills/en/core/project-status.md` body references (3 places) from `src/yaml.js` to "the `yaml` npm package"

**Exit gate met**:
- `npm test` exits 0 with 195 passing tests (down from 202; removed 7 yaml.js-specific tests)
- `grep -rn "yaml.js"` in `src/` and `tests/` returns no results
- New `meta/skills.yaml` (with arrays, inline objects) parses correctly via `yaml` package

### A.T-001 — [DONE] Enrich `meta/skills.yaml` with new metadata fields

**ARCHITECTURE NOTE** (corrected): atomic-skills already has canonical metadata in `meta/skills.yaml`. Skill `.md` files contain only AI instructions (no frontmatter — `render.js:renderForIDE` generates frontmatter at install time). The migration adds new fields to `meta/skills.yaml`, NOT to `.md` files.

Per [`skill-frontmatter-spec.md`](./kb/skill-frontmatter-spec.md): add the following per skill in `meta/skills.yaml`:

- `title` (required)
- `purpose` (required)
- `when_to_use[]` (required, ≥ 1)
- `when_not_to_use[]` (required, ≥ 1)
- `examples[]` (required, ≥ 1, each with `command` + `description`)
- `schema_version: '0.1'` (required)
- `related[]`, `tags[]`, `ide_compatibility[]`, `requires_args`, `mutates_repo`, `network_required` (optional)

Existing `name` + `description` fields are preserved.

Skills to enrich (all 12, single file edit):

| # | Skill | Mutates | Network | Notes |
|---|-------|---------|---------|-------|
| 1 | project-status | true | false | Core tracking |
| 2 | parallel-dispatch | true | false | Requires args (task list) |
| 3 | parallel-dispatch-audit | partial | false | Read-mostly + minor fixes |
| 4 | hunt | true | false | Requires args (target) |
| 5 | fix | true | false | Optional args |
| 6 | review-code-with-codex | false | **true** | Codex CLI calls |
| 7 | review-plan-internal | true | false | Mutates plan |
| 8 | review-plan-vs-artifacts | true | false | Mutates plan |
| 9 | review-plan-with-codex | true | **true** | Codex CLI calls + plan mutation |
| 10 | prompt | false | false | Pure generation |
| 11 | save-and-push | true | true | Network for push |
| 12 | init-memory | true | false | Setup |

**Exit gate**:
- `meta/skills.yaml` has all required fields for all 12 skills
- `npm run validate-skills` (A.T-003) exits 0
- No regression: `installSkills` still produces same IDE-format frontmatter for unchanged fields

**Verifier**: `node scripts/validate-skills.js` exits 0

**Out of scope for A.T-001**: NO changes to `.md` skill bodies; NO changes to `render.js` (rendered output unchanged for v0.1).

### A.T-002 — [DONE] Installer language refactor

Repurposed `promptLanguageSelection` and removed `skills/pt/`.

**Changes applied**:
1. ✓ Deleted `skills/pt/` directory (12 files removed)
2. ✓ `src/install.js` `processSkill` always reads from `skills/en/` (PT fallback branching removed)
3. ✓ `language` parameter now treated as "communication language", passed as `COMMUNICATION_LANGUAGE` template variable
4. ✓ `src/render.js:renderTemplate` injects a directive at the top of every rendered body:
   `> Communicate with the user in <Language>. Translate any English example strings in this skill at runtime; do not output them verbatim.`
5. ✓ `src/ui.js` `MESSAGES` updated: `selectLang` and `customizeLang` reworded for communication-language context
6. ✓ `tests/project-status.test.js` updated:
   - Old PT-renderring test replaced with two new tests asserting PT and EN directive injection
   - Bilingual `for (const lang of ['pt', 'en'])` loops collapsed to `['en']` (skill source is now EN-only; behavior is the same for both languages)

**Storage**: `language` is already persisted in `.atomic-skills/manifest.json` at install time. No new config file needed.

**Test result**: 179 passing (down from 183 after removing 4 PT-content-specific tests; up from 175 after adding 2 directive-injection tests).

### A.T-003 — [DONE] Skill validation script

Created `scripts/validate-skills.js` validating `meta/skills.yaml` (not `.md` frontmatter — corrected per A.T-001 architecture note).

Validation rules implemented:
- All required fields present (name, title, description, purpose, when_to_use, when_not_to_use, examples, schema_version)
- `name` matches the YAML key
- `schema_version` matches `'0.1'`
- `when_to_use` / `when_not_to_use` are non-empty arrays of non-empty strings
- `examples` is non-empty array; each entry has `command` + `description`
- `requires_args`, `mutates_repo`, `network_required` (when present) are booleans
- `related`, `tags`, `ide_compatibility` (when present) are arrays
- `ide_compatibility` values are in the allowed IDE set
- `related` values reference existing skill names (caught the `project-plan` reference that didn't exist yet — now removed from skills.yaml until Phase C creates the skill)

**Wired**: `npm run validate-skills` in package.json.

**Output on success**: `✓ All 12 skills valid (schema_version 0.1)` (exit 0)

**Output on failure**: per-skill issues with `✖ <location>` headers, indented bullets, summary line, exit 1.

**Performance**: < 200ms for current 12 skills.

### A.T-004 — [DONE] scope:paths detection helper

Standalone helper script: `scripts/detect-scope.js`. Skill-body integration deferred to Phase B (B.T-005) when the project-status skill is rewritten with knowledge of the new schema.

**What's implemented now (Phase A)**:
- `scripts/detect-scope.js` (~150 lines, no deps beyond node:child_process and node:fs)
- Reads N recent commits (default 20) on the current branch via `git log --name-only`
- Groups paths by first `--depth` segments (default 2), counts occurrences
- Outputs YAML snippet ready to paste into an initiative's `scope:` field, OR JSON via `--json`
- Filters single-touch noise unless that would empty the result
- Wired: `npm run detect-scope`

**Flags**: `--branch=<ref>`, `--limit=<n>`, `--depth=<n>`, `--include-deleted`, `--json`, `--help`

**Output example**:
```
# scope:paths inferred from 10 most recent commits on main
# Review and edit before applying to your initiative.
scope:
  paths:
    - 'skills/shared/**'  # 12 touches
    - 'package.json'  # 6 touches
    - 'src/install.js'  # 4 touches
```

**Phase B integration** (deferred to B.T-005): the rewritten project-status skill body will instruct the AI to invoke this script during initiative creation, present the suggestion to the user, and write the accepted scope to the initiative's frontmatter.

---

## Phase B — project-status redesign (3-level hierarchy)

**Goal**: introduce Plan / Initiative / Task hierarchy matching aiDeck schemas.

**Dependencies**: Phase A complete (frontmatter ready, validation in place).

**Exit gate**: project-status can host the sda-v2 v3-redesign plan natively; old initiatives auto-migrate on first save without data loss.

### B.T-001 — [SUPERSEDED — see A.T-000]

This task was promoted to Phase A as a prerequisite for A.T-001's enriched metadata. Completed; see A.T-000 above.

### B.T-002 — [DONE] New schema (Plan / Initiative / Task)

Implemented the schema decided in design session, matching [`@henryavila/aideck/schemas`](../../aideck/src/schemas/) shapes exactly.

Key additions:
- Plan: narrative (markdown body), principles[], glossary[], tracks[], phases[] with exit gates + verifiers, supersedes, references[]
- Initiative: parentPlan (optional), phaseId, audience, exitGates[] with verifiers, scope, body, references[], crossTaskRefs[]
- Task: description, outputs[], tags[], resourceCounts, per-task verifier

**Architectural note** (clarification vs. original plan): aideck's TypeScript interfaces remain the conceptual source-of-truth shape, but atomic-skills ships JSON Schema mirrors in `meta/schemas/` so the contract is machine-checkable from the YAML side without taking a dep on aideck's TS toolchain. Drift between the two is caught the moment a fixture from one side fails the other side's validator.

**Changes applied**:
- `meta/schemas/common.schema.json` — primitives (schemaVersion const `0.1`, IsoTimestamp pattern, slug pattern, ArtifactRef, ExitCriterion, ExitCriterionVerifier with shell/query/test/manual oneOf)
- `meta/schemas/plan.schema.json` — Plan + PhaseDescriptor + InterPhaseGate + supersedes; `narrative` excluded from frontmatter schema (lives in MD body)
- `meta/schemas/initiative.schema.json` — Initiative + Task + StackFrame + ParkedItem + EmergedItem + CrossTaskRef; `body` excluded from frontmatter schema (lives in MD body)
- `scripts/validate-state.js` — ajv-backed CLI (draft 2020-12), wired as `npm run validate-state`. Accepts files or directories; infers kind from path (`plans/` vs `initiatives/`).
- `tests/fixtures/state/{plans,initiatives}/v3-*.md` — copies of aideck demo fixtures (sda-v2 v3-redesign with 9 phases + v3-f0 initiative with 8 tasks)
- `tests/fixtures/state/invalid/{plans,initiatives}/` — negative fixtures
- `tests/validate-state.test.js` — 12 tests: positive validation, negative validation, frontmatter parsing edge cases, round-trip (parse → stringify → parse → deep-equal; plus write-to-disk → re-parse → re-validate)
- `package.json` — `ajv ^8.17.1` added to dependencies

**Exit gate met**:
- `node scripts/validate-state.js tests/fixtures/state` exits 0 for v3-redesign.md (9 phases) and v3-f0-foundation-repair.md (8 tasks, multiple verifier kinds, crossTaskRefs)
- Negative fixtures (missing-required, wrong-schema-version) exit 1 with field-level errors
- Round-trip test: `parseYaml(stringifyYaml(parsed)) deepStrictEqual parsed` for both plan and initiative
- `npm test` exits 0 with 191 passing (179 existing + 12 new)
- `schemaVersion: '0.1'` enforced via JSON Schema `const`

**Deferred to B.T-005**: documenting all schema fields in the skill body (project-status.md rewrite).

### B.T-003 — [DONE] Templates for plans/ and initiatives/

Updated `skills/shared/project-status-assets/`:

- `initiative.template.md` → camelCase 3-level shape; uses a sentinel-marked `plan-membership-block` so the skill (B.T-005) can strip it for standalone or fill `parentPlan`/`phaseId` for in-plan initiatives
- `plan.template.md` → **new file**; Plan template with frontmatter principles, glossary, phases (with exit-gate scaffold), references; markdown body for narrative
- `PROJECT-STATUS.md.template.md` → hierarchical view: Active Plans table + Active Initiatives (standalone) table + Recently Archived + Ad-Hoc Sessions Log. Frontmatter now camelCase + `schemaVersion: '0.1'`.
- `CLAUDE.md-gate.template.md` → bumped to v2.0.0; HARD-GATE now resolves Plan → Phase → Initiative → StackFrame; resolution rules expanded with the 5 disambiguation options (continuation / lateral / new-phase-of-plan / new-standalone / ad-hoc); drift detection mentioned as step 6.
- `bootstrap-draft.template.md`, `bootstrap-archived.template.md` → migrated to camelCase + `schemaVersion: '0.1'`; new required fields (goal, lastUpdated, nextAction). Bootstrap-only fields (`proposedAt`, `proposedBucket`, `bootstrap:` block, free-form `planLink`) live alongside; `draftToInitiative` strips them on commit.

**Code changes**:
- `src/bootstrap.js` `draftToInitiative` rewritten: produces camelCase output, folds `planLink` (if non-sentinel) into a structured `references[]` entry on commit, then deletes the bootstrap-only fields.
- `tests/bootstrap.test.js` fixture migrated to camelCase + added 3 new tests covering planLink folding (file/url classification + REPLACE_* sentinel guard).
- `tests/project-status.test.js` template-marker assertion updated to also check the new 3-level shape (schemaVersion, camelCase fields, no legacy `initiative_id` / `scope_paths`).
- `tests/validate-state.test.js` + 3 new tests: standalone-mode initiative template + in-plan-mode initiative template + plan template each validate against the JSON schemas.
- `tests/install.test.js` asset counts incremented for the new `plan.template.md` (7 → 8 project-status assets).

**Exit gate met**:
- Templates produce valid YAML matching new schemas (3 new tests in validate-state.test.js)
- `npm test` exits 0 with 198 passing (191 prior + 7 new)
- PROJECT-STATUS.md template renders the 3-level hierarchical view (Active Plans + Active Initiatives + Archive + Ad-Hoc)

### B.T-004 — [DONE] Migration script for legacy initiatives

Pure-function transform; the interactive prompt (standalone vs in-plan; force-migrate-or-abort) lives in the skill body (B.T-005). Keeping the transform pure makes it trivially testable and reusable from a `node -e` one-liner.

**Changes applied**:
- `src/migrate.js`: `migrateLegacyInitiative(legacy, opts) → { migrated, frontmatter }`.
  - Idempotent: if `schemaVersion === '0.1'`, returns `{ migrated: false, frontmatter: legacy }`.
  - Throws on unsupported future `schemaVersion` (anything not in {undefined, '0.1'}).
  - Throws if input lacks both `initiative_id` and `slug`.
  - Plan membership is caller-driven: `opts.parentPlan` + `opts.phaseId` for in-plan; omit for standalone.
- `tests/fixtures/state/legacy/initiatives/sample-legacy.md`: representative legacy file (snake_case, tasks-as-map, plan_link, worktree, wip_limit, stack `type: initiative`).
- `tests/migrate.test.js`: 17 tests covering mapping, idempotency, error paths, schema validity of the migrated output.

**Field mapping**:

| Legacy (snake_case)                              | 0.1 (camelCase)                                | Notes |
|--------------------------------------------------|------------------------------------------------|-------|
| `initiative_id`                                  | `slug`                                         |       |
| `last_updated`                                   | `lastUpdated`                                  |       |
| `next_action`                                    | `nextAction`                                   |       |
| `scope_paths: [...]`                             | `scope: { paths: [...] }`                      |       |
| `stack[].opened_at`                              | `stack[].openedAt`                             |       |
| `stack[].type === 'initiative'`                  | `stack[].type === 'task'`                      | new enum doesn't have `initiative` |
| `parked[].surfaced_at`, `from_frame`             | `parked[].surfacedAt`, `fromFrame`             |       |
| `emerged[].surfaced_at`                          | `emerged[].surfacedAt`                         |       |
| `tasks: { T-001: {...} }` (map)                  | `tasks: [{id: 'T-001', ...}]` (array)          | each task: `closed_at→closedAt`, `last_updated→lastUpdated`, `blocked_by→blockedBy` |
| `plan_link: <string>`                            | `references[]` entry                           | folded, not dropped |
| `worktree`, `wip_limit`                          | (dropped)                                      | not in 0.1 schema |
| bare-date `started: 2026-04-01`                  | `started: '2026-04-01T00:00:00Z'`              | normalized to full ISO timestamp |
| missing `goal`                                   | `goal: <first-stack-frame.title>`              | with a sentinel fallback if no stack |

**Exit gate met**:
- Migrated output validates against `initiative.schema.json` (verified by writing to temp file + invoking `validateFile`)
- All required 0.1 fields populated (asserted)
- Idempotency verified (re-running on migrated frontmatter returns `migrated: false` + identical object)
- `plan_link` not dropped — folded into structured `references[]`
- `npm test` exits 0 with 215 passing (198 prior + 17 new)

**Deferred to B.T-005**: the interactive prompt + the "user cannot bypass migration" enforcement — those are skill-body concerns, not pure-function concerns.

### B.T-005 — [DONE] Update project-status.md skill body

Rewrote skill instructions for the 3-level model. Edited `skills/en/core/project-status.md` incrementally to preserve the bootstrap pipeline content while extending the surrounding model.

**Changes applied**:
- Header: now describes the 3-level model + references `meta/schemas/` as the authoritative contract.
- Iron Law: extended to "anchored initiative — standalone OR under an active plan".
- Initial detection: detects active Plan + currentPhase first, then resolves Initiative.
- Setup §6: creates `.atomic-skills/plans/archive/` alongside `initiatives/archive/`.
- Setup §7: gitignore adds `plans/*.rendered.md`.
- View modes: added `--plan [<slug>]` (bird's-eye, principles + phase table + inter-phase gates) and `--phase [<phase-id>]` (current phase detail). Default view prepends `<plan-slug>/<phaseId>` when the initiative has plan membership. `--list` now shows two tables (plans + standalone initiatives).
- **New section: Schema reference** — quick reference for Plan / Initiative / Task / nested types (StackFrame, ExitCriterion, verifier oneOf, CrossTaskRef). Fulfils the deferred goal from B.T-002 ("All schema fields documented in skill body").
- Mutation modes prelude: **Pre-mutation migration check** documented as a HARD-GATE step on every load — abort if `schemaVersion` is missing and user declines migration. Cites `src/migrate.js`:`migrateLegacyInitiative` and the standalone-vs-in-plan choice.
- `new-plan <slug>` (new): copies `plan.template.md`, optional superpowers delegation, offers to chain into the initial phase initiative.
- `new <slug>` (updated): asks standalone-or-in-plan; handles the `plan-membership-block` sentinel (strip for standalone, fill for in-plan); offers `detect-scope` suggestion.
- `push` / `park` / `emerge` / `promote` (updated): all field names switched to camelCase (`openedAt`, `surfacedAt`, `fromFrame`, `lastUpdated`); `promote` now writes to a tasks **array** (not map).
- `done <task-id>` (extended): after closing, counts remaining open tasks; if zero AND under a plan, prompts user to invoke `phase-done` (user opts in — never auto).
- `phase-done` (new): iterates exit gate criteria (phase + initiative), runs shell verifiers via {{BASH_TOOL}}, asks user for manual acks, marks `status: met / deferred / pending` with `metAt` / `deferredReason`. On all-met, sets initiative `status: done`, updates plan's phase status, proposes phase advance via `dependsOn` graph.
- `phase-reopen` (new): reverse of phase-done; resets criteria to `pending`, sets initiative back to `active`.
- `detect-scope` (new): wraps `scripts/detect-scope.js --json`, presents groupings as checklist, merges accepted globs into the active initiative's `scope.paths`.
- `migrate <slug>` (new): explicit migration trigger calling `migrateLegacyInitiative`, with the standalone-vs-in-plan choice flow and a post-migration `npm run validate-state` invocation.
- `archive` (extended): plan archival propagates to all child initiatives (status: archived + moved to archive subtree).
- `switch` (extended): works at 2 levels — switching plans pauses any other active plan; switching initiatives across plans warns and offers to also switch the plan.
- Disambiguation flow: 5 options (continuation / lateral / new-phase-of-plan / new-standalone / ad-hoc) — matches the gate template's resolution rules.
- `--browser`: separate render templates for Plan view (principles, glossary, mermaid phase graph with `dependsOn` edges, phase table) vs Initiative view (gantt of tasks, dependency flowchart from `blockedBy`, exit gates checklist, cross-task refs).
- `--report`: emits Plans section + Initiatives section; open-exit-gates count surfaced.
- Red Flags: 3 new items (legacy snake_case edit, phase-done without verifying gates, branch ≠ currentPhase).
- Rationalization table: 3 new rows (legacy in-place edit, manual verifier bypass, phase advance without gates).
- Bootstrap section: field references updated (`slug` regex, `schemaVersion: '0.1'` validation step, `nextAction`/`goal` generation per draft).

**Tests added** (`tests/project-status.test.js`, 6 new):
1. 3-level commands (`new-plan`, `phase-done`, `phase-reopen`, `detect-scope`, `migrate`) each documented under their own `### \`<cmd>\``.
2. `--plan` and `--phase` view modes documented.
3. Pre-mutation migration check section exists; `migrateLegacyInitiative` referenced; 5-option disambiguation flow present.
4. Schema reference section documents Plan + Initiative + nested types + all 4 verifier kinds.
5. **camelCase enforcement** — skill body must not contain `initiative_id`, `scope_paths`, `opened_at`, `surfaced_at`, `from_frame`; MUST contain camelCase variants (`lastUpdated`, `nextAction`, `openedAt`, `surfacedAt`, `fromFrame`).
6. `archive` documents plan propagation; `switch` documents 2-level switching.

**Exit gate met**:
- `npm test` exits 0 with 221 passing (215 prior + 6 new)
- Every new command has expected behavior + exit criteria documented (asserted by tests 1-3)
- HARD-GATE was already plan/phase-aware after B.T-003 (template); the skill body now references it for the pre-mutation check and disambiguation flow.

### B.T-006 — [DONE] Exit gates + verifiers infrastructure

Implemented as a named workflow ("Verifier execution patterns") in the skill body, plus an optional `evidence` block on `ExitCriterion` in the JSON Schema so verifier output persists on disk.

**Changes applied**:

- `meta/schemas/common.schema.json`: `ExitCriterion.evidence` (optional object). Required sub-fields: `verifierKind`, `verifiedAt`. Optional: `passed`, `exitCode` (shell), `rowCount` (query), `outputSummary` (truncated excerpt or user note). `additionalProperties: false` so spurious fields surface as errors.

- `skills/en/core/project-status.md`: dedicated section **"Verifier execution patterns (`verify_exit_gate` workflow)"** documenting the four kinds (shell, manual, query, test) with explicit per-kind UX flow. Workflow contract:
  - `evidence` is REQUIRED to set `status: met` when a verifier is present.
  - Without `evidence`, the criterion stays `pending` (manual override → `deferred` with `deferredReason`).
  - Shell: AI runs the command via {{BASH_TOOL}}, captures exit code + stdout tail (≤500 chars), compares with `expectExitCode`.
  - Manual: AI asks user for ack; user's note becomes `outputSummary`.
  - Query / Test: declared in v0.1 schema, execution stubbed — user runs externally and reports result; the skill stores it as evidence.
  - Per-task `verifier:` fields use the same workflow; result is recorded inline in the task description until v0.2 extends `Task` with its own `evidence` block.

**Tests added** (`tests/validate-state.test.js`, 2 new):
1. Initiative with three exit gates carrying full evidence blocks (shell, query, manual) validates.
2. Evidence block missing `verifierKind` + `verifiedAt` is rejected by schema.

**Tests added** (`tests/project-status.test.js`, 1 new):
- "Verifier execution patterns" section exists; all 4 verifier kinds get their own `#### \`kind: ...\`` subsection; evidence YAML shape documented; per-task verifier path documented.

**Exit gate met**:
- `verify_exit_gate` workflow exists in skill body (asserted)
- Real sda-v2 F0 gates can be verified: the v3-f0-foundation-repair fixture uses shell + query + manual verifier kinds, and a synthesized "verified" version with `evidence` blocks validates against the schema (asserted by validate-state.test.js).
- Manual gates require explicit user confirmation (documented in the workflow section + Rationalization row added in B.T-005).
- `npm test` exits 0 with 224 passing (221 prior + 3 new).

**Schema drift note** (for aideck side): the `evidence` block was added to atomic-skills' JSON Schema first. The aideck TypeScript `ExitCriterion` interface should be extended to mirror it in a follow-up. Until then: aideck readers will silently ignore the field; atomic-skills writers will populate it. No breakage either way.

---

## Phase C — project-plan skill (new)

**Goal**: provide the entry point for starting planning work. Resolves the "skill silent during planning" root problem.

**Dependencies**: Phase B complete (project-status hosts plans).

**Exit gate**: user invokes `project-plan v3-redesign`, gets a Plan + N Initiatives with tasks populated, ready to execute.

### C.T-001 — Create skills/en/core/project-plan.md

New skill file with:
- Frontmatter per A.T-001 schema
- Body: 5-7 stages of planning flow
- Stages: validate slug → detect superpowers → optional delegation → receive markdown plan → decompose → create Plan + Initiatives → activate first phase

**Exit gate**: skill file exists with valid frontmatter, body covers all required behaviors

### C.T-002 — Markdown decompose logic

Skill instruction for parsing structured markdown into Plan + Initiatives + Tasks:

- H1 / first paragraph → Plan title + narrative
- Sections with "Principles" → principles[]
- Sections with "Glossary" → glossary[]
- H2 (with pattern `F<N>` or similar) → PhaseDescriptor + Initiative
- H3 within H2 → Task within that Initiative
- Code blocks declaring `exit_gate:` or `verifier:` → ExitCriterion

Convention is opportunistic — skill applies heuristics, then asks user to confirm/edit.

**Exit gate**:
- A test fixture markdown (similar to v3-redesign) decomposes into expected Plan + Initiatives + Tasks
- User can edit before confirmation

### C.T-003 — Superpowers integration

Detect if superpowers is installed:
```
test -d ~/.claude/plugins/superpowers || which superpowers
```

If available:
- Offer to invoke `superpowers:brainstorm` for discovery
- Then `superpowers:write-execution-plan` for structure
- Receive resulting markdown
- Pipe through C.T-002 decompose

If not available:
- Ask user for existing plan file OR
- Provide minimal template

**Exit gate**:
- With superpowers: full delegation flow works
- Without superpowers: fallback flow works
- Skill never errors when superpowers absent

### C.T-004 — `adopt` command

`atomic-skills:project-plan adopt <plan-file.md>` — retroactive capture.

Resolves the sda-v2 use case TODAY: takes the existing 843-line `00-master.md` and materializes Plan + 9 Initiatives.

Behavior:
- Parse the markdown file with same decompose logic as C.T-002
- Present preview to user (Plan summary + N initiatives + total tasks)
- On confirmation: write all files to `.atomic-skills/project-status/`
- Optionally archive the source file

**Exit gate**:
- Running `project-plan adopt docs/superpowers/plans/v3-redesign/00-master.md` in sda-v2 creates valid Plan + 9 Initiatives + 61 tasks
- User can review/edit before commit

---

## Phase D — Hooks rewrite + aiDeck integration

**Goal**: rebuild hooks per the 3-level + dashboard-aware design. Add MCP client wrapper for graceful aiDeck integration.

**Dependencies**: Phase B complete (3-level schema exists). aiDeck v0.1 implemented (for MCP integration). Phase D can ship in two parts if aiDeck delayed.

**Exit gate**: SessionStart re-anchors correctly; Stop detects drift; phase-transition prompts fire on last-task-done; MCP wrapper falls back gracefully when aiDeck absent.

### D.T-001 — SessionStart hook v2

Rewrite the SessionStart hook. New behavior:

1. Read `.atomic-skills/project-status/` state
2. Detect active Plan + current_phase
3. Verify current branch matches phase's `branch:` field
4. If mismatch → prompt: "Branch suggests phase X, but current_phase is Y. Switch?"
5. If current_phase has 0 pending tasks but not marked done → prompt phase-transition
6. If aiDeck running → include URL in injected context
7. Inject hierarchical PROJECT-STATUS.md content into AI's session

**Exit gate**:
- Hook fires on session start
- Detects current state correctly in real repo (sda-v2 once migrated)
- Surfaces phase-transition prompt when applicable
- Graceful when no plan exists (just shows ad-hoc state)

### D.T-002 — Stop hook v2 (drift detection)

Rewrite Stop hook with drift detection:

1. List files written during the session (via `tool_use_log` or similar)
2. Read current_phase's `scope.paths`
3. Compare:
   - 100% writes within scope: silent OK
   - >50% writes outside scope: surface warning "session wrote in F3 paths while current_phase is F0. Switch?"
4. Standalone initiatives without scope: no drift check
5. Output dry-run mode for first 7 days (decision-tree, no actual blocking)

**Exit gate**:
- Drift detected correctly with synthetic fixture (write to phase B paths while phase A active)
- No false positives on scope-less initiatives
- Dry-run mode prevents enforcement during shakedown

### D.T-003 — Phase-transition hooks

Whenever `done T-NNN` marks the last pending task of a phase:

1. Iterate exit_gates of the phase
2. For each: present to user with criterion + verifier
3. User responses: met / deferred / pending
4. If all met → archive phase initiative, set current_phase to next per dependency graph, open new initiative's stack frame
5. If any deferred → mark deferred with reason
6. If pending → ask "Phase has pending gates. Mark phase done anyway? (y/N)"

**Exit gate**:
- Closing last task triggers transition flow
- All exit gates iterated
- Phase advances correctly per dependency graph
- User can defer / skip with explicit confirmation

### D.T-004 — MCP client wrapper

Helper script / pattern in skill body: detect aiDeck, use MCP if present, fall back to direct file writes.

Convention in each mutating command:
```
If aideck_* MCP tools are available:
  Use aideck_mark_task_done(slug, task_id) etc.
Else:
  Read file → mutate frontmatter → write file
```

Document the pattern. Validate with mini fixture (run skill with and without aiDeck running).

**Exit gate**:
- Skill works identically with or without aiDeck running
- When aiDeck running: mutations go via MCP (verifiable via aiDeck's state)
- When aiDeck absent: files directly mutated

---

## Composite definition of done (whole migration)

All of:

- [ ] Phase A exit gates met (4 tasks)
- [ ] Phase B exit gates met (6 tasks)
- [ ] Phase C exit gates met (4 tasks)
- [ ] Phase D exit gates met (4 tasks)
- [ ] Reference target: project-plan in sda-v2 successfully captures v3-redesign with 9 plans + 61 tasks via `adopt` command
- [ ] aiDeck renders the resulting data correctly (visual smoke test)
- [ ] All previously passing tests still pass
- [ ] No data loss on migration of any legacy initiative

## Versioning impact

This is a **breaking change** for atomic-skills. Version bump: 1.8.1 → **2.0.0**.

Migration notes published in CHANGELOG:
- `skills/pt/` removed (EN-only)
- project-status frontmatter format breaking
- New skill: project-plan
- New install-time prompt: communication language
- Hooks rewritten

## Open questions surfaced during migration

These may emerge and need decisions during execution; capture here:

- (none yet)

---

## Tracking

Once project-status v2 is bootstrapped on THIS repo (Phase B complete), we can dogfood: each remaining task tracked as a real Task in a `.atomic-skills/initiatives/migration-v2-*.md` initiative.

For now, this document IS the canonical menu. Update it as decisions evolve.
