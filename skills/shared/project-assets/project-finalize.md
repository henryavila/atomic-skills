# project — `finalize` (publish the plan branch as a PR) (lazy detail)

Loaded by the router for `/atomic-skills:project finalize`.

> **Invocation:** `finalize` is a **top-level**, **operator-prompted** verb — never
> automatic. It PUBLISHES the finished plan branch (`plan/<slug>`) as a pull request
> against the integration ref; it does **not** merge and does **not** archive. The
> merge happens on GitHub; `archive` (zero-git, post-merge) stays a separate, later
> step (`{{ASSETS_PATH}}/project-transitions.md` → `archive`).

## What finalize does (and does NOT do)

- **Does:** push `plan/<slug>` to `origin` (no rename), open a PR
  `--base <integrationRef> --head plan/<slug>`, and record the PR identity
  (`pr-url` + number) in the plan state.
- **Does NOT:** merge the PR, rename the branch to `feat/<slug>`, archive the plan,
  or write `integrationRef` into the plan frontmatter. The integration ref is
  persisted in `routing.json` only; the merge + teardown + archive run afterward.

## Preconditions (abort safely if unmet)

1. The active plan's branch is `plan/<slug>` and the tree is clean
   (`git status --porcelain` empty). A dirty tree aborts — commit or stash first.
2. `gh` is authenticated and an `origin` remote exists. If either is missing,
   surface a safe block (do not half-publish) — see *Failure handling*.

## Step 1 — Resolve the integration ref (consumes `scripts/integration-ref.js`)

finalize never assumes a base in silence. Resolve it from
`.atomic-skills/status/routing.json` via the F1 resolver `resolveIntegrationRef`
(`scripts/integration-ref.js`):

- Read `routing.json` if it exists (parse JSON); pass `null` when the file is absent.
- `resolveIntegrationRef(routingConfig)` returns `{ ref, configured, source }`:
  - `source: 'declared'` — a configured `integrationRef`; use `ref`.
  - `source: 'default'` — file present but the field is absent; use the documented
    default `develop`.
  - `source: 'not-configured'` — `routing.json` is absent; **prompt-when-absent**
    (below). The not-configured case is **never** silently assumed — it is the
    surface for the lazy prompt.

### Prompt-when-absent (source: `not-configured`)

Ask the user via {{ASK_USER_QUESTION_TOOL}} — never auto-pick the base:

- **Use an existing ref** — the user names a branch that already exists
  (e.g. `main`, `develop`, a release branch). Confirm it resolves:
  `git show-ref --verify --quiet refs/heads/<ref>` (or `refs/remotes/origin/<ref>`).
- **Create `develop` from `main`** — `git branch develop main` (or from the repo's
  default branch), then publish it with `git push -u origin develop`.

**Validate the ref FORMAT before honoring or creating it — F3 is the consumer.**
The F1 schema (`meta/schemas/routing.schema.json`) validates only the SHAPE of
`integrationRef` (a non-empty string); FORMAT and semantic validity belong HERE, at
the consumer that uses the ref against git. Before any push or PR, with {{BASH_TOOL}}:

```
git check-ref-format --branch <ref>   # rejects whitespace, control chars, malformed ref names
```

A non-zero exit aborts with the offending ref surfaced — never push or open a PR
against a malformed ref.

Persist the resolved ref **once** into `routing.json` (`integrationRef: <ref>`) so
the next finalize resolves `declared` instead of prompting again. Persist it to
`routing.json` only — **never** to the plan frontmatter.

## Step 2 — Show the diff + the proposed PR, then HALT (operator-prompted)

Before any push or PR, present the change and wait for explicit confirmation
(intrusive-actions rule). With {{BASH_TOOL}}:

1. The branch diff against the integration ref:
   `git --no-pager diff <integrationRef>...plan/<slug> --stat`
   (offer the full diff on request).
2. The proposed PR: base `<integrationRef>`, head `plan/<slug>`, the title and the
   `--fill` body preview.

Print a `Proposed publish:` block and HALT. Nothing is pushed until the user
confirms; `cancel` aborts with zero git effect.

## Step 3 — Publish (push + PR)

On confirmation, with {{BASH_TOOL}}:

1. `git push -u origin plan/<slug>` — push the branch unchanged (no rename to
   `feat/<slug>`).
2. `gh pr create --base <integrationRef> --head plan/<slug> --fill` — open the PR.
   Capture the printed PR URL and number.

## Step 4 — Record the PR identity in the plan state

Record the published PR so the rest of the lifecycle can find it:

- Write the `pr-url` (and PR number) onto the plan state — add it to the plan's
  `references[]` (labelled e.g. `pr: <url>`). Do **not** add a new `integrationRef`
  frontmatter field.
- The recorded identity is the input the F2 teardown consumes: `isTeardownSafe`
  (`scripts/worktree-teardown.js`) takes a `prIdentity` and blocks with
  `pr-identity-missing` without one. Recording it here is what later lets the
  removal guard look the PR up.
- The **authoritative** integration signal is NOT this local record — it is the
  live PR state on GitHub. The teardown reads `gh pr view <prIdentity>` and gates
  removal on `state == MERGED` **and** `baseRefName == <integrationRef>` **and** a
  matching `headRefOid`, with native `git branch -d` (lowercase, non-force) as the
  second guard. The recorded `pr-url` is a convenience pointer for humans and the
  lookup — never the source of truth for "merged".

## After finalize — merge, then archive (separate steps)

finalize stops at "PR open + recorded". The user merges the PR on GitHub. **After**
the merge, `project archive <slug>` runs its zero-git logical flip and offers the
operator-prompted worktree teardown (`{{ASSETS_PATH}}/project-transitions.md` →
`archive`), whose removal guard reads the now-`MERGED` PR. finalize itself never
merges and never archives.

## Failure handling (fail safe — never half-publish)

- `gh` unauthenticated, no `origin`, or a network error on `push`/`pr create`:
  stop and surface the exact failure. Do not leave a pushed branch without its PR
  silently — report what landed and what did not (the module's fail-safe posture is
  BLOCK, not best-effort).
- `git check-ref-format` non-zero: abort before any push (Step 1).
- Dirty tree: abort before Step 2.

## Scope (this command's boundary)

- **Always operator-prompted** — shows the diff + the proposed PR and halts; never
  automatic.
- **Never touches `archive`** — archive stays zero-git and post-merge.
- **Never renames `plan/<slug>`** to `feat/<slug>` — the branch is published as-is.
- **Never writes `integrationRef` into the plan frontmatter** — the integration ref
  is persisted in `routing.json` only.
