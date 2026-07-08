---
schemaVersion: "0.1"
slug: design-brief-briefing-rework-f0-refazer-reescrever-o-modelo-de
title: Refazer (reescrever o modelo de autoridade)
summary: Reescreve a skill, os assets e o spec para o modelo camada-é-autoridade
  (filtro de mineração + band-pin).
goal: aplicar D3–D9 em design-brief.md, nos quatro assets de design-brief-assets
  e no spec canônico three-layer-briefing.md, sem regredir os invariantes
  legítimos.
status: done
branch: plan/design-brief
started: 2026-06-19T09:32:41.374Z
lastUpdated: 2026-06-19T15:17:51.103Z
nextAction: null
parentPlan: design-brief-briefing-rework
phaseId: F0
tasksDone: 5
tasksTotal: 5
gatesMet: 2
gatesTotal: 2
weightDone: 5
weightTotal: 5
exitGates:
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
      outputSummary: EXIT=0 — All 15 skills valid (schema_version 0.2) apos os fixes
        do review gate
    verifierLabel: "shell: npm run validate-skills"
    evidenceSummary: passed · 2026-06-19
  - id: F0-G2
    description: "Regressao de autoridade fechada: o filtro de mineracao esta
      presente e o preambulo expoe duas autoridades."
    status: met
    metAt: 2026-06-19T15:08:33.619Z
    verifier:
      kind: shell
      command: grep -q 'axis-lock' docs/design/design-brief-three-layer-briefing.md &&
        grep -qi 'calibra' skills/shared/design-brief-assets/screens-prompt.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T15:08:33.619Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — axis-lock no spec + calibra no screens-prompt; filtro
        presente e preambulo em duas autoridades
    verifierLabel: "shell: grep -q 'axis-lock' docs/design/design-brief-three-layer-br…"
    evidenceSummary: passed · 2026-06-19
stack:
  - id: 1
    title: Refazer (reescrever o modelo de autoridade)
    type: task
    openedAt: 2026-06-19T09:32:41.374Z
