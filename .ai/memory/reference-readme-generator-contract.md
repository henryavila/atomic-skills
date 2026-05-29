---
name: reference-readme-generator-contract
description: Contract for generating README.md deterministically from meta/catalog.yaml + src/config.js. Five marker-bounded regions + a static-prose lint.
metadata:
  type: reference
---

# README generator contract

## Source of truth
- **Skills + module docs**: `meta/catalog.yaml` (renamed from `meta/skills.yaml` in the catalog-rename initiative).
- **IDE registry**: `src/config.js` IDE_CONFIG (imported by the renderer because `filePattern` is a JS function, can't move to YAML).
- **Version string**: `package.json.version` (single source — `release_highlight.body` in catalog provides only the editorial prose).

## Five marker-bounded regions in README.md
1. `<!-- IDES_TABLE_START/END -->` — rendered from `IDE_CONFIG` + `SKILL_NAMESPACE`.
2. `<!-- VERSION_NOTE_START/END -->` — `release_highlight.body` + pkg version (suppressed if `release_highlight` absent).
3. `<!-- SKILLS_TABLE_START/END -->` — overview table from `catalog.core` + `catalog.modules.*.*`.
4. `<!-- SKILL_DETAILS_START/END -->` — per-skill detail blocks; Iron Law extracted from skill body files.
5. `<!-- MODULES_START/END -->` — `module_meta` mapping (sibling of `modules:`, not a reshape).

## Enforcement
- `npm run check-docs` — exits non-zero if any region drifts.
- `npm run validate-skills` — opt-in `requireModuleMeta` (CLI on, tests off) ensures every `modules.X` has a `module_meta.X` and vice versa.
- `validateReadmeMentions()` — greps `\batomic-skills:([a-z][a-z0-9-]*)\b` over README; fails on unknown skill names. Catches drift in static prose the marker generator can't see.
- **Husky pre-commit auto-regenerates** when any input is staged (`meta/catalog.yaml`, `skills/en/**`, `src/config.js`, `package.json`, renderer code) and re-stages `README.md` + `src/dashboard/data/skills.generated.ts` so the commit is atomic. Manual edits to static sections survive.
- GitHub Actions runs `validate-catalog` (validate only, no regen — CI is downstream of the hook).

## When NOT to add a marker
- For prose that's editorial and not tied to catalog state (install instructions, "Why Atomic?", Techniques table) — keep static. The mention-lint covers skill-name drift.

## Adding a new module
1. Add skill entries under `modules.<name>:` in catalog.yaml.
2. Add `module_meta.<name>: {title, intro, features?, notes?, version_added?}`.
3. Run `npm run generate-docs`.

## Subcommand grouping (project-status / project-plan docs)
- Catalog subcommands accept an optional `group` field. `render-readme.js` `renderSubcommands`
  groups them under bold `*<group>*` labels in **first-appearance order** and renders each command
  as `` `name signature` `` (pipes in the signature are escaped for the table; the old `example`
  column was dropped). Keep the catalog entries ordered by group so groups stay contiguous. The
  validator tolerates `group` — it only checks `name`/`signature`/`description`/`example`.
- `render-helpview-data.js` (dashboard) intentionally IGNORES `group`. It is **not dead metadata** —
  it drives the `docs/skills/*.md` grouping only. Don't "fix" the dashboard expecting grouping there.
- Grouping renders ONLY in `docs/skills/<key>.md` (`renderDetailFull`), never in README.md — the
  SKILL_DETAILS region is `renderDetailCompact` (value_pitch + first example, no subcommands).

## Hand-written conceptual docs (NOT generated)
- `docs/concepts/project-tracking.md` is the canonical, hand-written explanation of the
  Plan/Initiative/Phase/Task model (entities, exit gates/verifiers, stack/parked/emerged, ratify
  flow, lifecycle, commands-by-workflow). `generate-skill-docs.js` only writes `docs/skills/<key>.md`,
  so `docs/concepts/` is never regenerated — update it by hand when the schema or model changes.
