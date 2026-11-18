Cut a versioned GitHub Release with a deterministic semver chooser. Optional npm
staging rides the Release via a Trusted Publisher Action — never invent the bump
and never `npm publish` from the agent.

If {{ARG_VAR}} was provided, treat it as a subcommand hint (`plan` | `apply` |
`ship` | `adopt`). If omitted, start with **plan**.

## Iron Law

NO BUMP WITHOUT THE CHOOSER.
Never invent patch/minor/major by hand. The next version comes only from
`scripts/release/semver-bump.js` via the package-root `release.js` command below
(plan → apply → ship). Feature / Added / Changed is **minor**, not patch.

<HARD-GATE>
Before `--apply` or `--ship`:
1. Run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/release/release.js" --root "$PWD"` (or add `--json`) and read `kind` / `next`.
2. If `kind` is `none`: STOP. There is nothing to release — do not invent a bump.
3. Do **not** edit `package.json` version or invent a tag without `--apply`.
4. Do **not** run `npm publish` / `pnpm publish` / bare registry publish as the
   happy path. npm (when in scope) is **stage-only** via the adopted Action after
   GitHub Release; a human approves with 2FA on the npm UI.
</HARD-GATE>

## Semver mapping (chooser)

| Evidence | Bump |
|----------|------|
| `feat:` · changelog **Added** / **Changed** / **Deprecated** | **MINOR** |
| `fix:` / `perf:` · **Fixed** / **Security** only | **PATCH** |
| `!:` / `BREAKING CHANGE` (subject or commit body) / **Removed** on **0.x** | **MINOR** (never auto `1.0.0`) |
| Breaking on **≥1.0.0** | **MAJOR** |
| No classifiable commits and no changelog signal | **none** — refuse |

Baseline is the latest **stable** npm version (`x.y.z` only; prerelease and
non-semver tags are ignored) when the package is public. Otherwise it is the
last stable GitHub release or tag. After `--apply`, an empty `## [Unreleased]`
still counts when `## [package version]` holds the moved notes and that
version is ahead of the baseline. Do not backfill a GitHub Release for a
version already on npm.

Shared commit prefixes: `skills/shared/release-assets/conventional-commits.md`.

Template adopt/init (stage or GH-only workflows): follow
`skills/shared/release-assets/adopt.md` — MUST dry-run/`--check` with template
pin, show diff, write only after consent. See also
`skills/shared/release-assets/templates/publish-stage.yml` and
`publish-gh-only.yml`.

## Dual-mode distribution (D4)

**npm in scope** when: root `package.json` exists, `private` is not `true`, and
the operator did not pass an explicit npm opt-out (e.g. `--no-npm`).

| Situation | Path |
|-----------|------|
| No npm in scope | GitHub Release (+ tag + CHANGELOG notes) **only** |
| npm in scope **and** stage Action adopted (an executable `run` step starts with `npm` / `npx … npm` and runs `stage publish`; no direct `npm publish`, including `npm --access public publish`) | GH Release → Action **`npm stage publish`** → human `stage approve` (2FA on npm UI) |
| npm in scope **and** Action missing or not stage-only | **Refuse** ship that would imply npm publish; offer **adopt** of the stage template. Do not invent local `npm publish`. GH-only despite a public package requires explicit operator opt-out for that ship |

A workflow title, a YAML comment, or `echo npm stage publish` is not adoption.
Without `package.json`, `--apply` rewrites `CHANGELOG.md` only and does not
create a `package.json`. `--no-npm` (or no package) still **refuses** when
`.github/workflows/publish.yml` runs `stage publish` or `npm publish` — adopt
the gh-only template or remove that workflow first. No publish workflow, or
the gh-only template, ships a GitHub Release only.

## Process

### 1. Plan

```sh
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/release/release.js" --root "$PWD"
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/release/release.js" --root "$PWD" --json
```

Report `bump`, `next`, and `reasons`. If `kind` is `none`, stop.

### 2. Verify

Run the repo's test/typecheck suite. Fix failures before apply.

### 3. Apply

```sh
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/release/release.js" --root "$PWD" --apply
```

Rewrites `package.json` version and, when `CHANGELOG.md` with `## [Unreleased]`
is present, moves Unreleased into `## [next] - date`. Commit the bump
(`chore: release X.Y.Z`) on a **non-default** branch per
`skills/shared/release-assets/default-branch.md` / `save-and-push` PR-only rules.

### 4. Ship

```sh
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/release/release.js" --root "$PWD" --ship
```

Requires a clean tree. The recorded version (`package.json`, or the newest
changelog version when there is no `package.json`) must equal `plan.next` —
run `--apply` first. When `CHANGELOG.md` exists, notes come from `## [X.Y.Z]`.
Creates the annotated tag only when it is absent or already points at `HEAD`;
a tag on another commit aborts before any push. Then pushes the work branch
and `gh release create`. It does **not** `npm publish`.

Refuses when `kind` is `none`, the recorded version is not `plan.next`, the
version is already on npm (npm in scope), `HEAD` is the default branch or the
default branch cannot be resolved (`default-branch.md`; the name may contain
`/`), npm is in scope without a stage-only Action, or `--no-npm` / no package
still has a workflow that runs `stage publish` or `npm publish`.

### 5. After GitHub Release (npm in scope)

The adopted `.github/workflows/publish.yml` (stage template) runs
`npm stage publish` under OIDC (`id-token: write`). Hand the human the Versions
tab — approve with **2FA on the npm UI**, never CLI `stage approve` as the
handoff:

```
https://www.npmjs.com/package/<name>?activeTab=versions
```

### 6. Adopt / init templates (when needed)

If npm is in scope and the stage Action is missing or wrong, follow
`skills/shared/release-assets/adopt.md`:
1. dry-run / `--check` with template pin
2. show diff
3. write only after explicit consent

Installer / `reconcileFileSet` must **not** write consumer `.github` workflows.

## Refuse

- Inventing a bump (patch for a feature, hand-picked `1.0.0` on 0.x breaking)
- `--apply` / `--ship` when `kind` is `none`
- `--ship` when the recorded version is not the chooser `next`
- GitHub Release whose version is already on npm
- Reusing a version tag that points at a different commit
- Direct `npm publish` as the happy path
- `--no-npm` while `publish.yml` still stages or publishes
- Weakening `save-and-push` PR-only on the default branch

## Red Flags

- "I'll just bump the patch, it's a small feature"
- "0.x breaking should jump to 1.0.0 automatically"
- "I'll npm publish from the laptop to save time"
- "kind is none but the user wants a release anyway — invent 0.0.1"
- "Skip adopt check/diff; just copy the workflow"

If you thought any of the above: STOP. Run the chooser or adopt flow you were skipping.

## Closing

Report:
- Plan: kind, next, reasons
- Apply: whether package.json / CHANGELOG were rewritten
- Ship: tag + release URL (or refusal reason)
- npm: stage Action status + Versions tab URL for human 2FA (or GH-only / adopt offer)
