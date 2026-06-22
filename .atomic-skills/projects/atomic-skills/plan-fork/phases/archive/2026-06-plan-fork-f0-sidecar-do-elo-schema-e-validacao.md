---
schemaVersion: "0.1"
slug: plan-fork-f0-sidecar-do-elo-schema-e-validacao
title: Sidecar do elo, schema e validação
goal: Gravar o elo num sidecar não-aiDeck-facing compatível com aiDeck 0.1.0,
  validar o sidecar, e cobrir detecção de ciclo com testes; a adição dos campos
  inline ao plan.schema.json fica deferida para a migração na F5.
status: done
branch: plan/plan-fork
started: 2026-06-19T15:32:29.603Z
lastUpdated: 2026-06-19T18:53:49Z
nextAction: null
parentPlan: plan-fork
phaseId: F0
tasksDone: 4
tasksTotal: 4
gatesMet: 1
gatesTotal: 1
exitGates:
  - id: F0-G1
    description: O elo vive no sidecar; plan.md e frontmatters de fase ficam sem
      spawnedFrom/spawnedPlans sob aiDeck 0.1.0; ciclo é rejeitado; os testes
      passam. O caminho canônico do sidecar (links.json no diretório do plano),
      o schema e o reader/writer (src/links-sidecar.js) ficam definidos aqui na
      F0, antes de qualquer escrita da F1; a concorrência cross-worktree é
      deferida à F2 (pause-only não escreve concorrente).
    status: met
    metAt: 2026-06-19T18:53:49Z
    verifier:
      kind: shell
      command: npm run validate-state tests/fixtures/plan-fork/plans/fixture-parent.md
        tests/fixtures/plan-fork/plans/fixture-child.md && node --test
        tests/links-sidecar.test.js tests/spawn-graph.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T18:53:49Z
      exitCode: 0
      passed: true
      outputSummary: validate-state 2 plans cross-validated; node --test links-sidecar
        + spawn-graph → tests 40, pass 40, fail 0, exit 0 (after review fix
        52ea43f)
    verifierLabel: "shell: npm run validate-state tests/fixtures/plan-fork/plans/fixtu…"
    evidenceSummary: passed · 2026-06-19
