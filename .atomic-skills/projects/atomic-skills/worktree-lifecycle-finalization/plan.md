---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization
title: Finalização do ciclo de vida da worktree-do-plano
version: "1.0"
status: active
started: 2026-06-16T15:05:46.324Z
lastUpdated: 2026-06-16T15:19:54.820Z
branch: plan/worktree-lifecycle-finalization
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Branch nasce sob concorrência, não na criação incondicional
    body: "O lever de decisão de branch é o Stage 6 single-focus pre-flight
      (`verified_by: skills/shared/project-assets/project-create-plan.md`), NÃO
      o Step 0.5 nem o `emit-focus` (cujo `multipleActivePlans` é pós-colisão e
      read-only, `verified_by: scripts/emit-focus.js` pickFocus). Plano solo
      permanece `branch: null` na árvore atual; forka `plan/<slug>` só quando a
      criação já encontra ≥1 plano ativo."
  - id: P2
    title: Arquivamento lógico e teardown da worktree são lifecycles separados
    body: "O `archive` flipa `status: archived` com zero efeito git, como hoje
      (`verified_by: skills/shared/project-assets/project-transitions.md`
      archive). O teardown da worktree é uma oferta NOVA e adjacente, nunca
      parte do flip de status. Arquivar-mas-não-mergear é o estado normal aqui.
      Ambos operator-prompted."
  - id: P3
    title: Nunca remover trabalho não-provado-integrado; em indeterminação, bloquear
    body: O teardown só remove quando um check prova integração (`git merge-base
      --is-ancestor plan/<slug> <base>`). Em indeterminação (origin
      ausente/stale, base irresolúvel) o check trata como não-mergeado e
      BLOQUEIA — a falha segura over-bloqueia, nunca over-deleta. Nunca `rm
      -rf`; nunca `-D`/`--force` por default; `git branch -d` (minúsculo) é a 2ª
      guarda nativa.
  - id: P4
    title: Backstop é relatório read-only, sem novo estado persistente
    body: O check de backstop é read-only e sinaliza em WARN; deriva live de `git
      worktree list --porcelain` + `merge-base` + status do plano. Sem flag nova
      no `focus.json`, sem hook que deleta, sem campo de schema novo. Promoção a
      FAIL fica como gatilho de evidência futura, não v1.
glossary:
  - term: plan-branch
    definition: branch `plan/<slug>`; bookkeeping de foco com commits interleaved,
      NÃO feature branch cujo telos é mergear na trunk.
  - term: teardown
    definition: remoção da worktree (e opcionalmente da branch via `git branch -d`)
      após arquivar, gated pelo invariante de não-perda.
  - term: base-ref ladder
    definition: "ordem de resolução da base de integração: `origin/main` fetchado →
      `main` local → indeterminado (bloqueia)."
  - term: backstop
    definition: check read-only no `project verify` que sinaliza órfãos (worktree
      viva de plano arquivado, branch arquivada à frente da base) em WARN.
  - term: concorrência
    definition: "≥1 plano `status: active` já existente no momento da criação de um
      novo plano; o gatilho que faz a branch nascer."
  - term: footprint
    definition: conjunto de arquivos que uma plan-worktree mudou, derivado de `git
      diff --name-only <base>...plan/<slug>`; rename `a→b` entra como união
      `{a,b}`.
  - term: componente conexo
    definition: grupo de worktrees ligadas por overlap de footprint (ou coupling
      file); a unidade de serialização — integra em série dentro, qualquer ordem
      entre componentes.
  - term: coupling file
    definition: arquivo que serializa mesmo com footprint disjunto (lockfiles,
      gerados, migrations); vira aresta global no grafo de footprint.
