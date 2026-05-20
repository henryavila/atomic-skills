# Chat

_Started 2026-05-20 11:50 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "aiDeck"
Current date is now May 20, 2026
</system-info>

<pasted_text name="Pasted text (61 lines)">
WHAT THIS SCREEN SERVES

The bidirectional human ↔ AI feedback channel. It has two presences:

(a) A side drawer that lists every annotation and highlight that has accumulated, filterable and resolvable. Available from any screen.

(b) Inline indicators (badges) that appear on any entity (a phase, a task, an exit gate) that has accumulated annotations or highlights — so the user notices flagged work without opening the drawer.

This is the surface through which a human flags a task ("question this query — likely expensive on 50M rows") and the AI reads it later via MCP; and through which the AI flags a drift ("currentPhase is F0 but you wrote to F3 paths") and the human sees it in real time.

PERSONA AND MOMENT

(a) A user reviewing the plan or initiative sees a badge inline next to a task and clicks to read what was flagged. They may resolve the annotation (mark it addressed) or acknowledge a highlight (mark it seen and acted on).

(b) A user wanting to triage all open feedback opens the drawer from the chrome and scans by target / severity / author.

(c) The AI, via MCP, adds an annotation or highlight while working — the user, with the drawer open or any plan/initiative view active, sees the entry materialize in under 200ms.

INFORMATION THAT MUST BE ACCESSIBLE

In the drawer:
- All annotations and highlights, grouped by their target (a specific entity).
- For each annotation: author (human or AI), age, body text, resolved state.
- For each highlight: severity (info / warn / critical), reason, source (human or AI), acknowledged state.
- Filter controls: by target, by author (human / AI), by resolved state for annotations; by severity for highlights.

Inline on entity surfaces:
- A small badge next to the entity's title or id indicating how many active items are attached, colored by the highest severity present.
- Hovering the badge reveals the first reason (or "N items — click to see details" when N > 1).

INTERACTIONS THE USER MUST PERFORM

- Open and close the drawer from the chrome (and via a keyboard shortcut — pick a reasonable one consistent with developer tools).
- Filter the drawer's contents live.
- Click "Resolve" on an annotation → the entry transitions to a resolved state visually; the system appends a Resolution record (not a mutation of the original line — both records coexist).
- Click "Acknowledge" on a highlight → similar behavior with an Acknowledgement record. The inline badge count decrements.
- Click an inline badge anywhere → the drawer opens filtered to that target.

SCALE AND EDGE CASES

- A target with no items has no badge (avoid visual noise).
- A target with multiple items at different severities — badge shows the highest severity but tooltip indicates the count.
- A target that was deleted but still has annotations referencing it ("orphan target") — must be surfaced in the drawer with a clear orphan indicator, not silently filtered out.
- 100+ items total — render the first 100 + a "showing 100 of N" footer (virtualization is deferred to v0.2).
- An annotation by AI that contains code blocks in its body — render the markdown.

NON-NEGOTIABLE CONSTRAINTS

- Append-only persistence. The UI must not present "resolve" as a destructive action — both the original annotation and the resolution coexist on disk. Framing should be "mark resolved" not "delete".
- SSE-driven updates land in under 200ms from server emit to DOM paint. Test by posting via curl with the drawer open.
- The drawer must not steal focus from the main content unless explicitly opened.
- Keyboard accessible: Esc closes, Tab navigates within the drawer logically.
- The inline badge must not push other content around when it appears/disappears — reserve space or use absolute positioning so layout doesn't shift.

OUT OF SCOPE

- Inline editing of an annotation body after creation.
- Decisions ("approve / reject / block / defer") — these exist in the data model but are not visualized in v0.1.
- Threading replies to an annotation.
- @mentions, user tagging.
- Persisting drawer open/closed state across page loads.
</pasted_text>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="aiDeck Design System (design system)">
[Design System] This project uses the **aiDeck Design System** design system. This is a binding choice for visual style — every visual must follow it. Don't invent colors, type, spacing, or components not grounded here.