stack:
  - id: 1
    title: Sidecar do elo, schema e validação
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: "Sidecar links.json: reader e writer do elo"
    status: done
    closedAt: 2026-06-19T17:06:40.000Z
    lastUpdated: 2026-06-19T17:06:40.000Z
    scopeBoundary:
      - não gravar spawnedFrom/spawnedPlans inline no plan.md nem nos
        frontmatters de fase enquanto o pin do aiDeck for 0.1.0; não editar
        código do aiDeck.
    acceptance:
      - o elo (spawnedFrom no filho, spawnedPlans por fase no pai) é gravado e
        lido de links.json no dir do plano; plan.md e os frontmatters de fase
        ficam sem os dois campos sob aiDeck 0.1.0; um teste prova que o estado
        aiDeck-facing (frontmatter) não muda ao forkar.
    verifier:
      kind: shell
      command: node --test tests/links-sidecar.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:06:40.000Z
      exitCode: 0
      passed: true
      outputSummary: node --test tests/links-sidecar.test.js → tests 10, pass 10, fail
        0 (exit 0)
    outputs:
      - kind: file
        path: src/links-sidecar.js
      - kind: file
        path: tests/links-sidecar.test.js
    summary: Reader/writer do elo no sidecar links.json (frontmatter fica limpo).
  - id: T-002
    title: Schema de validação do sidecar links.json
    status: done
    closedAt: 2026-06-19T17:12:10.000Z
    lastUpdated: 2026-06-19T17:12:10.000Z
    scopeBoundary:
      - apenas o schema do sidecar; a adição de spawnedFrom/spawnedPlans ao
        plan.schema.json fica para a F5 (migração), não aqui.
    acceptance:
      - o schema valida spawnedFrom com plan, phaseId, taskId opcional e mode em
        pause ou parallel, e spawnedPlans como array de slugs por fase; rejeita
        mode fora do enum.
    verifier:
      kind: shell
      command: node --test tests/links-sidecar.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:12:10.000Z
      exitCode: 0
      passed: true
      outputSummary: node --test tests/links-sidecar.test.js → tests 20, pass 20, fail
        0 (exit 0); 10 schema cases incl. mode-enum rejection
    outputs:
      - kind: file
        path: meta/schemas/links.schema.json
      - kind: file
        path: tests/links-sidecar.test.js
    summary: Schema de validação do sidecar links.json.
  - id: T-003
    title: Helper puro de detecção de ciclo no grafo pai/filho
    status: done
    closedAt: 2026-06-19T17:14:20.000Z
    lastUpdated: 2026-06-19T17:14:20.000Z
    scopeBoundary:
      - apenas a função pura de detecção sobre o grafo de elos (do sidecar); sem
        I/O, sem mutação; não conectar ao verbo aqui.
    acceptance:
      - dada uma cadeia de elos, a função rejeita um fork que aponte para um
        ancestral (ciclo) e aceita uma cadeia acíclica.
    verifier:
      kind: shell
      command: node --test tests/spawn-graph.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:14:20.000Z
      exitCode: 0
      passed: true
      outputSummary: node --test tests/spawn-graph.test.js → tests 14, pass 14, fail 0
        (exit 0); cycle/self-fork/acyclic cases
    outputs:
      - kind: file
        path: src/spawn-graph.js
      - kind: file
        path: tests/spawn-graph.test.js
    summary: Função pura que rejeita fork apontando para ancestral (ciclo).
  - id: T-004
    title: Fixtures de par pai/filho e validação RED para GREEN
    status: done
    closedAt: 2026-06-19T17:19:58.000Z
    lastUpdated: 2026-06-19T17:19:58.000Z
    scopeBoundary:
      - fixtures de teste apenas; não criar planos reais em .atomic-skills/.
    acceptance:
      - validate-state aprova o par pai/filho com os frontmatters limpos (elo no
        sidecar); o teste fica vermelho antes da T-001 e verde depois.
    outputs:
      - kind: file
        path: tests/fixtures/plan-fork/plans/fixture-parent.md
      - kind: file
        path: tests/fixtures/plan-fork/plans/fixture-child.md
      - kind: file
        path: tests/links-sidecar.test.js
    summary: Fixtures de par pai/filho (elo no sidecar) + validação RED→GREEN.
    verifier:
      kind: shell
      command: node --test tests/links-sidecar.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:19:58.000Z
      exitCode: 0
      passed: true
      outputSummary: node --test tests/links-sidecar.test.js → tests 23, pass 23, fail
        0 (exit 0); fixtures clean + validate-state approves the pair (exit 0)
parked: []
emerged: []
summary: Sidecar (links.json) do elo + schema do sidecar + detecção de ciclo;
  inline deferido.
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
planActive: true
current: false
---

# Narrative / notes

Initiative for phase **F0 — Sidecar do elo, schema e validação**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Self-review against code-quality gates (implement)

- **G1 read-before-claim:** applied — cada uma das 4 tasks fechou com `evidence` ligando o run real do verifier (`node --test … → N pass / 0 fail, exit 0`) e os `outputs[]` apontando os arquivos-fonte (src/links-sidecar.js, meta/schemas/links.schema.json, src/spawn-graph.js, fixtures). Nenhum close por asserção.
- **G2 soft-language:** applied — claims de conclusão são `passed: true` + exitCode 0 (sem "should/works/looks done"); narrativa do handoff varrida pela ban-list.
- **G6 reference-or-strike:** applied — literais verbatim (comandos `node --test …`, exit codes, paths, hashes `6e5a4f2`/`638fbc9`/`42fd02b`) na evidência e no handoff.
- **Nota de processo:** o review-code gate da fase + a distilação de lessons NÃO foram feitos aqui — eles pertencem ao `phase-done` (próxima sessão). Este bloco é o checkpoint do `implement`, não o self-review do `phase-done`.

## Session handoff

