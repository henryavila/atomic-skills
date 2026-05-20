# aiDeck — Dashboard UI Kit

A pixel-fidelity recreation of the v0.1 dashboard surface described in
[`docs/ui-layouts.md`](../../docs/ui-layouts.md). It does **not** ship real
parsers, SSE, or MCP — it stands in for those with seeded fixtures so the
visual + interaction language is concrete enough to design against.

The production app is Vue 3 + Pinia + Hono; this kit is React + inline Babel
so it can run in a single static HTML file. The components are intentionally
**cosmetic** — the layout, density, and visual vocabulary are the contribution,
not the implementation.

## Run it

Open `index.html` in any modern browser. No build step.

## Files

- `index.html`      — entry; loads React + Babel + all `.jsx` files.
- `data.jsx`        — sample plan / initiative / skills / annotations / highlights,
                       modeled on the sda-v2 v3-redesign reference (9 phases, 8 tracks).
- `atoms.jsx`       — `StatusGlyph`, `StatusChip`, `TagChip`, `HighlightBadge`,
                       `VerifierBadge`, `Btn`, `IconBtn`, `Card`, `SectionHeader`,
                       `Kbd`, `LocalhostPill`, `Wordmark`.
- `TopChrome.jsx`   — app bar: logo, breadcrumb, 127.0.0.1 indicator, chrome buttons.
- `DemoBanner.jsx`  — amber strip that flags demo-mode.
- `PlanView.jsx`    — bird's-eye view: header, principles/glossary, phase tree by track.
- `InitiativeView.jsx` — zoom view: header, exit gates, stack, tasks, parked/emerged,
                       references, narrative body.
- `HelpView.jsx`    — atomic-skills directory: searchable, filterable, with copy-slash-cmd.
- `AnnotationPanel.jsx` — right-side drawer with human/ai/resolved filters.
- `app.jsx`         — minimal client-side router (plan / initiative / help) + panel state.

## What's covered vs. what's stubbed

**Covered (visual + interactive):**
- All seven status states with redundant glyph+color.
- Three severity levels with `critical` reserved.
- Four verifier kinds badged distinctly.
- Track-grouped phase tree with parallelism marker.
- Task table with HERE highlight, expand-to-detail, blocked-by chips.
- Exit gate list with verifier kind + command preview.
- Annotation drawer that filters by author.
- Help grid with active-in-repo state.
- Breadcrumb-as-path navigation.
- 127.0.0.1 pill as persistent trust signal.
- Dark theme only (matches v0.1 scope).

**Stubbed (deliberate):**
- No real parser, no SSE, no MCP — fixtures only.
- Dependency graph overlay (`⌬`) is a button stub.
- Settings menu (`≡`) opens nothing.
- Markdown body is hand-formatted in JSX, not a real renderer.
- Print/copy slash-command doesn't actually copy.

## Visual references

Every visual decision traces back to either:
1. **`docs/ui-layouts.md`** — wireframes + color token table (load-bearing).
2. **`docs/why.md`** — anti-goals: no estimates, no charts, no presence indicators.
3. **`src/schemas/project-status.ts`** — the data shapes that render.

If you're extending this kit, start by reading those three.
