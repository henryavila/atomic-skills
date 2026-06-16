---
date: 2026-06-16T15:39:00Z
topic: worktree-lifecycle-finalization
artifact: .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md
skill: review-plan
reviewer: gpt-5-codex
codex_version: codex-cli 0.139.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
framing_delta: {dropped: 1, maintained: 4, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — worktree-lifecycle-finalization

Mode: codex (two-pass sealed envelope). All 5 final findings were APPLIED to the plan in this session (see Fixes applied).

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has viable high-level constraints, but several phase gates leave unsafe or divergent behavior unspecified. The largest risk is F0’s retroactive branch/worktree creation: it changes the default to `branch: null` and then later tries to reconstruct an isolated worktree for the pre-existing plan without defining the exact source ref or ordering.

The remaining findings are coverage and ambiguity gaps that can let phases pass while the implementation still mishandles common states: absent plan branches, stale base refs, unenforced per-merge verification, and an undefined coupling-file set.

## Findings

### F-001 [critical] viability — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:73-76

**Evidence:**
```yaml
    goal: "tornar `branch: null` na árvore atual o DEFAULT para um plano solo no
      Stage 6, forkando `plan/<slug>` só sob concorrência; e materializar
      retroativamente a worktree do plano pré-existente quando um 2º plano o
      torna concorrente."
```

**Claim:** Retroactive worktree creation is underspecified because the plan does not define the exact commit/ref used for the pre-existing plan before the second plan mutates the tree.

**Impact:** The retroactive `plan/<old>` branch can be created from the wrong `HEAD`, contaminating the old plan’s worktree with the incoming plan’s files or losing the original isolation boundary.

**Recommendation:** Add an F0 task/gate that captures the pre-existing plan’s source ref before writing the new plan, blocks if that ref cannot be resolved, and tests that the retroactive worktree excludes the incoming plan artifacts.

**Confidence:** high

---

### F-002 [major] contradiction — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:28-51

**Evidence:**
```yaml
  - id: P3
    title: Nunca remover trabalho não-provado-integrado; em indeterminação, bloquear
    body: O teardown só remove quando um check prova integração (`git merge-base
      --is-ancestor plan/<slug> <base>`). Em indeterminação (origin
      ausente/stale, base irresolúvel) o check trata como não-mergeado e
      BLOQUEIA — a falha segura over-bloqueia, nunca over-deleta. Nunca `rm
      -rf`; nunca `-D`/`--force` por default; `git branch -d` (minúsculo) é a 2ª
      guarda nativa.
```

**Claim:** The safety rule says stale origin state blocks teardown, but the base-ref ladder only names refs and does not require a fetch/freshness check before treating `origin/main` as authoritative.

**Impact:** A stale local `origin/main` can make the teardown decision against an obsolete integration base, either blocking valid cleanup indefinitely or allowing cleanup after a ref that no longer represents trunk.

**Recommendation:** Amend F1 to require `resolveBaseRef` to attempt/verify a fresh `origin/main` when an origin exists, return indeterminate on fetch/freshness failure, and cover stale/fetch-failure cases in `tests/worktree-teardown.test.js`.

**Confidence:** medium

---

### F-003 [major] coverage gap — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:15-20

**Evidence:**
```yaml
    body: "O lever de decisão de branch é o Stage 6 single-focus pre-flight
      (`verified_by: skills/shared/project-assets/project-create-plan.md`), NÃO
      o Step 0.5 nem o `emit-focus` (cujo `multipleActivePlans` é pós-colisão e
      read-only, `verified_by: scripts/emit-focus.js` pickFocus). Plano solo
      permanece `branch: null` na árvore atual; forka `plan/<slug>` só quando a
      criação já encontra ≥1 plano ativo."
```

**Claim:** The plan makes `branch: null` the default state but does not specify how F1 teardown behaves when an archived plan has no `plan/<slug>` branch or worktree.

**Impact:** The archive-adjacent teardown can call `merge-base` or `git branch -d` on a missing branch, producing errors or permanent blocking for the default solo-plan path.

**Recommendation:** Add F1 acceptance criteria and tests for `branch: null` and absent-worktree plans: no teardown prompt or an explicit “nothing to remove” outcome, with archive status still flipping without git effects.

**Confidence:** high

---

### F-004 [major] coverage gap — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:133-161

**Evidence:**
```yaml
    goal: substituir a regra "sempre serial" por integração topology-aware — um
      classificador de disjunção por footprint constrói o grafo de overlap das
      worktrees vivas e serializa (R-XAGENT-03 intacto) só DENTRO de componentes
      conexos, integrando componentes disjuntos em qualquer ordem; disjunção
      textual é sound mas não build-safe, então cada merge ainda re-verifica na
      primária. Octopus e projeção de trunk ficam fora da v1.
```

**Claim:** F2 requires primary-branch re-verification after each merge, but its gates only cover the classifier and documentation validation, not enforcement of the merge/re-verify sequence.

**Impact:** The phase can pass while the actual integration workflow permits order-free merges without the required post-merge verifier, allowing build-breaking changes to be treated as integrated.

**Recommendation:** Add an F2 gate that validates the merge-back procedure contains the sequence “merge one component item → re-run verifier on primary → only then mark done/remove,” and test or grep that sequence in the modified skill files.

**Confidence:** high

---

### F-005 [major] ambiguity — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:66-68

**Evidence:**
```yaml
  - term: coupling file
    definition: arquivo que serializa mesmo com footprint disjunto (lockfiles,
      gerados, migrations); vira aresta global no grafo de footprint.
```

**Claim:** The coupling-file rule is not implementable deterministically because the plan gives categories but no concrete v1 path/pattern set.

**Impact:** Two implementations can classify the same worktrees differently, causing one to serialize a component while another allows order-free integration for lockfiles, generated outputs, or migrations.

**Recommendation:** Define the exact v1 coupling-file constants or glob patterns in F2 and require tests for each declared category.

**Confidence:** high

## Questions (non-findings)

- None

## Out of scope

- Automated merge to main, octopus merge, projected-trunk validation, batch bisection, dedicated integration branch, focus.json orphan state, squash patch-id detection, finalize command, and WARN-only backstop behavior were not reviewed.

## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The plan still leaves implementation paths that can pass the stated gates while producing unsafe or divergent behavior. The highest-risk gap remains F0 retroactive materialization: changing solo plans to `branch: null` and later reconstructing the first plan's branch/worktree is not tied to a defined source ref or mutation order.

The revealed constraints drop the stale-origin finding because the artifact already names a fetched `origin/main` and stale-state blocking. They also expose a new gate weakness: `npm run validate-skills` cannot prove skill-body workflow or prose changes, yet several gates use it as the verifier for those behaviors.

## Findings

### F-001 [critical] viability — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:73-76

**Evidence:**
```yaml
    goal: "tornar `branch: null` na árvore atual o DEFAULT para um plano solo no
      Stage 6, forkando `plan/<slug>` só sob concorrência; e materializar
      retroativamente a worktree do plano pré-existente quando um 2º plano o
      torna concorrente."
```

**Claim:** Retroactive worktree creation is underspecified because the plan does not define the exact commit/ref used for the pre-existing plan before the second plan mutates the tree.

**Impact:** The retroactive `plan/<old>` branch can be created from the wrong `HEAD`, contaminating the old plan’s worktree with the incoming plan’s files or losing the original isolation boundary.

**Recommendation:** Add an F0 task/gate that captures the pre-existing plan’s source ref before writing the new plan, blocks if that ref cannot be resolved, and tests that the retroactive worktree excludes the incoming plan artifacts.

**Confidence:** high

---

### F-002 [major] coverage gap — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:15-20

**Evidence:**
```yaml
    body: "O lever de decisão de branch é o Stage 6 single-focus pre-flight
      (`verified_by: skills/shared/project-assets/project-create-plan.md`), NÃO
      o Step 0.5 nem o `emit-focus` (cujo `multipleActivePlans` é pós-colisão e
      read-only, `verified_by: scripts/emit-focus.js` pickFocus). Plano solo
      permanece `branch: null` na árvore atual; forka `plan/<slug>` só quando a
      criação já encontra ≥1 plano ativo."
```

**Claim:** The plan makes `branch: null` the default state but does not specify how F1 teardown behaves when an archived plan has no `plan/<slug>` branch or worktree.

**Impact:** The archive-adjacent teardown can call `merge-base` or `git branch -d` on a missing branch, producing errors or permanent blocking for the default solo-plan path.

**Recommendation:** Add F1 acceptance criteria and tests for `branch: null` and absent-worktree plans: no teardown prompt or an explicit “nothing to remove” outcome, with archive status still flipping without git effects.

**Confidence:** high

---

### F-003 [major] coverage gap — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:133-161

**Evidence:**
```yaml
    goal: substituir a regra "sempre serial" por integração topology-aware — um
      classificador de disjunção por footprint constrói o grafo de overlap das
      worktrees vivas e serializa (R-XAGENT-03 intacto) só DENTRO de componentes
      conexos, integrando componentes disjuntos em qualquer ordem; disjunção
      textual é sound mas não build-safe, então cada merge ainda re-verifica na
      primária. Octopus e projeção de trunk ficam fora da v1.
```

**Claim:** F2 requires primary-branch re-verification after each merge, but its gates only cover the classifier and documentation validation, not enforcement of the merge/re-verify sequence.

**Impact:** The phase can pass while the actual integration workflow permits order-free merges without the required post-merge verifier, allowing build-breaking changes to be treated as integrated.

**Recommendation:** Add an F2 gate that validates the merge-back procedure in both existing R-XAGENT-03 locations, including `skills/core/implement.md`, contains the sequence “merge one component item → re-run verifier on primary → only then mark done/remove.”

**Confidence:** high

---

### F-004 [major] ambiguity — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:66-68

**Evidence:**
```yaml
  - term: coupling file
    definition: arquivo que serializa mesmo com footprint disjunto (lockfiles,
      gerados, migrations); vira aresta global no grafo de footprint.
```

**Claim:** The coupling-file rule is not implementable deterministically because the plan gives categories but no concrete v1 path/pattern set.

**Impact:** Two implementations can classify the same worktrees differently, causing one to serialize a component while another allows order-free integration for lockfiles, generated outputs, or migrations.

**Recommendation:** Define the exact v1 coupling-file constants or glob patterns in F2 and require tests for each declared category.

**Confidence:** high

---

### F-005 [major] coverage gap — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:120-126

**Evidence:**
```yaml
        - id: G-2
          description: Oferta de teardown adjacente ao archive presente; flip de status
            segue zero-git; skills válidos.
          status: pending
          verifier:
            kind: shell
            command: npm run validate-skills
```

**Claim:** Gates that require skill-body workflow changes are unverifiable as written because `npm run validate-skills` validates the skill catalog/schema, not the prose or command sequence inside skill bodies.

**Impact:** F1, F2, and F3 can pass their G-2 gates while the archive teardown offer, topology-aware workflow prose, or `project verify` check listing is missing from the actual skill text.

**Recommendation:** Replace each behavior-bearing `validate-skills`-only gate with a concrete verifier for the relevant file content or command behavior, and keep `validate-skills` only as an additional catalog/schema check.

**Confidence:** high

## Questions (non-findings)

- None

## Out of scope

- Automated merge to main, octopus merge, projected-trunk validation, batch bisection, dedicated integration branch, focus.json orphan state, squash patch-id detection, finalize command, and WARN-only backstop behavior were not reviewed.

## Pass 2 reconciliation

### Dropped from blind pass

- F-002-blind [major] contradiction — DROPPED: the artifact’s own base-ref ladder already specifies fetched `origin/main`, and P3 already treats stale origin state as indeterminate/blocking.

### Maintained

- F-001-blind → F-001-final [critical] — same
- F-003-blind → F-002-final [major] — same
- F-004-blind → F-003-final [major] — same
- F-005-blind → F-004-final [major] — same

### Emerged

- F-005-final [major] coverage gap — emerged: the external constraint states `npm run validate-skills` validates the skill catalog/schema, not skill-body prose content.

## Briefings used

<details>
<summary>Pass 1 briefing</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Non-goals (factual, no rationale)

- No automated merge to main (no auto-rebase, cron, or hook).
- No octopus-merge in v1.
- No projected-trunk validation or batch bisection in v1.
- No dedicated integration branch.
- No new focus.json flag or schema field for orphan state.
- No squash-merge patch-id detection in v1.
- No dedicated project finalize command in v1.
- Backstop check is WARN-only in v1.

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Artifact to review

Path: .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md

---BEGIN ARTIFACT---
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


---INITIATIVE DETAIL (context only)---

---INITIATIVE F0: worktree-lifecycle-finalization-f0-nascimento-da-branch-sob-con (file: phases/f0-nascimento-da-branch-sob-con.md)---
Tasks: T-001 Política determinística de fork de branch | T-002 Worktree retroativa para o plano pré-existente
Exit gates: G-1 Fork determinístico: solo retorna branch:null, concorrência retorna plan/<slug>; | G-2 emit-focus permanece intacto — Decisão 1 não depende dele (testes de focus verde
Scope: not declared
---END INITIATIVE F0---
---INITIATIVE F1: worktree-lifecycle-finalization-f1-teardown-seguro-oferta-adjac (file: phases/f1-teardown-seguro-oferta-adjac.md)---
Tasks: T-001 Invariante de não-perda com base-ref ladder | T-002 Oferta de teardown operator-prompted adjacente ao archive
Exit gates: G-1 Invariante prova integração antes de remover; indeterminação bloqueia; sem -D/-- | G-2 Oferta de teardown adjacente ao archive presente; flip de status segue zero-git;
Scope: not declared
---END INITIATIVE F1---
---INITIATIVE F2: worktree-lifecycle-finalization-f2-integracao-topology-aware-cl (file: phases/f2-integracao-topology-aware-cl.md)---
Tasks: T-001 Classificador de disjunção por footprint | T-002 Fiação topology-aware: série dentro do componente, ordem-livre entre componentes
Exit gates: G-1 Classificador: footprints disjuntos caem em componentes separados, coupling file | G-2 worktree-isolation.md documenta série-dentro-do-componente + ordem-livre-entre-c
Scope: not declared
---END INITIATIVE F2---
---INITIATIVE F3: worktree-lifecycle-finalization-f3-backstop-read-only-no-projec (file: phases/f3-backstop-read-only-no-projec.md)---
Tasks: T-001 Check de backstop de worktree órfã
Exit gates: G-1 Backstop sinaliza WARN para worktree órfã e branch arquivada à frente; read-only | G-2 project verify lista o check #9 e validate-skills passa.
Scope: not declared
---END INITIATIVE F3---

---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

# Required Output Format — Pass 1 (Blind)

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

## Format rules

- `<lang>` in Evidence fence: use the language of the file (`js`, `ts`, `py`, `md`, `yaml`). If unknown, leave blank.
- IDs must match regex `F-\d{3}` (e.g. `F-001`, not `F-1`, not `F-001-blind`). The `-blind` suffix is added by Pass 2 reconciliation if needed.
- Severity enum: `blocker | critical | major | minor | nit`. No other values.
- Confidence enum: `high | medium | low`. No other values.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space (no items).

## Forbidden

- Markdown other than the template above.
- Bullet lists summarizing findings outside the per-finding structure.
- "What works well" sections.
- Praise or hedging ("the author probably intends...").
- Multiple verdicts.
- Multiple frontmatter blocks.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above

Begin review now.
```

</details>

<details>
<summary>Pass 2 briefing</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Non-goals (factual, no rationale)

- No automated merge to main (no auto-rebase, cron, or hook).
- No octopus-merge in v1.
- No projected-trunk validation or batch bisection in v1.
- No dedicated integration branch.
- No new focus.json flag or schema field for orphan state.
- No squash-merge patch-id detection in v1.
- No dedicated project finalize command in v1.
- Backstop check is WARN-only in v1.

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Artifact to review

Path: .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md

---BEGIN ARTIFACT---
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


---INITIATIVE DETAIL (context only)---

---INITIATIVE F0: worktree-lifecycle-finalization-f0-nascimento-da-branch-sob-con (file: phases/f0-nascimento-da-branch-sob-con.md)---
Tasks: T-001 Política determinística de fork de branch | T-002 Worktree retroativa para o plano pré-existente
Exit gates: G-1 Fork determinístico: solo retorna branch:null, concorrência retorna plan/<slug>; | G-2 emit-focus permanece intacto — Decisão 1 não depende dele (testes de focus verde
Scope: not declared
---END INITIATIVE F0---
---INITIATIVE F1: worktree-lifecycle-finalization-f1-teardown-seguro-oferta-adjac (file: phases/f1-teardown-seguro-oferta-adjac.md)---
Tasks: T-001 Invariante de não-perda com base-ref ladder | T-002 Oferta de teardown operator-prompted adjacente ao archive
Exit gates: G-1 Invariante prova integração antes de remover; indeterminação bloqueia; sem -D/-- | G-2 Oferta de teardown adjacente ao archive presente; flip de status segue zero-git;
Scope: not declared
---END INITIATIVE F1---
---INITIATIVE F2: worktree-lifecycle-finalization-f2-integracao-topology-aware-cl (file: phases/f2-integracao-topology-aware-cl.md)---
Tasks: T-001 Classificador de disjunção por footprint | T-002 Fiação topology-aware: série dentro do componente, ordem-livre entre componentes
Exit gates: G-1 Classificador: footprints disjuntos caem em componentes separados, coupling file | G-2 worktree-isolation.md documenta série-dentro-do-componente + ordem-livre-entre-c
Scope: not declared
---END INITIATIVE F2---
---INITIATIVE F3: worktree-lifecycle-finalization-f3-backstop-read-only-no-projec (file: phases/f3-backstop-read-only-no-projec.md)---
Tasks: T-001 Check de backstop de worktree órfã
Exit gates: G-1 Backstop sinaliza WARN para worktree órfã e branch arquivada à frente; read-only | G-2 project verify lista o check #9 e validate-skills passa.
Scope: not declared
---END INITIATIVE F3---

---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

# Required Output Format — Pass 1 (Blind)

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

## Format rules

- `<lang>` in Evidence fence: use the language of the file (`js`, `ts`, `py`, `md`, `yaml`). If unknown, leave blank.
- IDs must match regex `F-\d{3}` (e.g. `F-001`, not `F-1`, not `F-001-blind`). The `-blind` suffix is added by Pass 2 reconciliation if needed.
- Severity enum: `blocker | critical | major | minor | nit`. No other values.
- Confidence enum: `high | medium | low`. No other values.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space (no items).

## Forbidden

- Markdown other than the template above.
- Bullet lists summarizing findings outside the per-finding structure.
- "What works well" sections.
- Praise or hedging ("the author probably intends...").
- Multiple verdicts.
- Multiple frontmatter blocks.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above


## External constraints (verifiable)

The constraints below are verifiable externally. Each line includes how to
verify if needed. Treat as ground truth.

- Target runtime: Node >= 18 (verify: package.json "engines").
- Test runner: node --test over tests/**/*.test.js (verify: package.json scripts.test).
- State files validate against meta/schemas/ via npm run validate-state (schemaVersion 0.1/0.2).
- npm run validate-skills validates the skill catalog/schema, NOT skill-body prose content (verify: scripts/validate-skills.js).
- The serial merge-back rule R-XAGENT-03 already exists in skills/shared/worktree-isolation.md and skills/core/implement.md.
- scripts/bind-plan-branch.js (stampBranch/bindPlanBranch) already stamps a plan branch and re-emits focus.

## Pass 1 (blind) findings

The following findings were produced by your previous review WITHOUT the
constraints above. Re-evaluate each against the constraints.

---BEGIN PASS 1 OUTPUT---
---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has viable high-level constraints, but several phase gates leave unsafe or divergent behavior unspecified. The largest risk is F0’s retroactive branch/worktree creation: it changes the default to `branch: null` and then later tries to reconstruct an isolated worktree for the pre-existing plan without defining the exact source ref or ordering.

The remaining findings are coverage and ambiguity gaps that can let phases pass while the implementation still mishandles common states: absent plan branches, stale base refs, unenforced per-merge verification, and an undefined coupling-file set.

## Findings

### F-001 [critical] viability — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:73-76

**Evidence:**
```yaml
    goal: "tornar `branch: null` na árvore atual o DEFAULT para um plano solo no
      Stage 6, forkando `plan/<slug>` só sob concorrência; e materializar
      retroativamente a worktree do plano pré-existente quando um 2º plano o
      torna concorrente."
```

**Claim:** Retroactive worktree creation is underspecified because the plan does not define the exact commit/ref used for the pre-existing plan before the second plan mutates the tree.

**Impact:** The retroactive `plan/<old>` branch can be created from the wrong `HEAD`, contaminating the old plan’s worktree with the incoming plan’s files or losing the original isolation boundary.

**Recommendation:** Add an F0 task/gate that captures the pre-existing plan’s source ref before writing the new plan, blocks if that ref cannot be resolved, and tests that the retroactive worktree excludes the incoming plan artifacts.

**Confidence:** high

---

### F-002 [major] contradiction — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:28-51

**Evidence:**
```yaml
  - id: P3
    title: Nunca remover trabalho não-provado-integrado; em indeterminação, bloquear
    body: O teardown só remove quando um check prova integração (`git merge-base
      --is-ancestor plan/<slug> <base>`). Em indeterminação (origin
      ausente/stale, base irresolúvel) o check trata como não-mergeado e
      BLOQUEIA — a falha segura over-bloqueia, nunca over-deleta. Nunca `rm
      -rf`; nunca `-D`/`--force` por default; `git branch -d` (minúsculo) é a 2ª
      guarda nativa.
```

**Claim:** The safety rule says stale origin state blocks teardown, but the base-ref ladder only names refs and does not require a fetch/freshness check before treating `origin/main` as authoritative.

**Impact:** A stale local `origin/main` can make the teardown decision against an obsolete integration base, either blocking valid cleanup indefinitely or allowing cleanup after a ref that no longer represents trunk.

**Recommendation:** Amend F1 to require `resolveBaseRef` to attempt/verify a fresh `origin/main` when an origin exists, return indeterminate on fetch/freshness failure, and cover stale/fetch-failure cases in `tests/worktree-teardown.test.js`.

**Confidence:** medium

---

### F-003 [major] coverage gap — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:15-20

**Evidence:**
```yaml
    body: "O lever de decisão de branch é o Stage 6 single-focus pre-flight
      (`verified_by: skills/shared/project-assets/project-create-plan.md`), NÃO
      o Step 0.5 nem o `emit-focus` (cujo `multipleActivePlans` é pós-colisão e
      read-only, `verified_by: scripts/emit-focus.js` pickFocus). Plano solo
      permanece `branch: null` na árvore atual; forka `plan/<slug>` só quando a
      criação já encontra ≥1 plano ativo."
```

**Claim:** The plan makes `branch: null` the default state but does not specify how F1 teardown behaves when an archived plan has no `plan/<slug>` branch or worktree.

**Impact:** The archive-adjacent teardown can call `merge-base` or `git branch -d` on a missing branch, producing errors or permanent blocking for the default solo-plan path.

**Recommendation:** Add F1 acceptance criteria and tests for `branch: null` and absent-worktree plans: no teardown prompt or an explicit “nothing to remove” outcome, with archive status still flipping without git effects.

**Confidence:** high

---

### F-004 [major] coverage gap — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:133-161

**Evidence:**
```yaml
    goal: substituir a regra "sempre serial" por integração topology-aware — um
      classificador de disjunção por footprint constrói o grafo de overlap das
      worktrees vivas e serializa (R-XAGENT-03 intacto) só DENTRO de componentes
      conexos, integrando componentes disjuntos em qualquer ordem; disjunção
      textual é sound mas não build-safe, então cada merge ainda re-verifica na
      primária. Octopus e projeção de trunk ficam fora da v1.
```

**Claim:** F2 requires primary-branch re-verification after each merge, but its gates only cover the classifier and documentation validation, not enforcement of the merge/re-verify sequence.

**Impact:** The phase can pass while the actual integration workflow permits order-free merges without the required post-merge verifier, allowing build-breaking changes to be treated as integrated.

**Recommendation:** Add an F2 gate that validates the merge-back procedure contains the sequence “merge one component item → re-run verifier on primary → only then mark done/remove,” and test or grep that sequence in the modified skill files.

**Confidence:** high

---

### F-005 [major] ambiguity — .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md:66-68

**Evidence:**
```yaml
  - term: coupling file
    definition: arquivo que serializa mesmo com footprint disjunto (lockfiles,
      gerados, migrations); vira aresta global no grafo de footprint.
```

**Claim:** The coupling-file rule is not implementable deterministically because the plan gives categories but no concrete v1 path/pattern set.

**Impact:** Two implementations can classify the same worktrees differently, causing one to serialize a component while another allows order-free integration for lockfiles, generated outputs, or migrations.

**Recommendation:** Define the exact v1 coupling-file constants or glob patterns in F2 and require tests for each declared category.

**Confidence:** high

## Questions (non-findings)

- None

## Out of scope

- Automated merge to main, octopus merge, projected-trunk validation, batch bisection, dedicated integration branch, focus.json orphan state, squash patch-id detection, finalize command, and WARN-only backstop behavior were not reviewed.
---END PASS 1 OUTPUT---

## Your task in this pass

1. Re-evaluate ALL findings from Pass 1 against the External Constraints.
   For EACH Pass 1 finding, decide one of:
   - **DROP** — finding is invalid given a constraint or non-goal
   - **MAINTAIN** — finding stands, severity unchanged
   - **REFINE** — finding stands but severity changes

2. Identify NEW findings that emerge ONLY because of these constraints
   (e.g. the artifact violates a constraint you couldn't see in Pass 1).

3. Output the FULL final findings list (use new sequential IDs starting at
   F-001) plus a complete `## Pass 2 reconciliation` block.

## Output format

# Required Output Format — Pass 2 (Informed)

Same template as Pass 1 PLUS an obligatory `## Pass 2 reconciliation` block.
You MUST respond in this exact structure.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id>
pass: informed
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words>

## Findings

### F-001 [<severity>] <category> — <file>:<line>

**Evidence:** <...>
**Claim:** <...>
**Impact:** <...>
**Recommendation:** <...>
**Confidence:** <...>

---

### F-002 ... (final IDs — these are the post-constraints findings)

## Questions (non-findings)

- <file>:<line> — <question>

## Out of scope

- <item>

## Pass 2 reconciliation

### Dropped from blind pass

<For each Pass 1 finding you are dropping, write one line:>

- F-001-blind [<severity>] <category> — DROPPED: <one-sentence reason citing
  which constraint or non-goal makes it invalid>

<If no drops: write `- _(none)_`>

### Maintained

<For each Pass 1 finding kept (with or without severity change):>

- F-002-blind → F-001-final [<severity>] — <same | severity changed: was X, now Y>

<If no maintained: write `- _(none)_`>

### Emerged

<For each NEW finding that surfaced only because constraints were revealed:>

- F-XXX-final [<severity>] <category> — emerged: <one-sentence reason citing
  the constraint that triggered the finding>

<If no emerged: write `- _(none)_`>
````

## Rules specific to Pass 2

- Final findings use sequential IDs `F-001, F-002, ...` (no `-final` suffix in the `## Findings` section — only in reconciliation references).
- In reconciliation, refer to blind findings with `-blind` suffix and maintained mappings with `→ F-XXX-final`.
- `counts` is the COUNT OF FINAL findings (post-reconciliation), not blind.
- `pass: informed` (literal).
- All universal rules from `output-template-pass1.md` apply.

Begin reconciliation now.
```

</details>

## Fixes applied in this session

- **F-001 (critical) → APPLIED.** F0-T-002: `retroactiveWorktreeAdd({slug, baseRef})` agora exige um baseRef capturado antes da escrita do plano entrante, BLOQUEIA se irresolúvel, e semeia a worktree desse ref (exclui artefatos do entrante). Stage 6 captura o source-ref antes de escrever.
- **F-002 (major) → APPLIED.** F1-T-001/T-002: caso branch `null`/sem worktree retorna `nothing-to-remove` (sem merge-base/branch -d em branch inexistente, sem bloqueio/erro); archive segue zero-git. Coberto por teste + âncora no archive.
- **F-003 (major) → APPLIED.** F2-T-002 + gate F2/G-2: a sequência por-componente `merge → re-verify na primária → só então done/remove` é documentada (âncora `per-component merge sequence`) e o gate faz grep dela em worktree-isolation.md + implement.md.
- **F-004 (major) → APPLIED.** F2-T-001: constante `COUPLING_FILES` com padrões v1 concretos (`package-lock.json`, `package.json`, `*.lock`) + teste por padrão; footprint fixado em `git diff --name-only base...branch` (três-pontos = mudanças da branch desde o merge-base).
- **F-005 (major, emerged) → APPLIED.** Gates G-2 de F1/F2/F3 trocaram `npm run validate-skills` puro por `grep <âncora> <arquivo> && npm run validate-skills`, então o gate prova a mudança de prosa no corpo do skill, não só o schema do catálogo.
