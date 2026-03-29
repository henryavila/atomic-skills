# as-status Design Spec

## 1. Problem

When development is spread across multiple repositories and workstreams, the current Superpowers flow does not provide a persistent, precise answer to these questions:

- What am I doing right now?
- What has already been done?
- What still needs to be done?
- How many reviews and verifications has each stage received?

Superpowers persists `design` and `plan` artifacts well, but actual execution state often lives in transient session state, TodoWrite state, and commit history. This creates ambiguity, especially when plans are stale, partially executed, or organized differently across repositories.

## 2. Goal

Create a new core skill, `as-status`, that produces a consistent, evidence-backed workstream status report for the current repository.

The skill must answer, with operational precision:

- the current objective
- the current activity
- what is done
- what remains
- the stage of the workstream
- the number and type of reviews/verifications applied per stage

The skill must work across projects with different artifact layouts and naming conventions.

## 3. Non-Goals

- Global multi-repo portfolio tracking in v1
- Automatic silent confirmation of inferred progress
- Assuming fixed paths for design/spec/plan files across all projects
- Replacing the existing Superpowers design → spec → plan → implementation workflow

## 4. Recommended Approach

Three approaches were considered:

### Option A — Read-only inference

Read memory, docs, git, and plans and generate a report without any new persisted tracking artifacts.

**Pros:**
- Lowest friction
- No new files

**Cons:**
- Low precision when plans are stale
- Repeats discovery work every run
- Cannot reliably preserve corrections between sessions

### Option B — Mandatory canonical tracking

Always maintain a canonical status artifact per workstream.

**Pros:**
- Highest precision
- Deterministic source of truth

**Cons:**
- Adds mandatory writing overhead
- Too heavy for exploratory status checks

### Option C — Hybrid tracking

Read first, infer when possible, and only offer canonical persistence when clarity is insufficient or when the user wants to lock in the corrected state.

**Recommendation:** Option C

This balances operational precision with low friction and matches the way Superpowers already relies on explicit artifacts where needed.

## 5. Canonical Workflow Model

`as-status` models a workstream using six canonical stages:

1. `design`
2. `spec`
3. `plan`
4. `code`
5. `verification`
6. `finish`

`review` is not a top-level stage. Reviews are tracked as metrics attached to each stage.

The six stages are canonical, not literal repository folders. Repository-specific workflows are mapped onto them via `_map.yml` first and heuristics second.

Each canonical stage may be in one of these structural states:

- `not started`
- `in progress`
- `blocked`
- `done`
- `skipped`
- `n/a`

Rules:

- `n/a` means the repository/workstream genuinely does not use that stage
- `skipped` means the stage was intentionally bypassed in this workstream
- repeated passes over the same stage do not create new top-level stages; they create additional events owned by the same canonical stage
- lifecycle status answers where the work is; confidence is tracked separately in Section 9

Progress is structural, not percentage-based, and is calculated over applicable stages only:

- `completed_stages / applicable_stages`
- `completed_tasks / total_tasks`

Applicability and completion rules:

- `applicable_stages` = all canonical stages except those marked `n/a`
- `completed_stages` = stages marked `done` or `skipped`
- `skipped` stages still count as applicable because they were an intentional workflow choice
- `n/a` stages are excluded from the denominator because they do not belong to the workstream at all
- inferred-but-unconfirmed completion does not increment structural progress

## 6. Reporting Model

The detailed report opens with a snapshot, not with the pipeline.

### 6.1 Snapshot Header

The header must contain:

- `Workstream`
- `Current Objective`
- `Now`
- `Current Stage`
- `Next Action`
- `Structural Progress`

This is optimized to answer “what am I doing right now?” immediately.

### 6.2 Stage Pipeline

The report then presents the canonical stages in order:

- `design`
- `spec`
- `plan`
- `code`
- `verification`
- `finish`

Each stage contains:

- stage status
  - `not started`
  - `in progress`
  - `blocked`
  - `done`
  - `skipped`
  - `n/a`
- stage confidence
  - `confirmed`
  - `inferred`
  - `unknown`
- short summary
- tasks/deliverables
- review counts and short names
- verification counts and short names
- evidence used

### 6.3 Pending Inferences

If the skill forms relevant hypotheses that are not yet confirmed, it must present them in a separate section, one at a time, each with:

- hypothesis
- supporting evidence
- user decision
  - confirm
  - reject
  - defer

### 6.4 Executive Tail Summary

The report ends with:

- `Done`
- `In Progress`
- `Remaining`
- `Blockers`
- `Next Actions`

## 7. Task Granularity

Task/deliverable detection uses a hybrid model:

1. plan-defined tasks when available
2. real project artifacts discovered in the repository
3. commit groups clustered into coherent deliverables when the plan is incomplete or stale

This avoids depending entirely on a plan that may not reflect real execution.

## 8. Evidence Model

The skill must distinguish between weak, medium, and strong evidence.

### 8.1 Weak Evidence

Useful as hints, never sufficient alone:

- an artifact file exists
- a file name looks relevant
- generic commit activity happened

### 8.2 Medium Evidence

Useful for forming hypotheses:

- one artifact references another
- workflow sequence is coherent
- a diff matches expected files for a task/stage

### 8.3 Strong Evidence

Usable for confirmation when combined appropriately:

- explicit canonical status entry
- explicit human approval
- commit + diff + test/validation aligned to the task
- review/verification record aligned to the stage

## 9. Confidence Classes

Every stage/task-level conclusion must carry a confidence class in addition to its lifecycle status:

- `confirmed`
- `inferred`
- `unknown`

### 9.1 Confirmed

Only if backed by:

- canonical status data, or
- explicit user confirmation

### 9.2 Inferred

A hypothesis supported by evidence but not yet approved by the user.

### 9.3 Unknown

Insufficient or conflicting evidence.

## 10. Confirmation Rules

`as-status` may infer, but it may not silently promote inference to truth.

Rules:

- relevant inferences must be shown explicitly
- evidence must be listed concretely
- approval is one inference at a time
- rejection must correct persistence
- deferred inferences remain pending and do not change confirmed state

If the user rejects an inference, the skill must update:

- the canonical workstream status file, and
- `_map.yml` when the rejection reveals a mapping error

This rule overrides optional persistence for ordinary read-only runs. Once a user correction changes canonical understanding, that correction must be persisted.

## 11. Canonical Tracking Artifacts

`as-status` uses a dedicated tracking directory:

```text
docs/superpowers/status/
```

Recommended files:

- `docs/superpowers/status/_map.yml`
- `docs/superpowers/status/_map.md`
- `docs/superpowers/status/index.md`
- `docs/superpowers/status/<workstream-slug>.md`

### 11.1 `_map.yml`

Machine-readable canonical mapping that tells the tracker where to find artifacts and how to identify workstreams.

It does **not** declare completion. It declares discovery rules and canonical locations.

### 11.2 `_map.md`

Optional human notes about repository-specific conventions.

### 11.3 `index.md`

Repository-wide overview with one line per workstream. Each entry contains:

- objective
- current stage
- structural progress
- next action
- total review count
- `is_current`
- `last_updated`

### 11.4 `<workstream-slug>.md`

Detailed canonical status for a single workstream.

Minimum canonical header fields:

- `title`
- `objective`
- `current_stage`
- `now`
- `next_action`
- `is_current`
- `last_updated`

Each canonical status file must also carry a minimal decision log section so that confirmed corrections are auditable across sessions. Each entry records:

- date/time
- workstream
- decision type
  - inferred-confirmed
  - inferred-rejected
  - map-corrected
- short rationale/evidence summary

## 12. Discovery Strategy

Artifact discovery is hybrid:

1. read `_map.yml` first
2. resolve workstreams and artifact locations from the map
3. if the map is missing or incomplete, use heuristics
4. if heuristics find plausible candidates, present evidence and request user approval before fixing the map

This avoids assuming fixed locations such as `docs/superpowers/specs/...` or `docs/superpowers/plans/...`, while still supporting them as defaults when appropriate.

## 12.1 Source-of-Truth Precedence

When sources disagree, `as-status` resolves conflicts by concern:

### Identity and artifact mapping

1. explicit user correction in the current session
2. `_map.yml`
3. canonical workstream status file
4. `index.md`
5. heuristics

### Workstream state

1. explicit user correction in the current session
2. canonical workstream status file
3. `index.md`
4. evidence-derived provisional state
5. heuristics

### Summary fields

`index.md` is a summary cache, never the authoritative source when a detailed workstream file exists.

Conflict rules:

- if `_map.yml` disagrees with heuristics, `_map.yml` wins
- if `<workstream>.md` disagrees with `index.md`, `<workstream>.md` wins and `index.md` must be refreshed on the next persistence write
- if explicit user correction disagrees with any persisted source, the user correction wins and the affected canonical files must be updated

## 13. Workstream Selection Rules

`as-status` reports on one workstream at a time.

Selection uses a deterministic dominance heuristic.

Each candidate workstream receives a dominance score:

- +100 if the user named it explicitly in the invocation
- +40 if canonical status marks it as `is_current: true`
- +25 if it has pending non-deferred inferences
- +20 if it has the most recent canonical status update
- +15 if the working tree or last 5 commits align to its files/tasks
- +10 if the branch name or document title aligns to the workstream slug/title

Auto-select only when:

- the top candidate has at least one strong evidence signal or two medium evidence signals, and
- the top candidate leads the second candidate by at least 25 points

Otherwise the situation is considered ambiguous and the user must choose the workstream.

## 14. Reviews and Verifications

The report must count reviews and verifications separately.

Counting is event-based, not file-based.

### 14.0 Canonical Event Schema

Every counted review/verification event must resolve to this logical schema:

- `event_key` — unique dedupe key
- `kind` — `review` or `verification`
- `name` — short display label
- `owner_stage` — exactly one of `design|spec|plan|code|verification|finish`
- `source` — canonical-status, artifact, git, test, heuristic
- `evidence_refs` — file paths, commit SHAs, test names, or status entries
- `outcome` — passed, failed, pending, superseded

Logged vs counted semantics:

- all resolved events are logged
- only counted events contribute to stage totals
- counted events are those with outcome `passed` or `failed`
- `pending` events are shown but do not increment totals
- `superseded` events are retained for traceability but do not increment totals
- a rerun counts as a new event only if it has a distinct `event_key`

Dedupe rule:

- events with the same `event_key` count once
- if duplicate evidence is found from multiple sources, merge evidence into one event rather than incrementing the count

Stage attribution rule:

- every event belongs to exactly one `owner_stage`
- the owner stage is the stage whose output the event is evaluating, not the stage where the evidence happened to be found
- if an event could plausibly attach to multiple stages, prefer `_map.yml`
- if `_map.yml` is silent, use the most specific validating stage

Default attribution examples:

- design review -> `design`
- spec review -> `spec`
- plan review -> `plan`
- spec compliance review for an implementation task -> `code`
- code quality review -> `code`
- test suite validation for implemented code -> `verification`
- verification-before-completion check -> `verification`
- release/merge/final wrap-up checklist -> `finish`

### 14.1 Reviews

Formal review events, such as:

- design review
- spec review
- plan review
- spec compliance review
- code quality review

### 14.2 Verifications

Strong validation events, such as:

- explicit verification-before-completion checks
- test suite validation
- strong final checklists with evidence

Self-review alone does not count unless the user explicitly wants it treated as a tracked validation event.

For each stage, the report shows:

- review count
- review short names
- verification count
- verification short names

## 15. Execution Flow

`as-status` executes in this order:

1. resolve context
2. handle workstream ambiguity
3. collect evidence
4. build provisional state
5. present pending inferences
6. offer persistence when useful
7. emit final report

### 15.1 Resolve Context

- read `_map.yml` if present
- read `index.md` and workstream status if present
- identify workstream candidates

### 15.2 Handle Ambiguity

- if one workstream is dominant, continue
- if ambiguous, ask the user which workstream to inspect

### 15.3 Collect Evidence

- locate workflow artifacts via map or heuristics
- read relevant project memory if available
- inspect git history, diff, tests, reviews, validations
- reconstruct workstream progression across the six canonical stages

### 15.4 Build Provisional State

- classify stages/tasks as confirmed, inferred, or unknown
- attach reviews and verifications by stage
- compute structural progress

### 15.5 Present Pending Inferences

- show one inference at a time
- list concrete evidence
- ask the user to confirm, reject, or defer

### 15.6 Offer Persistence

If clarity improves materially, offer to update:

- `index.md`
- `<workstream>.md`
- `_map.yml` when discovery rules need correction

Persistence rules:

- persistence is optional for ordinary read-only status runs that do not change canonical understanding
- persistence becomes mandatory when the user confirms or rejects an inference in a way that changes canonical state
- if the necessary canonical file does not exist yet, the skill must bootstrap the minimal file set before persisting the correction
- bootstrapping rules:
  - create `_map.yml` only when a mapping rule must be preserved
  - create `index.md` and `<workstream>.md` when a workstream-level correction or confirmation must be preserved
  - append a minimal decision-log entry whenever a persisted correction changes canonical understanding

### 15.7 Emit Final Report

Output:

- snapshot header
- stage pipeline
- remaining pending inferences, if any
- executive summary tail

## 16. Success Criteria

The design is successful if `as-status` can, for one repository and one workstream:

- identify the current objective
- identify the current stage
- distinguish done vs remaining work with evidence
- count reviews and verifications per stage separately
- handle stale plans without silently lying
- support heterogeneous project artifact layouts
- preserve corrections across sessions when the user approves persistence
