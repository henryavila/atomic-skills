---
schemaVersion: "0.1"
slug: bmad-af-learnings
title: BMad AF Learnings — State Sync + Quality Gates
goal: Resolver o gap de sincronização estado↔implementação e adicionar quality
  gates inspirados no BMad Atomic Flow
status: done
branch: null
started: 2026-05-27T10:10:44Z
lastUpdated: 2026-06-08T00:56:38Z
nextAction: null
tasksDone: 7
tasksTotal: 7
gatesMet: 1
gatesTotal: 2
exitGates:
  - id: G-1
    description: "State sync: tasks marcadas done dentro da mesma sessão em que o
      trabalho é feito (≥80% das vezes)"
    status: deferred
    verifier:
      kind: manual
      description: Usar o sistema por 1 semana e verificar que os 3 mecanismos de sync
        reduzem state drift
    deferredReason: 'The 3 sync mechanisms (M1 Session-End reconciliation/stop-hook,
      M2 Pre-Task gate, M3 commit→task mapping/session-start) are implemented
      and were demonstrated working live: detect-completion caught a
      done-looking OPEN task via output-exists in a throwaway repo, and 15 tasks
      were closed in-session this session (F5 + mode2), with the phase-done
      review gate firing automatically. The literal "≥80% same-session / 1-week
      drift-reduction" is a longitudinal OUTCOME metric the user chose to keep
      observing before certifying met — deferred, not failed.'
    evidence:
      verifierKind: manual
      verifiedAt: 2026-06-08T00:56:38Z
      passed: false
      outputSummary: Mechanisms demonstrated functional (live detector catch +
        same-session closes this session); longitudinal drift-reduction outcome
        not yet formally certified — user opts to keep observing.
    verifierLabel: manual
    evidenceSummary: "deferred: The 3 sync mechanisms (M1 Session-End
      reconciliation/stop-hook, M2 Pre-Task gat…"
  - id: G-2
    description: "Quality gates: tasks criadas com scopeBoundary e acceptance quando
      aplicável"
    status: met
    verifier:
      kind: manual
      description: Criar 3+ tasks via new-task e verificar que os novos campos
        aparecem no template/prompt
    metAt: 2026-06-08T00:56:38Z
    evidence:
      verifierKind: manual
      verifiedAt: 2026-06-08T00:56:38Z
      passed: true
      outputSummary: "6 real tasks created via new-task carry BOTH fields (mode2
        T-001..T-005: scopeBoundary 1–3 paths + acceptance 3 items each) — gate
        asks for 3+. Fields live in the Task schema (delivered by T-004) and
        surface in the new-task flow. Verified by a repo-wide scan, shown to the
        user."
    verifierLabel: manual
    evidenceSummary: passed · 2026-06-08
scope:
  paths:
    - skills/core/project-status.md
    - skills/core/project-plan.md
    - skills/shared/project-status-assets/hooks/
    - skills/core/review-code.md
    - meta/schemas/
stack:
  - id: 1
    title: BMad AF Learnings — State Sync + Quality Gates
    type: task
    openedAt: 2026-05-27T10:10:44Z
