From a real app (its code + the product intent), generate the **design prompts**
(Design System + screens) for a design agent (e.g. claude.ai/design) **without
contaminating the visual decision** — silence only on form; behaviour and philosophy
specified with concrete values.

**The target app is the current project** — the repository this skill is invoked in. Mine
its code directly from the working directory; do **not** ask "which app" or expect a path to
a different repo. {{ARG_VAR}}, if given, is the **product intent** (or a path to an intent
doc), never a different app. The product intent (promise, philosophy, forbidden anti-patterns)
is **not** in the code — gather and confirm it with the operator at **CP1** (mandatory
validation) before generating anything.

**Two witnesses.** The existing **code** is one witness — what the app does *today*, often
the very thing the redesign replaces. The **product intent** is the other — the product's
verbs, surfaces, and promise, the source of everything the redesign *adds*. Brief the
**union** of the two; surface the **difference** rather than silently picking one; never
freeze legacy behaviour as a requirement just because it is in the code, and never drop a
surface when cleaning mined detail.

## Iron Law

NEVER SILENCE BEHAVIOUR OR PHILOSOPHY — SILENCE IS FOR VISUAL FORM ONLY.

The rule "don't induce, let the design agent decide" applies **only to layer 1 (visual
form)**. Extending that silence to layer 2 (interaction model) and layer 3 (philosophy /
who-decides) is the failure this skill exists to prevent — every omitted parameter becomes
the agent's conventional default, which is usually the product's anti-pattern. Specify
behaviour and philosophy with **concrete values mined from the code**; when you de-induce a
widget/gesture label, **substitute its behavioural essence, never delete it** (R7). The
operative rules live in the lazy assets below; the consolidated canonical record (three-layer
model + R1–R18) is `design-brief-three-layer-briefing.md` in the atomic-skills repo.

## Three-layer model (the heart of anti-contamination)

| Layer | Examples | Owner | In the prompt |
|---|---|---|---|
| **1. Visual form** | colour, radius, shadow, which widget, spacing, typography | design agent | **silence** |
| **2. Interaction model** | pace/timings, counts, lengths, modality, triggers, reversibility, parity | **product** | **specify, concrete** (band binds; exact value = current calibration, improvable) |
| **3. Philosophy / who decides** | human × system; what stays hidden | **product** | **binding guardrail** |

## Mandatory operator validation (non-deferrable)

This skill is a **checkpointed process**, not a one-shot generation. The operator's judgement
is the **only** source of everything the redesign adds that mining cannot see — verbs, surfaces,
breadth, hidden decisions — so the skill **stops at fixed checkpoints**, shows what it has
decided or decomposed, and requires an **explicit operator decision** via
{{ASK_USER_QUESTION_TOOL}} before continuing. Each checkpoint presents **concrete choices to
approve or correct**, never an open question; the operator validates/adjusts, they do not author.

| # | When (process step) | The operator validates |
|---|---|---|
| **CP1** | after step 1 (intent) | the promise + breadth, the human × system boundary, the forbidden anti-patterns, and the validation points derived from the intent |
| **CP2** | after steps 2–3 (verb graph + ledger) | the **full inventory** — existing screens + every `[redesign-addition]` surface the code lacks + `[greenfield]`/stub features + `[greenfield/spec]` subsystems + flagged contradictions. **Scope freezes here: nothing is generated until CP2 passes.** |
| **CP3** | per screen during step 5 | the mined behavioural values (with provenance triage), the philosophy/guardrails, and that screen's omission / contradiction / feature-reality questions |
| **CP4** | before step 6 (fixtures) | the fixtures **source** — rung, prod read-only authorisation, regeneration-memory diff |
| **CP5** | before step 7 (emit/deliver) | the coverage ledger + per-screen decisions + the §6 self-check — explicit **sign-off**. The brief is **not delivered** without it; on sign-off it is **handed off for review** (step 8), never closed as "done". |

