# aiDeck Runtime Snapshot

This directory is a temporary vendored snapshot of the aiDeck runtime used by
`atomic-skills` to build `dist/aideck.mjs`.

Purpose:

- Make `npm run build:aideck` reproducible from this repository alone.
- Avoid an implicit dependency on a sibling `../aideck` checkout, branch, or
  local build.
- Keep `atomic-skills install` self-contained while the new aiDeck is rebuilt.

Snapshot details:

- Captured from local `../aideck` on 2026-05-28.
- Base commit: `12c488f7ca423f5367576ecfdca4d6561546d880`.
- Includes the temporary compatibility API used by the bundled dashboard:
  `/api/projects`, `/api/projects/register`, project-scoped state routes, and
  the flat `.atomic-skills/plans` + `.atomic-skills/initiatives` layout.

Update flow:

1. Copy the intended aiDeck runtime source into this directory.
2. Run `npm run build:aideck` from the `atomic-skills` repo.
3. Run the install/vendor tests and smoke checks.

This is not the long-term aiDeck source of truth. Delete this directory when the
new aiDeck runtime is ready to be consumed directly.
