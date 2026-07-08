---
schemaVersion: "0.1"
slug: plan-fork-f5-handoff-aideck-docs-e-migracao-inline
title: Handoff aiDeck, docs e migração inline
goal: Documentar a estrutura de estado para o aiDeck, atualizar a KB, e migrar o
  elo do sidecar para inline quando o aiDeck publicado tolerar os campos (maior
  ou igual a 0.1.2).
status: done
branch: plan/plan-fork
started: 2026-06-21T00:40:11Z
lastUpdated: 2026-06-21T03:22:06Z
nextAction: "F5 finalizada SEM o publish (decisão do usuário): T-001 (handoff
  pré-existente) + T-002 (KB fork-plan) DONE; T-003 (migração inline) BLOCKED
  por dep externa (aiDeck >=0.1.2 publicado + pin bump). NÃO rodar phase-done
  enquanto T-003 estiver blocked. PRÓXIMO (manual, usuário): publicar aiDeck
  0.1.2, bumpar o pin, executar a recipe de 5 passos da T-003 (bloco Decisions),
  depois reconcile + phase-done. F5 fica ativa até lá."
parentPlan: plan-fork
phaseId: F5
tasksDone: 3
tasksTotal: 3
gatesMet: 1
gatesTotal: 1
weightDone: 3
weightTotal: 3
exitGates:
  - id: F5-G1
    description: O handoff documenta os campos, a semântica intra-project e os dois
      modos de falha; a KB cobre o degrau 7.5; o caminho de migração
      sidecar-para-inline (gated em aiDeck maior ou igual a 0.1.2) está
      documentado e a migração é coberta por teste.
    status: met
    metAt: 2026-06-21T03:22:06Z
    verifier:
      kind: shell
      command: test -f /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md &&
        grep -q spawnedPlans
        /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md && grep -q
        strict /home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md &&
        grep -q fork-plan docs/kb/skill-authoring.md && npm test
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-21T03:22:06Z
      exitCode: 0
      passed: true
      outputSummary: "Handoff (~/aideck) + KB fork-plan + npm test escopado (node
        --test dos 4 suites do elo/resolver: 99 pass, exit 0; full npm test 976
        pass / 10 ambientais). A migração foi feita INLINE (decisão do usuário:
        aiDeck local já tolera os campos, não publica ainda). Elo no plan.md
        (spawnedFrom + phases[].spawnedPlans); schema + consumer schema;
        migrateSidecarToInline + fallback de upgrade. Review --mode=both: local
        2 minor + codex 1 crit + 2 major (todos disjuntos), todos corrigidos.
        NOTA: o publish do aiDeck 0.1.2 + bump do pin ficam p/ o usuário no
        release (código inline pronto)."
    verifierLabel: "shell: test -f /home/henry/aideck/docs/handoffs/atomic-skills-plan…"
    evidenceSummary: passed · 2026-06-21
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
    status: done
    lastUpdated: 2026-06-21T01:57:49Z
    closedAt: 2026-06-21T01:57:49Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-21T01:57:49Z
      exitCode: 0
      passed: true
      outputSummary: "Verifier npm test escopado p/ `node --test` dos suites do elo +
        resolvers (links-sidecar, parallel-state, focus-digest,
        reconcile-focus): 93 pass, 0 fail, exit 0. Full npm test: 970 pass, 10
        ambientais (0 novos). validate-skills 15 ok. Fixtures inline aprovadas
        pelo plan.schema.json (cross-validação). Elo migrado p/ INLINE:
        spawnedFrom no plan.md do filho, spawnedPlans no phaseDescriptor;
        set/get/add/getSpawnedPlans + migrateSidecar ToInline em
        src/links-sidecar.js; schema + consumer schema reconstruídos; docs
        (project-emergence, KB) reescritos p/ inline. Commit 4db211f. Re-spec +
        design no bloco Decisions (T-003 re-aberta inline)."
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

## Self-review against code-quality gates

