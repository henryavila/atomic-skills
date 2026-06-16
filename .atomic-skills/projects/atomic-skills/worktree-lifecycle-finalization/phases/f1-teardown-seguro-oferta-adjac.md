---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f1-teardown-seguro-oferta-adjac
title: Teardown seguro + oferta adjacente ao archive (Decisões 3+4)
goal: fixar o invariante machine-enforced de não-perda-de-trabalho no teardown
  (com base-ref ladder) e oferecer o teardown operator-prompted adjacente ao
  `archive`, sem alterar o flip de status (que continua zero efeito git).
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T15:05:46.324Z
lastUpdated: 2026-06-16T17:31:21.000Z
nextAction: "PLANO PAUSADO p/ pivô de design (worktree=feature→PR→develop→main). Operador decidiu (2026-06-16): REABRIR design.md AGORA via atomic-skills:brainstorm; NÃO carimbar phase-done de F1 nem tocar F2 até o re-plano. Após brainstorm → review-plan re-planeja F1–F3."
parentPlan: worktree-lifecycle-finalization
phaseId: F1
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: Invariante prova integração antes de remover; indeterminação
      bloqueia; sem -D/--force/rm -rf; suite verde.
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/worktree-teardown.test.js
    verifierLabel: "test: node tests/worktree-teardown.test.js"
  - id: G-2
    description: Oferta de teardown (âncora worktree-teardown) + desfecho
      nothing-to-remove presentes no archive; flip zero-git; skills válidos.
    status: pending
    verifier:
      kind: shell
      command: grep -q 'worktree-teardown'
        skills/shared/project-assets/project-transitions.md && grep -qi
        'nothing-to-remove' skills/shared/project-assets/project-transitions.md
        && npm run validate-skills
    verifierLabel: "shell: grep -q 'worktree-teardown' skills/shared/project-assets/pr…"
stack:
  - id: 1
    title: Teardown seguro + oferta adjacente ao archive (Decisões 3+4)
    type: task
    openedAt: 2026-06-16T15:05:46.324Z
