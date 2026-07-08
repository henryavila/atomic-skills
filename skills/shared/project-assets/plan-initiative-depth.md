# review-plan — initiative-depth & closing (lazy asset)

review-plan reads the relevant section of this file at the moment each branch
runs, keeping the skill body small. Three lazy sections:

- **Step 0c** — auto-discovery of materialized initiative files into `initiative_map`.
  Read when `--no-initiatives` was NOT supplied.
- **Initiative-depth checks (items 14–20)** — the per-task depth checks. Read when
  `initiative_map` is non-empty (the Initiative HARD-GATE stays resident in the skill).
- **Closing template** — the `### Analysis Summary` output format. Read at the close.

The procedures below are authoritative — do not paraphrase or shortcut them.

## Step 0c — Auto-discover initiative files

Initiative discovery is structural — it expands the plan into its
constituent task-level detail. It is orthogonal to cross-ref (which checks
external artifacts like PRDs/specs). Both can be active simultaneously.

Skip this step entirely if `--no-initiatives` was supplied.

1. The plan file was already read in Step 0b. Parse its YAML frontmatter
   for a `phases:` array and a `slug:` field.

2. If the frontmatter has no `phases:` key, or `phases` is empty: set
   `initiative_map = {}` and skip the rest of Step 0c. This plan has no
   phase structure (standalone or flat plan).

