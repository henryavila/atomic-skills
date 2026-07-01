---
schemaVersion: "0.1"
slug: phase-materialization
title: Materialização lazy de fases + gate de validação de negócio
version: "1.0"
status: active
started: 2026-06-29T13:19:41.314Z
lastUpdated: 2026-07-01T10:29:08.000Z
branch: plan/phase-materialization
currentPhase: F3
parallelismAllowed: false
principles:
  - id: P1
    title: Heurísticas e formato-fonte do decompose CONGELADOS (R-ORCH-10)
    body: "O refactor de `src/decompose.js` é estritamente mecânico: só a ESTRUTURA
      das funções muda. As heurísticas de extração (`extractTasks` `:414`,
      `extractGoal` `:275`, os regexes no topo do arquivo) e o formato-fonte
      markdown NÃO mudam. Provado por snapshot de output byte-idêntico sobre os
      fixtures de decompose existentes."
  - id: P2
    title: Backward-compat aditivo (nenhum plano congela no dia 1)
    body: Todo campo novo de schema é OPCIONAL (properties-only, fora do
      `required`); planos legados continuam validando. A mudança de
      comportamento afeta apenas `new plan` e ativações futuras
      (backfill-on-activation, D5). Nenhuma migração de planos existentes é
      executada — eles seguem totalmente materializados e funcionais.
  - id: P3
    title: aiDeck permanece agnóstico
    body: "`businessIntent` vive no estado versionado do consumer
      (`.atomic-skills/`); o dashboard apenas lê. Nenhuma lógica de domínio
      (espinha canônica, regras de negócio) entra no aiDeck. Respeita
      `feedback-aideck-stays-agnostic`."
  - id: P4
    title: Soluções no nível da skill (detectores replicáveis, não ad-hoc)
    body: Os gates são detectores determinísticos zero-token (`scripts/find-*.js`)
      no mesmo molde de `find-missing-summaries.js`, não checagens manuais ou
      scripts descartáveis. A eficácia anti-rubber-stamp do
      blank-field-prompting é uma hipótese declarada (D9), não uma claim de
      benefício garantido.
glossary:
  - term: Materialização lazy FORTE (D1)
    definition: "`new plan` materializa só a iniciativa de F0 (com tasks) +
      descritores `phases[]` completos para F1..N; F1..N não ganham arquivo de
      iniciativa nem tasks extraídas até a fase ativar."
  - term: Descritor-only vs materializada
    definition: 'duas estados de fase distintos: "descritor-only, pendente de
      materialização" (sem arquivo de iniciativa) e "materializada" (com
      arquivo). A distinção é pela ausência do arquivo de iniciativa, NÃO pelo
      `subPhaseCount`.'
  - term: "`subPhaseCount:0` placeholder honesto"
    definition: num descritor F1..N significa "número desconhecido até
      materializar", não "fase materializada vazia".
  - term: Espinha canônica do `businessIntent`
    definition: "5 campos fixos: `value` (valor de negócio + de cliente),
      `workflow`, `rules`, `outOfScope` (non-goal de 1ª classe), `doneWhen`
      (AC-like por fase) + cauda opcional `derived[]`."
  - term: Blank-field-prompting (D3.4)
    definition: o verbo `materialize` apresenta os campos da espinha em
      branco/marcados `[NEEDS CLARIFICATION]`; o usuário ESCREVE os valores
      (proof-of-work), não assina saída pré-preenchida.
  - term: Gate-como-hipótese (D9)
    definition: o gate hard-blocks por default, mas o design declara explicitamente
      que aposta numa hipótese não-provada (reduzir rework); o instrumento de
      medição fica Open e não é entregável deste plano.
