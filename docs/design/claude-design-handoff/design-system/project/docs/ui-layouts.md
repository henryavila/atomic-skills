# UI Layouts (Wireframes)

Wireframes for v0.1 views. ASCII representations to set layout intent. The implementing agent has freedom for styling details, but the **information hierarchy** and **interaction model** are fixed by these wireframes.

## Layout principles

1. **Bird's-eye + zoom** in one viewport when viewing a plan. Don't force users to navigate between views to compare.
2. **Status icons + color** are redundant. Color alone fails colorblind accessibility.
3. **Status indicators**: ✓ done · ◉ active · · pending · ⊘ blocked · ⌂ parked · ⇥ emerged · ⚑ highlight
4. **Breadcrumbs** always visible: `<plan> · <phase> · <initiative>`.
5. **Annotation panel** is collapsible side drawer (right side), persistent across views.
6. **Help button** ever-present in top bar; opens Help view as modal or full page.

## Color tokens (dark theme)

```css
--bg-canvas: #0d1117       /* page background */
--bg-surface: #161b22      /* cards, panels */
--bg-elevated: #1f262e     /* hover, modals */
--fg-default: #e6edf3      /* primary text */
--fg-muted: #8b949e        /* secondary text */
--fg-subtle: #6e7681       /* tertiary text */
--accent-cyan: #58a6ff     /* active/HERE */
--accent-green: #56d364    /* done */
--accent-amber: #d29922    /* warn / blocked */
--accent-red: #f85149      /* critical */
--accent-magenta: #db61a2  /* parked */
--accent-purple: #a371f7   /* emerged */
--border-default: #30363d
--border-subtle: #21262d
```

## 1. Top chrome (every view)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  aiDeck         /v3-redesign · F0 · v3-f0-foundation-repair    [?][⚑3][≡]  │
└────────────────────────────────────────────────────────────────────────────┘
   ▲                ▲                                              ▲   ▲   ▲
   logo             breadcrumb                                     │   │   menu
                                                                   │   highlights (badge)
                                                                   help
```

- Logo links to `/` (Plan list / Demo home).
- Breadcrumb is clickable at each level.
- `?` opens Help.
- `⚑3` shows open highlights count; click opens Highlight panel.
- `≡` opens slide menu (themes, settings, demo toggle, version).

## 2. Plan bird's-eye view (`/plans/<slug>`)

```
┌─ Top chrome ───────────────────────────────────────────────────────────────┐
│                                                                            │
├─ Plan header ──────────────────────────────────────────────────────────────┤
│ SDA v2 — Plano v3 (Redesign)               [Open narrative ▼] [Refs] [⌬]   │
│ v1.0 · active · started 2026-05-19 · branch v2-rebuild · current: F0       │
├─ Principles / Glossary (collapsible) ──────────────────────────────────────┤
│ ▾ 6 Principles                              ▾ 8 Glossary terms             │
├─ Phase tree (grouped by track) ────────────────────────────────────────────┤
│                                                                            │
│  TRACK A — Dados                                                           │
│  ┌─ F0 ◉ Foundation Repair · 3/8 tasks · 0/3 gates met ─────────────────┐  │
│  │   audience: developer · scope: backend/app/Console/Commands/...      │  │
│  │   exit: tag core-v2 + pipeline + 0 dup                  ⚑[2]         │  │
│  │   ────────────────────────────────────────────────────────────────── │  │
│  │   Next: T-002 Pipeline dumps → PostgreSQL                            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                    │
│  TRACK B — UI Base    │                                                    │
│  ┌─ F1 · Filament Redesign · 0/10 tasks · audience: admin              ┐   │
│  │   imports: /Volumes/External/code/arch                              │   │
│  │   exit-gate-type: ui-gate                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                    │
│  ┌─ F2 · Nuxt Redesign · 0/12 tasks · audience: end-user                 ┐ │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                    │
│  TRACK C — Planejamento                                                    │
│  ┌─ F3 · Planning Mode · 0/5 tasks · audience: líder de equipe         ┐   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                    │
│       ├──┐                                                                 │
│  ┌─ F4 │ Ministry Oversight ─┐   ┌─ F5 │ Set Curation ──────────┐          │
│  │ ∥F5 paralelo permitido   │   │ ∥F4 paralelo permitido      │          │
│  │ audience: ministry lead  │   │ audience: curator           │          │
│  └─────────────────────────┘   └─────────────────────────────┘            │
│       │                              │                                     │
│  TRACK F-H — sequencial F6 → F7 → F8                                       │
│  ...                                                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

