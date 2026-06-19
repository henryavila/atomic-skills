# Asset — Screens prompt skeleton (consumes the inherited DS)

Skeleton for the **second** prompt: per-screen specs handed to the design agent. It consumes
the **inherited DS** by name and never redefines it. Emit in the output language (pt-BR or the
install-configured language). One screen block per screen in the coverage ledger — **no screen
left out**.

---

## R9 preamble (emit verbatim at the top — in the output language; pt-BR shown, translate if the install language differs)

There are **two distinct authorities**, not one all-binding bucket — the preamble keeps them
apart so layer-2 is never frozen as if it were layer-3:

> Há **duas autoridades distintas** neste briefing — não um carimbo único de "tudo vinculante":
> — **Forma visual** (widget, cor, formato, espaçamento): é **sua** para decidir — não prescrevemos.
> — **Filosofia / o que fica oculto / quem decide** (camada 3): **requisito de produto vinculante**, não negociável.
> — **Comportamento de interação** (camada 2): é a **calibração atual** do app — a **banda comportamental vincula** (ex.: "a cadência é da ordem de segundos"), mas o **valor exato é o que o app faz hoje (~8s), melhorável por você dentro da banda**, nunca um número congelado.
> Consumimos o **Design System existente** pelo nome semântico e nunca o redefinimos. Se uma tela precisa de algo que o DS não tem, **pare e sinalize** — não improvise.

## Per-screen block — the 8 mandatory sections (§4)

For **each** screen, emit all eight; sections 4 and 5 are mandatory whenever the screen has
interaction:

1. **Purpose** — the person's goal on this screen.
2. **Visible information** — what must be on screen, with **real fixtures** (see the
   fixtures recipe). Each screen-state gets a real, **state-aware** set (cardinality + edge
   rows) **pulled from a real source** (the skill's fixtures step, R8) — a few inline examples are **not**
   fixtures. Show the texture: how little (or how much) text there really is at the moment of
   decision.
3. **What the person needs to do** — intents, not widgets.
4. **Interaction model** *(mandatory when interactive)* — describe by behavioural attributes,
   never by widget, with the **concrete values mined from the code (R2)**, expressed as
   **current calibration, not a frozen requirement**: state the **behavioural band that binds**
   (e.g. "pace on the order of seconds") **and** the **exact mined value as the current app's
   calibration** (e.g. ~8s), improvable by the design agent within that band — never the bare
   value as a hard requirement:
   - *gesture class* (fast / deliberate / typing), *latency* (instant / sub-second /
     deliberate), *effort* (one hand / thumb), *text density* (very short / verbose),
     *timings* (pace in seconds, default timers), *counts* (how many levels/items),
     *triggers* (only after X), *reversibility* (forgives an accidental touch),
     *parity* (mobile-gesture ↔ desktop-keyboard, equally fast).
   - **Forbidden vocabulary (R4):** never name a button / list / tab / bar / card-UI /
     heatmap / chip / modal, and never describe colour / border / shadow / spacing — those
     are layer-1 form, the design agent's to choose. Naming any of them is contamination.
5. **Philosophy / guardrails** *(mandatory)* — the **human × system** axis (which decision is
   human judgement, which is the system's technical/hidden call), **what stays hidden**, and
   the **forbidden anti-pattern named** for risky screens (R6). A system decision must never
   surface as a user choice.
6. **Flow** — the moment-to-moment sequence.
7. **States** — empty / loading / error / offline / first-time / populated. Every state, in
   **mobile and desktop**, **light and dark**.
8. **Constraints** — usability (one hand, instant, forgives error, etc.).

## Omission audit before closing each screen (R3)

Ask, per screen: *"If I omit this parameter (timing, count, length, modality,
what-stays-hidden), would a reasonable agent fill it with something that contradicts the
product?"* If yes, **state the parameter**. Silence is permitted **only** about visual form.

## De-induction rule (R7) — substitute, never delete

When removing a widget/gesture label, replace it with its behavioural essence; never delete
the essence along with the label. "swipe" → "a single fast gesture reachable with the thumb".

## Consume the inherited DS (not redefine)

Reference tokens/components by semantic name from the DS. Do **not** restate colour, radius,
shadow, spacing or any component. Fork the **base template** from the DS prompt as the shell.
If a screen needs something the DS lacks → **stop and signal**, do not improvise.

---

## Gold example (the bar to hit) — "how a card is answered"

**Shallow (the failure — do NOT generate like this):**
> *"Rate how well you remembered, on a short scale — didn't / almost / remembered."*

**Correct (behaviour + parameters + guardrails, no widget — generate like this):**
> **Interaction model.** Each card is **very short** (a few lines). The cadence is in
> **seconds**: the person thinks, and a **soft time limit of a few seconds** (in the current
> app, ~8s) reveals the back on its own. After reveal, the person expresses recall in a
> **single fast gesture reachable with the thumb**, **instant**, that **forgives an accidental
> touch**; on desktop equally fast **without a mouse**. There are **~3 human expressions**
> (didn't / almost / remembered); an "easy" is **inferred** from response readiness, not a 4th
> option to weigh. The whole act (think→reveal→answer→next) lasts **a few seconds**.
>
> **Philosophy / guardrails (binding).** The person judges **memory**, never the **schedule**.
> The interval/scheduling (e.g. FSRS) is the **system's** and **does not appear**. **Forbidden:**
> showing "+N days", technical labels ("Hard/Good/Easy"), or turning the answer into an option
> picker with intervals. No number on the answering path.

Zero mention of colour/widget, yet the agent can no longer derive the button-with-days. That
is the quality target.
