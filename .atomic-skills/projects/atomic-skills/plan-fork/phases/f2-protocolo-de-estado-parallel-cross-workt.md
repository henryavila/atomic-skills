---
schemaVersion: "0.1"
slug: plan-fork-f2-protocolo-de-estado-parallel-cross-workt
title: Protocolo de estado parallel cross-worktree
goal: "Definir e implementar o protocolo de estado do modo parallel com
  semântica de concorrência explícita: caminho canônico, escrita atômica com
  token de revisão, predicado de conflito, abort e recuperação, e verificação a
  partir do pai e do filho."
status: active
branch: plan/plan-fork
started: 2026-06-19T19:56:59Z
lastUpdated: 2026-06-19T19:56:59Z
nextAction: "Phase-start gate F2: rodar `node scripts/list-lessons.js --phase
  F2` e dispor cada lesson reusable+open (Apply/Keep/Stale/Reject) — inclui
  L-001..L-005 da F1 — ANTES de codar. Depois T-001: especificar o protocolo de
  estado parallel (concorrência otimista)."
parentPlan: plan-fork
phaseId: F2
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F2-G1
    description: "O protocolo de concorrência otimista está definido e testado: a
      escrita atinge o estado canônico do pai e edições concorrentes pai/filho
      são detectadas e abortadas sem lost update."
    status: pending
    verifier:
      kind: shell
      command: npm test
    verifierLabel: "shell: npm test"
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
current: true
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

## Session handoff

- **Narrative:** F2 com as 2/2 tasks FECHADAS. T-001 (spec `docs/design/plan-fork-parallel-state.md`). **T-002 FECHADA**: `src/parallel-state.js` (contentToken sha256, parseWorktrees, findWorktreeByBranch, resolveCanonicalParentDir, atomicWriteback com lock O_EXCL+temp+rename+CAS, record/clearPendingWriteback) + `tests/parallel-state.test.js` (14 testes, inclui o cenário de concorrência sem lost update e o teste negativo do schema) + `links.schema.json` estendido com `pendingWriteback` (enum em target/op). `node --test`: 14/14; suite relacionada 54/54 sem regressão; G9 mutation-kill no predicado de conflito (2 testes RED → revert → GREEN). A fase está `active` aguardando `phase-done`.
- **Decision log:** (1) 3 decisões do protocolo ratificadas (§ spec). (2) Teste em `tests/` (L-003). (3) `pendingWriteback` no sidecar com enum em target/op + teste negativo (L-002 aplicada). (4) F2-G1 = `npm test` (baseline RED ambiental — mesma decisão de escopo da F0/F1 recai no phase-done). (5) design-brief L-001 (contrato caro de reverter): considerar review `--mode=both` no phase-done desta fase.
- **Single nextAction:** Rodar `phase-done` para F2 — escopar F2-G1 (remover `npm test`→`node --test tests/parallel-state.test.js` ou deixar o usuário decidir), rodar o review gate (considerar `--mode=both` por L-001), distilar lessons, avançar para F3.
- **Verbatim state:** worktree `/home/henry/atomic-skills/.worktrees/plan-fork`; branch `plan/plan-fork`. Módulo `src/parallel-state.js`; teste `tests/parallel-state.test.js`; schema `meta/schemas/links.schema.json` (+pendingWriteback); spec `docs/design/plan-fork-parallel-state.md`.
- **Uncommitted changes:** T-002 (módulo + teste + schema + estado da fase) a commitar.
