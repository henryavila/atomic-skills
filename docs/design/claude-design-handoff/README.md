# Claude Design handoff — aiDeck dashboard

Bundles exported from [claude.ai/design](https://claude.ai/design) on 2026-05-20. These are the design source-of-truth for `Phase E.T-005..E.T-007` of `docs/migration-plan-v2.md` (the React UI in `atomic-skills/src/dashboard/`).

## Contents

### `design-system/`

The early design system bundle (`pp-aj2rhnPEgQKIA-SVbEA`):

- `project/colors_and_type.css` — design tokens (colors, typography, status vocabulary)
- `project/preview/*.html` — 19+ atomic component previews (color tokens, status chips, exit-gate component, phase card, etc.)
- `project/ui_kits/dashboard/*.jsx` — first-pass screens (superseded by `screens/`)
- `chats/chat1.md` — design conversation transcript (1345 lines — reflects intent + iteration)
- `project/SKILL.md` — accompanying skill notes

### `screens/`

The finalized screens bundle (`EENh4qwc3cW4J_JgeGo8iw`):

- `project/*.jsx` — 27 JSX modules, ~9000 lines total, covering the 5 v0.1 views:
  - `HomeView.jsx`
  - `PlanView.jsx` (+ `PhaseCard`, `DepGraphOverlay`, `ReferencesModal`)
  - `InitiativeView.jsx` (+ `InitiativeHero`, `ExitGatesCard`, `TaskList`, `StackPanel`)
  - `HelpView.jsx`
  - `FeedbackDrawer.jsx` (+ `feedback-app`, `feedback-host`, `feedback-data`, `feedback-atoms`)
- `project/*.html` — runnable static previews (`Home.html`, `Plan View.html`, `Initiative View.html`, `Help.html`, `Feedback Channel.html`)
- `project/screenshots/*.png` — 10 reference renders showing default/parallel/scrolled/closed states
- `project/data.jsx` — fixture data used by the prototypes
- `chats/*.md` — 6 design conversation transcripts

## Code pattern

The prototypes use `/* global React, ReactDOM */` — React via CDN, no build step. For production conversion:

1. Replace globals with ESM imports (`import React from 'react'`).
2. Rename `.jsx` → `.tsx`; add prop types from the `data.jsx` shapes.
3. Split shared atoms into `src/dashboard/components/atoms/`.
4. Map `colors_and_type.css` tokens to Tailwind 4 via `@theme inline`.
5. Replace `data.jsx` fixtures with TanStack Query hooks against aiDeck's REST API (`/api/state/:consumer/:slug?`).

## Do NOT edit these files

These bundles are the design source-of-truth. Edits to UI behavior happen in `src/dashboard/`. Treat this directory as read-only documentation; re-export from claude.ai/design when iterating visually.