tasks:
  - id: T-001
    title: "M2: Pre-Task Gate — reconciliação antes de novo trabalho"
    status: done
    lastUpdated: 2026-05-27T10:16:28Z
    closedAt: 2026-05-27T10:16:28Z
    description: >
      No início de qualquer subcommand mutante do project-status (push, pop,
      park, emerge, done, new-task, phase-done), scan tasks com status=active.
      Se alguma tem lastUpdated >24h, perguntar ao user se ainda
      active/done/blocked ANTES de prosseguir. Gate leve (skip allowed).
      Implementar como Step 0 no skill MD.
    outputs:
      - kind: file
        path: skills/core/project-status.md
        description: Step 0 reconciliation gate adicionado antes de subcommands mutantes
    tags:
      - sync
      - high-priority
  - id: T-002
    title: "M1: Session-End Reconciliation no stop hook"
    status: done
    lastUpdated: 2026-05-27T10:25:06Z
    closedAt: 2026-05-27T10:25:06Z
    description: >
      Melhorar stop.sh: após check de scope drift, parse git diff --name-only
      desde session start. Cruzar arquivos modificados com
      tasks[].outputs[].path da initiative ativa. Se match, sugerir bloco
      "Likely done: T-xxx — run: done T-xxx". Não auto-mutar.
    outputs:
      - kind: file
        path: skills/shared/project-status-assets/hooks/stop.sh
        description: Bloco de reconciliação adicionado ao stop hook
    tags:
      - sync
      - hooks
  - id: T-003
    title: "M3: Commit-Message → Task mapping no session-start"
    status: done
    lastUpdated: 2026-05-27T10:25:06Z
    closedAt: 2026-05-27T10:25:06Z
    description: >
      No session-start.sh, após surfacing context: parse git log desde
      lastKnownCommit (salvo em status/last-session.json) buscando padrão
      [T-NNN] em commit messages. Se encontrar task IDs referenciados, sugerir
      "done T-xxx (referenced in commit abc123)". Integrar com save-and-push
      skill para incentivar convenção [T-NNN] no commit message.
    outputs:
      - kind: file
        path: skills/shared/project-status-assets/hooks/session-start.sh
        description: Detecção de task IDs em commits recentes
      - kind: file
        path: skills/shared/project-status-assets/hooks/config.json
        description: Campo lastKnownCommit adicionado
    tags:
      - sync
      - hooks
  - id: T-004
    title: scopeBoundary + acceptance[] no schema de Task
    status: done
    lastUpdated: 2026-05-27T10:25:06Z
    closedAt: 2026-05-27T10:25:06Z
    description: >
      Adicionar ao initiative.schema.json/$defs/task: - scopeBoundary: array of
      strings (optional) — explicit "do NOT do X" - acceptance: array of strings
      (optional, max 5) — it()-style assertions Atualizar initiative.template.md
      com exemplos comentados. Atualizar new-task no project-plan.md para
      oferecer esses campos.
    outputs:
      - kind: file
        path: meta/schemas/initiative.schema.json
        description: Campos scopeBoundary e acceptance no task schema
      - kind: file
        path: skills/core/project-plan.md
        description: new-task atualizado para oferecer novos campos
    tags:
      - quality
      - schema
  - id: T-005
    title: Convergence rule no review-code
    status: done
    lastUpdated: 2026-05-27T10:25:06Z
    closedAt: 2026-05-27T10:25:06Z
    description: >
      Adicionar --max-iterations (default 3) ao review-code skill. Após cada
      iteração fix→review, comparar contagem de CRITICAL+MAJOR. Se não diminuiu
      entre iteração N e N-1, parar e escalar para humano: "Findings plateaued
      at N CRITICAL + M MAJOR after K iterations. Manual review needed."
    outputs:
      - kind: file
        path: skills/core/review-code.md
        description: Convergence rule com plateau detection
    tags:
      - quality
      - review
  - id: T-006
    title: Review como gate obrigatório no phase-done
    status: done
    lastUpdated: 2026-05-27T10:25:06Z
    closedAt: 2026-05-27T10:25:06Z
    description: >
      No flow de phase-done do project-status, após verificar exit gates e antes
      de proposeAdvance: rodar review-code no diff da fase (commits desde phase
      start). Aplicar blocker/critical findings automaticamente. Usar
      convergence rule (T-005). Flag --skip-review para bypass explícito.
    blockedBy:
      - T-005
    outputs:
      - kind: file
        path: skills/core/project-status.md
        description: Review step adicionado ao flow de phase-done
    tags:
      - quality
      - review
  - id: T-007
    title: Context size warnings no new-task e adopt
    status: done
    lastUpdated: 2026-05-27T10:25:06Z
    closedAt: 2026-05-27T10:25:06Z
    description: >
      Adicionar ao config.json: maxTaskDescriptionLines (default 15),
      maxTaskAcceptance (default 5). No new-task (project-plan) e adopt
      (decompose), emitir warning se task description > limite. Warning, não
      blocker — user pode override.
    outputs:
      - kind: file
        path: skills/shared/project-status-assets/hooks/config.json
        description: Campos maxTaskDescriptionLines e maxTaskAcceptance
      - kind: file
        path: skills/core/project-plan.md
        description: Validation warnings no new-task e adopt
    tags:
      - quality
      - cognitive-load
parked: []
emerged: []
references:
  - kind: url
    path: http://localhost:3002/bmad-vs-atomic-skills-analysis.md
    label: Análise comparativa BMad AF vs Atomic Skills
  - kind: url
    path: http://localhost:3002/state-sync-gap-analysis.md
    label: Diagnóstico do gap de sync estado↔implementação
  - kind: repo-path
    path: /Volumes/External/code/bmad-dev-productivity/bmad-atomic-flow
    label: BMad Atomic Flow — repo de referência
    inside_repo: false
parentPlan: bmad-af-learnings
phaseId: F0
summary: Sincroniza estado↔implementação e adiciona quality gates inspirados no
  BMad Atomic Flow.
planTitle: BMad AF Learnings — State Sync + Quality Gates
---


# BMad AF Learnings — State Sync + Quality Gates

## Contexto

Análise do repositório [bmad-atomic-flow](../../) revelou que o gap principal do atomic-skills
não é falta de features — é que **estado e execução são desacoplados**. No BMad AF o pipeline
força reconciliação; no nosso modelo emergente o humano esquece.

Prioridade: sync primeiro (T-001→T-003), qualidade depois (T-004→T-007).

## Princípio de Design

**Nunca auto-mutar estado.** Os 3 mecanismos de sync (M1-M3) SUGEREM com evidência,
mas o humano confirma. Isto preserva o ratify gate que é diferencial do atomic-skills.

## Decisions

- M2 (Pre-Task Gate) antes de M1 (Session-End) porque é menos código e roda no momento certo
- T-006 depende de T-005 (convergence rule necessária antes de tornar review obrigatório)
- Context size limits como config values, não como task separada — absorvido por T-007

## Links

- [BMad Atomic Flow repo](/Volumes/External/code/bmad-dev-productivity/bmad-atomic-flow)
- [Análise comparativa](http://localhost:3002/bmad-vs-atomic-skills-analysis.md)
- [Diagnóstico state sync](http://localhost:3002/state-sync-gap-analysis.md)

## Self-review against code-quality gates

- **G1 read-before-claim**: all 7 tasks (the M1–M3 sync mechanisms + schema/review-code/phase-done-gate features) landed 2026-05-27 with their own closures.
- **G2 soft-language**: gate descriptions + reasons scanned; no ban-list terms.
- **G6 reference-or-strike**: G-2 met with evidence (6 tasks carry the fields); G-1 deferred with a documented reason (mechanisms demonstrated live; longitudinal outcome still under observation).
- **Codex review**: SKIPPED at phase-done — the 7 feature tasks landed 2026-05-27 and have been in production use 11 days; no new code at this close (state-file only); codex CLI usage-limited until 2026-07-07.