3. Derive the initiative directory from `plan_path`, layout-aware:
   - **Nested** (`plan_path` = `.atomic-skills/projects/<id>/<slug>/plan.md`):
     the phase initiatives are in the sibling `phases/` dir
     (`.atomic-skills/projects/<id>/<slug>/phases/`).
   - **Legacy flat** (`plan_path` = `.atomic-skills/plans/<slug>.md`): look for the
     sibling `.atomic-skills/initiatives/` directory.
   If the resolved directory does not exist: set `initiative_map = {}`, record a
   minor finding ("No phase-initiative directory found — plan phases have no
   materialized initiatives"), and skip the rest.

4. For each phase in `phases:`, find its matching initiative file:
   - {{GREP_TOOL}} the resolved phase-initiative directory for files containing
     `parentPlan: <slug>` (the plan's slug from frontmatter).
   - Among matches, filter for files that also contain `phaseId: <phase.id>`.
   - This is schema-driven (uses the actual linking fields set by
     `project-plan` materialization), not slug-derivation-dependent.
   - If multiple files match the same phaseId: use the first match and
     record a minor finding ("Duplicate initiative files for phase <id>").

5. Build `initiative_map`: a mapping of `phaseId → { path, slug, title,
   tasks[], exitGates[], scope? }`. For each matched file:
   - {{READ_TOOL}} the initiative file.
   - Parse its YAML frontmatter to extract: `slug`, `title`, `tasks[]`,
     `exitGates[]`, `scope?`.
   - Index the tasks by id for cross-phase reference.

6. Report discovery results (no user prompt — this is automatic):
   - "**Initiative discovery:** Found N/M initiative files for M phases."
   - For each discovered initiative: `<phaseId>: <slug> (K tasks)`
   - For each phase with NO matching initiative: record as a structural
     finding (severity: **significant**) — "Phase <id> (<title>) has no
     materialized initiative file."

## Initiative-depth checks (items 14-20)

When `initiative_map` is non-empty, ADDITIONALLY run the 7
initiative-depth checks. For each item, cite line numbers from BOTH the
plan file AND the relevant initiative file(s). Use format:
`plan.md:L42 ↔ init-f0.md:L18`. If the finding is initiative-only (e.g.,
task ambiguity), cite only the initiative file:line but reference the
phase in the plan.

14. **Gate-task alignment:** for each exit gate in each phase, verify that
    at least one task in the corresponding initiative has
    outputs/description that deliver what the gate requires. A gate with
    no covering task is a **critical** finding.
15. **Task-level contradictions:** do tasks across different initiatives
    contradict each other? Example: F0/T-003 validates rootDir contains
    `.atomic-skills/` but F3/T-001 changes ensureAideck to skip that
    check — this is a cross-phase contradiction.
16. **Task-level broken deps:** does a task reference a file or artifact
    that a task in a PRIOR phase creates? Verify that the creating task
    exists and its phase appears in the current phase's `dependsOn`.
17. **Task-level ambiguity:** is any task description too vague to
    implement without guessing? Evaluate each task individually, not just
    the phase goal. A task with only a title and no description is
    automatically **major**.
18. **Task-level file verification:** `outputs[].path` are deliverables
    the task CREATES — do NOT check their existence. Instead, verify
    input file paths mentioned in the task's `description` (files the
    task reads or modifies): run {{GLOB_TOOL}} to confirm they exist OR
    that a prior task in the plan creates them.
19. **Initiative completeness:** `subPhaseCount` is a materialization-time
    snapshot. The initiative may have MORE tasks (added via `new-task`)
    but FEWER means tasks were removed — check if intentional. Only flag
    as **major** when `tasks.length < subPhaseCount` (tasks lost).
20. **Scope isolation:** if initiatives declare `scope.paths[]`, do any
    two initiatives touch the same files without an explicit `dependsOn`
    relationship? Overlap without dependency = **significant** (potential
    merge conflicts or race conditions during parallel execution).

## Closing template

**First — receipt (materialized plans only):** before presenting the summary,
write the `## Reviews` receipt per § *Review receipt* below (mandatory
`- internal:` line — what `scripts/find-unreviewed-plans.js` gates on). Skip for a
non-materialized markdown file.

Present the summary in this format. Sections marked `(local/both)` only
appear in the corresponding mode; `(codex/both)` likewise.

```markdown
### Analysis Summary

**Mode:** local | codex | both
**Cross-ref:** internal | <artifacts list> (local/both only)
**Initiatives discovered:** N/M phases (list any missing) | skipped (--no-initiatives) | N/A (no phases)
**Iterations (local):** [N] (local/both only)
**Codex iterations:** 2 (blind + informed) (codex/both only)
**Counts (local):** critical: X, significant: Y, minor: Z (local/both only)
**Counts (initiative-depth):** critical: X, significant: Y, minor: Z (only when initiative_map non-empty)
**Counts (codex blind):** <B>B/<C>C/<M>M/<m>m/<n>n (codex/both only)
**Counts (codex final):** <B>B/<C>C/<M>M/<m>m/<n>n (codex/both only)
**Framing Δ (codex):** <d>d / <=>= / <+>+ (codex/both only)

| # | Finding | Severity | Source | Mode | Plan:line | Initiative:line | Artifact:line | Action |
|---|---------|----------|--------|------|-----------|-----------------|---------------|--------|
| 1 | <summary> | critical | plan | local | plan.md:108 | — | prd.md:42 | applied |
| 2 | <summary> | blocker | initiative | codex | plan.md:45 | init-f0.md:18 | — | applied |
| 3 | <summary> | major | initiative | local | — | init-f2.md:33 | — | recorded |

Source: `plan` = finding in plan file only; `initiative` = finding
involving initiative file(s); `cross-ref` = finding involving external
artifact(s).

**Alignment notes added:** [N] (cross-ref only)
**Reviews saved at:** `.atomic-skills/reviews/<file>.md` (codex/both only)
**Final status:** Plan approved / with caveats / Escalated to user
```

## Review receipt (materialized plans only)

Before presenting the Closing summary, leave a **machine-checkable receipt** —
but ONLY when `plan_path` is a materialized plan file (nested
`.atomic-skills/projects/<id>/<slug>/plan.md` or legacy flat
`.atomic-skills/plans/<slug>.md`). The same-author `## Self-review against
code-quality gates` block is an attestation, NOT proof the adversarial review
ran; the receipt is what `scripts/find-unreviewed-plans.js` checks, so an
internal review that leaves none reads as **not-run** — the gap that let batches
of plans land unreviewed. Skip this entirely for a non-materialized markdown file
(a throwaway source plan, or the cleaned plan inside `mode == both` before it is
materialized).

Maintain a `## Reviews` section in the plan body, appended after `## Self-review
against code-quality gates` (or at end-of-body if that block is absent). Write ONE
line per review channel; **re-running a channel UPDATES its existing line, never
duplicates** (idempotent — match by the `- internal:` / `- codex:` prefix):

```markdown
## Reviews

- internal: <zero findings | N finding(s) applied> @ <commitSha | uncommitted> (<ISO-8601 UTC>)
- codex: <PASSED | needs_changes (resolved) | SKIPPED — <reason>> — <reviews/<file>.md | n/a>
```

- `mode ∈ {local, both}`: write/refresh the `- internal:` line. Stamp the commit
  with {{BASH_TOOL}} `git rev-parse --short HEAD 2>/dev/null || echo uncommitted`
  and the time with `date -u +%Y-%m-%dT%H:%M:%SZ`; edit the body with
  {{REPLACE_TOOL}}. This line is the **mandatory** receipt.
- `mode ∈ {codex, both}`: write/refresh the `- codex:` line with the verdict and
  the persisted `reviews/<file>.md` path. Optional — codex is offered, not forced;
  a plan with only a `- codex:` line and no `- internal:` line still reads as
  unreviewed by the gate.
