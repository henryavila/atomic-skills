---
schemaVersion: "0.1"
slug: plan-fork-f5-handoff-aideck-docs-e-migracao-inline
title: Handoff aiDeck, docs e migração inline
goal: Documentar a estrutura de estado para o aiDeck, atualizar a KB, e migrar o
  elo do sidecar para inline quando o aiDeck publicado tolerar os campos (maior
  ou igual a 0.1.2).
status: active
branch: plan/plan-fork
started: 2026-06-21T00:40:11Z
lastUpdated: 2026-06-21T01:19:34Z
nextAction: "F5 finalizada SEM o publish (decisão do usuário): T-001 (handoff
  pré-existente) + T-002 (KB fork-plan) DONE; T-003 (migração inline) BLOCKED
  por dep externa (aiDeck >=0.1.2 publicado + pin bump). NÃO rodar phase-done
  enquanto T-003 estiver blocked. PRÓXIMO (manual, usuário): publicar aiDeck
  0.1.2, bumpar o pin, executar a recipe de 5 passos da T-003 (bloco Decisions),
  depois reconcile + phase-done. F5 fica ativa até lá."
parentPlan: plan-fork
phaseId: F5
tasksDone: 2
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F5-G1
    description: O handoff documenta os campos, a semântica intra-project e os dois
      modos de falha; a KB cobre o degrau 7.5; o caminho de migração
      sidecar-para-inline (gated em aiDeck maior ou igual a 0.1.2) está
      documentado e a migração é coberta por teste.
    status: pending
    verifier:
      kind: shell
      command: test -f /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md &&
        grep -q spawnedPlans
        /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md && grep -q
        strict /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md &&
        grep -q fork-plan docs/kb/skill-authoring.md && npm test
    verifierLabel: "shell: test -f /home/henry/aideck/docs/handoffs/atomic-skills-plan…"
stack:
  - id: 1
    title: Handoff aiDeck, docs e migração inline
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: Handoff ao aiDeck
    status: done
    lastUpdated: 2026-06-21T01:19:34Z
    closedAt: 2026-06-21T01:19:34Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-21T01:19:34Z
      exitCode: 0
      passed: true
      outputSummary: test -f
        /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md && grep -q
        spawnedFrom && grep -q spawnedPlans && grep -q strict → exit 0. O
        handoff já existia no repo externo ~/aideck (trabalho anterior, ver
        memory aideck-plan-fork-contract / aideck-nav-projects-f1-handoff) e
        cobre o contrato (32 hits de
        spawnedFrom/spawnedPlans/strict/intra-project/sidecar/ pause/parallel).
        Entrega pré-existente confirmada, não reescrita.
    scopeBoundary:
      - apenas o documento de handoff; não editar código do aiDeck.
    acceptance:
      - o handoff documenta os campos exatos (spawnedFrom, spawnedPlans), a
        semântica pai/filho intra-project, a expectativa de render aninhado, e
        os dois modos de falha do .strict (spawnedFrom derruba o card,
        spawnedPlans é stripado).
    verifier:
      kind: shell
      command: test -f /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md &&
        grep -q spawnedFrom
        /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md && grep -q
        spawnedPlans /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md
        && grep -q strict
        /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md
    outputs:
      - kind: file
        path: ~/aideck/docs/handoffs/atomic-skills-plan-fork.md
    summary: Escreve o handoff do plan-fork em ~/aideck.
  - id: T-002
    title: Atualizar a KB do atomic-skills
    status: done
    lastUpdated: 2026-06-21T01:19:34Z
    closedAt: 2026-06-21T01:19:34Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-21T01:19:34Z
      exitCode: 0
      passed: true
      outputSummary: "grep -q fork-plan docs/kb/skill-authoring.md → exit 0.
        Adicionada a seção `## The fork-plan step (degrau 7.5)` em
        docs/kb/skill-authoring.md: quando usar, link explícito p/
        skills/shared/project-assets/project-emergence.md, e os 5 pontos
        load-bearing (filho é plano real, intra-project, sidecar→inline em
        ≥0.1.2, resume-como-transação/hard-gate, foco-hierarquia). Headings
        conferidos via rg '^## ' (sem orfanização). Verifier grep fraco; é doc
        editorial."
    scopeBoundary:
      - apenas a seção sobre a ladder/plan-fork; não reescrever a KB inteira.
    acceptance:
      - a KB documenta o degrau 7.5 e o verbo fork-plan com link para
        project-emergence.md.
    verifier:
      kind: shell
      command: grep -q fork-plan docs/kb/skill-authoring.md
    outputs:
      - kind: file
        path: docs/kb/skill-authoring.md
    summary: Documenta o degrau 7.5 na KB.
  - id: T-003
    title: Migração sidecar para inline (gated em aiDeck maior ou igual a 0.1.2)
    status: blocked
    lastUpdated: 2026-06-21T01:19:34Z
    blockedBy:
      - "Dep externa: @henryavila/aideck >=0.1.2 PUBLICADO no npm + pin bumpado
        p/ ^0.1.2. Estado em 2026-06-21: npm latest=0.1.1, instalado=0.1.0,
        pin=^0.1.0, ~/aideck local=0.1.2 (não publicado). P3: emitir spawnedFrom
        inline com o consumidor .strict publicado (<=0.1.1) derruba o card — não
        migrar até publicar."
      - "Decisão do usuário: a migração será feita MANUALMENTE depois, numa
        tarefa de reconciliação (recipe de 5 passos registrado no bloco
        Decisions desta fase)."
    scopeBoundary:
      - só roda quando o pin do aiDeck for maior ou igual a 0.1.2; não emitir os
        campos inline enquanto o pin for 0.1.0.
    acceptance:
      - com o pin maior ou igual a 0.1.2, spawnedFrom e spawnedPlans são
        adicionados ao plan.schema.json, o conteúdo do sidecar é migrado para o
        frontmatter, e o sidecar é removido; com pin 0.1.0 a task fica bloqueada
        e não emite inline; um teste cobre os dois ramos (migra em ≥0.1.2,
        bloqueia em 0.1.0).
    outputs:
      - kind: file
        path: meta/schemas/plan.schema.json
      - kind: file
        path: src/links-sidecar.js
      - kind: file
        path: src/links-sidecar.test.js
    summary: Migra o elo do sidecar para inline quando aiDeck ≥0.1.2.
    verifier:
      kind: shell
      command: npm test