phases:
  - id: F0
    slug: phase-materialization-f0-fundacoes-de-schema-detector-determini
    title: Fundações de schema + detector determinístico
    goal: Adicionar o campo de schema aditivo/opcional `businessIntent` no
      `phaseDescriptor` do plano E no schema da initiative (espelha `summary`),
      mais o detector determinístico `find-missing-business-intent.js` — todos
      com zero mudança de comportamento e totalmente backward-compat. Esta fase
      habilita F1–F4 sem alterar nenhum fluxo existente.
    dependsOn: []
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: Schemas (plan phaseDescriptor + initiative) aceitam legados (sem
            businessIntent) e novos (com), e o detector exit-0/1 sobre fixtures
            canonicos (escopado a tests/phase-materialization via node --test; o
            gate de zero-behavior-change e o F0-G2 diff-scope)
          status: met
          metAt: 2026-06-30T16:10:18.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-30T16:10:18.000Z
            exitCode: 0
            testsCollected: 21
            passed: true
            outputSummary: node --test 'tests/phase-materialization/*.test.js'
              → exit 0; ℹ tests 21 / pass 21 / fail 0; 3 suites (business-intent-schema
              11 + find-missing-business-intent 10)
          verifier:
            kind: shell
            command: "node --test 'tests/phase-materialization/*.test.js'"
            expectExitCode: 0
        - id: F0-G2
          description: Nenhum arquivo de fluxo/skill alterado nesta fase (zero behavior
            change confirmado pelo diff)
          status: met
          metAt: 2026-06-30T16:10:18.000Z
          evidence:
            verifierKind: manual
            verifiedAt: 2026-06-30T16:10:18.000Z
            passed: true
            outputSummary: git diff --name-only 67f1257..HEAD -- skills/ src/ = vazio
              e git status --porcelain -- skills/ src/ = vazio (0 skill/flow file);
              deliverables = meta/schemas/{plan,initiative}.schema.json +
              scripts/find-missing-business-intent.js + tests/phase-materialization/ +
              assets/aideck-consumer/schema.json
          verifier:
            kind: manual
            description: Confirmar via git diff que só meta/schemas/plan.schema.json +
              meta/schemas/initiative.schema.json +
              scripts/find-missing-business-intent.js + tests/ +
              assets/aideck-consumer/schema.json (bundle regerado para incluir
              businessIntent — artefato gerado, zero behavior nova) foram tocados
    reviewGate:
      status: passed
      at: 079c19d
      mode: local
      verifiedAt: 2026-06-30T16:10:18.000Z
    status: done
    summary: Adiciona o campo de schema opcional businessIntent no phaseDescriptor
      do plano E na initiative (espelha summary) + o detector determinístico que
      o checa — zero mudança de comportamento.
  - id: F1
    slug: phase-materialization-f1-refactor-mecanico-do-decompose-js-beha
    title: Refactor mecânico do decompose.js (behavior-preserving)
    goal: "Extrair `decomposeOnePhase(phaseSource, ctx)` e
      `writeInitiativeFile(initiative, planSlug, ctx)` de
      `decomposePlan`/`materializeDecomposition` em `src/decompose.js` como
      refactor estritamente mecânico (R-ORCH-10: heurísticas e formato-fonte
      congelados). Nenhuma mudança de comportamento — o output de
      `materializeDecomposition` sobre qualquer input deve ser byte-idêntico ao
      atual. Habilita F2 (lazy) e F3 (verbo `materialize`) sem ainda mudar o que
      `new plan` produz."
    dependsOn:
      - F0
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: "Refactor é behavior-preserving: golden/snapshot de
            materializeDecomposition inalterado sobre os fixtures canonicos"
          status: met
          metAt: 2026-06-30T22:49:23.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-30T22:49:23.000Z
            passed: true
            exitCode: 0
            outputSummary: "npm test → exit 0; ℹ tests 1479 / pass 1471 / fail 0 /
              skipped 8 (177 suites). Byte-identidade R-ORCH-10 confirmada
              (tests/decompose.test.js 82/82); 6 falhas pré-existentes de
              install/refresh-state corrigidas em 9b5e645."
          verifier:
            kind: shell
            command: npm test
            expectExitCode: 0
        - id: F1-G2
          description: decomposeOnePhase e writeInitiativeFile exportadas e reutilizaveis
            (F2/F3 dependerão delas)
          status: met
          metAt: 2026-06-30T22:49:23.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-30T22:49:23.000Z
            passed: true
            exitCode: 0
            outputSummary: "node -e exports guard → exit 0; o guard process.exit(1)
              não disparou — decomposeOnePhase e writeInitiativeFile ambas
              exportadas de src/decompose.js (reutilizáveis por F2/F3)."
          verifier:
            kind: shell
            command: node -e "import(\"./src/decompose.js\").then(m => { if (typeof
              m.decomposeOnePhase !== \"function\" || typeof
              m.writeInitiativeFile !== \"function\") process.exit(1) })"
            expectExitCode: 0
    status: done
    summary: Extrai decomposeOnePhase e writeInitiativeFile do decompose.js num
      refactor mecânico que preserva o output byte a byte (R-ORCH-10).
    reviewGate:
      status: passed
      at: 340991b25d56ab281464346250bdd63ea5e048b1
      mode: local
      verifiedAt: 2026-06-30T23:04:44.000Z
  - id: F2
    slug: phase-materialization-f2-materializacao-lazy-leitores-distingue
    title: Materialização lazy + leitores distinguem descriptor-only
    goal: 'Implementar D1 (lazy FORTE) + a retenção da fonte por-fase (D2):
      `materializeDecomposition` passa a escrever apenas o initiative file de F0
      (com tasks) + os descritores `phases[]` COMPLETOS para F1..N (sem arquivo
      de iniciativa, `subPhaseCount:0` placeholder honesto, `exitGate.criteria`
      retido da fonte up-front); a fonte parseada por-fase é persistida em
      estado para o `materialize` consumir. Os leitores
      (`status`/`verify`/dashboard) passam a distinguir "descritor-only,
      pendente de materialização" (sem arquivo) de "materializada" (com
      arquivo). Depende de F1.'
    dependsOn:
      - F1
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: new plan com >=2 fases materializa só F0 (1 initiative file) +
            descritores F1..N com subPhaseCount:0 e exitGate retido, e fonte
            por-fase persistida
          status: met
          verifier:
            kind: shell
            command: npm test -- tests/decompose-lazy.test.js
            expectExitCode: 0
          metAt: 2026-07-01T10:19:21.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-01T10:28:50.000Z
            passed: true
            exitCode: 0
            testsCollected: 1495
            outputSummary: npm test -- tests/decompose-lazy.test.js → exit 0; node --test
              collected 1495 tests / pass 1487 / fail 0 / skipped 8 (179
              suites).
        - id: F2-G2
          description: "status/verify E o dashboard tratam fase descriptor-only como
            pendente-de-materialização (estado valido), nao como erro (F-004: o
            goal de F2 nomeia o dashboard)"
          status: met
          verifier:
            kind: manual
            description: Rodar atomic-skills:project status e verify + abrir o dashboard
              sobre um plano dogfood com F1 descriptor-only; confirmar que F1
              aparece como pendente-de-materialização (não vazio/quebrado) em
              todos, sem erro/falso-positivo
          metAt: 2026-07-01T10:19:21.000Z
          evidence:
            verifierKind: manual
            verifiedAt: 2026-07-01T10:19:21.000Z
            passed: true
            outputSummary: "refresh-state exit 0; validate-state .atomic-skills → 138 files
              valid; detect-completion --json → drift:false;
              verify:aideck-consumer -- --smoke → RESULT: PASS; descriptor-only
              projection: F1/F2 pending 0/0, only F0 initiative."
    reviewGate:
      status: passed
      at: 71d21049539b5db3408834155c1f6b24970d8144
      mode: local
      reviewFile: .atomic-skills/reviews/2026-07-01-1029-phase-materialization-f2.md
      verifiedAt: 2026-07-01T10:29:08.000Z
    status: done
    summary: new plan passa a materializar só F0; F1..N viram descritores
      (subPhaseCount:0) e os leitores distinguem descritor-only de
      materializada.
  - id: F3
    slug: phase-materialization-f3-verbo-materialize-gate-de-validacao-de
    title: Verbo `materialize` + gate de validação de negócio
    goal: Implementar o verbo top-level `materialize <phase>` (D7) que leva uma fase
      de descritor a iniciativa com tasks, passando pelo gate de
      `businessIntent` (D3 + D3.4 blank-field-prompting) e hard-blockado pelo
      detector D4 (F0). É o caminho reutilizável que F4 fará
      `phase-done`/`switch`/`phase-reopen` chamarem internamente (D7). Depende
      de F0 (schema + detector), F1 (`decomposeOnePhase`/`writeInitiativeFile`),
      F2 (fonte por-fase retida).
    dependsOn:
      - F2
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: O verbo materialize <phase> leva descritor → iniciativa com tasks,
            passando pelo gate businessIntent (blank-field-prompting) e
            hard-blockado pelo detector D4
          status: pending
          verifier:
            kind: manual
            description: "Dogfood: rodar atomic-skills:project materialize <F1> sobre um
              plano dogfood; confirmar gate de blank-field-prompting + detector
              exit 0 libera + arquivo phases/f1-*.md escrito com tasks +
              businessIntent"
        - id: F3-G2
          description: validate-skills verde apos adicionar o verbo e o detail file
          status: pending
          verifier:
            kind: shell
            command: npm run validate-skills
            expectExitCode: 0
    status: active
    summary: Cria o verbo materialize <phase> que leva descritor a iniciativa
      passando pelo gate de businessIntent com blank-field-prompting.
  - id: F4
    slug: phase-materialization-f4-fire-points-backstop-do-implement-re-q
    title: Fire points + backstop do implement + re-question events + lessons
    goal: "Conectar o gate nos fire points (D6):
      `phase-done`/`switch`/`phase-reopen` chamam `materialize` internamente
      (D7); `implement.md` Step 1 ganha verificação real (recusa fase
      descritor-only ou sem businessIntent, em vez de degradar — D6).
      Re-question do businessIntent em 2 eventos concretos (D6.1): crítico
      aponta drift; `implement` Step 2.1 reporta saída de `scopeBoundary`.
      Lições consolidadas fase-a-fase já integram via gate de lessons
      (phase-start). Depende de F2 (descriptor-only) e F3 (materialize verbo)."
    dependsOn:
      - F3
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F4-G1
          description: phase-done/switch/phase-reopen chamam materialize internamente (sem
            a instrução new initiative quebrada) e implement recusa fase
            descriptor-only/sem businessIntent
          status: pending
          verifier:
            kind: shell
            command: npm test -- tests/phase-materialization/
            expectExitCode: 0
        - id: F4-G2
          description: Os 2 eventos D6.1 (critico drift + implement Step 2.1 runtime
            scope) sao os unicos re-question points, sem maquinaria nova
          status: pending
          verifier:
            kind: manual
            description: Confirmar em implement.md/project-drift.md que só os 2 eventos D6.1
              re-questionam o businessIntent
    status: pending
    summary: Conecta o gate nos fire points (phase-done/switch/phase-reopen) e
      endurece o implement como backstop, com re-question em 2 eventos.
  - id: F5
    slug: phase-materialization-f5-testes-end-to-end-docs-auto-dogfood-re
    title: Testes end-to-end + docs + auto-dogfood/review
    goal: Fechar com testes de integração do fluxo completo (new plan → lazy →
      materialize → gate → tasks → phase-done advance), atualização de docs e o
      auto-dogfood do próprio mecanismo. D9 (gate-como-hipótese) é postura
      declarada no design, não código — fica documentada, não implementada como
      instrumento (não-entregável). D10 (constituição de anti-patterns) é
      non-goal explícito (iniciativa separada).
    dependsOn:
      - F4
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F5-G1
          description: Suíte completa verde (npm test) e fluxo e2e new plan → materialize
            → advance coberto por teste
          status: pending
          verifier:
            kind: shell
            command: npm test
            expectExitCode: 0
        - id: F5-G2
          description: Docs refletem o comportamento lazy e declaram D9 (hipótese) + D10
            (non-goal); auto-dogfood do mecanismo no próprio plano
          status: pending
          verifier:
            kind: manual
            description: Revisar CLAUDE.md + docs/kb; confirmar que o verbo materialize e a
              distinção descriptor-only estão documentados e D9/D10 registrados
              como postura/non-goal
    status: pending
    summary: Teste e2e do fluxo completo + docs que declaram a postura D9 (hipótese)
      e o non-goal D10 (constituição separada).
