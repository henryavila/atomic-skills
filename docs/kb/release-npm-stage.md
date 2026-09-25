# npm stage publish (Trusted Publisher)

Atomic Skills publishes `@henryavila/atomic-skills` via **OIDC Trusted
Publisher** on GitHub Actions. The happy path is **stage-only**: CI uploads a
staged version; a human **stage approve**s with **2FA on the npm UI**. There is
no `NODE_AUTH_TOKEN` publish path and no Bypass 2FA token.

Consumer repos that adopt the same discipline use the template at
`skills/shared/release-assets/templates/publish-stage.yml` (see
`skills/shared/release-assets/adopt.md` and the `release` skill).

## Why stage

- Direct `npm publish` from an agent laptop or from CI as the installable
  publish is forbidden by the release contract.
- Trusted Publisher + `id-token: write` authenticates the workflow without a
  long-lived token.
- Staging keeps a human 2FA gate between "GitHub Release cut" and "version
  installable on the registry."

## Workflow contract

File: `.github/workflows/publish.yml`

| Requirement | Detail |
|-------------|--------|
| Trigger | `on.release.types: [published]` |
| Permissions | `contents: read`, `id-token: write` |
| Publish step | `npm stage publish` (via `npx npm@11… stage publish`) |
| Forbidden happy path | Bare `npm publish`, `NODE_AUTH_TOKEN`, Bypass 2FA automation |

## Maintainer runbook (after GitHub Release)

1. Cut the release with the chooser, from the repository being released:

   ```sh
   PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
   node "$PKG_ROOT/scripts/release/release.js" --root "$PWD"
   node "$PKG_ROOT/scripts/release/release.js" --root "$PWD" --apply
   # commit the bump on a non-default branch, then
   node "$PKG_ROOT/scripts/release/release.js" --root "$PWD" --ship
   ```

   `--ship` refuses when the recorded version is not the chooser `next`, when
   `HEAD` is the default branch (or the default branch cannot be resolved), or
   when npm is in scope without a stage-only Action. `--no-npm` does not stop
   a workflow that already runs `stage publish` or `npm publish`; adopt
   `publish-gh-only.yml` or remove that workflow first. The GitHub Release
   triggers the Action.
2. Wait for the **Publish to npm (stage)** workflow to succeed. The job
   summary links the package Versions tab.
3. Open the npm package Versions / Staged packages UI, for example:
   `https://www.npmjs.com/package/@henryavila/atomic-skills?activeTab=versions`
4. **stage approve** the staged version with **2FA on the npm UI** (browser).
   Do not treat CLI `npm stage approve` as the handoff the agent should run
   for the human.
5. Confirm the version is live (`npm view @henryavila/atomic-skills version`).

## Trusted Publisher setup (one-time)

On npmjs.com → package → Settings → Trusted Publisher:

- Configure the GitHub repository / workflow that may publish.
- Prefer **stage-only** (or the npm UI equivalent that requires human approve
  before the version becomes installable).
- Do **not** reintroduce long-lived automation tokens or Bypass 2FA for the
  publish happy path.

## Related

- Skill: `skills/core/release.md` (dual-mode D4, stage+2FA)
- Template: `skills/shared/release-assets/templates/publish-stage.yml`
- Adopt: `skills/shared/release-assets/adopt.md`
- PR-only persistence: `skills/core/save-and-push.md`
