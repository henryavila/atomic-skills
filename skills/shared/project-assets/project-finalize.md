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
- **Also (only when ≥2 plan worktrees are live):** runs a pre-publish cross-WT
  collision check (Step 1.5) — a deterministic gate (`scripts/cross-wt-gate.js`)
  as the proof, plus advisory read-only agents; operator-prompted, never
  auto-resolving.
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

- Read `routing.json` if it exists, then **validate it against
  `meta/schemas/routing.schema.json` first** (the same ajv gate `npm run
  validate-state` uses) and ABORT on a parse/schema error. The resolver assumes
  schema-valid input: its docstring notes the schema rejects a non-string/empty
  `integrationRef` *before* the resolver runs, and a present-but-invalid value
  (`""`, `123`, `{}`) falls through to the `develop` default — which would silently
  publish against the wrong base. Pass the schema-valid parsed config to the
  resolver, or `null` when the file is absent.
- `resolveIntegrationRef(routingConfig)` returns `{ ref, configured, source }`:
  - `source: 'declared'` — a configured `integrationRef`; use `ref`.
  - `source: 'default'` — file present but the field is absent; use the documented
    default `develop`.
  - `source: 'not-configured'` — `routing.json` is absent; **prompt-when-absent**
    (below). The not-configured case is **never** silently assumed — it is the
    surface for the lazy prompt.

**Two refs, not one (consume `scripts/worktree-teardown.js` `resolveBaseRef`).**
`integrationRef` is the PR `--base` and the value persisted to `routing.json`;
`baseRef` is the ref that exists LOCALLY for git commands (the preview diff).
`resolveBaseRef({ routingConfig })` returns `{ integrationRef, baseRef }`,
preferring `origin/<ref>` then `<ref>`. Use `integrationRef` for `gh pr create
--base` + persistence, and `baseRef` for every local `git` invocation — a clone
with only `origin/develop` (no local `develop`) makes a bare `<integrationRef>`
diff fail.

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
the next finalize resolves `declared` instead of prompting again — **only after the
ref is confirmed present on `origin`** (an existing ref already resolves; a freshly
created `develop` only after its `git push -u origin develop` exits 0). On a
base-push failure, do **not** persist: a persisted ref the remote lacks makes the
next `gh pr create --base <ref>` fail with no re-prompt — surface the failure and
re-run the prompt instead. Persist to `routing.json` only — **never** to the plan
frontmatter.

## Step 1.5 — Cross-WT collision check (`cross-wt-collision`, only with ≥2 live worktrees)

When **≥2 plan worktrees are live** (`git worktree list --porcelain`), the feature
being published can collide with another in-flight feature in ways a clean
`git merge` cannot see (the literature splits cross-branch collisions into textual /
build / dynamic-semantic / higher-order, and plain `git merge` only catches the
first). With **<2 live worktrees this step is a no-op** — a solo feature has nothing
to collide with — and finalize proceeds straight to Step 2. This check is
**operator-prompted** (never automatic) and **never auto-resolves** a collision: it
surfaces findings and routes them to a human.

### The deterministic GATE is the proof (entry token) — `scripts/cross-wt-gate.js`

The floor is deterministic and verify-claim-able: a speculative merge of the live
worktrees **+ the TARGET PROJECT's own build/typecheck/test/lint on the merged
tree**, with the commands DETECTED generically — `detectProjectCommands` reads
`package.json` scripts / `Makefile` / `pyproject.toml`, **never hardcoded to this
repo's stack**. Detection covers exactly those three sources; a target whose build
tooling is none of them (e.g. a Gradle/Go project with no `Makefile`) yields a
**registered WARN skip**, never a silent pass — the floor degrades safely, it does
not pretend to recognize every stack. `crossWtGate(...)` decides, in this fixed
order:

- `<2` live worktrees → `no-op` (nothing to collide with; no merge, no build).
- a missing / throwing / indeterminate adapter → **`gate: 'block'`** (one of
  `merge-probe-missing`, `probe-threw`, `merge-indeterminate`, `runner-missing`,
  `runner-threw`, `runner-malformed-result`) — fail-closed: an unproven state
  (e.g. a merge probe that does not return an explicit `conflict: false`, or a
  runner result with no numeric exit code) never passes.
- the speculative merge conflicts textually → `conflict` (exit≠0) — the **FIRST
  gate** among non-block outcomes, before any build/test runs.
- no detectable project command → a **REGISTERED `skip` (WARN)**, never a silent
  pass.
