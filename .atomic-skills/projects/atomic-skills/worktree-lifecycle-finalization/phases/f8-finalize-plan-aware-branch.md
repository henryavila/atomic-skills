---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f8-finalize-plan-aware-branch
title: Finalize plan-aware — branch ≠ plano (Decisão 9)
goal: >-
  tornar o `project finalize` correto quando uma branch/worktree carrega MAIS DE
  UM plano em estágios diferentes: resolver um plano-alvo EXPLÍCITO (nunca o
  default-silencioso do ponteiro focus), exigir o alvo terminal, emitir WARN dos
  planos-irmãos não-arquivados que o merge arrastaria, detectar (advisory)
  regressão de status de plano no merge, e verificar a existência do
  integrationRef antes de publicar (fecha o "develop silencioso"). Skill
  genérica; esta WT é a fonte de verdade do finalize.
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-19T16:20:35Z
lastUpdated: 2026-06-19T16:20:35Z
nextAction: >-
  Rodar `atomic-skills:implement` na F8 começando pela T-001 (TDD:
  tests/finalize-plan-scope.test.js RED → scripts/finalize-plan-scope.js GREEN).
parentPlan: worktree-lifecycle-finalization
phaseId: F8
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: >-
      Resolvedor de escopo de plano determinístico
      (scripts/finalize-plan-scope.js): enumera os plan.md da branch, classifica
      alvo/outro-ativo/arquivado-não-mergeado, exige alvo terminal, BLOQUEIA
      alvo≠focus-sem-confirmação, WARN nos irmãos não-arquivados; detector de
      regressão de status advisory; puro/never-throws (fail-closed na dúvida);
      suite verde.
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/finalize-plan-scope.test.js
  - id: G-2
    description: >-
      project-finalize.md documenta o guard plan-aware (passo pré-publish:
      seleção EXPLÍCITA do plano-alvo, terminalidade, WARN de irmãos), a
      verificação de existência do integrationRef (inclui source:default), e o
      detect+WARN advisory de regressão de status no merge (reusa a lane do F4);
      skills válidos.
    status: pending
    verifier:
      kind: shell
      command: grep -qi 'plan-aware' skills/shared/project-assets/project-finalize.md && grep -qi 'finalize-plan-scope' skills/shared/project-assets/project-finalize.md && npm run validate-skills
stack:
  - id: 1
    title: Finalize plan-aware — branch ≠ plano (Decisão 9)
    type: task
    openedAt: 2026-06-19T16:20:35Z