tasks:
  - id: T-001
    title: Invariante de não-perda com base-ref ladder
    status: done
    closedAt: 2026-06-16T17:59:33.000Z
    lastUpdated: 2026-06-16T17:59:33.000Z
    summary: Check que prova integração antes de remover; indeterminação bloqueia.
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-16T17:59:33.000Z
      passed: true
      exitCode: 0
      testsCollected: 8
      outputSummary: node --test tests/worktree-teardown.test.js → tests 8 / pass 8 /
        fail 0 (exit 0); re-run na primária MERGED (HEAD 3a07fb6) após ff-merge
        de impl/wlf-f1-t001. Cobre resolveBaseRef ladder
        (origin/main→main→null), isTeardownSafe (block
        indeterminate/not-integrated, safe só ancestral, nothing-to-remove sem
        git call em branch null) + no-forbidden-tokens (-D/--force/rm -rf).
    outputs:
      - kind: file
        path: scripts/worktree-teardown.js
      - kind: test
        path: tests/worktree-teardown.test.js
    scopeBoundary:
      - NÃO executar git destrutivo no teste
      - NÃO tocar o `archive` ainda (T-002 faz a fiação)
      - a falha segura é BLOQUEAR, nunca over-deletar.
    acceptance:
      - "`resolveBaseRef` prefere `origin/main` fresco quando presente, cai para
        `main` local, e retorna `null` (indeterminado) quando nenhum resolve"
      - "`isTeardownSafe` bloqueia em base-ref indeterminada (`null`), bloqueia
        quando a branch não é ancestral da base, e libera só quando é ancestral
        E a base resolveu"
      - "um plano com branch ausente/`null` retorna `{ outcome:
        'nothing-to-remove' }` — `isTeardownSafe` não invoca `merge-base`/`git
        branch -d` numa branch inexistente, não bloqueia e não erra"
      - o módulo não contém token `-D`, `--force` nem `rm -rf`.
    verifier:
      kind: test
      runner: node
      pattern: tests/worktree-teardown.test.js
  - id: T-002
    title: Oferta de teardown operator-prompted adjacente ao archive
    status: done
    closedAt: 2026-06-16T18:07:28.000Z
    lastUpdated: 2026-06-16T18:07:28.000Z
    summary: archive passa a oferecer teardown da worktree, sem mexer no status.
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T18:07:28.000Z
      passed: true
      exitCode: 0
      outputSummary: "grep -q 'worktree-teardown' ... && grep -qi 'nothing-to-remove'
        ... && npm run validate-skills → exit 0 (15 skills válidos) na primária
        MERGED (HEAD 0a098bf) após ff-merge de impl/wlf-f1-t002. Diff revisado
        (verifier de âncora é fraco): oferta operator-prompted/never-automatic
        gated por isTeardownSafe, flip zero-git preservado, nothing-to-remove
        documentado, sem --force/-D."
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
    scopeBoundary:
      - NÃO automatizar
      - NÃO disparar integração de código no evento de arquivar
      - "NÃO alterar o flip de status (continua `status: archived` com zero
        efeito git)."
    acceptance:
      - a seção `archive` preserva a frase de que o plano é arquivado in-place
        com zero efeito git
      - adiciona uma oferta de teardown operator-prompted ADJACENTE ao flip,
        gated pelo invariante de `scripts/worktree-teardown.js`
      - para um plano com branch `null`/sem worktree, a seção documenta o
        desfecho `nothing-to-remove` (sem prompt de teardown, flip de status
        ainda zero-git)
      - "`grep` confirma a âncora `worktree-teardown` e `npm run
        validate-skills` passa."
    verifier:
      kind: shell
      command: grep -q 'worktree-teardown'
        skills/shared/project-assets/project-transitions.md && grep -qi
        'nothing-to-remove' skills/shared/project-assets/project-transitions.md
        && npm run validate-skills
parked: []
emerged: []
summary: Remover worktree só com integração provada; oferta de teardown no archive.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Teardown seguro + oferta adjacente ao archive (Decisões 3+4)**.

## Session handoff
> ⛔ **NÃO retome o implement direto. O plano está PAUSADO por um PIVÔ DE DESIGN do operador (abaixo).**
> ✅ **DECISÃO TOMADA (operador, 2026-06-16):** reabrir o `design.md` AGORA via `atomic-skills:brainstorm` (opção (a) recomendada abaixo). NÃO carimbar phase-done de F1 nem tocar F2 até o re-plano via `review-plan`.

- **Narrative:** Plano `worktree-lifecycle-finalization` em implement. **F0 DONE+commitada** (2/2 tasks, gates met, reviewGate passed, avançada). **F1 com 2/2 tasks DONE+commitadas** (T-001 invariante `scripts/worktree-teardown.js`; T-002 oferta de teardown no `archive`); review-code local rodou (1 major aceito-v1 + 2 minor). **MAS o phase-done de F1 e o implement INTEIRO estão PAUSADOS**: o operador introduziu um **pivô de design** que contradiz a premissa central do plano. Premissa atual (de painel adversarial): `plan/<slug>` = bookkeeping, NÃO feature branch; "arquivar-sem-merge é normal"; teardown só verifica; "não automatizar merge→main". **Pivô do operador (precedência humano > IA):** *cada worktree = uma feature → cada feature = um PR* (bom senso/consenso). Refinado por ele para **Git Flow**: feature-worktree → **PR → `develop`** (consolida + histórico de PRs; conflitos resolvem na entrada da develop) → merge → `main`. Nunca PR cego na main.
- **Decision log (o pivô):** (1) Modelo alvo: `worktree = feature → PR → develop → main`. `develop` é a branch de integração (Git Flow) com histórico de todos os PRs; `main` recebe consolidações limpas. (2) **Mapeamento no design existente:** base de integração muda `origin/main→main` para **`develop`**; o teardown (D4, `git merge-base --is-ancestor <feature> <base>`) verifica contra `develop`; o **finalize passa a ATIVO** (ABRE o PR feature→develop, não só verifica); **F2 (topology-aware) reaproveitado** = a ordem dos PRs entrando na develop (serial dentro de componente que conflita, qualquer-ordem entre disjuntos) = a "projeção de trunk" que o design tinha adiado. (3) **3 implicações a tratar:** (a) **F0 D1 reverte parcialmente** — "plano solo = `branch: null`, forka só sob concorrência" vira "todo plano = branch (é feature que vai PR-ar)"; o mecanismo de fork/worktree-retroativa segue útil, muda o default; (b) **squash vs is-ancestor** — PR na develop com merge-commit/rebase mantém o check atual; squash (default GitHub) quebra o `is-ancestor` → exige detecção patch-id (adiada no design); (c) **`develop` não existe** (nem local nem `origin/`) — criar. (4) Os 4 merge-backs do Codex desta sessão foram ff-merge direto + `git branch -d` (sem PR) — sub-execuções da feature, não o PR de feature.
- **Single nextAction:** **DECIDIDO (operador, 2026-06-16): opção (a) — reabrir o `design.md` AGORA via `atomic-skills:brainstorm`** (revisar a premissa central + Decisões 1/3/4/6 para `worktree=feature→PR→develop→main`, levando as 3 implicações abaixo como insumo) e depois re-planejar F1/F2/F3 via `review-plan`. Motivo aceito: F2 ("integração topology-aware") e o `resolveBaseRef` de F1 codificam "sem PR / base=main"; implementar sobre a premissa velha é trabalho jogado fora. NÃO carimbar phase-done de F1 nem tocar F2 antes de concluir o re-plano.
- **Verbatim state:** HEAD `plan/worktree-lifecycle-finalization` = `6c1a89b`. `main` = `origin/main` = `b26d989` (o plano está **49 commits à frente da main**). Branches `plan/*` são **locais-only** (nunca pushed); `origin/` usa `feat/*`,`docs/*`,`chore/*` via PR; **`develop` NÃO existe**. `gh` CLI disponível (2.45.0), remote `github.com/henryavila/atomic-skills`. F1 entregue: `scripts/worktree-teardown.js`+test (commit `3a07fb6`), `project-transitions.md` archive offer (commit `0a098bf`); state-closes em `1b456b9`/`7e53a55`/`6c1a89b`. F1 gates verdes mas NÃO carimbados (phase-done pausado): G-1 `node --test tests/worktree-teardown.test.js` (8/8 exit 0), G-2 `grep -q 'worktree-teardown' skills/shared/project-assets/project-transitions.md && grep -qi 'nothing-to-remove' skills/shared/project-assets/project-transitions.md && npm run validate-skills` (exit 0). F1 review findings: F-001 major (`resolveBaseRef` aceita `origin/main` stale — aceito-v1, latente, casa F-002 do codex review do plano em `.atomic-skills/reviews/2026-06-16-1539-worktree-lifecycle-finalization.md`); F-002/F-003 minor; `shellQuote` verificado injection-safe. Telemetria: `.atomic-skills/status/dispatch-log.json` tem 12 registros (F0+F1, todos Codex, todos re-verificados na primária). Todos os worktrees Codex `impl/wlf-*` removidos. Lição **L-001** ratificada (Codex auto-report de contagem não-confiável → sempre re-verificar na primária merged).
- **Uncommitted changes:** árvore LIMPA em `6c1a89b` (este handoff é a única mudança a commitar). Sem resume bloqueado: a tree está limpa, sem placeholders.

## Decisions

- **F1 tasks 2/2 done** (T-001 invariante + T-002 oferta no archive), gates G-1 (8/8) e G-2 (shell exit 0) confirmados verdes na primária. Source em `3a07fb6` + `0a098bf`; state em `7e53a55`.
- **review-code (local, phase-done) RODOU**: 1 major + 2 minors, 0 blocker/critical. F-001 major = `resolveBaseRef` aceita `origin/main` stale (sem fetch/frescor) — **aceito na v1** pela spec (P3 nomeia resolubilidade, não frescor; FAIL é gatilho futuro) e latente (função não fiada a remoção). F-002/F-003 minors (testes só com git fake; funções prose-mediated, não code-wired). `shellQuote` verificado injection-safe.
- **PHASE-DONE F1 PAUSADO** (gates/reviewGate/advance NÃO carimbados) — o operador levantou uma pergunta de design potencialmente alteradora: *o teardown/integração da worktree deve ser SEMPRE via PR (rastreabilidade)?* Não auto-resolver (precedência artefato humano > IA). Resolver a pergunta ANTES de fechar F1 e de avançar a F2, pois pode mudar o design de integração (e o que F2 assume).
- **PIVÔ RESOLVIDO — TIMING (operador, 2026-06-16):** escolhida a opção **(a) reabrir o design AGORA** via `atomic-skills:brainstorm`, depois re-planejar F1–F3 via `review-plan`. O implement cede o controle para o brainstorm; phase-done de F1 e F2 ficam congelados até o design revisado + re-plano. A revisão deve cobrir: premissa central (`worktree=feature→PR→develop→main`, Git Flow), Decisões 1/3/4/6, e as 3 implicações (F0-D1 reverte parcialmente; squash-merge quebra `is-ancestor` → patch-id; `develop` não existe → criar).

## Links

_(plan doc, external refs)_
