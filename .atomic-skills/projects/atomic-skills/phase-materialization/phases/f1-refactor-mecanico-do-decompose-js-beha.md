---
schemaVersion: "0.1"
slug: phase-materialization-f1-refactor-mecanico-do-decompose-js-beha
title: Refactor mecânico do decompose.js (behavior-preserving)
goal: "Extrair `decomposeOnePhase(phaseSource, ctx)` e
  `writeInitiativeFile(initiative, planSlug, ctx)` de
  `decomposePlan`/`materializeDecomposition` em `src/decompose.js` como refactor
  estritamente mecânico (R-ORCH-10: heurísticas e formato-fonte congelados).
  Nenhuma mudança de comportamento — o output de `materializeDecomposition`
  sobre qualquer input deve ser byte-idêntico ao atual. Habilita F2 (lazy) e F3
  (verbo `materialize`) sem ainda mudar o que `new plan` produz."
status: active
branch: plan/phase-materialization
started: 2026-06-29T13:19:41.314Z
lastUpdated: 2026-06-30T22:03:01.000Z
nextAction: F1 sem tasks pendentes (T-004 + T-005 done) — rodar `phase-done F1`
  (exit-gates F1-G1 `npm test` + F1-G2 exports + review-code gate) para avançar
  o plano para F2
parentPlan: phase-materialization
phaseId: F1
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 4
weightTotal: 4
exitGates:
  - id: F1-G1
    description: "Refactor é behavior-preserving: golden/snapshot de
      materializeDecomposition inalterado sobre os fixtures canonicos"
    status: pending
    verifier:
      kind: shell
      command: npm test
      expectExitCode: 0
    verifierLabel: "shell: npm test"
  - id: F1-G2
    description: decomposeOnePhase e writeInitiativeFile exportadas e reutilizaveis
      (F2/F3 dependerão delas)
    status: pending
    verifier:
      kind: shell
      command: node -e "import(\"./src/decompose.js\").then(m => { if (typeof
        m.decomposeOnePhase !== \"function\" || typeof m.writeInitiativeFile !==
        \"function\") process.exit(1) })"
      expectExitCode: 0
    verifierLabel: 'shell: node -e "import(\"./src/decompose.js\").then(m => { if (typ…'
stack:
  - id: 1
    title: Refactor mecânico do decompose.js (behavior-preserving)
    type: task
    openedAt: 2026-06-29T13:19:41.314Z
tasks:
  - id: T-004
    title: Extrair `decomposeOnePhase(phaseSource, ctx)` de `decomposePlan`
    description: Extrai de `decomposePlan` (`src/decompose.js:605`, loop de fases
      `:646-698`) uma função `decomposeOnePhase(phaseSource, ctx)` que encapsula
      a extração de tasks (`extractTasks` chamado em `:676`) + goal
      (`extractGoal` em `:675`) + exit gates (`:677-682`) + montagem do objeto
      iniciativa para UMA fase. `decomposePlan` passa a chamar
      `decomposeOnePhase` por fase em vez de inlinar a lógica. A heurística é a
      mesma — só muda a estrutura (a função agora é invocável isoladamente por
      fase, o que F3 precisa).
    status: done
    lastUpdated: 2026-06-30T21:07:51.000Z
    closedAt: 2026-06-30T21:07:51.000Z
    scopeBoundary:
      - corpo de `decomposePlan` (`:605-715`) e a nova função extraída em
        `src/decompose.js`; NÃO alterar regexes/constantes do topo (`:93-120`),
        NÃO alterar `extractTasks`/`extractGoal`/`extractFirstYamlBlock`, NÃO
        mudar o formato-fonte markdown aceito
    acceptance:
      - "`materializeDecomposition(decomposePlan(md), opts)` produz output
        byte-idêntico ao atual sobre todos os fixtures de decompose existentes
        (snapshot/golden); a suíte `tests/decompose.test.js` existente segue
        verde; `decomposeOnePhase` é exportada e invocável isoladamente sobre o
        `bodyLines` de uma fase"
    verifier:
      kind: test
      runner: node --test
      pattern: tests/decompose.test.js
    outputs:
      - kind: file
        path: src/decompose.js
      - kind: file
        path: tests/decompose.test.js
    summary: Extrai decomposeOnePhase(phaseSource,ctx) do loop de decomposePlan, sem
      mudar heurística nem output.
    weight: 2
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-30T21:07:51.000Z
      passed: true
      exitCode: 0
      testsCollected: 78
      outputSummary: node --test tests/decompose.test.js → exit 0; ℹ tests 78 / ℹ pass
        78 / ℹ fail 0 (13 suites). +6 new decomposeOnePhase (F1/T-004)
        direct-invocation tests; all 72 existing decomposePlan /
        materializeDecomposition tests green — byte-identical refactor invariant
        (R-ORCH-10) holds; decomposeOnePhase exported and invocable in isolation
        over a phase's bodyLines (deepEqual vs decomposePlan for same source).
  - id: T-005
    title: Extrair `writeInitiativeFile(initiative, planSlug, ctx)` do loop de
      materialize
    description: Extrai do corpo do loop em `materializeDecomposition`
      (`src/decompose.js:866-946`) uma função `writeInitiativeFile(initiative,
      planSlug, ctx)` que monta o frontmatter da iniciativa (`initFm`
      `:890-919`) + body (`renderInitiativeBody` `:920`) + `relativePath`
      (`:924-927`) + collision guard (`:931-939`) e retorna o
      `{kind:'initiative', slug, relativePath, content}`.
      `materializeDecomposition` passa a chamar `writeInitiativeFile` por fase
      (mantendo o guard de colisão `seenSlugs`/`seenPaths`). Comportamento
      idêntico; a função fica reutilizável por F2 (que a chamará só para F0) e
      F3 (que a chamará no `materialize`).
    status: done
    lastUpdated: 2026-06-30T22:03:01.000Z
    closedAt: 2026-06-30T22:03:01.000Z
    scopeBoundary:
      - o loop `for` em `materializeDecomposition` (`:866-946`) e a nova função
        extraída; NÃO alterar `renderInitiativeBody`, o cálculo de
        `phaseFileName` (`:924`), nem a construção de `phases[]` (`:796-822`)
    acceptance:
      - output de `materializeDecomposition` byte-idêntico ao atual sobre todos
        os fixtures (snapshot); suíte `tests/decompose.test.js` verde;
        `writeInitiativeFile` exportada e produz o mesmo `{relativePath,
        content}` que o loop inlinado produzia
    verifier:
      kind: test
      runner: node --test
      pattern: tests/decompose.test.js
    outputs:
      - kind: file
        path: src/decompose.js
      - kind: file
        path: tests/decompose.test.js
    summary: Extrai writeInitiativeFile do loop de materializeDecomposition,
      mantendo guard de colisão e output idêntico.
    weight: 2
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-30T22:03:01.000Z
      passed: true
      exitCode: 0
      testsCollected: 82
      outputSummary: node --test tests/decompose.test.js → exit 0; ℹ tests 82 / ℹ pass
        82 / ℹ fail 0 (14 suites). +4 new writeInitiativeFile (F1/T-005)
        direct-invocation tests incl. deepEqual vs materializeDecomposition for
        the same phase (R-ORCH-10 byte-identical {slug,relativePath,content});
        ctx.active true/false flips status; collision guard mutates shared
        seenSlugs/seenPaths. All existing flat+nested materialize tests green.
