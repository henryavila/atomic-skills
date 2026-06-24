# project — `discover` (multi-source scan) (lazy detail)

Loaded by the router for `/atomic-skills:project discover [--dry-run|--commit] [--scope=<list>] [--scan=<path>]`.

`discover` is the **multi-source inventory entry-point** — use it when you don't know what work the repo has in flight, or when you have signals scattered across `.ai/memory/`, `docs/`, git, and want a single coherent proposal instead of N manual `adopt`/`migrate`/`new` invocations.

> **Invocation:** `discover` is a **top-level** verb (`/atomic-skills:project discover`), NOT part of the `new` menu — it is a repo-wide scan, not the creation of one entity.

Same Phase 1–4 pipeline (enumerate → extract → cluster → synthesize), extended to **detect multi-phase plan sources** and propose them as Plans (not just standalone Initiatives).

## Invocations

- `discover` — full pipeline (scan + cluster + synthesize); writes drafts to `.atomic-skills/bootstrap-drafts/`; starts aiDeck if needed (`aideck up`), opens discover UI; HALTs for user review before commit
- `discover --dry-run` — same scan, terminal summary only; no files written
- `discover --commit` — materializes approved drafts into the nested tree `.atomic-skills/projects/<project-id>/<slug>/` (legacy flat `.atomic-skills/plans/` + `initiatives/`); updates PROJECT-STATUS.md
- `discover --scope=<list>` — limits sources. Defaults: `git,github,docs,roadmap,memory-local,memory-claude,claude-mem`
- `discover --scan=<path>[,<path>...]` — extra sources beyond defaults (e.g., `--scan=NOTES/,~/myteam/plans/`). Custom paths are walked recursively for `*.md` files. Useful for teams whose convention is not `.ai/memory/`.

## Pre-conditions

- `.atomic-skills/` must exist (run first-time setup, `{{ASSETS_PATH}}/project-setup.md`). If absent: abort with `"run project setup first"`.
- For Layer 2 (Claude ecosystem): `.claude/` must exist in the repo.

## .gitignore

The `.atomic-skills/` tree itself is **versioned** — neither the installer nor setup ignores it. First-time setup gitignores only the *transient* staging; if that step hasn't run, idempotently append:

```
.atomic-skills/bootstrap-drafts/
.atomic-skills/status/bootstrap.json
```

## Phase 1a — Shell enumerate

Deterministic collection. No content interpretation.

> **Exit-code rule**: every command in 1a MUST exit 0 (append `|| true` or use `find` patterns that never fail). Non-zero exits cancel parallel sibling calls and waste tokens on retries.

### Git (always)

```bash
# Active branches (last 180d)
git for-each-ref --sort=-committerdate \
  --format='%(refname:short)|%(committerdate:iso-strict)|%(authorname)' \
  refs/heads refs/remotes/origin

# Recent commits grouped by Conventional Commits scope (90d)
git log --since='90 days ago' --pretty=format:'%h|%s|%ci' \
  | grep -E '^[a-f0-9]+\|(feat|fix|refactor|docs|test|chore)\([^)]+\):' || true

# Push debt — commits ahead of origin/main (signal of unmerged work)
git log --oneline origin/main..HEAD 2>/dev/null | head -20 || true
```

### GitHub CLI (if `gh` is available)

```bash
gh pr list --state open --json number,title,headRefName,updatedAt,body,labels 2>/dev/null || true
gh pr list --state merged --limit 20 --json number,title,headRefName,mergedAt 2>/dev/null || true
gh issue list --state open --assignee @me --json number,title,labels,updatedAt 2>/dev/null || true
```

If it fails: log `source: github skipped (gh unavailable)` and continue. Not fatal.

### Structured docs (always)

```bash
find docs/superpowers/plans -type f -name '*.md' 2>/dev/null
find docs/superpowers/specs -type f -name '*.md' 2>/dev/null
find docs -type d -name 'adr*' -exec find {} -name '*.md' \; 2>/dev/null
find docs -maxdepth 3 -type f -name '*plan*.md' 2>/dev/null
```

### Roadmap (always)

```bash
find . -maxdepth 2 -type f \( -name 'TODO.md' -o -name 'ROADMAP.md' -o -name 'NEXT.md' -o -name 'BACKLOG.md' -o -name 'NOTES.md' \) 2>/dev/null
```

