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
lastUpdated: 2026-06-30T22:49:23.000Z
nextAction: "F1-G1 + F1-G2 agora `met` (evidence shell exit 0: npm test 1479
  verde + exports guard). Restante do phase-done: (6) review gate review-code
  --mode=local sobre 3fffdb9..HEAD + registrar reviewGate no plan.md (GATE-R3) +
  destilar lessons; (7/8) advance currentPhase F1→F2 (propagar conclusão,
  arquivar F1, semear iniciativa F2)."
parentPlan: phase-materialization
phaseId: F1
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
weightDone: 4
weightTotal: 4
exitGates:
  - id: F1-G1
    description: "Refactor é behavior-preserving: golden/snapshot de
      materializeDecomposition inalterado sobre os fixtures canonicos"
    status: met
    metAt: 2026-06-30T22:49:23.000Z
    verifier:
      kind: shell
      command: npm test
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-30T22:49:23.000Z
      passed: true
      exitCode: 0
      outputSummary: "npm test → exit 0; ℹ tests 1479 / ℹ pass 1471 / ℹ fail 0 / ℹ
        skipped 8 (177 suites). Byte-identidade R-ORCH-10 do refactor de
        decompose.js confirmada (tests/decompose.test.js 82/82 verde:
        flat+nested + novos deepEqual vs
        decomposePlan/materializeDecomposition); as 6 falhas pré-existentes de
        install/refresh-state corrigidas em 9b5e645."
    verifierLabel: "shell: npm test"
    evidenceSummary: passed · 2026-06-30
  - id: F1-G2
    description: decomposeOnePhase e writeInitiativeFile exportadas e reutilizaveis
      (F2/F3 dependerão delas)
    status: met
    metAt: 2026-06-30T22:49:23.000Z
    verifier:
      kind: shell
      command: node -e "import(\"./src/decompose.js\").then(m => { if (typeof
        m.decomposeOnePhase !== \"function\" || typeof m.writeInitiativeFile !==
        \"function\") process.exit(1) })"
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-30T22:49:23.000Z
      passed: true
      exitCode: 0
      outputSummary: node -e exports guard → exit 0; o guard process.exit(1) NÃO
        disparou, confirmando que decomposeOnePhase e writeInitiativeFile são
        ambas funções exportadas de src/decompose.js (reutilizáveis por F2/F3).
    verifierLabel: 'shell: node -e "import(\"./src/decompose.js\").then(m => { if (typ…'
    evidenceSummary: passed · 2026-06-30
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
- **Decisão F1-G1 (gate-contract, escolha do usuário via AskUserQuestion):** `npm test` (F1-G1) falha com 6 erros PRÉ-EXISTENTES (presentes em `3fffdb9`, antes do F1; nenhum em `tests/decompose.test.js`). Usuário escolheu **Option 2 = CORRIGIR as 6** (manter F1-G1 = `npm test` sem emenda), NÃO Option 1 (emendar para escopado, como F0-G1 foi emendado). As 6 correções são pré-existentes e FORA do `scopeBoundary` do F1 → commitar separadamente (`fix(test):`/`test:`), nunca nos commits do refactor F1.

## Links

_(plan doc: `plan.md` no mesmo dir; design `design.md`; research `research-plan-quality.md`)_