parked: []
emerged: []
summary: Extrai decomposeOnePhase e writeInitiativeFile do decompose.js num
  refactor mecânico que preserva o output byte a byte (R-ORCH-10).
planTitle: Materialização lazy de fases + gate de validação de negócio
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Refactor mecânico do decompose.js (behavior-preserving)**.

## Decisions

- **Assinatura `decomposeOnePhase(phaseSource, ctx)`** — `phaseSource = { phaseId, title, bodyLines }`, `ctx = { planSlug, warnings }`; retorna o objeto iniciativa. Os invariantes cross-phase (rejeição de `phaseId` duplicado + bookkeeping de `phaseIds`) ficaram no loop de `decomposePlan` (precisam do conjunto completo de fases — não são concerns de uma fase). O `title` é passado cru (`phaseMatch[2] || ''`) e normalizado dentro da função (`(title||'').trim() || phaseId`).
- **Assinatura `writeInitiativeFile(initiative, planSlug, ctx)`** — `ctx = { iso, branch, active, stateRoot, planDir, projectId, seenSlugs, seenPaths }`. `active` (boolean) substitui o inline `idx === 0` para que o `materialize` de F3 (fase única) passe `active: true`. Os Sets mutáveis `seenSlugs`/`seenPaths` são passados por referência e mutados in-place (guard de colisão byte-idêntico).
- **Mensagem de erro do collision guard deixada verbatim** (`materializeDecomposition: slug collision …`) dentro de `writeInitiativeFile` — byte-identity R-ORCH-10; o teste existente assevera `/slug collision/` de qualquer forma. F3 pode refinar o prefixo quando adotar a função.

## Links

_(plan doc: `plan.md` no mesmo dir; design `design.md`; research `research-plan-quality.md`)_

## Session handoff
- **Narrative:** F1 (refactor mecânico de `src/decompose.js`) implementado: T-004 (`decomposeOnePhase`) e T-005 (`writeInitiativeFile`) ambos `done` com evidence `passed:true` (verifier `node --test tests/decompose.test.js` → 78 depois 82 tests, verde). Refactor estritamente mecânico (R-ORCH-10) — output de `materializeDecomposition` byte-idêntico, provado por todos os testes flat+nested existentes + novos testes `deepEqual` vs `decomposePlan`/`materializeDecomposition`. Dois commits: `refactor(decompose): extract decomposeOnePhase (F1/T-004)` e `… writeInitiativeFile (F1/T-005)`. F1 está no boundary de fase: tasksDone 2/2, exit-gates ainda pending.
- **Decision log:** ver `## Decisions` acima (3 decisões load-bearing: assinaturas das 2 funções + mensagem de erro verbatim).
- **Single nextAction:** Rodar `phase-done F1` — executa os exit-gates F1-G1 (`npm test`, expect exit 0) e F1-G2 (check de exports), depois o gate obrigatório `review-code` no diff da fase, e avança `currentPhase` para F2.
- **Verbatim state:**
  - Árvore: clean após o checkpoint do handoff. Branch `plan/phase-materialization`; WT `.worktrees/phase-materialization`.
  - F1 initiative: `.atomic-skills/projects/atomic-skills/phase-materialization/phases/f1-refactor-mecanico-do-decompose-js-beha.md` (tasksDone 2/2; gatesMet 0/2 pending).
  - Exit-gate verifiers: F1-G1 = `npm test` (expectExitCode 0); F1-G2 = `node -e "import(\"./src/decompose.js\").then(m => { if (typeof m.decomposeOnePhase !== \"function\" || typeof m.writeInitiativeFile !== \"function\") process.exit(1) })"`.
  - Scripts pelo repo-root direto (NÃO `$HOME/.atomic-skills/package-root` — stale): `node scripts/validate-state.js`, `node scripts/refresh-state.js`, `node scripts/append-completion.js`.
- **Uncommitted changes:** clean tree (T-004, T-005 e este handoff committed).

