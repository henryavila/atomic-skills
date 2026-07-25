# Projeção de fases do project no TODO do Grok

Projeção unidirecional skill-level: fases do plan ativo no `todo_write` do Grok com
label `F0 (n/N) — summary|title`, SoT em `.atomic-skills/`, helper determinístico e
harden de `refresh-state` nos closes. Não inventa identidade de fase (usa
`title`/`summary` existentes). Não fecha task via TODO.

## Principles

- **P1 SoT único** — só a skill `project`/`done` muta estado canônico; TODO é projeção de sessão.
- **P2 Fases, não tasks** — checklist Grok = trilho de fases; `T-00N` fica no YAML/aiDeck.
- **P3 Identidade semântica** — content sempre inclui o que a fase faz (`summary` || `title`), nunca só `F0 (x/y)`.
- **P4 Write-through** — mutação → `refresh-state` → helper → `todo_write` (nessa ordem).
- **P5 Reseed honesto** — pós-compaction e no start; harness Grok não devolve snapshot de todos.
- **P6 Host-local Grok** — zero fork do core Grok; zero write em `plan.json` da sessão por shell.

## Glossary

| Termo | Significado |
|---|---|
| **session todo** | Item do `todo_write` / checklist de sessão do Grok |
| **phase scaffold** | Conjunto de session todos = uma linha por fase do plan ativo |
| **helper** | Script zero-token que emite o payload JSON de `todo_write` a partir do SoT |
| **label canônico** | `F{id} (done/total) — summary ou title` |
| **refresh-state** | Chokepoint rollups + focus markers + focus.json + aiDeck series |

## F0 — Contrato de projeção e wire-up de prosa

**Goal:** Congelar o contrato de label, mapeamento de status, ordem SoT→espelho, reseed e anti-competição proc em prosa e docs, greppable, sem o helper completo ainda.

### T-001 Contrato em KB e design receipt

Documentar o contrato (fases-only, label, SoT, paused, reseed, merge rules) e cross-link no design de statusline.

- Files: docs/kb/grok-phase-todo-projection.md, docs/design/statusline-focus-integration.md
- scopeBoundary: do not implement scripts/project-session-todos.js; do not change meta/schemas/plan.schema.json; do not claim host auto-reads focus.json
- acceptance: KB names canonical label with summary or title fallback; KB states SoT order mutate then refresh-state then helper then todo_write; KB states paused maps to pending with suffix; statusline-focus-integration.md cross-links Grok session-todo consumer
- verifier: { kind: shell, command: "rg -n 'summary|title|refresh-state|todo_write|paused' docs/kb/grok-phase-todo-projection.md && rg -n 'grok-phase-todo|session.todo|todo_write' docs/design/statusline-focus-integration.md", expectExitCode: 0 }

### T-002 Wire-up Grok em compat e project note

Registrar projeção Grok-local e ponteiro no router project.

