---
schemaVersion: "0.1"
slug: skills-restructuring-f2-economia-de-tokens-padroes-transversais
title: "Economia de tokens: padrões transversais"
goal: aplicar uma receita por padrão repetido em N skills de uma vez. Depende de
  F1 (verifier-exec.md nasce em T1.4).
status: done
branch: null
started: 2026-06-16T16:50:35Z
lastUpdated: 2026-06-16T19:00:49Z
nextAction: null
parentPlan: skills-restructuring
phaseId: F2
tasksDone: 7
tasksTotal: 7
gatesMet: 1
gatesTotal: 1
exitGates:
  - id: F2-G1
    description: O asset de envelope existe e a suite de validação passa.
    status: met
    metAt: 2026-06-16T18:56:10Z
    verifier:
      kind: shell
      command: test -f skills/shared/codex-bridge-assets/envelope-orchestration.md &&
        npm run validate-skills
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T18:56:10Z
      passed: true
      exitCode: 0
      outputSummary: test -f envelope-orchestration.md && npm run validate-skills →
        All 15 skills valid (schema_version 0.2); exit 0.
    verifierLabel: "shell: test -f skills/shared/codex-bridge-assets/envelope-orchestr…"
    evidenceSummary: passed · 2026-06-16
stack:
  - id: 1
    title: "Economia de tokens: padrões transversais"
    type: task
    openedAt: 2026-06-15T13:37:12.477Z
