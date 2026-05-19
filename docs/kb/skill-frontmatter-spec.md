# Skill Frontmatter Spec

> Canonical YAML frontmatter schema that every atomic-skill must declare.
> Used by aiDeck's help page renderer, by CLI discovery commands, and by tooling that lists/filters skills.

## Why

Today (pre-migration) skills start with a free-text description. There's no machine-readable metadata for:

- Listing skills in a UI / help page
- Filtering by use case, tag, or compatibility
- Cross-referencing related skills
- Generating documentation from source

A unified YAML frontmatter solves these without disturbing the skill body (markdown instructions for the AI).

## Schema (v0.1)

```yaml
---
# REQUIRED — identity
name: hunt                                # kebab-case, unique within atomic-skills
title: 'Hunt — Adversarial Tests'         # human-readable, max ~50 chars
purpose: >                                # 1-2 sentence summary, max ~200 chars
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
---

# Rest of the file is the skill body (markdown instructions for the AI).
```

## Field reference

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | kebab-case slug. Must match filename (`hunt.md` → `name: hunt`). |
| `title` | string | Human-readable title. Shown in help cards and listings. |
| `purpose` | string | 1-2 sentence summary. Shown as card subtitle. |
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
| `network_required` | boolean | If true, indicates external API/service dependency (e.g., `review-*-with-codex` use Codex CLI). |

## Conventions

- Use `>` for multi-line strings in YAML (folds whitespace) for `purpose`.
- Lists use `-` syntax (block style), NOT inline `[a, b, c]` — easier to diff.
- `examples` always uses object form (`command:` + `description:`), even if only one.
- Names in `related` reference other skill `name:` values, not file paths.

## Communication language (separate concern)

This frontmatter does NOT include a `language` field. Communication language is a **user/repo-level preference**, not a per-skill setting.

The user's chosen language lives in:
- `MANIFEST_DIR/config.yaml` (installer-set preference)
- Skill markdown body uses template var `{{COMMUNICATION_LANGUAGE}}` which gets substituted at install time

Skills themselves are written in EN canonical. The AI translates user-facing strings at runtime per the configured language.

## Validation

A skill is valid if:
1. Frontmatter parses as YAML
2. All required fields present
3. `name` matches filename
4. `schema_version` matches a known version
5. At least 1 entry in `when_to_use`, `when_not_to_use`, and `examples`
6. `ide_compatibility` values (if present) are from the allowed set
7. `related` values (if present) reference other valid skill names

Validation runs at:
- Install time (`installSkills` rejects invalid skills with clear error)
- Build/CI time (`npm run validate-skills` script)
- aiDeck help page load (skips invalid skills, logs warning)

## Migration path for existing skills

The 12 existing skills (project-status, parallel-dispatch, parallel-dispatch-audit, hunt, fix, review-* x4, prompt, save-and-push, init-memory) currently have no frontmatter.

Migration adds frontmatter prepended to each `.md` file. The skill body remains unchanged.

Estimated cost: ~5-10 min per skill × 12 = ~1.5 hour.

The migration is the first deliverable of Phase A (see [migration-plan.md](./migration-plan.md)).

## Example: filled frontmatter for `project-status`

```yaml
---
name: project-status
title: 'Project Status — Initiative Tracking'
purpose: >
  Canonical per-initiative status tracking. Maintains .atomic-skills/ tree
  with plan/initiative/task hierarchy. Auto-installs HARD-GATE, hooks, and
  aiDeck integration.
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
---

# Skill body continues here unchanged (instructions to AI)
```

## Consumer rendering

aiDeck's help page reads these fields and renders cards (see [aiDeck/docs/ui-layouts.md § 4](../../../aideck/docs/ui-layouts.md#4-help--skills-directory-help)):

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

## Future fields (v0.2+, not in v0.1)

Documented here so we don't accidentally reuse the names:

- `aliases` (alternative names for slash command)
- `deprecated` / `deprecated_in_favor_of`
- `min_atomic_skills_version`
- `output_artifacts` (declarative list of what the skill produces)
- `skill_dependencies` (other skills required to be present)
