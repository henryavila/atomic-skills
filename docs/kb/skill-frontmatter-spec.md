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
| `schema_version` | string | Currently `'0.1'`. Bumps when this schema evolves. |

### Optional fields

| Field | Type | Description |
|-------|------|-------------|
| `related` | string[] | Names of related skills. Rendered as cross-links. |
| `tags` | string[] | Free-form categorization. `pre-implementation`, `testing`, `review`, etc. |
| `ide_compatibility` | string[] | Subset of `[claude-code, gemini, cursor, generic]`. Default: all. |
| `requires_args` | boolean | If true, help page indicates arg is required. |
| `mutates_repo` | boolean | If true, help page shows warning icon (skill may write files). |
| `network_required` | boolean | If true, indicates external API/service dependency. |

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
2. All required fields present
3. `name` matches its key in the tree (`core.hunt.name === 'hunt'`)
4. `schema_version` matches a known version
5. At least 1 entry in `when_to_use`, `when_not_to_use`, and `examples`
6. `ide_compatibility` values (if present) are from the allowed set
7. `related` values (if present) reference other valid skill names in the same `meta/skills.yaml`

Validation runs at:
- Install time (`installSkills` rejects invalid skills with clear error)
- Build/CI time (`npm run validate-skills` script — to be added)
- aiDeck help page load (skips invalid skills, logs warning)

## Migration path for existing metadata

Existing `meta/skills.yaml` has only `name` + `description` per skill. Migration adds:
- `title`, `purpose`, `when_to_use`, `when_not_to_use`, `examples`, `schema_version` (required)
- Optional fields as appropriate

Existing `description` is preserved (still used by `renderForIDE`).

Estimated cost: ~5 min per skill × 12 skills = ~1 hour to enrich the YAML.

The migration is the first deliverable of Phase A (see [`migration-plan-v2.md`](../migration-plan-v2.md)).

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
    related: [fix, review-code-with-codex]
    tags: [testing, quality, pre-implementation]
    ide_compatibility: [claude-code, gemini, cursor]
    requires_args: true
    mutates_repo: true
    network_required: false
    schema_version: '0.1'
```

## Future fields (v0.2+, not in v0.1)

Documented here so we don't accidentally reuse the names:

- `aliases` (alternative names for slash command)
- `deprecated` / `deprecated_in_favor_of`
- `min_atomic_skills_version`
- `output_artifacts` (declarative list of what the skill produces)
- `skill_dependencies` (other skills required to be present)
