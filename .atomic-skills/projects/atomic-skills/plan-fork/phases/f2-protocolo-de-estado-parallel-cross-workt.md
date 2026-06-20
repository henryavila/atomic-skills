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
nextAction: "Phase-start gate F2: rodar `node scripts/list-lessons.js --phase F2`
  e dispor cada lesson reusable+open (Apply/Keep/Stale/Reject) — inclui L-001..L-005
  da F1 — ANTES de codar. Depois T-001: especificar o protocolo de estado parallel
  (concorrência otimista)."
parentPlan: plan-fork
phaseId: F2
tasksDone: 0
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
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
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
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
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

- **Narrative:** F2 ativada pelo phase-done da F1. **Phase-start lessons gate FEITO** (18 lessons dispostas — ver § Decisions; 8 APPLY, 10 KEEP, nenhuma Stale/Reject). T-001 (spec do protocolo parallel) começando. F2 implementa o protocolo de estado cross-worktree do modo `parallel` que a F1 rejeitou explicitamente.
- **Decision log:** (1) disposição das lessons registrada em § Decisions. (2) Flag T-002: o teste vai em `tests/parallel-state.test.js` (não `src/`, que `npm test` ignora — L-003). (3) F2-G1 = `npm test` (baseline RED ambiental — mesma decisão de escopo da F0/F1 vai recair no phase-done).
- **Single nextAction:** T-001 — fundamentar e escrever `docs/design/plan-fork-parallel-state.md`: definir worktree canônico do estado do pai, leitura por revisão/hash, escrita atômica com token, predicado de conflito exato, abort, recuperação, e verificação a partir das duas worktrees. Verifier: `test -f docs/design/plan-fork-parallel-state.md`. Como é contrato one-way-door (design-brief L-001), surfacear as decisões load-bearing ao usuário antes de finalizar.
- **Verbatim state:** worktree `/home/henry/atomic-skills/.worktrees/plan-fork`; branch `plan/plan-fork`; tree limpo após phase-done F1 (`669cac6`).
- **Uncommitted changes:** este handoff + a disposição das lessons (estado da F2), a commitar.
