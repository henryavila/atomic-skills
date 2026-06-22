---
schemaVersion: "0.1"
slug: plan-fork-f2-protocolo-de-estado-parallel-cross-workt
title: Protocolo de estado parallel cross-worktree
goal: "Definir e implementar o protocolo de estado do modo parallel com
  semântica de concorrência explícita: caminho canônico, escrita atômica com
  token de revisão, predicado de conflito, abort e recuperação, e verificação a
  partir do pai e do filho."
status: done
branch: plan/plan-fork
started: 2026-06-19T19:56:59Z
lastUpdated: 2026-06-20T01:33:14Z
nextAction: null
parentPlan: plan-fork
phaseId: F2
tasksDone: 2
tasksTotal: 2
gatesMet: 1
gatesTotal: 1
exitGates:
  - id: F2-G1
    description: "O protocolo de concorrência otimista está definido e testado: a
      escrita atinge o estado canônico do pai e edições concorrentes pai/filho
      são detectadas e abortadas sem lost update."
    status: met
    metAt: 2026-06-20T01:33:14Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-20T01:33:14Z
      exitCode: 0
      passed: true
      outputSummary: "node --test (parallel-state+links-sidecar+spawn-graph) → tests
        64, pass 64, fail 0, exit 0. Gate escopado (node --test; RED ambiental,
        precedente F0/F1). Review --mode=both: 11 findings (6 local + 5 codex, 2
        disjuntos) corrigidos em 1f24eb3 antes do met."
    verifier:
      kind: shell
      command: node --test tests/parallel-state.test.js tests/links-sidecar.test.js
        tests/spawn-graph.test.js
    verifierLabel: "shell: node --test tests/parallel-state.test.js tests/links-sideca…"
    evidenceSummary: passed · 2026-06-20
