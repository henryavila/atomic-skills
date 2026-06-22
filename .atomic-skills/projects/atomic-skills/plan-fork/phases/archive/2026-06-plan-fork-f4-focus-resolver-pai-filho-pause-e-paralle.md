---
schemaVersion: "0.1"
slug: plan-fork-f4-focus-resolver-pai-filho-pause-e-paralle
title: Focus-resolver pai/filho (pause e parallel)
goal: Fazer o resolver de foco tratar pai(paused)+filho(active) e
  pai(active)+filho(active) parallel como hierarquia, com precedência por
  worktree e aresta pai/filho.
status: done
branch: plan/plan-fork
started: 2026-06-20T09:51:26Z
lastUpdated: 2026-06-21T00:40:11Z
nextAction: null
parentPlan: plan-fork
phaseId: F4
tasksDone: 2
tasksTotal: 2
gatesMet: 1
gatesTotal: 1
exitGates:
  - id: F4-G1
    description: Os casos pause(paused+active) e parallel(active+active) resolvem
      para o filho sem ambiguidade; os casos de foco existentes não regridem.
    status: met
    metAt: 2026-06-21T00:40:11Z
    verifier:
      kind: shell
      command: npm test
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-21T00:40:11Z
      exitCode: 0
      passed: true
      outputSummary: "node --test tests/focus-digest.test.js
        tests/reconcile-focus.test.js (npm test escopado, baseline RED
        ambiental) → 26 pass, exit 0, HEAD 9b96ab2. Review --mode=both: local 6
        + codex blind 5→final 6, todos corrigidos."
    verifierLabel: "shell: npm test"
    evidenceSummary: passed · 2026-06-21
