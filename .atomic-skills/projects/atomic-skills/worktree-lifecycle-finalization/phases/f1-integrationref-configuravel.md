---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f1-integrationref-configuravel
title: integrationRef configurável + branch develop (Decisão 2)
goal: 'introduzir um ref de integração configurável (default `develop`)
  repo-global em `routing.json`, estendendo o schema (que hoje é
  `additionalProperties: false` e descrito como "Mode 2 routing"), e um
  resolvedor que lê o ref, aplica o default e sinaliza ausência para o prompt
  lazy no ponto de consumo (o finalize, F3).'
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-17T12:26:23Z
lastUpdated: 2026-06-17T13:37:44Z
nextAction: "Start T-002: Resolvedor de integrationRef (scripts/integration-ref.js + tests/integration-ref.test.js)"
parentPlan: worktree-lifecycle-finalization
phaseId: F1
tasksDone: 1
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: Schema aceita integrationRef e rejeita chave desconhecida;
      resolvedor aplica default develop e sinaliza ausência sem assumir; suite
      verde.
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/integration-ref.test.js
    verifierLabel: "test: node tests/integration-ref.test.js"
  - id: G-2
    description: routing.schema.json válido e skills válidos.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/routing-schema.test.js && npm run validate-skills
    verifierLabel: "shell: node --test tests/routing-schema.test.js && npm run validat…"
stack:
  - id: 1
    title: integrationRef configurável + branch develop (Decisão 2)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: Estender o schema de routing com integrationRef
    status: done
    lastUpdated: 2026-06-17T13:37:44Z
    closedAt: 2026-06-17T13:37:44Z
    summary: Adiciona integrationRef ao schema de routing, preservando
      additionalProperties:false.
    outputs:
      - kind: file
        path: meta/schemas/routing.schema.json
      - kind: test
        path: tests/routing-schema.test.js
    scopeBoundary:
      - NÃO mudar os campos existentes de Mode 2 routing
      - NÃO colocar o ref no frontmatter do plano (é repo-global)
      - apenas adicionar a propriedade e generalizar a descrição do arquivo de
        "Mode 2 routing" para "config de roteamento/integração do repo".
    acceptance:
      - "`meta/schemas/routing.schema.json` aceita um `integrationRef` string
        opcional e segue rejeitando propriedades desconhecidas
        (`additionalProperties: false` preservado)"
      - a descrição do schema é generalizada de "Mode 2 routing" para incluir
        integração
      - o teste valida que um `routing.json` com `integrationRef` passa e um com
        chave desconhecida falha.
    verifier:
      kind: test
      runner: node
      pattern: tests/routing-schema.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T13:37:44Z
      exitCode: 0
      testsCollected: 4
      passed: true
      outputSummary: "node --test tests/routing-schema.test.js on merged primary
        (4555063): tests 4, pass 4, fail 0. Mode 2/Codex executed in worktree
        impl/wlf-t-001, ff-merged + re-verified on primary (mode2 L-001:
        re-run is the adjudicator, not Codex -o)."
  - id: T-002
    title: Resolvedor de integrationRef com default e sinal-de-ausência
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: Resolvedor lê o ref, aplica default develop e sinaliza ausência para o
      prompt.
    outputs:
      - kind: file
        path: scripts/integration-ref.js
      - kind: test
        path: tests/integration-ref.test.js
    scopeBoundary:
      - função pura sobre o conteúdo de `routing.json` já lido — NÃO executa git
        nem rede no teste
      - NÃO cria a branch develop (isso é ação prompted no finalize, F3)
      - ausência NUNCA é assumida em silêncio nem falha — é sinalizada para o
        prompt.
    acceptance:
      - "`resolveIntegrationRef` retorna o `integrationRef` declarado quando
        presente"
      - aplica o default `develop` quando o campo está ausente mas o arquivo
        existe
      - retorna um sinal explícito de "ausente/não-configurado" (para o prompt
        lazy) quando `routing.json` não existe, nunca lançando nem assumindo
      - o resolvedor não muta o input.
    verifier:
      kind: test
      runner: node
      pattern: tests/integration-ref.test.js
