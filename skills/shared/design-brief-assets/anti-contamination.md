# Asset — Anti-contamination (three-layer model, DEFINE/DECIDE, §6 checklist)

The heart of `design-brief`. Anti-contamination is **not** "ban visual vocabulary and stay
silent" — that, on its own, reproduces the failure. It is: **silence on visual form, but
behaviour and philosophy specified with concrete values.** This asset is self-contained; the
consolidated canonical record (R1–R18, gold example, acceptance checklist) is
`design-brief-three-layer-briefing.md` in the atomic-skills repo.

## The three-layer model

| Layer | Examples | Owner | In the prompt |
|---|---|---|---|
| **1. Visual form** | colour, radius, shadow, which widget, spacing, typography | design agent | **silence** |
| **2. Interaction model** | pace/timings, counts, lengths, modality, triggers, reversibility, parity | **product** | **specify, concrete** (the band binds; the exact value is current calibration the agent may improve — see DEFINE/DECIDE) |
| **3. Philosophy / who decides** | human × system; what stays hidden | **product** | **binding guardrail** |

R2 per-regime SOURCE note: layer-2 concrete values are always stated. For `brownfield`
pages, mine/extract values from code. For `greenfield` pages, ask the operator, seeded by
the catalog's artefacts. Regime switches the SOURCE only, not silence; layer-1 visual-form
silence is unaffected.

The rule "don't induce, let the agent decide" is layer-1 only. Extending the silence to
layers 2 and 3 is the root failure (under-specification → the agent fills the gap with its
conventional default → the product anti-pattern).

## Provenance tiers — mined ≠ binding

Every mined fact carries a provenance tier, and the tier — not the fact's existence in the
code — decides whether it binds:

| Tier | What it is | Where it goes |
|---|---|---|
| **(a) Product invariant** | corroborated by product intent (the verbs/surfaces/promise), not just the code | **binding guardrail** (R6) |
| **(b) Legacy / current-app behaviour** | in the code, *not* corroborated — one witness of what the app does today, often the very thing to redesign | **CONTEXT to question**, not a requirement — the redesign may improve it |
| **(c) Literal copy** | the words on a control | **mutable**, never emitted in the behaviour prompt |

**Mined ≠ binding; legacy behaviour is context to question, not a requirement.** Two witnesses
exist: **code** = what the app does today (one witness, often the thing being redesigned);
**product intent** = the product's verbs/surfaces/promise (the other witness, source of the
redesign). Brief the **union**, surface the **difference**, freeze only tier (a). Never freeze
legacy mechanics/constants/copy as a requirement — that inherits the old app's bugs.

**Hub vs dashboard**: an action hub answers *what do I do next* (standing + next move); a
dashboard answers *how am I doing* (analysis grid). Brief the screen's job, don't default the
hub into a metrics wall. **Define the terms**: where the product has more than one level or
directional sense of a word, name and distinguish them so the design can teach the difference
rather than collapse it. (Detail lives in `screens-prompt`.)

## DEFINE / DECIDE table (what the prompt fixes vs what the agent chooses)

