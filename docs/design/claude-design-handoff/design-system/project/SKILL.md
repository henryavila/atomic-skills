---
name: aideck-design
description: Use this skill to generate well-branded interfaces and assets for aiDeck — the AI-native local dashboard runtime — either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the Vue 3 dashboard, MCP-adjacent tooling, or supporting material.
user-invocable: true
---

# aiDeck Design Skill

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy
assets out and create static HTML files for the user to view. If working on
production code, you can copy assets and read the rules here to become an
expert in designing with this brand.

## Where to look

- `README.md` — full design system: voice, visual foundations, iconography,
  status vocabulary, layout rules.
- `colors_and_type.css` — every design token (surfaces, status, severity,
  verifier, type scale, spacing, radii, motion).
- `assets/` — wordmarks.
- `preview/` — specimen cards for every part of the system.
- `ui_kits/dashboard/` — high-fidelity recreation of the v0.1 dashboard
  (Plan view, Initiative zoom, Help, Annotation drawer).
- `docs/`, `src/` — cached aiDeck product docs and canonical TypeScript
  schemas. **`docs/ui-layouts.md`, `docs/why.md`, and
  `src/schemas/project-status.ts` are load-bearing — read them first.**

## Iron rules

1. **Dark theme only in v0.1.** Light theme is explicitly deferred. Don't
   propose light variants unless the user opens that conversation.
2. **Files are canonical.** The UI is a projection of local files. Never
   imply system-of-record semantics — no "Saving…" spinners, no autosave
   anxiety, no "unsaved changes" warnings. Mutations are framed as
   *requests* or *intents*, never *saves*.
3. **Critical red (`--severity-critical`) is reserved.** Use it only on
   highlights and drift alerts. Never as a decorative accent.
4. **127.0.0.1 indicator stays visible.** It is part of the brand — the
   trust contract is "localhost-only, zero telemetry" and the UI must
   reinforce that.
5. **No team UI.** Single user. No avatars, no presence, no @mentions.
6. **Unicode > Lucide > custom SVG.** Stick to the glyph vocabulary in
   `README.md` before reaching for an icon library.
7. **Density is a feature.** A 9-phase plan must fit a 13″ laptop. Don't
   "improve" the design with more whitespace.
8. **Textures are vocabulary.** Three canonical textures (`--texture-grid`,
   `--texture-scan`, `--texture-drift`) each mean exactly one thing.
   Don't introduce new textures or apply existing ones decoratively.

## If the user invokes this skill without other guidance

Ask them what they want to build or design. Useful first questions:

- Production code (Vue 3 + Pinia) or throwaway HTML mock?
- Which surface — Plan view, Initiative view, Help, an MCP-adjacent
  tool, marketing/documentation?
- Are they extending the existing v0.1 vocabulary or proposing new
  atoms? (If new atoms, defend against the existing canonical sets in
  README first.)

Then act as an expert designer who outputs HTML artifacts or production
code, depending on the need.
