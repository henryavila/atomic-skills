# Asset — Fixtures recipe (state-aware, real data, with texture)

Fixtures carry **texture, not just values** (R8): the brevity and density of the real content
at the moment of decision is itself load-bearing data. The design agent must see how little
text is on screen, how short each item is, and what the edge rows look like — otherwise it
designs for imagined content and mis-sizes the interaction.

## Source: REAL app data (not synthetic)

Pull fixtures from **real sources**: seeders, tests, demo/staging data, or production-like
content. Redact/anonymise PII, but do **not** substitute synthetic data — synthetic content
erases the exact length, density, edge rows and domain vocabulary that make the prompt
faithful. Synthetic is allowed **only** as an explicit fallback, flagged and approved by the
operator (e.g. when no real source exists for a screen).

## Per-screen, state-aware (mine these, don't invent them)

For each screen and each of its states (empty / loading / error / offline / first-time /
populated), capture:

- **Cardinality** — how many items the state realistically holds (0, 1, a few, many). The
  empty and the overflowing cases are both required.
- **Length** — the real character/word length of each field at the decision moment; keep the
  brevity (don't pad short content into paragraphs).
- **Distribution** — the realistic spread (most rows short, a few long; common vs rare status).
- **Edge rows** — the longest title, the truncation case, the missing-optional-field row, the
  one with an unusual value. These are where layout breaks; include them on purpose.

## What to hand the design agent

A compact fixture set per screen-state that the agent can drop into the design **as-is**,
showing the real texture. Pair it with the screen's "Visible information" section so the agent
sees the content at the size and density it actually appears.

## Checklist before sending

- [ ] Every fixture traces to a **real** source (seeder/test/production-like); synthetic ones
      are flagged as approved fallbacks.
- [ ] Each screen-state has its **cardinality** captured, including empty and overflow.
- [ ] **Edge rows** are present (longest, truncated, missing-field, unusual-value).
- [ ] Texture preserved — short content stays short; no PII.
