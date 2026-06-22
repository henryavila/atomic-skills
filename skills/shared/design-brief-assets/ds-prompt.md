# Asset — Design System prompt skeleton (DS-first)

This is the skeleton for the **first** prompt handed to the design agent: it asks the agent
to build the **Design System** that every screen will later inherit. Fill the placeholders
from the real app, keep the preamble verbatim, and emit the result in the output language
(pt-BR or the install-configured language).

The DS is built **once** and **separately**; the screens prompt then **consumes the inherited
DS** and never redefines it. Ask the agent for **exactly 1 template** (one base template)
here — one composed page that exercises the tokens and components end to end. Do **not** ask for a template set:
templates composed by the DS are weaker than the consuming project's own; one base template is
enough to prove the system holds together.

---

## Prompt skeleton (emit to the design agent)

> **Preamble (binding).** Build a Design System we will inherit unchanged across every screen.
> Define tokens and components **once, by semantic name**; the screens prompt will reference
> them and must never redefine colour, typography, spacing, radius, shadow or any component.
> Where a requirement is given below, it is a **measurable constraint**, never a visual
> solution — you choose the form.

### 1. Token contract (semantic, not literal)

Name tokens by **role/intent**, not by value — e.g. `surface/raised`, `text/muted`,
`action/primary`, `state/danger`, `space/inset-sm`. The consuming screens bind these names;
the literal value lives only in the DS. Cover: colour roles (incl. light **and** dark),
typographic scale, spacing scale, radii, shadows/elevation, motion durations.

### 2. Component inventory (with states)

For each component, define **every state** it can take — default, hover, focus, active,
disabled, loading, error, empty, selected — so screens never invent a missing state. List the
components the app actually needs (derived from the inventory), each by semantic role.

### 3. One base template

Produce **exactly 1 base template**: a single composed layout (e.g. an app shell with
navigation, a content region, and one representative data view) that exercises the tokens and
the component inventory together. This is the fork point the screens prompt reuses — not a
catalogue of page types.

### 4. Accessibility constraints (WCAG 2.2 — measurable, not prescriptive)

State these as **verifiable constraints**, never as a chosen visual treatment:
- Text/background contrast meets WCAG 2.2 AA (≥ 4.5:1 body, ≥ 3:1 large text).
- Focus is always visible and meets the 2.2 focus-appearance minimum.
- Hit targets meet the 2.2 target-size minimum (≥ 24×24 CSS px or equivalent spacing).
- Nothing relies on colour alone to convey state.

---

## Fill-in checklist before sending

- [ ] Tokens named by role, with light + dark, no literal values leaking into the screens layer.
- [ ] Component inventory lists every state per component.
- [ ] Exactly **1 base template** requested (not a set).
- [ ] WCAG 2.2 items phrased as measurable constraints, never as visual solutions.
- [ ] Output is in pt-BR (or the install-configured language).