stack:
  - id: 1
    title: Focus-resolver pai/filho (pause e parallel)
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: Consciência pai/filho no emit-focus e reconcile-focus
    status: done
    lastUpdated: 2026-06-20T10:18:26Z
    closedAt: 2026-06-20T10:18:26Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-20T10:18:26Z
      exitCode: 0
      passed: true
      outputSummary: "Verifier npm test escopado p/ `node --test
        tests/focus-digest.test.js tests/reconcile-focus.test.js` (baseline RED
        ambiental — install/dashboard, sem relação): tests 18, pass 18, fail 0,
        exit 0. Full npm test: 10 fails, TODOS no baseline ambiental conhecido,
        0 novos (956 pass). emit-focus pickFocus colapsa par fork pai+filho →
        foco no FILHO + multipleActivePlans=false (supersededParentSlugs lê
        spawnedFrom do sidecar via getSpawnedFrom). reconcile-focus defere o
        marcador `current` da fase-âncora do pai pro filho ativo (pre-scan
        collectForkDeferrals → deferredAnchors). branch-match/recência
        inalterados (scopeBoundary)."
    scopeBoundary:
      - apenas a regra de hierarquia pai/filho lida do sidecar; não alterar
        branch-match nem recência existentes.
    acceptance:
      - no caso pause (pai paused + filho active) e no caso parallel (pai active
        + filho active) o resolver escolhe o filho sem marcar ambiguidade
        multi-active; sem par forkado o comportamento fica inalterado.
    verifier:
      kind: shell
      command: npm test
    outputs:
      - kind: file
        path: scripts/emit-focus.js
      - kind: file
        path: scripts/reconcile-focus.js
    summary: Hierarquia pai/filho no emit/reconcile-focus (pause e parallel).
  - id: T-002
    title: Testes do resolver nos dois casos
    status: done
    lastUpdated: 2026-06-20T10:18:26Z
    closedAt: 2026-06-20T10:18:26Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-20T10:18:26Z
      exitCode: 0
      passed: true
      outputSummary: "TDD red→green confirmado: os 2 testes-chave (parallel fork
        resolve no filho; reconcile defere o current do pai) FALHARAM antes da
        T-001 e passam depois. Testes estendem `tests/focus-digest.test.js`
        (emit: parallel-fork→child, pause-fork→child, no-fork→ainda ambíguo) e
        `tests/reconcile-focus.test.js` (defere current do pai; não defere
        quando filho inativo) — NÃO o `tests/emit-focus.test.js` do spec
        (naming-miss; emit já testado em focus-digest.test.js — design-brief/F0
        L-003). Cada teste nomeia a mutação que mata. Verifier npm test
        escopado: 18 pass, exit 0; full suite sem novos fails."
    scopeBoundary:
      - apenas casos de teste; a lógica de produção é a T-001.
    acceptance:
      - teste vermelho antes da T-001 e verde depois, cobrindo emit-focus E
        reconcile-focus em pause(paused+active) e parallel(active+active), e
        confirmando que os casos de foco existentes não regridem.
    outputs:
      - kind: file
        path: tests/emit-focus.test.js
      - kind: file
        path: tests/reconcile-focus.test.js
    summary: "Testes do resolver (emit + reconcile): pause e parallel resolvem para
      o filho."
    verifier:
      kind: shell
      command: npm test
parked: []
emerged: []
summary: Resolver de foco trata pai/filho como hierarquia em pause e parallel.
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F4 — Focus-resolver pai/filho (pause e parallel)**.

## Self-review against code-quality gates

- **G1 read-before-claim**: 2 tasks fechadas, `outputs[]` ligados às linhas-fonte (emit-focus.js, reconcile-focus.js, 2 test files); cada fix de review leu as linhas antes do Edit; o NUL byte foi localizado por offset antes de corrigir.
- **G2 soft-language**: nextAction + descrições escaneadas; 0 violações (evidência `passed:true`).
- **G6 reference-or-strike**: F4-G1 met com `evidence:` populada; literais verbatim (HEAD 9b96ab2, verifier escopado, contagens).
- **Codex review**: review-code `--mode=both` em HEAD 9b96ab2, verdict needs_changes→resolvido, blind 0B/0C/5M → final 0B/0C/5M/1m (ciclo rebaixado), framing Δ {dropped:0, maintained:5, emerged:1}, file `.atomic-skills/reviews/2026-06-21-0024-plan-fork-f4.md`.
- **Review gate (G2)**: gravado no descriptor como `reviewGate: { status: passed, at: 9b96ab2, mode: both }` (GATE-R3; prosa e campo concordam).
- **Lessons (G1)**: 3 reusable distiladas em `lessons/plan-fork-f4-focus-resolver-pai-filho-pause-e-paralle.md` (NUL/run-tests, cross-product coverage, projId-scope), ratificadas. F5 start gate as dispõe.

## Decisions

### Phase-start lessons gate (F4) — disposição de 26 lessons aplicáveis
**Apply (load-bearing p/ F4 — fase de CÓDIGO real, resolver de foco):**
- design-brief/F0 L-003 — testes têm que ser descobertos pelo `npm test` (glob `tests/**`/`test/**`). **Decisão de escopo:** estender os testes EXISTENTES `tests/focus-digest.test.js` (emit) e `tests/reconcile-focus.test.js` (reconcile); NÃO criar `tests/emit-focus.test.js` (path do spec de T-002 é um naming-miss — os testes do emit já vivem em focus-digest.test.js). Glob pega ambos; evita duplicata/confusão.
- plan-fork/F0 L-001 — reusar `getSpawnedFrom` (que usa o readLinks já endurecido: try/catch + rejeição não-objeto) p/ ler o elo; não escrever novo parser de sidecar.
- plan-fork/F1 L-003 — a regra nova seleciona o filho pela aresta NOMEADA (`spawnedFrom.plan == pai.slug`), não por status/recência adivinhada; não alterar branch-match nem recência (scopeBoundary).
- plan-fork/F3 L-002 + F2 L-005 — TDD: teste VERMELHO antes da T-001, verde depois; nomear a mutação que cada teste mata (sem tautologia). Testar via `buildFocusDigest`/`reconcileDir` em tree temp real (não asserir a própria escrita).
- plan-fork/F3 L-001 + F1 L-001 — a precedência pai/filho é regra EXPLÍCITA no código, não invariante implícito.

**Keep (julgar no phase-done):** design-brief/F0 L-001 + plan-fork/F2 L-004 — `--mode=both` p/ contrato porta-de-mão-única. F4 é lógica de resolver (recuperável/idempotente via reconcile), NÃO um contrato de concorrência/schema; decidir o modo pelo sinal DESTRUCTIVE no phase-done (provável local), mas a regra de foco é load-bearing — inclinar p/ both se incerto.

**Stale p/ F4:** todas as lessons de procedure fork-plan (F1), schema-enum (design-brief F0 L-002/L-004), spawn-graph (plan-fork F0 L-002), installer round-trip (skills F6), extração de asset (skills F2/F3), lock/CAS (plan-fork F2 L-001/L-002/L-003/L-005 — não toco parallel-state).

### Decisão de design — hierarquia em AMBOS os resolvers (reconcile under-specified no task)
- **emit-focus `pickFocus`:** quando os claimers (plans que disputam a tree) contêm um par fork pai+filho (filho.spawnedFrom.plan == pai.slug, ambos presentes), o pai é "superseded" → foco resolve pro FILHO e `multipleActivePlans=false` (hierarquia, não a drift multi-active que o ⧉ marca). Pause já resolvia (pai paused fora de activePlans); o fix morde o caso parallel sem branch-disambiguation / mesma tree.
- **reconcile-focus:** o marcador `current` do pai na fase-âncora é DEFERIDO pro filho ativo (parallel). reconcileDir monta um mapa parentSlug→Set(anchorPhaseId) dos filhos ATIVOS forkados, e reconcileInitiativeFile não marca `current` numa fase-âncora deferida. Mantém emit (AGORA único) e reconcile (marcador por-fase) consistentes. Plans não-forkados ficam inalterados.

## Links

_(plan doc, external refs)_