Interactions:
- Click a phase card → opens Initiative zoom view (`/initiatives/<slug>`).
- `[Open narrative ▼]` expands the Plan's markdown body inline.
- `[Refs]` opens References modal (clickable list, gitignored badged).
- `⌬` toggles dependency graph overlay (SVG/mermaid).
- Track headers are clickable to collapse/expand the track.
- `⚑[N]` next to a phase = open highlights on that phase.
- Parallel-allowed phases (`F4 ∥ F5`) render side-by-side with explicit notation.

## 3. Initiative zoom view (`/initiatives/<slug>`)

```
┌─ Top chrome ───────────────────────────────────────────────────────────────┐
├─ Initiative header ────────────────────────────────────────────────────────┤
│ F0/9 · plan: v3-redesign                                                   │
│ v3-f0-foundation-repair · active · 2026-05-19 → ...                        │
│ Goal: Resolver dados antes de qualquer trabalho de UI.                     │
│ Branch: v2-rebuild · Scope: backend/app/.../* + scripts/* + migrations/*   │
│ Next: T-002 Pipeline dumps → PostgreSQL                                    │
├─ Exit gates (3) ───────────────────────────────────────────────────────────┤
│ [·] F0-G1  Tag git core-v2 criada           [shell] git tag | grep core-v2 │
│ [·] F0-G2  Query retorna 0 duplicatas       [query] SELECT COUNT(*)...     │
│ [·] F0-G3  scripts/full-pipeline.sh exit 0  [shell] bash scripts/...       │
├─ Stack (depth 1) ──────────────────────────────────────────────────────────┤
│ └─ F0 kickoff (task) ◉ HERE                                                │
├─ Tasks ────────────────────────────────────────────────────────────────────┤
│ ID     Title                                  Status   Updated             │
│ ──────────────────────────────────────────────────────────────────────────│
│ T-001  Restore local infra                    ✓ done   2 hrs ago     ⚑    │
│ T-002  Pipeline dumps → PostgreSQL            ◉ active 30 min ago    [▾]   │
│        > description, outputs[2], verifier preview ...                     │
│ T-003  Unificação do modelo Álbum             · pend   --                  │
│ T-004  Cleanup tenant songs                   · pend   --                  │
│ T-005  Reescrever matcher           [critical][gap-legacy] ⊘ blocked       │
│        blocked by: T-003, T-004                                            │
│ T-006  Validação humana via HTML report       · pend   --                  │
│ T-007  Re-run pipeline + verify               · pend   --                  │
│ T-008  Tag core-v2 + archive + snapshot       · pend   --                  │
├─ Parked (0) ─────────────────── Emerged (1) ──────────────────────────────┤
│ (empty)                          ⇥ Investigate Patrimony Clone             │
│                                    surfaced 5 hrs ago · not promoted       │
├─ References / Cross-refs ──────────────────────────────────────────────────┤
│ → ../plans/v3-redesign.md § F0 — Foundation Repair                         │
│ → ../../RUNBOOK.md § §2 pipeline de dados                                  │
│ ↗ T-005 unblocks v3-f1-filament-redesign T-002                            │
├─ Narrative body (markdown rendered) ───────────────────────────────────────┤
│                                                                            │
│   # F0 — Foundation Repair                                                 │
│                                                                            │
│   ## Why                                                                   │
│   ...                                                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

Interactions:
- Each task row expandable `[▾]` shows description, outputs, verifier preview.
- Tags render as colored chips. Status icons left of title.
- Exit gates clickable → opens a modal showing verifier output history.
- Cross-refs (`↗`) navigate within app to target initiative + task.
- Annotation icon `⚑` per task row when annotations exist; click opens panel filtered.

## 4. Help / Skills directory (`/help`)

```
┌─ Top chrome (Help highlighted) ────────────────────────────────────────────┐
├─ Search bar ───────────────────────────────────────────────────────────────┤
│  🔍 Search skills...                       Filter: [All▾] [In repo▾]       │
├─ Skill grid (cards) ───────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│  │ project-status   │ │ parallel-dispatch│ │ hunt             │            │
│  │ ────────────────│ │ ────────────────│ │ ────────────────│            │
│  │ Track work via   │ │ Dispatch N tasks │ │ Adversarial      │            │
│  │ initiatives.     │ │ in parallel.     │ │ tests find bugs. │            │
│  │                  │ │                  │ │                  │            │
│  │ When: starting,  │ │ When: indep task │ │ When: untested   │            │
│  │ resuming work    │ │ list, off-keyboard│ │ code             │            │
│  │                  │ │                  │ │                  │            │
│  │ [/atomic-skills: │ │ [/atomic-skills: │ │ [/atomic-skills: │            │
│  │  project-status] │ │  parallel-...]   │ │  hunt]           │            │
│  │ [📋 copy]        │ │ [📋 copy]        │ │ [📋 copy]        │            │
│  │ ● active in repo │ │ ○ available      │ │ ○ available      │            │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘            │
│                                                                            │
│  (... 9 more cards ...)                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

