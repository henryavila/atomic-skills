# project — `finalize` (publish the plan branch as a PR) (lazy detail)

Loaded by the router for `/atomic-skills:project finalize <slug>`.

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
3. **Automate plan-end gates (when durable automate is active)** — see **Step 1.7**.
   Use **`isDurableAutomateActive`** / stamp `executionMode: automate` (not session
   `isAutomateActive` alone — clear flag / `--mode=1` must not skip plan-end while
   the stamp remains). Finalize **HARD-BLOCKS** unless both `planEndReviewOk` and
   `userValidationOk` are true (`src/plan-end-review.js`). Non-automate plans skip
   this precondition entirely.

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

**Existence check on `origin` (declared + default — closes the "develop silencioso"
gap).** A `declared` or `default` ref RESOLVES without prompting, but the ref it
names may not exist on `origin` — and `default` silently yields `develop`, which a
fresh repo often lacks. So `source: not-configured` is **not** the only way to reach
a base the remote does not have. Before trusting a `declared`/`default` resolution,
confirm the resolved ref exists on `origin`, with {{BASH_TOOL}}:

```
git ls-remote --exit-code --heads origin <ref>   # non-zero exit ⇒ ref absent on origin
```

(or `git show-ref --verify --quiet refs/remotes/origin/<ref>` against a fetched
remote-tracking ref). A non-zero exit means the resolved ref is **absent on
`origin`** — do NOT proceed to `gh pr create --base <ref>` against a ref the remote
lacks (the publish would fail half-way). Instead fall into **prompt-when-absent**
below (use an existing ref OR create `develop`), exactly as `not-configured` does.
This guard covers **`source: default`** explicitly — today only `not-configured`
prompts, so a `default`-resolved `develop` missing on `origin` is the silent gap
this closes. The check lives HERE at the **consumer**; the F1 resolver
(`scripts/integration-ref.js`) and its contract are unchanged.

**Two refs, not one (consume `scripts/worktree-teardown.js` `resolveBaseRef`).**
`integrationRef` is the PR `--base` and the value persisted to `routing.json`;
`baseRef` is the ref that exists LOCALLY for git commands (the preview diff).
`resolveBaseRef({ routingConfig })` returns `{ integrationRef, baseRef }`,
preferring `origin/<ref>` then `<ref>`. Use `integrationRef` for `gh pr create
--base` + persistence, and `baseRef` for every local `git` invocation — a clone
with only `origin/develop` (no local `develop`) makes a bare `<integrationRef>`
diff fail.

### Prompt-when-absent (source: `not-configured`, or a resolved `declared`/`default` ref absent on `origin`)

Ask the user via {{ASK_USER_QUESTION_TOOL}} — never auto-pick the base:

- **Use an existing ref** — the user names a branch. Because this ref becomes the
  PR `--base`, confirm it exists **on `origin`** (not merely locally):
  `git ls-remote --exit-code --heads origin <ref>` (exit 0). A ref that resolves
  only locally (`git show-ref --verify --quiet refs/heads/<ref>` but absent on
  `origin`) is **NOT** acceptable as a base until it is pushed — publishing against
  a base `origin` lacks recreates the half-publish failure this guard exists to
  prevent. A local-only ref must be pushed (`git push -u origin <ref>`, exit 0)
  before it is used or persisted.
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
investigation agents via `{{INVESTIGATOR_TOOL}}` fan-out. Parallelism is for READS
only — nothing the agents do writes any tree.
{{/if}}

**Portable fallback:** where a parallel workflow tool is unavailable (e.g. a
read-only `{{INVESTIGATOR_TOOL}}` on another IDE), run Agent A then Agent B
**sequentially**, or record a **registered skip** (WARN) — never a silent pass. The
deterministic gate runs identically everywhere; only the advisory layer degrades.
Calibrated honest: higher-order collisions are RARE in frequency but expensive per
occurrence, which is exactly why this `cross-wt-collision` check is OPTIONAL and
operator-prompted at finalize — not an always-on gate.

