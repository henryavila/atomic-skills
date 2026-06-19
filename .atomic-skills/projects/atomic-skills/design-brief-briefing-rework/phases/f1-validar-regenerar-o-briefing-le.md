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
lastUpdated: 2026-06-19T17:17:07.000Z
nextAction: "T-004 done (veredito NAO-LIMPO, 1 recaida = A4). Proximo: T-005
  resolve D10 — DECISAO DO OPERADOR (escalar p/ tag R10 vs modelo leve basta)."
parentPlan: design-brief-briefing-rework
phaseId: F1
tasksDone: 5
tasksTotal: 6
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
    status: done
    closedAt: 2026-06-19T17:12:42.000Z
    lastUpdated: 2026-06-19T17:12:42.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:12:42.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — f1/recurrence-rubric.md existe; destila os 12 padroes
        transversais (P1-P12) + os 4 contaminantes (A1-A4) em anti-sinais
        verificaveis, com frame de adjudicacao (citacao != recaida; julga
        enquadramento), invariantes-que-devem-sobreviver (secao C) e protocolo
        de veredito p/ T-004. Ancorada em design.md:147-156 + D3/D5/D6/D10.
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
    status: done
    closedAt: 2026-06-19T17:17:07.000Z
    lastUpdated: 2026-06-19T17:17:07.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:17:07.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — f1/recurrence-verdict.md existe (critico adversarial
        fresco rodou, veredito persistido). Resultado NAO-LIMPO — A1/A2 morreram
        no filtro D3, A3 ('Vai!') ok como textura mutavel; 1 recaida flagrada =
        A4 (onboarding '3 passos' cravado sem band-pin D5/credencial D6). P1-P12
        ok, invariantes C ok. Marcador de nao-reincidencia OMITIDO (ha recaida),
        logo gate F1-G1 grep falha (EXIT=1, esperado). Dispara D10; correcao em
        T-005.
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
  - id: T-006
    title: Corrigir o band-pin de contagens na skill (causa-raiz do A4)
    summary: Estende a guidance de band-pin (D5) para cobrir contagens/enumeracoes,
      nao so tempos. Emergente da recaida A4 (T-004), ratificada pelo operador
      (path C).
    status: done
    closedAt: 2026-06-19T17:31:45.000Z
    lastUpdated: 2026-06-19T17:31:45.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:31:45.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — grep 'every quantitative value alike' em
        design-brief.md. Guidance geral de band-pin para contagens adicionada ao
        source (design-brief.md) e ao emissor (screens-prompt.md); cobre
        'timings, counts, lengths' + caveat de roteamento a invariante R6. Sem
        injetar '3 passos' (sem teaching-to-the-test). validate-skills OK
        (15/15).
    description: A skill ja listava counts no escopo de band-pin, mas o unico
      exemplo de calibracao era tempo (~8s); o gerador cego nao generalizou para
      a contagem de passos do onboarding (recaida A4). Fix GERAL nos dois
      emissores que este rework possui, mostrando que toda grandeza (tempo,
      contagem, comprimento) recebe band-pin, com roteamento a R6 quando ha
      invariante.
    scopeBoundary:
      - Edita skills/core/design-brief.md e
        skills/shared/design-brief-assets/screens-prompt.md.
      - Nao edita o spec canonico three-layer-briefing.md (owned por
        skills-restructuring; coordenacao, nao reescrita).
      - Nao nomeia '3 passos' como exemplo (evita teaching-to-the-test).
    outputs:
      - kind: file
        path: skills/core/design-brief.md
      - kind: file
        path: skills/shared/design-brief-assets/screens-prompt.md
    verifier:
      kind: shell
      command: grep -q 'every quantitative value alike' skills/core/design-brief.md
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
- **Narrative:** F0 fechada/commitada (`acc3141`). F1 em curso (**4/5**). T-002 (briefing cego, `17abc36`), T-003 (rubrica) e **T-004 DONE** (crítico adversarial fresco rodou; veredito persistido em `f1/recurrence-verdict.md`). **Veredito NÃO-LIMPO: 1 recaída flagrada (A4 — onboarding "3 passos" cravado sem band-pin D5 / credencial D6).** A1/A2 morreram no filtro D3; A3 ("Vai!") ok como textura mutável; P1-P12 ok; invariantes C ok. Só falta **T-005** (resolver D10) — **bloqueado em decisão do operador**.
- **Decision log:** (1) Resume gate resolvido (operador confirmou o briefing cego). (2) Crítico: a única recaída é **A4** — o número "3" aparece 3× no briefing (L237-238/253/258) cravado, enquanto os vizinhos (~8s, 10 cartões) receberam band-pin e ele não. Falha D5 (sem banda) + D6 (sem credencial). (3) **Fork D10 (pré-registrado: qualquer sobre-vínculo ⇒ escalar p/ tag R10), MAS o crítico recomenda NÃO escalar** — A4 é band-pin faltante isolado, corrigível localmente; tag seria peso desproporcional p/ 1 item. Tensão real → **decisão do operador**, não auto-resolver (precedência humano > IA). (4) Independente do path, há um **fix de skill** a abrir como follow-up emergido (aplicar band-pin à contagem de onboarding) p/ a próxima regeneração não cravar. (5) **F1-G1 (`grep NAO-REINCIDENTE`) FALHA hoje** (EXIT=1) — correto, há recaída; só passa após re-gerar limpo OU defer explícito no phase-done.
- **Single nextAction:** Apresentar ao operador o fork D10 (3 opções: (A) modelo leve basta / não-tag + fix A4 como follow-up; (B) escalar p/ tag R10 conforme gatilho literal; (C) corrigir skill + regenerar cego + re-rodar crítico antes de decidir) e, com a escolha, executar T-005 — gravar `F1-D10-RESOLVED` no `design.md` citando o veredito F1, e abrir follow-up emergido se preciso.
- **Verbatim state:** Veredito = `.atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-verdict.md` (recaída A4). Critérios canônicos design.md:147-156; D10 design.md:103-110 + open-question (a) design.md:190-192. T-004 evidence EXIT=0 `verifiedAt: 2026-06-19T17:17:07.000Z`. F1-G1 verifier = `grep -q 'NAO-REINCIDENTE' f1/recurrence-verdict.md` (FALHA, EXIT=1); F1-G2 verifier = `grep -q 'F1-D10-RESOLVED' design.md` (ainda ausente). Marcador a gravar em T-005 = `F1-D10-RESOLVED` no design.md.
- **Uncommitted changes:** (snapshot pré-commit) ` M phases/f1-…le.md` (T-004 done + evidence + handoff + rollup `tasksDone:4`) + `?? f1/recurrence-verdict.md` (output de T-004). A commitar como "T-004 done". T-005 NÃO inicia sem a decisão do operador.