parked: []
emerged: []
summary: Ref de integração configurável (default develop) em routing.json, com
  resolvedor e prompt-quando-ausente.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — integrationRef configurável + branch develop (Decisão 2)**.

## Session handoff
- **Narrative:** F1 **ATIVA**. **T-001 DONE** (1/2 tasks) — `integrationRef` opcional adicionado a `routing.schema.json` + `tests/routing-schema.test.js` criado, via Mode 2/Codex. Diff revisado, ff-merged em `4555063`, verifier re-rodado na primária MERGED (tests 4, pass 4, exit 0), evidence GATE-R2 gravada, `validate-state` ✓. Worktree `impl/wlf-t-001` desmontada + branch deletada. **T-002 pending** (resolvedor). Gates da fase (G-1/G-2) seguem `pending` — resolvem no `phase-done`.
- **Decision log:** Keep-all dos 9 lessons aceito. **T-001 APPLY confirmado:** design-brief `L-003` (`tests/` plural ✓); `wlf-f0 L-001` (ripple: `title` E `description` generalizados, substância Mode 2 preservada ✓); `wlf-f0 L-002` (test assere o que MUDOU: integrationRef aceito/opcional + chave-desconhecida/tipo-errado rejeitados, sem string pré-existente ✓); design-brief `L-002` não-disparou (string simples, sem schemaVersion); `mode2 L-001` (auto-report `-o` do Codex descartado — re-run na primária MERGED foi o adjudicador). **Decisão de design do schema:** `integrationRef` carrega `"default": "develop"` apenas como DOC (Ajv aqui sem useDefaults); a aplicação real do default + sinal-de-ausência é responsabilidade do RESOLVEDOR (T-002), não do schema — o schema só valida shape.
- **Single nextAction:** Iniciar **T-002** via Mode 2/Codex (mesmo padrão: worktree off HEAD `4555063`, briefing, diff readback, ff-merge, re-verify na primária MERGED): CREATE `scripts/integration-ref.js` (função pura `resolveIntegrationRef` sobre o conteúdo de `routing.json` já lido — retorna o ref declarado; aplica default `develop` quando ausente-mas-arquivo-existe; retorna sinal explícito "ausente/não-configurado" quando `routing.json` não existe, sem lançar nem assumir; não muta o input; NÃO executa git/rede), CREATE `tests/integration-ref.test.js`. Verifier: `node --test tests/integration-ref.test.js`.
- **Verbatim state:** HEAD primária `plan/worktree-lifecycle-finalization` = `4555063` (feat T-001) — o commit `done T-001` (state) vem a seguir. F1/T-002 verifier: `node --test tests/integration-ref.test.js`. F1 G-1 verifier: `node --test tests/integration-ref.test.js`; F1 G-2 verifier: `node --test tests/routing-schema.test.js && npm run validate-skills`. T-002 scopeBoundary: função pura sobre routing.json já lido (sem git/rede no teste); NÃO cria a branch develop (ação prompted no finalize F3); ausência NUNCA assumida em silêncio nem falha — sinalizada para o prompt. Codex cmd (cwd=worktree): `codex -a never exec -c model_reasoning_effort=high --sandbox workspace-write --skip-git-repo-check --ephemeral -o <out> - < <briefing>`. routing.json: `mode2Enabled+codexLane.enabled=true`, `minBatchTasks=1`. Follow-ups F0 abertos: finding #2 (`shouldForkPlanBranch` sem caller runtime) + linha ~358 `project-create-plan.md` (fluxo `adopt` branch-or-null stale).
- **Uncommitted changes:** state da transição `done T-001`, a commitar como `chore(project)`: `phases/f1-integrationref-configuravel.md` (T-001 done+evidence+rollups+nextAction+este handoff), `status/dispatch-log.json` (registro Mode 2 T-001 apendado), `focus.json` (regen → tasksDone 1). Após o commit, árvore LIMPA.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