references: []
planActive: true
planTitle: Materialização lazy de fases + gate de validação de negócio
---

# Materialização lazy de fases + gate de validação de negócio

## 1. Context

Plano de implementação do design Approved em `projects/atomic-skills/phase-materialization/design.md` (commit `e775c48`, crítico rodada 2 `approve_with_nits`). Fecha três gaps encadeados da skill `atomic-skills:project`, todos verificados por arquivo:linha no design: (1) fases materializam vazias — `materializeDecomposition` (`src/decompose.js:866`) escreve um arquivo por fase e o schema exige `tasks` mas não `minItems` (`meta/schemas/initiative.schema.json:20`/`:116`); (2) instrução quebrada na fronteira de fase — `phase-done` manda `new initiative` (`skills/shared/project-assets/project-transitions.md:170`) mas a fase já foi materializada, colidindo (`project-create-initiative.md:17`); (3) todos os gates são de nível de código — o SPEC gate admite task só com `Files`+`scopeBoundary`+`acceptance`+`verifier` (`project-create-plan.md:88`, `scripts/lint-source.js:283-355`), o usuário nunca valida semântica de negócio.

O resultado: cada fase é decomposta em tasks **no momento certo**, após o usuário responder e validar perguntas de **negócio** (feature/workflow/regra), antes de qualquer implementação.

