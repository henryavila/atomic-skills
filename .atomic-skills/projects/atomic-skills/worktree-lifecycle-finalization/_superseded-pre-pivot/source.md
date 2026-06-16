# Finalização do ciclo de vida da worktree-do-plano

Fecha o ciclo de vida da `plan/<slug>` worktree: hoje o nascimento da branch (criação do plano, Stage 6) e a materialização da worktree (`implement` Step 0.5) são pontos distintos, mas nada fecha o FIM — um plano arquivado deixa branch viva não-mergeada e worktree registrada (`verified_by: skills/shared/worktree-isolation.md:38` — "a `git worktree remove` of a tree with un-merged commits discards them silently"). O painel adversarial derrubou a premissa de "finalize simétrico estilo feature branch": uma `plan/<slug>` é bookkeeping de foco com commits interleaved, NÃO uma branch cujo telos é mergear na trunk. A abordagem escolhida (C, híbrido reenquadrado) ataca a raiz no Stage 6 (a branch só nasce sob concorrência), separa arquivamento lógico de teardown da worktree (ambos operator-prompted), fixa o invariante de não-perda onde o teardown ocorre, torna a integração topology-aware (série só dentro de componentes conexos do grafo de footprint, ordem-livre entre componentes disjuntos), e adiciona o menor mecanismo de memória (relatório WARN read-only). Design aprovado: `.atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/design.md`.

## Princípios invioláveis

### P1 Branch nasce sob concorrência, não na criação incondicional
O lever de decisão de branch é o Stage 6 single-focus pre-flight (`verified_by: skills/shared/project-assets/project-create-plan.md`), NÃO o Step 0.5 nem o `emit-focus` (cujo `multipleActivePlans` é pós-colisão e read-only, `verified_by: scripts/emit-focus.js` pickFocus). Plano solo permanece `branch: null` na árvore atual; forka `plan/<slug>` só quando a criação já encontra ≥1 plano ativo.

### P2 Arquivamento lógico e teardown da worktree são lifecycles separados
O `archive` flipa `status: archived` com zero efeito git, como hoje (`verified_by: skills/shared/project-assets/project-transitions.md` archive). O teardown da worktree é uma oferta NOVA e adjacente, nunca parte do flip de status. Arquivar-mas-não-mergear é o estado normal aqui. Ambos operator-prompted.

### P3 Nunca remover trabalho não-provado-integrado; em indeterminação, bloquear
O teardown só remove quando um check prova integração (`git merge-base --is-ancestor plan/<slug> <base>`). Em indeterminação (origin ausente/stale, base irresolúvel) o check trata como não-mergeado e BLOQUEIA — a falha segura over-bloqueia, nunca over-deleta. Nunca `rm -rf`; nunca `-D`/`--force` por default; `git branch -d` (minúsculo) é a 2ª guarda nativa.

### P4 Backstop é relatório read-only, sem novo estado persistente
O check de backstop é read-only e sinaliza em WARN; deriva live de `git worktree list --porcelain` + `merge-base` + status do plano. Sem flag nova no `focus.json`, sem hook que deleta, sem campo de schema novo. Promoção a FAIL fica como gatilho de evidência futura, não v1.

## Glossário

| Termo | Significado |
| --- | --- |
| **plan-branch** | branch `plan/<slug>`; bookkeeping de foco com commits interleaved, NÃO feature branch cujo telos é mergear na trunk. |
| **teardown** | remoção da worktree (e opcionalmente da branch via `git branch -d`) após arquivar, gated pelo invariante de não-perda. |
| **base-ref ladder** | ordem de resolução da base de integração: `origin/main` fetchado → `main` local → indeterminado (bloqueia). |
| **backstop** | check read-only no `project verify` que sinaliza órfãos (worktree viva de plano arquivado, branch arquivada à frente da base) em WARN. |
| **concorrência** | ≥1 plano `status: active` já existente no momento da criação de um novo plano; o gatilho que faz a branch nascer. |
| **footprint** | conjunto de arquivos que uma plan-worktree mudou, derivado de `git diff --name-only <base>...plan/<slug>`; rename `a→b` entra como união `{a,b}`. |
| **componente conexo** | grupo de worktrees ligadas por overlap de footprint (ou coupling file); a unidade de serialização — integra em série dentro, qualquer ordem entre componentes. |
| **coupling file** | arquivo que serializa mesmo com footprint disjunto (lockfiles, gerados, migrations); vira aresta global no grafo de footprint. |

