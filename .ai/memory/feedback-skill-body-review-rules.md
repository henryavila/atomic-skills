---
name: feedback-skill-body-review-rules
description: Three process rules for self-reviewing skill bodies before publishing. All three surfaced as major Codex findings AFTER plan-review had already passed. Plan-review is necessary but not sufficient.
metadata:
  type: feedback
---

# Skill body review rules (learned 2026-05-22 from review-code-with-codex on the consolidation commit)

Three rules, each documented because Codex caught the violation as a `major`
finding AFTER the plan had already gone through 4 rounds of plan-review
(internal + rev1-rev4 codex) without surfacing it. Plan review verified the
DESIGN; code review caught the IMPLEMENTATION drift.

## Rule 1 — Run code-review-with-codex on the implementation, even after thorough plan review

**Why:** the consolidation plan was rejected at Codex Pass 2 (rev1: 1B/2C/2M) and
went through 4 plan-review cycles until needs_changes. Every plan-level finding
was fixed in the spec. THEN I implemented the plan. THEN I ran
review-code-with-codex on the resulting commit — and Codex found 3 NEW majors
that the plan-review had no way to catch:

- F-001: a step-ordering bug in the rendered review-plan body (the plan said "parse flags" but the body I wrote said "READ_TOOL at ARG_VAR" first — implementation drift from plan)
- F-002: meta/skills.yaml `mutates_repo: false` contradicting the body that instructs edits — purely an implementation-level catalog/body mismatch invisible at plan-review time
- F-003: a literal tool name in rationale prose — implementation-level wording the plan never specified

The catches are disjoint from plan-review catches. Pattern is consistent with
the cross-model-review evidence in [[feedback-framing-llm-judge]].

**How to apply:** when finishing implementation of a multi-file consolidation,
spec, or refactor — run review-code-with-codex against the commit BEFORE
declaring done. Budget ~$1-2 + 2-5 min wall time. Do not assume plan-review +
internal review suffice.

## Rule 2 — Grep for ALL literal tool names in skill bodies, including rationale/explanation prose

**Why:** F-003 (major) caught a literal "AskUserQuestion tool" in a "Why route
prompts through {{ASK_USER_QUESTION_TOOL}}" rationale paragraph of
`review-code.md`. The instruction steps were clean — the rationale text wasn't.
Easy to miss in body skim because the explanation NAMES the tool while
describing why the template var exists.

The repo rule in `CLAUDE.md:15` and `AGENTS.md:17` says skill bodies must use
template vars. "Body" includes rationale, why-blocks, examples, red-flag lists
— not just numbered instructions.

**How to apply:** before declaring any new/edited skill body done, run

```bash
grep -nE '\b(Bash|Read tool|Write tool|Edit tool|Grep|Glob|AskUserQuestion|Agent)\b' skills/en/core/<file>.md
```

Any non-zero match in the FINAL body (post-render-template-var-substitution
exempt) is a violation. Fix to either `{{TOOL_VAR}}` or a tool-neutral
description ("native multi-choice prompt tool", "shell", "file reader").

## Rule 3 — Skill bodies that accept flags MUST have an explicit "parse first" step BEFORE any file/system call

**Why:** F-001 (major) caught review-plan.md doing `{{READ_TOOL}} the plan
file at {{ARG_VAR}}` as Step 0.1, with the flag-parsing logic buried in Step
0.3. Non-interactive callers (`project-plan` Stage 8a invokes
`/atomic-skills:review-plan <path> --mode=internal`) would have the agent try to
read the literal string `<path> --mode=internal` as a file. The agent has no
built-in arg parser; it reads the body literally.

Generic rule: ANY skill body that documents flag-based extensions to
`{{ARG_VAR}}` (`--mode=`, `--allow-dirty`, `--artifacts=`, etc.) MUST start
with an explicit parsing step:

> 1. Parse `{{ARG_VAR}}` into `<primary_arg>` + `<flag_map>`. Tokens starting
>    with `--` are flags. Everything else concatenates into `<primary_arg>`.
>    Strip trailing whitespace. Abort if `<primary_arg>` is empty.
> 2. <first system call> uses `<primary_arg>`, NOT raw `{{ARG_VAR}}`.

Without this, the agent's behavior depends on which heuristic it follows.

**How to apply:** when reviewing a new or edited skill body, check Step 0 — if
the body accepts any flag and Step 0.1 makes a system call against
`{{ARG_VAR}}` BEFORE a parsing step, that's a F-001-class bug.

## Related

- [[feedback-framing-llm-judge]] — Codex cross-model review principles
- [[reference-codex-macos-timeout]] — Codex invocation workaround for macOS
- [[project-roadmap-2026-05-22]] — the 3-plan sequence this session's consolidation is part of
