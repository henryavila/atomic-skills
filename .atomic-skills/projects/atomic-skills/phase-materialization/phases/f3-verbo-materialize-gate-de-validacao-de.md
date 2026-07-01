---
schemaVersion: "0.1"
slug: phase-materialization-f3-verbo-materialize-gate-de-validacao-de
title: Verbo `materialize` + gate de validação de negócio
goal: Implementar o verbo top-level `materialize <phase>` (D7) que leva uma fase
  de descritor a iniciativa com tasks, passando pelo gate de `businessIntent`
  (D3 + D3.4 blank-field-prompting) e hard-blockado pelo detector D4 (F0). É o
  caminho reutilizável que F4 fará `phase-done`/`switch`/`phase-reopen` chamarem
  internamente (D7). Depende de F0 (schema + detector), F1
  (`decomposeOnePhase`/`writeInitiativeFile`), F2 (fonte por-fase retida).
status: active
branch: plan/phase-materialization
started: 2026-06-29T13:19:41.314Z
lastUpdated: 2026-07-01T10:29:08.000Z
nextAction: "Start T-008: Adicionar o verbo `materialize <phase>` à gramática do
  router (D7)"
parentPlan: phase-materialization
phaseId: F3
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 4
exitGates:
  - id: F3-G1
    description: O verbo materialize <phase> leva descritor → iniciativa com tasks,
      passando pelo gate businessIntent (blank-field-prompting) e hard-blockado
      pelo detector D4
    status: pending
    verifier:
      kind: manual
      description: "Dogfood: rodar atomic-skills:project materialize <F1> sobre um
        plano dogfood; confirmar gate de blank-field-prompting + detector exit 0
        libera + arquivo phases/f1-*.md escrito com tasks + businessIntent"
    verifierLabel: manual
  - id: F3-G2
    description: validate-skills verde apos adicionar o verbo e o detail file
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills
      expectExitCode: 0
    verifierLabel: "shell: npm run validate-skills"
stack:
  - id: 1
    title: Verbo `materialize` + gate de validação de negócio
    type: task
    openedAt: 2026-06-29T13:19:41.314Z
tasks:
  - id: T-008
    title: Adicionar o verbo `materialize <phase>` à gramática do router (D7)
    description: Adiciona `materialize <phase>` como **verbo top-level** em
      `skills/core/project.md` (na `## Grammar` `:17-30` e na dispatch-table
      `:50-65`), apontando para um novo arquivo de detalhe
      `skills/shared/project-assets/project-materialize.md`. NÃO é sub-passo de
      `phase-done` — é verbo próprio porque `phase-done`/`switch`/`phase-reopen`
      o chamam internamente (decisão estrutural de contrato de chamada, não
      ergonômica — D7).
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
    scopeBoundary:
      - a `## Grammar` e a dispatch-table em `skills/core/project.md` + o novo
        `project-materialize.md`; NÃO remover/renomear verbos existentes, NÃO
        alterar project-transitions.md aqui (isso é F4)
    acceptance:
      - "`skills/core/project.md` lista `materialize <phase>` na Grammar e na
        dispatch-table; `project-materialize.md` existe e descreve o
        passo-a-passo do verbo; `npm run validate-skills` segue verde"
    verifier:
      kind: shell
      command: npm run validate-skills
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: skills/shared/project-assets/project-materialize.md
    summary: Adiciona materialize <phase> como verbo top-level no router + novo
      detail file project-materialize.md.
    weight: 1
  - id: T-009
    title: Implementar o corpo do verbo `materialize` (decompose + gate + write)
    description: "O verbo `materialize <phase>` (em `project-materialize.md`,
      orquestrado pela skill body): (1) carrega a fonte por-fase retida
      (`phases/<slug>.source.json`, F2/T-006) da fase-alvo; (2) chama
      `decomposeOnePhase(phaseSource, ctx)` (F1/T-004) para extrair tasks; (3)
      dispara o **gate de lessons** da fase anterior (Phase-start lessons gate,
      `project-create-initiative.md:32` — lições de F0 aplicadas); (4) aplica o
      gate `businessIntent` com **blank-field-prompting** (D3.4): apresenta os 5
      campos da espinha em branco/marcados `[NEEDS CLARIFICATION]` via
      `ASK_USER_QUESTION_TOOL` e o usuário ESCREVE os valores (a IA marca
      `[NEEDS CLARIFICATION]` onde não sabe, não inventa plausível — D3.1); (5)
      chama `writeInitiativeFile` (F1/T-005) para escrever `phases/f<N>-*.md`
      com tasks + businessIntent; (6) roda o detector
      `find-missing-business-intent.js` (F0/T-003) → exit 0 libera; (7)
      **atualiza atomicamente o descritor da fase em `plan.md`**
      (`phases[<id>]`): grava o `businessIntent` ratificado, recalcula o
      `subPhaseCount` real (= nº de tasks extraídas, substituindo o placeholder
      `0`) e avança `status`/`currentPhase` (F-003: escrever só o arquivo de
      iniciativa não basta — o detector D4 e os leitores dependem do descritor
      no plano); (8) status `active`. O gate garante deterministicamente que
      nenhum campo da espinha fica vazio/marcado numa fase ativada (D4); a
      validação *com o usuário* (blank-field-prompting) é passo de fluxo, não
      checável por script (D3.4 honestidade)."
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
    scopeBoundary:
      - o corpo do verbo em `project-materialize.md` + novo teste; reusa
        `decomposeOnePhase`/`writeInitiativeFile` (F1) e a fonte retida (F2) sem
        alterá-los; NÃO duplicar lógica de decompose
    acceptance:
      - "o passo-a-passo do verbo em `project-materialize.md` referencia
        `decomposeOnePhase` + `writeInitiativeFile` + o detector + o gate de
        lessons; o teste documenta o fluxo (fonte retida → decomposeOnePhase →
        gate → write → detector exit 0 → descritor de fase em plan.md atualizado
        atomicamente: businessIntent + subPhaseCount real + status/currentPhase
        avançados → active); o `value` do businessIntent reflete
        business-vs-customer (D3.3) e `outOfScope` é non-goal (D3.2)"
    verifier:
      kind: test
      runner: node --test
      pattern: tests/phase-materialization/materialize-verb.test.js
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-materialize.md
      - kind: file
        path: tests/phase-materialization/materialize-verb.test.js
    summary: "Implementa o corpo do verbo: fonte retida → decomposeOnePhase → gate
      businessIntent (blank-field) → write → detector → atualiza atomicamente o
      descritor em plan.md (F-003)."
    weight: 3