## F0 — Nascimento da branch sob concorrência (Decisões 1+2)

**Objetivo:** tornar `branch: null` na árvore atual o DEFAULT para um plano solo no Stage 6, forkando `plan/<slug>` só sob concorrência; e materializar retroativamente a worktree do plano pré-existente quando um 2º plano o torna concorrente.

### Sub-fases (menu)

### T-001 Política determinística de fork de branch
- Files: `scripts/plan-branch-policy.js`, `tests/plan-branch-policy.test.js`, `skills/shared/project-assets/project-create-plan.md`
- scopeBoundary: NÃO tocar `scripts/emit-focus.js` (Decisão 1 não depende dele) nem `skills/core/implement.md` Step 0.5; NÃO alterar a assinatura de `materializeDecomposition`.
- acceptance: `shouldForkPlanBranch([])` retorna `false` (solo → sem fork); `shouldForkPlanBranch([umPlanoAtivo])` retorna `true` (concorrência → fork); `planBranchName('foo')` retorna `'plan/foo'`; o Stage 6 de `project-create-plan.md` declara `branch: null` como default explícito para plano solo.
- verifier: kind test runner node pattern `tests/plan-branch-policy.test.js`

### T-002 Worktree retroativa para o plano pré-existente
- Files: `scripts/plan-branch-policy.js`, `tests/plan-branch-policy.test.js`, `skills/shared/project-assets/project-create-plan.md`
- scopeBoundary: NÃO executar git real no teste (só compor o comando); NÃO mergear; NÃO re-tratar o plano entrante (o stamp do pré-existente já existe via `bindPlanBranch`, `verified_by: scripts/bind-plan-branch.js`); o source-ref do pré-existente é capturado ANTES de qualquer escrita do plano entrante.
- acceptance: `retroactiveWorktreeAdd({slug:'old', baseRef})` exige um `baseRef` capturado antes de qualquer escrita do plano entrante e devolve um comando que materializa `.worktrees/old` com branch `plan/old` semeada NESSE `baseRef` (nunca o HEAD pós-mutação, para a worktree retroativa não vazar artefatos do entrante); `retroactiveWorktreeAdd` BLOQUEIA (lança) quando `baseRef` é ausente/irresolúvel — falha segura, nunca semeia de um ref indefinido; o comando NUNCA inclui `--force`; o Stage 6 de `project-create-plan.md` captura o source-ref do pré-existente antes de escrever o plano entrante e liga a worktree retroativa a esse ref.
- verifier: kind test runner node pattern `tests/plan-branch-policy.test.js`

```yaml
exit_gate:
  - id: G-1
    description: "Fork determinístico: solo retorna branch:null, concorrência retorna plan/<slug>; worktree retroativa do pré-existente composta sem --force; suite verde."
    verifier: { kind: test, runner: node, pattern: tests/plan-branch-policy.test.js }
  - id: G-2
    description: "emit-focus permanece intacto — Decisão 1 não depende dele (testes de focus verdes)."
    verifier: { kind: shell, command: "node --test tests/focus-digest.test.js" }
```

## F1 — Teardown seguro + oferta adjacente ao archive (Decisões 3+4)

**Objetivo:** fixar o invariante machine-enforced de não-perda-de-trabalho no teardown (com base-ref ladder) e oferecer o teardown operator-prompted adjacente ao `archive`, sem alterar o flip de status (que continua zero efeito git).

### Sub-fases (menu)