For each file found, parse H2/H3 headers with line spans (shell reads the headers; LLM reads the sections in 1b).

### Local memory (always)

```bash
find .ai/memory -maxdepth 2 -name '*.md' 2>/dev/null | sort
```

Parse `MEMORY.md` as an index (format `[Title](file.md) — hook`). Parse `PROJECT_STATUS.md` (if present) as a dashboard with "Pending" / "Pendente" / "Next steps" / "Próximos passos" sections.

### Custom paths (`--scan=<path>`)

When the user passes `--scan=<path>[,<path>...]`, walk each path recursively for `*.md` files (cap 200 files per path). This is the escape hatch for projects whose memory/plans conventions don't fit `.ai/memory/` (e.g. `NOTES/`, `~/team-plans/`).

```bash
for path in <user-supplied paths>; do
  find "$path" -type f -name '*.md' 2>/dev/null | head -200
done
```

### Claude ecosystem (Layer 2 — only if `.claude/` exists)

```bash
REPO_PATH=$(pwd | sed 's|^/|-|; s|/|-|g')
CLAUDE_PROJ_DIR="$HOME/.claude/projects/$REPO_PATH"
find "$CLAUDE_PROJ_DIR/memory" -maxdepth 1 -name '*.md' -not -name 'MEMORY.md' 2>/dev/null
```

claude-mem note: use MCP tool `mcp__plugin_claude-mem_mcp-search__search` (deferred) with project filter.

Output of 1a: list of `sources` with `type`, `id`, `last_activity`, `raw`. No content reading yet.

## Phase 1b — LLM extract

Applied only to narrative sources (`doc-plan`, `doc-spec`, `doc-adr`, `roadmap-section`, `memory-local-entry`, `memory-local-orphan`, `memory-claude-auto`, `claude-mem-obs`, `custom-scan-entry`).

Structural sources (`git-branch`, `github-pr-*`, `github-issue-*`, `commit-group`, `git-push-debt`) skip 1b.

For each narrative source, read the content and emit zero or more signal objects:

```yaml
signal:
  source_id: <from 1a>
  source_type: <from 1a>
  topic_hint: <short kebab-case slug>
  evidence_quote: <1-2 verbatim sentences>
  candidate_completion: active | paused | done | unknown
  candidate_shape: plan | initiative              # NEW — see Plan-detection heuristic
  referenced_identifiers: [<branches, paths, slugs mentioned>]
  surfaced_subtopics: [<lateral slugs>]
```

### Plan-detection heuristic (NEW)

Set `candidate_shape: plan` when the source has **≥ 2 phase headings** matching the regex `^##\s+(F\d+|Phase\s+\d+|Fase\s+\d+)\b`. Otherwise default to `candidate_shape: initiative`.

Phase headings are the load-bearing signal because `decomposePlan()` requires them. Sources with prose pendentes (e.g., a `## Pendente` section listing 7 tasks) stay `initiative` — they don't map to a multi-phase Plan.

Internal instruction (applied by you, LLM):

> "Read this source. For each distinct topic that looks like pending or in-flight work (not general documentation, not retrospective of completed work, not purely learning content), emit a signal with:
> - topic_hint: short kebab-case slug
> - evidence_quote: 1-2 verbatim sentences
> - candidate_completion: active | paused | done | unknown
> - candidate_shape: plan (≥ 2 phase headings) OR initiative (everything else)
> - referenced identifiers (branches, paths, slugs)
> - surfaced_subtopics: lateral slugs mentioned
>
> Skip: general documentation, decisions with no forward action, completed work, pure learnings, style guides, API reference."

A single source can produce multiple signals. Each inherits `last_activity` from the source (or overrides it if the text cites "re-discussed on YYYY-MM-DD").

## Phase 2 — Clustering

Use the functions in `src/bootstrap.js` via `node -e`:

```bash
# Example: group by exact slug
node -e "
import('./src/bootstrap.js').then(({ clusterByExactSlug, mergeFuzzySingletons, pickCanonicalSlug }) => {
  const signals = JSON.parse(process.argv[1]);
  const { clusters, unmatched } = clusterByExactSlug(signals);
  const merged = mergeFuzzySingletons(clusters, unmatched);
  const withCanonical = merged.clusters.map(c => ({ ...c, canonical: pickCanonicalSlug(c) }));
  console.log(JSON.stringify({ clusters: withCanonical, remainingOrphans: merged.remainingOrphans }));
});
" "$(cat /tmp/signals.json)"
```

