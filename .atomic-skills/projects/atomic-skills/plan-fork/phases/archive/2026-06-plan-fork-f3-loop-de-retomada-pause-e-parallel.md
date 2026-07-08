---
schemaVersion: "0.1"
slug: plan-fork-f3-loop-de-retomada-pause-e-parallel
title: Loop de retomada (pause e parallel)
goal: Na conclusão/archive do filho, oferecer retomar o pai na fase-âncora em
  ambos os modos, com semântica determinística para aceitar, recusar, sem TTY e
  writeback falho.
status: done
branch: plan/plan-fork
started: 2026-06-20T01:33:14Z
lastUpdated: 2026-06-20T09:51:26Z
nextAction: null
parentPlan: plan-fork
phaseId: F3
tasksDone: 2
tasksTotal: 2
gatesMet: 1
gatesTotal: 1
weightDone: 2
weightTotal: 2
exitGates:
  - id: F3-G1
    description: Aceitar, recusar, sem-TTY e writeback-falho têm semântica
      determinística em pause E parallel; nenhum caso deixa o filho arquivado
      com o pai num estado inconsistente. Ordem de transação — o writeback do
      pai precede a finalização do archive; em writeback falho o archive
      persiste um pending-resume durável e o filho não finaliza até a
      recuperação.
    status: met
    metAt: 2026-06-20T09:51:26Z
    verifier:
      kind: shell
      command: npm test
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-20T09:51:26Z
      exitCode: 0
      passed: true
      outputSummary: "node --test tests/parallel-state.test.js
        tests/links-sidecar.test.js tests/spawn-graph.test.js (npm test
        escopado, baseline RED ambiental) → tests 75, pass 75, fail 0, exit 0,
        tree limpa HEAD b6969e5. Review --mode=both: blind 4 major → final 3
        major, todos corrigidos."
    verifierLabel: "shell: npm test"
    evidenceSummary: passed · 2026-06-20
