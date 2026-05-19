# REPLACE_PLAN_TITLE

> Fill this template, then run `project-plan <slug>` (or `adopt <this-file>`) to
> decompose it into structured Plan + Initiatives + Tasks. Lines starting with
> `>` are instructions; delete them before decomposing.

> First paragraph: why this plan exists. What problem does it solve? Two or
> three sentences is enough — additional context belongs in §1 of the body.

## Inviolable principles

> One bullet per principle. The decomposer reads `**P1 Title** — body` or
> `P1 Title — body`, but plain `Title — body` works (auto-numbered).
> Keep principles short and load-bearing — if you wouldn't enforce it, drop it.

- **P1 REPLACE_PRINCIPLE_1_TITLE** — REPLACE_PRINCIPLE_1_BODY
- **P2 REPLACE_PRINCIPLE_2_TITLE** — REPLACE_PRINCIPLE_2_BODY

## Glossary

> One bullet per term. Use `term — definition` or `**term** — definition`.
> Only terms specific to this plan; don't define industry-standard words.

- **REPLACE_TERM_1** — REPLACE_DEFINITION_1
- **REPLACE_TERM_2** — REPLACE_DEFINITION_2

## F0 — REPLACE_PHASE_0_TITLE

> The H2 must match `^F<N>\b` (capital F followed by a digit). The text after
> a dash, em-dash, or en-dash becomes the phase title.

Goal: REPLACE_PHASE_0_GOAL

> One H3 per task. Optional leading `T0.1` / `T-001` id is honored; absent
> ids get auto-numbered (`T-001`, `T-002`, …).

### T0.1 REPLACE_TASK_TITLE
### T0.2 REPLACE_TASK_TITLE

> Optional fenced YAML block defines exit-gate criteria. The decomposer pulls
> these into the initiative's `exitGates[]`. Drop the block if you don't have
> measurable gates yet — the user runs `project-status:phase-done` later to
> verify them.

```yaml
exit_gate:
  - id: F0-G1
    description: REPLACE_GATE_DESCRIPTION
    verifier: { kind: shell, command: "REPLACE_SHELL_COMMAND", expectExitCode: 0 }
```

## F1 — REPLACE_PHASE_1_TITLE

Goal: REPLACE_PHASE_1_GOAL

### T1.1 REPLACE_TASK_TITLE

> Duplicate this section as `## F2 — ...`, `## F3 — ...`, etc., for additional
> phases. The decomposer requires at least one phase; everything else is
> optional.