tasks:
  - id: T-001
    title: "Filtro de mineração em R2: minerar essência, nunca mecânica (D3)"
    summary: "Filtra a mineração de R2: essência comportamental, nunca constantes de
      mecânica."
    status: done
    closedAt: 2026-06-19T14:32:43.384Z
    lastUpdated: 2026-06-19T14:32:43.384Z
    description: Edita o passo R2 no spec canônico three-layer-briefing.md e em
      design-brief.md para minerar a essência comportamental e nunca a mecânica
      de implementação (px, axis-lock, debounce-ms, copy literal), com um
      exemplo de des-indução de uma constante para a essência.
    scopeBoundary:
      - Edita só o texto de R2 (mineração) nos dois arquivos.
      - Não toca R8/fixtures, R1, R4, R7 nem o passo de reconstrução app-map
        (Step 2).
    acceptance:
      - R2 nomeia minerar a essência comportamental e nunca a mecânica de
        implementação.
      - Lista px, axis-lock, debounce-ms e copy literal como fora de escopo.
      - Traz um exemplo canônico de des-indução de uma constante para a essência.
    verifier:
      kind: shell
      command: grep -q 'axis-lock' docs/design/design-brief-three-layer-briefing.md &&
        grep -qi 'debounce' skills/core/design-brief.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T14:32:43.384Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — grep 'axis-lock' three-layer-briefing.md && grep -i
        'debounce' design-brief.md both matched (filtro de mineração D3
        adicionado a R2 nos dois arquivos)
  - id: T-002
    title: Preâmbulo R9 reescrito para duas autoridades + band-pin (D4, D5)
    summary: Reescreve o preâmbulo R9 em duas autoridades e fixa a banda comportamental.
    status: done
    closedAt: 2026-06-19T14:38:41.669Z
    lastUpdated: 2026-06-19T14:38:41.669Z
    description: Reescreve o preâmbulo R9 e o §4 do screens-prompt mais o texto de
      R9 no spec para declarar camada-3 vinculante e camada-2 como calibração
      atual, com a banda comportamental vinculante e o valor exato melhorável.
    scopeBoundary:
      - Edita só o preâmbulo R9 e o §4 Modelo de interação no screens-prompt e o
        texto de R9 no spec.
      - Não toca as outras sete seções por tela nem a regra R4 de vocabulário
        proibido.
    acceptance:
      - O preâmbulo declara camada-3 vinculante e camada-2 como calibração atual.
      - O §4 expressa que a banda comportamental vincula e o valor exato é
        melhorável.
      - O carimbo único de tudo-vinculante some do preâmbulo.
    verifier:
      kind: shell
      command: grep -qi 'calibra' skills/shared/design-brief-assets/screens-prompt.md
        && grep -qi 'banda' skills/shared/design-brief-assets/screens-prompt.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T14:38:41.669Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — 'calibra' e 'banda' presentes em screens-prompt.md
        (preâmbulo R9 dividido em duas autoridades + band-pin no §4 e no texto
        R9 do spec; carimbo único removido)
  - id: T-003
    title: Código não vincula + invariantes de camada-2 roteados para guardrail R6
      (D6, D7)
    summary: Torna código não-vinculante e roteia invariantes de camada-2 ao
      guardrail R6.
    status: done
    closedAt: 2026-06-19T14:41:09.774Z
    lastUpdated: 2026-06-19T14:41:09.774Z
    description: Adiciona a cláusula de proveniência a R2 (código vira
      atual/referência; invariante exige corroboração de intenção) e a regra que
      roteia invariantes de camada-2 ao guardrail R6, documentando ~3 níveis
      como R6.
    scopeBoundary:
      - Adiciona a cláusula de proveniência a R2 e a regra de roteamento a R6 e
        ao §6.
      - Não reescreve R1, R4, R7 nem R8.
    acceptance:
      - O spec afirma que presença no código vira atual/referência e invariante
        exige corroboração de intenção.
      - Documenta ~3 níveis como guardrail R6, não como referência crua.
    verifier:
      kind: shell
      command: grep -qi 'proveni' docs/design/design-brief-three-layer-briefing.md &&
        grep -qi 'corrobora' docs/design/design-brief-three-layer-briefing.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T14:41:09.774Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — 'proveni' e 'corrobora' presentes no spec; cláusula de
        proveniência em R2 (código→atual/referência; invariante exige
        corroboração) + roteamento de ~3 expressões como guardrail R6 + item no
        §6
  - id: T-004
    title: Copy literal para a lane de textura + roteamento em R4 (D8 + Q-D8 do
      crítico)
    summary: Roteia copy literal ao canal de textura como conteúdo mutável.
    status: done
    closedAt: 2026-06-19T14:43:32.082Z
    lastUpdated: 2026-06-19T14:43:32.082Z
    description: Adiciona ao fixtures-recipe uma lane de copy literal como conteúdo
      real porém mutável e ajusta o R4 do screens-prompt para substituir copy
      pelo ato-de-fala e tratá-la como textura.
    scopeBoundary:
      - Adiciona a lane de copy ao fixtures-recipe e roteia copy no R4.
      - Não reformula a ladder de fontes reais de R8 nem o resto do
        fixtures-recipe.
    acceptance:
      - O fixtures-recipe ganha uma lane nomeada de copy literal marcada como
        mutável.
      - O R4 manda substituir copy literal pelo ato-de-fala e tratá-la como
        textura.
    verifier:
      kind: shell
      command: grep -qi 'copy' skills/shared/design-brief-assets/fixtures-recipe.md &&
        grep -q 'ato-de-fala'
        skills/shared/design-brief-assets/screens-prompt.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T14:43:32.082Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — lane 'Copy lane … copy (mutable)' adicionada ao
        fixtures-recipe + R4 do screens-prompt manda substituir copy literal
        pelo 'ato-de-fala' e tratá-la como textura mutável
  - id: T-005
    title: Alinhar o §6 checklist e a tabela DEFINE/DECIDE ao novo modelo;
      validate-skills verde
    summary: Alinha o checklist §6 e a tabela DEFINE/DECIDE ao novo modelo; valida o
      schema da skill.
    status: done
    closedAt: 2026-06-19T14:46:17.079Z
    lastUpdated: 2026-06-19T14:46:17.079Z
    description: Edita o §6 checklist e a tabela DEFINE/DECIDE do anti-contamination
      e design-brief.md para refletir D3–D8, e confirma que o schema da skill
      segue válido.
    scopeBoundary:
      - Edita só o §6 checklist e a tabela DEFINE/DECIDE.
      - Não altera a tabela de três camadas.
    acceptance:
      - O §6 inclui que nenhuma constante de mecânica ou copy literal é emitida
        como requisito.
      - O §6 inclui que todo valor de camada-2 é calibração-com-banda ou
        rastreia intenção.
      - npm run validate-skills passa.
    verifier:
      kind: shell
      command: npm run validate-skills
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T14:46:17.079Z
      passed: true
      exitCode: 0
      outputSummary: VALIDATE_EXIT=0 — '✓ All 15 skills valid (schema_version 0.2)';
        §6 ganhou os itens de mecânica/copy-nunca-requisito + camada-2
        calibração-com-banda/intenção, tabela DEFINE/DECIDE alinhada (banda
        binds; valor exato e copy literal do lado do agente)
