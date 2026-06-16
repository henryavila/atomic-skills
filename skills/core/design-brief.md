From a real app (its code + the product intent), generate the **design prompts**
(Design System + screens) for a design agent (e.g. claude.ai/design) **without
contaminating the visual decision** — silence only on form; behaviour and philosophy
specified with concrete values.

If {{ARG_VAR}} was provided, use it as the target app/scope (repo path + intent).
If not, ask the operator: "Which app are we redesigning, and what is the product intent?"

## Iron Law

NEVER SILENCE BEHAVIOUR OR PHILOSOPHY — SILENCE IS FOR VISUAL FORM ONLY.

The rule "don't induce, let the design agent decide" applies **only to layer 1 (visual
form)**. Extending that silence to layer 2 (interaction model) and layer 3 (philosophy /
who-decides) is the failure this skill exists to prevent — every omitted parameter becomes
the agent's conventional default, which is usually the product's anti-pattern. Specify
behaviour and philosophy with **concrete values mined from the code**; when you de-induce a
widget/gesture label, **substitute its behavioural essence, never delete it** (R7). Canonical
spec: `docs/design/design-brief-three-layer-briefing.md` (three-layer model + R1–R9).

## Three-layer model (the heart of anti-contamination)

| Layer | Examples | Owner | In the prompt |
|---|---|---|---|
| **1. Visual form** | colour, radius, shadow, which widget, spacing, typography | design agent | **silence** |
| **2. Interaction model** | pace/timings, counts, lengths, modality, triggers, reversibility, parity | **product** | **specify, concrete** |
| **3. Philosophy / who decides** | human × system; what stays hidden | **product** | **binding guardrail** |

## Process

### 1. Input contract (§1) — code + **product intent**

The source is **the existing code + the product intent** (an explicit input) + the `project`
plan when present. Much of layer 3 (philosophy, forbidden anti-patterns) **is not in the
code** — so when the product intent, the human × system boundary, the hidden domain
decisions, or the forbidden anti-patterns are not derivable from the artefacts, **stop and
ask** the operator via {{ASK_USER_QUESTION_TOOL}} before generating anything.

### 2. Screen inventory + coverage ledger (§7 — no screen left out)

Run reconstruction first with {{BASH_TOOL}}: `node scripts/app-map-reconstruct.js <appRoot> --delta`.
This happens before consuming the catalog and before any live route enumeration.

Use the delta as the divergence list that needs operator arbitration. For each delta item,
ask with {{ASK_USER_QUESTION_TOOL}}, then persist with {{BASH_TOOL}}:
`node scripts/app-map-reconstruct.js <appRoot> --persist`.

Consume the catalog's `pages` to build the **coverage ledger**: each page is recorded by
`existence` (`confirmed`, `artefact-only`, `code-only`, `possible-alias`) and any remaining
divergences/conflicts. A page whose `audience` or `accessTier` is `null` is a **stop and ask**
signal, never a silent default. No screen is left out; each ships with all its states, in
mobile/desktop and light/dark.

Legacy fallback only: live route-Glob enumeration with {{GLOB_TOOL}}/{{GREP_TOOL}} is
legacy opt-in and never the default. Reconstruction-first is the default in Revisão 2
because the catalog juxtaposes code, artefacts, and operator arbitration; live code alone
is one witness, not the source of truth.

### 3. DS-first — the DS is built separately, screens consume the inherited one

Generate the **Design System prompt** first
(`skills/shared/design-brief-assets/ds-prompt.md`). The **screens prompt** consumes the
**inherited DS** by semantic name and **never redefines** tokens or components; if a screen
needs something the DS lacks, the prompt orders it to **stop and signal**, not improvise.

### 4. Mine the behavioural parameters from the code (R2) + omission audit (R3)

Read the real app and extract, per screen, the values that govern the interaction — **R2**:
- **timings/defaults** (timers, debounces, durations that set the pace),
- **counts** (how many response levels, how many items),
- **lengths** (how short the content is at the moment of decision),
- **modality** (gesture/keyboard/touch),
- **triggers** (what only becomes available after what),
- **what the domain keeps hidden** (e.g. the scheduling algorithm).

Close the gaps with the **interactive omission audit (R3)**, per screen:
> *"If I omit this parameter (timing, count, length, modality, what-stays-hidden), would a
> reasonable agent fill it with something that contradicts the product?"* — if yes, **state
> the parameter**. Omission is a decision. Resolve whatever is missing with the operator.

### 5. Emit the prompts (output language: pt-BR or the configured language)

Compose the prompts from the lazy assets and **emit each as a markdown file** in the existing
handoff format (see `docs/design/claude-design-handoff/`), so the design agent can consume
them. **Every generated prompt ships in pt-BR (or the install-configured language)** — never
an ad-hoc guess. Before delivering, run the per-screen acceptance checklist (§6) from the
anti-contamination asset.

## Assets (lazy — read on demand from `skills/shared/design-brief-assets/`)

- {{READ_TOOL}} `skills/shared/design-brief-assets/ds-prompt.md` — the DS prompt skeleton
  (semantic token contract + component inventory with states + **1 base template** + WCAG 2.2).
- {{READ_TOOL}} `skills/shared/design-brief-assets/screens-prompt.md` — the screens prompt
  skeleton (R9 preamble + mandatory Interaction-model / Philosophy blocks + 8 sections + states).
- {{READ_TOOL}} `skills/shared/design-brief-assets/fixtures-recipe.md` — the recipe for
  **real-data** fixtures carrying texture (R8).
- {{READ_TOOL}} `skills/shared/design-brief-assets/anti-contamination.md` — the three-layer
  model, the DEFINE/DECIDE table, the substitute-never-delete rule (R7) and the §6 acceptance checklist.

## Red Flags

- "No aesthetics, so I'll delete the sentence about the gesture." → Deleting the behaviour
  along with the label IS the failure. Replace "swipe" with "a single fast gesture reachable
  with the thumb" (R7).
- "I won't pass the countdown timing — let the agent decide the pace." → Omission is not
  neutral; it is an outsourced wrong guess. Mine the value (R2) and state it.
- "A synthetic fixture will do." → No. Use real data; the brevity/texture is part of the data (R8).
- "The scheduler/algorithm can show up as options." → A system decision never becomes a user
  choice (layer 3). Name the forbidden anti-pattern on the risky screen (R6).
- "I covered the main screens." → No screen left out (§7). Without a complete coverage ledger, stop.

If you thought any of the above: STOP. Go back to the step you were skipping.