phases:
  - id: F0
    slug: worktree-lifecycle-finalization-f0-nascimento-da-branch-sob-con
    title: Nascimento da branch sob concorrência (Decisões 1+2)
    goal: "tornar `branch: null` na árvore atual o DEFAULT para um plano solo no
      Stage 6, forkando `plan/<slug>` só sob concorrência; e materializar
      retroativamente a worktree do plano pré-existente quando um 2º plano o
      torna concorrente."
    dependsOn: []
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: "Fork determinístico: solo retorna branch:null, concorrência
            retorna plan/<slug>; worktree retroativa do pré-existente composta
            sem --force; suite verde."
          status: pending
          verifier:
            kind: test
            runner: node
            pattern: tests/plan-branch-policy.test.js
        - id: G-2
          description: emit-focus permanece intacto — Decisão 1 não depende dele (testes
            de focus verdes).
          status: pending
          verifier:
            kind: shell
            command: node --test tests/focus-digest.test.js
    status: active
    summary: Branch da worktree nasce só sob concorrência; plano solo fica sem branch.
  - id: F1
    slug: worktree-lifecycle-finalization-f1-teardown-seguro-oferta-adjac
    title: Teardown seguro + oferta adjacente ao archive (Decisões 3+4)
    goal: fixar o invariante machine-enforced de não-perda-de-trabalho no teardown
      (com base-ref ladder) e oferecer o teardown operator-prompted adjacente ao
      `archive`, sem alterar o flip de status (que continua zero efeito git).
    dependsOn:
      - F0
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: Invariante prova integração antes de remover; indeterminação
            bloqueia; sem -D/--force/rm -rf; suite verde.
          status: pending
          verifier:
            kind: test
            runner: node
            pattern: tests/worktree-teardown.test.js
        - id: G-2
          description: Oferta de teardown adjacente ao archive presente; flip de status
            segue zero-git; skills válidos.
          status: pending
          verifier:
            kind: shell
            command: npm run validate-skills
    status: pending
    summary: Remover worktree só com integração provada; oferta de teardown no archive.
  - id: F2
    slug: worktree-lifecycle-finalization-f2-integracao-topology-aware-cl
    title: "Integração topology-aware: classificador de disjunção por footprint
      (Decisão 6)"
    goal: substituir a regra "sempre serial" por integração topology-aware — um
      classificador de disjunção por footprint constrói o grafo de overlap das
      worktrees vivas e serializa (R-XAGENT-03 intacto) só DENTRO de componentes
      conexos, integrando componentes disjuntos em qualquer ordem; disjunção
      textual é sound mas não build-safe, então cada merge ainda re-verifica na
      primária. Octopus e projeção de trunk ficam fora da v1.
    dependsOn:
      - F1
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: "Classificador: footprints disjuntos caem em componentes separados,
            coupling file compartilhado une, componentes conexos detectados,
            rename expande footprint; suite verde."
          status: pending
          verifier:
            kind: test
            runner: node
            pattern: tests/worktree-footprint.test.js
        - id: G-2
          description: worktree-isolation.md documenta série-dentro-do-componente +
            ordem-livre-entre-componentes (R-XAGENT-03 intacto por componente);
            skills válidos.
          status: pending
          verifier:
            kind: shell
            command: npm run validate-skills
    status: pending
    summary: Classificador de footprint decide o que serializa junto e o que integra
      em qualquer ordem.
  - id: F3
    slug: worktree-lifecycle-finalization-f3-backstop-read-only-no-projec
    title: Backstop read-only no project verify (Decisão 5)
    goal: "adicionar um check read-only de backstop ao `project verify` (slot #9,
      após os 8 atuais) que deriva live de `git worktree list --porcelain` +
      `merge-base` + status do plano e sinaliza em WARN os estados órfãos, sem
      flag no `focus.json`, sem hook e sem campo de schema novo."
    dependsOn:
      - F2
    subPhaseCount: 1
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: Backstop sinaliza WARN para worktree órfã e branch arquivada à
            frente; read-only, inputs não mutados; suite verde.
          status: pending
          verifier:
            kind: test
            runner: node
            pattern: tests/detect-orphan-worktrees.test.js
        - id: G-2
          description: "project verify lista o check #9 e validate-skills passa."
          status: pending
          verifier:
            kind: shell
            command: npm run validate-skills
    status: pending
    summary: project verify avisa (WARN) worktrees órfãs de planos arquivados.
references: []
planActive: true
planTitle: Finalização do ciclo de vida da worktree-do-plano
---

# Finalização do ciclo de vida da worktree-do-plano

## 1. Context