parked: []
emerged: []
planTitle: design-brief — repensar o modelo de autoridade do briefing
  (anti-congelamento de legado)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Refazer (reescrever o modelo de autoridade)**.

## Decisions

- **T-001 (D3):** filtro de mineração adicionado a R2 em `docs/design/design-brief-three-layer-briefing.md` e `skills/core/design-brief.md` — minera-se a essência comportamental (ritmo/contagem/comprimento/modalidade) como essência + calibração atual; a mecânica (`px`, `axis-lock`, `debounce`-ms, copy literal) fica fora de R2, com exemplo de des-indução de constante (swipe `axis-lock:'x'`/`80px`/16ms → "um único gesto rápido, horizontal, com o polegar"). Verifier PASS (exit 0).
- **T-002 (D4, D5):** preâmbulo R9 do `screens-prompt.md` + texto R9 do spec divididos em **duas autoridades** (camada-3 vinculante; camada-2 = calibração atual com band-pin: banda vincula, valor exato ~8s melhorável); §4 Modelo de interação manda declarar banda + valor-como-calibração. Carimbo único de "tudo vinculante" removido. Verifier PASS (exit 0); de quebra o gate F0-G2 já passa.
- **T-003 (D6, D7):** spec `three-layer-briefing.md` ganhou em R2 a **cláusula de proveniência** (presença no código = atual/referência; invariante exige **corroboração da intenção de produto**) e em R6 a regra de **roteamento de invariantes de camada-2 → guardrail R6** (as ~3 expressões viram guardrail "proibido 4º nível com +N dias", não número cru), com item de eco no §6. Verifier PASS (exit 0).
- **T-004 (D8 + Q-D8):** `fixtures-recipe.md` ganhou a seção **Copy lane** (copy literal = textura real porém **mutável**, set `copy (mutable)`, palavras editáveis; o que vincula é o ato-de-fala em R4); R4 do `screens-prompt.md` manda **substituir copy literal pelo ato-de-fala** e tratá-la como textura. Verifier PASS (exit 0).
- **T-005 (D3–D8):** `anti-contamination.md` — tabela DEFINE/DECIDE realinhada (DEFINE = banda R2 + invariantes corroborados como guardrail R6 + ownership humano×sistema; DECIDE/may-improve = valor exato dentro da banda + copy literal mutável + forma) e §6 checklist ganhou os dois itens (nenhuma constante de mecânica/copy literal como requisito; todo valor de camada-2 é calibração-com-banda ou rastreia intenção). Tabela de três camadas intocada. Verifier PASS (`npm run validate-skills` exit 0, 15 skills válidas).

