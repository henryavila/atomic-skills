---
schemaVersion: "0.1"
slug: design-brief-briefing-rework
title: design-brief — repensar o modelo de autoridade do briefing
  (anti-congelamento de legado)
version: "1.0"
status: active
started: 2026-06-19T09:32:41.374Z
lastUpdated: 2026-06-19T15:17:51.103Z
branch: plan/design-brief
currentPhase: F1
parallelismAllowed: false
principles:
  - id: P1
    title: Único vetor
    body: o agente de design nunca leu o código antigo; toda contaminação entra pelo
      prompt gerado, logo o conserto é só na skill, nos assets e no spec, nunca
      no agente.
  - id: P2
    title: Filtro-primeiro
    body: minerar a essência comportamental, nunca a mecânica de implementação (px,
      axis-lock, debounce-ms, copy literal); a mecânica fica fora do escopo de
      R2 na origem.
  - id: P3
    title: Camada-é-autoridade
    body: camada-3 (filosofia/quem-decide) vincula; camada-2 (interação) é a
      calibração atual com a banda travada e o valor exato melhorável; sem tag
      nova por valor.
  - id: P4
    title: Código não vincula
    body: presença no código marca o valor como atual/referência; só corroboração de
      intenção de produto eleva um valor a invariante.
  - id: P5
    title: Sem regressão
    body: "o band-pin trava as duas falhas: nem silêncio (o valor segue declarado)
      nem sub-especificação (a banda vincula)."
  - id: P6
    title: Tag por evidência
    body: a tag explícita por valor é upgrade aditivo decidido pela F1, não cravada
      agora.
glossary:
  - term: Camada 1 / 2 / 3
    definition: forma visual (silêncio) / modelo de interação (especificar) /
      filosofia-quem-decide (guardrail vinculante).
  - term: Filtro de mineração
    definition: "regra negativa em R2: minera a essência comportamental e descarta a
      mecânica de implementação."
  - term: Band-pin
    definition: a banda comportamental (cadência da ordem de segundos) vincula; o
      valor exato (~8s) é o atual, melhorável dentro da banda.
  - term: Calibração atual
    definition: valor de camada-2 mostrado como o que o app faz hoje, melhorável
      pelo agente; oposto de silêncio e de requisito.
  - term: Gate de não-reincidência
    definition: "a F1: regenerar o briefing Lekto com a skill reescrita e contrastar
      com o feedback via crítico adversarial."
phases:
  - id: F0
    slug: design-brief-briefing-rework-f0-refazer-reescrever-o-modelo-de
    title: Refazer (reescrever o modelo de autoridade)
    summary: Reescreve a skill, os assets e o spec para o modelo camada-é-autoridade
      (filtro de mineração + band-pin).
    goal: aplicar D3–D9 em design-brief.md, nos quatro assets de design-brief-assets
      e no spec canônico three-layer-briefing.md, sem regredir os invariantes
      legítimos.
    dependsOn: []
    subPhaseCount: 5
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: design-brief.md, os quatro assets e o spec canonico aplicam D3-D9 e
            validate-skills passa.
          status: met
          metAt: 2026-06-19T15:08:33.619Z
          verifier:
            kind: shell
            command: npm run validate-skills
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-19T15:08:33.619Z
            passed: true
            exitCode: 0
            outputSummary: "EXIT=0 — All 15 skills valid (schema_version 0.2) apos os fixes do review gate"
        - id: F0-G2
          description: "Regressao de autoridade fechada: o filtro de mineracao esta
            presente e o preambulo expoe duas autoridades."
          status: met
          metAt: 2026-06-19T15:08:33.619Z
          verifier:
            kind: shell
            command: grep -q 'axis-lock' docs/design/design-brief-three-layer-briefing.md &&
              grep -qi 'calibra'
              skills/shared/design-brief-assets/screens-prompt.md
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-19T15:08:33.619Z
            passed: true
            exitCode: 0
            outputSummary: "EXIT=0 — axis-lock no spec + calibra no screens-prompt; filtro presente e preambulo em duas autoridades"
    reviewGate:
      status: passed
      at: 236d65b6f7d0eb7b2a81b006cc276af650027a6e
      mode: local
      verifiedAt: 2026-06-19T15:08:33.619Z
    status: done
  - id: F1
    slug: design-brief-briefing-rework-f1-validar-regenerar-o-briefing-le
    title: Validar (regenerar o briefing Lekto + contrastar = gate de
      não-reincidência)
    summary: Regenera o briefing Lekto em sessão nova e contrasta com o feedback
      (gate de não-reincidência).
    goal: em sessão nova, regenerar o briefing do Lekto com a skill reescrita,
      destilar a rubrica dos padrões transversais do feedback, contrastar via
      crítico adversarial e resolver o fork diferido D10.
    dependsOn:
      - F0
    subPhaseCount: 5
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: Briefing Lekto regenerado e contrastado; o veredito de
            nao-reincidencia existe e nenhum dos quatro contaminantes
            documentados reaparece como requisito.
          status: pending
          verifier:
            kind: shell
            command: grep -q 'NAO-REINCIDENTE'
              .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-verdict.md
            expectExitCode: 0
        - id: F1-G2
          description: Fork D10 resolvido e registrado no design.md.
          status: pending
          verifier:
            kind: shell
            command: grep -q 'F1-D10-RESOLVED'
              .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/design.md
            expectExitCode: 0
    status: active