tasks:
  - id: T2.1
    title: Convenção Red Flags e Rationalization em todas as skills
    status: done
    closedAt: 2026-06-16T18:20:39Z
    lastUpdated: 2026-06-16T18:20:39Z
    summary: Convenção RF/Rationalization aplicada a 6 skills
    description: "Aplicar a convenção: gatilhos one-liner resident, refutação
      deletada quando só reafirma um Red Flag, ou movida para asset lazy por
      skill. Arquivos: skills/core/brainstorm.md, skills/core/fix.md,
      skills/core/hunt.md, skills/core/parallel-dispatch.md,
      skills/core/parallel-dispatch-audit.md, skills/core/debate.md"
    scopeBoundary:
      - não tocar prompt.md nem save-and-push.md (já enxutas); preservar os
        gatilhos one-liner.
    acceptance:
      - no máximo duas dessas skills mantêm uma tabela Rationalization completa.
    verifier:
      kind: shell
      command: test $(grep -rl '## Rationalization' skills/core/brainstorm.md
        skills/core/fix.md skills/core/hunt.md skills/core/parallel-dispatch.md
        skills/core/parallel-dispatch-audit.md skills/core/debate.md | wc -l)
        -le 2
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T18:20:39Z
      passed: true
      exitCode: 0
      outputSummary: "grep -rl '## Rationalization' nas 6 skills retorna 2 (fix.md,
        hunt.md) <= 2; exit 0. brainstorm+debate: tabela deletada (conteúdo
        resident em Red Flags/Process — P3 verificado);
        parallel-dispatch(+audit): movida p/
        skills/shared/parallel-dispatch-assets/rationalization.md.
        validate-skills: 15 válidas."
    outputs:
      - kind: file
        path: skills/core/brainstorm.md
      - kind: file
        path: skills/core/fix.md
      - kind: file
        path: skills/core/hunt.md
      - kind: file
        path: skills/core/parallel-dispatch.md
      - kind: file
        path: skills/core/parallel-dispatch-audit.md
      - kind: file
        path: skills/core/debate.md
  - id: T2.2
    title: Extrair o esqueleto do envelope codex
    status: done
    closedAt: 2026-06-16T18:28:18Z
    lastUpdated: 2026-06-16T18:28:18Z
    summary: Esqueleto do envelope codex extraído para asset compartilhado
    description: "Extrair os 11-12 passos byte-idênticos do sub-flow codex para
      codex-bridge-assets/envelope-orchestration.md; review-code e review-plan
      passam a referenciar. Arquivos:
      skills/shared/codex-bridge-assets/envelope-orchestration.md,
      skills/core/review-code.md, skills/core/review-plan.md"
    scopeBoundary:
      - deixar em cada review só os deltas artefato-específicos; não tocar os
        assets-folha já corretos.
    acceptance:
      - o asset de orquestração existe
      - ambos os reviews o referenciam.
    verifier:
      kind: shell
      command: test -f skills/shared/codex-bridge-assets/envelope-orchestration.md &&
        grep -q 'envelope-orchestration' skills/core/review-code.md && grep -q
        'envelope-orchestration' skills/core/review-plan.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T18:28:18Z
      passed: true
      exitCode: 0
      outputSummary: "Asset envelope-orchestration.md criado (esqueleto canônico de 12
        passos, parametrizado por slots «INPUT/PASS1_TEMPLATE/CONSTRAINTS/
        ARTIFACT/SIZE_BUDGET/TRIAGE_TARGET/TRIAGE_NOTES»); review-code.md e
        review-plan.md substituem o sub-flow inline por ponteiro + bindings
        artefato-específicos (composite-artifact preservado no plan). grep
        'envelope-orchestration' = 1 em cada; exit 0. validate-skills: 15
        válidas."
    outputs:
      - kind: file
        path: skills/shared/codex-bridge-assets/envelope-orchestration.md
      - kind: file
        path: skills/core/review-code.md
      - kind: file
        path: skills/core/review-plan.md
  - id: T2.3
    title: Gates de qualidade por referência, não paráfrase
    status: done
    closedAt: 2026-06-16T18:32:03Z
    lastUpdated: 2026-06-16T18:32:03Z
    summary: Gates G1-G7 por referência, não paráfrase, em 4 skills
    description: "Substituir as paráfrases inline de G1-G7 pelo one-liner de
      referência que code-quality-gates.md prescreve, em brainstorm, hunt, fix e
      review-code. Arquivos: skills/core/brainstorm.md, skills/core/hunt.md,
      skills/core/fix.md, skills/core/review-code.md"
    scopeBoundary:
      - manter o bloco de self-review onde ele molda a saída; remover só as
        definições inline duplicadas.
    acceptance:
      - cada um dos quatro corpos referencia code-quality-gates.md por caminho.
    verifier:
      kind: shell
      command: test $(grep -rl 'code-quality-gates.md' skills/core/brainstorm.md
        skills/core/hunt.md skills/core/fix.md skills/core/review-code.md | wc
        -l) -eq 4
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T18:32:03Z
      passed: true
      exitCode: 0
      outputSummary: "Os 4 corpos (brainstorm, hunt, fix, review-code) referenciam
        docs/kb/code-quality-gates.md por caminho (count=4, exit 0). Definições
        inline G1-G7 em negrito colapsadas ao one-liner de referência prescrito
        (KB:5 'inject by reference'); 0 linhas '- **G[0-9]' restantes em cada.
        Blocos '## Self-review against gates' preservados nos 4 (scopeBoundary).
        validate-skills: 15 válidas."
    outputs:
      - kind: file
        path: skills/core/brainstorm.md
      - kind: file
        path: skills/core/hunt.md
      - kind: file
        path: skills/core/fix.md
      - kind: file
        path: skills/core/review-code.md
  - id: T2.4
    title: Scaffolds emit-time para assets lazy
    status: done
    closedAt: 2026-06-16T18:35:00Z
    lastUpdated: 2026-06-16T18:35:00Z
    summary: Scaffolds emit-time do parallel-dispatch viram assets lazy
    description: "Mover templates emit-time (prompt skeleton, plan-file template,
      closing report) para assets lazy em parallel-dispatch e
      parallel-dispatch-audit; eleger uma spec canônica para os campos do
      report. Arquivos: skills/core/parallel-dispatch.md,
      skills/core/parallel-dispatch-audit.md,
      skills/shared/parallel-dispatch-assets/templates.md"
    scopeBoundary:
      - não mover gatilhos ambiente; só scaffolds consumidos no passo de emissão.
    acceptance:
      - o asset de templates existe
      - parallel-dispatch encolhe abaixo de 13000 bytes.
    verifier:
      kind: shell
      command: test -f skills/shared/parallel-dispatch-assets/templates.md && test
        $(wc -c < skills/core/parallel-dispatch.md) -lt 13000
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T18:35:00Z
      passed: true
      exitCode: 0
      outputSummary: "templates.md criado (scaffolds emit-time: task-prompt skeleton,
        dispatch plan-file template, e a spec canônica única dos Closing Reports
        de dispatch + audit). parallel-dispatch.md e parallel-dispatch-audit.md
        apontam para ele; lógica/Process/HARD-GATEs ficam resident
        (scopeBoundary). parallel-dispatch.md = 10804 bytes (< 13000); exit 0.
        validate-skills: 15 válidas."
    outputs:
      - kind: file
        path: skills/core/parallel-dispatch.md
      - kind: file
        path: skills/core/parallel-dispatch-audit.md
      - kind: file
        path: skills/shared/parallel-dispatch-assets/templates.md
  - id: T2.5
    title: Colapsar re-derivação de verifier-exec no verify-claim
    status: done
    closedAt: 2026-06-16T18:38:29Z
    lastUpdated: 2026-06-16T18:38:29Z
    summary: verify-claim aponta para verifier-exec em vez de re-derivar
    description: "Reduzir o step 4 do verify-claim ao verdict-shape mais ponteiro
      para verifier-exec.md (criado em T1.4); remover a re-derivação da regra
      PASS por-kind. Arquivos: skills/core/verify-claim.md"
    scopeBoundary:
      - não alterar o self-review checkpoint nem a Iron Law do verify-claim.
    acceptance:
      - verify-claim.md referencia verifier-exec
      - a regra de testsCollected aparece no máximo duas vezes.
    verifier:
      kind: shell
      command: grep -q 'verifier-exec' skills/core/verify-claim.md && test $(grep -c
        'testsCollected' skills/core/verify-claim.md) -le 2
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T18:38:29Z
      passed: true
      exitCode: 0
      outputSummary: "verify-claim.md: steps 3/4/5 apontam para
        {{ASSETS_PATH}}/verifier-exec.md (3 refs 'verifier-exec'); a
        re-derivação da regra PASS por-kind colapsada ao verdict-shape +
        ponteiro. Literal 'testsCollected' reduzido de 7 → 2 (step 4 regra +
        step 5 evidence shape; as 5 menções retóricas reformuladas p/ prosa).
        Iron Law + self-review intactos (scopeBoundary). exit 0;
        validate-skills: 15 válidas."
    outputs:
      - kind: file
        path: skills/core/verify-claim.md
  - id: T2.6
    title: Reduzir debug-techniques inline no fix
    status: done
    closedAt: 2026-06-16T18:39:33Z
    lastUpdated: 2026-06-16T18:39:33Z
    summary: fix reduz debug-techniques inline a ponteiro
    description: "Reduzir a re-derivação de boundary instrumentation em fix.md a
      gatilho mais ponteiro para debug-techniques.md. Arquivos:
      skills/core/fix.md"
    scopeBoundary:
      - não tocar o Process do fix; só o parágrafo de boundary instrumentation.
    acceptance:
      - fix.md referencia debug-techniques.md.
    verifier:
      kind: shell
      command: grep -q 'debug-techniques' skills/core/fix.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T18:39:33Z
      passed: true
      exitCode: 0
      outputSummary: "fix.md §47 (parágrafo boundary instrumentation): a mecânica
        detalhada de tracing colapsada ao gatilho (quando o sintoma cruza
        módulos, instrumentar os seams antes de hipóteses) + ponteiro para
        skills/shared/debug-techniques.md §2. Process intacto (scopeBoundary só
        permitia o parágrafo). grep 'debug-techniques' = 4 refs; exit 0.
        validate-skills: 15 válidas."
    outputs:
      - kind: file
        path: skills/core/fix.md
  - id: T2.7
    title: Adicionar ponteiro worktree no parallel-dispatch
    status: done
    closedAt: 2026-06-16T18:40:48Z
    lastUpdated: 2026-06-16T18:40:48Z
    summary: parallel-dispatch ganha ponteiro para worktree-isolation
    description: "Adicionar a terceira opção de remédio para colisão de escopo
      apontando worktree-isolation.md. Arquivos:
      skills/core/parallel-dispatch.md"
    scopeBoundary:
      - não reescrever as opções existentes; só adicionar a opção worktree.
    acceptance:
      - parallel-dispatch.md referencia worktree-isolation.
    verifier:
      kind: shell
      command: grep -q 'worktree-isolation' skills/core/parallel-dispatch.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T18:40:48Z
      passed: true
      exitCode: 0
      outputSummary: "parallel-dispatch.md §90 (não-decomponível): adicionada a 3ª
        opção de remédio para colisão de escopo — isolar cada task em git
        worktree per skills/shared/worktree-isolation.md — em frase nova, sem
        reescrever as opções existentes (sequential/finer-decomposition;
        scopeBoundary). grep 'worktree-isolation' = 1 ref; exit 0.
        parallel-dispatch.md=11056B (<13000, T2.4 holds). validate-skills: 15
        válidas."
    outputs:
      - kind: file
        path: skills/core/parallel-dispatch.md