**Non-deferrable.** The skill may not emit or deliver a brief without passing **CP2** (scope)
and **CP5** (sign-off) and resolving **every** flagged stop-and-ask (feature-reality stub,
contradiction R2b, greenfield, missing layer-3, fixtures authorisation). "Validate later" is
not an option — an unvalidated scope or a missing sign-off makes the brief invalid by construction.

**Non-interactive abort.** With no TTY (a hook/loop invocation, no operator present), the skill
**aborts** rather than skipping a checkpoint — *mandatory* means you cannot proceed without the operator.

## Process

### 1. Input contract (§1) — code + **product intent**

The source is **the existing code + the product intent** (an explicit input) + the `project`
plan when present. Much of layer 3 (philosophy, forbidden anti-patterns) **is not in the
code** — so when the product intent, the human × system boundary, the hidden domain
decisions, or the forbidden anti-patterns are not derivable from the artefacts, **stop and
ask** the operator via {{ASK_USER_QUESTION_TOOL}} before generating anything.

The product's **promise** and its **breadth** come from the product intent, **not** the
code's current scope. When the code's framing is *narrower* than the intent (it implements a
slice of what the product promises), state the **intent's** breadth and flag the narrowing as
a **redesign target**, never inherit the code's narrower scope as the spec. A design guide's
"central loop" is **one journey**, not the product definition — brief it as the spine, not the
whole.

### 2. Verb/surface graph (product-led, before the ledger)

Before the code-derived ledger, enumerate the product's **verbs** **from the product intent**
(not the code): the full CRUD spine — **create/add, read/capture, update/edit, archive,
delete** — plus the **domain verbs** the product promises (review, share, …). For each verb,
name the **surface** it needs. Then cross this verb graph against the code-derived inventory
(step 3): **every verb/surface the code lacks is a first-class screen to brief**, flagged
`[redesign-addition · invisible-to-mining]`, **never dropped** because mining could not see it.

Apply the **verb × object** principle: an action is a **labelled launcher** (it names what it
does); touching an **object** opens **that object's hub** — never guess a verb from a tap.

### 3. Screen inventory + coverage ledger (§7 — no screen left out)

Run reconstruction first with {{BASH_TOOL}}: `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/app-map-reconstruct.js" <appRoot> --delta`.
This happens before consuming the catalog and before any live route enumeration.

Use the delta as the divergence list that needs operator arbitration. For each delta item,
ask with {{ASK_USER_QUESTION_TOOL}} over the conflict's full witness set (no value dropped — P1).
The arbitration is applied **programmatically**: the agent passes the resolved pages to
`persistReconstruction({ pages })`, which writes the catalog carrying the operator's decisions.
The CLI flag `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/app-map-reconstruct.js" <appRoot> --persist` is non-interactive
RE-emission of the catalog from the current sources — it does NOT record arbitration; the
resolved-page channel does.

Consume the catalog's `pages` to build the **coverage ledger**: each page is recorded by
`existence` (`confirmed`, `artefact-only`, `code-only`, `possible-alias`) and any remaining
divergences/conflicts. A page whose `audience` or `accessTier` is `null` is a **stop and ask**
signal, never a silent default. No screen is left out; each ships with all its states, in
mobile/desktop and light/dark.

**Feature-reality gate (per FEATURE, not per page).** Before promoting a feature/stub to
"real" — including via an operator "draw this as real" decision — classify it by **backing**
with {{GREP_TOOL}}: **system-backed** (a model/endpoint/store at `file:line`) vs **stub-only**
(static literals, `preview`/placeholder markers, no data-binding). If it is stub-only and
**nothing backs it**, STOP and ask via {{ASK_USER_QUESTION_TOOL}} whether it is
**greenfield-to-build** (flag `[greenfield]`) or should be **cut** — never promote it silently
as real.

