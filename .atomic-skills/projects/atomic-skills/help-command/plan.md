---
schemaVersion: "0.1"
slug: help-command
title: Comando `help` — GPS de terminal da skill `project`
version: "1.0"
status: active
started: 2026-07-05T11:37:28.309Z
lastUpdated: 2026-07-05T12:58:58Z
currentPhase: F1
parallelismAllowed: false
principles:
  - id: P1
    title: Read-only, zero-mutação, fail-open
    body: "`help` nunca muta estado, nunca aborta: em qualquer erro de leitura emite
      o que conseguiu. Não substitui o resumo no-args (que continua o resumo
      barato de 5 linhas). Não toca aiDeck nem HTML."
  - id: P2
    title: nextAction é a fonte-da-verdade do comando
    body: "O `nextStep.command` vem exclusivamente do campo `nextAction` persistido
      (autorado a cada `done`/transição). `help` nunca recomputa nem inventa o
      comando: lê `nextAction` verbatim. A lista de precedência só fornece o
      comando quando `nextAction` está ausente/vazio, marcado como fallback."
  - id: P3
    title: Lógica determinística num helper, não em prosa
    body: A classificação estado→próximo-passo vive num helper puro-leitura
      (`scripts/compute-help.js`), no padrão dos detectores já existentes — não
      em prosa que raciocina do zero. Reusa o grafo de transições real de
      `project-transitions.md`; não inventa um novo grafo.
glossary:
  - term: spineStage
    definition: posição no ciclo de vida (IDEIA a ARCHIVE) computada do estado.
  - term: commandSource
    definition: "`persisted` quando o comando vem do `nextAction`; `fallback` quando
      derivado da lista de precedência."
  - term: caminho de contrato
    definition: "`docs/design/project-onboarding/index.html` — o caminho fixo onde
      `help --html` procura o guia visual."
