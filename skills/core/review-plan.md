Perform an adversarial analysis of the plan {{ARG_VAR}} looking for
internal errors, gaps, and inconsistencies. Step 0 picks a mode: `local`,
`codex`, `grok`, `both` (local→**host external default**), `both-codex`,
`both-grok`, or `external-both`. Full mode table, host-aware picker, and
same-family rules: {{READ_TOOL}}
`skills/shared/codex-bridge-assets/review-mode-ux.md` (routing:
`src/cross-model-host-default.js`). All modes may cross-reference source
artifacts (PRD, specs, designs).

## Iron Law

NO APPROVAL WITHOUT EVIDENCE.
- Local mode: every checklist item marked "ok" MUST cite plan line numbers. When cross-ref is active: line numbers from BOTH plan AND artifact. When initiative-depth is active: line numbers from BOTH plan AND initiative file(s).
- External mode (`codex`/`grok`): every external finding MUST have `file:line` + 4 fields (Claim, Impact, Recommendation, Confidence). Findings without these are rejected.

NO INTENT IN THE BRIEFING (external sub-flow).
The briefing sent to the external provider contains ONLY externally
verifiable facts. Intent narrative poisons the reviewer by up to -93pp
detection rate ([arXiv 2603.18740](https://arxiv.org/abs/2603.18740)).
When a local leg preceded the external (`both*`), the external briefing
must NOT include local findings, fix descriptions, iteration counts, or
any narrative implying a prior review. The external reviewer receives the
CLEANED plan + external constraints ONLY.

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

In the external sub-flow: the reviewer is family-different from the host
when the route is true CROSS-MODEL REVIEW (self-preference bias:
[arXiv 2410.21819](https://arxiv.org/abs/2410.21819)). Do NOT defend the
plan — facilitate the critique.

## Argument contract

Parse {{ARG_VAR}} BEFORE any prompt or file read. {{ARG_VAR}} is the raw
argument string; split it into `plan_path` + optional flags. Tokens that
start with `--` are flags:

| Flag | Effect |
|---|---|
| `--mode=local\|codex\|grok\|both\|both-codex\|both-grok\|external-both` | Skip Step 0a; force mode (`both` = local→host external default). |
| `--mode=internal` | Alias for `--mode=local` (compat with v2.x). |
| `--accept-same-family-as-local` | Non-interactive same-family → sealed local (`provider:local`); see review-mode-ux.md. |
| `--no-cross-ref` | Skip Step 0b; force internal-only. Valid when mode has a local leg or is local-only. |
| `--cross-ref=path1,path2,...` | Skip Step 0b; use listed artifacts. Same validity as `--no-cross-ref`. |
| `--artifacts=path1,path2,...` | Alias for `--cross-ref=` (compat with v2.x). |
| `--allow-dirty` | Pass through to external pre-flight (suppresses dirty-tree abort). |
| `--no-initiatives` | Skip Step 0c; plan structure only without task-level depth. |

Everything that is NOT a `--` token is part of `plan_path`. Strip trailing
whitespace. Do NOT pass the unparsed {{ARG_VAR}} to {{READ_TOOL}} — that
would try to open the literal string "docs/plan.md --mode=local" as a file.

### Target resolution (plan_path → a real plan file)

Before Step 0b, resolve `plan_path` (a file path | a plan **slug** | empty =
the active plan) into a real `plan.md` via the 4-step ladder (readable file →
slug → active plan → abort) in {{READ_TOOL}}
`skills/shared/project-assets/review-plan-target-resolution.md`, mirroring the
router's `## Initial detection`. Do NOT re-implement plan discovery here.

**Non-interactive abort.** If neither a TTY nor an explicit `--mode=` flag
is available (hook, `parallel-dispatch`, or `project-status`/`project-plan`
loop), abort with: "review-plan invoked without TTY and without `--mode=`;
pass `--mode=local|codex|grok|both|both-codex|both-grok|external-both`
explicitly." Do NOT invoke {{ASK_USER_QUESTION_TOOL}} in background.
Workflows that loop over plans (e.g. `project-plan` Stage 8b) MUST pass
`--mode=local` (or `--mode=internal`) to skip the prompt.

## Step 0a — Pick review mode + same-family route

Skip the picker if `--mode=` was supplied. Otherwise {{READ_TOOL}}
`skills/shared/codex-bridge-assets/review-mode-ux.md` and run its
**host-aware Step 0 picker** via {{ASK_USER_QUESTION_TOOL}}. Default:
**Both** (local → host external default).

After `mode` is known, run the **same-family gate** in review-mode-ux.md
(`resolveReviewRoute`). Interactive same-family → confirm→local;
non-interactive without `--accept-same-family-as-local` → **HARD ABORT**.
Record `provider` / `sameFamilyRemap` from the route result.

## Step 0b — Detect and confirm cross-ref scope

Cross-reference selection is orthogonal to the mode picker. It runs for
every mode; the selected artifacts feed into the appropriate sub-flow.

1. {{READ_TOOL}} the plan file at `plan_path`. Parse its frontmatter and
   **auto-seed `detected_artifacts` from provenance, BEFORE the prose scan**:
   for each `references[]` entry, and for a `supersedes` link, resolve its
   path — when it points to a readable local file, add it to
   `detected_artifacts`; when it is a URL (or unresolvable), record it in
   `links_seen` (same LOCAL PATH / URL rule as step 2). Rationale: a plan that
   already declares what it `references` or `supersedes` should get those
   artifacts cross-checked without the user re-listing them by hand — the
   frontmatter IS the source-document manifest. This seed is an auto-resolution,
   not an override: the manual `--cross-ref=` / `--no-cross-ref` flags still win
   (step 3 short-circuit), and the prose scan below still augments it.

2. **Then** scan the plan prose for sections matching `^##? (Source Documents|References|Artifacts|Inputs|Originated From|Based On)` (regex case-insensitive) and APPEND any new tokens to the already-seeded `detected_artifacts` (the prose scan is never dropped — provenance seeds, prose augments; de-dup by resolved path). Under each, extract bullet/link tokens and CLASSIFY each one:
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
   - Local leg (`local` / `both*`): artifacts feed the self-loop checklist (steps 8–13).
   - External-only (`codex`/`grok`/`external-both`): cross-ref is informational; the sealed envelope does NOT consume artifacts as extra briefing material.
   - `both*`: artifacts feed local first; the CLEANED plan still references the same paths for the external leg.

## Cross-ref HARD-GATE (only when cross_ref != none)

<HARD-GATE>
This skill corrects the PLAN, NEVER the source artifacts.
If you find an error in the artifact: record it as "artifact divergence"
and ask the user how to resolve it. DO NOT edit artifacts.
</HARD-GATE>

## Step 0c — Auto-discover initiative files

Skip this step entirely if `--no-initiatives` was supplied. Otherwise
{{READ_TOOL}} `skills/shared/project-assets/plan-initiative-depth.md` § *Step 0c*
and follow it to build `initiative_map` (`phaseId → { path, slug, title, tasks[],
exitGates[], scope? }`) from the plan's `phases:`. When `initiative_map` is
non-empty, the **Initiative HARD-GATE** below and the **initiative-depth checks
(14-20)** activate.

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

Resolve route first (Step 0a). Then Step 0b → cross-ref. Step 0c → initiatives.

### Flow A — local only (`mode == local`, or same-family remap → `provider: local`)

Run **Self-loop checklist** (below). END.

### Flow B — external only (`mode ∈ {codex, grok}` after route stays external)

Run **External sealed-envelope sub-flow** with `«PROVIDER»` = routed provider.
END.

### Flow C — local then external (`mode ∈ {both, both-codex, both-grok}`)

1. **LOCAL PHASE** — Self-loop checklist; apply fixes inline. Audit trail goes
   into the persisted review file, NOT the external briefing.
2. **EXTERNAL PHASE** — External sealed-envelope on the CLEANED plan with
   `«PROVIDER»` = host default (`both`) or forced provider. Pass-1 MUST NOT
   mention local findings, fixes, iteration counts, or a prior review.
   Persist local fix log AND external findings under `.atomic-skills/reviews/`.

END.

### Flow D — `mode == external-both`

For each family-different provider in route order (Codex then Grok when both
remain), run External sealed-envelope on the same CLEANED plan. Present both
finding sets for triage (full merge contract is F5). END.

---

## Self-loop checklist (modes: local, both*)

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


When `initiative_map` is non-empty, ADDITIONALLY run the **7 initiative-depth
checks (items 14-20)** — they live in
`skills/shared/project-assets/plan-initiative-depth.md` § *Initiative-depth
checks*. {{READ_TOOL}} that section and run each, citing line numbers from BOTH
the plan file AND the relevant initiative file(s) (`plan.md:L42 ↔ init-f0.md:L18`).
If a finding is initiative-only, cite the initiative `file:line` but reference the
phase in the plan.

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

## External sealed-envelope sub-flow (modes: codex, grok, both*, external-both)

Run the canonical two-pass sealed envelope per
`{{ASSETS_PATH}}/envelope-orchestration.md` (byte-identical skeleton shared with
`review-code`). Bind `«PROVIDER»` ∈ {`codex`,`grok`} from the route (never after
same-family remap). Leaf assets under
`skills/shared/codex-bridge-assets/providers/«PROVIDER»/`; do NOT inline-rewrite
them. Plan-review artifact slots:

- **`«INPUT»`** — the input plan file is `plan_path` (already validated in Step
  0b). Validate with {{READ_TOOL}} that the file exists and has ≥ 10 lines. In
  `mode == both`, this is the CLEANED plan (post-local-fixes).
- **`«PASS1_TEMPLATE»`** — `{{ASSETS_PATH}}/pass1-briefing-template-plan.txt`.
- **`«CONSTRAINTS»`** —
  - {{BASH_TOOL}}: `grep -E "engines|peerDependencies" package.json 2>/dev/null || true`
  - {{BASH_TOOL}}: `head -20 CLAUDE.md README.md 2>/dev/null | grep -iE "must|required|forbidden" || true`
  - Verifiable technical constraints (API contracts, forbidden deps, target runtime).
  - Non-goals: from the plan if declared; from the project if relevant.
- **`«ARTIFACT»`** — `{{ARTIFACT_PATH}}` ← `plan_path`. `{{ARTIFACT}}` ← the
  **composite artifact**:
  - When `initiative_map` is empty, `{{ARTIFACT}}` is the plan content only
    (unchanged from current behavior).
  - When `initiative_map` is non-empty, `{{ARTIFACT}}` is NOT just the plan file
    content. Build:
    1. Full plan content (read with {{READ_TOOL}}).
    2. A separator: `\n\n---INITIATIVE DETAIL (context only)---\n\n`
    3. For EACH phase in `initiative_map` (ordered by phaseId), append a compact
       initiative summary (NOT the full file — token budget):
       ```
       ---INITIATIVE <phaseId>: <slug> (file: <relative-path>)---
       Tasks: <T-001 title> | <T-002 title> | ...
       Exit gates: <G1 description (truncated to 80 chars)> | <G2 ...> | ...
       Scope: <scope.paths[] joined with ", "> (or "not declared")
       ---END INITIATIVE <phaseId>---
       ```
    Initiative summaries are CONTEXT for the external reviewer — they help
    identify plan-level gaps (e.g., a gate with no plausible task). The
    external reviewer MUST NOT cite initiative summaries as `file:line`
    evidence; findings reference only the plan file. Initiative-depth checks
    (items 14-20) are LOCAL self-loop only (full files + line numbers).
- **`«SIZE_BUDGET»`** — {{BASH_TOOL}} `wc -c` the briefing, compute
  `(size_bytes / 4)` excluding the artifact portion; `> 800` tokens (plan-only)
  or `> 1600` tokens (plan with initiatives) → WARNING, likely residual framing,
  request extra approval.
- **`«TRIAGE_TARGET»`** — the plan file.
- **`«TRIAGE_NOTES»`** — pre-step: show the user 1 line
  `Verdict: <V> | Counts (final): <C> | Framing Δ: <D> | Saved at <path>`, then
  if `counts_final.blocker == 0 && counts_final.critical == 0`, end.

Then proceed to the "Closing" section below.

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

In external sub-flow: if you find any G1/G2/G6 violations during briefing
curation, add them as **constraints** (not findings) so the external
reviewer can corroborate. After it responds, cross-check the same issues.

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

In any mode with an external leg, the self-review block goes into the
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
- "I'll inject project memory into the briefing to help the external reviewer"
- "I'll write an intent steelman so the external reviewer understands better"
- "I'll mention the local pass in the external briefing" (both*)
- "I'll skip pre-flight, the CLI is installed"
- "I'll skip briefing confirmation to go faster"
- "I already validated the output mentally, no need for the checklist"
- "Verdict is needs_changes but I'll approve anyway"
- "Same-family headless is still CROSS-MODEL REVIEW" (it is not)
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
| "External will figure it out from context" | Sealed envelope: facts only |
| "The local pass already fixed everything, external is a formality" (both*) | Empirically family-different reviewers catch disjoint findings — see [arXiv 2603.12123](https://arxiv.org/abs/2603.12123) |
| "The tasks obviously deliver what the gate requires" (initiative-depth) | Prove with task description ↔ gate description cross-reference |
| "I'll fix the initiative file directly, it's faster" (initiative-depth) | HARD-GATE: never edit initiative files — record finding, fix via project-status |
| "subPhaseCount is just metadata, mismatch doesn't matter" (initiative-depth) | Mismatch means plan and initiative diverged — one is wrong |

## Closing

The review output uses the `### Analysis Summary` template in
`skills/shared/project-assets/plan-initiative-depth.md` § *Closing template*.
{{READ_TOOL}} it and present the summary in that format — include
**Provider:** `codex|grok|local` from the route (never codex/grok after
same-family remap). Sections marked `(local/both*)` / `(external)` apply
by leg.