## Session handoff

- **Narrative:** Fase F0 (Refazer o modelo de autoridade) **CONCLUÍDA via phase-done**. 5/5 tasks fechadas com verifier PASS; exit gates F0-G1 (`validate-skills`) e F0-G2 (`axis-lock`+`calibra`) `met` com evidence; `reviewGate: passed` (mode local, at `236d65b6`). O review gate achou 6 defeitos de coerência (3 critical, 2 major, 1 minor) — todos corrigidos no commit `236d65b6`. Lessons L1 (sweep de refactor) e L2 (grep ≠ coerência) ratificadas e gravadas. Plano avançado: `currentPhase` F0→F1; iniciativa F0 arquivada; F1 ativada.
- **Decision log:** (1) trabalho R8 órfão commitado em separado (`b32ada5`) antes da F0; (2) commit por-task; (3) preâmbulo R9 como bloco emit-verbatim em pt-BR (idioma de saída canônico, espelha o R9 pt-BR do spec); (4) T-005 ficou só em `anti-contamination.md`; (5) review gate corrigiu inclusive a tabela de 3 camadas (fora da scopeBoundary da T-005) — coerência de fase supera o escopo de task individual.
- **Single nextAction:** Iniciar a F1 **em sessão nova** (o plano determina que a regeneração do briefing Lekto é para sessão nova): F1 T-001 — obter/persistir o feedback original do agente de design sobre o briefing do Lekto.
- **Verbatim state:** F0-G1 `npm run validate-skills` → exit 0 / `All 15 skills valid (schema_version 0.2)`; F0-G2 `grep -q 'axis-lock' docs/design/design-brief-three-layer-briefing.md && grep -qi 'calibra' skills/shared/design-brief-assets/screens-prompt.md` → exit 0; `reviewGate.at = 236d65b6f7d0eb7b2a81b006cc276af650027a6e`.
- **Uncommitted changes:** a registrar no commit do phase-done.

## Links

- Plan: `.atomic-skills/projects/atomic-skills/design-brief-briefing-rework/plan.md`
- Spec canônico: `docs/design/design-brief-three-layer-briefing.md`
- Lessons: `.atomic-skills/projects/atomic-skills/design-brief-briefing-rework/lessons/design-brief-briefing-rework-f0-refazer-reescrever-o-modelo-de.md`

## Self-review against code-quality gates

- **G1 read-before-claim**: 5 tasks fechadas, cada uma com `evidence` ligando o verifier rodado (file:line/comando) que a fechou; review-gate fixes verificados lendo cada `file:line` antes do edit.
- **G2 soft-language**: `nextAction` + descrições de task + descrições de critério escaneados pela ban-list (should/probably/may/deveria/talvez/parece) — 0 violações; claims de conclusão são `evidence passed:true`.
- **G6 reference-or-strike**: 2 exit criteria (F0-G1, F0-G2) `met` com `evidence` populada; literais do handoff são caminhos/comandos/shas verbatim.
- **Codex review**: SKIPPED — review gate rodou em `--mode=local` (diff não-destrutivo: 61 inserções / 15 deleções, sem deleção de arquivo). 6 achados, todos corrigidos.
- **Review gate (G2)**: gravado no descritor da fase como `reviewGate: { status: passed, at: 236d65b6, mode: local, verifiedAt: 2026-06-19T15:08:33.619Z }`.
- **Lessons (G1)**: 2 lessons distiladas (L1, L2; ambas reusable, confidence 2) em `lessons/design-brief-briefing-rework-f0-refazer-reescrever-o-modelo-de.md`, ratificadas pelo operador. A fase-start da F1 dispõe as reusable+open.
