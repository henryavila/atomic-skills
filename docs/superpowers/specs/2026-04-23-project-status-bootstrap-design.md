# `atomic-skills:project-status bootstrap` — Retroactive Initial State Import

**Status:** Draft v1 (pending implementation plan)
**Date:** 2026-04-23
**Scope:** New subcommand + internal pipeline for `atomic-skills:project-status` that scans the repo, memory, and Claude ecosystem to produce a human-reviewable batch of proposed initiatives on first adoption.
**Relates to:** `docs/superpowers/specs/2026-04-22-status-initiative-design.md` (base skill spec, v2 approved)

---

## 1. Problem

The current `atomic-skills:project-status` skill performs **pure structural scaffolding** on first invocation: it creates `.atomic-skills/` with empty `PROJECT-STATUS.md` and no initiatives. The user must then manually invoke `new <slug>` for every work item already in flight.

In practice, when adopting the skill in a repo that has been running for weeks or months, there is significant latent state that should be captured as initiatives:

- Open branches with uncommitted work
- Open PRs representing in-progress features
- Written plans and specs (`docs/superpowers/{plans,specs}/`) for research or implementation that has started
- Roadmap items in `TODO.md`, `ROADMAP.md`, or equivalent
- Narrative signals in `.ai/memory/MEMORY.md` and the Claude auto-memory (`~/.claude/projects/<repo-path>/memory/`)
- Observations in `claude-mem` that reference past or current initiatives

Without a first-pass import, all of this remains undocumented in the new tracking system. The user either:

1. Skips tracking for pre-existing work (gap in the state model; defeats the "canonical state" principle)
2. Manually creates dozens of initiatives one by one (high friction, invites skipping)
3. Abandons adoption in repos with significant history

**Gap:** No retroactive import mechanism to turn existing latent state into tracked initiatives.

## 2. Relationship to Base Skill

This spec extends the base skill's setup flow, not replaces it. Setup still creates the scaffolding. After setup completes (or at any later point), `bootstrap` runs as a distinct pipeline to discover and propose initiatives for review.

**After bootstrap:** the base skill's normal `new/push/pop/park/emerge` handlers take over. Bootstrap is **one-shot** — it is not intended to run continuously, and new features after adoption go through the normal flow.

## 3. Design Principles

