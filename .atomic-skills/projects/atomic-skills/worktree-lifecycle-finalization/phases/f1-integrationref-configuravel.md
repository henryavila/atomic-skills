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
- **Narrative:** F0 **DONE + arquivada**; phase-done F0 completo (2026-06-17). Gates G-1 (test 9/9) + G-2 (focus-digest 11/11 + validate-skills 15/15) met com evidence; review-code (local) sobre o diff da fase pegou a always-fork meia-aplicada no Stage 6 (finding major #1) — corrigido em `01c2455`; lessons L-001/L-002 distiladas+ratificadas; `reviewGate` (passed, at 01c2455, local) gravado; plano avançado `currentPhase`=F1; F0 movida p/ `phases/archive/`. **F1 agora ATIVA** (integrationRef configurável, Decisão 2) — nada codado em F1 ainda.
- **Decision log:** Sessão: honrar Stage 8a antes de implementar; S1 alinhado ao design (F2 pr-url co-dependência); Mode 2 (Codex) = executor default (T-001 fechou limpo, cheap tier, 0 escalação); F0 impl = `shouldForkPlanBranch` → `return Array.isArray(activePlans)` (não `return true`, preserva fail-safe). **Phase-start F1 lessons gate:** `node scripts/list-lessons.js --phase F1` surfa **9 lessons** (appliesTo:[]). Disposição = **Keep todas** (nenhuma stale); **subset rigor-de-contrato p/ APPLY no F1/T-001** (estende `routing.schema.json`, contrato versionado): design-brief `L-002` (constranger schemaVersion com enum + teste negativo no SPEC, não esperar review), `L-004` (unicidade de sub-campo de array = checagem pós-schema, não no .json), `L-001` (review-code `--mode=both` p/ contrato one-way mesmo com diff aditivo), `L-003` (garantir que `npm test` descobre os testes novos — convenção `tests/` plural). Plus minhas `wlf-f0 L-001` (enumerar sites de ripple ao mudar default) e `L-002` (asserções de doc discriminantes).
- **Single nextAction:** Disposicionar formalmente os 9 lessons no início do trabalho da F1 (ou aceitar o Keep acima), depois iniciar **F1/T-001** (estender `meta/schemas/routing.schema.json` com `integrationRef` opcional, preservando `additionalProperties:false`; criar `tests/routing-schema.test.js`). Mode 2-elegível (spec-ready + verifier `test`). **APLICAR design-brief L-002** aqui: o `integrationRef` é string — mas se tocar `schemaVersion`/enum, constranja por enum + teste negativo.
- **Verbatim state:** HEAD `plan/worktree-lifecycle-finalization` = commit da transição phase-done (a seguir). F1/T-001 verifier: `node --test tests/routing-schema.test.js`; F1/T-002 verifier: `node --test tests/integration-ref.test.js`. F1 G-2 verifier: `node --test tests/routing-schema.test.js && npm run validate-skills`. Alvos T-001: `meta/schemas/routing.schema.json` (hoje `additionalProperties:false`, descrito "Mode 2 routing"), `tests/routing-schema.test.js` (criar). F0 arquivada: `.atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/phases/archive/f0-always-fork-na-criacao-decis.md`. routing.json: mode2Enabled+codexLane.enabled=true. Follow-ups registrados (review F0): finding #2 (`shouldForkPlanBranch` sem caller runtime) + linha ~358 do `project-create-plan.md` (fluxo `adopt` com mesmo branch-or-null stale, fora do escopo Stage-6).
- **Uncommitted changes:** a transição phase-done F0→F1 (a commitar): `plan.md` (F0 done + gates met + reviewGate + currentPhase F1), F1 ativa, F0 arquivada (git mv), lessons file novo, `focus.json` (→F1). Após o commit, árvore LIMPA.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