Scope: the design system is a visual style reference only. Its guide may describe example products, brands, or people that are unrelated to the user and unrelated to the subject of this conversation. Never treat anything in the design system as a fact about the user, their work, or the topic they asked about.

    Explore it to find what you need:
    - Always copy out the fonts and colors you need
    - For prototypes and designs, always copy out any relevant components
    - If the design system contains existing mocks of products, and you were asked to design or prototype something similar, copy and fork those mocks to start your design. This helps you make high-quality designs.
    
    Explore it quickly to find relevant UI kits (e.g. mocks of existing products you can copy and fork)

Full system at `/projects/9ef1e68c-ed08-408f-bfcc-30062532851a/`. Its guide is reproduced below so you don't need to fetch it:

<design-system-guide>
# aiDeck Design System

> Dark-first design language for **aiDeck** — an AI-native local dashboard
> runtime that projects structured project data from local files onto three
> surfaces: a Vue 3 dashboard, a REST + SSE HTTP API, and an MCP server for
> AI agents.

## What aiDeck is

aiDeck reads YAML + Markdown that AI skills write to a local
`.atomic-skills/` directory and renders it as a live visual surface — for
the developer in their browser, and (via MCP) for the AI agent in their
IDE. It binds to `127.0.0.1:7777`, ships zero telemetry, MIT-licensed.

**Primary audience.** A solo developer running multi-phase projects
alongside AI agents in a terminal-heavy IDE (Claude Code, Cursor). Dense
information is a feature, not a problem to be solved with whitespace.

**Secondary audience.** The AI agent itself, which reads the same surface
via the MCP server. Both must be served equally well.

**Reference test target.** A real plan with **9 phases × 8 tracks ×
~60 sub-phases × ~30 cross-document references** rendered on a 13″ laptop
without horizontal scroll, truncation, or pagination tricks. The design
system is calibrated to that constraint, not to demo screenshots.

## Sources

This system is derived from these primary materials. The reader is
encouraged to explore them directly:

- **GitHub** — `henryavila/aideck` ·
  <https://github.com/henryavila/aideck>
  - `docs/why.md` — the load-bearing context for the entire product
  - `docs/feature-contracts.md` — F1–F13 with verifiable success gates
  - `docs/ui-layouts.md` — ASCII wireframes + the original color token table
  - `docs/canonical-data-pattern.md` — "files are canonical" architecture
  - `src/schemas/common.ts`, `src/schemas/project-status.ts` — canonical shapes
  - `docs/implementation/10-vue-foundation.md` … `14-annotations-highlights.md`
    — the dev sequencing that maps screens to implementation
- A subset of these files is cached in [`docs/`](./docs) and [`src/`](./src)
  for reference; the GitHub repo is the source of truth.

## Repository index

```
README.md                       — this file
SKILL.md                        — Agent Skill metadata (drop into Claude Code)
colors_and_type.css             — all design tokens + semantic type presets
assets/
  wordmark.svg                  — primary wordmark
  wordmark-mono.svg             — mono-cursor wordmark variant
fonts/                          — webfonts are loaded from Google Fonts CDN
preview/                        — design-system specimen cards (Design tab)
ui_kits/
  dashboard/                    — high-fidelity dashboard recreation
    index.html                  — entry; open in browser
    README.md                   — kit notes
    atoms.jsx                   — primitive components
    PlanView.jsx                — bird's-eye view
    InitiativeView.jsx          — zoom view
    HelpView.jsx                — skills directory
    AnnotationPanel.jsx         — right-side drawer
    TopChrome.jsx, DemoBanner.jsx, data.jsx, app.jsx
docs/                           — cached aiDeck product docs (read-only)
src/                            — cached canonical TypeScript schemas
```

---

## Content fundamentals

aiDeck's copy reads like documentation written by an engineer for themself.
It's plain, terse, and respects the audience's time.

