# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Install GREENFIELD_CONFLICT when expanding IDEs / partial journal.** Pre-existing skill files on disk that were missing from the journal `reconcileFileSet` beforeState (e.g. Claude leftovers while the journal only tracked Grok) no longer abort install. Desired paths already on disk are adopted into the journal before the Driver runs so the 3-hash update can rewrite them. Regression: `tests/install.test.js` + `tests/adopt-preexisting-desired.test.js`.

### Breaking

- **Installer modules concept removed.** There is no optional module selection (`memory`, `auto-update`, `cross-model-bridge` / `codex-bridge` as modules). Features remain always-on:
  - `init-memory` is a **core skill** (always installed); memory path is fixed at `.ai/memory/` (custom `memory_path` is no longer configurable; reinstall warns if an older manifest had a different path).
  - Cross-model sealed-envelope assets remain under `skills/shared/codex-bridge-assets/` (always installed).
  - Auto-update remains a **runtime layer** (SessionStart hook on capable hosts).
- Catalog is **core-only**: top-level `modules` / `module_meta` keys fail `validate-skills`.
- README no longer has a Modules section (markers dropped; generation uses four regions).

### Changed

- Manifest no longer writes a `modules` field.
- Installer UI no longer offers “Change modules”.

### Product docs site cutover

Canonical human product docs: **https://atomic-skills.henryavila.com** (static site under `site/dist/`, CI via `.github/workflows/deploy-docs.yml`). Offline: `npm run generate-site` then open `site/dist/index.html`.

- **Catalog v0.3 product fields.** Top-level `product:` (what_is / what_is_not / docs_url / install.primary) and per-skill `iron_law` are validated SSOT for the README envelope and site generators.
- **Slim README.** npm/GitHub envelope only: positioning, install, host tiers, compact skills table. Long skill blurbs and module essays live on the product docs site, not in README body regions.
- **Engineering archive stays off the product site.** `docs/kb/`, `docs/design/`, plans, audits, and handoffs remain repo MD for agents and maintainers; they are not published as product pages. Generated per-skill Markdown under `docs/skills/` remains a secondary offline/GitHub view (site is the canonical human product surface).

## [2.0.0] — 2026-05-23

First major bump since 1.8.x. Consolidates **five** threads of work — the
review skills refactor (4 → 2 with a mode picker), the catalog v0.2 schema
+ rename to `meta/catalog.yaml`, a README + dashboard doc generator with
five marker-bounded regions, a husky auto-regen pre-commit hook, and the
unification of `project-status` + `project-plan` into a single `project`
skill (a thin router + lazy-loaded detail files).

### `project` skill unification (supersedes the project-status / project-plan split below)

- **`project-status` + `project-plan` → one `project` skill.** The earlier
  v2.0.0 work split tracking across two sibling skills (VIEW vs CREATE);
  the boundary leaked (each cited the other 17–24×, the reconciliation gate
  and emergence ladder crossed both). Both are now fused into a single
  `atomic-skills:project` skill. Since v2.0.0 has not shipped, this is not a
  field-breaking rename — it rides inside the unreleased 2.0.0 (no extra bump).
- **Thin router + progressive disclosure.** `skills/core/project.md` is a
  ~175-line router holding only the dispatch table, the no-args compact
  summary, and the always-resident invariants (Iron Law, pre-mutation
  gates, gate-status invariant, ratify gate, the emergence-ladder
  magnitude→action table + ambient-trigger recognition, the `new` menu,
  schema quick-ref). Every subcommand's full procedure lives in a lazy
  detail file under `skills/shared/project-assets/project-<x>.md`, read on
  demand via `{{ASSETS_PATH}}`. This is the proven `review-plan` pattern —
  invoking `project` no longer loads ~25k tokens of body up front.
- **Git-style grammar.** `/atomic-skills:project status [--browser|…]`,
  `new plan|initiative`, `done|push|pop|park|emerge|promote|…`,
  `adopt|discover|migrate|split-phase`. Bare `/atomic-skills:project`
  prints a cheap 5-line summary (no browser). `new` exposes only the two
  file entities (plan, initiative); phase/task are intent-driven via the
  ladder (`new-task`/`new-phase` still valid if typed).
