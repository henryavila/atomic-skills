# Asset — Fixtures recipe (state-aware, real data, with texture)

Fixtures carry **texture, not just values** (R8): the brevity and density of the real content
at the moment of decision is itself load-bearing data. The design agent must see how little
text is on screen, how short each item is, and what the edge rows look like — otherwise it
designs for imagined content and mis-sizes the interaction.

## Source: REAL app data (not synthetic)

Pull fixtures from **real sources**, walking down this ladder and stopping at the first rung
that yields real content:
1. **In-repo:** seeders/factories with real values, tests, demo/staging data, doc examples,
   sample exports. Faker/placeholder factories do **not** count as real.
2. **Local database (read-only):** query the dev DB via the app's own tooling (an ORM
   console/CLI or a direct read query). The safe default.
3. **App API read-only (GET only):** only with the operator's explicit authorization and
   credentials they supply; keep the token in a file outside the repo, never in the
   transcript; never call a write endpoint.
4. **Operator-provided export.**

Redact/anonymise PII, but do **not** substitute synthetic data while a real rung is still
available — synthetic content erases the exact length, density, edge rows and domain
vocabulary that make the prompt faithful. Synthetic is allowed **only** as an explicit,
operator-approved last resort when every rung above genuinely fails — and even then it must be
a **complete generated set** (per screen-state, with edge rows), each item flagged as
representative.

**The failure mode to avoid:** dropping a few plausible inline examples marked "[fallback]"
and moving on — that is not fixtures. **Texture lesson:** real content is routinely
denser/longer and in a different state than you would guess (e.g. 3–4-sentence answers where
you'd write one-liners; an early/cold account where you'd imagine a mature one). Guessing the
texture defeats R8's whole purpose.

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

## Copy lane — literal copy is real texture, but mutable (not a requirement)

Mine the app's **literal copy** (button labels, microcopy, empty-state lines, error messages)
as **real content** — its brevity, tone and voice are texture the design agent must see, so it
belongs with the fixtures. But literal copy is its **own mutable lane**: the exact words are
**content the design agent may rewrite**, never a binding layer-2 value. What binds is the
**speech-act** behind the copy (what the words make the person do or understand) — that lives
in the screen's Interaction-model / Philosophy blocks (R4), not in the string itself. Hand
literal copy as a flagged **`copy (mutable)`** set alongside the fixtures, explicitly marked
editable, so its texture informs the design without freezing the words as a requirement.

## What to hand the design agent

A compact fixture set per screen-state that the agent can drop into the design **as-is**,
showing the real texture. Pair it with the screen's "Visible information" section so the agent
sees the content at the size and density it actually appears.

## Checklist before sending

- [ ] Every fixture traces to a **real** source actually pulled (in-repo / local DB / read-only
      API / operator export) — Faker/placeholder ≠ real. Synthetic only as an operator-approved
      last resort, as a complete flagged set, never a few inline examples.
- [ ] Each screen-state has its **cardinality** captured, including empty and overflow.
- [ ] **Edge rows** are present (longest, truncated, missing-field, unusual-value).
- [ ] Texture preserved — short content stays short; no PII.