references:
  - kind: file
    path: .atomic-skills/projects/atomic-skills/design-brief-source-of-truth/plan.md
    label: Catálogo app-map (fonte-de-verdade) — origem do Step 2/regime que o
      design-brief consome (sem dependência)
  - kind: file
    path: .atomic-skills/projects/atomic-skills/app-map-conflict-arbitration/plan.md
    label: Plano coordenado no mesmo branch plan/design-brief — nota de coordenação,
      sem dependsOn
planTitle: design-brief — repensar o modelo de autoridade do briefing
  (anti-congelamento de legado)
planActive: true
---

# design-brief — repensar o modelo de autoridade do briefing (anti-congelamento de legado)

## 1. Context

Reescreve como o `design-brief` confere autoridade a um valor minerado, para que invariantes de produto
vinculem mas incidentais de implementação legada passem como calibração atual que o agente de design pode
melhorar. Conserto ratificado em `design.md` após painel gate-mode (3 vozes + contrária) e crítico
adversarial Aprovado. Duas fases: F0 reescreve a skill + assets + spec canônico (D3–D9); F1, em sessão
nova, regenera o briefing Lekto e contrasta com o feedback (gate de não-reincidência), resolvendo o fork
diferido D10.

**Linhagem (branch `plan/design-brief`).** Este é o **3º plano sequencial** do skill `design-brief`:
(1) `design-brief-source-of-truth` — reconstrução da superfície de páginas / catálogo app-map (archived);
(2) `app-map-conflict-arbitration` — descritor de conflito rico + canal de arbitragem (archived);
(3) **este** — modelo de autoridade / anti-contaminação. Os três são sobre o **mesmo skill**, em sequência;
os dois anteriores já estavam **arquivados** quando este começou (nunca coexistiram ativos — não houve
frente concorrente real). O **spec canônico R1–R9** que a F0 edita é **owned pelo `skills-restructuring`**
(F5/D5, ativo em outro branch) — daí a nota de coordenação (`design.md` Open question (b)). A necessidade
atual surgiu do **feedback do agente de design sobre o briefing do Lekto**, ao dogfoodar o skill.

## 2. Inviolable principles

- **P1 Único vetor** — o agente de design nunca leu o código antigo; toda contaminação entra pelo prompt gerado, logo o conserto é só na skill, nos assets e no spec, nunca no agente.
- **P2 Filtro-primeiro** — minerar a essência comportamental, nunca a mecânica de implementação (px, axis-lock, debounce-ms, copy literal); a mecânica fica fora do escopo de R2 na origem.
- **P3 Camada-é-autoridade** — camada-3 (filosofia/quem-decide) vincula; camada-2 (interação) é a calibração atual com a banda travada e o valor exato melhorável; sem tag nova por valor.
- **P4 Código não vincula** — presença no código marca o valor como atual/referência; só corroboração de intenção de produto eleva um valor a invariante.
- **P5 Sem regressão** — o band-pin trava as duas falhas: nem silêncio (o valor segue declarado) nem sub-especificação (a banda vincula).
- **P6 Tag por evidência** — a tag explícita por valor é upgrade aditivo decidido pela F1, não cravada agora.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## 4. Self-review against code-quality gates

- **G1 read-before-claim**: N/A para código novo — o plano não afirma comportamento de código existente; as decisões D3–D10 vêm do `design.md` crítico-aprovado, que carrega as citações `verified_by` (design-brief.md, three-layer-briefing.md, screens-prompt.md, anti-contamination.md, fixtures-recipe.md). Os 5 arquivos-alvo da F0 + o script `validate-skills` foram confirmados existentes na revisão interna.
- **G2 soft-language**: ban-list (should/probably/may/typically/usually + hedges pt-BR deveria/talvez/provavelmente/geralmente/parece-que/acho-que) escaneada no `plan.md` + nas duas iniciativas: **0 ocorrências**.
- **G6 reference-or-strike**: cada exit-criterion (F0-G1/G2, F1-G1/G2) carrega um `verifier` determinístico; cada tarefa carrega `verifier` + `acceptance`. Princípios P1–P6 são decisões normativas do design ratificado, não asserções factuais sobre código.

## 5. Reviews

- **Internal review (Stage 8a)**: 1 finding MAJOR encontrado e corrigido inline — F1 não tinha tarefa de aquisição do feedback original (arquivo-fonte ausente do disco); adicionada F1 T-001 (obter/persistir o feedback), demais tarefas renumeradas, `subPhaseCount` F1 4→5. Reread limpo; todos os 3 arquivos válidos no schema.
- **Codex review (Stage 8b)**: SKIPPED — opção do operador (o `design.md` já passou por crítico fresco independente Aprovado; o plano passou na revisão interna).

## 6. Status / sequenciamento

**ATIVO** (único plano de `plan/design-brief`). Breve histórico de 2026-06-19: este plano chegou a ser
pausado por **engano do agente** — eu li o índice `PROJECT-STATUS.md` (stale, mostrava
`app-map-conflict-arbitration` como `active`) e relatei uma **frente concorrente R-FOCUS-01 (`⧉`) que não
existia** — o app-map já estava `archived` (plan-done F1, reviewGate(both)). A pausa foi reação a essa
informação errada. Conferido o `status` real no `plan.md` do app-map: **nunca houve concorrência**; este é
o único plano do worktree. Reativado no mesmo dia. **Lição:** conferir `status` no `plan.md`, nunca confiar
só na tabela do `PROJECT-STATUS.md`.