## Step 1.6 — Plan-aware target resolution (`plan-aware`, deterministic — `scripts/finalize-plan-scope.js`)

A worktree **SURVIVES one plan and hosts the next**, so a single branch can carry
MORE THAN ONE plan in different lifecycle stages (the dogfood: `multiplan` carried an
ARCHIVED plan + an active one). `focus.json` always points at the NEWEST plan
(`scripts/emit-focus.js` pickFocus), never the finished one — so resolving "the
active plan" via the focus pointer would finalize the **WRONG** plan on a multi-plan
branch. **`branch ≠ plan`:** the push stays `plan/<branch>`, but the **target is a
plan SLUG**, resolved EXPLICITLY here — never silently from the focus pointer.

**Grammar alignment:** `finalize` requires the operator to pass the target as
`finalize <slug>`. A bare `finalize` stops before `scripts/finalize-plan-scope.js`
with: "finalize requires an explicit plan slug; rerun `atomic-skills:project finalize <slug>`."
Do not prompt and then infer from focus inside the same run: the explicit slug is
the resume-safe transaction key, and a cancelled prompt must have zero publish
effect.

### The deterministic guard is the proof — `scripts/finalize-plan-scope.js`

Enumerate every `projects/<project-id>/*/plan.md` present on the branch, parse them,
and call `resolveFinalizePlanScope({ plans, focusSlug, targetSlug, confirmed })`
(pure, never-throws, **fail-closed**). It returns `{ decision, target,
classifications, warnings, blockReason }`:

- **`classifications`** — each branch plan as `target` / `other-active` /
  `archived-unmerged`.
- **`decision: 'block'`** (do NOT publish) when ANY holds:
  - the explicit `targetSlug` is missing, not found among the branch plans, or the
    input is malformed — **fail-closed**: an indeterminate target never publishes;
  - the target is **not terminal** — ready-to-publish means every phase `done`
    (status still `active` pre-archive per P2) OR already `archived`; an `active`
    target with an un-done phase BLOCKS, with `blockReason` naming the phase(s);
  - the target **≠ the slug `focus` would pick** AND the operator has not
    `confirmed` the mismatch — `blockReason` surfaces `branch ≠ plan` explicitly.
- **`warnings`** — one per non-archived **sibling** (`other-active`) plan a branch
  merge would drag along; surfaced as WARN, **never** auto-resolved.

A `block` HALTS finalize with the `blockReason`; the operator then picks the right
explicit target, **confirms** an intentional `branch ≠ plan` finalize, or brings the
target to terminal first — never a silent focus default. When the block is a
non-terminal target, also print the predecessor command: `phase-done` for the
current open phase, or `done <task-id>` when the active phase still has open
tasks. This guard is DETERMINISTIC and verify-claim-able
(`verified_by: scripts/finalize-plan-scope.js`) — it is the **proof**, not
advice.

### Status-regression detection is ADVISORY — reuses the F4 (Step 1.5) agent lane

With **≥2 live worktrees**, also call `detectPlanStatusRegression({ branchPlans,
refPlans })`: it returns the plans whose status on THIS branch is **BEHIND** the same
plan on the `integrationRef` (e.g. the branch has a plan `active` while the ref
already has it `archived`) — a blind merge would **regress** that plan's lifecycle.
This is **advisory / read-only**, reusing the exact discipline of the Step 1.5
agents (A/B): it **routes to a human, NEVER gates, NEVER auto-resolves** (Iron Law —
reading parallelizes, merge/code stays serial, R-XAGENT-03). The structural cure
(partitioning the `.atomic-skills/projects/` tree by ownership) stays the SEPARATE
plan Decision 5 named; this step only DETECTS and WARNs.