parked: []
emerged: []
summary: Uma receita por padrão de bloat aplicada em todas as skills
  (RF/Rationalization, envelope, gates).
planTitle: Reestruturação das skills atomic-skills
planActive: true
---

# Narrative / notes

Initiative for phase **F2 — Economia de tokens: padrões transversais**.

## Decisions

- **Executor = Mode 1 (Opus serial), ratificado pelo usuário** (2026-06-16). Lane
  Codex está on (`routing.json`: mode2Enabled/codexLane.enabled true), mas as 7
  tasks colidem nos mesmos arquivos (sem ganho de paralelismo) e os verifiers são
  pisos `grep` fracos → dedup editorial é juízo, não mecânica (F1 não-spec-ready).
- **T2.1 disposição da Rationalization:** KEEP inline em `fix.md` + `hunt.md` (os 2
  permitidos; Red Flags nus, tabela é a única casa do raciocínio). DELETE em
  `brainstorm.md` + `debate.md` (reafirmação pura — todo nugget verificado resident
  em Red Flags/Process/gates, P3 preservado). MOVE `parallel-dispatch.md` +
  `parallel-dispatch-audit.md` → `skills/shared/parallel-dispatch-assets/rationalization.md`
  (asset lazy, ponteiro em cada; preserva math 65% + cap-at-5 não-resident).
