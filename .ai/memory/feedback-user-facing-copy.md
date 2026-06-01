---
name: feedback-user-facing-copy
description: User-facing skill copy (one-liners, descriptions) and explanatory diagrams describe the user's BENEFIT and live with the skill — never internal storage paths or a floating README-top section
metadata:
  type: feedback
---

User-facing copy speaks to what the user GETS, not to the implementation.

**Why:** In the project-skill-unification work the user rejected the `project` one-liner *"Track + create + view Plans, Initiatives, and Tasks in .atomic-skills/"* — "the user dont care about the location .atomic-skills." Separately, the tracking-model Mermaid diagram had been a standalone section at the **top** of the README; the user required it be moved **into the `project` skill's own documentation section** ("the graph explaining the project must be in the project section").

**How to apply:**
- `one_liner` / `description` / `value_pitch` in `meta/catalog.yaml`: describe the benefit, never the storage path (`.atomic-skills/`) or internal mechanics. `one_liner` is also hard-capped **10–80 chars** by `validate-skills`. See [[reference-readme-generator-contract]].
- A diagram (or any explanation) of a skill belongs **co-located with that skill's docs**, not floating at the README top. The README's generated `SKILL_DETAILS` region is compact; deep model + diagrams go in the hand-written section / `docs/concepts/`.
- Implementation detail (file layout, schema field names) is fine in deep "concepts" sections where the audience wants it — just not in headline copy.