parked: []
emerged: []
summary: Cria o verbo materialize <phase> que leva descritor a iniciativa
  passando pelo gate de businessIntent com blank-field-prompting.
planTitle: Materialização lazy de fases + gate de validação de negócio
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F3 — Verbo `materialize` + gate de validação de negócio**.

## Decisions

- **F3 ativada por `phase-done F2` usando a iniciativa existente.** O plano já
  tinha esta initiative materializada; a transição apenas promoveu `status:
  active`/`current: true` em vez de criar um segundo arquivo.
- **Phase-start lessons gate executado.** `node scripts/list-lessons.js --phase
  F3` retornou 78 lessons aplicáveis; a nova F2/L-001 fica como APPLY para
  qualquer trabalho que una leitores/detectores entre layout nested e flat
  (especialmente T-009 ao orquestrar o detector de businessIntent).

## Links

_(plan doc, external refs)_

## Session handoff

- **Narrative:** F2 foi concluída via `phase-done`: exit gates F2-G1/F2-G2 estão
  met, review gate local passou com 1 major corrigido, F2 foi arquivada em
  `phases/archive/2026-07-phase-materialization-f2-materializacao-lazy-leitores-distingue.md`,
  e esta F3 agora é a fase ativa/current.
- **Decision log:** review-code rodou em modo local inline degradado porque o
  asset `diff-capture.md` estava ausente e a ferramenta multi-agent disponível
  não permite subagents sem pedido explícito do usuário. O finding real foi
  corrigido no commit `71d21049539b5db3408834155c1f6b24970d8144`: o detector
  flat de `businessIntent` agora casa `(parentPlan, phaseId)` antes de qualquer
  fallback por `phaseId`. A F3 existente foi reaproveitada como successor.
- **Single nextAction:** Start T-008: adicionar `materialize <phase>` ao router
  em `skills/core/project.md` e criar/ligar
  `skills/shared/project-assets/project-materialize.md`.
- **Verbatim state:** `rtk npm test -- tests/decompose-lazy.test.js` -> exit 0,
  1495 tests / 1487 pass / 0 fail / 8 skipped / 179 suites. `rtk node --test
  tests/phase-materialization/find-missing-business-intent.test.js` -> exit 0,
  11 tests / 11 pass. `rtk node scripts/list-lessons.js --phase F3` -> exit 0,
  78 applicable lessons. Review file:
  `.atomic-skills/reviews/2026-07-01-1029-phase-materialization-f2.md`.
- **Uncommitted changes at handoff creation:** phase-boundary state staged for
  commit (`plan.md`, F2 archive move, F3 activation, review report/index, F2
  lessons, analytics event, project status). After the phase-boundary commit,
  expected `git status --porcelain` is empty.
