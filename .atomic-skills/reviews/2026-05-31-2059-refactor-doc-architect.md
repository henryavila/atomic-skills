# Review: refactor-doc-architect (plan)

- **Date:** 2026-05-31 20:59
- **Mode:** codex (two-pass sealed envelope)
- **Reviewer:** gpt-5-codex, reasoning_effort=high
- **Artifact:** `.atomic-skills/plans/refactor-doc-architect.md` (+ 6 initiative summaries as context)
- **Verdict:** needs_changes → **all 5 findings applied 2026-05-31; plan + initiatives re-validated (7/7 schema-valid)**
- **Counts (blind):** 0B / 1C / 4Maj / 0Min / 0nit
- **Counts (final):** 0B / 1C / 4Maj / 0Min / 0nit
- **Framing Δ:** 0 dropped / 5 maintained / 0 emerged
- **Tokens:** ~56k (blind) + ~34k (informed)

## Local fix log

N/A — `--mode=codex` (no local phase). Internal review ran separately during `project-plan` Stage 8a before this codex pass.

## Findings (final)

| # | Severity | Location | Claim | Action |
|---|----------|----------|-------|--------|
| F-001 | major | init f1 / f3 | F1 copy list omits source files (`discover-architecture.md`, `init.md`, `module-status.md`, `update-module.md`, `verify-module.md`, `save-memory.md`, `references/memory-system.md`) that F3 later audits | **APPLIED** — F1/T-001 now enumerates full manifest + drop-list rule |
| F-002 | major | init f1 / plan | F1 tool sweep does only 4 literals; CLAUDE.md mandates 8 vars → gate "zero hardcoded literals" unmet | **APPLIED** — F1/T-002 + F1 gate now require all 8 tool vars |
| F-003 | **critical** | init f0 / plan / f5 | D4 adopts rubric "if criteria-based" but F5 unconditionally requires passing the D4 rubric → F5 may be non-executable | **APPLIED** — F0/D4 must PRODUCE a concrete rubric+baseline (hard precondition); F0 gate + F5 task/gate + plan body updated |
| F-004 | major | init f4 / plan | F4 task allows "file:line or symbol" + confidence flags; gate requires resolvable file:line → task permits what gate rejects | **APPLIED** — F4/T-001 defines one grammar; uncited claims excluded from final docs |
| F-005 | major | plan / P5 | P5 requires standard reconciliation but no task performs it | **APPLIED** — new F2/T-004 reconciliation task added; P5 + F5 reference it |

## Findings detail

### F-001 [major] dependency-break
F1/T-001 copies `steps/`, three reference files, `documentation-standard-template.md`, and `adapter-*.md`. F3 later audits `discover-architecture.md`, `init.md`, `module-status.md`, `references/memory-system.md`; source also has `update-module.md`, `verify-module.md`, `save-memory.md`. **Impact:** refactored skill can be missing entrypoints/support workflows, or F3 passes by auditing the source artifact instead of the moved skill. **Rec:** expand F1/T-001 to enumerate every retained source markdown file, or add an explicit drop/replacement list. **Confidence:** high. **Fix target:** initiative file `refactor-doc-architect-f1-*` (apply via `project-status`).

### F-002 [major] coverage-gap
F1/T-002 replaces only `Bash`/`Read`/`Grep`/`Glob`; project rule requires the full set `{{BASH_TOOL}}, {{READ_TOOL}}, {{WRITE_TOOL}}, {{REPLACE_TOOL}}, {{GREP_TOOL}}, {{GLOB_TOOL}}, {{INVESTIGATOR_TOOL}}, {{ASK_USER_QUESTION_TOOL}}`. **Impact:** skill passes the F1 checklist while leaving hardcoded write/replace/investigator/user-question literals → cross-agent breakage, and the F1 gate ("zero remaining hardcoded tool literals") is silently unmet. **Rec:** exhaustive sweep against the full variable set; gate verifies every literal class. **Confidence:** high. **Fix target:** initiative file `refactor-doc-architect-f1-*` (apply via `project-status`).

### F-003 [critical] ambiguity / contradiction — PENDING user decision
F0/D4 says "adopt as acceptance gate if criteria-based"; F5 + plan gate unconditionally require passing the D4 rubric. **Impact:** if D4 resolves the bake-off was not criteria-based, F5 becomes non-executable late, forcing acceptance-criteria redesign after implementation. **Rec:** make F0 produce a concrete D4 rubric (archived baseline inputs/outputs + pass/fail thresholds) as a hard precondition, OR define an alternate explicit F5 acceptance gate before F1 starts. **Confidence:** high. **Fix:** plan body §1 Context `unverified:` note + §3 amended to require D4 to PRODUCE a criteria-based rubric (with baseline + thresholds) before F1; if the bake-off is not criteria-based, F0 must define the rubric rather than inherit it. Initiative-level wording (F0/T-002, F5/T-002) flagged for `project-status`.

### F-004 [major] contradiction
F4/T-001 allows "file:line or symbol" and lets uncited claims become confidence flags; F4 gate requires resolvable `file:line` and fails when a citation does not resolve. **Impact:** F4 can be task-complete yet fail its own gate, or the gate gets weakened ad hoc. **Rec:** define one citation grammar — final load-bearing claims carry resolvable `file:line`; confidence-flagged (uncited) statements are excluded from final generated docs. **Confidence:** high. **Fix target:** initiative file `refactor-doc-architect-f4-*` (apply via `project-status`).

### F-005 [major] coverage-gap — PENDING user decision
P5 requires reconciling `documentation-standard-template.md` into the target repo's documentation standard (map fields, flag gaps). No task performs it — F0 records a D1 tie-break, F1 only copies the source template. **Impact:** final skill preserves the source template while producing docs that don't conform to the target house standard, with no gate catching it. **Rec:** add a pre-F5 reconciliation task (locate target standard, map fields, flag unmapped, gate generated docs on conformance). **Confidence:** high. **Fix:** plan body §3 notes a new task is required in F2 (or a new phase) — recorded here; the task itself must be added via `project-plan new-task`/`new-phase` since it materializes into an initiative.

## Self-review against code-quality gates

- **G1 read-before-claim:** briefing carried only externally-verifiable constraints (package.json `type:module`/engines, schema-validation status, CLAUDE.md tool-var rule, confirmed presence of source dir + entrypoint files + `../arch`). No intent narrative; anti-framing directive included.
- **G2 soft-language:** plan body ban-list grep returned 0 occurrences.
- **G6 reference-or-strike:** plan assertions carry `verified_by:`/`unverified:`. The single deliberate `unverified:` (the `../arch` rubric) is exactly what codex independently escalated as F-003 (critical) — strong corroboration that the marker pointed at a real hole.
- **Initiative-depth:** 6/6 initiatives discovered; all phases materialized. 3 of 5 findings (F-001, F-002, F-004) target initiative files → recorded for `project-status` per the Initiative HARD-GATE (this skill must not edit initiative files).

## Process note (honest disclosure)

First codex attempt silently no-op'd: the canonical invocation uses GNU `timeout`, absent on macOS. Switched to the documented perl `alarm` fallback. No fabricated findings were written to disk during the failed attempt. Both passes above are genuine codex output.