A cluster's `candidate_shape` is `plan` if ANY of its signals has `candidate_shape: plan` (the plan-shaped signal wins — Plans subsume multiple per-phase signals).

**Remaining orphans** (those that did not match exact slug or fuzzy singleton) go through LLM fallback: you receive `{clusters, orphans}` and ask for each orphan whether it semantically belongs to an existing cluster (confidence ≥ 0.75 to merge). Never merge slug-matched clusters with each other. Record `merge_rationale` for each LLM merge.

## Phase 3 — Synthesize

For each cluster:

1. Call `classifyBucket(cluster, new Date())` → `'strong' | 'worth-reviewing' | 'historical'`.
2. Call `calculateConfidence(cluster)` → score 0–1.
3. **Branch on `candidate_shape`:**
   - `plan` clusters → generate **plan draft** at `.atomic-skills/bootstrap-drafts/<slug>.plan.draft.md`. The draft frontmatter declares `kind: plan` so Phase 4 routes it through `decomposePlan` + `materializeDecomposition`.
   - `initiative` clusters → generate **initiative draft** at `.atomic-skills/bootstrap-drafts/<slug>.draft.md` (existing behavior).
4. Generate drafts using the appropriate template (initiative drafts use `{{ASSETS_PATH}}/bootstrap-draft.template.md`; plan drafts also include `source_markdown_path` pointing at the in-repo source so Phase 4 can re-read it for decompose).
5. Historical clusters always go to `archive/<YYYY-MM>-<slug>.draft.md` using `{{ASSETS_PATH}}/bootstrap-archived.template.md`.
6. For each draft, you (LLM) generate:
   - **Title** (4–8 imperative words)
   - **goal** (one short imperative sentence)
   - **nextAction** (strong = "Resume T-N: ..."; worth-reviewing = question form; historical = null)
   - **rationale** (1–2 lines citing decisive signals)
   - **Context synthesis** (2–3 paragraphs)
7. Write a **draft** discover-run JSON to `.atomic-skills/bootstrap-drafts/discover-run.draft.json`. This is a simplified shape — the builder normalizes it into the strict schema. Required fields per candidate: `slug, title, goal, kind, bucket, confidence, started, lastUpdated, rationale, draftPath`. All other fields are optional (builder adds defaults). The builder also:
   - Generates `runId` and `generatedAt` if missing
   - Adds `repoPath` from CWD if not in `scanConfig`
   - Converts `sourcesSummary` from `{"git-branch": 3}` to `[{layer, label, signalCount}]`
   - Recalculates `counts` from the candidates
   - Normalizes `bucket` values (`worthReviewing` → `worth-reviewing`)
   - Moves `bucket: "alreadyTracked"` candidates to `alreadyTracked[]` as `{slug, title, trackedAs, lastUpdated}` objects
   - Maps `evidence[].quote` → `evidenceQuote`, `relationships[].from/to` → `fromSlug/toSlug`
   - Fills missing arrays/strings with empty defaults
   - Strips extra fields that strict mode rejects
7b. **MANDATORY build step** — run immediately after writing the draft:
   ```bash
   node ~/.atomic-skills/bin/aideck.mjs build-discover-run \
     .atomic-skills/bootstrap-drafts/discover-run.draft.json \
     --out .atomic-skills/bootstrap-drafts/discover-run.json
   ```
   - If stdout prints the output path: the JSON is valid. Proceed to step 8.
   - If exit code is non-zero: read the error, fix the **draft** file, and re-run. **Do NOT proceed until the build succeeds.** The builder normalizes most common mistakes automatically — errors at this stage mean the draft is missing critical semantic data (e.g., no `slug` on a candidate).