| The prompt DEFINEs (binding) | The agent DECIDEs / may improve |
|---|---|
| The interaction **band** (R2) — pace/count/length/modality as behavioural essence | The **exact layer-2 value within the band** — current calibration, improvable |
| Intent-corroborated invariants as **R6 guardrails** (forbidden anti-patterns) | The **literal copy** — a mutable texture lane (the speech-act binds, the words don't) |
| Human × system ownership; what stays hidden | Which widget, layout, control |
| Measurable visual constraints (e.g. WCAG 2.2) | Colour, radius, shadow, spacing, typography |
| Which screens/states exist, in mobile/desktop + light/dark | Visual hierarchy, styling, and the visual solution/treatment |

A visual **requirement** becomes a **measurable constraint** (e.g. "contrast ≥ 4.5:1"), never
a visual **solution** ("use a grey #767676 label").

## Substitute, never delete (R7)

When you de-induce a widget/gesture label, **replace it with its behavioural essence**; never
delete the essence with the label. "swipe" → "a single fast gesture reachable with the thumb".
Deleting the behaviour to "avoid inducing" is the most common way to fall into the layer-2/3
silence failure.

The same rule scales to **screens**. The pass that forbids deleting a behaviour along with its
widget label equally forbids deleting a **screen/surface** along with its mined detail. A
refinement pass removes the **HOW** (mechanics, constants, legacy copy), never the **WHAT** (a
screen exists, a surface is reachable). If cleaning mined detail empties a screen, you deleted
the behaviour with the mechanics — **restore the screen and re-describe its essence**. Coverage
is **monotonic**: the set of briefed screens/surfaces only grows or holds across rounds, never
shrinks.

## Omission audit (R3) — run before closing each screen

*"If I omit this parameter (timing, count, length, modality, what-stays-hidden), would a
reasonable agent fill it with something that contradicts the product?"* If yes, **state it**.
Omission is a decision, not neutrality.

## §6 — per-screen acceptance checklist (the prompt self-verifies before sending)

Generation is done only when, for **each** interactive screen:

- [ ] Has an **Interaction model** block with **concrete values** (some timing/count/length/
      modality), not just adjectives.
- [ ] Has a **Philosophy / guardrails** block stating **who decides** (human × system) and
      **what stays hidden**.
- [ ] **Names the forbidden anti-pattern** where the agent's default would collide with the product.
- [ ] Passed the **omission audit** (R3): no load-bearing parameter left out.
- [ ] Does **not** name a widget or describe visual form (colour/border/shadow/spacing).
- [ ] **No mechanics constant** (px, axis-lock, debounce-ms) **or literal copy is emitted as a
      requirement** — mechanics stay out of R2 (mining filter); literal copy is a mutable
      texture lane, not a binding value.
- [ ] **Every layer-2 value is calibration-with-band** (R9) **or traces product intent** (an R6
      guardrail when corroborated) — never a frozen raw number.
- [ ] **Every FEATURE/subsystem briefed as real has real backing** — a model/endpoint/store at
      `file:line` — **OR** is operator-approved greenfield, flagged not-yet-built. Static
      literals are not a real feature.
- [ ] **Every system-inferred outcome names the concrete human action/trigger it reads** (mined,
      `file:line`) **and the direction** — never a system effect with no named cause.
- [ ] **Every code↔intent contradiction is SURFACED** (both witnesses + the signal), not silently
      resolved — the difference is briefed, not picked for the agent.
- [ ] **Noun sweep**: every UI noun in a screen block is **product-domain or behavioural**; any
      layout/control noun (badge/band/menu/anchor/grid/map — *selo/faixa/menu/âncora/grade/mapa*,
      PT or EN) was rewritten as a behavioural attribute, and **no DS-owned widget is
      re-described under a parallel form-phrase**.
- [ ] **Motivation/status ≠ analysis/metrics**: an action hub states standing and next move; it
      is not an analysis grid of metrics.
- [ ] **Ambiguous product levels/senses are DEFINED** and the design **teaches the distinction**
      — a small set of directional senses is named, not collapsed.
- [ ] **Per-screen 6-state ledger complete**: each state specified **or** marked not-applicable
      with a reason — no silent omission.
- [ ] **Real fixtures pulled from a real source** (in-repo / local DB / read-only API / operator
      export), generated **state-aware** (cardinality + edge rows), texture preserved. A few
      inline examples ≠ fixtures; synthetic only if every real source genuinely failed **and**
      the operator approved — still a complete flagged set.
- [ ] Covers **mobile and desktop**, **light and dark**, and **all states**.
- [ ] **Consumes the DS** by name, never redefining; orders **stop and signal** if the DS lacks something.
- [ ] **Mandatory validation passed** (non-deferrable): **CP2** (scope frozen by the operator) and
      **CP5** (final sign-off) cleared, and **every** stop-and-ask (feature-reality, contradiction
      R2b, greenfield, missing layer-3, fixtures authorisation) resolved by the operator — nothing
      generated past an unvalidated scope or delivered without sign-off.

If any box is unchecked, the screen is not ready — fix it before sending.
