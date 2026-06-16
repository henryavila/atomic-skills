---
schemaVersion: "0.1"
slug: multiplan-focus-resolution
title: Resolução de foco em camadas + enforcer worktree-por-plano
goal: Tornar o foco da statusline determinístico com mais de um plano ativo, via
  resolução em camadas e um enforcer que isola planos concorrentes em worktrees.
status: active
branch: plan/multiplan-focus
started: 2026-06-15T19:42:12Z
lastUpdated: 2026-06-16T13:00:00Z
nextAction: "Todas as 6 tasks done. Rodar `phase-done` para executar a exit gate
  F0-G1 (kind:manual — validar com o usuário foco determinístico com 2+ planos
  ativos + enforcer oferece/força worktree) e o review-code do diff da fase,
  depois avançar/arquivar o plano. Usuário opta in (intrusive-actions)."
parentPlan: multiplan-focus-resolution
phaseId: F0
tasksDone: 6
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
    status: done
    lastUpdated: 2026-06-16T13:00:00Z
    closedAt: 2026-06-16T13:00:00Z
    summary: verify falha com ≥2 ativos reivindicando a mesma árvore.
    description: "verify §3 branch-match: caso '>1 match' promovido WARN→FAIL,
      remediação espelha o enforcer (worktree+branch / pause / stamp distinto);
      zero-match continua WARN (unanchored ≠ multi-active). Ancorado no ladder
      soft (create-plan Stage 6) → hard (verify). Feito (commit cdaa61e).
      Verifier kind:shell — content assertion (>1-match é FAIL, sem WARN
      residual) + `npm run validate-skills`, ambos exit 0."
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
    status: done
    lastUpdated: 2026-06-16T12:31:31Z
    closedAt: 2026-06-16T12:31:31Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T12:31:31Z
      passed: true
      exitCode: 0
      outputSummary: validate-skills OK + 3 grep anchors presentes em
        skills/core/implement.md (Step 0.5 heading, 'git worktree add
        .worktrees/', 'Mode 1 (Step 2) codes here, in the plan-worktree');
        EXIT=0
    summary: Casa física durável por plano no início do trabalho; isola o Mode 1.
    description: "implement materializa/entra na worktree-do-plano ao iniciar
      (lazy), o que também dá worktree ao Mode 1 (antes na árvore primária, sem
      worktree). Decisão deliberada — muda o contrato inline do Mode 1. Spec
      travada nesta sessão (design colaborativo): novo 'Step 0.5 — Resolve the
      plan-worktree (lazy)' em skills/core/implement.md, resolução por branch,
      materialização operator-prompted + HALT-and-instruct, casa do Mode 1 =
      worktree-do-plano."
    scopeBoundary:
      - Editar APENAS skills/core/implement.md — não tocar
        worktree-isolation.md, project-create-plan.md, nem o estado
        .atomic-skills/ de outros planos.
      - Não materializar worktree silenciosamente nem escrever entre árvores;
        materialização é operator-prompted e o passo HALTA instruindo
        re-entrada.
      - Não promover T-003 (verify warn→fail) nem regenerar docs/skills/.
    acceptance:
      - implement.md ganha um 'Step 0.5 — Resolve the plan-worktree (lazy)'
        entre o resume gate (Step 0) e o load de tasks (Step 1).
      - O passo resolve por branch e faz no-op quando a branch da árvore ==
        branch do plano, e degraded quando branch é null.
      - Mismatch materializa .worktrees/<slug> operator-prompted e HALTA
        instruindo re-rodar implement de dentro da worktree (sem cwd-switch
        silencioso).
      - O contrato do Mode 1 declara a worktree-do-plano como sua casa (nível
        2), não a árvore primária.
      - npm run validate-skills continua passando após a edição.
    verifier:
      kind: shell
      command: npm run validate-skills >/dev/null 2>&1 && grep -q "Resolve the
        plan-worktree (lazy)" skills/core/implement.md && grep -q "git worktree
        add .worktrees/" skills/core/implement.md && grep -q "Mode 1 (Step 2)
        codes here, in the plan-worktree" skills/core/implement.md
      expectExitCode: 0
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

- **T-006** novo `Step 0.5 — Resolve the plan-worktree (lazy)` no `implement` (resolução por branch, materialização operator-prompted + HALT-and-instruct, casa do Mode 1 = worktree-do-plano) — design colaborativo desta sessão; verifier kind:shell exit 0.
- **T-003** verify §3 branch-match >1-active promovido WARN→FAIL — commit `cdaa61e`.
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

- _(nada pendente)_ — **T-006** foi desenhado e implementado nesta sessão (design colaborativo travado via 2 decisões: materializar+instruir operator-prompted; casa do Mode 1 = worktree-do-plano).

## Links

- `docs/design/statusline-focus-integration.md` — spec do digest + camadas de frescor.
- `~/claudebar/docs/atomic-skills-focus-integration.md` — handoff do consumidor.

## Session handoff

- **Narrative:** Fase F0 do `multiplan-focus-resolution`, **6/6 tasks done** — fronteira de fase atingida. Esta sessão desenhou (design colaborativo) e fechou **T-006**: novo `Step 0.5 — Resolve the plan-worktree (lazy)` em `skills/core/implement.md`. T-003 já havia fechado em paralelo (`cdaa61e`/`0b6faa5`), entrou como commits abaixo das mudanças não-commitadas de T-006 — layering limpo, sem conflito. Exit gate F0-G1 é `kind: manual`, ainda **pending**.
- **Decision log:** (1) Design de T-006 travado com 2 decisões do usuário: **(a)** no mismatch de branch, `implement` materializa `.worktrees/<slug>` operator-prompted e **HALTA instruindo re-entrada** (nunca cwd-switch silencioso / escrita entre árvores); **(b)** a casa do **Mode 1 passa a ser a worktree-do-plano** (nível 2 do aninhamento), não a árvore primária. (2) Resolução **por branch, não por path** (reusa worktree-isolation §Step 0); no-op quando branch da árvore == branch do plano (caso vivo desta sessão), degraded quando branch null. (3) Convenção `.worktrees/<slug>` (regra do projeto), **não** o sibling-dir do `worktree-isolation.md` — discrepância do asset deixada como follow-up, fora do `scopeBoundary[]` de T-006. (4) `docs/skills/implement.md` é gerado de `meta/catalog.yaml`, não do corpo — editar `implement.md` não o deixa stale; escopo ficou em 1 arquivo.
- **Single nextAction:** Rodar `phase-done` (com opt-in do usuário) para executar a exit gate F0-G1 (`kind:manual`) + o review-code do diff da fase, depois avançar/arquivar o plano.
- **Verbatim state:**
  - File editado: `skills/core/implement.md` — novo `### Step 0.5 — Resolve the plan-worktree (lazy)` entre Step 0 e Step 1; frase de contrato `Mode 1 (Step 2) codes here, in the plan-worktree — not the primary tree`.
  - Verifier T-006 (kind:shell, exit 0): `npm run validate-skills >/dev/null 2>&1 && grep -q "Resolve the plan-worktree (lazy)" skills/core/implement.md && grep -q "git worktree add .worktrees/" skills/core/implement.md && grep -q "Mode 1 (Step 2) codes here, in the plan-worktree" skills/core/implement.md` → `EXIT=0`.
  - `npm run validate-state` → `✓ All 47 file(s) valid, 13 plan(s) cross-validated`. `node scripts/compute-rollups.js` → `{"tasksDone":6,"tasksTotal":6,"gatesMet":0,"gatesTotal":1}`.
  - HEAD no snapshot: `0b6faa5` (`chore(project): close T-003 (done) + rollups 5/6 + session handoff`).
- **Uncommitted changes:** `M skills/core/implement.md` + `M .atomic-skills/projects/atomic-skills/multiplan-focus-resolution/phases/multiplan-focus-resolution.md` (changeset de T-006: Step 0.5 + spec/done/evidence/rollups 6/6 + narrativa/handoff). Será commitado em seguida.

## Self-review against gates (F0 / implement)

- G1 read-before-claim: applied — T-006 fechado pelo run real `EXIT=0` do verifier (não por inspeção); âncoras conferidas via grep.
- G2 soft-language: applied — T-006 é `done` com `evidence.passed: true`; sem should/probably/works no handoff.
- G6 reference-or-strike: applied — literais do handoff são paths/comandos/commits verbatim (`skills/core/implement.md`, o comando do verifier, `0b6faa5`).
