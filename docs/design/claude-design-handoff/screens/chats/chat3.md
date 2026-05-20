# Revisão Final

_Started 2026-05-20 10:33 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "aiDeck"
User is viewing file: Plan View.html
Current date is now May 20, 2026
</system-info>

<pasted_text name="Pasted text (52 lines)">
WHAT THIS SCREEN SERVES

A single Initiative — typically one phase of a Plan — at full detail. While the Plan view answers "where am I in the project as a whole?", the Initiative view answers "what exactly do I need to do inside this phase?". It is the working screen — where a developer or AI agent spends actual time.

PERSONA AND MOMENT

A developer who has identified the active phase and now needs the granular task list, blockers, and references. Or an AI agent that just connected via MCP and is preparing to execute work — it needs to see the task list, what's blocked, what's pending, and the exit criteria.

INFORMATION THAT MUST BE ACCESSIBLE

- Identification + context: where this initiative sits in the parent plan (which phase, which slot of how many), or marker that it's standalone.
- Goal in one or two sentences.
- Lifecycle metadata: status, started, last updated, branch, scope (file paths the work touches), and a single-line "next action" pointer.
- Exit gates: criteria that must be met to close this initiative, each with its verifier (a shell command, SQL query, test pattern, or manual checklist item). Met gates need evidence; deferred gates need a reason.
- Stack of in-progress work: a small hierarchical state showing where attention currently is (a task vs. a side-investigation vs. a validation vs. a discussion). The top of the stack is "HERE".
- Task list: every sub-phase task with id, title, status, last update, tags, and ability to drill into description / outputs / verifier / blockers.
- Side findings: items "parked" (deferred for later within this initiative) and items "emerged" (candidates that should become new initiatives).
- References: pointers to other docs (PRDs, runbooks, external repos) the work depends on.
- Cross-task references: when a task in this initiative unblocks, depends on, extends, or merely references a task in another initiative — these must be navigable links, not just text.
- Markdown body: free-form rationale and decision log written by humans during execution.
- Existing highlights and annotations on any entity inside this initiative (task, exit gate, the initiative itself) — visible inline.

INTERACTIONS THE USER MUST PERFORM