- Ponteiro lazy NÃO usa header `## Rationalization` (senão o grep do verifier
  contaria o arquivo). Texto: "The refutation detail … lives in `…/rationalization.md`".

## Session handoff
- **Narrative:** F2 COMPLETA — todas as 7 tasks (T2.1–T2.7) fechadas com verified
  PASS + evidence GATE-R2; validate-state verde a cada close. F2-G1 exit gate
  verifier passa (envelope-orchestration.md existe + validate-skills 15 válidas).
  Boundary da fase atingido: aguardando o usuário optar por commit + `phase-done`
  (não auto-executado — intrusive-actions). Árvore ainda não-commitada.
- **Decision log:** ver § Decisions (executor Mode 1; disposição T2.1; ponteiro sem
  header `## Rationalization`). T2.2: slot `«TRIAGE_NOTES»` no envelope preserva a
  Verdict-line/early-exit que era só do review-plan (P3). T2.3: defs G1-G7 inline
  colapsadas ao one-liner de referência, self-review preservado. T2.4: scaffolds
  emit-time → templates.md (spec única do report). T2.5: `testsCollected` 7→2,
  steps 3/4/5 apontam para verifier-exec.md. T2.6: boundary-instrumentation →
  ponteiro §2. T2.7: 3ª opção de remédio (worktree) adicionada sem reescrever as
  existentes.
