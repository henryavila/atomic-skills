# project — drift, context & codex review tracking (lazy detail)

Loaded by the router for: `scope-creep`, `why`, `re-ratify`, `review-due`, and the CODEX REVIEW line rendered in the default/terminal view.

## `scope-creep` (view command, read-only)

On-demand drift report. Renders the output of `src/scope-drift.js`:`computeDrift(plan, initiatives)` formatted for terminal.

Output sections:
- **Header**: plan slug + total phases + plan-wide scope expansion %
- **Phases that grew** (table): phase id, initiative slug, original/added/growth%, closed?
- **Phases added mid-execution** (list): phase id + provenance.surfacedAt + surfacedDuring + `context.solves` (truncated to one line)
- **Parked zombies** (table): initiative · title · `solves` · age in days · lastReviewedAt age. Default age threshold: 30 days. Configurable via `.atomic-skills/status/config.json` `parkedZombieDays`. Items where `lastReviewedAt` > `staleContextDays` (default 14) are marked with a `⌛` glyph.
- **Stale-context items** (list): every task/parked/emerged with `lastReviewedAt` older than `staleContextDays`, sorted by age. Recommends `re-ratify <id>` per row.
- **Recommendation footer**: e.g. "F0 grew 67% — consider `split-phase F0`. 3 parked zombies older than 30d — `promote` or `park <idx> --delete`. 5 items with stale context — `re-ratify` each."

The command is read-only. It surfaces drift; it does not mutate.

## `why <id>` (view command, read-only)

The canonical answer to "what is this item and does it still make sense?". Locates `<id>` across tasks / parked / emerged / phases (in that priority order, returning the first match — or asking the user to disambiguate if a `parked`/`emerged` title collides with a task id).

Output shape:

```
T-002 · pending · age 2d · lastReviewedAt: 2d ago

TITLE:  Add canary smoke test for cross-landlord case

SOLVES: Without a canary, every matcher fix runs against a moving target —
        regressions in the data layer go undetected for weeks.

TRIGGER (when surfaced):
        Matcher fix candidate passed yesterday and failed today on the same
        input; realized the dataset itself is drifting.

ASSUMES STILL VALID:
  ✓ Canary dataset is the right verification mechanism
  ✓ A single canary covers the cross-landlord case

PROVENANCE:
  surfacedAt:     2026-05-19T16:00:00Z
  surfacedDuring: v3-redesign/F0/T-002
  surfacedBy:     ai

RATIFIED:
  ratifiedAt:     2026-05-19T16:10:00Z (by human)
  lastReviewedAt: 2026-05-19T16:10:00Z

NEXT: blocked on T-002 — run `done T-002` to unblock.
```

The render is read-only. It does not mutate. When `lastReviewedAt` exceeds `staleContextDays` (default 14, configurable), prepend a `⚠ Not re-reviewed in <N> days — premises may have shifted. Run \`re-ratify <id>\`?` banner.

Items shipped in the original materialization (no provenance, no context) get a minimal render — title + status + age + "this is an original-materialization item; narrative lives in the plan body".

## `re-ratify <id>` (mutation command)

Re-articulates the `context` of an existing item. Used when `lastReviewedAt` is stale, when the user notices the original `solves` no longer applies, or before promoting a long-parked item.

Steps:
1. Locate `<id>` (same resolver as `why`). Print the current context.
2. Print a `Proposed re-ratify:` block with the current values pre-filled — the user can `ratify` (just bump `lastReviewedAt`), paste edits (full re-articulation), or `cancel`.
3. On ratify: update `context.lastReviewedAt = now`. If edits were pasted: also update `solves` / `trigger` / `assumesStillValid` per the edit. `ratifiedAt` advances to now; `ratifiedBy: human`.
4. Save. Print a one-line confirmation.

The original `ratifiedAt` is replaced — that's intentional. The audit trail of "this item used to mean X, now means Y" lives in git history of the .md file, not in a separate field, to avoid context bloat.

> For batch re-articulation of migration placeholders, use `re-bootstrap <slug>` (`{{ASSETS_PATH}}/project-migrate.md`).

## Codex review tracking

`review-code --mode=codex` (or `--mode=both`) is the cross-model adversarial review gate (see `skills/en/core/review-code.md` — the codex sub-flow inside `review-code`). This skill tracks when it was last run against the current branch so the user knows whether the in-flight work is reviewed or accumulating un-reviewed surface.

### State file