stack:
  - id: 1
    title: Loop de retomada (pause e parallel)
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: Detecção de spawnedFrom no archive-propagation
    status: done
    lastUpdated: 2026-06-20T09:21:32Z
    closedAt: 2026-06-20T09:21:32Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-20T09:21:32Z
      exitCode: 0
      passed: true
      outputSummary: "grep -q spawnedFrom
        skills/shared/project-assets/project-transitions.md → exit 0. Adicionado
        o step 2 `archive` (Fork-link resume offer): lê o elo via
        getSpawnedFrom(<target-plan-dir>) ANTES de qualquer finalize, oferta
        opt-in nunca automática, skip silencioso quando null; steps
        Plan/Initiative archival renumerados 2→3/3→4, PROJECT-STATUS/Announce
        4→5/5→6. Headings conferidos via grep '^#' (archive + switch intactos,
        sem orfanização — lesson F1 L-004). Verifier grep é token-presence
        fraco; correção procedural carregada pelo review gate --mode=both no
        phase-done (lessons F1 L-004/L-005)."
    scopeBoundary:
      - estender o passo de archive; não mexer no fluxo de pausa (o switch já
        cobre).
    acceptance:
      - o passo de archive lê o elo do sidecar do filho e imprime a oferta de
        retomada do pai na âncora; opt-in, nunca automática.
    verifier:
      kind: shell
      command: grep -q spawnedFrom skills/shared/project-assets/project-transitions.md
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
    summary: Lê o elo no archive e oferece retomar o pai.
  - id: T-002
    title: Retomada determinística nos dois modos e nos casos de borda
    status: done
    lastUpdated: 2026-06-20T09:27:34Z
    closedAt: 2026-06-20T09:27:34Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-20T09:27:34Z
      exitCode: 0
      passed: true
      outputSummary: "Verifier `npm test` escopado para `node --test
        tests/parallel-state.test.js tests/links-sidecar.test.js
        tests/spawn-graph.test.js` (baseline npm test RED ambiental —
        countSkills/installSkills/serve constants, sem relação com a F3;
        precedente F0/F1/F2): tests 72, pass 72, fail 0, exit 0. Adicionado o
        step `fork-resume` em project-transitions.md (aplicação determinística
        accept/refuse/no-TTY/writeback-falho × pause/parallel; invariante de
        transação writeback-precede-finalize; marker durável op:resumeParent) +
        8 testes (4 casos × 2 modos) em tests/parallel-state.test.js cobrindo o
        anchor NOMEADO (F1 L-003), o defer durável em conflito (F2 L-001) e
        parent-untouched no refuse/no-TTY. Testes em tests/ (não src/ do spec —
        glob-miss, design-brief/F0 L-003)."
    scopeBoundary:
      - a aplicação da retomada; em parallel reusa o writeback da F2; em pause
        reusa refresh-state.
    acceptance:
      - aceitar retoma o pai (status active, fase-âncora active, currentPhase
        igual ao id da âncora); recusar deixa um pending-resume durável; sem TTY
        registra o pending-resume sem prompt; writeback falho em parallel aborta
        com sinal de recuperação e não arquiva o filho silenciosamente; testes
        cobrem os quatro casos em pause e parallel.
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: src/parallel-state.test.js
    summary: "Retomada determinística: aceitar/recusar/sem-TTY/writeback falho, nos
      dois modos."
    verifier:
      kind: shell
      command: npm test
parked: []
emerged: []
summary: Retomada determinística do pai (aceitar/recusar/sem-TTY/writeback falho).
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F3 — Loop de retomada (pause e parallel)**.

## Self-review against code-quality gates

- **G1 read-before-claim**: 2 tasks closed, cada uma com `outputs[]` ligado às linhas-fonte (project-transitions.md, tests/parallel-state.test.js); cada fix de review leu as linhas antes do Edit.
- **G2 soft-language**: escaneado nextAction + descrições de task/criério + handoff; 0 violações (claims são `passed:true` evidence).
- **G6 reference-or-strike**: F3-G1 met com `evidence:` populada; literais do handoff são paths/comandos/shas verbatim (HEAD b6969e5, verifier escopado).
- **Codex review**: rodou via review-code `--mode=both` em HEAD b6969e5, verdict needs_changes→resolvido, blind 0B/0C/4M → final 0B/0C/3M (1 dropped), framing Δ {dropped:1, maintained:3, emerged:0}, file `.atomic-skills/reviews/2026-06-20-0942-plan-fork-f3.md`.
- **Review gate (G2)**: gravado no descriptor do plano como `reviewGate: { status: passed, at: b6969e5…, mode: both }`. Prosa e campo concordam (GATE-R3).
- **Lessons (G1)**: 3 lessons reusable distiladas em `lessons/plan-fork-f3-loop-de-retomada-pause-e-parallel.md` (hard-gate cross-model, doc-contract tests, marker-before-mutation), ratificadas pelo usuário. O phase-start da F4 as dispõe via `list-lessons --phase F4`.

## Decisions

### Phase-start lessons gate (F3) — disposição de 23 lessons aplicáveis

**Apply (load-bearing para F3):**
- plan-fork/F2 L-001 (writebackOrDefer) — o detector de conflito grava o pending-resume durável ELE MESMO antes de retornar. F3-G1 exige "writeback falho persiste pending-resume durável"; T-002 reusa esse caminho em parallel.
- plan-fork/F2 L-002 (canonical-absent abort) — writeback de retomada ao pai aborta se o canônico do pai sumiu (allowCreate=false), não cria estado no lugar errado.
- plan-fork/F2 L-005 + design-brief/F0 L-003 — teste rotulado "concurrency"/writeback-falho deve EXERCER a falha de verdade (não rodar sequencial e passar com a mutação removida); nomear a mutação que cada teste mata.
- plan-fork/F1 L-001 — toda guarda que protege mutação (oferta de retomada / pending-resume em writeback falho) é um STEP NUMERADO no ponto de aplicação, nunca forward-ref pra prosa.
- plan-fork/F1 L-002 — ordem de transação: writeback do pai PRECEDE finalize do archive; em falha persiste pending-resume e NÃO finaliza o filho (= F3-G1 verbatim).
- plan-fork/F1 L-003 — retomar o pai na fase-âncora NOMEADA (currentPhase := id da âncora, âncora active), não a fase active-por-status.
- plan-fork/F1 L-005 + design-brief/F0 L-001 + plan-fork/F2 L-004 — fase editorial (T-001 verifier = grep fraco) + contrato porta-de-mão-única (semântica de transação cara de reverter) ⇒ review-code --mode=both no phase-done mesmo com DESTRUCTIVE=false.
- skills-restructuring/F4 L-001 — "sem TTY registra pending-resume sem prompt": TODO prompt interativo da oferta de retomada precisa de guarda não-interativa, não só o primeiro.
- design-brief/F0 L-003 (CRÍTICO p/ T-002) — `npm test` globa `tests/**` e `test/**`, NÃO `src/`. **Decisão:** os testes da F3 estendem `tests/parallel-state.test.js`; o output `src/parallel-state.test.js` listado no spec de T-002 é um glob-miss e seria invisível ao verifier `npm test`.

**Keep (reuso/disciplina, aplicar quando tocar o locus):**
- plan-fork/F0 L-001 — readLinks já tem try/catch+rejeição de não-objeto; T-001 reusa o reader.
- plan-fork/F1 L-004 — Edit cujo old_string é heading-âncora: re-anexar no new_string; `grep -n '^#'` após mover seção em project-transitions.md.
- skills-restructuring/F3 L-001 — ao mover bloco pra asset standalone, reescrever refs relativas (above/below/this skill).
- skills-restructuring/F3 L-002 — DESTRUCTIVE falso-positivo de tokens de doc realocados; checar os 3 fatos antes de pagar cross-model.
- skills-restructuring/F0 L-001 — doc que descreve seu próprio procedimento de manutenção: executar todos os passos.

**Stale para F3 (não tocadas):** plan-fork/F0 L-002 (spawn-graph), design-brief/F0 L-002 (schemaVersion enum) + L-004 (uniqueidade sub-campo), skills-restructuring/F1 L-F1-1 (SPEC gate/materializer), F2 L-001 (placeholders), F6 L-F6-1 (installer round-trip).

### Roteamento Mode 1 vs Mode 2 (routing.json tem codexLane.enabled=true)
- **Mode 1 (Opus single-threaded) para T-001 e T-002.** Razão (R-EXEC-30, registrado nunca silencioso): (a) ambas editam o MESMO arquivo `skills/shared/project-assets/project-transitions.md` e T-002 depende de T-001 — não há disjunção pra paralelizar; (b) o verifier de T-001 é `grep -q spawnedFrom` (token-presence fraco) que NÃO carrega qualidade — gate F2 do Mode 2 fica vazio (lessons F1 L-004/L-005: grep passou sobre edits estruturalmente quebrados). Fase editorial+semântica: qualidade no review gate `--mode=both` no phase-done, não no verifier.

### Decisão de escopo T-002 (corrige glob-miss do spec)
- Testes da F3 vão em `tests/parallel-state.test.js` (estende o existente, 15.5K), não `src/parallel-state.test.js`. Justificativa: verifier de T-002 é `npm test` (glob `tests/**`+`test/**`); um teste em `src/` passaria o verifier explícito mas não gatearia no `npm test` (exatamente o gap da lesson design-brief/F0 L-003).

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F3 (Loop de retomada) no PHASE BOUNDARY — T-001 e T-002 FECHADOS (2/2), ambos com evidência passing. T-001 adicionou o step 2 "Fork-link resume offer" em `archive` (lê o elo, oferta opt-in). T-002 adicionou o step `fork-resume` (aplicação determinística accept/refuse/no-TTY/writeback-falho × pause/parallel) + 8 testes em `tests/parallel-state.test.js`. Falta só rodar `phase-done` (intrusivo, opt-in).
- **Decision log:** (1) Mode 1 (Opus single-threaded) p/ T-001 e T-002 — mesmo arquivo, dependência, verifier grep fraco. (2) Testes em `tests/parallel-state.test.js` (NÃO `src/` do spec — glob-miss, design-brief/F0 L-003). (3) Transação F3-G1: writeback do pai PRECEDE finalize do archive; em falha persiste pendingWriteback durável (op:resumeParent) e NÃO finaliza o filho (F1 L-002, F2 L-001). (4) Retomar o pai na fase-âncora NOMEADA (currentPhase := phaseId do elo), não a active-por-status (F1 L-003). (5) phase-done DEVE rodar review-code `--mode=both` (contrato porta-de-mão-única + verifier fraco — F1 L-005, F2 L-004).
- **Single nextAction:** Rodar `phase-done` (após opt-in do usuário): roda exit-gate verifiers (F3-G1 verifier=`npm test`, escopar p/ `node --test tests/parallel-state.test.js tests/links-sidecar.test.js tests/spawn-graph.test.js` — baseline RED ambiental, precedente F0/F1/F2), o review-code `--mode=both` sobre o diff da fase, e avança o plano pra F4.
- **Verbatim state:** T-001 verifier `grep -q spawnedFrom skills/shared/project-assets/project-transitions.md` → exit 0. T-002 verifier escopado `node --test tests/parallel-state.test.js tests/links-sidecar.test.js tests/spawn-graph.test.js` → tests 72, pass 72, fail 0, exit 0. Baseline `npm test` RED ambiental: countSkills/installSkills/serve constants (sem relação com a F3). validate-state F3 → `✓ All 1 file(s) valid`.
- **Uncommitted changes:** a ser commitado como `feat(plan-fork): F3/T-002` (fork-resume em project-transitions.md + 8 testes + estado F3). Após o commit: clean tree.
