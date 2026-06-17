---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f1-integrationref-configuravel
title: integrationRef configurável + branch develop (Decisão 2)
goal: 'introduzir um ref de integração configurável (default `develop`)
  repo-global em `routing.json`, estendendo o schema (que hoje é
  `additionalProperties: false` e descrito como "Mode 2 routing"), e um
  resolvedor que lê o ref, aplica o default e sinaliza ausência para o prompt
  lazy no ponto de consumo (o finalize, F3).'
status: done
branch: plan/worktree-lifecycle-finalization
started: 2026-06-17T12:26:23Z
lastUpdated: 2026-06-17T15:15:13Z
nextAction: null
parentPlan: worktree-lifecycle-finalization
phaseId: F1
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: G-1
    description: Schema aceita integrationRef e rejeita chave desconhecida;
      resolvedor aplica default develop e sinaliza ausência sem assumir; suite
      verde.
    status: met
    metAt: 2026-06-17T13:56:08Z
    verifier:
      kind: test
      runner: node
      pattern: tests/integration-ref.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T13:56:08Z
      exitCode: 0
      testsCollected: 6
      passed: true
      outputSummary: "node --test tests/integration-ref.test.js @ af6c934: tests 6,
        pass 6, fail 0."
    verifierLabel: "test: node tests/integration-ref.test.js"
    evidenceSummary: passed · 6 tests · 2026-06-17
  - id: G-2
    description: routing.schema.json válido e skills válidos.
    status: met
    metAt: 2026-06-17T13:56:08Z
    verifier:
      kind: shell
      command: node --test tests/routing-schema.test.js && npm run validate-skills
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T13:56:08Z
      exitCode: 0
      passed: true
      outputSummary: routing-schema 4/4 && validate-skills All 15 valid @ af6c934, exit 0.
    verifierLabel: "shell: node --test tests/routing-schema.test.js && npm run validat…"
    evidenceSummary: passed · 2026-06-17
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
        impl/wlf-t-001, ff-merged + re-verified on primary (mode2 L-001: re-run
        is the adjudicator, not Codex -o)."
  - id: T-002
    title: Resolvedor de integrationRef com default e sinal-de-ausência
    status: done
    lastUpdated: 2026-06-17T13:48:57Z
    closedAt: 2026-06-17T13:48:57Z
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
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T13:48:57Z
      exitCode: 0
      testsCollected: 6
      passed: true
      outputSummary: "node --test tests/integration-ref.test.js on merged primary
        (722bf50): tests 6, pass 6, fail 0. Mode 2/Codex executed in worktree
        impl/wlf-t-002, ff-merged + re-verified on primary (mode2 L-001). Pure
        resolver: declared/default/not-configured discriminated, no fs/git/net,
        input not mutated."
parked: []
emerged: []
summary: Ref de integração configurável (default develop) em routing.json, com
  resolvedor e prompt-quando-ausente.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: false
---

# Narrative / notes

Initiative for phase **F1 — integrationRef configurável + branch develop (Decisão 2)**.

## Session handoff
- **Narrative:** F1 com **AMBAS as tasks DONE (2/2)** — fronteira de fase atingida. **T-001 DONE** (`integrationRef` opcional + `tests/routing-schema.test.js`, verifier 4/4 @ `4555063`). **T-002 DONE** (`scripts/integration-ref.js` resolvedor puro + `tests/integration-ref.test.js`, verifier 6/6 @ `722bf50`). Ambas via Mode 2/Codex (worktree isolada → diff revisado → ff-merge → re-verify na primária MERGED → evidence GATE-R2 → `validate-state` ✓), worktrees desmontadas. Gates da fase G-1/G-2 ainda `pending` (a iniciativa segue `active` — `done` NÃO auto-roda `phase-done`, operador opta).
- **Decision log:** Keep-all dos 9 lessons aceito e aplicado. **T-001:** design-brief `L-003` (`tests/` plural ✓), `wlf-f0 L-001` (ripple `title`+`description` ✓), `wlf-f0 L-002` (test assere o que MUDOU ✓), design-brief `L-002` não-disparou (string simples), `mode2 L-001` (auto-report `-o` descartado, re-run foi o adjudicador ✓). **T-002:** mesmo padrão Mode 2; design do schema confirmado — `"default": "develop"` no schema é só DOC, a aplicação do default + sinal-de-ausência mora no RESOLVEDOR (puro sobre conteúdo já lido: `null`/`undefined`=arquivo ausente→not-configured; objeto=presente→declared|default). `mode2 L-001` reconfirmado nas DUAS dispatches (Codex auto-reportou pass; o adjudicador foi o re-run na primária merged).
- **Single nextAction:** Rodar **`phase-done`** para F1: executa os exit-gates G-1 (`node --test tests/integration-ref.test.js`) + G-2 (`node --test tests/routing-schema.test.js && npm run validate-skills`) com evidence; roda o **review-gate obrigatório** (`review-code` sobre o diff da fase `bb8e5ab..HEAD`; sinal destrutivo provavelmente falso → `--mode=local`, mas confirmar; design-brief `L-001` sugere `--mode=both` p/ contrato/schema porta-única); distila lessons; grava `reviewGate` no `plan.md`; avança `currentPhase`→F2. **NÃO auto-avançar — operador opta.**
- **Verbatim state:** HEAD primária `plan/worktree-lifecycle-finalization` = `722bf50` (feat T-002) — o commit `done T-002` (state) vem a seguir. F1 exit-gates: G-1 verifier `node --test tests/integration-ref.test.js` (6/6 já verde @722bf50); G-2 verifier `node --test tests/routing-schema.test.js && npm run validate-skills` (routing-schema 4/4 verde; validate-skills a rodar). Range de review da fase: de `bb8e5ab` (commit ≤ `started` 2026-06-17T12:26:23Z, mas a fase só codou a partir daqui) a HEAD `722bf50` — commits da fase: `4555063` (T-001) + `722bf50` (T-002). Arquivos novos da fase: `meta/schemas/routing.schema.json` (mod), `tests/routing-schema.test.js`, `scripts/integration-ref.js`, `tests/integration-ref.test.js`. Follow-ups F0 abertos: finding #2 (`shouldForkPlanBranch` sem caller runtime) + linha ~358 `project-create-plan.md` (fluxo `adopt` branch-or-null stale).
- **Uncommitted changes:** state da transição `done T-002`, a commitar como `chore(project)`: `phases/f1-integrationref-configuravel.md` (T-002 done+evidence+rollups 2/2+nextAction+este handoff), `status/dispatch-log.json` (registro Mode 2 T-002 apendado), `focus.json` (regen → tasksDone 2). Após o commit, árvore LIMPA.