## Session handoff
- **Narrative:** F1 (refactor mecânico de `src/decompose.js`) IMPLEMENTADO e committed: T-004 (`decomposeOnePhase`) + T-005 (`writeInitiativeFile`) ambos `done` com evidence `passed:true` (`node --test tests/decompose.test.js` 78→82 verde; byte-identidade R-ORCH-10 provada pelos testes flat+nested existentes + novos `deepEqual` vs `decomposePlan`/`materializeDecomposition`). Commits `bcad8bc` (T-004), `eeda14b` (T-005). Blocker atual para `phase-done`: F1-G1 = `npm test` falha com **6 erros PRÉ-EXISTENTES** (presentes em `3fffdb9`, antes do F1; nenhum em `tests/decompose.test.js`, que está 82/82 verde). **Decisão do usuário: CORRIGIR as 6 (NÃO emendar F1-G1 para escopado)** — trabalho fora do `scopeBoundary` do F1, autorizado explicitamente. Root-cause investigation começou (só leitura); hipótese forte = as 6 são *stale-expected-count drifts* (testes com contagens hardcoded que ficaram atrás do inventário atual de `skills/`), NÃO bugs de lógica — mas PRECISA ser confirmado lendo cada teste + a lógica de install/refresh ANTES de bumpar contagens (fix-skill: root-cause → TDD → minimal).
- **Decision log:** ver `## Decisions` acima — 3 decisões de assinatura + a **decisão F1-G1 (Option 2: corrigir as 6, manter `npm test` sem emenda)**. As 6 correções são pré-existentes e fora do escopo do F1 → commitar separadamente.
- **Single nextAction:** Continuar a correção das 6 falhas: confirmar a hipótese stale-count para cada uma (ver lista verbatim abaixo), aplicar fix mínimo (bump expected OU tornar dinâmico), rodar `npm test` até 1479/1479 verde, commitar separado, THEN rodar `phase-done F1`.
- **Verbatim state:**
  - Árvore: **CLEAN** (resume-gate deve passar — só houve investigação por leitura; nenhuma correção começou). Branch `plan/phase-materialization`; WT `.worktrees/phase-materialization`.
  - F1 initiative: `.atomic-skills/projects/atomic-skills/phase-materialization/phases/f1-refactor-mecanico-do-decompose-js-beha.md` (tasksDone 2/2; gatesMet 0/2 pending).
  - As **6 falhas** (`npm test` → ℹ tests 1479 / pass 1465 / fail 6), todas pré-existentes em `3fffdb9`:
    - `tests/install.test.js:50` "creates command files for claude-code" — `actual 70 !== expected 69`
    - `tests/install.test.js:95` "installs memory module skills when module is enabled" — `actual 71 !== expected 70`
    - `tests/install.test.js:164` "creates files for multiple IDEs" — `actual 139 !== expected 137`
    - `tests/install.test.js:246` "keeps core-only install count when scope is user and no module is selected" — `actual 70 !== expected 69`
    - `tests/install.test.js` "copies codex-bridge and project assets to claude-code namespace" — `expected 50 namespace asset entries, got 51` (lista 51 arquivos de `skills/shared/`, p.ex. `ds-prompt.md`, `screens-prompt.md`, `rationalization.md`, `gate-mode.md`, `envelope-orchestration.md`, `fixtures-recipe.md`, `roster.yaml`, `templates.md`, `validation-checklist.txt` — CONFIRMAR se são legítimos no set copiado ou se o install está copiando largo demais)
    - `tests/refresh-state.test.js:61` "regenerates burnup/spi while preserving the existing refresh passes" — `summary.seriesWritten actual 13 !== expected 12` (comentário do teste: `11 base − totals.json (retired) + burnup.json + spi.json`; descobrir qual é a 13ª series que `scripts/refresh-state.js` agora escreve)
  - Exit-gate verifiers (a rodar DEPOIS das 6 verdes): F1-G1 = `npm test` (expectExitCode 0); F1-G2 = `node -e "import(\"./src/decompose.js\").then(m => { if (typeof m.decomposeOnePhase !== \"function\" || typeof m.writeInitiativeFile !== \"function\") process.exit(1) })"`.
  - Scripts pelo repo-root direto (NÃO `$HOME/.atomic-skills/package-root` — stale): `node scripts/validate-state.js`, `node scripts/refresh-state.js`, `node scripts/append-completion.js`.
  - Repro das falhas: `npm test 2>&1 | grep -E "ℹ (tests|pass|fail) "` e `node --test tests/install.test.js 2>&1 | grep -A14 AssertionError`.
- **Uncommitted changes:** clean tree (T-004, T-005 e este handoff committed; as 6 correções ainda NÃO começaram — só investigação por leitura).

## Self-review against code-quality gates

- **G1 read-before-claim**: 2 tasks closed (T-004 `decomposeOnePhase`, T-005 `writeInitiativeFile`), cada uma com `outputs[]` (`src/decompose.js`, `tests/decompose.test.js`) + `evidence` de execução real do verifier (`node --test tests/decompose.test.js` 78→82 verde; byte-identidade R-ORCH-10 provada por `deepEqual` vs `decomposePlan`/`materializeDecomposition`).
- **G2 soft-language**: scanned `nextAction` + descrições de tasks + descrições de critérios contra a ban-list; 0 violações.
- **G6 reference-or-strike**: 2 exit criteria (F1-G1, F1-G2), ambas `met` com `evidence:` populado (`verifierKind: shell`, `passed: true`, `exitCode: 0`); 0 `deferred`, 0 unverified-and-flagged.
- **Codex review**: N/A — fase NÃO-destrutiva (G5 `DESTRUCTIVE=false`: refactor mecânico, sem deleção de arquivo-fonte, sem drop tokens, churn 428+/122−), então o review gate rodou **local-only** (`--mode=local`): verdict `clean`, 0 findings, 2 passes (agent em contexto limpo; byte-identidade das duas extrações + as 4 contagens de teste empiricamente confirmadas contra produção — 70/71/139/51 e `seriesWritten:13`). Nenhum review-file persistido (local-only não escreve `.atomic-skills/reviews/`).
- **Review gate (G2)**: registrado no descritor da fase em `plan.md` como `reviewGate: { status: passed, at: 340991b25d56ab281464346250bdd63ea5e048b1, mode: local, verifiedAt: 2026-06-30T23:04:44.000Z }`. Esta linha de prose é o audit humano; o campo no descritor é o machine-checkable que GATE-R3 enforce — concordam.
- **Lessons (G1)**: clean phase — 0 findings do review, 0 tarefas reabertas/blocked, 0 gates deferidos. A única não-trivialidade foi F1-G1 (`npm test`) temporariamente bloqueada por 6 falhas PRÉ-EXISTENTES de outra feature (plan-dependency), corrigidas em commit `9b5e645` separado e fora do `scopeBoundary` do F1 — não é um failure-signal DO F1.

