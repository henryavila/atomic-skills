# Closing summary template

Present after Phase 3 (audit stop) or after final reaudit.

```markdown
### Audit Delivery — Summary

**Intent source:** …
**Mode:** audit | audit-and-fix | reaudit
**Depth:** full | light
**Verdict:** CLOSED | PARTIAL | OPEN
**Decisions:** R/P/N/A counts
**Problems:** R/P/N/A counts
**Findings:** C/H/M/L counts (open after last reaudit)
**Fix rounds:** N
**Report:** `.atomic-skills/reviews/…`

| # | Residual | Sev | Next action |
|---|----------|-----|-------------|
| 1 | … | … | … |

**Suggestion:** run `atomic-skills:review-code` on the fix diff for blind correctness;
run full suite / smoke before release. Prefer composition: fix / parallel-dispatch →
re-run `audit-delivery --mode=reaudit --out=…`.
```

Optional: offer commit of report + fixes (do not push unless asked).

`audit-delivery` does **not** replace `review-code`. Primary identity is **read-only** intent-vs-delivered audit.