## Self-review (implement) against code-quality gates
- **G1 read-before-claim:** applied — cada task fechada linka o run do seu verifier (T-001 `node --test tests/routing-schema.test.js` 4/4 @ `4555063`; T-002 `node --test tests/integration-ref.test.js` 6/6 @ `722bf50`) e o diff de cada worktree foi LIDO de volta (`git -C … diff`) antes do merge, não assertado.
- **G2 soft-language:** applied — fechamento de cada task carrega `evidence.passed: true` + `testsCollected>0`, não "should/works/looks done"; narrativa do handoff varrida pela ban list (0 violações).
- **G6 reference-or-strike:** applied — literais do handoff/evidence são paths/comandos/SHAs verbatim (`4555063`, `722bf50`, comandos exatos dos verifiers e contagens reais 4/4 e 6/6).
- **Mode 2 (Codex) note:** ambas as tasks executadas pelo executor default Codex em worktree isolada; auto-report `-o` descartado nas duas (`mode2 L-001`); o adjudicador de cada `done` foi o re-run determinístico do verifier na primária MERGED, nunca a confiança do executor.

## Self-review against code-quality gates
- **G1 read-before-claim**: 2 tasks fechadas, cada uma com `outputs[]` + evidence do verifier; no review-gate, cada fix releu a fonte antes da edição (resolver lido fresh; test files lidos antes do append).
- **G2 soft-language**: varridos `nextAction` + descrições de task/critério + handoff + fix descriptions; 0 violações da ban list.
- **G6 reference-or-strike**: 2 exit criteria, ambos `met` com `evidence` populada; `reviewGate` carrega `at: 357f49e`; lessons carregam refs de evidence verbatim (review file + commit).
- **Codex review**: rodou via `atomic-skills:review-code --mode=both` em HEAD `357f49e`; verdict final `approve` (informed); counts blind 1M/1m → final 0/0 (2 dropped sob constraints); file `.atomic-skills/reviews/2026-06-17-1414-wlf-f1-integrationref.md`. Sinal destrutivo = false (diff aditivo); `--mode=both` escolhido pelo operador p/ rigor de contrato/schema (design-brief L-001).
- **Review gate (G2)**: gravado no descritor da fase como `reviewGate: { status: passed, at: 357f49e, mode: both, reviewFile: …, verifiedAt: 2026-06-17T14:14:34Z }` no `plan.md`. A prosa e o campo concordam (GATE-R3).
- **Lessons (G1)**: distiladas 2 lessons reusable em `lessons/worktree-lifecycle-finalization-f1-integrationref-configuravel.md` (own-prop+contrato; schema=shape/consumer=format), ratificadas pelo operador. +2 confirmações (design-brief L-001, mode2 L-001) registradas no corpo, sem nova lição.
- **Suite (contexto)**: full suite 900 testes, 10 falhas PRÉ-EXISTENTES (dashboard não-buildado + drift de detect/install), confirmadas no baseline com os fixes stashed → zero regressão F1. Verifiers da fase verdes (G-1 8/8 incl. hardening, G-2 routing-schema 5/5 + validate-skills 15).

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