parked: []
emerged: []
summary: Handoff aiDeck + KB + migração sidecar→inline (gated em aiDeck ≥0.1.2).
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F5 — Handoff aiDeck, docs e migração inline**.

## Decisions

### Phase-start lessons gate (F5) — disposição de 29 lessons aplicáveis
**Apply (relevantes p/ T-002 = doc/KB editorial):**
- plan-fork/F1 L-004 — Edit cujo old_string é heading-âncora: re-anexar; `grep -n '^#'` após inserir seção.
- plan-fork/F3 L-001 (skills-restructuring/F3 L-001) — refs relativas em texto de doc: nomear seção/arquivo absoluto (link explícito a project-emergence.md).
- skills-restructuring/F0 L-001 — doc que descreve seu próprio procedimento: completar todos os passos.
- skills-restructuring/F3 L-002 — DESTRUCTIVE falso-positivo de tokens de doc no phase-done review; F5 é doc puro → checar os 3 fatos, override→local.
- plan-fork/F4 L-001 — rodar o verifier após cada edit (Edit "aplicou" ≠ correto).
**Stale p/ F5:** lessons de código/resolver (F4 L-002/L-003), concorrência (F2), schema-enum, installer, etc. — F5 é doc + migração-deferida.

### Plano da F5 — finalizar SEM o npm publish (decisão do usuário)
O usuário: "finalize sem o npm publish; eu farei manualmente depois na tarefa de reconciliação."
- **T-001 (handoff aiDeck):** o arquivo `/home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md` JÁ EXISTE e o verifier (`test -f && grep spawnedFrom && grep spawnedPlans && grep strict`) JÁ PASSA. Confirmar conteúdo adequado e fechar (entrega no repo externo ~/aideck, pré-existente).
- **T-002 (KB degrau 7.5/fork-plan):** in-repo, desbloqueada — FAZER agora em docs/kb/skill-authoring.md (alvo+verifier admitidos no SPEC apesar do leve mismatch tópico; não realocar).
- **T-003 (migração sidecar→inline):** BLOQUEADA por dep externa. Estado: aiDeck publicado no npm = 0.1.1; instalado = 0.1.0; pin = `^0.1.0`; ~/aideck local = 0.1.2 (NÃO publicado). P3: emitir spawnedFrom inline com o consumidor `.strict` publicado (≤0.1.1) DERRUBA o card. **Não rodar.** Marcada `blocked`; o usuário publica o aiDeck 0.1.2 + bumpa o pin + executa a migração MANUALMENTE depois (reconcile). Recipe registrado abaixo.
- **phase-done:** NÃO rodar enquanto T-003 estiver blocked — a fase não fecha sobre uma task aberta. F5 fica ativa com T-001/T-002 done + T-003 blocked.

### Recipe manual da T-003 (para a reconciliação futura, quando aiDeck ≥0.1.2 publicado)
1. Publicar `@henryavila/aideck` 0.1.2 no npm (a partir de ~/aideck).
2. Bumpar o pin em `package.json`: `"@henryavila/aideck": "^0.1.2"`; `npm install`.
3. Adicionar `spawnedFrom` + `spawnedPlans` ao `meta/schemas/plan.schema.json` (espelhando `meta/schemas/links.schema.json`).
4. Migrar o conteúdo de cada `links.json` pro frontmatter do plan.md (spawnedFrom no plano-filho; spawnedPlans na fase-âncora do pai) e remover o sidecar.
5. Teste cobrindo os 2 ramos: migra em ≥0.1.2, bloqueia/no-op em 0.1.0. `npm test`.

## Links

_(plan doc, external refs)_
