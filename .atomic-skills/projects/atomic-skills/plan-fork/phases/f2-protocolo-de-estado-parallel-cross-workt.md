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
tasksDone: 1
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

- **Narrative:** F2 — 1/2 tasks. Phase-start lessons gate FEITO (ver § Decisions). **T-001 FECHADA**: spec `docs/design/plan-fork-parallel-state.md` escrita com as 3 decisões one-way-door ratificadas (canônico = worktree do pai via `git worktree list`+branch; token = sha256 content-hash CAS; conflito = abort + `pendingWriteback` declarativo durável no sidecar do filho). Ponteiro adicionado no bullet parallel de `project-emergence.md`. Falta T-002 (implementar `src/parallel-state.js` + teste).
- **Decision log:** (1) 3 decisões do protocolo ratificadas pelo usuário (§ spec). (2) Flag T-002: o teste vai em `tests/parallel-state.test.js` (NÃO `src/parallel-state.test.js` do outputs declarado — `npm test` faz glob de `tests/*.test.js`; L-003). (3) `pendingWriteback` vai só no sidecar (`links.schema.json`), nunca no `plan.md` `.strict` (aiDeck 0.1.0); se entrar no schema, enum nos campos + teste negativo (L-002). (4) F2-G1 = `npm test` (baseline RED ambiental — mesma decisão de escopo da F0/F1 vai recair no phase-done).
- **Single nextAction:** T-002 — implementar `src/parallel-state.js` (resolução canônica via `git worktree list --porcelain` + `branch:` do pai; read-by-hash; writeback atômico lock O_EXCL+temp+rename com CAS sha256; conflito → `pendingWriteback` no sidecar do filho) + `tests/parallel-state.test.js` (simula 2 escritas concorrentes com mesmo token0 → 1ª passa, 2ª vira pendingWriteback, sem lost update). Verifier: `npm test` (escopar/rodar `node --test tests/parallel-state.test.js` se baseline RED). Seguir a spec `docs/design/plan-fork-parallel-state.md`.
- **Verbatim state:** worktree `/home/henry/atomic-skills/.worktrees/plan-fork`; branch `plan/plan-fork`. T-001 commitada a seguir. Spec em `docs/design/plan-fork-parallel-state.md`.
- **Uncommitted changes:** T-001 (spec + ponteiro em project-emergence.md + estado da fase) a commitar.