- **Single nextAction:** Commitar a F2 (12 arquivos rastreados + 2 assets novos) e
  rodar `atomic-skills:project phase-done` — executa os exit-gate verifiers (F2-G1
  já verde), o review-code phase-diff gate, distila lessons, grava `reviewGate` no
  plano e avança `currentPhase`. NÃO auto-avançar; o usuário opta (intrusive-actions).
- **Verbatim state:**
  - F2-G1 exit gate (PASS exit 0): `test -f skills/shared/codex-bridge-assets/envelope-orchestration.md && npm run validate-skills` → "All 15 skills valid".
  - Cada task fechou via: editar frontmatter (status: done + closedAt + evidence shell) → `node scripts/refresh-state.js` → `npm run validate-state <phase-file>` (✓ All 1 file valid).
  - Diffstat: +237/−423 nos 12 arquivos rastreados; 2 assets novos (envelope-orchestration.md; parallel-dispatch-assets/{rationalization,templates}.md).
- **Uncommitted changes:** (`git status --porcelain`, nenhum commit feito ainda)
  ```
   M .atomic-skills/focus.json
   M .atomic-skills/projects/atomic-skills/skills-restructuring/phases/f2-economia-de-tokens-padroes-transversais.md
   M .atomic-skills/status/last-session.json
   M skills/core/brainstorm.md
   M skills/core/debate.md
   M skills/core/fix.md
   M skills/core/hunt.md
   M skills/core/parallel-dispatch-audit.md
   M skills/core/parallel-dispatch.md
   M skills/core/review-code.md
   M skills/core/review-plan.md
   M skills/core/verify-claim.md
  ?? skills/shared/codex-bridge-assets/envelope-orchestration.md
  ?? skills/shared/parallel-dispatch-assets/
  ```
  (`.atomic-skills/focus.json` + `last-session.json` = bookkeeping auto-gerado.)

## Self-review against gates (F2 implementation)
- G1 read-before-claim: applied — cada task fechou citando o verifier-run real (exit code capturado) + as linhas-fonte lidas antes de cada edit; evidência em cada `tasks[].evidence.outputSummary`.
- G2 soft-language: applied — claims de conclusão são `passed: true` com resultado observado; handoff sem `should`/`probably`/`works`/`looks done`.
- G6 reference-or-strike: applied — os literais do handoff são caminhos/comandos verbatim (verifiers, paths de asset, diffstat), não paráfrases.

## Self-review against code-quality gates (phase-done)

- **G1 read-before-claim**: 7 tasks fechadas, cada uma com `evidence.outputSummary` citando o verifier-run real (exit code capturado); `outputs[]` lista os arquivos tocados.
- **G2 soft-language**: scaneado `nextAction` + task descriptions + criterion descriptions pela ban list; 0 violações.
- **G6 reference-or-strike**: 1 exit criterion (F2-G1) `met` com `evidence` populada; 0 deferred; 0 unverified.
- **Codex review**: NÃO executado no phase-done — mode escolhido = `local` pelo sinal DESTRUCTIVE=false (+539/−423, 0 arquivos deletados), consistente com F0/F1/F6 (`mode: local`). O review-code local rodou em sealed-envelope (agente em contexto limpo) sobre `113d5e8..HEAD`, 2 findings (1 major + 1 minor), ambos corrigidos em `2e09b596` e re-verificados.
- **Review gate (G2)**: `reviewGate` gravado no descritor da fase em plan.md: `{ status: passed, at: 2e09b5962351baf9ce4831947cb8678312e6a5f1, mode: local, reviewFile: .atomic-skills/reviews/2026-06-16-1856-skills-restructuring-f2.md }`. Prosa e campo concordam (GATE-R3).
- **Lessons (G1)**: 1 lição reusável (L-001 — UNIÃO de placeholders ao extrair esqueleto compartilhado) destilada em `lessons/skills-restructuring-f2-economia-de-tokens-padroes-transversais.md`, ratificada pelo usuário. A fase-start gate da F3 a dispõe via `list-lessons.js --phase F3`.

## Links

_(plan doc, external refs)_
