# UI briefings — aiDeck v0.1 (para Claude Design)

> Cada bloco abaixo é um **briefing** (contexto + necessidade + restrições), **não** uma especificação prescritiva. Claude Design é a ferramenta de design — decide layout, tokens, componentes, hierarquia visual. Você cola estes textos como input no Claude Design e itera visualmente. Não inclua wireframes nem listas de componentes nos prompts: deixe a Anthropic fazer o que ela faz.

## Setup do design system (uma vez por sessão)

Quando você criar o projeto em [claude.ai/design](https://claude.ai/design), aparece a tela **"Set up your design system"** com 5 campos. Preencha apenas 3:

### Campo "Company name and blurb (or name of design system)"

Cole:

```
aiDeck — AI-native local dashboard runtime.

aiDeck reads structured project data (YAML + Markdown plans, initiatives, annotations) that AI skills write to a local `.atomic-skills/` directory, and projects it onto three surfaces: a Vue 3 dashboard in the browser, a REST + SSE HTTP API, and an MCP (Model Context Protocol) server for AI agents in IDEs like Claude Code and Cursor. Lives at 127.0.0.1:7777, fully local, zero telemetry, MIT-licensed.

Built for solo developers who run multi-phase projects (plans with 5-15 phases, 30-80 sub-phases) alongside AI agents and need a visual surface that both human and AI can read and annotate. The dashboard is a projection, never the source of truth — files in `.atomic-skills/` are canonical; aiDeck just renders them and gets out of the way.
```

### Campo "Link code on GitHub"

Já linkado: `henryavila/aideck`. Caso precise re-conectar:

```
https://github.com/henryavila/aideck
```

### Campo "Any other notes?"

Cole:

```
AUDIENCE AND TONE

Primary user: a developer working in a terminal-heavy IDE (Claude Code, Cursor) alongside AI agents. Comfortable with GitHub DevTools, Linear, iTerm2, mdprobe. They expect dense information and keyboard-first interaction.

Secondary user: the AI agent itself, which reads the same surface via the MCP server. The product must serve both equally well.

Not designed for: non-technical project managers, enterprise teams with hierarchical permissions, customer-facing dashboards.

VISUAL TONE

Dark-first ONLY in v0.1. Do not design or propose light theme variants — that's deferred to v0.2.

The reference tone is "cockpit / DevTools", not "Notion-pretty". Closer to GitHub DevTools, Linear's command bar, Datadog timelines than to Asana, ClickUp, or Monday.com. Information density is a feature, not a problem to solve with whitespace.

The product must render real-world plans of 9 top-level phases × 8 parallel tracks × ~60 sub-phases × ~30 cross-document references without overflow, truncation, or pagination tricks. Treat that as a calibration constraint, not a stretch goal.

STATUS VOCABULARY (first-class concept — appears on virtually every screen)

States: done, active, pending, blocked, parked, emerged, highlighted.
Severity levels for highlights: info, warn, critical.
Verifier kinds for exit gates: shell, query, test, manual.

These need to be visually distinguishable at small sizes and color-coded consistently across screens. Treat them as canonical atoms in the design system.

BRAND PRINCIPLES (these inform UI decisions)

1. "Files are canonical." aiDeck never owns state — it projects from local files. The UI must not imply system-of-record semantics. No "saving..." spinners, no autosave anxiety, no "unsaved changes" warnings. Changes happen in files; the UI reflects them.

2. "Localhost-only, zero telemetry." Developers trust the product specifically because it doesn't phone home. The UI should make this visible — a small `127.0.0.1` indicator somewhere in the chrome reinforces the contract.

3. "Bidirectional human ↔ AI." Annotations and highlights are not afterthoughts — they're the channel through which humans flag things for AI and AI flags things for humans. They deserve first-class presence (inline badges, a persistent drawer, real-time updates).

4. "Read-only on entity files." Mutation tools in the MCP layer append intents to an inbox — they do not edit `plans/*.md` or `initiatives/*.md` directly. The UI must not present "edit task" or "mark done" as if the dashboard is doing the work; framing should be "request" or "intent", not "save".

ANTI-PATTERNS TO AVOID

- Big illustrated empty states. Terse text is better. Developer audience.
- Avatar grids, team UI, presence indicators. This is single-user.
- Default-visible charts, sparklines, gauges. This is a tracker, not BI.
- Notification bells with red dots overlapping content.
- Multi-step onboarding wizards. The audience hates them.
- "Tutorial" tooltips that follow the cursor on first visit.
- Light-mode toggle. Not in v0.1.
- Modal-everything. Use inline expansion where possible.

ACCESSIBILITY

WCAG AA contrast minimum (4.5:1 text, 3:1 UI). All interactive elements keyboard-reachable. `:focus-visible` outlines visible against dark surfaces. Skip-to-content link. Aria labels on icon-only buttons.

PERFORMANCE EXPECTATIONS

- Initial paint of a Plan view with 9 phases under 500ms.
- SSE-driven updates (annotation added, highlight added) reflected in the UI under 200ms.
- Annotation panel filter for ~12 skills under 50ms.
- No mandatory dependency on browser features that don't exist in current Chrome/Safari/Firefox.

WHERE TO LOOK IN THE LINKED REPO

- docs/why.md — product motivation and journey, including what aiDeck IS NOT.
- docs/feature-contracts.md — what each surface must accomplish, with verifiable success gates per feature (F1-F13).
- docs/canonical-data-pattern.md — the architectural rule "files are canonical".
- docs/ui-layouts.md — earliest wireframe sketches from initial design thinking. Treat as ONE possible interpretation of the information hierarchy; you have full freedom to evolve them. Do not feel constrained by their literal layout.
- src/schemas/common.ts and src/schemas/project-status.ts — the canonical data shapes that get rendered. Useful to understand what content actually arrives at each screen.
- docs/implementation/INDEX.md and step files 10-14 — the development sequencing that maps screens to implementation work.

DESIGN SYSTEM SHOULD INCLUDE

- A dark canvas with at least 3 distinct surface levels (canvas, surface, elevated) for nested cards.
- Accent colors mapped to the status vocabulary above. Highest severity (critical) should be reserved exclusively for it — no decorative use.
- A spacing scale tight enough to support a 9-phase plan on a 13" laptop screen without horizontal scroll.
- A type scale with a strong monospace pair — developers read paths, IDs, and code constantly.
- Status, severity, and verifier-kind tokens that subsequent screen briefings can reference by name rather than re-specifying.
```

### Outros campos da tela

- **"Link code from your computer"**: pular (já linkado via GitHub).
- **"Upload a .fig file"**: pular (não temos Figma).
- **"Add fonts, logos and assets"**: pular (sem brand assets ainda).

→ Clique **Set up**. Claude Design vai gerar uma proposta de DS. Itere visualmente até bater com o tom acima. Só então prossiga aos briefings de tela.

---

## Briefings de tela

Cada bloco abaixo é uma mensagem para colar no chat do workspace Claude Design, em ordem. Cada briefing assume que o DS está estabelecido e que os briefings anteriores foram acomodados — o layout shell (cabeçalho global, drawer slot, banner area) projetado na briefing 1 deve ser herdado pelas briefings 2-5.

---

### 1. Home + Demo + layout shell

```
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
```

---

### 2. Plan bird's-eye view

```
WHAT THIS SCREEN SERVES

This is the most visually dense screen in aiDeck. It renders a single Plan — a multi-phase project (think of it as a hierarchical roadmap) — at a glance, so the user can see all phases, their dependencies, their parallel groupings, and which one is currently active, without scrolling between separate views.

PERSONA AND MOMENT

A developer who landed on Home and clicked into a specific plan, OR an AI agent that's about to start work and is taking inventory of where the plan currently stands. Either way: they need a complete mental model of the plan in one screen.

The reference plan that calibrates the design is sda-v2 v3-redesign: 9 top-level phases organized into 8 tracks (domains), with one explicit parallel pair (F4 and F5 may run simultaneously). This is not a stretch target — it is the actual reality the product was designed for. If 9 phases don't fit comfortably, the design has failed.

INFORMATION THAT MUST BE ACCESSIBLE

- Plan title, version, status, start date, branch, and which phase is currently active.
- Plan-level principles (5-10 short statements that constrain the whole project) and glossary (5-15 domain terms with definitions) — both expected to be present and consultable, but not dominating screen real estate.
- The full phase tree, grouped by track. Each phase shows: its id (F0, F1, ...), title, goal, status, sub-phase count, exit-gate progress, audience (who the phase serves), key scope paths, and whether highlights or annotations exist on it.
- For phases that are marked as parallel-allowed with another phase: this fact must be visually obvious — two phases with `parallelWith` pointing at each other should read as a pair, not as two independent items happening to sit nearby.
- For the currently active phase: an unmistakable highlight (color + iconography) and the "next action" — what the user/AI should do next.
- Cross-document references the plan depends on (PRDs, runbooks, external repos, ADRs). Some are inside the project; some are external (e.g., another repository at /Volumes/External/code/arch); some are gitignored (PII, data dumps). All three states must be visually distinguishable.
- The plan's full markdown narrative (often hundreds of lines of rationale and context) — accessible on demand, not opened by default.
- A view of the phase dependency graph — also on demand.

INTERACTIONS THE USER MUST PERFORM

- Click any phase → drill into its initiative zoom view.
- Open and close the principles and glossary panels.
- Open and close the narrative.
- Open and close a references modal that lists all cross-doc refs.
- Toggle a dependency graph overlay (graph rendering is heavyweight — must be loaded lazily, not eagerly).
- Direct navigation via URL hash to a specific phase (e.g. opening /plans/v3-redesign#phase-F4 should land with F4 in view).

SCALE AND EDGE CASES

- 9 phases × 8 tracks × 1 parallel pair × 61 sub-phases × 30+ references is the calibration target. The screen must render this without horizontal scroll on a 13" laptop and without information being hidden behind disclosures by default.
- A simpler plan (3 phases, single track, no parallels) must not feel sparse or empty.
- A plan with no glossary or no principles must not leave awkward empty regions.
- A plan with `parallelismAllowed: false` but a phase nevertheless marked `parallelWith` (data inconsistency) must surface a warning, not silently ignore.

NON-NEGOTIABLE CONSTRAINTS

- Plan data is read-only. No edit/save affordances.
- Status vocabulary uses the canonical glyphs/colors from the design system — phases here use the same `active/pending/done` treatment as tasks elsewhere, for transfer.
- Initial paint under 500ms with the 9-phase fixture.
- Mermaid (or whatever graph library you choose) must be lazy-loaded so it doesn't bloat the initial bundle.
- The narrative body, when expanded, must not push the rest of the screen off — should be inline-expandable with its own scroll container or capped height + "show more".

OUT OF SCOPE

- No filter-by-status control on phases (v0.1 always shows all).
- No inline editing of phase or plan fields.
- No drag-to-reorder.
- No "compare with another plan" affordance.
- No comments threaded inline next to phases — annotations live in the drawer.
```

---

### 3. Initiative zoom view

```
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
```

---

### 4. Skills directory (Help)

```
WHAT THIS SCREEN SERVES

A directory of every AI skill in the user's ecosystem (the atomic-skills family or whatever consumer family they've installed). Each skill is a structured capability with a name, purpose, when-to-use guidance, examples, and a slash-command invocation. The Help screen makes these discoverable, filterable, and copy-pasteable.

PERSONA AND MOMENT

A developer who has heard about a skill, can't remember its exact invocation, or wants to know "is there a skill for X?". They land on Help, scan, search if needed, and copy a command into their IDE.

Or: a new evaluator who clicked Help from the demo banner and wants to understand the ecosystem aiDeck is part of.

INFORMATION THAT MUST BE ACCESSIBLE

For each skill:
- Name and one-line purpose.
- When to use it (one or more concrete situations).
- When NOT to use it (anti-cases — these matter as much as the positives).
- Example invocations (literal command lines or markdown blocks).
- Related skills (cross-references that help the user discover adjacent capabilities).
- Whether this skill is currently "active in repo" (has a corresponding directory under .atomic-skills/) vs. merely "available" (registered globally but no usage here yet).

Across the directory:
- A search input that filters by name, purpose, or any when-to-use text in under 50ms for typical (~12 skill) sizes.
- A filter to scope by activation state (all / in repo / available).
- A copy-command affordance per skill that puts the invocation onto the clipboard in one click.

INTERACTIONS THE USER MUST PERFORM

- Type in search → directory filters live.
- Click filter pill → scope changes.
- Click a skill card → expanded view with full when-to-use, when-NOT-to-use, all examples, and clickable related-skill chips.
- Click related-skill chip in expanded view → swap the expanded view to show that other skill (in-place navigation, not back-and-forth).
- Click copy-command → clipboard updated + brief confirmation feedback.
- Close the expanded view via Esc or a close affordance.

SCALE AND EDGE CASES

- 12 skills today; the directory should accommodate growth to 30+ without redesign.
- A skill with incomplete metadata (only name and purpose, no when-to-use / examples) — must still render gracefully with a "metadata incomplete" indicator, and copy-command still works.
- Zero skills detected — must show a clear, instructive empty state ("no skills found — see setup guide").
- The user is on Help even though they have no consumer state set up — Help must be reachable independently.

NON-NEGOTIABLE CONSTRAINTS

- Search filter performance under 50ms.
- Keyboard accessible (Tab through cards, Enter to expand, Esc to close).
- Copy-command uses the system clipboard.
- Expanded view should not be a fullscreen takeover — feel like opening a card detail in place.

OUT OF SCOPE

- "Install skill" buttons. Installation happens through the skill ecosystem's own CLI; aiDeck does not handle install/uninstall.
- Skill ratings, comments, or popularity metrics.
- Pagination — the directory should handle 30+ via density, not pagination.
- Per-user skill preferences or hiding.
```

---

### 5. Annotation drawer + inline highlights

```
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
```

---

## Handoff to Claude Code

Após validar visualmente os 5 briefings, use o botão **"Handoff to Claude Code"** do Claude Design. No prompt do handoff, cole:

```
Convert the design system and 5 screens into Vue 3 SFC components for the aiDeck project at https://github.com/henryavila/aideck.

Production stack constraints (non-negotiable — these are project iron laws):

- Vue 3 + Composition API + <script setup lang="ts">
- TypeScript strict mode
- Plain CSS using CSS variables. NO Tailwind, NO CSS-in-JS, NO Sass.
- Pinia for state management
- Vue Router 4 with createWebHistory (not hash) — SPA fallback is configured server-side per docs/implementation/05-hono-rest-sse.md
- `marked` for markdown body rendering
- `mermaid` lazy-loaded only when a dependency graph is shown
- No external UI framework (no PrimeVue, no Vuetify, no Naive UI)

The file scaffold is already in place at:
- src/client/styles/ — design tokens go in theme.css
- src/client/components/ — atomic and composite components
- src/client/views/ — top-level routes (HomeView, DemoView, PlanView, InitiativeView, HelpView)
- src/client/stores/ — pinia stores (one per concern)
- src/client/router.ts

Implementation plan in docs/implementation/INDEX.md sequences the UI work as steps 10-14 — please align your output with that sequence so the developer can ingest screen by screen.

Iron Laws from docs/CLAUDE.md that constrain the UI specifically:

1. Files are canonical. The dashboard never mutates plans/*.md or initiatives/*.md. Mutation buttons should emit @intent events; wiring those events to MCP intent recording is the developer's job (see docs/implementation/07-mcp-mutate.md).
2. Bind localhost only. No outbound network calls from the client beyond /api/* on the same origin.
3. Schema version enforcement. Reject and surface schema_version_mismatch errors clearly when they arrive over SSE.
4. No telemetry. No analytics scripts. No fonts loaded from external CDNs (system fonts only, per the design notes).
5. v0.1 scope is fixed — no features beyond what the 5 briefings established.

Deliver one PR-ready commit per screen (5 commits total) so the developer can review and integrate incrementally.
```

---

## Notas operacionais

- **Quando o repo evoluir após mudanças**: peça explicitamente no chat do Claude Design para re-ler o repo. Anthropic não documenta cache invalidation do design system; a iteração visual continua usando o snapshot inicial até que você force refresh.
- **Se o DS gerado divergir do tom briefado**: cite a divergência específica (ex.: "the proposed accent palette uses warm tones; the audience is developers and brand notes specified cool/cockpit") e peça refino. Os briefings foram desenhados para ser determinísticos quanto a princípios, não a pixels.
- **Limites conhecidos do Claude Design para o workflow aiDeck**:
  - Output Vue 3 SFC nativo não é first-class — sai via "Handoff to Claude Code"
  - Previews não testam interatividade real (SSE live updates) — validação live só após handoff + dev server
  - Não conhece o backend Hono real; previews usam mock data
  - Não há acesso a fixtures `.md` em runtime — Claude Design extrai dados via inspeção do código linkado

- **Se uma briefing precisar ser repetida porque o preview foi ruim**: re-cole sem alterações. Briefings são intencionalmente curtos para permitir múltiplas iterações sem fadiga de leitura.