## 2. Inviolable principles

- **P1 Heurísticas e formato-fonte do decompose CONGELADOS (R-ORCH-10)** — O refactor de `src/decompose.js` é estritamente mecânico: só a ESTRUTURA das funções muda. As heurísticas de extração (`extractTasks` `:414`, `extractGoal` `:275`, os regexes no topo do arquivo) e o formato-fonte markdown NÃO mudam. Provado por snapshot de output byte-idêntico sobre os fixtures de decompose existentes.
- **P2 Backward-compat aditivo (nenhum plano congela no dia 1)** — Todo campo novo de schema é OPCIONAL (properties-only, fora do `required`); planos legados continuam validando. A mudança de comportamento afeta apenas `new plan` e ativações futuras (backfill-on-activation, D5). Nenhuma migração de planos existentes é executada — eles seguem totalmente materializados e funcionais.
- **P3 aiDeck permanece agnóstico** — `businessIntent` vive no estado versionado do consumer (`.atomic-skills/`); o dashboard apenas lê. Nenhuma lógica de domínio (espinha canônica, regras de negócio) entra no aiDeck. Respeita `feedback-aideck-stays-agnostic`.
- **P4 Soluções no nível da skill (detectores replicáveis, não ad-hoc)** — Os gates são detectores determinísticos zero-token (`scripts/find-*.js`) no mesmo molde de `find-missing-summaries.js`, não checagens manuais ou scripts descartáveis. A eficácia anti-rubber-stamp do blank-field-prompting é uma hipótese declarada (D9), não uma claim de benefício garantido.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Self-review against code-quality gates