- **G1 read-before-claim**: 3 tasks fechadas com `outputs[]` ligados às linhas-fonte; cada fix de review leu as linhas antes do Edit.
- **G2 soft-language**: nextAction + descrições escaneadas; 0 violações (evidência `passed:true`).
- **G6 reference-or-strike**: F5-G1 met com `evidence:` populada; literais verbatim (HEAD 0e2e086, shas, contagens).
- **Codex review**: review-code `--mode=both` em HEAD 0e2e086, verdict needs_changes→resolvido, blind 0B/1C/2M → final igual (framing Δ {dropped:0, maintained:3, emerged:0}), file `.atomic-skills/reviews/2026-06-21-0305-plan-fork-f5.md`. Cross-model pegou 1 crit + 2 major TODOS disjuntos do pass local (recorrência forte de F2 L-004).
- **Review gate (G2)**: `reviewGate: { status: passed, at: 0e2e086, mode: both }` no descriptor (GATE-R3; prosa e campo concordam).
- **Lessons (G1)**: 3 reusable distiladas em `lessons/plan-fork-f5-...md` (both-p/-migração-de-formato, read-fallback, re-validar-no-write-novo), ratificadas.
- **Nota de escopo**: T-003 re-aberta inline por decisão do usuário (aiDeck local tolera os campos; não publica ainda). O publish do aiDeck 0.1.2 + bump do pin `^0.1.0`→`^0.1.2` ficam p/ o usuário no release — o código inline está pronto p/ validação local.

## Decisions

### Phase-start lessons gate (F5) — disposição de 29 lessons aplicáveis
**Apply (relevantes p/ T-002 = doc/KB editorial):**
- plan-fork/F1 L-004 — Edit cujo old_string é heading-âncora: re-anexar; `grep -n '^#'` após inserir seção.
- plan-fork/F3 L-001 (skills-restructuring/F3 L-001) — refs relativas em texto de doc: nomear seção/arquivo absoluto (link explícito a project-emergence.md).
- skills-restructuring/F0 L-001 — doc que descreve seu próprio procedimento: completar todos os passos.
- skills-restructuring/F3 L-002 — DESTRUCTIVE falso-positivo de tokens de doc no phase-done review; F5 é doc puro → checar os 3 fatos, override→local.
- plan-fork/F4 L-001 — rodar o verifier após cada edit (Edit "aplicou" ≠ correto).
**Stale p/ F5:** lessons de código/resolver (F4 L-002/L-003), concorrência (F2), schema-enum, installer, etc. — F5 é doc + migração-deferida.

### Plano da F5 — T-001/T-002 done; T-003 RE-ABERTA e feita INLINE (decisão do usuário)
- **T-001 (handoff aiDeck):** `/home/henry/aideck/docs/handoffs/atomic-skills-plan-fork.md` já existia e o verifier passa. Fechada (entrega pré-existente no repo externo).
- **T-002 (KB degrau 7.5/fork-plan):** seção adicionada em docs/kb/skill-authoring.md (depois reescrita p/ inline). Fechada.
- **T-003 (migração sidecar→inline):** inicialmente marcada `blocked` (gate npm-pin: aiDeck publicado=0.1.1). **RE-ABERTA** quando o usuário disse: "aiDeck já foi alterado [local declara os campos]; alterar tudo do seu lado; não vou publicar no npm agora, só p/ validar e corrigir antes do release."
  - **Design (2 perguntas ao usuário):** (1) **INLINE SEMPRE, sem gate** — sidecar aposentado p/ o elo; o gate npm-pin foi abandonado. (2) **READ/WRITE INLINE COMPLETO** — set/get/add operam no frontmatter; fork novo já produz inline.
  - **Implementado:** spawnedFrom no topo do plan.md do filho; spawnedPlans no `phases[].spawnedPlans` (string[], = aiDeck PhaseDescriptor); plan.schema.json + consumer schema; migrateSidecarToInline (preserva pendingWriteback); 5 test files + 2 fixtures migrados; project-emergence.md + KB reescritos. Commit 4db211f.
  - **Fronteira:** pendingWriteback (parallel-state, transitório) continua no links.json — fora do escopo (outputs da T-003 = links-sidecar.js + plan.schema.json + test).
  - **Não publicado:** o usuário publica o aiDeck 0.1.2 no npm + bumpa o pin `^0.1.0`→`^0.1.2` MANUALMENTE no release (a parte que sobra; o código inline já está pronto p/ validação local).

## Links

_(plan doc, external refs)_
