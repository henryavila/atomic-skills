# Asset — Fixtures recipe (state-aware, real data, with texture)

Fixtures carry **texture, not just values** (R8): the brevity and density of the real content
at the moment of decision is itself load-bearing data. The design agent must see how little
text is on screen, how short each item is, and what the edge rows look like — otherwise it
designs for imagined content and mis-sizes the interaction.

## Source: REAL app data (not synthetic)

Pull fixtures from **real sources**, walking down this ladder and stopping at the first rung
that yields the real lines **in target form**, verbatim, with enough texture — prefer the rung
that captures the artefact in its **final, scheduled, validated** state:
1. **In-repo:** seeders/factories with real values, tests, demo/staging data, doc examples,
   sample exports. Faker/placeholder factories do **not** count as real.
2. **Local database (read-only):** query the dev DB via the app's own tooling (an ORM
   console/CLI or a direct read query). The safe default.
3. **App API read-only (GET only):** only with the operator's explicit authorization and
   credentials they supply; keep the token in a file outside the repo, never in the
   transcript; never call a write endpoint.
4. **Operator-provided export.**

**Provenance path must be VERIFIED-resolvable:** the provenance line cites the exact handle you
actually resolved — copy the path/endpoint **from the resolver's own output** ({{BASH_TOOL}}
`fd`/`ls` for a file, the exact GET URL for an API) and confirm it resolves before writing it.
Never reconstruct or abbreviate it from memory; a path missing its directory prefix breaks the
R8 trail.

**Transformation clause:** verbatim real lines **outrank** any transformation of raw source
material. If a rung yields only **raw** source (highlights, exports, notes) that would have to
be rewritten into the target form, it is **not yet a fixture** — descend to the next rung
(local DB → read-only API → operator export) for already-in-form verbatim lines before
transforming anything. Transforming raw source is a **last resort ranked just above
synthetic**: each transformed item is flagged **`[transformed from real source]`** (distinct
from `[real verbatim]` and `[representative]`), and its texture is marked **ESTIMATED**.

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

**Regeneration memory:** on a re-run, diff against any prior fixtures artefact for this app. If
a prior run pulled from a **richer rung** (e.g. read-only prod verbatim), you MUST match or
exceed it — or explicitly flag the downgrade and its measured texture cost. Never regress the
source rung silently.

## Per-screen, state-aware (mine these, don't invent them)

For each screen and each of its states (empty / loading / error / offline / first-time /
populated), capture:

- **Cardinality** — how many items the state realistically holds (0, 1, a few, many). The
  empty and the overflowing cases are both required.
- **Length** — the real character/word length of each field at the decision moment, preserved
  **both ways**: don't pad short content into paragraphs, and don't thin/compress long content
  into one-liners. When real items are **transformed** (e.g. to satisfy a validator's
  sentence-count rule), the transformed set MUST keep the source's real length distribution —
  measure min/avg/max of the source rows and of the set you hand over, and require a match
  within ~15%. A sentence-count rule is **not** a length rule.
- **Distribution** — the realistic spread (most rows short, a few long; common vs rare status).
- **Edge rows** — the longest title, the truncation case, the missing-optional-field row, the
  one with an unusual value. These are where layout breaks; include them on purpose. The
  "longest" edge must be the **global real maximum** mined from the whole source corpus (the
  longest field across **all** real rows), not the largest of a convenient subset — record its
  measured length, and verify it is the source max rather than re-labelling an interior item as
  "the longest". Carry a worse-case forward from a prior generation; never regress it.

**Synthetic can't drown real:** when the real account is **cold/initial** (the common
young-app case), that cold/empty state is the **primary design target** — keep it the densest,
foremost fixture. A synthetic mature/populated state is allowed only as **subordinate**:
minimal fields, visually secondary, never richer or more numerous than the real cold one. Let a
synthetic populated state outweigh the real cold one and you have re-imported the "imagine a
mature account" bias R8 forbids — even with every line flagged.

**No formulas or mechanics in fixtures:** fixtures carry **content and texture** (length,
cardinality, brevity), never implementation **formulas** or mechanics constants. A derivation
formula (e.g. `clamp(base + words×factor, lo, hi)`) is mechanics — express only the resulting
**band** ("5–15s, longer for longer answers"), never the formula or its coefficients.

## Copy lane — literal copy is real texture, but mutable (not a requirement)

Mine the app's **literal copy** (button labels, microcopy, empty-state lines, error messages)
as **real content** — its brevity, tone and voice are texture the design agent must see, so it
belongs with the fixtures. But literal copy is its **own mutable lane**: the exact words are
**content the design agent may rewrite**, never a binding layer-2 value. What binds is the
**speech-act** behind the copy (what the words make the person do or understand) — that lives
in the screen's Interaction-model block (R4) and, where it carries a human×system decision, the
Philosophy block (R5/R6) — not in the string itself. Hand
literal copy as a flagged **`copy (mutable)`** set alongside the fixtures, explicitly marked
editable, so its texture informs the design without freezing the words as a requirement.

## What to hand the design agent

A compact fixture set per screen-state that the agent can drop into the design **as-is**,
showing the real texture. Pair it with the screen's "Visible information" section so the agent
sees the content at the size and density it actually appears. Tag **each item** with its
provenance tier — **`[real verbatim]`** / **`[transformed from real source]`** /
**`[representative]`** — and never label a transformed item verbatim or pair it with a real one.

## Checklist before sending

- [ ] Every fixture traces to a **real** source actually pulled (in-repo / local DB / read-only
      API / operator export) — Faker/placeholder ≠ real. Synthetic only as an operator-approved
      last resort, as a complete flagged set, never a few inline examples.
- [ ] Provenance path is **verified-resolvable** — copied from the resolver's output and
      confirmed to resolve, not reconstructed from memory.
- [ ] No **rung downgrade vs a prior generation** unless explicitly flagged with its texture cost.
- [ ] Each screen-state has its **cardinality** captured, including empty and overflow.
- [ ] **Edge rows** present, and the "longest" is the **global real maximum** (measured, source
      max verified), carried forward from prior gens, never regressed.
- [ ] Texture preserved **both ways** — short stays short, long stays long; any transformed set
      matches the source min/avg/max length distribution within ~15%; no PII.
- [ ] When the real account is **cold**, it is the primary/densest fixture; any synthetic
      mature state is subordinate (minimal, secondary, never richer/more numerous).
- [ ] Fixtures carry **content/texture only** — no derivation formulas or mechanics constants,
      only resulting bands.
- [ ] Each item tagged with its **provenance tier** (`[real verbatim]` / `[transformed from
      real source]` / `[representative]`); transformed never labelled verbatim/real.