Legacy fallback only: live route-Glob enumeration with {{GLOB_TOOL}}/{{GREP_TOOL}} is
legacy opt-in and never the default. Reconstruction-first is the default in Revisão 2
because the catalog juxtaposes code, artefacts, and operator arbitration; live code alone
is one witness, not the source of truth. When you do fall back to live-code enumeration,
**sweep prior briefs/specs** for surfaces that were *asserted but never built* and for **real
subsystems with no route** (models + factories, no page); include them as `[greenfield/spec]`
blocks. Record any **drop** as an explicit operator decision, never as silence.

### 4. DS-first — the DS is built separately, screens consume the inherited one

Generate the **Design System prompt** first
(`{{ASSETS_PATH}}/ds-prompt.md`). The **screens prompt** consumes the
**inherited DS** by semantic name and **never redefines** tokens or components; if a screen
needs something the DS lacks, the prompt orders it to **stop and signal**, not improvise.

### 5. Mine the behavioural parameters from the code (R2) + omission audit (R3)

Fill the Interaction-model block, per screen, with the values that govern the interaction —
**R2**:
- **timings/defaults** (timers and durations that set the **pace** — the cadence, not raw ms),
- **counts** (how many response levels, how many items),
- **lengths** (how short the content is at the moment of decision),
- **modality** (gesture/keyboard/touch),
- **triggers** (what only becomes available after what),
- **what the domain keeps hidden** (e.g. the scheduling algorithm).

**Provenance triage — every mined fact is one of three.** (a) **Product invariant** —
corroborated by the intent → a **binding guardrail**. (b) **Current-app / legacy behaviour**
— in the code, *not* corroborated by the intent → **context to question**, the redesign may
improve it: flag it "this is what the app does today; worth rethinking?", never freeze it as a
requirement. (c) **Literal copy** — never enters the behaviour prompt at all. When a value is
**inferred by the system**, name the exact human **action** that triggers it and the
**direction** (which signal → which outcome), mined from the code at `file:line` — never a
vague "readiness".

**Contradiction audit (R2b).** When a mined value **contradicts** the declared intent (rather
than corroborating it), do **not** silently pick the code. Emit a **"Fact correction +
stop-and-signal"** block naming **both witnesses** (code `file:line` vs intent `file:line`) and
instruct the design agent to **signal** if the intent has flipped, before designing against
either.

**Mining filter — essence, never mechanics.** What enters the prompt is the **behavioural
essence** that governs the interaction (pace, count, length, modality, trigger), expressed as
essence **plus the current calibration** — and this covers **every quantitative value alike:
timings, counts, lengths** (e.g. "pace on the order of seconds, ~8s in the current app";
**a count is calibration too** — "a starting list of about a dozen items today, improvable" —
the *current shape*, never a frozen number). A count is band-pinned exactly like a timing
**unless a product invariant corroborates it** — then it routes to an R6 guardrail (e.g. the
~3 response levels, where a 4th would break the philosophy), never a bare number. A bare count
with no corroborating intent (a first-run explainer's step-count, a list's size) is the
**current shape, improvable**, never a requirement. Implementation **mechanics stay out of R2**: layout `px`/measurements, gesture
`axis-lock`, raw `debounce`/durations in ms, and **literal copy** (button/label text) are
incidental to the implementation, not product requirements, and contaminate the prompt if
shipped as values. *De-inducing a constant:* a swipe handler with `axis-lock: 'x'`, an `80px`
threshold and a 16ms `debounce` does **not** become "axis-lock X, 80px, 16ms" in the prompt —
it becomes the essence: "a single fast horizontal gesture, reachable with the thumb, that
forgives accidental touch". Mine the essence; drop the `axis-lock`, the `80px`, the `debounce`
and the literal copy.

Choose R2's SOURCE from the page's `regime` field in the app-map catalog:
- `brownfield`: mine/extract the concrete values from the live code.
- `greenfield`: ask the operator with `{{ASK_USER_QUESTION_TOOL}}`, seeded by the
  catalog's artefacts (the doc candidates that asserted the page), then state the
  operator's concrete values.

The parameter is **NEVER silenced** in either regime: only the SOURCE changes
(code → operator), never whether the value is stated. This does not extend layer-1 silence;
silence remains for visual form only.