### T-001 Invariante de não-perda com base-ref ladder
- Files: `scripts/worktree-teardown.js`, `tests/worktree-teardown.test.js`
- scopeBoundary: NÃO executar git destrutivo no teste; NÃO tocar o `archive` ainda (T-002 faz a fiação); a falha segura é BLOQUEAR, nunca over-deletar.
- acceptance: `resolveBaseRef` prefere `origin/main` fresco quando presente, cai para `main` local, e retorna `null` (indeterminado) quando nenhum resolve; `isTeardownSafe` bloqueia em base-ref indeterminada (`null`), bloqueia quando a branch não é ancestral da base, e libera só quando é ancestral E a base resolveu; um plano com branch ausente/`null` retorna `{ outcome: 'nothing-to-remove' }` — `isTeardownSafe` não invoca `merge-base`/`git branch -d` numa branch inexistente, não bloqueia e não erra; o módulo não contém token `-D`, `--force` nem `rm -rf`.
- verifier: kind test runner node pattern `tests/worktree-teardown.test.js`

### T-002 Oferta de teardown operator-prompted adjacente ao archive
- Files: `skills/shared/project-assets/project-transitions.md`
- scopeBoundary: NÃO automatizar; NÃO disparar integração de código no evento de arquivar; NÃO alterar o flip de status (continua `status: archived` com zero efeito git).
- acceptance: a seção `archive` preserva a frase de que o plano é arquivado in-place com zero efeito git; adiciona uma oferta de teardown operator-prompted ADJACENTE ao flip, gated pelo invariante de `scripts/worktree-teardown.js`; para um plano com branch `null`/sem worktree, a seção documenta o desfecho `nothing-to-remove` (sem prompt de teardown, flip de status ainda zero-git); `grep` confirma a âncora `worktree-teardown` e `npm run validate-skills` passa.
- verifier: kind shell command `grep -q 'worktree-teardown' skills/shared/project-assets/project-transitions.md && grep -qi 'nothing-to-remove' skills/shared/project-assets/project-transitions.md && npm run validate-skills`

```yaml
exit_gate:
  - id: G-1
    description: "Invariante prova integração antes de remover; indeterminação bloqueia; sem -D/--force/rm -rf; suite verde."
    verifier: { kind: test, runner: node, pattern: tests/worktree-teardown.test.js }
  - id: G-2
    description: "Oferta de teardown (âncora worktree-teardown) + desfecho nothing-to-remove presentes no archive; flip zero-git; skills válidos."
    verifier: { kind: shell, command: "grep -q 'worktree-teardown' skills/shared/project-assets/project-transitions.md && grep -qi 'nothing-to-remove' skills/shared/project-assets/project-transitions.md && npm run validate-skills" }
```

## F2 — Integração topology-aware: classificador de disjunção por footprint (Decisão 6)

**Objetivo:** substituir a regra "sempre serial" por integração topology-aware — um classificador de disjunção por footprint constrói o grafo de overlap das worktrees vivas e serializa (R-XAGENT-03 intacto) só DENTRO de componentes conexos, integrando componentes disjuntos em qualquer ordem; disjunção textual é sound mas não build-safe, então cada merge ainda re-verifica na primária. Octopus e projeção de trunk ficam fora da v1.

### Sub-fases (menu)

### T-001 Classificador de disjunção por footprint
- Files: `scripts/worktree-footprint.js`, `tests/worktree-footprint.test.js`
- scopeBoundary: função pura sobre diffs já capturados — NÃO executa merge nem git destrutivo no teste; NÃO octopus (v2); NÃO tocar a série R-XAGENT-03 em `worktree-isolation.md` (T-002 faz a fiação); `COUPLING_FILES` é constante no módulo, não config nova em `focus.json`.
- acceptance: `footprintOf` converte a saída de `git diff --name-only <base>...<branch>` (três-pontos = mudanças da branch desde o merge-base, não diferença simétrica) num conjunto de paths, e um rename `a→b` entra como união `{a,b}`; a constante `COUPLING_FILES` lista padrões v1 concretos deste repo — `package-lock.json`, `package.json` e qualquer `*.lock` — com ponto de extensão documentado; `buildFootprintGraph(worktrees)` cria aresta entre duas worktrees sse os footprints se intersectam OU ambas tocam um `COUPLING_FILES`; `connectedComponents` devolve os componentes — footprints disjuntos sem coupling file caem em componentes separados, e um coupling file compartilhado os une mesmo com footprint disjunto; há teste por padrão de coupling file declarado (`package-lock.json`, `package.json`, `*.lock`).
- verifier: kind test runner node pattern `tests/worktree-footprint.test.js`