- Expand any task row to see description, outputs, verifier preview, and blocked-by chain.
- Click a blocked-by chip to jump to that prerequisite task (which may be in this initiative or another).
- Click a cross-task reference to navigate to the target task in the target initiative, with that task scrolled into view and expanded.
- For shell-verifiable exit gates: trigger a verifier run (this records an intent — not a direct mutation; the actual file change is performed by the consumer skill outside aiDeck).
- See annotation highlights inline on any entity (badge appears next to the entity's identifier), click the badge to open the annotation drawer filtered to that entity.
- Direct URL navigation to a specific task via hash (e.g. /initiatives/v3-f0-foundation-repair#task-T-005 should land on T-005 with the row expanded).

SCALE AND EDGE CASES

- Calibration: up to 12 tasks per initiative, with up to 3 tags per task, with bodies of 200+ lines of markdown.
- Edge: standalone initiative (no parent plan) — header collapses gracefully.
- Edge: initiative with no parked/emerged items — those panels should still be present but visually quiet, not absent.
- Edge: initiative with no body — markdown section disappears.
- Edge: a task that is blocked by a task in another initiative — chip should still be clickable, and should signal cross-initiative navigation visually.

NON-NEGOTIABLE CONSTRAINTS

- Read-only on entity files. Buttons that look like "mark done" or "advance phase" are RECORDING AN INTENT — they enqueue a request to the consumer skill (via MCP) which then applies the change to the file. Framing in the UI should not promise "saved" — it should signal "requested" / "queued".
- Status vocabulary and verifier kinds use the same tokens as elsewhere — visual transfer matters.
- A task body can be hundreds of lines; the screen must not lock vertical scroll on it.
- Expanded task state must persist across re-renders (e.g. SSE-driven updates shouldn't collapse open tasks).

OUT OF SCOPE

- Drag-to-reorder tasks.
- Inline text editing of any field.
- "Add task" UI controls (in v0.1, task creation happens via MCP from the AI side, not from the dashboard).
- A separate page for verifier output history — show last result inline.
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

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: update_todos]_

Now I have enough context. Let me plan and build.

_[tool: write_file]_

Now the InitiativeHero — header with phase position, lifecycle meta, goal, next-action callout:

_[tool: write_file]_

Now ExitGatesCard with verifier-run intent:

_[tool: write_file]_

Now the StackPanel — depth-of-attention visualization:

_[tool: write_file]_

Now the TaskList — the largest component, with expansion, blocked-by chains, cross-task refs:

_[tool: write_file]_

Now SidePanels (Parked, Emerged, References) and the markdown body renderer:

_[tool: write_file]_

Now compose the InitiativeView:

_[tool: write_file]_

Now the App and the HTML entry. Let me check the AnnotationPanel signature:

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: write_file]_

Now the HTML shell:

_[tool: write_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

`ref` is a reserved prop in React — it won't pass through. Let me fix:

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

Built **Initiative View.html** — the zoom view for a single phase. Forking off `Plan View.html`'s shell (top chrome, annotation drawer, design tokens).

**What's there:**
- **Hero** — phase ID block + stepper showing slot N of 9, status/branch/started/updated meta strip, scope chips, and a prominent "Next Action" callout that jumps to the row.
- **Exit gates** — verifier kind + command preview, last-run result inline (✓/✗ exit code), "request run" button that flips to `queued · intent written` (per the read-only constraint — never promises "saved"). Deferred gates show their reason inline.
- **Stack of attention** — tree-drawn hierarchy with typed frames (task/validation/investigation/discussion). Top is "HERE".
- **Tasks** — expandable rows with description, outputs, verifier preview, blocked-by chain. Cross-initiative blockers carry a distinct emerged-purple chip with `↗` + target slug. Expansion state persists across re-renders.
- **Parked / Emerged** — 2-col grid, quiet diagonal-hatched placeholder when empty (not absent).
- **References** — grouped by in-project / external / gitignored with state badges.
- **Narrative body** — full markdown render, no scroll cap.
- **Annotation badges** (⚑n) inline next to entity IDs; click → opens drawer.
- **Hash nav** — `#task-T-005` expands and scrolls to that row.

**Tweaks** cycle between four fixtures: F0 active (default), F-1 done (shows Outputs + closure summary instead of Stack), standalone (no parent plan — header collapses), and quiet (no body, no parked/emerged). Plus a hash-nav quick-jump per task.

## User

fico ótimo. faça uma revisão final e finalize

## Assistant

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: str_replace_edit]_

I see some narrow-width layout issues. Let me fix the wraps:Now the NextActionStrip — keep ID + title in a no-wrap row with title ellipsis, and prevent "Jump to row" from wrapping:

_[tool: str_replace_edit]_

Now the SectionHeader (atoms.jsx) — prevent the eyebrow from wrapping:

_[tool: str_replace_edit]_

Now the ExitGate last-run line — keep "last run · exit N · time" on one line, and let it wrap as a unit:

_[tool: str_replace_edit]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

Looks clean now. Let me scroll down to verify the rest:

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: done]_

Clean run. Polish complete:

- **Eyebrow row** — phase position, stepper, and track now stay grouped (no mid-phrase wraps)
- **Next-action strip** — `T-002` ID + title kept together with ellipsis fallback; "Jump to row" no longer wraps
- **Exit-gate header & last-run pill** — single line, no awkward breaks
- **Section eyebrows** — `whiteSpace: nowrap` everywhereFinalizado. **Initiative View.html** está pronto, cobrindo todos os pontos do brief — hero com posição na plan + stepper, exit gates com verifier-run intent ("request run" → "queued · intent written"), stack tipado (task / validation / investigation / discussion) com tree-drawing, tasks com expand / blocked-by chains / cross-init chips, parked + emerged sempre visíveis (placeholder hachurado quando vazio), refs agrupados por estado (in-project / external / gitignored), markdown body sem cap, badges ⚑ inline em entidades, e hash nav `#task-T-005`. Quatro fixtures pelos Tweaks: F0 active, F-1 done (Outputs + closure summary substituem o Stack), standalone (header colapsa, sem stepper / plan / track) e quiet (sem body, sem parked/emerged).

