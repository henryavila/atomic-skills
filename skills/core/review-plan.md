Perform an adversarial analysis of the plan {{ARG_VAR}} looking for
internal errors, gaps, and inconsistencies. Step 0 picks one of three
modes: `local` (same-model self-loop), `codex` (cross-model two-pass
sealed envelope via OpenAI Codex CLI), or `both` (local first → codex
on the CLEANED plan). All modes optionally cross-reference against
source artifacts (PRD, specs, designs).

## Iron Law

NO APPROVAL WITHOUT EVIDENCE.
- Local mode: every checklist item marked "ok" MUST cite plan line numbers. When cross-ref is active: line numbers from BOTH plan AND artifact. When initiative-depth is active: line numbers from BOTH plan AND initiative file(s).
- Codex mode: every codex finding MUST have `file:line` + 4 fields (Claim, Impact, Recommendation, Confidence). Findings without these are rejected.

NO INTENT IN THE BRIEFING (codex sub-flow).
The briefing sent to codex contains ONLY externally verifiable facts.
Intent narrative poisons the reviewer by up to -93pp detection rate
([arXiv 2603.18740](https://arxiv.org/abs/2603.18740)). When the active
mode is `both`, the codex briefing additionally must NOT include local
findings, fix descriptions, iteration counts, or any narrative implying a
prior review took place. The codex receives the CLEANED plan + external
constraints ONLY.

## Mindset

{{READ_TOOL}} the plan as if the author were wrong. Your role is to find
where the plan fails, not to confirm that it's good.

CRITICAL: Do Not Trust the Plan.
If you finish the analysis without finding ANY problems, it's more likely
that you missed something than the plan being perfect. In that case,
re-read the checklist and force a second, more aggressive pass.

When the active mode is `cross-ref`, the artifacts are the source of
truth — the plan is the interpretation, and interpretations frequently
lose details, oversimplify, or add things nobody asked for.

In codex sub-flow: codex is an adversarial reviewer from a different
family (GPT). Its task is to find gaps Claude missed due to
self-preference bias ([arXiv 2410.21819](https://arxiv.org/abs/2410.21819)).
Do NOT defend the plan — facilitate the critique.

## Argument contract

Parse {{ARG_VAR}} BEFORE any prompt or file read. {{ARG_VAR}} is the raw
argument string; split it into `plan_path` + optional flags. Tokens that
start with `--` are flags:

| Flag | Effect |
|---|---|
| `--mode=local` | Skip Step 0a picker; force local self-loop. |
| `--mode=codex` | Skip Step 0a picker; force codex envelope. |
| `--mode=both` | Skip Step 0a picker; force local→codex. |
| `--mode=internal` | Alias for `--mode=local` (compat with v2.x). |
| `--no-cross-ref` | Skip Step 0b picker; force internal-only. Valid only when mode ∈ {local, both}. |
| `--cross-ref=path1,path2,...` | Skip Step 0b picker; use the listed artifacts. Valid only when mode ∈ {local, both}. |
| `--artifacts=path1,path2,...` | Alias for `--cross-ref=` (compat with v2.x). |
| `--allow-dirty` | Pass through to codex pre-flight (suppresses dirty-tree abort). |
| `--no-initiatives` | Skip Step 0c; review plan structure only without task-level depth. |

Everything that is NOT a `--` token is part of `plan_path`. Strip trailing
whitespace. If `plan_path` is empty after parsing, abort with:
"review-plan requires a plan file path as the first argument." Do NOT
pass the unparsed {{ARG_VAR}} to {{READ_TOOL}} — that would try to open
the literal string "docs/plan.md --mode=local" as a file.

**Non-interactive abort.** If neither a TTY nor an explicit `--mode=` flag
is available (invocation from a hook, `parallel-dispatch`, or
`project-status`/`project-plan` loop), and no `--mode=` flag was supplied,
abort with: "review-plan invoked without TTY and without `--mode=`; pass
`--mode=local|codex|both` explicitly." Do NOT invoke
{{ASK_USER_QUESTION_TOOL}} in background. Workflows that loop over
plans (e.g. `project-plan` Stage 8b, `project-status` phase-completion
review) MUST pass `--mode=local` (or `--mode=internal`) to skip the
prompt.

## Step 0a — Pick review mode

Skip this step if `--mode=` was supplied (use the parsed value directly).
Otherwise, use {{ASK_USER_QUESTION_TOOL}}:

**Question:** "How should this plan be reviewed?"

**Options:**
- **Both (local then codex)** — Recommended for plans entering significant
  execution. Self-loop adversarial review runs first (catches contradictions,
  broken deps, ordering). Plan is fixed inline. Then codex cross-model
  review runs on the CLEANED plan with sealed envelope (catches what
  self-review missed due to self-preference bias). ~$1-2 codex cost.
- **Local only** — Self-loop adversarial review. Cheap, fast, catches
  obvious issues. Use for small plans or when codex is unavailable.
- **Codex only** — Skip local, go straight to cross-model envelope. Use
  when you already had another agent self-review the plan and want a
  fresh independent read.

Default: **Both**. The user explicitly opts down for cost-sensitive cases.

Set `mode ∈ {local, codex, both}` based on the answer.

## Step 0b — Detect and confirm cross-ref scope

Cross-reference selection is orthogonal to the mode picker. It runs for
every mode (`local`, `codex`, `both`); the selected artifacts feed into
the appropriate sub-flow.

1. {{READ_TOOL}} the plan file at `plan_path`.

2. Scan the plan for sections matching `^##? (Source Documents|References|Artifacts|Inputs|Originated From|Based On)` (regex case-insensitive). Under each, extract bullet/link tokens and CLASSIFY each one:
   - **LOCAL PATH** (relative or absolute filesystem path that resolves to a readable file): keep in the `detected_artifacts` list.
   - **URL** (anything matching `^https?://` or `^//`): DO NOT include in `detected_artifacts`. Record in `links_seen` shown to the user as "URL artifacts not auto-fetched — provide local copies if you want cross-ref coverage."
   - **AMBIGUOUS** (e.g. bare repo identifier, ticket ref like `JIRA-123`): treat as URL — not auto-fetched.

   Rationale: cross-ref mode's Iron Law requires line-number evidence from each cited artifact. URLs cannot be opened by {{READ_TOOL}} and have no stable line numbers.

3. **Non-interactive short-circuit:**
   - If `--no-cross-ref` was supplied: set `cross_ref = none`. Proceed.
   - If `--cross-ref=...` or `--artifacts=...` was supplied: set `cross_ref = explicit` with the listed paths. Proceed.

4. If no short-circuit applied, use {{ASK_USER_QUESTION_TOOL}}:

   **Question:** "Should this review cross-reference external artifacts?"

   **Options:**
   - **Internal only** — adversarial review of internal consistency. Cheap, fast. Use when the plan was written from scratch or you have no source artifacts to cross-check.
   - **Cross-reference with detected artifacts** (ONLY show this option when step 2 found ≥1 local artifact) — applies the review PLUS coverage check against `<detected list>`. Activates the HARD-GATE: plan corrected, artifacts never edited.
   - **Cross-reference with custom artifact list** — user provides paths manually. Same checks as detected-artifacts.

5. On `cross_ref ∈ {detected, explicit, custom}` AND no `--cross-ref=` was passed: list the artifacts for final confirmation. The user can add or remove paths. After confirmation, {{READ_TOOL}} each artifact and record:
   - Full file path
   - Type (PRD, epic, spec, architecture, UX, other)
   - Number of requirements/stories/FRs identified

6. **Mode interaction:**
   - `mode == local`: artifacts feed into the self-loop checklist (steps 8–13 below).
   - `mode == codex`: cross-ref step is informational only. The codex envelope does NOT consume artifacts as additional briefing material (see "Codex sub-flow" below — the sealed briefing carries only the plan + external constraints).
   - `mode == both`: artifacts feed the local checklist first. If the local pass corrected anything in the artifacts' alignment notes, the CLEANED plan still references the same paths — codex sees that cleaned plan.

## Cross-ref HARD-GATE (only when cross_ref != none)

<HARD-GATE>
This skill corrects the PLAN, NEVER the source artifacts.
If you find an error in the artifact: record it as "artifact divergence"
and ask the user how to resolve it. DO NOT edit artifacts.
</HARD-GATE>

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

3. Derive the initiative directory: resolve `plan_path` to its parent
   directory (should be `.atomic-skills/plans/`), then look for a sibling
   `initiatives/` directory at the same level (i.e., `.atomic-skills/initiatives/`).
   If the directory does not exist: set `initiative_map = {}`, record a
   minor finding ("No initiatives/ directory found — plan phases have no
   materialized initiatives"), and skip the rest.

4. For each phase in `phases:`, find its matching initiative file:
   - {{GREP_TOOL}} the `initiatives/` directory for files containing
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

## Initiative HARD-GATE (only when initiative_map is non-empty)

<HARD-GATE>
This skill corrects the PLAN file, NEVER the initiative files.
Initiative files are the source of truth for task-level detail.
If a plan phase contradicts its initiative: fix the plan phase, not the
initiative.
If an initiative task has problems: record as finding with
`initiative-file:line` and recommend the fix be applied via
`project-status` skill (which owns initiative mutations).
DO NOT use {{REPLACE_TOOL}} on initiative files.
</HARD-GATE>

---

## Flow per mode

### Flow A — `mode == local`

Step 0a → `local`. Step 0b → cross-ref picker. Step 0c → initiative
discovery. Run **Self-loop checklist** (below). END.

### Flow B — `mode == codex`

Step 0a → `codex`. Step 0b → cross-ref picker (cosmetic; artifacts NOT
sent to codex). Step 0c → initiative discovery (feeds codex briefing
artifact). Run **Codex sub-flow** (below). END.

### Flow C — `mode == both`

Step 0a → `both`. Step 0b → cross-ref picker. Step 0c → initiative
discovery.

1. **LOCAL PHASE** — Run Self-loop checklist. Apply fixes inline.
   - Track the set of fix descriptions for the audit trail.
   - This audit trail goes into the persisted review file, NOT the codex briefing.

2. **CODEX PHASE** — Run Codex sub-flow on the CLEANED plan. The
   Pass-1 briefing MUST NOT mention:
   - Local findings
   - Fix descriptions
   - Iteration count of the self-loop
   - That a prior review took place

   The codex sees the CLEANED plan as if it were the first review.
   Persist results to `.atomic-skills/reviews/` with BOTH the local fix
   log AND codex findings.

END.

---

## Self-loop checklist (modes: local, both)

Always run the 7 internal checks. For each item, cite line numbers from
the plan that prove the verification. If you cannot cite line numbers,
the item was NOT verified.

1. **Contradictions:** does one task say X while another says Y?
2. **Broken dependencies:** does a task reference a file/model that no task creates?
3. **Ordering:** does any task depend on something not yet done?
4. **Ambiguity:** is any task too vague to implement without guessing?
5. **Schema:** are migrations within the plan consistent with each other?
6. **File lists:** do listed files/commands/scripts actually exist? Run {{GLOB_TOOL}} or {{GREP_TOOL}} to confirm — do NOT trust the name. If the plan says "run X", verify X exists. For files that a prior task in the plan creates, verify the creation task exists and comes first.
7. **Test coverage:** tasks with new code but no mention of tests?

When `cross_ref != none`, ADDITIONALLY run the 6 cross-reference checks.
For each, cite line numbers from BOTH the plan AND the corresponding
artifact. If you cannot cite line numbers from both, the item was NOT
verified.

8. **Coverage:** does every FR, NFR, and Story from the artifacts have a task in the plan?
9. **Acceptance criteria:** are tasks oversummarized vs the epics' ACs?
10. **Phase gates:** does each gate criterion from the PRD have a concrete step in the plan?
11. **Dependencies:** does the plan's phase graph match the epics' graph?
12. **Schema/API:** do migrations and endpoints match the architecture doc?
13. **UX:** do components, states, tokens, and responsive match the UX spec?

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
18. **Task-level file verification:** for each task's `outputs[].path` and
    file paths mentioned in its `description`, run {{GLOB_TOOL}} to
    verify they exist OR that a prior task in the plan creates them.
19. **Initiative completeness:** does each phase's `subPhaseCount` in the
    plan frontmatter match the actual number of tasks in the
    corresponding initiative? Mismatch = **major**.
20. **Scope isolation:** if initiatives declare `scope.paths[]`, do any
    two initiatives touch the same files without an explicit `dependsOn`
    relationship? Overlap without dependency = **significant** (potential
    merge conflicts or race conditions during parallel execution).

### Iteration

**ITERATION 1.** {{READ_TOOL}} the entire plan. When `initiative_map` is
non-empty, also {{READ_TOOL}} each discovered initiative file. Apply EACH
applicable checklist item: items 1–7 to the plan; items 8–13 when
cross-ref is active; items 14–20 when initiative_map is non-empty. For
each, record: status (ok / problem), line numbers verified (plan +
artifact when cross-ref, plan + initiative when initiative-depth). Fix
errors found directly in the plan (never in initiative files — see
Initiative HARD-GATE). When cross-ref and the divergence is intentional,
document it as an "alignment note" in the plan itself.

**VERIFICATION LOOP (max 3 iterations).**
- {{READ_TOOL}} the CORRECTED plan from the beginning (NOT mental review — execute {{READ_TOOL}} on the file). Cite line numbers.
- For initiative-depth items: re-read only the initiative files where
  findings were recorded in the previous iteration (not all — avoid
  token waste on clean initiatives).
- Verify that the corrections did not introduce new problems; no checklist item was missed; when cross-ref: no requirement from the artifacts was missed; when initiative-depth: no gate-task gap or cross-phase contradiction was missed.
- If new errors / gaps were found: fix and loop.
- If the reread found nothing new: the loop ends.
- If you reached 3 iterations and still find problems: STOP and escalate — the plan may have structural issues that require human decision.

---

## Codex sub-flow (modes: codex, both)

The codex sub-flow uses the canonical assets in
`skills/shared/codex-bridge-assets/` as the single source of truth. Do
NOT inline-rewrite these; reference them and substitute placeholders.

1. **Pre-flight checks** — follow `{{ASSETS_PATH}}/preflight-checks.txt`.
   ABORT if any check fails. (`--allow-dirty` passes through from the
   argument contract.)

2. **Collect input** — the input plan file is `plan_path` (already
   validated in Step 0b). Validate with {{READ_TOOL}} that the file
   exists and has ≥ 10 lines. In `mode == both`, this is the CLEANED
   plan (post-local-fixes).

3. **Curate Pass 1 briefing (factual minimal)**
   - {{READ_TOOL}} `{{ASSETS_PATH}}/pass1-briefing-template-plan.txt`.
   - Identify externally verifiable factual constraints:
     - {{BASH_TOOL}}: `grep -E "engines|peerDependencies" package.json 2>/dev/null || true`
     - {{BASH_TOOL}}: `head -20 CLAUDE.md README.md 2>/dev/null | grep -iE "must|required|forbidden" || true`
     - Verifiable technical constraints (API contracts, forbidden deps, target runtime).
   - Identify non-goals (from the plan if declared; from the project if relevant).
   - **DO NOT** include intent narrative, curated memory, authorship, or (when `mode == both`) any reference to the prior local review or fix log.
   - Substitute placeholders:
     - `{{ANTI_FRAMING_DIRECTIVE}}` ← contents of `{{ASSETS_PATH}}/anti-framing-directive.txt`
     - `{{NON_GOALS_LIST}}` ← short bullet list with no rationale
     - `{{ARTIFACT_PATH}}` ← `plan_path`
     - `{{ARTIFACT}}` ← composite artifact (see below)
     - `{{OUTPUT_TEMPLATE_PASS1}}` ← contents of `{{ASSETS_PATH}}/output-template-pass1.txt`
   - **Composite artifact construction:** When `initiative_map` is
     non-empty, `{{ARTIFACT}}` is NOT just the plan file content. Build:
     1. Full plan content (read with {{READ_TOOL}}).
     2. A separator: `\n\n---INITIATIVE DETAIL---\n\n`
     3. For EACH phase in `initiative_map` (ordered by phaseId), append a
        compact initiative summary (NOT the full file — token budget):
        ```
        ---INITIATIVE <phaseId>: <slug>---
        Tasks: <T-001 title> | <T-002 title> | ...
        Exit gates: <G1 description (truncated to 80 chars)> | <G2 ...> | ...
        Scope: <scope.paths[] joined with ", "> (or "not declared")
        ---END INITIATIVE <phaseId>---
        ```
     When `initiative_map` is empty, `{{ARTIFACT}}` is the plan content
     only (unchanged from current behavior).
   - Save to `/tmp/codex-briefing-pass1-<timestamp>.md`.
   - {{BASH_TOOL}}: `wc -c /tmp/codex-briefing-pass1-<ts>.md`. Size
     check: compute (size_bytes / 4) excluding the artifact portion. If
     > 800 tokens (plan-only) or > 1600 tokens (plan with initiatives):
     WARNING — likely residual framing; request extra approval.

4. **Briefing confirmation** — show user in compact form (artifact path,
   factual constraints, non-goals, estimated tokens). Ask
   `approve / edit / cancel`. On cancel: abort.

5. **Pass 1 invocation (blind)** — follow
   `{{ASSETS_PATH}}/invocation-canonical.txt` substituting:
   - `<BRIEFING_PATH>` = file from step 3
   - `<OUTPUT_PATH>` = `/tmp/codex-output-pass1-<ts>.md`
   - `<TIMEOUT_SECONDS>` = 600
   - `<MODEL_FLAG>` = empty (codex resolves)

   Capture exit code. 124 (GNU timeout) or 142 (perl alarm fallback) → timeout, abort with retry suggestion. Other non-zero → codex error, abort.

6. **Pass 1 validation** — follow
   `{{ASSETS_PATH}}/validation-checklist.txt` (universal checks 1-9).
   Failure → 1 corrective retry. Failure again → escalate raw.

7. **Build Pass 2 briefing (informed)** — Pass 1 briefing (without
   `Begin review now.`) + content of `{{ASSETS_PATH}}/pass2-prompt-suffix.txt`
   with substitutions:
   - `{{CONSTRAINTS_LIST}}` ← factual constraints from step 3
   - `{{PASS_1_OUTPUT}}` ← content of Pass 1 output
   - `{{OUTPUT_TEMPLATE_PASS2}}` ← contents of `{{ASSETS_PATH}}/output-template-pass2.txt`

   Save to `/tmp/codex-briefing-pass2-<ts>.md`.

8. **Pass 2 invocation (informed)** — same command as step 5 with the
   pass-2 briefing path and output path.

9. **Pass 2 validation** — universal checks 1-9 + Pass-2-specific checks
   10-13 from `{{ASSETS_PATH}}/validation-checklist.txt`. Failure → 1
   corrective retry. Failure again → escalate raw.

10. **Persistence**
    - {{BASH_TOOL}}: `mkdir -p .atomic-skills/reviews/`
    - {{READ_TOOL}} `{{ASSETS_PATH}}/review-file-template.txt`.
    - Substitute placeholders. When `mode == both`, the review file MUST
      include both the local fix log (audit trail) AND codex findings.
    - Save to `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md`.
    - Update `.atomic-skills/reviews/INDEX.md` (create if missing) with a
      row from `{{ASSETS_PATH}}/index-row-template.txt`.

11. **Triage + fix proposals**
    - Show user 1 line: `Verdict: <V> | Counts (final): <C> | Framing Δ: <D> | Saved at <path>`
    - If `counts_final.blocker == 0 && counts_final.critical == 0`: end.
    - Otherwise, for each finding with severity ∈ {blocker, critical}:
      - Show: ID, severity, file:line, claim, recommendation
      - {{READ_TOOL}} the plan file and formulate a concrete edit
      - Ask: `apply / edit / skip`
      - `apply`: use {{REPLACE_TOOL}} on the plan file
      - `edit`: receive new proposal from user, validate and apply
      - `skip`: record "skipped: <reason>" appended to the review file

12. **Closing** — proceed to "Closing" section below.

---

## Severity → Action

- **Critical / blocker:** blocks implementation OR missing requirement / contradiction with artifact — MUST be fixed before proceeding
- **Significant / major:** causes rework OR partial coverage / excessive simplification — fix now, not later
- **Minor / nit:** annoying but doesn't break anything — fix if possible, record if not

## Code-quality gates (audit lens)

You are reviewing a plan written by `project-plan`, by hand, or by
another agent. Beyond the existing checklist, audit the plan against
`docs/kb/code-quality-gates.md`:

- **G1 read-before-claim** — does every plan claim about existing code have pasted source lines next to it? Inferences-from-name are MAJOR findings.
- **G2 soft-language ban** — grep the plan for `should|probably|may|typically|usually|I think|it seems|in theory|tends to`. Each occurrence that is NOT marked `unverified:` is a finding. Cite line number.
- **G6 reference-or-strike** — every assertion in the plan body or task descriptions must carry `verified_by:` or `unverified:`. Bare assertions are findings. Cite line number.

In codex sub-flow: if you find any G1/G2/G6 violations during briefing
curation, add them to the briefing as **constraints** (not findings) so
codex can corroborate. After codex responds, cross-check that codex
caught the same issues.

## Self-review against gates

Before reporting the review as complete, append a `## Self-review against
code-quality gates` block:

```
- G1 read-before-claim: ran grep against the plan looking for unsourced claims; found N (cited at lines …) / 0.
- G2 soft-language: ran the ban-list grep; found M occurrences (cited at lines …) / 0.
- G6 reference-or-strike: counted K total assertions in the plan body + tasks; J have `verified_by:`, L have `unverified:`, R bare (FINDINGS at lines …).
- Initiative-depth: discovered N/M initiatives; gate-task alignment: X gates checked, Y covered, Z uncovered (FINDINGS …).
```

If you found zero gate violations, treat that with suspicion —
re-read the checklist and force a second, more aggressive pass before
accepting.

In `mode ∈ {codex, both}`, the self-review block goes into the
consolidated review file under `.atomic-skills/reviews/<…>.md`. Silent
skipping is forbidden.

## Red Flags

- "This checklist item seems ok, I don't need to cite line numbers"
- "The plan is clear, I don't need to verify dependencies"
- "I've already read the entire plan mentally, I don't need to use {{READ_TOOL}} again"
- "This error is minor, I can ignore it"
- "I finished without finding anything — the plan is perfect"
- "I'll skip the reread, my corrections are right"
- "I'll edit the artifact to make it consistent with the plan" (cross-ref mode only)
- "This artifact isn't relevant" (cross-ref mode only)
- "I'll inject project memory into the briefing to help codex" (codex sub-flow)
- "I'll write an intent steelman so codex understands better" (codex sub-flow)
- "I'll mention the local pass in the codex briefing — codex deserves context" (mode == both)
- "I'll skip pre-flight, codex is installed" (codex sub-flow)
- "I'll skip briefing confirmation to go faster" (codex sub-flow)
- "I already validated the output mentally, no need for the checklist"
- "Verdict is needs_changes but I'll approve anyway"
- "The initiative tasks obviously cover the exit gates, I don't need to check each one" (initiative-depth)
- "I'll edit the initiative file to fix this task" (initiative-depth — HARD-GATE violation)
- "The initiative file is too long, I'll skim the tasks" (initiative-depth)

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "Seems consistent" | Prove with line numbers or it's not verification |
| "I've already verified mentally" | Mental verification doesn't count — execute {{READ_TOOL}} |
| "This item doesn't apply to this plan" | Record explicitly as N/A with justification |
| "The plan is simple, it doesn't need all this" | Simple plans have simple bugs that cause rework |
| "It's already 3 iterations, I'll approve" | If there are still problems, escalate — don't approve with defects |
| "The file probably exists, the name makes sense" | Sensible names are how bugs hide. Run {{GLOB_TOOL}} to confirm |
| "The plan covers all requirements" (cross-ref) | Prove with cross-referenced line numbers |
| "I'll skim the artifact" (cross-ref) | Skimming = missing requirements. Full {{READ_TOOL}} |
| "Intentional divergence, no need to document" (cross-ref) | If it's not documented, it's not intentional |
| "Editing the artifact is faster" (cross-ref) | HARD-GATE: never edit artifacts |
| "Codex will figure it out from context" (codex) | Sealed envelope: facts only |
| "The local pass already fixed everything, codex is a formality" (both) | Empirically codex catches disjoint findings — see [arXiv 2603.12123](https://arxiv.org/abs/2603.12123) |
| "The tasks obviously deliver what the gate requires" (initiative-depth) | Prove with task description ↔ gate description cross-reference |
| "I'll fix the initiative file directly, it's faster" (initiative-depth) | HARD-GATE: never edit initiative files — record finding, fix via project-status |
| "subPhaseCount is just metadata, mismatch doesn't matter" (initiative-depth) | Mismatch means plan and initiative diverged — one is wrong |

## Closing

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
