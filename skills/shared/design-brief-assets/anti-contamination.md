# Asset — Anti-contamination (three-layer model, DEFINE/DECIDE, §6 checklist)

The heart of `design-brief`. Anti-contamination is **not** "ban visual vocabulary and stay
silent" — that, on its own, reproduces the failure. It is: **silence on visual form, but
behaviour and philosophy specified with concrete values.** Canonical spec:
`docs/design/design-brief-three-layer-briefing.md` (R1–R9, gold example, acceptance checklist).

## The three-layer model

| Layer | Examples | Owner | In the prompt |
|---|---|---|---|
| **1. Visual form** | colour, radius, shadow, which widget, spacing, typography | design agent | **silence** |
| **2. Interaction model** | pace/timings, counts, lengths, modality, triggers, reversibility, parity | **product** | **specify, concrete** |
| **3. Philosophy / who decides** | human × system; what stays hidden | **product** | **binding guardrail** |

The rule "don't induce, let the agent decide" is layer-1 only. Extending the silence to
layers 2 and 3 is the root failure (under-specification → the agent fills the gap with its
conventional default → the product anti-pattern).

## DEFINE / DECIDE table (what the prompt fixes vs what the agent chooses)

| The prompt DEFINEs (binding) | The agent DECIDEs (form) |
|---|---|
| Interaction behaviour with concrete values (R2) | Which widget, layout, control |
| Human × system ownership; what stays hidden | Colour, radius, shadow, spacing, typography |
| Forbidden anti-patterns on risky screens (R6) | Visual hierarchy and styling |
| Measurable visual constraints (e.g. WCAG 2.2) | The visual solution that satisfies them |
| Which screens/states exist, in mobile/desktop + light/dark | The visual treatment of each |

A visual **requirement** becomes a **measurable constraint** (e.g. "contrast ≥ 4.5:1"), never
a visual **solution** ("use a grey #767676 label").

## Substitute, never delete (R7)

When you de-induce a widget/gesture label, **replace it with its behavioural essence**; never
delete the essence with the label. "swipe" → "a single fast gesture reachable with the thumb".
Deleting the behaviour to "avoid inducing" is the most common way to fall into the layer-2/3
silence failure.

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
- [ ] **Real fixtures** present, with the texture (brevity) visible.
- [ ] Covers **mobile and desktop**, **light and dark**, and **all states**.
- [ ] **Consumes the DS** by name, never redefining; orders **stop and signal** if the DS lacks something.

If any box is unchecked, the screen is not ready — fix it before sending.