- **Narrative:** F0 FECHADA via phase-done (2026-06-19). 4/4 tasks done com evidence GATE-R2; exit-gate F0-G1 met (`validate-state` + `node --test` → 40/40, exit 0). review-code (local, sealed) sobre `6e5a4f2..e0bdfd1`: 1 major fechado (readLinks hardening — path-bearing rethrow + rejeição de não-objeto, commit `52ea43f`) + 2 minor → lessons L-001/L-002. `reviewGate: passed @52ea43f`. `currentPhase` avançou para F1.
- **Decision log:** (1) round-3 codex-only ANTES de implementar (3C→2C→0C; 5 majors aplicados doc-only, sem round-4); (2) **verifier `npm test` está RED no baseline** — 10 falhas ambientais (dashboard não-buildado + install), provadas por stash. Dashboard sendo refeito em OUTRA worktree por outro agente → NÃO buildo aqui (evitaria atropelar `~/.atomic-skills/dashboard` compartilhado). 7º achado: verifiers da F0 escopados a `node --test <tests do plan-fork>`; (3) testes em `tests/` (não `src/*.test.js`, ignorado pelo glob → false-green); T-003 test path corrigido; (4) fixtures movidas p/ `tests/fixtures/plan-fork/plans/fixture-{parent,child}.md` — `validate-state` infere kind pelo path (precisa de ancestral `plans/`) e exige `subPhaseCount` no phase descriptor.
- **Single nextAction:** F0 fechada — nenhuma ação pendente nesta iniciativa (arquivada). A iniciativa ativa agora é a F1 (`plan-fork-f1-verbo-fork-plan-degrau-7-5-pause-only-at`); o handoff dela carrega o próximo passo.
- **Verbatim state:** worktree `/home/henry/atomic-skills/.worktrees/plan-fork`; branch `plan/plan-fork`. F0-G1 gate: `npm run validate-state tests/fixtures/plan-fork/plans/fixture-parent.md tests/fixtures/plan-fork/plans/fixture-child.md && node --test tests/links-sidecar.test.js tests/spawn-graph.test.js` → exit 0, 37/37. Tasks done: T-001(10), T-002(20), T-003(14 spawn-graph), T-004(23). Review round-3: `.atomic-skills/reviews/2026-06-19-1324-plan-fork-r3.md`.
- **Uncommitted changes:** nenhuma pendente — implementação F0 commitada (`638fbc9`/`42fd02b`/`e0bdfd1`), fix do review commitado (`52ea43f`), e os writes do phase-done commitados como `chore(project): phase-done F0`.

## Self-review against code-quality gates (phase-done)

- **G1 read-before-claim:** 4 tasks fechadas, cada uma ligada à fonte em `outputs[]` + um run real do verifier em `evidence`. O fix do review leu `src/links-sidecar.js:46-50` e `src/spawn-graph.js:40-98` antes de classificar/editar.
- **G2 soft-language:** varri `nextAction`/descrições de task/criterion + a descrição do fix + a mensagem do commit `52ea43f` pela ban-list; 0 ocorrências.
- **G6 reference-or-strike:** exit-gate F0-G1 met com `evidence` (exit 0, 40/40); `reviewGate.at: 52ea43f`, `reviewFile: .atomic-skills/reviews/2026-06-19-1553-plan-fork-f0.md`.
- **Codex review:** NÃO rodado neste gate (modo local; sinal destrutivo G5 = false → `--mode=local` per phase-done step 6). As rodadas r2/r3 do plan-fork foram reviews de PLAN/DESIGN (codex), não este review do diff de código.
- **Review gate (G2):** gravado no phase descriptor como `reviewGate: { status: passed, at: 52ea43f536ee842d3c4b41926dd3842c07b6a15d, mode: local, reviewFile: .atomic-skills/reviews/2026-06-19-1553-plan-fork-f0.md }`. Prosa e descriptor concordam (GATE-R3).
- **Lessons (G1):** 2 lessons distiladas (L-001 readLinks-hardening, L-002 hasCycle-iterativo — ambas reusable) em `lessons/plan-fork-f0-sidecar-do-elo-schema-e-validacao.md`, ratificadas pelo usuário; `list-lessons --phase F1` surfa as duas. Achado #3 (write não-atômico) NÃO virou lesson — convenção da casa.