- **`verify` (NEW).** Reconciles `.atomic-skills/` against the repo
  in one command — schema validity, legacy detection, branch match, scope
  coverage, orphan detection, aiDeck coherence. Read-only by default;
  `--fix` applies only the safe schema normalization.
- **aiDeck contract quarantined.** All aiDeck coupling (ensure-aideck
  script, STATE_ERROR auto-repair, the `state/project-status` domain
  string) lives in `project-view.md` behind a single named constant
  (`AIDECK_STATE_DOMAIN`). The aiDeck state-domain key stays `project-status`
  — it is a cross-repo contract with the aiDeck parser, NOT the skill name.
- **Asset dirs consolidated.** `project-status-assets/` + `project-plan-assets/`
  → `project-assets/` (flat, files-only — `install.js` copies non-recursively).
- `project-status` and `project-plan` added to
  `HISTORICAL_ATOMIC_SKILLS_NAMES` so update cleanups recognize the old
  names. Orphan docs `docs/skills/project-{status,plan}.md` removed; the
  merged test suite lives in `tests/project.test.js`.

### Project-status / project-plan split (earlier in 2.0.0; now superseded above)

### Project-status / project-plan refactor

- **`project-status` shrinks from 23 → 15 subcommands.** Only view + daily
  mutation commands remain (push, pop, park, emerge, promote, done,
  phase-done, phase-reopen, archive, switch, re-ratify, scope-creep, why,
  detect-scope, review-due). Skill body drops from 1347 → 908 lines.
- **`project-plan` absorbs all CREATE + STRUCTURAL + MIGRATION commands:**
  default bootstrap, `adopt`, `discover` (NEW), `new`, `new-task`,
  `new-phase`, `split-phase`, `migrate`, `re-bootstrap`. Skill body grows
  from 415 → 865 lines.
- **`discover` subcommand (NEW, renamed from the legacy `bootstrap`).**
  Multi-source scan (git, github, docs, roadmap, `.ai/memory/`, custom
  paths via `--scan=<path>`) → cluster → synthesize → propose Plans +
  Initiatives in one preview. Extended with plan-detection heuristic
  (`detectPlanShape` in `src/bootstrap.js`): markdown sources with ≥ 2
  phase headings (`## F0`, `## Phase 0`, `## Fase 0`) route through
  `decomposePlan` + `materializeDecomposition` to become Plans, not just
  standalone Initiatives. Closes the gap where the legacy `bootstrap`
  only produced flat initiatives even when the source had phase structure.
- **Verb-based mental model:** "track existing state" → `project-status`;
  "create or restructure state" → `project-plan`. Single entry-point for
  "I don't know where to start" is `project-plan discover`.
- PROJECT-STATUS.md template + skill cross-references updated to point at
  the new homes for moved commands. No backwards-compat aliases — this
  ships before the v2.0.0 publish.

### Cross-model review fixes (origin/main..HEAD @ 2026-05-24)

Following the local + codex review on the v2.0.0 prep branch
(`.atomic-skills/reviews/20260524-055236-origin-main-to-head-v2-refactor.md`),
the following fixes were applied:

- **Husky pre-commit guard** (F-001 from codex, major): hook now refuses to
  regenerate when `README.md` or `src/dashboard/data/skills.generated.ts`
  have unstaged changes. Without this guard the auto-`git add` would sweep
  unrelated hand-edits into the commit. Shell test in
  `tests/hooks/pre-commit.test.sh` covers the abort path.
- **Safe legacy cleanup** (F-002 from codex blind, dropped via constraints
  but applied anyway): `findLegacyOrphans` now returns `{path, safe}`
  per file; only files whose frontmatter `name:` matches a known
  atomic-skills artifact (current catalog + `HISTORICAL_ATOMIC_SKILLS_NAMES`
  safelist) are deleted in `--yes`. Unrecognized files at the legacy path
  are preserved with a clear warning.
- **Root catalog version validation** (F-003): `validateCatalogVersion`
  enforces `data.version === '0.2'`. Opt-in via `requireCatalogVersion`
  (CLI on, tests off).
- **`release_highlight` validation** (S2): `validateReleaseHighlight`
  rejects garbage `{body: 42}` before the renderer throws.