stack:
  - id: 1
    title: Protocolo de estado parallel cross-worktree
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: Especificar o protocolo de estado parallel (concorrência otimista)
    status: done
    lastUpdated: 2026-06-20T01:13:19Z
    closedAt: 2026-06-20T01:13:19Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-20T01:13:19Z
      exitCode: 0
      passed: true
      outputSummary: "test -f docs/design/plan-fork-parallel-state.md → exit 0. Spec
        define: canônico = worktree do pai (resolução via git worktree list +
        branch do pai); token = sha256 content-hash (CAS); escrita atômica (lock
        O_EXCL curto + temp+rename); predicado de conflito exato (token1 !=
        token0); abort + pendingWriteback declarativo durável no sidecar do
        filho; verificação das 2 worktrees. 3 decisões one-way-door ratificadas
        pelo usuário. Ponteiro adicionado no bullet parallel de
        project-emergence.md."
    scopeBoundary:
      - apenas o modo parallel; o pause-mode não muda.
    acceptance:
      - o doc define qual worktree detém o estado canônico do pai, a leitura por
        revisão ou hash, a escrita atômica, o predicado de conflito exato, a
        condição de abort, o caminho de recuperação para o usuário, e a
        verificação a partir das duas worktrees.
    verifier:
      kind: shell
      command: test -f docs/design/plan-fork-parallel-state.md
    outputs:
      - kind: file
        path: docs/design/plan-fork-parallel-state.md
      - kind: file
        path: skills/shared/project-assets/project-emergence.md
    summary: "Spec do protocolo parallel: canônico, revisão, conflito, abort,
      recuperação."
  - id: T-002
    title: Implementar resolução canônica e writeback com concorrência otimista
    status: done
    lastUpdated: 2026-06-20T01:17:22Z
    closedAt: 2026-06-20T01:17:22Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-20T01:17:22Z
      exitCode: 0
      passed: true
      outputSummary: "Verifier `npm test` escopado para `node --test
        tests/parallel-state.test.js` (baseline npm test RED ambiental —
        precedente F0/F1): tests 14, pass 14, fail 0, exit 0. Suite relacionada
        `node --test links-sidecar+spawn-graph+parallel-state`: tests 54, pass
        54, fail 0 (sem regressão da mudança no links.schema.json). G9
        mutation-kill: desabilitar o predicado de conflito (token1!==readToken)
        → 2 testes RED (conflito + concorrência), revertido → 14/14 GREEN.
        Implementa a spec T-001: contentToken sha256, parseWorktrees,
        resolveCanonicalParentDir, atomicWriteback (lock O_EXCL + temp+rename +
        CAS), recordPendingWriteback/clearPendingWriteback."
      mutation:
        target: src/parallel-state.js:atomicWriteback (predicado de conflito)
        change: if (token1 !== readToken) → if (false && …) — desabilita o CAS
        killedBy:
          - aborts (conflict) without writing when the token is stale
          - "concurrency: two writebacks captured at the SAME token0 — first
            wins, second conflicts, no lost update"
        killTranscript: "inject → node --test: fail 2 (conflito+concorrência) → revert →
          tests 14 pass 14 fail 0"
    scopeBoundary:
      - apenas a resolução e o writeback do estado parallel; não tocar o
        pause-mode.
    acceptance:
      - dada uma worktree-filho, a função resolve o pai canônico mesmo em outra
        worktree e a escrita atinge o estado canônico via escrita atômica com
        token de revisão; edições simultâneas de pai e filho disparam o conflito
        (sem lost update) e abortam com caminho de recuperação; um teste simula
        a concorrência.
    outputs:
      - kind: file
        path: src/parallel-state.js
      - kind: file
        path: src/parallel-state.test.js
    summary: Resolução canônica + writeback atômico com concorrência otimista.
    verifier:
      kind: shell
      command: npm test
parked: []
emerged: []
summary: Protocolo de estado parallel com concorrência otimista (revisão,
  conflito, abort).
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
planActive: true
---

# Narrative / notes

Initiative for phase **F2 — Protocolo de estado parallel cross-worktree**.

## Decisions

### Phase-start lessons disposition (2026-06-19, gate F2)

`node scripts/list-lessons.js --phase F2` → 18 lessons. Disposição (nenhuma Stale/Reject — todas válidas):

- **APPLY:** plan-fork-F1 L-002 (write após dependência existir / rollback — é o cerne do write atômico + abort/recovery da F2); plan-fork-F1 L-003 (reuso-por-efeito: conferir predicado de seleção do `parallelismAllowed`/worktree-por-plano); plan-fork-F0 L-001 (novos readers/writers do estado concorrente: ausente vs corrompido + rethrow com path); plan-fork-F1 L-001 (guarda = step numerado na porção doc do protocolo) + L-005 (rodar review gate — porção editorial); design-brief-F0 L-003 (**teste em `tests/`, não `src/` — `npm test` glob de `tests/*.test.js`**); design-brief-F0 L-002 (review-token no estado → enum de schemaVersion + teste negativo se mudar schema); design-brief-F0 L-001 (protocolo = contrato caro de reverter → considerar review `--mode=both` no phase-done).
- **KEEP (re-checar se a F2 tocar a superfície):** plan-fork-F0 L-002, plan-fork-F1 L-004, design-brief-F0 L-004, skills-restructuring F0/F1-1/F2/F3/F4/F6.

### Flag de spec (T-002) — corrigir no implementar

T-002 declara `outputs: src/parallel-state.test.js`, mas `npm test` (= verifier da T-002 e do gate F2-G1) faz glob de `tests/*.test.js`. Um teste em `src/` NÃO é descoberto → false-green. Por L-003: o teste vai em **`tests/parallel-state.test.js`** (o módulo fica em `src/parallel-state.js`). Desvio do `outputs[].path` declarado, registrado aqui; deliverable (o teste de concorrência) inalterado.

## Links

_(plan doc, external refs)_

## Self-review against code-quality gates (phase-done F2)

- **G1 read-before-claim**: 2 tasks fechadas com run real do verifier no `evidence`; T-002 com G9 mutation-kill registrado.
- **G2 soft-language**: scaneado `nextAction`+descriptions; 0 violações.
- **G6 reference-or-strike**: F2-G1 met com `evidence`; reviewGate com `at` sha verbatim.
- **Codex review**: RODADO — review `--mode=both` (local→codex gpt-5-codex blind) sobre `669cac6..HEAD` (DESTRUCTIVE=false; both por design-brief L-001 contrato caro de reverter). 11 findings (local 6 + codex 5; 3 cross-confirmados + 2 disjuntos só do codex: F-001 conflito-sem-registro, F-004 write-token-null). Todos corrigidos em `1f24eb3`. File `.atomic-skills/reviews/2026-06-20-0120-plan-fork-f2.md`.
- **Review gate (G2)**: `reviewGate: { status: passed, at: 1f24eb3, mode: both, reviewFile: …2026-06-20-0120-plan-fork-f2.md }`. Prosa e campo concordam.
- **Lessons (G1)**: 5 lessons reusable (L-001..L-005, L-004 recurrenceOf L-001) em `lessons/plan-fork-f2-*.md`, ratificadas. Dispostas no phase-start da F3.

## Session handoff

- **Narrative:** F2 FECHADA via phase-done. 2/2 tasks done; gate F2-G1 `met` (escopado `node --test`, 64/64); review `--mode=both` achou+corrigiu **11 findings** (6 local + 5 codex, 2 disjuntos só do codex: conflito-sem-registro + write-token-null) em `1f24eb3`; reviewGate `passed` (mode both); 5 lessons ratificadas; plano avançou `currentPhase=F3`. Entregue: `src/parallel-state.js` (resolução canônica + CAS por content-hash + lock com stale-recovery + writebackOrDefer) + `tests/parallel-state.test.js` (64 testes) + `links.schema.json` (+pendingWriteback per-op) + spec `docs/design/plan-fork-parallel-state.md`.
- **Decision log:** (1) gate F2-G1 escopado `npm test`→`node --test` (RED ambiental; precedente F0/F1). (2) `--mode=both` por L-001 — o codex pegou 2 gaps arquiteturais que o local mesmo-modelo missou (recorrência registrada na lesson L-004).
- **Single nextAction:** Semear/ativar a F3 — phase-start gate: `node scripts/list-lessons.js --phase F3` e dispor (inclui L-001..L-005 da F2). A F3 implementa o loop de retomada (oferecer retomar o pai na fase-âncora ao concluir/archive do filho, em pause E parallel; aceitar/recusar/sem-TTY/writeback-falho determinísticos).
- **Verbatim state:** worktree `/home/henry/atomic-skills/.worktrees/plan-fork`; branch `plan/plan-fork`. F2 arquivada em `phases/archive/2026-06-plan-fork-f2-*.md`. Review file `.atomic-skills/reviews/2026-06-20-0120-plan-fork-f2.md`; fixes `1f24eb3`.
- **Uncommitted changes:** será commitado no commit de phase-done F2 (gate scoping+met+reviewGate no plan.md, currentPhase=F3, F3 active, propagação F2, lessons file, review file, archive move).
