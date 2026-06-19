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
lastUpdated: 2026-06-19T15:17:51.103Z
nextAction: "T-001 done. T-002 (regenerar briefing) exige SESSAO NOVA + caminho do codigo Lekto — handoff p/ gerador cego."
parentPlan: design-brief-briefing-rework
phaseId: F1
tasksDone: 1
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
    status: pending
    lastUpdated: 2026-06-19T09:40:00.000Z
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
- **Narrative:** F0 fechada/commitada (`acc3141`). F1 em curso (1/5). **T-001 DONE** — o operador re-forneceu o feedback original do Lekto (versão com itens novos: 12 padrões transversais), persistido verbatim em `f1/lekto-feedback.md` (291 linhas); verifier `test -f` EXIT=0, evidence gravada, `validate-state` ✓ (GATE-R2). Parado **antes de T-002** num limite metodológico de sessão (ver decisão 2).
- **Decision log:** (1) Tree "sujo" no resume = só bump de `generatedAt` em `focus.json` → não bloqueia. (2) **T-002 NÃO pode rodar nesta sessão.** A task é "regenerar o briefing Lekto com a skill reescrita **(sessão nova)**" e é o gate de não-reincidência (D9): o gerador tem de estar **CEGO ao feedback** — se ele já viu os 4 contaminantes (como esta sessão viu inteira), evita-os por memória, não pelo filtro D3 da skill, e o gate false-greens. Logo T-002 exige um contexto fresco/cego. (3) T-002 também precisa do **código real do app Lekto** (a skill minera `web/app/`); esse código não está neste repo (atomic-skills) — o operador tem de apontar o caminho. (4) Ordem restante: T-002 (regenerar, cego) → T-003 (rubrica, a partir do feedback) → T-004 (crítico/veredito NAO-REINCIDENTE) → T-005 (resolver D10, marcador F1-D10-RESOLVED).
- **Single nextAction:** Iniciar T-002 num **gerador cego ao feedback** (sessão nova OU subagente sem o feedback no contexto), rodando a skill `atomic-skills:design-brief` contra o código do app Lekto (caminho a fornecer pelo operador), output → `f1/lekto-briefing-regenerated.md`. Decisão de modo pendente com o operador.
- **Verbatim state:** verifier T-002 = `test -f .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-briefing-regenerated.md` (expectExitCode 0); acceptance: cobre Revisão/Login/Waitlist/Deck público/Explorar, em pt-BR. Os 4 contaminantes que o gate vigia: `SWIPE_THRESHOLD=80px`, `AXIS_LOCK_DISTANCE=10px`, copy `"Vai!"`, onboarding 3 passos. T-001 evidence: EXIT=0, `verifiedAt: 2026-06-19T15:53:43.000Z`.
- **Uncommitted changes:** ` M .atomic-skills/focus.json` (timestamp) + `f1/lekto-feedback.md` (novo) + `phases/f1-validar-regenerar-o-briefing-le.md` (T-001 done + handoff). T-001 ainda não commitada.
