# brainstorm — Research digest (B0b) lazy asset

Read after B0 Interview is ratified and **before** `atomic-skills:debate --gate`.
Multi-phase DESIGN always produces a repo research digest. **No web research.**

## Output path

Write (and keep) the digest at:

```text
projects/<project-id>/<plan-slug>/research-digest.md
```

Same tree as `design.md`. The digest is evidence for the panel and the critic;
it is not a substitute for Interview or for `design.md`.

## How to research

1. Dispatch **≥1** repo-only subagent (or self-research with the same bars) using
   {{GREP_TOOL}} / {{GLOB_TOOL}} / {{READ_TOOL}}.
2. Map subsystems the Interview named; **paste** load-bearing lines (G1) — do
   not infer from filenames alone.
3. Summarize findings as bullets: what exists, constraints, seams, risks.
4. Cite **repo paths** (file or dir) for every non-trivial claim.

## Weak-digest bars (fail closed)

The digest is **weak** (must rewrite before B1) if any of:

| Bar | Fail when |
|-----|-----------|
| **Paths** | Zero concrete repo paths (no `skills/…`, `src/…`, `scripts/…`, etc.) |
| **Bullets** | Fewer than **3** useful bullets (actionable facts, not filler) |
| **Filler** | Only placeholders, restatements of the goal, or "looked around" prose |
| **Empty** | Missing file, empty body, or `TODO`/`TBD`/`REPLACE_*` as content |
| **Web-only** | Claims from the open web with no repo grounding (web is out of scope) |

A weak `research-digest.md` is not a complete B0b. Do not invoke debate until
the bars pass. Stamp the process receipt `researchDigest` path when the digest
is acceptable (see `process-receipt.md`).

## Minimum shape

```markdown
# Research digest — <plan-slug>

## Scope (from Interview)
- …

## Findings
- **<path>**: <fact with pasted or quoted evidence>
- **<path>**: …
- **<path>**: …

## Open risks / seams
- …
```

## After research

Proceed to B1 — always `atomic-skills:debate --gate` with Interview forks as
agenda. Exempt lanes (ad-hoc / single-task / `adopt`) do not require this digest.
