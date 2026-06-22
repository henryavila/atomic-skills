---
schemaVersion: "0.1"
slug: multiplan-focus-resolution
title: Resolução de foco em camadas + enforcer worktree-por-plano
goal: Tornar o foco da statusline determinístico com mais de um plano ativo, via
  resolução em camadas e um enforcer que isola planos concorrentes em worktrees.
status: active
branch: plan/multiplan-focus
started: 2026-06-15T19:42:12Z
lastUpdated: 2026-06-16T12:00:18Z
nextAction: "T-006: materializar/entrar na worktree-do-plano no implement (+ dar
  worktree ao Mode 1); depois promover T-003 (verify WARN→FAIL) quando o dry-run
  estabilizar."
parentPlan: multiplan-focus-resolution
phaseId: F0
tasksDone: 4
tasksTotal: 6
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F0-G1
    description: Enforcer soft implementado e foco determinístico com multi-plano
      demonstrado.
    status: pending
    verifier:
      kind: manual
      description: Validar com o usuário que o foco resolve corretamente com 2+ planos
        ativos e que o enforcer força/oferece worktree.
    verifierLabel: manual
stack:
  - id: 1
    title: Resolução de foco em camadas + enforcer worktree-por-plano
    type: task
    openedAt: 2026-06-15T19:42:12Z
tasks:
  - id: T-001
    title: Desenhar invariante + ponto de enforcement
    status: done
    lastUpdated: 2026-06-16T10:42:17Z
    closedAt: 2026-06-16T10:42:17Z
    summary: Definir '≤1 plano ativo/branch' e onde o enforcer roda.
    description: "Invariante travado: ≤1 plano ativo reivindica uma árvore. Seam =
      create-plan Stage 6 'single-focus pre-flight'. Feito (commit 4ca8cdc)."
  - id: T-002
    title: Enforcer soft na ativação + carimbar branch
    status: done
    lastUpdated: 2026-06-16T10:42:17Z
    closedAt: 2026-06-16T10:42:17Z
    summary: Warn + oferta de auto-worktree e stamp do campo branch do plano.
    description: "create-plan Stage 6 + create-initiative: AskUserQuestion de
      isolamento (worktree/pause/aceitar drift) antes de materializar,
      alimentando branch. Soft. Feito (commit 4ca8cdc)."
  - id: T-003
    title: Promover warn→fail no project-verify
    status: pending
    lastUpdated: 2026-06-16T10:42:17Z
    summary: verify falha com ≥2 ativos reivindicando a mesma árvore.
    description: O WARN já existe (verify §3 branch match — 'Only one should be
      active per branch'). Falta promover a FAIL no fim do dry-run, consistente
      com o enforcer.
  - id: T-004
    title: "claudebar: chip do focus.json + render do marcador de multi-plano"
    status: done
    lastUpdated: 2026-06-16T10:42:17Z
    closedAt: 2026-06-16T10:42:17Z
    summary: Consumidor implementado a partir do handoff (desktop-only).
    description: "project_chip() + render do ⧉ shipados pelo trabalho paralelo na
      branch feat/atomic-skills-focus-chip do ~/claudebar. Handoff:
      docs/atomic-skills-focus-integration.md."
  - id: T-005
    title: "Produtor: multipleActivePlans tree-relative"
    status: done
    lastUpdated: 2026-06-16T10:42:17Z
    closedAt: 2026-06-16T10:42:17Z
    summary: ⧉ só em drift real; worktree limpa não mostra.
    description: "emit-focus: claim por branch (plano brancheado reivindica só sua
      árvore; sem-branch reivindica qualquer; branch desconhecida não
      desambigua). 3 testes. Feito (commit 4f05a79)."
  - id: T-006
    title: "implement: materializar/entrar na worktree-do-plano (+ Mode 1)"
    status: pending
    lastUpdated: 2026-06-16T10:42:17Z
    summary: Casa física durável por plano no início do trabalho; isola o Mode 1.
    description: implement materializa/entra na worktree-do-plano ao iniciar (lazy),
      o que também dá worktree ao Mode 1 (hoje sem nenhuma). Decisão deliberada
      — muda o contrato inline do Mode 1.
parked: []
emerged: []
summary: "Foco determinístico para multi-plano: resolução em camadas + enforcer
  worktree."
planTitle: Resolução de foco em camadas + enforcer worktree-por-plano
planActive: true
current: true
---

# Narrative / notes

Initiative standalone (paused — queued) para a feature de foco multi-plano da statusline.

## Feito até aqui

- **T-005** producer tree-relative `multipleActivePlans` — commit `4f05a79`.
- **T-002 + T-001** enforcer soft no `project` (create-plan Stage 6 + create-initiative) — commit `4ca8cdc`.
- **T-004** chip do claudebar — shipado pelo trabalho paralelo (`feat/atomic-skills-focus-chip`).
- Base anterior: digest `focus.json` + schema + `refresh-state` + hooks — commit `72c7f35`.

## Decisões (travadas nesta sessão)

1. **Worktree são 3 níveis aninhados** — (1) **plano**: casa durável do foco, branch `plan/<slug>`; (2) **sessão de execução**: onde se edita (hoje Mode 1 = árvore primária, sem worktree); (3) **task (Mode 2)**: efêmera, foreign-writer Codex, fenced do estado. Só o nível 3 existe hoje.
2. **Binding por campo `branch:`, NÃO divergência de `status` por branch.** `.atomic-skills/` é estado compartilhado/commitado; divergir `active` por branch dá merge-hell. Em vez disso todos seguem `active` e cada um declara `branch:`; a resolução escolhe por branch da árvore. Sem conflito de merge.
3. **Split de responsabilidade.** `project` = binding lógico (carimba `branch:`) + invariante (warn→fail). `implement` = materializar/entrar na worktree no início do trabalho (+ isolar o Mode 1). O binding tem que ser no `project` porque o foco já fica ambíguo no instante em que 2 planos viram ativos, antes de qualquer `implement`.
4. **`multipleActivePlans` é tree-relative.** ⧉ = >1 plano ativo reivindica a árvore atual. Worktree-por-plano limpa nunca mostra; só drift real mostra.
5. **Ladder soft→hard.** create-plan = soft (detecta + escolha guiada); verify = hard (WARN→FAIL), mesmo padrão dry-run→strict das outras gates.

## A desenhar (colaborativo)

- **T-006** — materialização/entrada na worktree no `implement` + worktree para o Mode 1 (muda o contrato inline do Mode 1; decisão deliberada).

## Links

- `docs/design/statusline-focus-integration.md` — spec do digest + camadas de frescor.
- `~/claudebar/docs/atomic-skills-focus-integration.md` — handoff do consumidor.
