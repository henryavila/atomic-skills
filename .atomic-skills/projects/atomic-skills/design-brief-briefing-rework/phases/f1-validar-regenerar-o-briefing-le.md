---
schemaVersion: "0.1"
slug: design-brief-briefing-rework-f1-validar-regenerar-o-briefing-le
title: Validar (regenerar o briefing Lekto + contrastar = gate de não-reincidência)
summary: Regenera o briefing Lekto em sessão nova e contrasta com o feedback
  (gate de não-reincidência).
goal: em sessão nova, regenerar o briefing do Lekto com a skill reescrita,
  destilar a rubrica dos padrões transversais do feedback, contrastar via
  crítico adversarial e resolver o fork diferido D10.
status: active
branch: plan/design-brief
started: 2026-06-19T09:32:41.374Z
lastUpdated: 2026-06-19T17:06:31.000Z
nextAction: "T-002 done (briefing regenerado, verifier EXIT=0). Proximo: T-003 —
  destilar a rubrica de nao-reincidencia a partir de f1/lekto-feedback.md."
parentPlan: design-brief-briefing-rework
phaseId: F1
tasksDone: 2
tasksTotal: 5
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: F1-G1
    description: Briefing Lekto regenerado e contrastado; o veredito de
      nao-reincidencia existe e nenhum dos quatro contaminantes documentados
      reaparece como requisito.
    status: pending
    verifier:
      kind: shell
      command: grep -q 'NAO-REINCIDENTE'
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-verdict.md
      expectExitCode: 0
    verifierLabel: "shell: grep -q 'NAO-REINCIDENTE' .atomic-skills/projects/atomic-sk…"
  - id: F1-G2
    description: Fork D10 resolvido e registrado no design.md.
    status: pending
    verifier:
      kind: shell
      command: grep -q 'F1-D10-RESOLVED'
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/design.md
      expectExitCode: 0
    verifierLabel: "shell: grep -q 'F1-D10-RESOLVED' .atomic-skills/projects/atomic-sk…"
stack:
  - id: 1
    title: Validar (regenerar o briefing Lekto + contrastar = gate de
      não-reincidência)
    type: task
    openedAt: 2026-06-19T09:32:41.374Z
tasks:
  - id: T-001
    title: Obter e persistir o feedback original do Lekto
    summary: Persiste o feedback original do Lekto (o operador re-fornece) como
      entrada durável da F1.
    status: done
    closedAt: 2026-06-19T15:53:43.000Z
    lastUpdated: 2026-06-19T15:53:43.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T15:53:43.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — f1/lekto-feedback.md existe (291 linhas), feedback
        original re-fornecido pelo operador e persistido verbatim; cobre os 12
        padroes transversais + os 4 contaminantes (SWIPE_THRESHOLD=80,
        AXIS_LOCK_DISTANCE=10, 'Vai!', onboarding 3 passos).
    description: O operador re-fornece o feedback original do agente de design sobre
      o Lekto (era um download transitório, hoje ausente do disco); persiste em
      f1/lekto-feedback.md como entrada durável que a rubrica (T-003) e o
      crítico (T-004) consomem. A reconstrução em design.md serve apenas de
      fallback se o original não for recuperável.
    scopeBoundary:
      - Só persiste o feedback fornecido pelo operador.
      - Não reinterpreta o feedback nem roda a skill.
    acceptance:
      - O feedback original existe em f1/lekto-feedback.md.
      - Cobre os padrões transversais e os quatro contaminantes documentados.
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-feedback.md
    verifier:
      kind: shell
      command: test -f
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-feedback.md
      expectExitCode: 0
  - id: T-002
    title: Regenerar o briefing Lekto com a skill reescrita (sessão nova)
    summary: Regenera o briefing Lekto com a skill reescrita.
    status: done
    closedAt: 2026-06-19T17:06:31.000Z
    lastUpdated: 2026-06-19T17:06:31.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:06:31.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — f1/lekto-briefing-regenerated.md existe (495 linhas),
        gerado em sessao cega pelo operador; cobre Revisao/Login/Waitlist/Deck
        publico/Explorar (mapa de telas linhas 60-64), em pt-BR. Acceptance
        atendido. Adjudicacao de reincidencia diferida ao critico T-004.
    description: Em sessão nova, roda a skill design-brief contra o app Lekto e
      grava o briefing regenerado no caminho declarado, sem editar a skill nem
      os assets.
    scopeBoundary:
      - Roda a skill e grava o briefing no caminho declarado.
      - Não edita a skill nem os assets nesta fase.
    acceptance:
      - O briefing regenerado existe no caminho declarado.
      - Cobre as telas citadas no feedback (Revisão, Login, Waitlist, Deck
        público, Explorar).
      - Está em pt-BR.
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-briefing-regenerated.md
    verifier:
      kind: shell
      command: test -f
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-briefing-regenerated.md
      expectExitCode: 0
  - id: T-003
    title: Destilar a rubrica de não-reincidência dos padrões transversais do
      feedback (D9)
    summary: Destila a rubrica de não-reincidência dos padrões transversais do feedback.
    status: pending
    lastUpdated: 2026-06-19T09:40:00.000Z
    description: A partir de f1/lekto-feedback.md (T-001), converte cada padrão
      transversal do feedback num anti-sinal detectável, incluindo os quatro
      contaminantes documentados como anti-sinais explícitos. Não roda a skill
      nem o crítico.
    scopeBoundary:
      - Converte os padrões transversais do feedback em itens verificáveis.
      - Não roda a skill nem o crítico.
    acceptance:
      - A rubrica lista cada padrão transversal do feedback como item
        verificável.
      - Inclui os quatro contaminantes (limiar de swipe, axis-lock, a copy Vai,
        3 passos de onboarding) como anti-sinais.
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-rubric.md
    verifier:
      kind: shell
      command: test -f
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-rubric.md
      expectExitCode: 0
  - id: T-004
    title: "Crítico adversarial: contrastar briefing regenerado vs feedback (gate)"
    summary: Crítico adversarial contrasta o briefing regenerado contra o feedback.
    status: pending
    lastUpdated: 2026-06-19T09:40:00.000Z
    description: Roda um crítico fresco com o feedback (f1/lekto-feedback.md), a
      rubrica e o briefing regenerado, persiste o veredito e grava o marcador
      NAO-REINCIDENTE quando nenhum contaminante reaparece. Correções viram
      follow-up em T-005.
    scopeBoundary:
      - Roda o crítico e persiste o veredito.
      - Não corrige a skill aqui.
    acceptance:
      - O veredito classifica cada item da rubrica como ausente ou presente.
      - Afirma explicitamente se algum dos quatro contaminantes reaparece.
      - Grava o marcador NAO-REINCIDENTE quando nenhum reaparece.
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-verdict.md
    verifier:
      kind: shell
      command: test -f
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-verdict.md
      expectExitCode: 0
  - id: T-005
    title: Resolver o fork diferido D10 (escalar para a tag se houver sobre-vínculo)
    summary: "Resolve o fork D10: escala para a tag explícita se houver sobre-vínculo."
    status: pending
    lastUpdated: 2026-06-19T09:40:00.000Z
    description: Registra a resolução de D10 no design.md (questão aberta a) com
      base no veredito da F1, gravando o marcador F1-D10-RESOLVED; se a
      resolução for tag necessária, abre um follow-up emergido.
    scopeBoundary:
      - Registra a resolução de D10 no design.md e, se preciso, abre follow-up.
      - Não reescreve as outras decisões.
    acceptance:
      - O design.md registra D10 resolvido citando o veredito da F1, com o
        marcador F1-D10-RESOLVED.
      - Se a resolução for tag necessária, há um follow-up emergido.
    verifier:
      kind: shell
      command: grep -q 'F1-D10-RESOLVED'
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/design.md
      expectExitCode: 0