Fecha o ciclo de vida da `plan/<slug>` worktree: hoje o nascimento da branch (criação do plano, Stage 6) e a materialização da worktree (`implement` Step 0.5) são pontos distintos, mas nada fecha o FIM — um plano arquivado deixa branch viva não-mergeada e worktree registrada (`verified_by: skills/shared/worktree-isolation.md:38` — "a `git worktree remove` of a tree with un-merged commits discards them silently"). O painel adversarial derrubou a premissa de "finalize simétrico estilo feature branch": uma `plan/<slug>` é bookkeeping de foco com commits interleaved, NÃO uma branch cujo telos é mergear na trunk. A abordagem escolhida (C, híbrido reenquadrado) ataca a raiz no Stage 6 (a branch só nasce sob concorrência), separa arquivamento lógico de teardown da worktree (ambos operator-prompted), fixa o invariante de não-perda onde o teardown ocorre, torna a integração topology-aware (série só dentro de componentes conexos do grafo de footprint, ordem-livre entre componentes disjuntos), e adiciona o menor mecanismo de memória (relatório WARN read-only). Design aprovado: `.atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/design.md`.

## 2. Inviolable principles

- **P1 Branch nasce sob concorrência, não na criação incondicional** — O lever de decisão de branch é o Stage 6 single-focus pre-flight (`verified_by: skills/shared/project-assets/project-create-plan.md`), NÃO o Step 0.5 nem o `emit-focus` (cujo `multipleActivePlans` é pós-colisão e read-only, `verified_by: scripts/emit-focus.js` pickFocus). Plano solo permanece `branch: null` na árvore atual; forka `plan/<slug>` só quando a criação já encontra ≥1 plano ativo.
- **P2 Arquivamento lógico e teardown da worktree são lifecycles separados** — O `archive` flipa `status: archived` com zero efeito git, como hoje (`verified_by: skills/shared/project-assets/project-transitions.md` archive). O teardown da worktree é uma oferta NOVA e adjacente, nunca parte do flip de status. Arquivar-mas-não-mergear é o estado normal aqui. Ambos operator-prompted.
- **P3 Nunca remover trabalho não-provado-integrado; em indeterminação, bloquear** — O teardown só remove quando um check prova integração (`git merge-base --is-ancestor plan/<slug> <base>`). Em indeterminação (origin ausente/stale, base irresolúvel) o check trata como não-mergeado e BLOQUEIA — a falha segura over-bloqueia, nunca over-deleta. Nunca `rm -rf`; nunca `-D`/`--force` por default; `git branch -d` (minúsculo) é a 2ª guarda nativa.
- **P4 Backstop é relatório read-only, sem novo estado persistente** — O check de backstop é read-only e sinaliza em WARN; deriva live de `git worktree list --porcelain` + `merge-base` + status do plano. Sem flag nova no `focus.json`, sem hook que deleta, sem campo de schema novo. Promoção a FAIL fica como gatilho de evidência futura, não v1.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Self-review against code-quality gates

- **G1 read-before-claim**: claims sobre código existente citam arquivo lido nesta sessão (project-create-plan.md Stage 6, implement.md Step 0.5/:97, emit-focus.js pickFocus, bind-plan-branch.js stampBranch, worktree-isolation.md :38/:47-57, project-transitions.md archive, project-verify.md checks, parallel-dispatch.md:76-77). Verificadas por dois reviewers independentes (critic do design + review interna).
- **G2 soft-language**: varrido o plano + iniciativas para should/probably/may/typically/usually e PT deveria/provavelmente/talvez em posição de asserção; 0 ocorrências (o único "should" é o identificador `shouldForkPlanBranch`).
- **G6 reference-or-strike**: asserções de prosa carregam `verified_by:`; o prior-art topology-aware carrega URL (design §References). Findings sem evidência foram descartados (ex.: three-dot footprint — `git diff base...branch` é mudanças-desde-merge-base, não diferença simétrica).

## Reviews

- **Interna (review-plan --mode=internal)**: 2 majors + 3 minors na 1ª passada → todos resolvidos; re-review limpa (0 blockers/majors/minors).
- **Critic do design (gate actor-critic)**: `approve`, 0 blockers/criticals (5 âncoras de evidência spot-checked).
- **Cross-model Codex (review-plan --mode=codex)**: `needs_changes`, 1 critical + 4 majors (1 dropped, 4 maintained, 1 emerged) → **todos os 5 aplicados** ao plano. Detalhe + briefings: [`.atomic-skills/reviews/2026-06-16-1539-worktree-lifecycle-finalization.md`](../../../reviews/2026-06-16-1539-worktree-lifecycle-finalization.md).