### T-002 Fiação topology-aware: série dentro do componente, ordem-livre entre componentes
- Files: `skills/shared/worktree-isolation.md`, `skills/core/implement.md`
- scopeBoundary: NÃO automatizar merge→main; NÃO octopus (v2); NÃO alterar a série R-XAGENT-03 DENTRO de um componente (preservada intacta) — só adicionar a camada de componentes por cima; sem integration-branch dedicada.
- acceptance: `worktree-isolation.md` documenta série-dentro-do-componente-conexo e ordem-livre-entre-componentes-disjuntos (R-XAGENT-03 intacto por componente), incluindo a sequência por-componente `merge um item → re-verify na primária → só então done/remove`, com as âncoras `topology-aware integration` e `per-component merge sequence`; `worktree-isolation.md` registra que disjunção textual é sound mas não build-safe (cada merge re-verifica na primária), que rename expande o footprint, e alinha a guarda de `--force` ao invariante de não-perda (nunca por default); `implement.md` é reconciliado — o Red Flag que rejeita "disjoint → batch-merge" ganha um carve-out cross-referenciando o modelo topology-aware e deixa explícito que ordem-livre entre componentes não é merge paralelo nem batch-verify (a série + re-verify por merge continua), com a âncora `topology-aware merge ordering`; `npm run validate-skills` passa.
- verifier: kind shell command `grep -qi 'topology-aware integration' skills/shared/worktree-isolation.md && grep -qi 'per-component merge sequence' skills/shared/worktree-isolation.md && grep -qi 'topology-aware merge ordering' skills/core/implement.md && npm run validate-skills`

```yaml
exit_gate:
  - id: G-1
    description: "Classificador: footprints disjuntos caem em componentes separados, coupling file compartilhado une, componentes conexos detectados, rename expande footprint; suite verde."
    verifier: { kind: test, runner: node, pattern: tests/worktree-footprint.test.js }
  - id: G-2
    description: "worktree-isolation.md documenta série-no-componente + ordem-livre + a sequência per-component merge sequence; implement.md reconciliado; skills válidos."
    verifier: { kind: shell, command: "grep -qi 'topology-aware integration' skills/shared/worktree-isolation.md && grep -qi 'per-component merge sequence' skills/shared/worktree-isolation.md && grep -qi 'topology-aware merge ordering' skills/core/implement.md && npm run validate-skills" }
```

## F3 — Backstop read-only no project verify (Decisão 5)

**Objetivo:** adicionar um check read-only de backstop ao `project verify` (slot #9, após os 8 atuais) que deriva live de `git worktree list --porcelain` + `merge-base` + status do plano e sinaliza em WARN os estados órfãos, sem flag no `focus.json`, sem hook e sem campo de schema novo.

### Sub-fases (menu)

### T-001 Check de backstop de worktree órfã
- Files: `scripts/detect-orphan-worktrees.js`, `tests/detect-orphan-worktrees.test.js`, `skills/shared/project-assets/project-verify.md`
- scopeBoundary: read-only — NUNCA muta nem remove; SEM campo novo em `focus.json`; SEM hook; NÃO promover a FAIL (v1 é WARN); não tocar os 8 checks existentes.
- acceptance: `findOrphanWorktrees` sinaliza em WARN um plano `archived` cuja branch está à frente da base; sinaliza em WARN uma worktree viva de um plano `archived`; retorna vazio para um estado limpo/ativo; nunca muta os inputs (função pura sobre worktrees parseadas + status de planos + predicado de ancestralidade injetado); `project-verify.md` lista o check #9 após os 8 atuais.
- verifier: kind test runner node pattern `tests/detect-orphan-worktrees.test.js`

```yaml
exit_gate:
  - id: G-1
    description: "Backstop sinaliza WARN para worktree órfã e branch arquivada à frente; read-only, inputs não mutados; suite verde."
    verifier: { kind: test, runner: node, pattern: tests/detect-orphan-worktrees.test.js }
  - id: G-2
    description: "project-verify.md lista o check #9 (âncora detect-orphan-worktrees) e validate-skills passa."
    verifier: { kind: shell, command: "grep -q 'detect-orphan-worktrees' skills/shared/project-assets/project-verify.md && npm run validate-skills" }
```