phases:
  - id: F0
    slug: help-command-f0-contrato-esqueleto
    title: Contrato + esqueleto
    goal: Registrar `help` no router, criar o asset detalhe stub e catalogar o
      comando — dispatch + descriptor + no-op verde, sem render completo.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 5 criteria to meet
      criteria:
        - id: G-1
          description: validate-skills passa (exit 0)
          status: met
          metAt: 2026-07-05T12:33:53Z
          verifier:
            kind: shell
            command: npm run validate-skills
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-05T12:33:53Z
            exitCode: 0
            passed: true
            outputSummary: "npm run validate-skills → All 15 skills valid (schema_version 0.2)"
        - id: G-2
          description: strip-test de compatibilidade passa (exit 0)
          status: met
          metAt: 2026-07-05T12:33:53Z
          verifier:
            kind: test
            runner: node --test
            pattern: tests/compatibility.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-07-05T12:33:53Z
            exitCode: 0
            testsCollected: 128
            passed: true
            outputSummary: "node --test tests/compatibility.test.js → tests 128, pass 128, fail 0"
        - id: G-3
          description: uma linha da dispatch table (âncora `|`) casa `help` E resolve para
            project-help.md
          status: met
          metAt: 2026-07-05T12:33:53Z
          verifier:
            kind: shell
            command: grep -qE '^\|.*help.*project-help\.md' skills/core/project.md
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-05T12:33:53Z
            exitCode: 0
            passed: true
            outputSummary: "grep -qE '^\\|.*help.*project-help\\.md' skills/core/project.md → match (exit 0)"
        - id: G-4
          description: o asset project-help.md existe no disco
          status: met
          metAt: 2026-07-05T12:33:53Z
          verifier:
            kind: shell
            command: test -f skills/shared/project-assets/project-help.md
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-05T12:33:53Z
            exitCode: 0
            passed: true
            outputSummary: "test -f skills/shared/project-assets/project-help.md → exists (exit 0)"
        - id: G-5
          description: "o catálogo tem a entrada `name: help` com signature `--html`"
          status: met
          metAt: 2026-07-05T12:33:53Z
          verifier:
            kind: shell
            command: "awk '/name: help/{f=1} f&&/signature:/{print;exit}' meta/catalog.yaml
              | grep -q -- --html"
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-05T12:33:53Z
            exitCode: 0
            passed: true
            outputSummary: "awk name:help → signature line matches --html (exit 0)"
    status: done
    reviewGate:
      status: passed
      at: 54bf8a7
      mode: local
      verifiedAt: 2026-07-05T12:40:24Z
    businessIntent:
      value: Estabelece o contrato do comando `help` (router + asset + catálogo) para
        a camada GPS de terminal existir e ser descoberta, ainda sem renderizar.
      workflow: O dev roda `/atomic-skills:project help`; o router resolve para o
        asset `project-help.md`; o catálogo lista `help [--html]`.
      rules: read-only, zero-mutação, fail-open; nenhuma lógica no router
        (byte-budget); abstração de ferramentas + block-form if no asset.
      outOfScope: Nenhuma classificação de estado nem render (isso é F1/F2); não toca
        aiDeck nem gera o HTML.
      doneWhen: "`help` resolve na dispatch table para `project-help.md`,
        `validate-skills` verde e strip-test de compatibilidade limpo."
  - id: F1
    slug: help-command-f1-o-mapa-estado-proximo-passo-como-helper
    title: O mapa estado→próximo-passo como helper determinístico
    goal: Construir scripts/compute-help.js (puro-leitura, fail-open) que classifica
      o estado pela lista de precedência e lê nextAction verbatim, coberto por
      fixtures um-por-estado + sobrepostos que provam a ordem.
    dependsOn:
      - F0
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: compute-help.test.js passa (mapa de decisão coberto + fail-open
            provado)
          status: met
          metAt: 2026-07-05T15:21:15Z
          verifier:
            kind: test
            runner: node --test
            pattern: tests/help/compute-help.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-07-05T15:30:14Z
            exitCode: 0
            testsCollected: 27
            passed: true
            outputSummary: "node --test tests/help/compute-help.test.js → tests 27, pass 27, fail 0 (post review-fix)"
    reviewGate:
      status: passed
      at: c3c2135540fd02afb81769c5b88eb0eb385f9473
      mode: local
      verifiedAt: 2026-07-05T15:30:14Z
    status: done
    businessIntent:
      value: "F1 constrói o cérebro determinístico do `help`: o helper puro-leitura
        compute-help.js que classifica o estado real (projeto/plano/fase, rollups,
        drift) em spineStage + próximo-passo. Valor: a resposta \"onde estou / qual o
        próximo passo\" passa a vir de lógica testável e reutilizável, não de prosa que
        raciocina do zero — habilitando o render da F2. Valor pro usuário:
        confiabilidade (lê nextAction verbatim, degrada graciosamente)."
      workflow: "Retomada de projeto — o dev roda `help` e precisa saber, numa tela, o
        estágio do ciclo de vida e o comando exato a rodar em seguida."
      rules: "puro-leitura / zero-mutação / fail-open (P1); nextStep.command =
        nextAction persistido lido verbatim, precedência só como fallback (P2); reusa
        o grafo de transições real e detect-completion.js — não reimplementa (P3);
        contrato de exit-code do detector honrado (parsear JSON em exit 0 e 1;
        fail-open só em exit 2, stdout não-parseável ou falha de spawn)."
      outOfScope: "Nenhum rendering do bloco de ensino nem mini-mapa ASCII (isso é
        F2); não gera nem abre o HTML; não toca aiDeck; não altera o resumo no-args de
        5 linhas."
      doneWhen: "compute-help.test.js verde com o mapa de decisão coberto (um fixture
        por estado da precedência + os 3 sobrepostos que provam a ordem + o par
        presente/ausente de commandSource) e o fail-open provado."
  - id: F2
    slug: help-command-f2-rendering-do-bloco-de-ensino
    title: Rendering do bloco de ensino
    goal: O asset chama compute-help.js e formata o bloco de 5 linhas + mini-mapa
      ASCII com "você está aqui"; adicionar a flag help --html que abre o guia
      visual pelo caminho de contrato fixo, fail-open quando ausente.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: G-1
          description: smoke de render verde contra fixture
          status: pending
          verifier:
            kind: test
            runner: node --test
            pattern: tests/help/render-smoke.test.js
        - id: G-2
          description: html-resolve.test.js verde
          status: pending
          verifier:
            kind: test
            runner: node --test
            pattern: tests/help/html-resolve.test.js
        - id: G-3
          description: eyeball num projeto real registrado como evidência (com campos
            suficientes p/ auditar depois)
          status: pending
          verifier:
            kind: manual
            description: "Rodar `help` num projeto real e registrar a evidência no
              phase-done da F2 (initiative evidence/lessons) com estes campos:
              comando exato rodado, projeto/plano-slug alvo, trecho do bloco
              renderizado observado, data, e resultado pass/fail. Uma nota sem
              esses campos NÃO satisfaz o gate."
    status: pending
  - id: F3
    slug: help-command-f3-guarda-de-fidelidade-help-nunca-cita-um
    title: Guarda de fidelidade (help nunca cita um verbo que não existe)
    goal: Um teste garante que todo comando do domínio de saída existe no catálogo E
      respeita a signature declarada; fechar o cross-link das 3 camadas (HTML e
      terminal).
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: suíte cheia verde (npm test)
          status: pending
          verifier:
            kind: shell
            command: npm test
        - id: G-2
          description: help-vocab.test.js passa
          status: pending
          verifier:
            kind: test
            runner: node --test
            pattern: tests/help/help-vocab.test.js
    status: pending
