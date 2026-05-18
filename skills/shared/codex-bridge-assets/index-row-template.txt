# Reviews INDEX.md Row Template

Path: `.atomic-skills/reviews/INDEX.md`

## File header (write only if INDEX.md does not exist)

```markdown
# Reviews Index

| Date | Topic | Skill | Verdict | Counts (final) | Framing Δ |
|------|-------|-------|---------|----------------|-----------|
```

## Row to append per review

```markdown
| {{DATE_HHMM}} | [{{SLUG}}]({{FILENAME}}) | {{SKILL_SHORT}} | {{VERDICT}} | {{COUNTS_COMPACT}} | {{DELTA_COMPACT}} |
```

## Placeholder formats

| Placeholder | Format |
|-------------|--------|
| `{{DATE_HHMM}}` | `YYYY-MM-DD HH:MM` |
| `{{SLUG}}` | kebab-case slug |
| `{{FILENAME}}` | `YYYY-MM-DD-HHMM-<slug>.md` (relative link from INDEX.md) |
| `{{SKILL_SHORT}}` | `plan` or `code` |
| `{{VERDICT}}` | from review frontmatter |
| `{{COUNTS_COMPACT}}` | `<B>B/<C>C/<M>M/<m>m/<n>n` e.g. `1B/1C/3M/1m/0n` |
| `{{DELTA_COMPACT}}` | `<d>d/<=>=/<+>+` e.g. `2d/4=/1+` (dropped/maintained/emerged) |
