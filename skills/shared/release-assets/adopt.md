# Adopt release workflow templates

Materialize a versioned workflow from `skills/shared/release-assets/templates/`
into the **consumer repo** (typically `.github/workflows/publish.yml`). This is
**opt-in**. The Atomic Skills installer / `reconcileFileSet` MUST NOT write
consumer `.github` workflows. Uninstall of Atomic Skills does **not** remove
files the operator adopted here.

Invoked from the `release` skill (`adopt` / `init`) when npm is in scope and
the stage Action is missing, wrong, or when the operator chooses GH-only.

## Templates

| Template | Pin | When |
|----------|-----|------|
| `templates/publish-stage.yml` | `atomic-skills/release-assets/publish-stage@v1` | Public npm package — OIDC **`npm stage publish`** after GitHub Release |
| `templates/publish-gh-only.yml` | `atomic-skills/release-assets/publish-gh-only@v1` | No npm in scope (or explicit GH-only) |

Target path default: `.github/workflows/publish.yml` (ask if another name is required).

## MUST — check → diff → consent → write

Every adopt/init apply **MUST** follow this order. Skipping any step is a
protocol violation. Prefer the executable CLI (exit non-zero on missing/drift):

```sh
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/release/adopt.js" --root "$PWD" --check [--template stage|gh-only] [--target path]
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/release/adopt.js" --root "$PWD" --diff  [...]
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/release/adopt.js" --root "$PWD" --check --diff --write [...]   # --write = explicit consent
```

When status is `missing` or `drift`, `--write` **refuses** unless both `--check` and
`--diff` are passed in the same invocation (CLI stand-in for the triad).

### 1. Dry-run / `--check` with template pin

- Resolve the template file under this package (read-only).
- Record the **pin** string from the template header (e.g.
  `atomic-skills/release-assets/publish-stage@v1`).
- If the target already exists, compare it to the pinned template (normalize
  trivial whitespace if needed).
- Report: pin id, whether target exists, whether it already matches the pin.

```text
adopt --check
  template: publish-stage.yml
  pin:      atomic-skills/release-assets/publish-stage@v1
  target:   .github/workflows/publish.yml
  status:   missing | match | drift
```

Exit the check without writing. CLI exit **0** on match, **1** on missing/drift.

### 2. Show diff

If status is `missing` or `drift`, print a unified diff of
`target` vs pinned template (or "would create" full file for missing).
Do **not** write yet.

### 3. Consent

Ask the operator explicitly to approve writing the target path.
No silent overwrite. No "probably fine". If they decline: STOP.

### 4. Write only after consent

Only after explicit consent, create parent dirs as needed and write the
template bytes to the target. Re-state the pin in the closing report.

## Refuse

- Writing without `--check` / dry-run first
- Writing without showing the diff when status ≠ match
- Writing without operator consent
- Inventing a workflow that runs bare `npm publish` as the happy path
- Asking the installer to scaffold `.github` for the consumer

## Closing

Report: pin, target path, status before/after, whether bytes were written.