tasks:
  - id: T-001
    title: "Resolvedor plan-aware + detector de regressão (scripts/finalize-plan-scope.js)"
    summary: Função pura que classifica os planos da branch, decide block/warn, e
      detecta regressão de status de plano no merge.
    status: pending
    lastUpdated: 2026-06-19T16:20:35Z
    outputs:
      - kind: file
        path: scripts/finalize-plan-scope.js
      - kind: test
        path: tests/finalize-plan-scope.test.js
    scopeBoundary:
      - PURA sobre o estado lido (recebe os plan.md já parseados + o slug do
        focus + o snapshot do integrationRef); NÃO roda git/gh real no teste
      - NUNCA auto-resolve uma colisão nem muta estado — só classifica e decide
        block/warn (advisory para a regressão)
      - NÃO publica, NÃO faz merge, NÃO renomeia branch — isso é o consumo (T-003)
      - "fail-closed: input nulo/malformado/indeterminado BLOQUEIA, nunca passa"
    acceptance:
      - "`resolveFinalizePlanScope` enumera os plan.md da branch e classifica cada
        um em {target, other-active, archived-unmerged}"
      - BLOQUEIA quando o alvo não está pronto-para-publicar (nem todas as fases
        `done` e não `archived`)
      - BLOQUEIA quando o alvo ≠ o slug que o focus apontaria sem confirmação
        explícita (branch-name≠plan-slug surfaceado)
      - "`detectPlanStatusRegression` retorna os slugs cujo status na branch está
        ATRÁS do integrationRef (advisory, nunca gateia)"
      - "puro/never-throws sobre input nulo/malformado (fail-closed: BLOQUEIA)"
    verifier:
      kind: test
      runner: node
      pattern: tests/finalize-plan-scope.test.js
  - id: T-002
    title: Verificação de existência do integrationRef no consumo (fecha "develop silencioso")
    summary: finalize confirma que o integrationRef resolvido existe em origin antes
      do PR, inclusive no caso source:default.
    status: pending
    lastUpdated: 2026-06-19T16:20:35Z
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-finalize.md
    scopeBoundary:
      - NÃO mudar o resolvedor da Decisão 2 (scripts/integration-ref.js) nem seu
        contrato — só estende a guarda ao ponto de CONSUMO (o finalize)
      - "cobre o caso `source: default` (hoje só `not-configured` dispara prompt)"
      - ref ausente ⇒ prompt-quando-ausente, NUNCA publicar contra ref inexistente
    acceptance:
      - "project-finalize.md Step 1 verifica `git show-ref`/`git ls-remote` do ref
        resolvido em origin ANTES do `gh pr create`, inclusive em source:default"
      - ref ausente cai no prompt-quando-ausente (usar existente OU criar)
      - "`npm run validate-skills` passa"
    verifier:
      kind: shell
      command: grep -qi 'ls-remote\|show-ref' skills/shared/project-assets/project-finalize.md && npm run validate-skills
  - id: T-003
    title: Fiar o guard plan-aware + WARN de regressão no project-finalize.md
    summary: Novo passo pré-publish no finalize — alvo explícito + terminalidade +
      WARN de irmãos e de regressão de status (advisory, reusa a lane do F4).
    status: pending
    lastUpdated: 2026-06-19T16:20:35Z
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-finalize.md
    scopeBoundary:
      - o guard é DETERMINÍSTICO (consome scripts/finalize-plan-scope.js da T-001)
      - o detector de regressão é ADVISORY/READ-ONLY (reusa a lane de agentes do
        F4; NUNCA gateia, NUNCA auto-resolve)
      - âncoras `plan-aware` + `finalize-plan-scope` presentes no doc
    acceptance:
      - "project-finalize.md documenta o passo pré-publish: seleção EXPLÍCITA do
        plano-alvo (não o default-silencioso do focus), exigência de
        terminalidade, e WARN dos planos-irmãos não-arquivados"
      - documenta o detect+WARN advisory de regressão de status no merge, reusando
        a lane de agentes do F4 (read-only, nunca gateia)
      - com as âncoras `plan-aware` e `finalize-plan-scope`
      - "`npm run validate-skills` passa"
    verifier:
      kind: shell
      command: grep -qi 'plan-aware' skills/shared/project-assets/project-finalize.md && grep -qi 'finalize-plan-scope' skills/shared/project-assets/project-finalize.md && npm run validate-skills
parked: []
emerged: []
summary: >-
  Finalize correto sob branch multi-plano: alvo explícito + terminal, WARN de
  irmãos e de regressão de status, e integrationRef verificado antes do PR.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F8 — Finalize plan-aware — branch ≠ plano (Decisão 9)**.

Origem: dogfood do próprio `project finalize` contra o estado real do repo (7
worktrees vivas, planos paralelos). O audit revelou que **branch ≠ plano**: cada
branch commita o tree `.atomic-skills/projects/` inteiro e a MESMA slug de plano
carrega status diferente em branches diferentes; uma worktree sobrevive a um plano
e hospeda o próximo. O `focus.json` aponta sempre para o plano MAIS NOVO, então o
finalize que resolve "o plano ativo" via focus mira o plano errado numa branch
multi-plano. As Decisões 1–8 assumem "1 worktree = 1 feature = 1 PR" e não cobrem
esse caso. Esta fase fecha o gap com um GUARD plan-aware determinístico + um
detector advisory de regressão de status + a verificação de existência do
integrationRef (fecha o "develop silencioso").

## Decisions

- Abordagem branch≠plano = **plan-aware guard** (não invariante duro 1-plano/branch):
  o operador escolheu detectar+exigir+avisar, sem travar fluxos legítimos.
- Regressão de status no merge = **detect+WARN no F8** (advisory, reusa a lane do
  F4); a partição estrutural completa do tree `.atomic-skills/projects/` permanece
  o PLANO SEPARADO que a Decisão 5 nomeou.
- Drift de versão da skill entre worktrees = **FORA de escopo**: esta WT
  (`plan/worktree-lifecycle-finalization`) é a ÚNICA fonte de verdade do finalize;
  as cópias mais antigas convergem no merge. Mesma regra para qualquer feature.

## Links

- design.md Decisão 9 (plan-aware finalize): `.atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/design.md`
- Consome: `scripts/integration-ref.js` (Decisão 2), `scripts/cross-wt-gate.js` (lane advisory, Decisão 7)
- Toca: `skills/shared/project-assets/project-finalize.md` (Step 1 + novo passo pré-publish)
- A criar: `scripts/finalize-plan-scope.js` + `tests/finalize-plan-scope.test.js`