- **`detectPlanShape` code-block awareness** (T11): state-machine pass
  over lines so phase headings inside fenced code blocks (```python\n##
  Phase 1) don't false-positive as Plan candidates.
- **`removeLegacyOrphans` path-aware boundary** (L1): switched from
  `parent.startsWith(legacyRoot)` to `parent === legacyRoot ||
  parent.startsWith(legacyRoot + path.sep)`. Defensive against
  prefix-collision siblings.
- **Silent failure surfaced** (E1): `removeLegacyOrphans` now logs
  `[atomic-skills] could not remove <path>: <err>` when `unlinkSync`
  fails, instead of swallowing.
- **`bootstrap-index.template.md` command rename** (C1 from local):
  template instruction `atomic-skills:project-status bootstrap --commit`
  → `atomic-skills:project-plan discover --commit` to match the
  project-status/project-plan refactor.
- **Codex invocation portable on macOS** (skill body fix):
  `skills/shared/codex-bridge-assets/invocation-canonical.txt` now
  documents a detector that picks `timeout` / `gtimeout` / `perl -e
  'alarm shift @ARGV; exec @ARGV' --` based on what's available. Native
  macOS users no longer hit `command not found: timeout`.

Test coverage delta: 425 → 474 (+49 new unit tests across
`validateModuleMeta`, `validateReadmeMentions`, `validateCatalogVersion`,
`validateReleaseHighlight`, `findLegacyOrphans`, `removeLegacyOrphans`,
`isAtomicSkillsArtifact`, `detectPlanShape` code-block, `status` forceProject)
plus 3 shell tests for `.husky/pre-commit`.

### Breaking changes

- **Removed `review-plan-internal` and `review-plan-vs-artifacts`** — merged
  into a single `review-plan` with a Step 0 cross-ref picker.
- **Removed `review-plan-with-codex` and `review-code-with-codex`** — merged
  into `review-plan` and `review-code`. The codex cross-model envelope is
  now opt-in via a Step 0 mode picker.

  Migration for all four removals: replace the old slash command with
  `/atomic-skills:review-{plan,code}` and answer the picker (`local`,
  `codex`, `both`, default `both`). Non-interactive callers must pass
  `--mode=<x>`.

- **Catalog schema bumped to `0.2`** — every entry gained the required
  fields `one_liner`, `emoji`, `version_added` (plus optional `subcommands`,
  `args`, `output_artifacts`, `dependencies`). `schema_version: '0.1'` is
  no longer accepted; legacy entries must be migrated before validating.
- **Catalog file renamed `meta/skills.yaml` → `meta/catalog.yaml`** with a
  new top-level `version: '0.2'` field. Consumers within the package
  (installer, detector, validators, generators, dashboard helpview) all
  updated; no external API change since `meta/` ships in the tarball but
  is not a documented public surface.

### Added

- **`review-plan`** — merged same-model + cross-reference plan review with
  `{{ASK_USER_QUESTION_TOOL}}` at Step 0a (mode picker) and Step 0b
  (cross-ref picker, orthogonal). Detects artifacts under common section
  headings, classifies LOCAL paths vs URLs, runs the 7 internal + 6
  cross-ref checks. Activates a HARD-GATE ("plan corrected, artifacts never
  edited") on cross-ref mode.
- **`review-code`** — same-model adversarial review of a git ref. 7-item
  checklist (logic bugs, race conditions, error handling, schema/migrations,
  API contracts, file/function references, test coverage). Range-aware ref
  validation (triple-dot detected first, then double-dot, then single),
  shape-specific diff command that avoids the `git diff <single-ref>`
  worktree-leak bug.
- **Step 0 mode picker (`local` | `codex` | `both`, default `both`)** in
  both review skills. `both` runs local first (cheap, fast) then codex on
  the CLEANED artifact / SAME captured diff. Honors `--mode=...` for
  non-interactive use.
- **Sealed envelope preservation in `both` mode** — the codex briefing
  receives only the cleaned artifact + external constraints, never the
  local findings or fix log. Anti-framing rule baked into the skill body
  and Red Flags table (cites [arXiv 2603.18740](https://arxiv.org/abs/2603.18740)).
- **`review-code` captured-diff invariant** — both phases consume the same
  `CAPTURED_DIFF` materialized once via the shape-specific git command;
  `git diff` is never re-run. Guarantees byte-identical material across
  reviewers.
- **`{{ASK_USER_QUESTION_TOOL}}` template variable** — resolves to
  `AskUserQuestion tool` on Claude Code and to a descriptive plain-text
  fallback on every other IDE. Documented in `CLAUDE.md`, `AGENTS.md`,
  `docs/kb/gemini-cli-compatibility.md`.
- **Argument contract** documented at the top of both review skill bodies:
  `--mode=local|codex|both|internal`, `--no-cross-ref`, `--cross-ref=...`,
  `--allow-dirty`, plus the non-interactive abort policy.
- **G1+G2+G6 code-quality gates** in the merged review skills, plus a
  self-review block printed before closing.
- **README is fully generator-driven for catalog-coupled content.** Five
  marker pairs are populated from `meta/catalog.yaml` (+ `src/config.js`):
  `IDES_TABLE`, `VERSION_NOTE`, `SKILLS_TABLE`, `SKILL_DETAILS`, `MODULES`.
  The 230-line hand-written `<details>` prose duplicate was deleted.
- **Dashboard data generator** (`scripts/generate-helpview-data.js`) emits
  `src/dashboard/data/skills.generated.ts` consumed by HelpView; subcommands
  now render in the detail panel.
- **`module_meta` block** in catalog (sibling of `modules:`, not a reshape)
  carries per-module `title / version_added / intro / features / notes`
  and is cross-checked against `modules` (no orphans, no missing).
- **`release_highlight` block** in catalog carries the editorial body of
  the versioned `> Note (vX.Y.Z):` callout; version is pulled from
  `package.json` so the two cannot disagree.
- **README static-prose lint** in `scripts/validate-skills.js` fails when
  an `atomic-skills:<name>` mention does not resolve to any catalog entry.
- **Husky pre-commit auto-regenerates docs** when any generator input is
  staged (`meta/catalog.yaml`, `skills/en/**`, `src/config.js`,
  `package.json`, renderer code) and re-stages `README.md` +
  `src/dashboard/data/skills.generated.ts` so the commit captures inputs
  and outputs atomically. Hand-edits to README static sections are
  preserved across regen runs.

### Changed

- `review-plan` Step 0 split into Step 0a (mode picker) + Step 0b
  (cross-ref picker). The two pickers are orthogonal — cross-ref selection
  applies to every mode.
- `review-code` Step 0 simplified to a single mode picker; ref validation
  and diff capture moved to a dedicated "Argument & diff capture contract"
  section that runs BEFORE the picker so abort paths (invalid ref, dirty
  tree without `--allow-dirty`) do not depend on TTY.
- `ACCEPTED_SCHEMA_VERSIONS` narrowed to `{ '0.2' }`.
- Skill catalog: 13 → 11 entries (4 review skills removed, 2 added; net -2).
- Body-↔-catalog parity check enforced; `## Iron Law` heading required
  after normalizing 4 bodies that previously used `## Fundamental Rule`.
- `validate-catalog` (= `validate-skills` + `check-docs`) gated by husky
  pre-commit and GitHub Actions `test.yml` on every push/PR.

### Fixed

- `review-code-with-codex` (later removed in this release) had a Step 2 bug
  where `git rev-parse --verify <ref>` rejected revision-range syntax —
  `main..HEAD` failed even when both endpoints existed. The ref-shape
  detection now lives in the new `review-code`.

### Rationale

Empirically verified across two consecutive sessions (2026-05-21 and
2026-05-22), local self-review and codex cross-review catch DISJOINT sets
of findings — neither subsumes the other (literature: arXiv
[2603.12123](https://arxiv.org/abs/2603.12123),
[2410.21819](https://arxiv.org/abs/2410.21819),
[2604.19049](https://arxiv.org/html/2604.19049v1)). The mode picker encodes
the common workflow with a default and lets the user opt down for
cost-sensitive cases. Local runs first in `both` so cheap issues filter out
before the paid codex pass, and so codex sees a CLEANED artifact without
anchoring on local findings (reverse order would let self-preference bias
contaminate the cross-model invariant).