- **G1 read-before-claim**: as descrições das tasks (initiatives F0–F5) citam código existente com arquivo:linha — `src/decompose.js:605/771/866-946/379-412`, `meta/schemas/plan.schema.json:7/211/214/220`, `meta/schemas/initiative.schema.json:29`, `scripts/lint-source.js:283-355`, `scripts/find-missing-summaries.js:86`, `scripts/validate-state.js` (`addMd`), `skills/core/project.md:17-30/50-65`, `skills/shared/project-assets/project-transitions.md:170` — todos verificados por leitura direta do fonte nesta sessão. O `design.md` (commit `e775c48`, crítico rodada 2 Approved) carrega as `verified_by` canônicas; este plano as projeta em tasks.
- **G2 soft-language**: varrido o body + as 6 initiatives pela ban-list (EN `should/probably/may/typically/usually/tends to/in theory` + PT `deveria/provavelmente/talvez/normalmente/geralmente`); escrito no indicativo. 0 ocorrências (scan `grep -rniE` confirmou).
- **G6 reference-or-strike**: toda afirmação sobre código existente carrega arquivo:linha (verified_by implícito via leitura do fonte) ou é decisão nova (D1–D10) marcada como decisão no `design.md` Approved. Non-goals explícitos (D10 constituição separada; não-migrar planos; não-tratar o gate como empiricamente provado — D9).

## Reviews

- internal: 1 critical finding applied (corrupção sistemática do `verifier:` da última task nas 6 fases — F0/T-003, F1/T-005, F2/T-007, F3/T-009, F4/T-011, F5/T-013; causa-raiz: o bloco fenced ```yaml exit_gate``` posicionado após a última task `### Tn` era absorvido por `parseTaskInterior` em `src/decompose.js:379-412`, e o último `verifier:` do gate sobrescrevia o da task; fix de raiz: fence reposicionado para logo após `Goal:` no `source.md` + re-materialize — os verifiers voltaram a ser determinísticos test/shell como pretendido) @ uncommitted (2026-06-29T13:20:54Z)

- codex: needs_changes → resolved (3 critical, 2 major; todos os 5 aplicados ao `source.md` + re-materializado 2026-06-29) — .atomic-skills/reviews/2026-06-29-1355-phase-materialization.md (F-001 businessIntent adicionado ao `initiative.schema.json` via T-001; F-002 sidecar `phases/<slug>.source.json` definido como captura não-validada em T-006 — `validate-state.js`/`find-*.js` filtram `*.md`, verificado `find-missing-summaries.js:86` + `validate-state.js` `addMd`; F-003 T-009 `materialize` agora atualiza atomicamente o descritor em `plan.md`; F-004 F2-G2 + T-007 gateiam a projeção do dashboard; F-005 `definitionOfDone[]` removido do plano — T-002 descartado, sem consumer/enforcement neste plano)