Inherits principles from the base spec (esp. #4 depth-first, #7 opt-in enforcement intensity). Adds:

**BP-1. High recall, user confirms.** The import optimizes for not missing latent work. False positives are resolved by the user in review, not filtered away silently.

**BP-2. Shell enumerates, LLM interprets.** Shell handles mechanical collection (file discovery, git metadata, index parsing). LLM handles content interpretation (reading narratives, extracting candidate pointers from prose, cross-referencing topics, synthesizing summaries). This replaces the simpler "LLM only for ambiguity" rule from the base spec, which underserves narrative-heavy sources like memory.

**BP-3. Never destructively filter.** No signal is silently discarded. Every detected candidate surfaces in the proposal, classified into one of three buckets. The user decides.

**BP-4. Ecosystem-agnostic core, Claude-amplified.** Layer 1 sources (git, docs, TODO.md, local memory, GitHub) work in any IDE. Layer 2 sources (Claude auto-memory, claude-mem) activate only when `.claude/` is detected.

**BP-5. Staging is gitignored; committed output is tracked.** Drafts live in `.atomic-skills/bootstrap-drafts/` (gitignored). After `--commit`, initiatives move to `.atomic-skills/initiatives/` (tracked). This separates "review surface" from "project state".

## 4. Non-Goals

- **Not a continuous background scanner.** One-shot by design. Re-running is safe but is not expected in normal operation.
- **Not a learning extractor.** Does not write to `.ai/memory/`. Bootstrap only READS memory as a signal source.
- **Not a plan generator.** Does not create plans or specs. It references existing plans/specs; if a candidate has no plan, the draft links nowhere.
- **Not a PR/branch manager.** Does not create, merge, or delete branches or PRs. Read-only observation of git and GitHub state.
- **Not a migration tool for other status systems.** Does not parse Jira, Linear, Notion, or other external trackers.

## 5. Architecture Overview

### 5.1 Invocation modes

```
atomic-skills:project-status bootstrap              # full run, writes drafts, opens mdprobe
atomic-skills:project-status bootstrap --dry-run    # terminal summary only, no disk writes
atomic-skills:project-status bootstrap --commit     # materialize reviewed drafts into initiatives
atomic-skills:project-status bootstrap --scope=<list>  # limit signal sources (memory-only|docs-only|git-only)
```

Also offered as optional final step in `setup` flow:
> "Varrer repo pra descobrir iniciativas em andamento? (y/N)"

If `y`, `bootstrap` runs immediately in the same session.

### 5.2 Pipeline (4 phases)

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ 1a. ENUMERATE│→  │ 1b. EXTRACT  │→  │ 2. CLUSTER   │→  │ 3. SYNTHESIZE│
│ shell        │   │ LLM reads    │   │ slug + LLM   │   │ LLM heavy:   │
│ lists files, │   │ narratives,  │   │ fallback;    │   │ drafts,      │
│ git/gh data  │   │ produces     │   │ canonicalize │   │ INDEX.md,    │
│              │   │ signals      │   │ slugs        │   │ mdprobe      │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
                                                                  │
                                                                  ▼
                                              ┌──────────────────────────────┐
                                              │  Human review (outside skill)│
                                              │  Edit / delete drafts        │
                                              └──────────────────────────────┘
                                                                  │
                                                                  ▼
                                              ┌──────────────────────────────┐
                                              │ 4. COMMIT                    │
                                              │ determin. move drafts →      │
                                              │ initiatives/, update index   │
                                              └──────────────────────────────┘
```

Phases 1-3 run together in the initial invocation. Phase 4 is explicitly separate — the user edits drafts outside the skill, then runs `--commit`.

### 5.3 File layout additions

```
.atomic-skills/
├── bootstrap-drafts/                   ← NEW; gitignored
│   ├── INDEX.md                        ← dashboard rendered via mdprobe
│   ├── <slug>.draft.md                 ← 1 per strong/worth-reviewing candidate
│   └── archive/
│       └── <YYYY-MM>-<slug>.draft.md   ← 1 per historical candidate
└── status/
    └── bootstrap.json                  ← NEW; scan cache + commit audit log (gitignored)
```

`.gitignore` additions:

```
.atomic-skills/bootstrap-drafts/
.atomic-skills/status/bootstrap.json
```

## 6. Phase 1a — Shell enumerate

Deterministic collection of structural signals. No content interpretation.

### 6.1 Git sources (always)

```bash
# Active branches (committerdate < 180d)
git for-each-ref --sort=-committerdate \
  --format='%(refname:short)|%(committerdate:iso-strict)|%(authorname)' \
  refs/heads refs/remotes/origin

# Recent commits grouped by Conventional Commits scope (90d)
git log --since='90 days ago' --pretty=format:'%h|%s|%ci' \
  | grep -E '^[a-f0-9]+\|(feat|fix|refactor|docs|test|chore)\([^)]+\):'
```

Output items: `git-branch` records, `commit-group` records (grouped by scope extracted from `feat(<scope>):` prefix).

### 6.2 GitHub CLI (if `gh` available and authenticated)

```bash
gh pr list --state open --json number,title,headRefName,updatedAt,body,labels
gh pr list --state merged --limit 20 --json number,title,headRefName,mergedAt
gh issue list --state open --assignee @me --json number,title,labels,updatedAt
```

Graceful degradation: if `gh` absent or not authenticated, log `source: github skipped (gh unavailable)` and continue. Not a fatal error.

Output items: `github-pr-open`, `github-pr-merged-recent`, `github-issue-open-mine`.

### 6.3 Structured docs (always)

```bash
find docs/superpowers/plans -type f -name '*.md'
find docs/superpowers/specs -type f -name '*.md'
find docs -type d -name 'adr*' -exec find {} -name '*.md' \;
```

Filename convention `YYYY-MM-DD-<topic>.md` is parsed to extract an authored date for freshness scoring.

Output items: `doc-plan`, `doc-spec`, `doc-adr`.

### 6.4 Roadmap / TODO files (always)

```bash
for f in TODO.md ROADMAP.md NEXT.md docs/TODO.md docs/ROADMAP.md; do
  test -f "$f" && echo "$f"
done
```

For each file found, shell parses H2/H3 headers to produce `roadmap-section` records with `line_start`/`line_end` spans (so Phase 1b can read just that section).

### 6.5 Local memory (always)

```bash
test -f .ai/memory/MEMORY.md && echo ".ai/memory/MEMORY.md"
find .ai/memory -maxdepth 2 -name '*.md' -not -name 'MEMORY.md'
```

If `MEMORY.md` exists, shell parses it as an index (expected format: bulleted list of `[Title](file.md) — one-line hook`). Each pointer becomes a `memory-local-entry` record.

Files under `.ai/memory/` not linked from `MEMORY.md` are also enumerated as `memory-local-orphan` records (lower default weight).

### 6.6 Claude-ecosystem (Layer 2, conditional on `.claude/` existing)

```bash
# Compute claude project dir from repo path
REPO_PATH=$(pwd | sed 's|^/|-|; s|/|-|g')
CLAUDE_PROJ_DIR="$HOME/.claude/projects/$REPO_PATH"

# Auto-memory files
test -d "$CLAUDE_PROJ_DIR/memory" && \
  find "$CLAUDE_PROJ_DIR/memory" -maxdepth 1 -name '*.md' -not -name 'MEMORY.md'

# claude-mem observations — invoked as MCP tool in Phase 1b, not shell
# (listed here only to reserve the source type)
```

Output items: `memory-claude-auto`, `claude-mem-obs` (deferred to 1b).

### 6.7 Output of Phase 1a

A structured list of **sources**, each with:
- `type`: one of the types listed above
- `id`: unique identifier (path, branch name, PR number)
- `last_activity`: ISO timestamp (from file mtime, git committer date, PR updated_at, filename date, etc.)
- `raw`: type-specific metadata (commit ahead counts, PR state, frontmatter snippet, etc.)

No source content is read into the output at this stage — only metadata and pointers.

## 7. Phase 1b — LLM extract

Applied to **narrative sources only**: `doc-plan`, `doc-spec`, `doc-adr`, `roadmap-section`, `memory-local-entry`, `memory-local-orphan`, `memory-claude-auto`, `claude-mem-obs`.

Structural sources (`git-branch`, `github-pr-*`, `github-issue-*`, `commit-group`) skip 1b and flow directly to Phase 2 — their name or title is itself the signal.

### 7.1 Per-source prompt pattern

For each narrative source, LLM reads the content and produces zero or more **signal objects**:

```yaml
signal:
  source_id: <from 1a>
  source_type: <from 1a>
  topic_hint: <short kebab-case string>
  evidence_quote: <1-2 sentences, verbatim>
  candidate_completion: active | paused | done | unknown
  referenced_identifiers: [<branch names, file paths, slugs mentioned>]
  surfaced_subtopics: [<slugs of laterally related topics>]
```

Internal prompt (applied by the LLM inline):

```
Read this source. For each distinct topic that looks like pending or in-flight work
(not general documentation, not completed retrospectives, not learnings-only content),
emit a signal with:
  - topic_hint: short kebab-case string suggesting a slug
  - evidence_quote: 1-2 sentences from the source, verbatim
  - candidate_completion: active | paused | done | unknown
  - any referenced identifiers (branch names, file paths, existing slugs)
  - surfaced_subtopics: laterally related slugs mentioned

Skip: general documentation, decisions without forward action, completed work,
pure learnings, style guides, API reference material.
```

### 7.2 Claude-mem queries

For `claude-mem-obs`, invoke MCP tool `mcp__plugin_claude-mem_mcp-search__search` with the repo project name filter. Result observations become sources with their title + context as the narrative input to the prompt above.

### 7.3 Multiple signals per source

A single source can produce multiple signals. Example: a memory file titled "Q2 roadmap notes" may mention three distinct initiatives, each becoming its own signal with a different `topic_hint` but sharing `source_id`.

### 7.4 Output of Phase 1b

The combined signal stream (narrative-extracted + structural pass-through) becomes the input to Phase 2.

## 8. Phase 2 — Clustering

### 8.1 Phase 2a — Slug-first deterministic clustering

For each signal, extract candidate slugs:

- **Narrative signals:** `topic_hint` normalized (lowercase, kebab-case, strip leading "the-", "a-", etc.)
- **git-branch:** strip common prefixes (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`) → remaining string
- **github-pr:** strip prefixes from `headRefName`; fallback to slugifying PR title
- **doc-plan / doc-spec / doc-adr:** strip date prefix `YYYY-MM-DD-` from filename, drop `.md`
- **roadmap-section:** slugify section heading
- **commit-group:** use scope verbatim (it's already kebab-case by convention)
- **memory-\***: use `topic_hint` from 1b extraction

Merge rules, applied in this order:

1. **Exact-slug pass.** Signals with identical normalized slug form one cluster each. Result: set of clusters `C_exact`, plus remaining un-grouped signals.
2. **Fuzzy singleton-to-cluster pass.** For each un-grouped singleton signal `s`, compute minimum edit distance between `s.slug` and any cluster in `C_exact`. If min distance ≤ 2 and unique (ties produce orphan instead), merge `s` into that cluster.
3. **No transitive or cluster-to-cluster fuzzy merging.** Two clusters from step 1 are never fuzzy-merged with each other, even if their slugs are within distance 2. Preserves separation when both topics have independent support.
4. Signals still un-grouped after steps 1-2 → orphan list for Phase 2b.

### 8.2 Phase 2b — LLM fallback for orphans

If orphan list is empty, skip.

Otherwise, LLM receives:

```yaml
existing_clusters:
  - slug: <canonical>
    signal_summaries: [<2-3 words per signal>]
orphans:
  - signal: <full signal>
```

For each orphan, prompt:

```
Does this orphan signal semantically belong to any existing cluster?
If yes, which (confidence 0-1)? If no, it becomes its own new cluster.
Threshold for merge: confidence ≥ 0.75.
When merging, record a merge_rationale explaining the semantic link.
```

**Safety rail:** LLM fallback **never** merges two existing slug-matched clusters. It only assigns orphans or creates new singleton clusters.

### 8.3 Phase 2c — Slug canonicalization

Within each cluster, pick canonical slug by priority:

1. Slug of active git-branch member
2. Slug of open github-pr member
3. Slug of most recent plan/spec doc
4. Slug of most recent narrative signal's `topic_hint`
5. Fallback: slug of earliest signal (stable)

Validate against regex `^[a-z][a-z0-9-]{1,39}$`. If invalid:
- LLM proposes 3 alternative slugs
- Recorded in the draft's `bootstrap.slug_alternatives` field
- User picks during review (or accepts the first)

### 8.4 Output of Phase 2

```yaml
clusters:
  - canonical_slug: <slug>
    members:
      - {source_id, source_type, ...signal fields}
    slug_match_type: exact | fuzzy | semantic
    merge_rationale: <null or "LLM merged orphan X because...">
    last_activity: <max of members>
    slug_alternatives: []  # populated only if canonical slug failed regex
```

## 9. Phase 3 — Synthesis + bucket classification

### 9.1 Deterministic bucket assignment

Applied before LLM synthesis. Regra-based, transparent.

**Strong** — any of:
- ∃ git-branch member with activity within 30d
- ∃ github-pr member with state=open
- ∃ ≥3 members of distinct types AND at least 1 with activity within 60d

**Historical** — all of:
- ∄ git-branch with activity within 180d AND ∄ github-pr open
- ∃ strong evidence of completion: (branch merged AND PR closed) OR (plan/spec with authored date > 6mo AND zero activity since)
- May have memory/doc references, but no "live" signal

**Worth reviewing** — everything else (default bucket).

### 9.2 Deterministic confidence score

0.0 to 1.0, capped. Computed by summing the per-source-type weights defined authoritatively in the reference table at **§15.1**. Each member of the cluster contributes its type's weight once (duplicates within a type do not multiply).

Used for display and as secondary sort key within bucket.

### 9.3 Draft file schema (strong and worth-reviewing)

Path: `.atomic-skills/bootstrap-drafts/<canonical-slug>.draft.md`

```markdown
---
initiative_id: <canonical-slug>
status: proposed
proposed_at: <iso>
proposed_bucket: strong | worth-reviewing
started: <earliest signal timestamp, date only>
last_updated: <iso, same as proposed_at>
branch: <branch-name or empty>
worktree:
plan_link: <relative path to plan doc if present>
wip_limit: 2
scope_paths:
  - .

stack:
  - {id: 1, title: "<LLM-inferred title>", type: initiative, opened_at: <iso>}

tasks: {}

parked: []

emerged: []

next_action: "<LLM-inferred next action>"

bootstrap:
  rationale: "<1-2 line justification for bucket assignment>"
  evidence:
    - source_type: <type>
      source_id: <id>
      evidence_quote: <verbatim quote or null for structural sources>
      last_activity: <iso>
  slug_match_type: exact | fuzzy | semantic
  merge_rationale: <null or text>
  confidence: <0.0-1.0>
  slug_alternatives: []
---

# <LLM-inferred title>

## Context (bootstrap-generated)

_This block was auto-generated from detected signals. Keep what's useful, delete what isn't._

<LLM: 2-3 paragraphs synthesizing:
- What the initiative is (from plan/spec/TODO content)
- Current state (branch, PR, last activity)
- What memory sources add (if any)
- Implied next steps>

## Evidence excerpts

<Up to 5 evidence_quotes, newest first, each with `source_id` and timestamp inline>

## Decisions

_(empty — for user to fill if pending decisions exist)_

## Links

<LLM: paths/URLs grouped by type: plans, specs, PRs, memory files>
```

### 9.4 Draft file schema (historical)

Path: `.atomic-skills/bootstrap-drafts/archive/<YYYY-MM>-<canonical-slug>.draft.md`

Differences from strong/worth-reviewing:
- `status: proposed-archived`
- `proposed_bucket: historical`
- `bootstrap.historical_reason: "<explicit completion evidence>"`
- Narrative emphasizes what was completed, not next steps
- No `next_action` (historical initiatives don't have one)
- YYYY-MM prefix in filename comes from the most recent activity timestamp of the cluster

At `--commit`, this draft moves to `.atomic-skills/initiatives/archive/<YYYY-MM>-<slug>.md` with `status: archived`.

### 9.5 LLM prompts in Phase 3

Four micro-prompts per cluster, all reusing already-clustered evidence (no re-reading of sources):

**3.1 Title inference**
```
Given this cluster of signals {members + evidence_quotes},
produce a 4-8 word initiative title in imperative form.
Avoid: "Work on X", "Various X", "Update X stuff".
```

**3.2 Next action inference**
```
Given this cluster and bucket={strong|worth-reviewing|historical}:
- strong → "Resume T-N: <task from plan doc>" or similar actionable next step
- worth-reviewing → question form: "Confirm if still active; pick up at: <implied step>"
- historical → null
Return a single imperative sentence (<120 chars) or null.
```

**3.3 Rationale inference**
```
Explain in 1-2 lines why this cluster landed in bucket={N}.
Reference the decisive signals verbatim.
Example: "Strong: open PR #17 + active branch + 3 recent commits. Matches plan doc 2026-04-10."
```

**3.4 Context synthesis**
```
Produce 2-3 paragraphs synthesizing what the evidence says about this initiative.
Cover: what it is, where it stands, implied next steps. No speculation beyond evidence.
```

### 9.6 INDEX.md generation

After all drafts are written, produce `.atomic-skills/bootstrap-drafts/INDEX.md`:

```markdown
---
generated_at: <iso>
total_candidates: <N>
strong: <N1>
worth_reviewing: <N2>
historical: <N3>
already_tracked: <N4>
---

# Bootstrap Proposal

> Review each candidate below. **Delete the draft file to skip.** Edit freely.
> When done, run `atomic-skills:project-status bootstrap --commit`.

## Sources scanned
- Git: <N> branches, <M> commits (last 90d)
- GitHub: <X> PRs open, <Y> issues assigned to you
- Docs: plans=<N>, specs=<M>, adrs=<P>
- Roadmap: <TODO.md, ROADMAP.md, ...> (N sections total)
- Memory: .ai/memory/ (<N> files), claude auto-memory (<M> files), claude-mem (<K> observations)

---

## ✓ Strong candidates (<N1>)

### `<slug>` — <LLM title>
> **confidence <0.NN>** · bucket strong · [edit draft](<slug>.draft.md)
>
> **Rationale:** <rationale from draft frontmatter>
>
> **Next:** <next_action>
>
> **Evidence:**
> - `<source_id>` (<source_type>, <date>)
> - ...

<!-- repeat per strong candidate, sorted by confidence desc -->

---

## ? Worth reviewing (<N2>)

<!-- same format, sorted by confidence desc -->

---

## ◉ Historical (<N3>)

### `<slug>` — <title> (completed)
> **confidence <0.NN>** · bucket historical · [edit draft](archive/<YYYY-MM>-<slug>.draft.md)
>
> **Rationale:** <rationale>

---

## Already tracked (skipped)

_Initiatives already present in `.atomic-skills/initiatives/` were not proposed._

- `<slug-already-exists>` (status: active, plan: ...)
```

### 9.7 mdprobe launch

After INDEX.md and drafts are written:

1. **Confirmation prompt** (per base spec's intrusive-actions rule):
   > "Open bootstrap proposal in browser? (y/N)"
2. If no: print path to INDEX.md and a terminal summary (same info as dry-run format).
3. If yes:
   ```bash
   mdprobe .atomic-skills/bootstrap-drafts/INDEX.md 2>/dev/null \
     || npx -y @henryavila/mdprobe .atomic-skills/bootstrap-drafts/INDEX.md
   ```
4. Report URL opened by mdprobe.

If mdprobe is unavailable, fall back to terminal summary and instruct the user to open `INDEX.md` manually.

## 10. Review workflow (human, outside skill)

**Explicitly outside skill control.** User edits drafts in their editor of choice.

### 10.1 User actions per draft

| Action | Effect |
|--------|--------|
| Leave file as-is | Accepted as generated; becomes active/archived initiative on `--commit` |
| Edit fields | Accepted with user's edits; skill re-validates on `--commit` |
| Delete file | Skipped; not imported |
| Split file into two | User creates second file manually (copies frontmatter, changes slug); both imported |
| Rename file slug | Skill detects rename via frontmatter `initiative_id`; uses filename as authoritative |

### 10.2 Constraints re-checked at commit

- `initiative_id` must match regex `^[a-z][a-z0-9-]{1,39}$`
- `initiative_id` must be unique across `.atomic-skills/initiatives/` and `.atomic-skills/initiatives/archive/`
- `status` must be `proposed` (→ becomes `active` on commit) or `proposed-archived` (→ becomes `archived`)
- `stack[0].title` non-empty

Violations abort that specific draft with a clear error, continue others. Aborted drafts remain in `bootstrap-drafts/` for the user to fix.

## 11. Phase 4 — Commit

### 11.1 Invocation

```
atomic-skills:project-status bootstrap --commit
```

Must be run in the same repo. No network I/O. Purely local file operations.

### 11.2 Algorithm

```
1. Require .atomic-skills/bootstrap-drafts/ to exist. If not: error "nothing to commit".
2. List all *.draft.md under bootstrap-drafts/ (including archive/).
3. For each draft:
   a. Parse YAML frontmatter.
   b. Validate constraints (§10.2). On failure: log, skip, continue.
   c. Determine destination:
      - status: proposed → .atomic-skills/initiatives/<slug>.md
      - status: proposed-archived → .atomic-skills/initiatives/archive/<YYYY-MM>-<slug>.md
   d. Check destination uniqueness. If exists: log conflict, skip.
   e. Transform frontmatter:
      - Delete bootstrap: block
      - status: proposed → active; status: proposed-archived → archived
      - Update last_updated to now
   f. Write to destination; delete draft.
4. Update PROJECT-STATUS.md:
   - For each committed active initiative: append to "Active Initiatives" table
   - For each committed archived: append to "Recently Archived" (cap at 10)
   - Update last_updated in frontmatter
5. Write commit audit to .atomic-skills/status/bootstrap.json:
   - timestamp
   - committed: [list of slugs]
   - skipped: [list of {slug, reason}]
   - errors: [list of {slug, error}]
6. Report summary to user:
   - "Committed N initiatives (N active, M archived)"
   - "Skipped K (reasons listed)"
   - If errors: "L errors — see .atomic-skills/status/bootstrap.json"
7. Cleanup prompt:
   - If `bootstrap-drafts/` is empty after the commit loop: prompt "Remove bootstrap-drafts/? (y/N)".
   - If drafts remain (failed validations or conflicts): skip the prompt, report "N drafts remain in bootstrap-drafts/; fix and re-run --commit".
   - Respects intrusive-actions rule; never deletes without confirmation.
```

### 11.3 Idempotency

Running `--commit` twice:
- First run: processes all drafts, moves them to initiatives/.
- Second run: `bootstrap-drafts/` is empty (or user declined cleanup but drafts were already moved).
- If empty: "nothing to commit" — exit 0, no action.
- If user added new drafts manually between runs: processes them normally.

### 11.4 Partial failure recovery

If step 3 fails mid-loop:
- Already-committed drafts remain committed.
- Failed drafts remain in `bootstrap-drafts/` with original content.
- Audit log captures both.
- User re-runs `--commit` to retry failed drafts after fixing them.

No transactional rollback — each draft is independent.

## 12. Error handling and failure modes

### 12.1 Missing tools

| Tool missing | Behavior |
|--------------|----------|
| `git` | Fatal — abort with "not a git repo or git missing" |
| `gh` | Skip GitHub sources with log; continue |
| `mdprobe` / `npx` | Skip browser open; terminal summary only; continue |
| MCP claude-mem | Skip claude-mem-obs source with log; continue |

### 12.2 Malformed sources

- YAML frontmatter parse error in memory/doc file → skip file, log warning
- Unreadable file (permissions, broken symlink) → skip, log warning
- Empty file → skip silently

### 12.3 `.atomic-skills/` missing

Bootstrap requires setup to have run. If `.atomic-skills/` missing:
- Abort with "run setup first (`atomic-skills:project-status` with no args)"
- Do not silently invoke setup (explicit user intent required)

### 12.4 Pre-existing initiatives

Every cluster's canonical slug is checked against `.atomic-skills/initiatives/<slug>.md` and `.atomic-skills/initiatives/archive/**`. If match:
- Skip draft generation
- Add entry to INDEX.md "Already tracked (skipped)" section
- Include reason: `<slug>` (status: <existing status>, started: <date>)

### 12.5 Conflicting drafts from prior run

If `.atomic-skills/bootstrap-drafts/<slug>.draft.md` already exists when regenerating:
- Prompt per draft: `[k]eep existing / [r]egenerate / [s]kip this cluster`
- Batch option: `[K]eep all / [R]egenerate all` (capital letter)
- Default: keep (safer)

### 12.6 Ambiguous canonical slug

If slug validation fails and LLM can't propose a unique valid alternative:
- Emit draft anyway with `status: proposed-invalid-slug`
- Place in `bootstrap-drafts/_invalid/` subdirectory
- INDEX.md includes "Invalid slug — needs rename" section
- `--commit` skips these; user must rename filename + `initiative_id` before re-running commit

## 13. Testing strategy

### 13.1 Unit tests (deterministic components)

Location: `tests/bootstrap.test.js` (new file following existing test conventions).

- **Slug extraction** from each source type (git-branch, doc-plan, roadmap-section, etc.) with table-driven cases
- **Slug fuzzy-match** edit-distance correctness (boundary: distance 2 should merge, 3 should not)
- **Bucket classification** rules with synthetic clusters covering:
  - Obvious strong (branch + PR + plan)
  - Obvious historical (merged branch + closed PR + old plan)
  - Borderline worth-reviewing (plan only, memory only, single-signal clusters)
- **Confidence calculation** additive math
- **Draft → initiative transformation** (frontmatter strip, status rewrite, filename derivation)

### 13.2 Integration tests (fixture repos)

Location: `tests/bootstrap-fixtures/<scenario>/` with before/after directory states.

Scenarios:
- `fresh-repo-no-signals` → produces empty INDEX.md, exits clean
- `repo-with-single-strong` → one plan + one branch → one draft, bucket strong
- `repo-with-all-buckets` → mixed signals producing representative each-bucket draft
- `repo-with-pre-existing-initiatives` → skips overlaps, drafts only new
- `repo-with-orphan-signals` → exercises LLM fallback clustering (mocked)
- `repo-without-gh-cli` → graceful degradation

### 13.3 LLM-mediated components

Signal extraction, LLM cluster fallback, title/next_action/rationale/context synthesis cannot be verified with golden outputs (non-deterministic). Approach:

- **Structural tests**: verify LLM outputs conform to expected schema (valid YAML signal objects, valid slug chars, word count bounds on title)
- **Behavioral tests**: feed known inputs, assert detected topic presence (e.g., "topic_hint contains 'review' when input mentions code review")
- **Snapshot tests**: manual review of generated drafts for fixture repos; regenerate snapshots on intentional prompt changes

### 13.4 End-to-end

Single E2E test: set up temp repo with representative signals, run `bootstrap`, run `--commit`, assert final `.atomic-skills/initiatives/` state matches expected set of slugs + bucket distribution.

## 14. Open questions / future extensions

### 14.1 Out of scope for v1

- **Multi-repo bootstrap.** Only scans the current repo. Cross-repo coordination deferred.
- **Stakeholder attribution.** No author/owner detection. All initiatives imported as unassigned.
- **Deep memory traversal.** Only scans MEMORY.md + top-level memory files. Subdirectories (`.ai/memory/feedback/`, etc.) not walked recursively beyond depth 2.
- **Slack/Linear/Jira integration.** Memory and git only.

### 14.2 Candidates for v2

- **Learned preferences.** After several `--commit` runs, skill learns which bucket thresholds the user tends to override and adjusts rationale wording.
- **Incremental re-scan.** `bootstrap --since <date>` to discover only new signals since last run.
- **Conflict-aware edit.** If user edits a draft, skill suggests refinements on re-scan (diff-aware).

## 15. Appendix

### 15.1 Source type reference

| Type | Phase 1a | Phase 1b | Weight | Layer |
|------|----------|----------|--------|-------|
| git-branch | ✓ | — | 0.30 | 1 |
| github-pr-open | ✓ | — | 0.30 | 1 |
| github-pr-merged-recent | ✓ | — | 0.05 | 1 |
| github-issue-open-mine | ✓ | — | 0.15 | 1 |
| commit-group | ✓ | — | 0.05 | 1 |
| doc-plan | ✓ | ✓ | 0.20 | 1 |
| doc-spec | ✓ | ✓ | 0.20 | 1 |
| doc-adr | ✓ | ✓ | 0.15 | 1 |
| roadmap-section | ✓ | ✓ | 0.15 | 1 |
| memory-local-entry | ✓ | ✓ | 0.10 | 1 |
| memory-local-orphan | ✓ | ✓ | 0.05 | 1 |
| memory-claude-auto | ✓ | ✓ | 0.10 | 2 |
| claude-mem-obs | — | ✓ | 0.10 | 2 |

### 15.2 Bucket classification flowchart

```
┌─────────────────────────┐
│ Cluster assembled       │
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────┐
    │ Any strong    │─yes→ STRONG
    │ condition?    │
    └───────┬───────┘
            │ no
            ▼
    ┌───────────────┐
    │ All historical│─yes→ HISTORICAL
    │ conditions?   │
    └───────┬───────┘
            │ no
            ▼
        WORTH-REVIEWING
```

Strong conditions (any):
- git-branch with activity <30d
- github-pr state=open
- ≥3 members of distinct types AND ≥1 with activity <60d

Historical conditions (all):
- ∄ git-branch with activity <180d
- ∄ github-pr open
- strong completion evidence: (branch merged AND PR closed) OR (plan/spec dated >6mo AND no later activity)

### 15.3 Invocation summary

| Command | Effect |
|---------|--------|
| `bootstrap` | Full pipeline 1a-3; writes drafts; opens mdprobe (after confirm) |
| `bootstrap --dry-run` | Pipeline 1a-3 in-memory; terminal summary only; no disk writes |
| `bootstrap --commit` | Pipeline 4 only; requires existing drafts |
| `bootstrap --scope=<list>` | Limit sources; comma-separated: `git`, `github`, `docs`, `roadmap`, `memory-local`, `memory-claude`, `claude-mem` |

### 15.4 Integration with existing skill surface

This spec adds to the base skill without changing existing modes:

| Existing mode | Effect of bootstrap |
|---------------|---------------------|
| Setup | Optional `(y/N)` offer to run bootstrap as final step |
| Default (no args) | Unchanged |
| `new <slug>` | Unchanged; bootstrap is independent path |
| `--list` / `--stack` / `--archived` | Unchanged; includes bootstrapped initiatives transparently |
| `--browser` | Unchanged; separate from bootstrap's mdprobe usage |
| `--report` | Unchanged |
| Mutation modes (`push`/`pop`/`park`/`emerge`/`promote`/`done`/`archive`/`switch`) | Unchanged |

## 16. Success criteria

A successful implementation satisfies:

1. **Recall:** On a representative repo with ≥5 in-flight topics across git/docs/memory, bootstrap surfaces ≥90% of topics as candidates (measured by manual audit).
2. **Precision of strong bucket:** Of candidates classified strong, ≥80% are confirmed by user as legitimately in-flight.
3. **Historical bucket discipline:** Of candidates classified historical, ≥95% are confirmed by user as completed (low false-active rate).
4. **Commit correctness:** `--commit` never silently discards a draft. Every draft either becomes an initiative or produces an audit log entry explaining why it didn't.
5. **Idempotency:** Running bootstrap twice on an unchanged repo produces the same proposed clusters (modulo LLM non-determinism in narrative wording).
6. **Graceful degradation:** Missing `gh`, missing `mdprobe`, missing Layer 2 sources all produce warnings, not failures.
7. **Performance:** On a repo with ~20 narrative sources, full pipeline (excluding mdprobe launch) completes within 2 minutes of LLM time.
