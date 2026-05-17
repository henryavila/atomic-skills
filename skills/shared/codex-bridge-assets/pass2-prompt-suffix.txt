# Pass 2 Briefing Suffix (Informed)

Appended to the Pass 1 briefing for the second invocation. Adds External
Constraints and the Pass 1 output, then re-tasks Codex to reconcile.

```
## External constraints (verifiable)

The constraints below are verifiable externally. Each line includes how to
verify if needed. Treat as ground truth.

{{CONSTRAINTS_LIST}}

## Pass 1 (blind) findings

The following findings were produced by your previous review WITHOUT the
constraints above. Re-evaluate each against the constraints.

---BEGIN PASS 1 OUTPUT---
{{PASS_1_OUTPUT}}
---END PASS 1 OUTPUT---

## Your task in this pass

1. Re-evaluate ALL findings from Pass 1 against the External Constraints.
   For EACH Pass 1 finding, decide one of:
   - **DROP** — finding is invalid given a constraint or non-goal
   - **MAINTAIN** — finding stands, severity unchanged
   - **REFINE** — finding stands but severity changes

2. Identify NEW findings that emerge ONLY because of these constraints
   (e.g. the artifact violates a constraint you couldn't see in Pass 1).

3. Output the FULL final findings list (use new sequential IDs starting at
   F-001) plus a complete `## Pass 2 reconciliation` block.

## Output format

{{OUTPUT_TEMPLATE_PASS2}}

Begin reconciliation now.
```

## Placeholders to substitute

| Placeholder | Source |
|-------------|--------|
| `{{CONSTRAINTS_LIST}}` | Curated bullet list of factual constraints (each with verification hint) |
| `{{PASS_1_OUTPUT}}` | Full content of Pass 1 output file |
| `{{OUTPUT_TEMPLATE_PASS2}}` | Contents of `output-template-pass2.md` |