references: []
planActive: true
planTitle: Comando `help` — GPS de terminal da skill `project`
---

# Comando `help` — GPS de terminal da skill `project`

## 1. Context

Dá a quem retoma um projeto (ou está no meio dele) uma resposta de uma tela para "onde estou e qual o próximo passo?" — o padrão BMAD, mas derivado do estado real (`.atomic-skills/`) e do grafo de transições, não de um roteiro codificado. É a camada "GPS": complementa o HTML (que ensina o sistema) e o aiDeck (que mostra o estado vivo). `help` e o guia visual são o MESMO conceito em dois renderizadores: o HTML é o guia em página, `help` é o guia no terminal, e `help --html` abre a versão visual.

## 2. Inviolable principles

- **P1 Read-only, zero-mutação, fail-open** — `help` nunca muta estado, nunca aborta: em qualquer erro de leitura emite o que conseguiu. Não substitui o resumo no-args (que continua o resumo barato de 5 linhas). Não toca aiDeck nem HTML.
- **P2 nextAction é a fonte-da-verdade do comando** — O `nextStep.command` vem exclusivamente do campo `nextAction` persistido (autorado a cada `done`/transição). `help` nunca recomputa nem inventa o comando: lê `nextAction` verbatim. A lista de precedência só fornece o comando quando `nextAction` está ausente/vazio, marcado como fallback.
- **P3 Lógica determinística num helper, não em prosa** — A classificação estado→próximo-passo vive num helper puro-leitura (`scripts/compute-help.js`), no padrão dos detectores já existentes — não em prosa que raciocina do zero. Reusa o grafo de transições real de `project-transitions.md`; não inventa um novo grafo.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Reviews

- internal: 2026-07-05 — self-loop adversarial review, 0 findings de severidade major+. Checks 1–7 aplicados (contradições, deps, ordenação, ambiguidade, schema, file-lists, cobertura de testes), citando frontmatter `phases:` + interior das tasks F0. Alignment note: o verifier de F2/T-001 (`tests/help/render-smoke.test.js`) é criado pela própria task — decisão D4 do design (render-harness determinístico), intencional.
- codex: 2026-07-05 — cross-model (gpt-5-codex), verdict `needs_changes`, counts finais `{blocker:0, critical:0, major:3, minor:1}` (blind tinha 1 critical, dropado pela constraint do `nextAction`). Arquivo: `.atomic-skills/reviews/2026-07-05-0858-help-command.md`. Majors = precisão dos verifiers (F0 gate/verifiers, reuse do transition-graph em F1, contrato runtime de `help --html` em F2) + minor (local da evidência manual F2/G-3).

## Self-review against code-quality gates

- **G1 read-before-claim**: N/A — o plano captura trabalho inteiramente novo (comando `help`); nenhuma afirmação sobre código existente sem fonte. Os únicos arquivos existentes citados (`skills/core/project.md`, `tests/compatibility.test.js`) foram verificados no disco.
- **G2 soft-language**: escaneado o corpo do plano pela ban-list; 0 ocorrências (o corpo é PT; "só"/"nunca" não são hedge).
- **G6 reference-or-strike**: cada critério de exit-gate carrega um `verifier:` (frontmatter linhas 52–67, 96–99, 116–133, 150–159); a única `manual` (F2/G-3) declara o passo de verificação. 0 asserções bare.
- **G10 gate-must-be-able-to-fail**: cada exit-criterion tem um `verifier:` determinístico que fica vermelho quando o alvo falha (grep sem match, teste falhando, `npm test` não-zero); a `manual` de F2/G-3 falha quando o eyeball não confere. Nenhum critério de vaidade.