**Voice.**
- **First person plural for shared rules** ("we'll never write to entity
  files"), **second person for actions** ("Open narrative", "Resolve").
- Never marketing-speak. No exclamation marks. No "amazing", "delightful",
  "powerful". The product earns trust by being correct, not enthusiastic.
- Lowercase headings inside dense UI rows (`audience: developer`,
  `current: F0`). Sentence case for titles. Snake-case or kebab-case for
  any identifier the user might paste somewhere.
- Direct, terse error messages with a structured `suggestion` field — the
  schema literally requires it (`ErrorResponse.suggestion`).

**Tone in chrome.**
- ⚠ amber for demo mode (not red — the system is still safe).
- Critical red is reserved for highlights only; never decorative.
- Status words appear inline next to glyphs — never "status: 3 of 8
  complete" but `3/8 tasks · 0/3 gates met`.

**Examples lifted from real product copy.**

> "Files are canonical. aiDeck never owns state — it projects from files
> and gets out of the way."

> "If the spec is ambiguous, ask the user before implementing your
> interpretation. A short clarifying message beats two days of rework."

> "DEMO MODE — seeded fixtures, not your data. Quit (Ctrl+C) to clean."

> "Need to verify unicode normalization for emoji edge cases. Suggest
> adding a fixture with U+1F3F4 and ZWJ sequences before claiming exit
> gate G2 is met."

**Casing rules.**
- View headings: Title Case ("Foundation Repair", "Skills").
- Section eyebrows: UPPERCASE letter-spaced ("TRACK A — DADOS",
  "EXIT GATES").
- Status states: lowercase ("done", "active", "pending", "blocked",
  "parked", "emerged", "highlighted").
- IDs: kebab-case slugs (`v3-f0-foundation-repair`), uppercase phase ids
  (`F0`, `T-002`, `F0-G1`).

**No emoji as product chrome.** A small set of Unicode glyphs (✓ ◉ · ⊘ ⌂
⇥ ⚑ ⌬ ▾ ▸ ≡) carries iconic load. Real emoji appear only inside
user-authored content (annotations, principle bodies). The 📋 clipboard
icon in skill cards is a controversial exception — flag for review.

**Vibe.** "GitHub DevTools meets a flight recorder." The product
acknowledges the user is doing serious, possibly painful work, and the
interface stays out of the way.

---

## Visual foundations

### Surfaces

Five dark levels stack from `--bg-sunken` (#090c10) through
`--bg-canvas` (#0d1117) — the page background — up to `--bg-overlay`
(#262d36) for the deepest nested cards. Elevation is expressed by
**surface step + 1 px hairline**, not by drop shadows. Shadows exist
(`--shadow-sm/md/lg`) but are reserved for layers floating over a canvas
that isn't directly underneath: menus, popovers, modals.

### Colors

The palette is a slightly-extended GitHub Dark. Three vocabularies
exist as canonical token sets — each subsequent screen briefing should
reference them by name rather than re-specifying:

- **Status** (state of plans / phases / tasks): `--status-done`,
  `--status-active`, `--status-pending`, `--status-blocked`,
  `--status-parked`, `--status-emerged`, `--status-highlighted`.
- **Severity** (loudness of a highlight): `--severity-info`,
  `--severity-warn`, `--severity-critical`. **Critical red is reserved.**
- **Verifier kinds** (exit-gate check type): `--verifier-shell`,
  `--verifier-query`, `--verifier-test`, `--verifier-manual`.

Every status pairs a hue with a redundant Unicode glyph so colorblind
users never depend on hue alone.

### Type

- **Sans · Geist** (Google Fonts) — UI, narrative body. Weights 300–700.
- **Mono · Geist Mono** (Google Fonts) — identifiers, paths, commands,
  exit-gate verifiers, IDs, code blocks. Ligatures disabled
  (`font-feature-settings: "calt" 0`) because developers want to see
  exactly what's there.

**Substitution flag.** The aiDeck repo does not specify a font stack;
Geist + Geist Mono are a tasteful default for a developer-tools product
(both are open-source and made by Vercel for this exact context). If the
brand requires a different family — IBM Plex, Söhne, JetBrains, Berkeley
Mono — swap the `--font-sans` / `--font-mono` variables and re-import.

The scale is dense — base body is **13–14 px**, view headers 24 px, page
titles 28–32 px. This is intentional: the audience reads dense data and
prefers more rows over taller rows.

### Spacing

A **4 px base** scale (`--space-1` … `--space-32`) tuned so a 9-phase
plan with 6 tracks fits the visible fold of a 13″ laptop. Row padding in
dense tables is **6–8 px**, not the 12–16 px you'd see on a marketing
page. Card padding is **12–16 px**.

### Radii

Modest: `--radius-xs: 2px` through `--radius-xl: 12px`. The default for
cards and buttons is **6 px**. `--radius-pill: 999px` is reserved for
status chips. This is DevTools — not pillows.

### Borders

Three weights — `--border-subtle` (#21262d) for inner dividers,
`--border-default` (#30363d) for cards and primary outlines,
`--border-strong` (#4a525c) for focus. **All hairlines are 1 px.**

### Backgrounds and imagery

- **No full-bleed photography.** The product is a tracker — imagery
  would be costume.
- **No illustrated empty states.** Terse text wins ("(empty)",
  "No annotations match this filter.").
- **No gradients in product chrome.** A subtle inner-highlight on
  elevated surfaces (`inset 0 1px 0 rgba(255,255,255,0.045)`) is the
  closest thing.
- **No photographic textures, no patterns from stock libraries.**
- The only ambient color is the cyan square in the wordmark — it
  doubles as the "runtime live" indicator.

### Textures (interaction signals)

aiDeck has **three canonical textures**, each one a vocabulary atom —
not decoration. Same texture, same meaning, every screen.

| Token              | Pattern                              | Means                              |
| ------------------ | ------------------------------------ | ---------------------------------- |
| `--texture-grid`   | Radial dots, 24 px grid, ~10% white  | Structural canvas — "files are atoms" |
| `--texture-scan`   | Horizontal 1 px lines, 3 px gap      | "This is running, expect updates"  |
| `--texture-drift`  | Diagonal 45° stripes, critical tint  | "Drift detected — a human should look" |

The `grid` is the default canvas background — it gives the dashboard
its engineered, graph-paper feel. `scan` overlays the active phase
card with a slow vertical sweep animation. `drift` pulses over a
critical highlight when it first appears, then settles to a steady
warning pattern.

All three respect `prefers-reduced-motion` (the scan animation stops;
the drift pulse runs once and freezes).

A grain alternative (`--texture-grain`, SVG `feTurbulence`) is
available but **not** default — it's there for moments where the
graph-paper grid would compete with content density (e.g. screenshots
for marketing).

### Animation

- Hover and focus transitions: **120 ms**, `cubic-bezier(0.16, 1, 0.3, 1)`.
- Panel slide-in (annotations drawer): **200 ms** same easing.
- **No entrance animations on initial page load.** Information should be
  legible immediately.
- **No bounces, springs, parallax.** This is a cockpit.

### States

- **Hover** on cards: surface steps up one level (`bg-surface` →
  `bg-elevated`). Borders, type unchanged.
- **Active / pressed**: 1 px stronger border, no size change.
- **Focus-visible**: `--shadow-focus` — 2 px canvas-colored padding +
  2 px cyan ring. Always visible against dark surfaces.
- **Disabled**: text drops to `--fg-faint`, border to `--border-subtle`,
  cursor `not-allowed`. No grayscale filter.

### Cards

- 1 px `--border-default` outline.
- `--radius-md` (6 px) corner radius.
- No drop shadow at rest.
- Active-phase cards get a **3 px left-edge** in `--status-active` —
  this is the only color accent on the card body, drawing the eye to
  what's currently HERE.

### Layout

- Top chrome is **48 px** fixed height; persistent across views.
- A right-side **annotation drawer** (~360 px) toggleable, never modal.
- Main content area max-width **1200 px**, centered. Beyond that the
  density premium diminishes.
- **No bottom bar, no floating action button.** All actions live in
  context.

### Transparency, blur

- `color-mix(in srgb, <accent> X%, transparent)` is the primary tool for
  tinted backgrounds — alpha is computed against the underlying surface
  rather than the canvas, so chips read correctly when nested.
- **No `backdrop-filter: blur`.** That's macOS-window aesthetic; it
  doesn't survive at small screen sizes and adds GPU cost for no signal.

---

## Iconography

aiDeck's icon system is, intentionally, three layers in priority order:

1. **Unicode glyphs first.** A small fixed vocabulary carries the most
   load: `✓ ◉ · ⊘ ⌂ ⇥ ⚑` for status, `? ≡ ⌬ ▸ ▾ × → ↗` for chrome,
   `$_ SQL ✓✓ 👁` (as text) for verifier kinds. These render identically
   in terminal, browser, and a dump of the rendered DOM to plain text —
   which matters because the AI agent reads the same surface.
2. **Lucide (CDN) for everything else.** The site needs a handful of
   "real" icons for things Unicode can't express tastefully — file,
   terminal, link, external-link, copy, search. We pull
   [Lucide](https://lucide.dev) from CDN: 1.5 px stroke, `currentColor`,
   matches the type weight at 14 px. *Substitution flagged — the
   aiDeck repo does not pin an icon library; Lucide is a defensible
   default for dev-tools and is what most comparable products use.*
3. **Custom SVG: never.** If a concept requires a unique illustration,
   it's probably the wrong concept.

**No emoji in product chrome.** Emoji that appears inside user-authored
annotations is rendered as plain text — never substituted with sprite art.

**Logos.** A typographic wordmark (`assets/wordmark.svg`) and a
mono-cursor variant (`assets/wordmark-mono.svg`). The cyan square is the
only graphic mark and pulls double duty as the runtime-live indicator.

---

## Status vocabulary (canonical atoms)

Subsequent screen briefings should reference these by token name rather
than re-specifying hue.

| State          | Glyph | Token                 | Hex     | Meaning                              |
| -------------- | :---: | --------------------- | ------- | ------------------------------------ |
| done           |  ✓   | `--status-done`        | #56d364 | Closed, met, complete                |
| active         |  ◉   | `--status-active`      | #58a6ff | Currently HERE                       |
| pending        |  ·   | `--status-pending`     | #8b949e | Not yet started                      |
| blocked        |  ⊘   | `--status-blocked`     | #d29922 | Waiting on a dependency              |
| parked         |  ⌂   | `--status-parked`      | #db61a2 | Surfaced, deliberately paused        |
| emerged        |  ⇥   | `--status-emerged`     | #a371f7 | Newly surfaced candidate             |
| highlighted    |  ⚑   | `--status-highlighted` | #f5d76e | Has an open flag                     |

| Severity   | Token                  | Use                                     |
| ---------- | ---------------------- | --------------------------------------- |
| info       | `--severity-info`      | FYI flags                               |
| warn       | `--severity-warn`      | "Look at this when convenient"          |
| critical   | `--severity-critical`  | **Reserved.** Highlights only — never decorative. |

| Verifier   | Glyph | Token                  | Use                                |
| ---------- | :---: | ---------------------- | ---------------------------------- |
| shell      |  $_   | `--verifier-shell`     | Bash command, exit code 0         |
| query      |  SQL  | `--verifier-query`     | SQL row-count check               |
| test       |  ✓✓   | `--verifier-test`      | Test pattern (vitest, phpunit, …) |
| manual     |  👁    | `--verifier-manual`    | Human visual sign-off             |

---

## How to use this system

- For a **new screen brief**, start by reading [`docs/ui-layouts.md`](./docs/ui-layouts.md)
  and the section of [`docs/feature-contracts.md`](./docs/feature-contracts.md) the
  screen belongs to. Then open the relevant preview card and the UI kit.
- For **production Vue code**, copy the CSS variables from
  `colors_and_type.css` into `src/client/styles/theme.css`. Match
  variable names exactly — Vue components reference these.
- For **a throwaway mock or prototype**, copy the dashboard UI kit
  wholesale and reskin the data.
- For **a slide deck or marketing piece** — wait. v0.1 is internal /
  developer-facing only. Discuss before designing.

## Caveats & open questions

- Fonts are a tasteful default, not a brand decision. If the project
  prefers IBM Plex or another open-source pair, swap variables.
- The Lucide CDN dependency is a stop-gap. If we ship to production, we
  should self-host the subset we actually use.
- The dashboard UI kit is **cosmetic** — components are intentionally
  reimplemented in React for portability. The production app is Vue 3.
- Light theme is explicitly **out of scope for v0.1**. Tokens here are
  dark-only.

</design-system-guide>

CSS tokens: the guide may describe tokens in prose, but the exact `--*` names are defined in the design system's stylesheet(s) (`/projects/9ef1e68c-ed08-408f-bfcc-30062532851a/colors_and_type.css`, `/projects/9ef1e68c-ed08-408f-bfcc-30062532851a/preview/_card.css`). The 112 custom properties it defines are:

--accent-focus, --accent-link, --accent-primary, --bg-canvas, --bg-elevated, --bg-highlight, --bg-overlay, --bg-sunken, --bg-surface, --border-bright, --border-default, --border-strong, --border-subtle, --border-width, --duration-fast, --duration-normal, --duration-slow, --ease-in-out, --ease-out, --fg-default, --fg-faint, --fg-muted, --fg-on-accent, --fg-subtle, --font-display, --font-mono, --font-sans, --fs-2xl, --fs-2xs, --fs-3xl, --fs-4xl, --fs-5xl, --fs-base, --fs-lg, --fs-md, --fs-sm, --fs-xl, --fs-xs, --fw-bold, --fw-light, --fw-medium, --fw-regular, --fw-semibold, --highlight-inset, --highlight-inset-strong, --lh-normal, --lh-relaxed, --lh-snug, --lh-tight, --radius-lg, --radius-md, --radius-none, --radius-pill, --radius-sm, --radius-xl, --radius-xs, --severity-critical, --severity-critical-bg, --severity-info, --severity-info-bg, --severity-warn, --severity-warn-bg, --shadow-ambient, --shadow-focus, --shadow-glow-active, --shadow-lg, --shadow-md, --shadow-none, --shadow-sm, --space-0, --space-1, --space-10, --space-12, --space-14, --space-16, --space-2, --space-20, --space-24, --space-3, --space-32, --space-4, --space-5, --space-6, --space-7, --space-8, --status-active, --status-active-bg, --status-blocked, --status-blocked-bg, --status-done, --status-done-bg, --status-emerged, --status-emerged-bg, --status-highlighted, --status-highlighted-bg, --status-parked, --status-parked-bg, --status-pending, --status-pending-bg, --texture-drift, --texture-grain, --texture-grid, --texture-grid-size, --texture-scan, --tracking-normal, --tracking-tight, --tracking-wide, --tracking-wider, --verifier-manual, --verifier-query, --verifier-shell, --verifier-test

Only use `var(--*)` names from that list. Never guess a token name — an unresolved `var()` silently falls back to the browser default.

For assets and UI kits beyond the guide: `read_file("/projects/9ef1e68c-ed08-408f-bfcc-30062532851a/<path>")` and `copy_files` to bring them into the current project.
</attached-skill>

## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

I have enough context. Let me set up the project structure and build the screen.

_[tool: copy_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

I have full context now. The project already has `FeedbackDrawer`, `feedback-atoms`, and `feedback-data` built but no HTML page that wires them together. Let me build the dedicated feedback-channel screen.

_[tool: grep]_

_[tool: write_file]_

Now I'll build a focused host backdrop and wire everything together.

_[tool: write_file]_

_[tool: write_file]_

_[tool: show_html]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Built **Feedback Channel.html** — wires the existing `FeedbackDrawer` + `feedback-atoms` (InlineBadge) into a focused host backdrop showing the F0 Foundation Repair initiative.

What's in it:
- **Drawer (right, 420px)** — filters by kind / author / severity, target-grouped with orphan target pinned to top, resolved/acknowledged actions inline, "showing 100 of N" footer (toggle bulk-volume to demo).
- **Inline badges** — sit on the phase rail (F-2…F6), exit gates, tasks, and the initiative title. Click any badge → drawer opens filtered to that target. Reserved layout slots so badges don't shift content.
- **Variant gallery** below the host (whisper / standard / loud).
- **Live SSE simulator** — agent items auto-inject every 9-15s with a fresh-highlight fade; manual "simulate agent post" button in the demo strip.
- **Keyboard** — `⌘\` toggles the drawer (matches the footer hint), `Esc` closes.
- **Tweaks** — density, badge variant, group-by, show resolved, hide orphans, bulk volume, live stream.

Next steps you may want: pull the AnnotationPanel out of `Initiative View.html` and swap in `FeedbackDrawer` so the drawer is consistent everywhere; decide whether `loud` variant earns its row real estate or only belongs in cramped spots.

