# Chat Cleared

_Started 2026-05-20 08:54 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "aiDeck"
Current date is now May 20, 2026
</system-info>

<pasted_text name="Pasted text (64 lines)">
This is the first screen briefing. Along with designing Home, please also establish the LAYOUT SHELL that all subsequent screens will sit inside (top chrome, main content area, right-side drawer slot, optional top banner).

WHAT THIS SCREEN SERVES

Home (path /) is the user's first impression of aiDeck and the entry hub to whatever projects are detected on this machine. Demo (path /demo) is a sibling — same purpose but seeded with sample fixtures and clearly marked as a demonstration, so an evaluator never confuses it with real project state.

PERSONA AND MOMENT

A developer just ran `aideck serve` and a browser tab opened automatically. They have one or more AI skills installed locally that produce structured project data, and they want a visual surface to see where their multi-phase work is right now.

For demo: they ran `aideck demo` to evaluate the product before adopting. They've never used aiDeck before. They have 5 minutes to decide if this is worth setting up properly.

INFORMATION THAT MUST BE ACCESSIBLE

On Home:
- Which "consumers" (AI skills that produce data) are detected and their health (active, empty, errored).
- For each consumer, what plans and initiatives exist and a quick read on progress.
- Whether there's pending bidirectional traffic (unread annotations, open highlights) waiting for attention.
- For the user with zero consumers detected: setup guidance, not an intimidating empty dashboard.

On Demo (in addition to the above):
- Persistent, non-dismissible signal that this is demonstration data ("DEMO MODE — seeded fixtures, not your data. Quit (Ctrl+C) to clean.").
- Direct entry points to the demo plan, demo initiative, the skills directory, and MCP setup instructions — so an evaluator can sample everything in 3 clicks.

In the global layout shell (visible on every screen):
- Product name (links to home).
- Where the user currently is, when not on home (breadcrumb or equivalent).
- Way to reach the skills directory (Help).
- Indicator of how many open highlights exist across the whole project, clickable to open the annotation drawer filtered to them.
- A small persistent affordance for app overflow (version, demo indicator, future settings).
- A subtle, persistent trust signal indicating aiDeck is bound to 127.0.0.1 — developers care about this.
- A right-side drawer slot reserved for the annotation panel (designed in briefing 5).

INTERACTIONS THE USER MUST PERFORM

- Click any plan summary → land on its bird's-eye view.
- Click any standalone initiative → land on its zoom view.
- Click Help in the chrome → open the skills directory.
- Click the highlights indicator in the chrome → open the annotation drawer filtered to highlights.
- (Demo only) Click any of the demo entry points → land on the corresponding demo content.

SCALE AND EDGE CASES

- Most common case: one consumer with one active plan and one standalone initiative.
- Heavy case: one consumer with 3-5 plans and 10-20 initiatives — must still feel scannable.
- Empty case: no consumers detected — must be welcoming and instructive, not intimidating.
- Error case: a consumer with parse failures (schema version mismatch, malformed YAML) — must surface the problem clearly without hiding the rest.

NON-NEGOTIABLE CONSTRAINTS

- Dark-first only.
- Demo banner must remain visible across every screen while demo mode is active, not just on Home.
- No "save" or "edit" affordances on any plan or initiative summary — these surfaces are read-only projections.
- Keyboard accessible: Tab order should be logical; skip-to-content link must exist.
- The chrome's drawer slot must not overlap the main content when the drawer is closed (i.e., the closed-state width is zero, not a permanently visible sliver).

OUT OF SCOPE

- No recent-activity timeline (cross-cutting views are v0.4).
- No charts, sparklines, or gauges.
- No team/avatar UI.
- No multi-step onboarding wizard.
- No auto-redirect to /demo when demo mode is active — the banner is enough signal.
- No light-mode toggle in the overflow menu (v0.2 work).
</pasted_text>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Hi-fi design">
Create a high-fidelity, polished design. Follow the instructions about design in your system prompt, particularly the 'How to do design work' section. Use the design_canvas starter component, or make a full-bleed prototype and offer options via Tweaks.
</attached-skill>

<attached-skill name="Interactive prototype">
Create a fully interactive prototype with realistic state management and transitions. Use React useState/useEffect for dynamic behavior. Include hover states, click interactions, form validation, animated transitions, and multi-step navigation flows. It should feel like a real working app, not a static mockup.
</attached-skill>

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

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

The brief is thorough and the existing dashboard UI kit gives me strong design vocabulary to extend. I'll proceed directly with build — exposing the edge cases (empty, heavy, error, demo) via Tweaks so you can A/B them all in one file. I'll lay out my assumptions inline in the prototype so you can challenge any of them.

_[tool: copy_files]_

Now let me write the home-specific data fixtures, layout shell, home view, and app shell.

_[tool: write_file]_

_[tool: write_file]_

Now the HomeView — this is the heart of the design. I'll make consumer cards with nested plans + initiatives, plus the four state variants.

_[tool: write_file]_

Now let me look at the tweaks-panel API briefly and write the app shell.

_[tool: grep]_

Now the app shell + index.html.

_[tool: write_file]_

_[tool: write_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Home is up with the layout shell that all subsequent screens will sit inside.

**What's in the file:**
- **`LayoutShell`** — DemoBanner (above chrome) + 52px TopChrome (wordmark, breadcrumb, ⌘K palette, localhost pill, Help/Highlights/Menu) + skip-to-content link + `<main>` + a right-side drawer slot that's truly zero-width when closed.
- **`HomeView`** — consumer bands, each holding plan summary cards (with phase pips, mini progress, unread/highlight badges) and a denser strip of standalone initiatives. Page header shifts copy by state.
- **Five scenarios** switchable via Tweaks: typical / heavy / multi-consumer / empty (with three setup paths) / errored (parse failures surface inline without hiding the rest).
- **Demo mode** toggle — banner sticks across screens, "EVALUATOR FAST-PATH" card appears with the 4 demo entry points, menu shows a demo affordance.

**Assumptions worth challenging:**
- Treated `/demo` as `/home + demoMode=true` rather than a separate route (the chrome is identical and the brief says "sibling, same purpose").
- Made the highlights chrome badge tint red when any critical highlight exists — read at a glance for "human should look".
- Phase pips compress 9 phases into a tight strip; if you need exact counts there I can swap to a `done/active/pending` numeric.
- Plan cards include a left-edge accent (status-active or status-blocked) matching the existing `PhaseCard` pattern.

**Next briefing slots in cleanly:** the placeholder views for `/plans/<slug>`, `/initiatives/<slug>`, and `/help` already wire up through the shell's breadcrumb + nav.

## User

Verifier agent check completed

## Assistant

Verifier passed across all five scenarios + demo mode. Shell is solid and ready for the next briefing to slot into.

## User

/clear

