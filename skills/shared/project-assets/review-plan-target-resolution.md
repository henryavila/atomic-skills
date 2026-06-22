# review-plan — Target resolution (lazy asset)

review-plan reads this at the start of its **Argument contract**, before
Step 0b, to turn `plan_path` into a real `plan.md`. The skill body keeps only
a one-line pointer; this procedure is authoritative — do not paraphrase or
shortcut it.

## Target resolution (plan_path → a real plan file)

`plan_path` may be a filesystem path, a **plan slug**, or empty (meaning
"review the active plan"). Resolve it to an actual `plan.md` BEFORE Step 0b,
reusing the same detection `atomic-skills:project` runs (its router
`## Initial detection`) — do NOT re-implement plan discovery here, mirror it.
Apply the ladder in order and stop at the first match:

1. **Readable file** — if `plan_path` resolves to a readable file, use it
   directly. This is the common case; the ladder stops here.
2. **Slug** — else if `plan_path` is non-empty but is not a readable file,
   treat it as a plan **slug** and resolve the nested layout first:
   `.atomic-skills/projects/<project-id>/<plan_path>/plan.md`, falling back to
   the legacy flat `.atomic-skills/plans/<plan_path>.md`. If exactly one
   resolves, that file becomes `plan_path`.
3. **Active plan** — else if `plan_path` is empty, fall back to the **active
   plan**: resolve it the way the router's detection does (the plan with
   `planActive: true` / the one carrying `currentPhase`) and use its `plan.md`.
4. **No resolution** — only when none of the above resolve, abort with:
   "review-plan requires a readable plan file, a known plan slug, or an active
   plan." (This replaces the former empty-arg abort.)

Resolution is transparent to the rest of the flow: the resolved file is the
`plan_path` every step below reads. Under the **Non-interactive abort**
contract in the review-plan *Argument contract* (the paragraph immediately
after this asset's pointer), an ambiguous slug (matches >1 project) or more
than one active plan does NOT prompt — it aborts and asks the caller to pass
an explicit `<project-id>/<plan-slug>` path; only an interactive (TTY) run may
disambiguate by asking which plan was meant.
