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
lastUpdated: 2026-06-17T12:26:23Z
nextAction: "Start T-001: Estender o schema de routing com integrationRef"
parentPlan: worktree-lifecycle-finalization
phaseId: F1
tasksDone: 0
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
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
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
- **Narrative:** F1 **ATIVA** (integrationRef configurável, Decisão 2). Phase-start lessons gate cumprido: os **9 lessons** de `node scripts/list-lessons.js --phase F1` foram disposicionados = **Keep todas** (nenhuma stale) — disposição aceita. Prestes a despachar **T-001** via **Mode 2 (Codex)** numa worktree isolada. Nada mergeado na primária `plan/worktree-lifecycle-finalization` ainda.
- **Decision log:** Keep-all aceito. **Subset APPLY em T-001:** design-brief `L-003` (testes em `tests/` plural — T-001 cria `tests/routing-schema.test.js`, já satisfeito); `wlf-f0 L-001` (enumerar sites de ripple ao generalizar a descrição — alvos: `title` E `description` do schema, ambos dizem "Mode 2 routing"); `wlf-f0 L-002` (doc/test deve asserir o que MUDOU — o teste assere `integrationRef` aceito + chave desconhecida rejeitada, NÃO uma string pré-existente); design-brief `L-002` **NÃO-dispara** (`integrationRef` é string simples; o schema não tem `schemaVersion`); `mode2 L-001` (auto-report `-o` do Codex não-confiável — re-rodar o verifier na primária MERGED é o único adjudicador). **Mode 2 = default:** lane on (`mode2Enabled+codexLane.enabled=true`, `minBatchTasks=1`), T-001 spec-ready (F1✓) + verifier `kind:test` (F2✓), Codex auth ok ("Logged in using ChatGPT", codex-cli 0.139.0).
- **Single nextAction:** Despachar T-001 ao Codex na worktree `/home/henry/atomic-skills/.worktrees/wlf-t-001` (base ref = HEAD desta branch; briefing em `/tmp/wlf-t-001-briefing.md`); ler o diff de volta com `git -C ... diff`; merge serial em `plan/worktree-lifecycle-finalization` → **re-rodar `node --test tests/routing-schema.test.js` na primária MERGED**; só então `done T-001`.
- **Verbatim state:** worktree base ref = HEAD `plan/worktree-lifecycle-finalization` (este commit de snapshot). F1/T-001 verifier: `node --test tests/routing-schema.test.js`; F1/T-002 verifier: `node --test tests/integration-ref.test.js`. F1 G-2 verifier: `node --test tests/routing-schema.test.js && npm run validate-skills`. Alvos T-001: MODIFY `meta/schemas/routing.schema.json` (hoje `additionalProperties:false`, `title`+`description` dizem "Mode 2 routing"), CREATE `tests/routing-schema.test.js`. Codex cmd (cwd=worktree): `codex -a never exec -c model_reasoning_effort=high --sandbox workspace-write --skip-git-repo-check --ephemeral -o <out> - < <briefing>`. routing.json: `mode2Enabled+codexLane.enabled=true`, `minBatchTasks=1`. Follow-ups F0 abertos: finding #2 (`shouldForkPlanBranch` sem caller runtime) + linha ~358 `project-create-plan.md` (fluxo `adopt` branch-or-null stale, fora do escopo Stage-6).
- **Uncommitted changes:** este snapshot do handoff (`phases/f1-integrationref-configuravel.md`), a commitar como `chore(project)` antes de cortar a worktree. Após o commit, árvore LIMPA.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