Interactions:
- Click card → expanded view: full description, all when-to-use, all examples, related skills (clickable).
- `📋 copy` copies slash command to clipboard.
- `●` indicator: skill currently active in this repo (e.g., project-status has initiative open).
- Filter by tag, status, etc. (post-v0.1 features may extend).

## 5. Demo home (`aideck demo`)

```
┌─ Top chrome ───────────────────────────────────────────────────────────────┐
│ aiDeck                                            [Demo mode ⚠]            │
├─ Banner ───────────────────────────────────────────────────────────────────┤
│ ⚠ DEMO MODE — seeded fixtures, not your data. Quit (Ctrl+C) to clean.      │
├─ Welcome ──────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Welcome to aiDeck.                                                        │
│                                                                            │
│  This dashboard is showing you what aiDeck looks like with realistic       │
│  data. To use it on your project:                                          │
│                                                                            │
│  1) Install atomic-skills (deep integration)                               │
│     npm install -g @henryavila/atomic-skills                               │
│     atomic-skills setup                                                    │
│     aideck serve                                                           │
│                                                                            │
│  2) Or build your own consumer:                                            │
│     See [docs/integration-spec.md] and [docs/mcp-tools.md]                │
│                                                                            │
├─ Demo content (linkable) ─────────────────────────────────────────────────┤
│                                                                            │
│  ▸ View demo plan: "Sample Migration Plan" (3 phases, 12 tasks)            │
│  ▸ View demo initiative: "Phase A — Foundation"                            │
│  ▸ Browse skills directory                                                 │
│  ▸ Try MCP from Claude Code (config: see Help)                             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## 6. Annotation panel (slide drawer)

Toggleable from right side of any view. Persistent across navigation.

```
┌─── Annotations ───────── × ─┐
│ [Filter: target ▾]          │
│ [ all  human  ai  resolved ]│
├─────────────────────────────┤
│                             │
│ ► v3-redesign/phases.F2/    │
│   tasks.T-005               │
│   ai · 2 hrs ago            │
│   ▌ Need to verify unicode  │
│   ▌ normalization for emoji │
│   ▌ edge cases.             │
│   [Resolve]                 │
│                             │
│ ► v3-f0-foundation-repair/  │
│   exitGates.F0-G2           │
│   human · 1 hr ago          │
│   ▌ This query might be     │
│   ▌ expensive on 50M rows.  │
│   ▌ Consider indexed view.  │
│   [Resolve]                 │
│                             │
└─────────────────────────────┘
```

## 7. Highlight indicators

Rendered inline next to entity name in any view. Color matches severity.

```
F2  Nuxt Redesign  ⚑[1 info]
F3  Planning Mode  ⚑[2 warn]
F0  Foundation R.  ⚑[1 crit]
```

Hover shows reason text. Click opens annotations panel filtered to that target.

## Component breakdown (for Vue planning)

Components the implementing agent will need:

```
PlanHeader
PlanPhaseTree
  PhaseCard
    ExitGateBadge
    HighlightBadge
    TaskCountBadge
  TrackHeader
  ParallelGroup
DependencyOverlay (mermaid)

InitiativeHeader
ExitGateList
  ExitGateRow
    VerifierBadge
StackTree
  StackFrame
TaskTable
  TaskRow
    StatusIcon
    TagChip
    TaskExpanded
ParkedEmergedPanel
ReferencesList
NarrativeBody (markdown renderer)

HelpGrid
  SkillCard
    UseCaseList
    CopyCommandButton
    ActiveIndicator

DemoBanner
DemoWelcome

AnnotationPanel
  AnnotationFilter
  AnnotationEntry
HighlightBadge

TopChrome
  Logo
  Breadcrumb
  HelpButton
  HighlightsButton
  MenuButton
```

Atomic components reused across views:

- `StatusIcon` — renders the status glyph + color
- `HighlightBadge` — count + severity color
- `VerifierBadge` — shows kind (shell/query/test/manual) with icon
- `ArtifactLink` — renders ArtifactRef with gitignored marker
- `MarkdownBody` — renders markdown body with syntax highlighting

## Out of v0.1

These views ship later but the data they need is already in the schema:

- Cross-cutting "Today's work" home — v0.4
- Repo health card — v0.4
- Cross-session timeline — v0.4
- Phase dependency graph as standalone view — v0.2 (overlay in v0.1)