parked: []
emerged: []
planTitle: design-brief — repensar o modelo de autoridade do briefing
  (anti-congelamento de legado)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Validar (regenerar o briefing Lekto + contrastar = gate de não-reincidência)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F0 fechada/commitada (`acc3141`). F1 em curso (**2/5**). **T-002 DONE** — o operador regenerou o briefing Lekto em sessão NOVA e CEGA pela skill `design-brief` reescrita (F0); output `f1/lekto-briefing-regenerated.md` (495 linhas, pt-BR, cobre as 5 telas: Revisão/Login/Waitlist/Deck público/Explorar); verifier `test -f` EXIT=0, evidence gravada, `validate-state` ✓ (GATE-R2). T-001 (feedback persistido) já estava DONE.
- **Decision log:** (1) Resume gate: a árvore estava "suja" (`?? f1/lekto-briefing-regenerated.md` + ` M phases/…`); o operador confirmou que o `.md` novo É o output esperado de T-002 (geração cega) → não é corrupção, foi consumido ao fechar T-002. (2) **Achado p/ T-004 (NÃO pré-julgado aqui):** dos 4 contaminantes, **2 reaparecem TEXTUALMENTE** no briefing regenerado — copy `"Vai!"` (L236) e onboarding `3 passos` (L237/253/258); `SWIPE_THRESHOLD/80px` e `AXIS_LOCK/10px` AUSENTES. Mas ambos aparecem com enquadramento "hoje 3→2→1→Vai!" / "hoje" (estado-atual-do-código → lane de textura mutável), não como requisito congelado. Se é reincidência ou layering correto é a adjudicação do crítico **T-004** — não fechar isso fora dele. (3) T-003/T-004/T-005 PODEM rodar nesta sessão: T-003 (rubrica) consome o feedback — vê-lo é o trabalho, não contaminação; T-004 é um crítico fresco GIVEN feedback+rubrica+briefing (não cego); T-005 edita design.md. (4) Ordem restante: T-003 (rubrica → `f1/recurrence-rubric.md`) → T-004 (crítico → `f1/recurrence-verdict.md`, marcador `NAO-REINCIDENTE`) → T-005 (resolver D10 em design.md, marcador `F1-D10-RESOLVED`).
- **Single nextAction:** Iniciar T-003 — destilar a rubrica de não-reincidência a partir de `f1/lekto-feedback.md`, convertendo cada padrão transversal num anti-sinal detectável (incl. os 4 contaminantes como anti-sinais explícitos); output → `f1/recurrence-rubric.md`; verifier `test -f .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-rubric.md` (expectExitCode 0).
- **Verbatim state:** Briefing regenerado = `.atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-briefing-regenerated.md` (495 linhas). Feedback (input de T-003/T-004) = `.atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-feedback.md` (291 linhas). Contaminantes vigiados: `SWIPE_THRESHOLD=80px`, `AXIS_LOCK_DISTANCE=10px`, copy `"Vai!"`, onboarding 3 passos. T-002 evidence: EXIT=0, `verifiedAt: 2026-06-19T17:06:31.000Z`. F1-G1 verifier = `grep -q 'NAO-REINCIDENTE' f1/recurrence-verdict.md`; F1-G2 verifier = `grep -q 'F1-D10-RESOLVED' design.md`.
- **Uncommitted changes:** (snapshot pré-commit) ` M phases/f1-validar-regenerar-o-briefing-le.md` (T-002 done + evidence + handoff + rollup `tasksDone:2`) + `?? f1/lekto-briefing-regenerated.md` (output de T-002). A commitar como "T-002 done".