`.atomic-skills/status/last-review.json` — single source of truth, updated by the user (or by this skill's `review-due` command on completion):

```json
{
  "schemaVersion": "0.1",
  "branch": "v2-rebuild",
  "lastReviewedCommit": "a3f1c2d",
  "lastReviewedAt": "2026-05-20T13:38:06Z",
  "reviewFile": ".atomic-skills/reviews/2026-05-20T13-38-06Z-phase-e.md",
  "verdict": "needs_changes",
  "counts": { "blocker": 0, "critical": 1, "major": 3, "minor": 0, "nit": 0 }
}
```

If the file is absent, treat as "never reviewed".

### Default view — CODEX REVIEW line

Run with {{BASH_TOOL}}:

```bash
last_review_commit=$(jq -r '.lastReviewedCommit // empty' .atomic-skills/status/last-review.json 2>/dev/null)
head_commit=$(git rev-parse HEAD)
branch=$(git rev-parse --abbrev-ref HEAD)
if [ -z "$last_review_commit" ]; then
  echo "CODEX REVIEW: never run on this repo"
elif [ "$last_review_commit" = "$head_commit" ]; then
  echo "CODEX REVIEW: up to date (HEAD reviewed at $(jq -r '.lastReviewedAt' .atomic-skills/status/last-review.json))"
else
  commits_behind=$(git rev-list --count "$last_review_commit..HEAD")
  lines_diff=$(git diff --stat "$last_review_commit..HEAD" | tail -1 | grep -oE '[0-9]+ insertions' | grep -oE '[0-9]+' || echo 0)
  echo "CODEX REVIEW: $commits_behind commit(s) behind · $lines_diff lines un-reviewed"
fi
```

Threshold for the visual cue (color the line yellow → "review recommended", red → "review overdue"):

- **green / up-to-date**: HEAD = lastReviewedCommit
- **yellow / recommended**: 1–3 commits OR 1–100 lines un-reviewed
- **red / overdue**: ≥4 commits OR ≥100 lines un-reviewed OR ≥7 days since lastReviewedAt OR a `phase-done` has run since lastReviewedAt

If yellow or red, append to the same line: `→ run \`atomic-skills:project review-due\``

### `review-due`

On-demand command. Invokes `atomic-skills:review-code` with args = `<lastReviewedCommit>..HEAD --mode=codex` (or whole branch if last-review.json is absent), then updates `last-review.json` on completion.

Steps:

1. Read `.atomic-skills/status/last-review.json`. If absent, set `<base>` to `main` (or whatever this repo's main branch is — auto-detect via `git symbolic-ref refs/remotes/origin/HEAD` falling back to `main`/`master`). Else set `<base>` to `lastReviewedCommit`.
2. Compute `<range> = <base>..HEAD`. If `git diff --stat <range>` is empty, announce "No changes to review" and exit.
3. Announce to user:

   > Run cross-model adversarial review on `<range>` (`<N>` commits, `<L>` lines)? Cost: ~$0.50–$1.50, ~5–10 minutes. (y/N)

4. On `y`: invoke `atomic-skills:review-code` with args = `<range> --mode=codex` (skips the Step 0 picker and runs only the codex sub-flow). The skill produces a review file in `.atomic-skills/reviews/`.
5. On completion (review skill returned a verdict): update `last-review.json`:
   ```json
   {
     "schemaVersion": "0.1",
     "branch": "<current branch>",
     "lastReviewedCommit": "<HEAD sha at start of review>",
     "lastReviewedAt": "<ISO timestamp>",
     "reviewFile": ".atomic-skills/reviews/<filename>.md",
     "verdict": "<from review frontmatter>",
     "counts": <from review frontmatter>
   }
   ```
6. Apply fixes for blocker/critical (`review-code` codex sub-flow already does this triage). After fixes are committed, the next `review-due` invocation will see a new HEAD and the cycle repeats.

### `phase-done` integration

The `phase-done` flow (`{{ASSETS_PATH}}/project-transitions.md`) gains a new step BETWEEN "all gates met" and "archive":

> Before archiving the phase initiative, check `.atomic-skills/status/last-review.json`. If `lastReviewedCommit` ≠ HEAD, announce to user:
>
> > Phase `<id>` is closing with `<N>` commits / `<L>` lines un-reviewed since last codex review. Run cross-model review against `<lastReviewedCommit>..HEAD` before archiving? (y/N)
>
> On `y`: invoke `atomic-skills:project review-due` (which delegates to `atomic-skills:review-code --mode=codex`). Apply blocker/critical fixes. After completion, proceed to archive.
> On `n`: archive proceeds, but record `Codex review: SKIPPED at phase-done` in the archived initiative's `## Self-review against code-quality gates` block (alongside the existing G1-G6 entries).

This makes the codex review part of the natural phase-close ceremony rather than a separate ritual the user has to remember.

## `why` vs `scope-creep` vs `re-ratify` (when to use which)

| Question | Command |
|---|---|
| "What is this ONE item and is it still valid?" | `why <id>` (read-only) |
| "Show me ALL the drift across the whole plan" | `scope-creep` (read-only) |
| "This item's premises shifted — re-articulate it" | `re-ratify <id>` (mutates one) |
| "Batch-fix every migration placeholder" | `re-bootstrap <slug>` (mutates many) |
| "Is my in-flight work reviewed?" | the CODEX REVIEW line / `review-due` |
