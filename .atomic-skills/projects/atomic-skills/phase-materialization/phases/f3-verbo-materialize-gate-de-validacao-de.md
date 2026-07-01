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
lastUpdated: 2026-07-01T11:06:29.000Z
nextAction: "Run `phase-done F3`: verify F3-G1 manual dogfood and F3-G2
  `npm run validate-skills`, then run the review gate before advancing."
parentPlan: phase-materialization
phaseId: F3
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 4
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
    status: done
    lastUpdated: 2026-07-01T10:40:25.000Z
    closedAt: 2026-07-01T10:40:25.000Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-01T10:40:25.000Z
      passed: true
      exitCode: 0
      outputSummary: npm run validate-skills -> exit 0; node scripts/validate-skills.js;
        ✓ All 15 skills valid (schema_version 0.2)
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
    status: done
    lastUpdated: 2026-07-01T11:06:29.000Z
    closedAt: 2026-07-01T10:44:21.000Z
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
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-01T11:06:29.000Z
      passed: true
      exitCode: 0
      testsCollected: 8
      outputSummary: node --test tests/phase-materialization/materialize-verb.test.js
        -> exit 0; tests 8 / pass 8 / fail 0 / duration_ms 147.689416.
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-materialize.md
      - kind: file
        path: tests/phase-materialization/materialize-verb.test.js
    summary: "Implementa o corpo do verbo: fonte retida → decomposeOnePhase → gate
      businessIntent (blank-field) → write → detector → atualiza atomicamente o
      descritor em plan.md (F-003), com contratos pós-review para detector,
      dependências, router e transições descriptor-only."
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

- **Narrative:** F3 está ativa/current e T-008/T-009 estão `done` com evidência
  `passed: true` nos respectivos task frontmatters. Após a revisão em contexto
  limpo, os cinco achados foram corrigidos: o detector de businessIntent agora
  é chamado via package-root e varre `.atomic-skills`; a initiative materializada
  e o descriptor do plano recebem o mesmo `businessIntent`; `materialize` entrou
  nos pre-mutation gates; o pre-flight exige alvo igual a `currentPhase`,
  dependências `done` e ausência de outra fase ativa; e `phase-done` delega
  activation descriptor-only para `materialize` em vez de `new initiative`.
  O `npm test` completo também expôs os contratos derivados da nova lazy asset:
  contagens do instalador foram atualizadas e a linha residente do router foi
  encurtada para manter `skills/core/project.md` abaixo do teto de 23000 bytes.
  A fronteira de fase está pronta para `phase-done F3`.
- **Decision log:** Mode 2 estava ligado em
  `.atomic-skills/status/routing.json`, mas a bridge Codex não estava
  despachável porque os assets
  `/Users/henry/.agents/atomic-skills/_assets/codex-bridge-assets/preflight-checks.txt`
  e
  `/Users/henry/.agents/atomic-skills/_assets/codex-bridge-assets/invocation-workspace-write.txt`
  não existem; T-008 e T-009 foram executadas em Mode 1 com esse motivo
  registrado. O novo detail file usa `{{ARG_VAR}}`, `{{BASH_TOOL}}`,
  `{{WRITE_TOOL}}` e `{{ASK_USER_QUESTION_TOOL}}` para respeitar o contrato
  cross-agent. O verificador de T-009 falhou uma vez porque
  `tests/phase-materialization/materialize-verb.test.js:22` usava
  `doc.indexOf(token)` global e o token `scripts/find-missing-business-intent.js`
  já aparecia antes da seção de descriptor update; a correção foi trocar o
  último token do teste por `The detector runs`. A revisão em contexto limpo foi
  executada por um agente sem histórico conversacional sobre o diff de
  implementação/testes, e as regressões resultantes foram fixadas com testes
  vermelhos primeiro.
- **Single nextAction:** Run `phase-done F3` and disposition the manual dogfood
  gate F3-G1 before advancing.
- **Verbatim state:** `rtk node --test
  tests/phase-materialization/materialize-verb.test.js` -> exit 0: `ℹ tests 8`
  / `ℹ pass 8` / `ℹ fail 0` / `ℹ duration_ms 147.689416`. `rtk node --test
  tests/install.test.js` -> exit 0: `ℹ tests 37` / `ℹ pass 37` / `ℹ fail 0`.
  `rtk node --test tests/skill-byte-budget.test.js` -> exit 0: `ℹ tests 8`
  / `ℹ pass 8` / `ℹ fail 0`. `rtk npm test` -> exit 0: `ℹ tests 1506`
  / `ℹ pass 1498` / `ℹ fail 0` / `ℹ skipped 8`. `rtk npm run
  validate-skills` -> exit 0: `> node scripts/validate-skills.js` / `✓ All 15
  skills valid (schema_version 0.2)`. `rtk node scripts/validate-state.js
  .atomic-skills/projects/atomic-skills/phase-materialization/plan.md
  .atomic-skills/projects/atomic-skills/phase-materialization/phases/f3-verbo-materialize-gate-de-validacao-de.md`
  -> exit 0: `✓ All 2 file(s) valid, 1 plan(s) cross-validated (schemaVersion
  0.1/0.2)`. Earlier completion events were already appended for T-008 and
  T-009 and were not duplicated. `rtk cat
  /Users/henry/.agents/atomic-skills/_assets/codex-bridge-assets/preflight-checks.txt`
  -> exit 1: `cat:
  /Users/henry/.agents/atomic-skills/_assets/codex-bridge-assets/preflight-checks.txt:
  No such file or directory`. `rtk cat
  /Users/henry/.agents/atomic-skills/_assets/codex-bridge-assets/invocation-workspace-write.txt`
  -> exit 1: `cat:
  /Users/henry/.agents/atomic-skills/_assets/codex-bridge-assets/invocation-workspace-write.txt:
  No such file or directory`.
- **Uncommitted changes:** ` M .atomic-skills/analytics/completions.jsonl`; ` M
  .atomic-skills/projects/atomic-skills/phase-materialization/phases/f3-verbo-materialize-gate-de-validacao-de.md`;
  ` M skills/core/project.md`; ` M
  skills/shared/project-assets/project-transitions.md`; ` M tests/install.test.js`;
  `??
  skills/shared/project-assets/project-materialize.md`;
  `?? tests/phase-materialization/materialize-verb.test.js`.