This worktree's copy of finalize is the single source of truth for the skill; older
copies on other worktrees converge on merge (skill-version drift across worktrees is
out of scope — the operator's call).

## Step 1.7 — Plan-end external-both + user validation (automate only — HARD-BLOCK)

**When this step runs:** only when **`isDurableAutomateActive({ planExecutionMode })`**
is true (`src/plan-end-review.js` — stamp `executionMode: automate` **or** explicit
`automateActive: true`). **Do not** early-exit on session `isAutomateActive` alone:
`--clear-execution-mode` / `--mode=1` turn the *session* off but leave the stamp;
plan-end gates stay **on** until `clearExecutionModeStamp` removes the stamp.
Non-automate plans (no stamp) **skip this step entirely**.

**Design load-bearing (D7 + D9 + D12):** under durable automate, plan finalize requires a
plan-end `review-code` with **`external-both` only** (not bare `both` / `both-claude` —
`planEndReviewOk` rejects `mode !== 'external-both'`) on the plan integration range, a
machine-checkable receipt, **and** explicit operator validation of the
implementation + durable decisions log. Soft “point the operator at review” is
**not** a success path. Never auto-merge PRs; never auto-archive after the last
phase turns green.

**Legs that count:** family-different **`codex` | `grok` | `claude`** with
`status: succeeded` and `familyDifferent: true` (`KNOWN_EXTERNAL_PROVIDERS`).

### 1.7.1 — Resolve durable automate + load receipt / validation

1. Compute `durableAutomate = isDurableAutomateActive({ planExecutionMode: plan.executionMode })`
   (optionally pass `automateActive: true` to force). **If not durable → continue to
   Step 2.** Never use session-only `isAutomateActive({ clearExecutionMode: true })` to
   skip this step while the stamp remains.
2. Load the durable plan-end receipt from plan frontmatter `planEndReview` when
   present (schema: `meta/schemas/plan.schema.json`). If absent, treat receipt as
   missing (`planEndReviewOk` → false) unless the operator is about to run the
   review in this step.
3. Load `userValidatedAt` from plan frontmatter (ISO-8601). Optional
   `validatorId` is audit-only and does **not** alone satisfy the gate.

### 1.7.2 — Run plan-end `external-both` (or record `--skip-plan-end-review`)

**Before any push or PR create**, ensure a plan-end review exists:

1. **Range:** plan integration range — `baseRef...plan/<slug>` (or
   `integrationRef`/`develop`…HEAD as resolved in Step 1). Same range used for the
   Step 2 diff preview.
2. **Mode:** `atomic-skills:review-code <range> --mode=external-both`.
   - Same-family legs are filtered by `resolveReviewRoute` (Grok host → Codex only;
     Codex host → Grok only). A **single** remaining family-different external leg
     is OK when that leg `succeeded`.
   - Collect per-leg status `succeeded | failed | skipped` (absent ⇒ skipped).
   - Partial success (one of two externals succeeded) satisfies the ≥1 rule; merge
     keeps the successful half per `external-both` merge semantics.
3. **Persist receipt file** under `.atomic-skills/reviews/` (e.g.
   `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>-plan-end.md`) with per-leg
   outcomes and the cleaned artifact identity.
4. **Link from plan body `## Reviews`:** append/update a plan-end line, e.g.
   `- plan-end external-both: <PASSED | FAILED | SKIPPED — <reason>> — <reviews/…-plan-end.md>`
   with per-leg notes when useful (`codex=succeeded`, `grok=skipped`, …). Re-running
   updates the existing plan-end line; never silent drop.
5. **Stamp frontmatter `planEndReview`** (machine fields for `planEndReviewOk`):
   ```yaml
   planEndReview:
     mode: external-both
     range: "<baseRef>...plan/<slug>"
     reviewFile: ".atomic-skills/reviews/<…>-plan-end.md"
     legs:
       - { provider: codex, status: succeeded, familyDifferent: true }
       - { provider: grok, status: skipped, familyDifferent: true }    # example host filter
       - { provider: claude, status: skipped, familyDifferent: true }  # third external; counts when succeeded
     verifiedAt: "<ISO-8601>"
   ```

### 1.7.3 — `--skip-plan-end-review` (guided; non-empty reason REQUIRED)

When zero family-different providers remain, both CLIs are unavailable, or the
operator accepts residual risk, do **not** strand the plan. Offer a guided skip:

- CLI / operator flag: **`--skip-plan-end-review`**
- Durable mapping: `planEndReview.skipPlanEndReview: true` + **non-empty**
  `planEndReview.skipReason`
- Prefer taxonomy tokens from `SKIP_PLAN_END_REASON_TAXONOMY`
  (`src/plan-end-review.js`):
  - `no-family-different-provider`
  - `external-providers-unavailable`
  - `operator-accepted-residual-risk`
  - `single-external-leg-already-reviewed-at-phase`
- Free-form reasons are accepted **only if non-empty after trim**. Empty /
  whitespace-only / missing `skipReason` ⇒ `planEndReviewOk` stays **false**
  (HARD-BLOCK). Record the skip line in `## Reviews` as
  `- plan-end external-both: SKIPPED — <reason>`.

### 1.7.4 — User validation (`userValidationOk`)

After plan-end review (or recorded skip), the operator must validate the
implementation and the durable decisions log (phase writer / evaluation /
routing dispositions):

1. Present a short audit surface: last-phase decisions log, plan-end receipt
   summary (per-leg statuses or skip reason), open residual risks.
2. On explicit operator accept, stamp plan frontmatter
   `userValidatedAt: <ISO-8601 now>` (schema field). Optional free-form
   validator id may be noted in handoff / review prose — it is **not** a schema
   substitute for the timestamp.
3. `userValidationOk({ automateActive: true, userValidatedAt })` requires a
   non-empty ISO-8601-ish timestamp. Missing/empty/`ok`/`yes` ⇒ gate false.

### 1.7.5 — Machine HARD-BLOCK (single definition)

Call the pure helpers — do **not** re-derive the predicate in prose:

```js
import {
  planEndReviewOk,
  userValidationOk,
  automatePlanEndGatesOk,
} from 'src/plan-end-review.js';

const gates = automatePlanEndGatesOk({
  planExecutionMode: plan.executionMode, // stamp-first durable (H1)
  receipt: plan.planEndReview,           // or null if missing
  userValidatedAt: plan.userValidatedAt,
});
// gates.ok === false ⇒ HARD-BLOCK finalize (and archive — see project-transitions.md)
// Prefer canFinalizeOrArchive from src/automate-orchestrator-gates.js (same predicate).
```

| Condition | Result |
|---|---|
| `planEndReviewOk` false (missing receipt, all legs failed/skipped, or skip without non-empty reason) | **HARD-BLOCK** finalize — print which leg(s) failed / that skip needs a reason; offer re-run external-both or `--skip-plan-end-review <reason>` |
| `userValidationOk` false under automate | **HARD-BLOCK** finalize — prompt operator validation; stamp `userValidatedAt` only after explicit accept |
| both true | proceed to Step 2 (diff + proposed PR halt) |

**Invariant:** finalize under automate never creates a PR while `automatePlanEndGatesOk`
reports `ok: false`. Archive re-checks the same gates
(`{{ASSETS_PATH}}/project-transitions.md` → `archive`).

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
- **Plan-aware target resolution (Step 1.6) resolves an EXPLICIT plan slug from `finalize <slug>`** — never
  the silent `focus` default. The deterministic guard
  (`scripts/finalize-plan-scope.js`) BLOCKS a non-terminal or
  `branch ≠ plan`-unconfirmed target; the status-regression detector is
  advisory/read-only (reuses the F4 lane, never gates, never auto-resolves).
- **Automate plan-end gate (Step 1.7)** — when **`isDurableAutomateActive`**
  (stamp `executionMode: automate`), finalize **HARD-BLOCKS** unless
  `planEndReviewOk` (`mode: external-both` receipt; legs codex|grok|claude;
  under `.atomic-skills/reviews/` linked from `## Reviews`, or
  `--skip-plan-end-review` with non-empty reason) **and** `userValidationOk`
  (`userValidatedAt` ISO stamp). Session clear without unstamp does **not**
  skip the gate. Non-automate plans are unchanged. Never auto-merge.