- otherwise the detected commands run on the merged tree; a non-zero exit is the
  gate failing.

This gate is the **proof**; build & tests are NOT agents (running the project's own
build/test already catches build-conflicts and test-covered behavioural conflicts
deterministically — an "agent" there would duplicate the floor).

### The WORKFLOW is advisory (LLM agents) — never the gate, always read-only

A bounded set of LLM agents, each **scoped to the footprint of the live worktrees'
diffs + immediate dependency neighbourhood** — they read the **DIFF, not the whole
tree**, so cost scales with diff size, not repo size. Fired only with ≥2 live
worktrees, operator-prompted. They focus on what the deterministic floor is
structurally blind to:

- **Agent A — behavioural / semantic interference:** reasons about whether the
  COMBINATION of the changes alters behaviour that each change passes in isolation
  (the merge-and-test-invisible class). The one class with no cheap, generic,
  deterministic form — so it is **advisory by necessity, not by choice**.
- **Agent B — shared-resource / contract collision:** ≥2 worktrees mutating the
  same mutable resource (config, lockfile, generated file, migration, global state,
  feature flag) OR changing the contract of a shared symbol
  (signature/API/type/schema) another worktree references. Highest value when the
  target project's build/test is WEAK and the floor misses it.

**Discipline (non-negotiable):** the advisory agents **self-check but NEVER
self-certify** (`verify-claim`) — the deterministic gate above is the only proof;
agent findings **ROUTE to human review**, never auto-resolve and never gate. Iron
Law preserved: the agents are **READ-ONLY** (reading parallelizes; merge/code stays
serial — R-XAGENT-03).

{{#if ide.claude-code}}
**Accelerator (Claude Code):** dispatch Agent A and Agent B as parallel read-only
investigation agents (native Agent / `Workflow` fan-out). Parallelism is for READS
only — nothing the agents do writes any tree.
{{/if}}

**Portable fallback:** where a parallel workflow tool is unavailable (e.g. a
read-only `{{INVESTIGATOR_TOOL}}` on another IDE), run Agent A then Agent B
**sequentially**, or record a **registered skip** (WARN) — never a silent pass. The
deterministic gate runs identically everywhere; only the advisory layer degrades.
Calibrated honest: higher-order collisions are RARE in frequency but expensive per
occurrence, which is exactly why this `cross-wt-collision` check is OPTIONAL and
operator-prompted at finalize — not an always-on gate.

## Step 2 — Show the diff + the proposed PR, then HALT (operator-prompted)

Before any push or PR, present the change and wait for explicit confirmation
(intrusive-actions rule). With {{BASH_TOOL}}:

1. The branch diff against the resolved local base (`baseRef`, not the bare
   `integrationRef` — see Step 1):
   `git --no-pager diff <baseRef>...plan/<slug> --stat`
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

- Write the PR URL onto the plan state as a `references[]` entry
  `{ kind: url, path: <pr-url>, label: "PR #<number>" }` (the `artifactRef` shape —
  `meta/schemas/common.schema.json` `$defs/artifactRef`, `additionalProperties: false`,
  so there is no separate slot for a bare PR number — fold it into `label`; the URL
  in `path` is the identity). Do **not** add a new `integrationRef` frontmatter field.
- The recorded URL is what the F2 teardown guard **requires** as its `prIdentity`:
  `isTeardownSafe` (`scripts/worktree-teardown.js`) blocks with `pr-identity-missing`
  when none is supplied. **The handoff is wired (both halves):** this Step 4 is the
  producer (it records the `pr-url`); the consumer is the archive flow in
  `{{ASSETS_PATH}}/project-transitions.md` (`archive` Step 5), which reads the recorded
  `pr-url` from `references[]` and calls
  `isTeardownSafe({ branch, baseRef, integrationRef, prIdentity })`. So a merged plan
  whose `pr-url` is recorded no longer blocks at `indeterminate-base`/`pr-identity-missing`
  — it resolves via the live `gh pr view`.
- The **authoritative** integration signal is NOT this local record — it is the
  live PR state on GitHub. The teardown reads `gh pr view <prIdentity>`, where
  `<prIdentity>` is the recorded URL (the `references[]` entry's `path`), and gates
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
- **Cross-WT collision check (Step 1.5) is advisory + operator-prompted** — fires
  only with ≥2 live worktrees; the deterministic gate is the proof, the advisory
  LLM agents are read-only, never gate, and never auto-resolve.