Close the gaps with the **interactive omission audit (R3)**, per screen:
> *"If I omit this parameter (timing, count, length, modality, what-stays-hidden), would a
> reasonable agent fill it with something that contradicts the product?"* — if yes, **state
> the parameter**. Omission is a decision. Resolve whatever is missing with the operator.

### 6. Acquire and generate REAL fixtures (R8) — non-skippable

Fixtures are a **first-class deliverable**, not a garnish. The screens prompt is incomplete
until every interactive screen-state carries a **real, state-aware fixture set**
(cardinality + edge rows + the real brevity/density). A handful of plausible-looking inline
examples marked "[fallback]" is **not** fixtures — it is the exact failure this step exists
to prevent.

**Acquire real data — walk down this ladder, stop at the first rung that yields real content:**
1. **In-repo real content:** seeders/factories with *real* values, tests, demo/staging data,
   doc examples, sample exports. (Faker/placeholder factories do **not** count as real.)
2. **The app's local database (read-only):** query it via the app's own tooling
   ({{BASH_TOOL}}) — an ORM console/CLI or a direct read query against the dev DB. Local is
   the safe default.
3. **The app's API in read-only (GET only):** only with the operator's **explicit
   authorization** and credentials they supply. Handle the token via a file **outside the
   repo**, never echoed into the transcript; never call a write endpoint.
4. **An operator-provided export** of real content.

Synthetic data is allowed **only** as an explicit, operator-approved last resort when every
rung above genuinely fails — and even then it must be a **complete generated set** (per
screen-state, with edge rows), each item **flagged** as representative. Never ship synthetic
as if it were real, and never let "synthetic is allowed as a fallback" become the first move.

**Why real beats your guess (texture lesson):** mined real content is routinely denser/longer
and in a different state than a reasonable guess — answers that run 3–4 sentences where you'd
write one-liners, an early/cold account where you'd imagine a mature one. Guessing the texture
defeats R8's whole purpose. Pull from the **richest** real source in target form (**verbatim
outranks transformation**), via a **verified-resolvable provenance path**, and **never regress**
vs a prior generation. Detail: `{{ASSETS_PATH}}/fixtures-recipe.md`.

**HARD-GATE:** do not emit or deliver while any interactive screen still lacks a real,
state-aware fixture set. If all you have is inline examples, STOP and go pull real data.

### 7. Emit the prompts (output language: pt-BR or the configured language)

Compose the prompts from the lazy assets and **emit each as a markdown file** into a
`design-handoff/` folder in the current project — one file per prompt (`00-design-system.md`,
`01-screens.md`, `02-fixtures.md`) plus a `README.md` index — so the design agent can consume
them. **Every generated prompt ships in pt-BR (or the install-configured language)** — never
an ad-hoc guess. Before delivering, run the per-screen acceptance checklist (§6) from the
anti-contamination asset.

### 8. Hand off for review — emission is **not** the finish line

The `design-handoff/` folder is a **handoff that goes to review**, not delivered work. The
closing message must say so **explicitly** — a bare "emitted N files" table is the exact gap to
close: the operator must see the artefact is **going to review**. State, in the output language:

1. **What was emitted** — the folder + the files by name (`00-design-system.md`, `01-screens.md`,
   `02-fixtures.md`, `README.md`).
2. **That it is for review** — the operator **reviews and corrects** the brief and only **then
   sends it to the design agent**; the agent's verdict comes back to refine the next round. Never
   report emission as "done".
3. **The next action** — review → correct → send to the design agent → bring the feedback back.

**Offer mdprobe for the review** — a markdown viewer/reviewer with live reload and persistent
annotations, ideal for reading the files and marking corrections in place. Opening a browser is
an **intrusive side effect — never auto-launch**; ask first with {{ASK_USER_QUESTION_TOOL}} (in
the output language), e.g. *"Open `design-handoff/` in mdprobe to review and annotate? (y/n)"*.
On **yes**, run the folder with {{BASH_TOOL}}:

```bash
mdprobe design-handoff/ 2>/dev/null || npx -y @henryavila/mdprobe design-handoff/
```

The `|| npx -y @henryavila/mdprobe` fallback covers a machine where mdprobe is not installed
(it self-detects and falls back, so no separate "is it installed?" probe is needed); mdprobe's
singleton server reuses a running instance if one is already up. On **decline**: *"Open the
files in `design-handoff/` when you're ready to review."*

## Assets (lazy — read on demand from `{{ASSETS_PATH}}/`)

- {{READ_TOOL}} `{{ASSETS_PATH}}/ds-prompt.md` — the DS prompt skeleton
  (semantic token contract + component inventory with states + **1 base template** + WCAG 2.2).
- {{READ_TOOL}} `{{ASSETS_PATH}}/screens-prompt.md` — the screens prompt
  skeleton (R9 preamble + mandatory Interaction-model / Philosophy blocks + 8 sections + states).
- {{READ_TOOL}} `{{ASSETS_PATH}}/fixtures-recipe.md` — the recipe for
  **real-data** fixtures carrying texture (R8).
- {{READ_TOOL}} `{{ASSETS_PATH}}/anti-contamination.md` — the three-layer
  model, the DEFINE/DECIDE table, the substitute-never-delete rule (R7) and the §6 acceptance checklist.

## Red Flags

- "No aesthetics, so I'll delete the sentence about the gesture." → Deleting the behaviour
  along with the label IS the failure. Replace "swipe" with "a single fast gesture reachable
  with the thumb" (R7).
- "I won't pass the countdown timing — let the agent decide the pace." → Omission is not
  neutral; it is an outsourced wrong guess. Mine the value (R2) and state it.
- "A few inline example cards marked '[fallback]' are my fixtures." → That is the failure, not
  fixtures (the fixtures step, R8). Pull **real** data down the ladder (repo → local DB → read-only API → operator
  export) and generate a **state-aware set per screen-state with edge rows**. Synthetic is a
  last resort, operator-approved, still a complete flagged set. Real content is denser/different
  than you will guess — guessing defeats R8 (fixtures-recipe).
- "The scheduler/algorithm can show up as options." → A system decision never becomes a user
  choice (layer 3). Name the forbidden anti-pattern on the risky screen (R6).
- "I'll delete this screen while cleaning mined detail." → **Monotonic coverage.** De-mining
  removes the **HOW** (mechanics), never the **WHAT** (a screen). If cleaning *empties* a
  screen, you deleted the behaviour along with the mechanics — restore the screen, re-describe
  its essence (R7). Coverage only **grows or holds** across rounds; it never shrinks.
- "The operator said draw this as real." → Check **backing** first; a static stub isn't a real
  feature (feature-reality gate). A human × system guardrail around a **non-existent** system
  legitimises an invention (R5) — classify by backing, then ask greenfield-vs-cut.
- "Code and the README disagree, so I use the code." → Contradiction isn't omission. Surface
  **both witnesses** + stop-and-signal (R2b); never silently pick the code.
- "Show the streak/metrics" became a metrics grid on an action hub. → **Hub vs dashboard.**
  Motivation/status stays on the **hub**; analysis lives on the **dashboard**. Never carry a
  mined metric grid onto a hub as if it were a real feature.
- "I'll generate the whole brief, then have the operator review at the end." → No. Validate at
  **CP1–CP5 as you go** (mandatory operator validation). A brief generated past an unvalidated
  scope (CP2) or delivered without sign-off (CP5) is invalid by construction — the operator's
  judgement is the only source of what mining cannot see.
- "I covered the main screens." → No screen left out (§7). Without a complete coverage ledger, stop.
- "Emitted 4 files — done." → Emission is **not** the finish line (step 8). The handoff **goes to
  review**: say so, offer `mdprobe design-handoff/` to review/annotate, and name the next action
  (review → correct → send to the design agent). A bare "emitted N files" table hides that the
  artefact still has to be reviewed and sent.

If you thought any of the above: STOP. Go back to the step you were skipping.
