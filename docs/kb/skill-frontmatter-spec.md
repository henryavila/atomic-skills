# Skill Metadata Spec

> Canonical schema for skill metadata in atomic-skills.
> Used by aiDeck's help page renderer, by CLI discovery commands, by the installer, and by tooling that lists/filters skills.

## Architecture

atomic-skills uses **separate sources** for skill metadata and skill body:

```
meta/skills.yaml              ← CANONICAL metadata (name, description, all new fields)
skills/<lang>/<category>/<name>.md  ← Skill body (AI instructions only, no frontmatter)
```

At install time, `src/render.js:renderForIDE` **generates** frontmatter for the IDE's chosen format, combining `meta/skills.yaml` data with the rendered body.

This means:
- **Hand-edit only `meta/skills.yaml`** when adding metadata
- `.md` files in `skills/` stay frontmatter-free (just AI instructions)
- Rendered output (in user's IDE) has frontmatter at install time
- aiDeck reads `meta/skills.yaml` directly as canonical source

## Why this architecture

- **Single source of truth**: one file holds all metadata for all skills. No drift between body frontmatter and skills.yaml.
- **Bulk edits cheap**: adding a new optional field touches 1 file, not 12.
- **Render-time flexibility**: each IDE format (Claude markdown, TOML for Codex, command-style for Claude Code commands) gets the metadata it needs without skill files knowing about IDE specifics.
- **aiDeck contract is stable**: aiDeck consumes `meta/skills.yaml`. Skills can change body without affecting aiDeck.

## Schema versions

**Per-skill `schema_version`** (entry field) accepted by the validator:

- **v0.2** (canonical) — skill entry shape: identity, usage, one_liner/emoji/
  version_added, optional surface fields. See `## Schema (v0.2)` below.
- **v0.1** was hard-cut; entries with `schema_version: '0.1'` fail validation.

**Catalog root `version`** (top of `meta/catalog.yaml`) accepted:

- **`'0.2'`** — skill entries only (legacy root; still accepted during tools migration).
- **`'0.3'`** (current) — adds required per-skill `iron_law` and top-level
  `product:` positioning block. See `## Catalog root v0.3` below.

`ACCEPTED_SCHEMA_VERSIONS = {'0.2'}` and
`ACCEPTED_CATALOG_VERSIONS = {'0.2', '0.3'}` live in
`scripts/lib/validate-skills-core.js`.

## Schema (v0.1)

The structure of `meta/skills.yaml` is a 2-level tree: `core` and `modules`. Each skill is an entry under one of these. Inside each entry:

```yaml
core:
  hunt:                                       # key matches skill `name`
    # REQUIRED — identity
    name: hunt                                # kebab-case, unique
    title: 'Hunt — Adversarial Tests'         # human-readable, max ~50 chars
    description: >                            # short description, used by installer for IDE frontmatter
      Write adversarial tests for existing code to find hidden bugs.
      Use when code lacks tests or you suspect untested edge cases.
      Requires a bounded scope — one class or function per run.
    purpose: >                                # 1-2 sentence summary for help-page card subtitle
      Write adversarial tests for existing code to find hidden bugs and
      add meaningful coverage. Bounded scope: one class or function per run.

    # REQUIRED — usage triggers
    when_to_use:
      - 'Code lacks tests'
      - 'Suspect untested edge cases'
      - 'Pre-merge quality check'

    when_not_to_use:
      - 'Scope larger than 1 class or function'
      - 'Existing test suite is already comprehensive'
      - 'User wants to add features (use prompt instead)'

    # REQUIRED — at least 1 example
    examples:
      - command: '/atomic-skills:hunt src/matcher.php'
        description: 'Hunt bugs in a single file'
      - command: '/atomic-skills:hunt src/auth/'
        description: 'Triage mode for directory (max 30 files)'

    # OPTIONAL — relations
    related:
      - fix
      - review-code-with-codex

    # OPTIONAL — categorization
    tags:
      - testing
      - quality
      - pre-implementation

    # OPTIONAL — compatibility
    ide_compatibility:
      - claude-code
      - gemini
      - cursor

    # OPTIONAL — behavioral hints
    requires_args: true                       # if true, skill aborts without {{ARG_VAR}}
    mutates_repo: false                       # if true, may write/edit files
    network_required: false                   # if true, may call external services

    # REQUIRED — schema versioning
    schema_version: '0.1'
```

## Schema (v0.2)

v0.2 is **additive**: every v0.1 field still applies, with the same shape.
Three new fields become required, and four optional ones are introduced.

```yaml
core:
  project-status:
    # ... all v0.1 fields ...
    schema_version: '0.2'

    # REQUIRED in v0.2 — table + card metadata
    one_liner: 'Canonical per-initiative status tree with stack + parked + emerged'
    emoji: '📊'
    version_added: '1.5.0'

    # OPTIONAL in v0.2 — surface area
    subcommands:
      - name: new           # kebab-case, unique within the skill
        signature: '<slug>' # CLI-style: <required> [<optional>] --flag
        description: 'Create a new Initiative (standalone or under active plan)'
        example: '/atomic-skills:project-status new my-feature'
      - name: pop
        signature: '[--resolve|--park|--emerge]'
        description: 'Pop the top stack frame with a destination'
        example: '/atomic-skills:project-status pop --park'

    args:
      - name: '--list'
        kind: flag           # 'positional' | 'flag' | 'option'
        required: false
        description: 'List all initiatives across all plans'
      - name: '--plan'
        kind: option
        required: false
        description: 'Filter view to a specific plan slug'
        default: 'active plan'  # prose description of the default

    output_artifacts:
      - '.atomic-skills/PROJECT-STATUS.md'
      - '.atomic-skills/plans/<slug>.md'

    dependencies: [git]
```

### v0.2 field validation rules

- `one_liner` — 10-80 chars. Distinct from `description`: this is the
  tagline shown in the README table + HelpView card; `description` keeps
  feeding IDE frontmatter via `render.js`.
- `emoji` — non-empty string; accepts grapheme clusters (composed emoji).
- `version_added` — regex `^\d+\.\d+\.\d+$`. Used by the README generator
  to tag "new in X.Y.Z".
- `subcommands[].name` — kebab-case (`^[a-z][a-z0-9-]*$`), unique within
  the skill.
- `subcommands[].example` — must begin with `/atomic-skills:<skill-name>`
  (sanity check against copy-paste mistakes).
- `args[].kind` — one of `positional`, `flag`, `option`.
- `args[].default` — string interpreted as a PROSE description of the
  default (e.g. `'active phase'`), not a literal value. UI renders it as
  "defaults to <description>".

## Field reference

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | kebab-case slug. Matches the key in `meta/skills.yaml`. |
| `title` | string | Human-readable title. Shown in help cards and listings. |
| `description` | string | Short description. Used by installer for IDE-format frontmatter (existing behavior). |
| `purpose` | string | 1-2 sentence summary. Shown as card subtitle in aiDeck help page. |
| `when_to_use` | string[] | At least 1 trigger. Shown as bullet list. |
| `when_not_to_use` | string[] | At least 1 anti-trigger. Helps users avoid misuse. |
| `examples` | object[] | At least 1 example with `command` and `description`. |
| `schema_version` | string | One of `ACCEPTED_SCHEMA_VERSIONS` — `'0.1'` (legacy) or `'0.2'` (canonical). |

### Required in v0.2 (additive)

| Field | Type | Description |
|-------|------|-------------|
| `one_liner` | string (10-80 chars) | Tagline shown in the README table + HelpView card. |
| `emoji` | string | Icon shown next to the skill in the README table. |
| `version_added` | string (regex `^\d+\.\d+\.\d+$`) | `package.json` version in which the skill first shipped. |

### Optional fields

| Field | Type | Description | Since |
|-------|------|-------------|-------|
| `related` | string[] | Names of related skills. Rendered as cross-links. | v0.1 |
| `tags` | string[] | Free-form categorization. `pre-implementation`, `testing`, `review`, etc. | v0.1 |
| `ide_compatibility` | string[] | Subset of `[claude-code, gemini, cursor, codex, opencode, github-copilot, generic]`. Default: all. | v0.1 |
| `requires_args` | boolean | If true, help page indicates arg is required. | v0.1 |
| `mutates_repo` | boolean | If true, help page shows warning icon (skill may write files). | v0.1 |
| `network_required` | boolean | If true, indicates external API/service dependency. | v0.1 |
| `subcommands` | object[] | Structured index of subcommands (name, signature, description, example). | v0.2 |
| `args` | object[] | Top-level positional args + flags + options for the skill. | v0.2 |
| `output_artifacts` | string[] | Paths/patterns the skill writes (e.g. `.atomic-skills/reviews/<date>-<slug>.md`). | v0.2 |
| `dependencies` | string[] | External tools required (`codex`, `git`, `gh`). | v0.2 |
| `iron_law` | string | One-liner Iron Law for product cards/README. **Required** when catalog root is v0.3. | catalog v0.3 |

## Catalog root v0.3

Root `version: '0.3'` expands the catalog as the **product SSOT** (design D2 of
`product-docs-site`). Skill `schema_version` stays `'0.2'`; the new product
fields are gated by the **catalog root version**.

### Required when root `version` is `'0.3'`

**Per skill (every `core.*` and `modules.*.*` entry):**

| Field | Type | Description |
|-------|------|-------------|
| `iron_law` | non-empty string | Single non-negotiable rule shown on skill cards and README. Must match the first non-empty line under the body's `## Iron Law` section (whitespace-normalized CI cross-check). Catalog is authoritative for generators; body remains the agent-facing prompt. |

**Top-level `product:` block:**

| Field | Type | Description |
|-------|------|-------------|
| `what_is` | non-empty string | Short positioning paragraph (English). |
| `what_is_not` | non-empty string[] | Bullet list of what Atomic Skills is *not*. |
| `docs_url` | non-empty string | Canonical product docs URL (`https://atomic-skills.henryavila.com`). |
| `install.primary` | non-empty string | Primary install command (`npx @henryavila/atomic-skills install`). |

```yaml
version: '0.3'

product:
  what_is: >
    Battle-tested skill prompts that make AI coding agents follow through.
  what_is_not:
    - A copy-paste prompt pack
    - A replacement for your IDE or model
  docs_url: 'https://atomic-skills.henryavila.com'
  install:
    primary: 'npx @henryavila/atomic-skills install'

core:
  fix:
    # ... v0.2 fields ...
    iron_law: 'NO FIX WITHOUT ROOT CAUSE.'
    schema_version: '0.2'
```

### iron_law authority and cross-check

- **Generators** (`render-readme.js`, skill docs) prefer catalog `iron_law`
  when present; they fall back to extracting the body `## Iron Law` only when
  the catalog field is absent (legacy fixtures).
- **Validator** (when root is v0.3): if both catalog `iron_law` and body
  `## Iron Law` exist, they must match after whitespace normalization. Mismatch
  is a validation failure — no silent dual-write drift.
- Do **not** put skill bodies, HARD-GATE tables, host tested lists, or page
  layout into the catalog (hosts stay in `src/config.js`).

## Conventions

- Use `>` for multi-line strings in YAML (folds whitespace) for `description` and `purpose`.
- Lists use `-` syntax (block style), NOT inline `[a, b, c]` — easier to diff.
- `examples` always uses object form (`command:` + `description:`), even if only one.
- Names in `related` reference other skill `name:` values, not file paths.

## Communication language (separate concern)

This metadata does NOT include a `language` field. Communication language is a **user/repo-level preference**, not a per-skill setting.

The user's chosen language lives in:
- `MANIFEST_DIR/config.yaml` (installer-set preference)
- Skill markdown body uses template var `{{COMMUNICATION_LANGUAGE}}` which gets substituted at install time

Skills themselves are written in EN canonical. The AI translates user-facing strings at runtime per the configured language.

## Validation

A skill metadata block is valid if:
1. YAML parses
2. All v0.1 required fields present
3. `name` matches its key in the tree (`core.hunt.name === 'hunt'`)
4. `schema_version` is in `ACCEPTED_SCHEMA_VERSIONS` (`'0.1'` or `'0.2'`)
5. At least 1 entry in `when_to_use`, `when_not_to_use`, and `examples`
6. `ide_compatibility` values (if present) are from the allowed set
7. `related` values (if present) reference other valid skill names in the same `meta/skills.yaml`
8. When `schema_version == '0.2'`: `one_liner` (10-80 chars), `emoji`,
   `version_added` (matching `^\d+\.\d+\.\d+$`) are all present
9. When `schema_version == '0.2'` and `subcommands` is present: each entry
   has a kebab-case `name` (unique within the skill), non-empty `signature`,
   `description`, and `example` beginning with `/atomic-skills:<name>`
10. When `schema_version == '0.2'` and `args` is present: each entry has
    `name`, `kind ∈ {positional, flag, option}`, boolean `required`, and
    a non-empty `description`; optional `default` is a string

Additionally, the catalog-level cross-checks (run by
`scripts/validate-skills.js`):
- Each catalog entry has a matching body at `skills/{core|modules/M}/<name>.md`
- Each body file has a matching catalog entry (inverse check)
- Every body file contains a canonical `^## Iron Law` H2 section (CLI enables
  `requireIronLaw`)
- When root `version` is `'0.3'`: every skill has non-empty `iron_law`;
  `product` block is present and well-formed; catalog `iron_law` matches the
  body's first Iron Law line (whitespace-normalized)


Validation runs at:
- Install time (`installSkills` rejects invalid skills with clear error)
- Build/CI time (`npm run validate-skills`)
- aiDeck help page load (skips invalid skills, logs warning)

## Migration v0.1 → v0.2

The validator accepts both versions during the migration window
(`ACCEPTED_SCHEMA_VERSIONS = {'0.1', '0.2'}`). The plan:

1. Phase B — pilot one entry (`project-status`) to v0.2; confirm the
   shape works for the most surface-rich skill in the catalog.
2. Phase C — bulk-migrate the remaining 10 entries; normalize the 6
   bodies that are missing `## Iron Law`; flip `ACCEPTED_SCHEMA_VERSIONS`
   to `{'0.2'}` (hard cut of v0.1).

See `docs/plan-skills-catalog-v0.2.md` for the full migration plan.

For each skill, the migration adds (when applicable):
- `one_liner`, `emoji`, `version_added` (required)
- `subcommands`, `args`, `output_artifacts`, `dependencies` (optional)
- Bumps `schema_version: '0.1'` → `'0.2'`

Existing v0.1 fields are preserved literally — v0.2 does NOT rewrite them.

## Consumer rendering

### aiDeck help page

Reads `meta/skills.yaml` directly. Renders cards (see [aiDeck/docs/ui-layouts.md § 4](../../../aideck/docs/ui-layouts.md#4-help--skills-directory-help)):

```
┌──────────────────────────────────────────┐
│ project-status   [mutates] [core]        │
│ Project Status — Initiative Tracking     │
│ ─────────────────────────────────────── │
│ Canonical per-initiative status tracking.│
│ Maintains .atomic-skills/ tree...        │
│                                          │
│ ✓ Starting a new piece of work           │
│ ✓ Resuming after break                   │
│ ✗ One-shot questions                     │
│                                          │
│ [/atomic-skills:project-status] [📋]     │
│ Related: project-plan · fix · save-...   │
└──────────────────────────────────────────┘
```

### IDE rendered output

`src/render.js:renderForIDE` continues using `name + description` to produce IDE-format frontmatter (TOML, command-style, or markdown YAML). New fields (`when_to_use`, `examples`, etc.) are NOT included in the rendered output by default — they're aiDeck-only metadata.

If we later decide the AI should see `when_to_use` etc. in the conversation context, `render.js` can be extended to include them. For v0.1 of the migration, IDE output stays unchanged.

## Example: filled metadata for `project-status` and `hunt`

```yaml
core:
  project-status:
    name: project-status
    title: 'Project Status — Initiative Tracking'
    description: >
      Canonical per-initiative status tracking. Maintains .atomic-skills/
      tree with plan/initiative/task hierarchy. Auto-installs HARD-GATE,
      hooks, and aiDeck integration.
    purpose: >
      Track work via Plan/Initiative/Task hierarchy with stack, parked,
      emerged, and verifiable exit gates. Bird's-eye + zoom mental model.
    when_to_use:
      - 'Starting a new piece of work'
      - 'Resuming after break'
      - 'Pushing or popping a stack frame'
      - 'Parking lateral findings'
      - 'Viewing status across sessions'
    when_not_to_use:
      - 'One-shot questions'
      - 'Work that fits entirely in the current session'
      - 'Creating a multi-phase plan (use project-plan instead)'
    examples:
      - command: '/atomic-skills:project-status'
        description: 'View current state'
      - command: '/atomic-skills:project-status new my-feature'
        description: 'Start a new standalone initiative'
      - command: '/atomic-skills:project-status push "investigating slow query"'
        description: 'Push a side-investigation frame'
      - command: '/atomic-skills:project-status done T-005'
        description: 'Close a task (triggers phase-completion check if last)'
    related: [project-plan, fix, save-and-push]
    tags: [tracking, anchoring, planning, core]
    ide_compatibility: [claude-code, gemini, cursor]
    requires_args: false
    mutates_repo: true
    network_required: false
    schema_version: '0.1'

  hunt:
    name: hunt
    title: 'Hunt — Adversarial Tests'
    description: >
      Write adversarial tests for existing code to find hidden bugs.
      Use when code lacks tests or you suspect untested edge cases.
      Requires a bounded scope — one class or function per run.
    purpose: >
      Write adversarial tests to break code and find hidden bugs.
      Bounded to one class or function per run.
    when_to_use:
      - 'Code lacks tests'
      - 'Suspect untested edge cases'
      - 'Pre-merge quality check'
    when_not_to_use:
      - 'Scope larger than 1 class or function'
      - 'Existing test suite is already comprehensive'
      - 'Looking for new features (use prompt instead)'
    examples:
      - command: '/atomic-skills:hunt src/matcher.php'
        description: 'Hunt bugs in a single file'
      - command: '/atomic-skills:hunt src/auth/'
        description: 'Triage mode for directory (max 30 files)'
    related: [fix, review-code]
    tags: [testing, quality, pre-implementation]
    ide_compatibility: [claude-code, gemini, cursor]
    requires_args: true
    mutates_repo: true
    network_required: false
    schema_version: '0.1'
```

For a worked v0.2 example with subcommands + args + output_artifacts, see
`project-status` in `meta/skills.yaml` (the pilot for the v0.2 migration —
Phase B of `docs/plan-skills-catalog-v0.2.md`).

## Future fields (beyond v0.2)

Documented here so we don't accidentally reuse the names:

- `aliases` (alternative names for slash command)
- `deprecated` / `deprecated_in_favor_of`
- `min_atomic_skills_version`
- `skill_dependencies` (other skills required to be present — distinct from
  `dependencies` which lists external tools)