- Files: docs/kb/grok-build-compatibility.md, skills/core/project.md
- scopeBoundary: do not implement helper or lint changes; do not add Claude or Codex todo tools; do not dump full procedure into resident router
- acceptance: grok-build-compatibility.md documents phase scaffold as Grok-local; project.md points to helper or detail contract; text forbids proc scaffold competing with phase scaffold while plan anchored
- verifier: { kind: shell, command: "rg -n 'phase scaffold|todo_write|project-session-todos|session.todo' docs/kb/grok-build-compatibility.md", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: F0-G1
      description: KB contract file exists and states label plus SoT order
      status: pending
      verifier:
        kind: shell
        command: test -f docs/kb/grok-phase-todo-projection.md && rg -n 'refresh-state|todo_write' docs/kb/grok-phase-todo-projection.md
        expectExitCode: 0
    - id: F0-G2
      description: Manual HARD operator confirms label format and SoT order match approved design
      status: pending
      verifier:
        kind: manual
        description: Henry acks F0 contract in chat or gate-signoff with explicit PASS
```

## F1 — Helper determinístico de projeção

**Goal:** Script zero-token que, dado o repo, emite o array de session todos das fases do plan pickFocus com label canônico e statuses corretos.

### T-001 Implementar helper e CLI

- Files: scripts/project-session-todos.js
- scopeBoundary: do not call todo_write or write under ~/.grok/sessions; do not mutate plan or initiative frontmatter; do not invent tasksDone or total for descriptor-only phases
- acceptance: emits todos with stable id planSlug colon phase id; content uses done/total and summary or title when rollups exist and em-dash when descriptor-only; only current active phase is in_progress; empty focus emits empty array; CLI prints JSON exit 0
- verifier: { kind: test, command: "node --test tests/project-session-todos.test.js", expectExitCode: 0 }

### T-002 Testes golden do helper

- Files: tests/project-session-todos.test.js
- scopeBoundary: do not depend on a live Grok session; do not use the network
- acceptance: fixture F0 2 of 5 active and F1 pending produces correct content and statuses; descriptor-only F2 uses em-dash total; no active plan emits empty list; paused phase maps to pending with paused suffix
- verifier: { kind: test, command: "node --test tests/project-session-todos.test.js", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: F1-G1
      description: Helper tests pass
      status: pending
      verifier:
        kind: test
        command: node --test tests/project-session-todos.test.js
        expectExitCode: 0
    - id: F1-G2
      description: CLI json on repo root exits 0 and prints todos array
      status: pending
      verifier:
        kind: shell
        command: node scripts/project-session-todos.js --json . | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d); if(!Array.isArray(j.todos)) process.exit(1); process.exit(0)})"
        expectExitCode: 0
```

## F2 — Harden do emit lint estrutural

**Goal:** Garantir na prosa de transitions que refresh-state e o helper de projeção estão nos blocos de mutação de status via detector estrutural.

### T-001 Estender lint-transition-emits

- Files: scripts/lint-transition-emits.js, tests/transition-emits.test.js
- scopeBoundary: do not rewrite verifier or GATE-R2 semantics; do not require todo_write inside shell scripts
- acceptance: done reconcile and phase-done fail lint if refresh-state missing; done and phase-done fail if project-session-todos not mentioned; completion-emit requirements still pass after prose updates
- verifier: { kind: test, command: "node --test tests/transition-emits.test.js", expectExitCode: 0 }

### T-002 Prosa transitions com projeção

- Files: skills/shared/project-assets/project-transitions.md
- scopeBoundary: do not change done verifier-before-status order; do not make todo_write close tasks
- acceptance: done flow runs refresh-state then documents applying project-session-todos via todo_write on Grok; phase-done and reconcile document same step; never mark phase todo completed without phase status done or archived
- verifier: { kind: shell, command: "node scripts/lint-transition-emits.js skills/shared/project-assets/project-transitions.md", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: F2-G1
      description: lint-transition-emits passes on project-transitions.md
      status: pending
      verifier:
        kind: shell
        command: node scripts/lint-transition-emits.js skills/shared/project-assets/project-transitions.md
        expectExitCode: 0
    - id: F2-G2
      description: transition-emits unit tests pass
      status: pending
      verifier:
        kind: test
        command: node --test tests/transition-emits.test.js
        expectExitCode: 0
```

## F3 — Wire implement e reseed Grok

**Goal:** implement Atomic Skills e cues de sessão reseedam o scaffold de fases; anti-proc; pós-compaction.

### T-001 implement skill wire-up

- Files: skills/core/implement.md, skills/shared/implement-automate-maestro.md
- scopeBoundary: do not change GATE-R2 or pure-maestro claim exclusivity; do not project T-00N as todos; host-thin may update todos as orchestration without product edits
- acceptance: implement start runs refresh-state and applies phase scaffold merge false; after done Mode 1 references transitions projection step; forbids proc scaffold while plan-anchored; reseed after compaction documented
- verifier: { kind: shell, command: "rg -n 'project-session-todos|phase scaffold|todo_write|compaction' skills/core/implement.md skills/shared/implement-automate-maestro.md", expectExitCode: 0 }

### T-002 Reseed cues SessionStart e help

- Files: skills/shared/project-assets/hooks/session-start.sh, skills/shared/project-assets/project-help.md
- scopeBoundary: do not break Soft fail-open; SessionStart cannot call todo_write only optional hint
- acceptance: session-start still runs refresh-state and may print Grok reseed hint; project help mentions projection on Grok without inventing non-Grok tools
- verifier: { kind: shell, command: "rg -n 'refresh-state|session.todo|phase scaffold|project-session-todos' skills/shared/project-assets/hooks/session-start.sh skills/shared/project-assets/project-help.md", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: F3-G1
      description: implement assets mention helper reseed and anti-proc
      status: pending
      verifier:
        kind: shell
        command: rg -n 'project-session-todos' skills/core/implement.md && rg -n 'compaction|reseed|proc' skills/core/implement.md
        expectExitCode: 0
    - id: F3-G2
      description: Manual HARD operator dogfoods one implement start sees phase scaffold labels with titles
      status: pending
      verifier:
        kind: manual
        description: Henry runs implement or helper plus todo_write once and acks labels show F0 n/N with title or summary
```

## F4 — Integração e regressão

**Goal:** Suite de regressão verde; parity de install intacta; checklist dogfood.

### T-001 Regressão package

- Files: package.json, tests/project-session-todos.test.js, tests/transition-emits.test.js
- scopeBoundary: do not change install journal effects unless new installed file requires reverse; prefer package-root scripts with no install surface change
- acceptance: new tests run under node --test; install-uninstall-roundtrip green when no new install files; existing suite not broken by prose pointers
- verifier: { kind: shell, command: "node --test tests/project-session-todos.test.js tests/transition-emits.test.js", expectExitCode: 0 }

### T-002 Dogfood checklist e close

- Files: docs/kb/grok-phase-todo-projection.md
- scopeBoundary: do not invent PASS without operator run; checklist only no second helper
- acceptance: checklist lists seed after-done counter bump phase-done advance and reseed after compact; documents expected label with identity text not only counts
- verifier: { kind: shell, command: "rg -n 'todo_write|reseed|compaction|summary|title' docs/kb/grok-phase-todo-projection.md", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: F4-G1
      description: New unit tests pass in isolation
      status: pending
      verifier:
        kind: test
        command: node --test tests/project-session-todos.test.js tests/transition-emits.test.js
        expectExitCode: 0
    - id: F4-G2
      description: Manual HARD Henry confirms dogfood checklist completed once on Grok
      status: pending
      verifier:
        kind: manual
        description: Operator PASS after one real session saw phase scaffold update
```