8. Ensure aiDeck is running:
   ```bash
   AIDECK_URL=$(node ~/.atomic-skills/bin/aideck.mjs up --static-dir ~/.atomic-skills/dashboard 2>/dev/null)
   ```
   The bundle and dashboard are installed by `atomic-skills install`. `up` is idempotent: reuses an existing instance or spawns a detached one; stdout = URL only.
   - If `$AIDECK_URL` is non-empty: aiDeck is running. Proceed to step 9.
   - If empty (binary missing — run `atomic-skills install` first —, timeout, port exhaustion):
     **Fallback:** generate `INDEX.md` using `{{ASSETS_PATH}}/bootstrap-index.template.md`, ask "Open in browser? (y/N)" (intrusive-actions rule applies), if `y`: `mdprobe .atomic-skills/bootstrap-drafts/INDEX.md 2>/dev/null || npx -y @henryavila/mdprobe .atomic-skills/bootstrap-drafts/INDEX.md`. Continue to step 11.
9. Derive the project slug for the scoped URL:
   ```bash
   PROJECT_SLUG=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g; s/^[^a-z]*//' | cut -c1-64)
   ```
   Open browser at `$AIDECK_URL/$PROJECT_SLUG/discover`.
10. Inform user: "Review candidates at $AIDECK_URL/$PROJECT_SLUG/discover. Mark approve/reject on each, click 'Submit decisions', then say **done** here."
11. **HALT** — do NOT proceed to Phase 4. Wait until the user explicitly confirms review is complete ("done" / "reviewed" / "done reviewing") or runs `discover --commit`.

## Phase 4 — Commit

Invoked explicitly via `discover --commit` after the user reviews.

Algorithm:

```
1. If .atomic-skills/bootstrap-drafts/ does not exist: error "nothing to commit".
1b. Read decisions from ALL JSONL files in .atomic-skills/bootstrap-drafts/inbox/*.jsonl
    (glob — decisions may span multiple UTC dates or review sessions).
    Filter lines by kind === 'decision' and target.consumer === 'bootstrap-drafts'.
    For each slug, keep only the latest decision (highest createdAt).
    Build a Map<slug, 'approve'|'reject'>.
    Fallback: if no inbox/ JSONL exists, ask user "Did you review candidates in the browser?"
    If no: proceed without decisions (ask per-candidate in step 3).
2. List all *.draft.md (initiative) AND *.plan.draft.md (plan), including archive/.
3. For each draft:
   a. Parse frontmatter YAML.
   a2. Check decision map from step 1b:
       - If slug has decision 'reject': delete the draft file, skip to next.
       - If slug has decision 'approve': proceed with materialization.
       - If slug has no decision: ask user "Approve <slug> — <title>? (y/N/skip)".
   b. Validate: slug regex, unique vs the resolved tree (nested `projects/<project-id>/*/`; legacy `plans/**` + `initiatives/**`).
   c. Resolve `<project-id>` (the lone `projects/*/` folder, or ask, or `basename "$PWD"`), then branch on kind:
      - kind=plan → run materializeDecomposition (from src/decompose.js) with `{ planSlug, projectId }` on the
        source_markdown_path, then write the produced nested files under
        `.atomic-skills/projects/<project-id>/<slug>/` (legacy flat `.atomic-skills/plans/` + `initiatives/`).
      - kind=initiative (status=active, standalone) → materialize as a degenerate 1-phase plan under
        `.atomic-skills/projects/<project-id>/<slug>/{plan.md,phases/<slug>.md}` (see `project-create-initiative.md`);
        legacy fallback `draftToInitiative(draft, new Date())` → `.atomic-skills/initiatives/<slug>.md`.
      - kind=initiative (status=archived) → write to the resolved archive dir
        (`.atomic-skills/projects/<project-id>/<slug>/phases/archive/<YYYY-MM>-<slug>.md`; legacy `.atomic-skills/initiatives/archive/`).
   d. Delete the draft.
   e. On name conflict at destination: log, skip, continue.
4. **Validate.** Run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js" .atomic-skills/projects/` (legacy fallback `.atomic-skills/plans/ .atomic-skills/initiatives/`). On any failure, surface errors and roll back the committed files. Do not leave invalid state on disk.
5. Update PROJECT-STATUS.md (Active Plans, Active Initiatives, Recently Archived).
6. Write audit log to .atomic-skills/status/bootstrap.json:
   { timestamp, committed: [slugs], skipped: [{slug, reason}], errors: [{slug, error}] }.
7. Report summary: "Committed N (P plans, A active initiatives, H archived), skipped K, errors L".
8. If bootstrap-drafts/ is empty: ask "Remove bootstrap-drafts/? (y/N)". If drafts remain: skip the question, inform "N drafts remain; fix and re-run".
```
