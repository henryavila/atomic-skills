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
status: done
branch: plan/worktree-lifecycle-finalization
started: 2026-06-19T16:20:35Z
lastUpdated: 2026-06-19T18:05:06Z
nextAction: null
parentPlan: worktree-lifecycle-finalization
phaseId: F8
tasksDone: 3
tasksTotal: 3
gatesMet: 2
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
    status: met
    metAt: 2026-06-19T18:05:06Z
    verifier:
      kind: test
      runner: node
      pattern: tests/finalize-plan-scope.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-19T18:05:06Z
      exitCode: 0
      testsCollected: 24
      passed: true
      outputSummary: "node --test tests/finalize-plan-scope.test.js @ 00dd0cd
        (phase-done, pós-review both): tests 24, pass 24, fail 0, exit 0.
        resolveFinalizePlanScope + detectPlanStatusRegression puros/never-throws/
        fail-closed, com as correções L#1/L#2/L#4 + codex F-001..F-004."
  - id: G-2
    description: >-
      project-finalize.md documenta o guard plan-aware (passo pré-publish:
      seleção EXPLÍCITA do plano-alvo, terminalidade, WARN de irmãos), a
      verificação de existência do integrationRef (inclui source:default), e o
      detect+WARN advisory de regressão de status no merge (reusa a lane do F4);
      skills válidos.
    status: met
    metAt: 2026-06-19T18:05:06Z
    verifier:
      kind: shell
      command: grep -qi 'plan-aware' skills/shared/project-assets/project-finalize.md && grep -qi 'finalize-plan-scope' skills/shared/project-assets/project-finalize.md && npm run validate-skills
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T18:05:06Z
      exitCode: 0
      passed: true
      outputSummary: "grep plan-aware (2) && grep finalize-plan-scope (4) em
        project-finalize.md && npm run validate-skills → All 15 skills valid, exit 0
        @ 00dd0cd. Step 1.6 (guard determinístico) + Step 1 (existence-check em origin,
        cobre source:default; F-004 endureceu o prompt-when-absent) + regressão advisory."
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
    status: done
    closedAt: 2026-06-19T17:28:16Z
    lastUpdated: 2026-06-19T17:28:16Z
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
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-19T17:28:16Z
      exitCode: 0
      testsCollected: 16
      passed: true
      outputSummary: "node --test tests/finalize-plan-scope.test.js na árvore primária
        MERGEADA (cp da worktree impl/wlf-f8-t001): tests 16, pass 16, fail 0, exit 0.
        Cobre classificação target/other-active/archived-unmerged, gate de terminalidade
        (fases done OU archived), gate target≠focus-sem-confirmação (surfaça branch≠plan),
        WARN de irmãos ativos, fail-closed (null/malformado/target-ausente→block,
        never-throws/frozen) + detectPlanStatusRegression (behind/equal/ahead, one-sided,
        unknown-status→behind, never-throws)."
  - id: T-002
    title: Verificação de existência do integrationRef no consumo (fecha "develop silencioso")
    summary: finalize confirma que o integrationRef resolvido existe em origin antes
      do PR, inclusive no caso source:default.
    status: done
    closedAt: 2026-06-19T17:32:29Z
    lastUpdated: 2026-06-19T17:32:29Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:32:29Z
      exitCode: 0
      passed: true
      outputSummary: "grep -qi 'ls-remote\\|show-ref' project-finalize.md (existence
        check on origin adicionado ao Step 1, cobre source:default; ref ausente →
        prompt-when-absent) && npm run validate-skills → All 15 skills valid
        (schema_version 0.2), exit 0. Guarda no consumidor; integration-ref.js intacto."
  - id: T-003
    title: Fiar o guard plan-aware + WARN de regressão no project-finalize.md
    summary: Novo passo pré-publish no finalize — alvo explícito + terminalidade +
      WARN de irmãos e de regressão de status (advisory, reusa a lane do F4).
    status: done
    closedAt: 2026-06-19T17:34:36Z
    lastUpdated: 2026-06-19T17:34:36Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:34:36Z
      exitCode: 0
      passed: true
      outputSummary: "grep -qi 'plan-aware' (2) && grep -qi 'finalize-plan-scope' (4) em
        project-finalize.md && npm run validate-skills → All 15 skills valid, exit 0.
        Step 1.6 documenta o guard determinístico (resolveFinalizePlanScope: alvo
        explícito, terminalidade, BLOCK target≠focus-sem-confirm, WARN de irmãos) +
        o detect+WARN advisory de regressão (detectPlanStatusRegression, read-only,
        reusa a lane do F4 Step 1.5, nunca gateia); bullet de escopo adicionado."
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

## Session handoff

- **Narrative:** F8 (Decisão 9, finalize plan-aware; branch ≠ plano) **CONCLUÍDA e fechada via `phase-done`**. 3/3 tasks done; review-code `--mode=both` rodado (local + codex 2-pass, 8 findings, todos corrigidos, re-verificado 24/24 + validate-skills 15/15); exit-gates G-1/G-2 `met` com evidência; `phases[F8].reviewGate` `passed @ 00dd0cd`; 2 lessons ratificadas. **Plano F0–F8 inteiro implementado.** `plan.status` segue `active` (plan-done/finalize são opt-in). Próximo: o operador pediu um **DRY-RUN do `project finalize`** (sem push/PR) — dogfood do que esta fase construiu, porque (a) outros projetos na branch ainda não finalizaram e (b) quer ver a validação prévia.
- **Decision log:**
  - Modo = **Híbrido** (operador): T-001 → Codex (arquivos novos, zero conflito); T-002/T-003 inline serial (mesmo arquivo `project-finalize.md`).
  - Codex reportou `tests 1` no self-check (artefato do reporter) — contagem REAL veio da re-verificação na primária MERGED (executor self-checks, nunca self-certifies). Recorrência da lição do F0; corrective segurou.
  - Review `both`: fixes locais COMMITADOS (`f015e7c`) antes do codex → codex revisou a árvore pós-fix (bar mais estrito, valida os fixes) em vez do diff byte-idêntico; documentado no review file.
  - `plan.md` é a fonte de status; `focus.json` stale (ignorado).
- **Single nextAction:** Executar o **DRY-RUN do `project finalize`** nesta branch: Step 1 (resolve `integrationRef` via `scripts/integration-ref.js` + existence-check em origin), Step 1.5 (cross-WT collision — 7 worktrees vivas), Step 1.6 (plan-aware `resolveFinalizePlanScope` — a branch carrega MÚLTIPLOS planos: alvo explícito = `worktree-lifecycle-finalization`), e MOSTRAR o diff + PR proposto — **HALT antes de qualquer push/PR** (dry-run, sem publicar).
- **Verbatim state:**
  - Commits da fase: T-001 `1a502e7`; T-002+T-003 `c7d7f03`; self-review-impl `b0ccbf5`; exit-gates `a761701`; local-fixes `f015e7c`; codex-fixes+review `00dd0cd`; phase-done-close = este commit.
  - reviewGate: `phases[F8].reviewGate = {status: passed, at: 00dd0cd, mode: both, reviewFile: .atomic-skills/reviews/2026-06-19-1803-wlf-f8-finalize-plan-aware.md}`.
  - Verifiers finais: `node --test tests/finalize-plan-scope.test.js` → 24/24 exit 0; `grep plan-aware && grep finalize-plan-scope && npm run validate-skills` → exit 0.
  - finalize é DRY-RUN: NÃO `git push`, NÃO `gh pr create`. integrationRef provável: não-configurado em `routing.json` → prompt-when-absent (develop).
- **Uncommitted changes:** este commit fecha o phase-done de F8 (plan.md F8 `done`+reviewGate+evidência; initiative `done`+gates met+self-review; lessons file novo; este handoff). Após o commit, árvore `multiplan` limpa; finalize dry-run a seguir não muta estado.

## Self-review (implement gates) — F8 implementation done

- **G1 read-before-claim:** applied — cada task fechada cita a fonte/o run que a fechou: T-001 com `node --test` (exit 0, tests 16/16) na primária MERGEADA + leitura das 209+280 linhas do diff do Codex antes de aceitar; T-002/T-003 com o verifier shell capturado (exit 0, anchors contados: plan-aware×2, finalize-plan-scope×4).
- **G2 soft-language:** applied — nenhuma claim de conclusão usa should/probably/works/looks-done; cada `done` carrega `evidence.passed: true` + `exitCode: 0` (e `testsCollected: 16` no T-001), validado por `validate-state` GATE-R2.
- **G6 reference-or-strike:** applied — os literais do handoff são caminhos/comandos/SHAs verbatim (`1a502e7`, `c7d7f03`, os 3 comandos de verifier, `scripts/finalize-plan-scope.js`); o falso-alarme "tests 1" foi registrado como artefato do reporter, não apagado.

## Self-review against gates (at phase-done F8)

- **G1 read-before-claim:** applied — exit-gates fechados com runs colados (G-1 `node --test` exit 0 tests 24/24 @ 00dd0cd; G-2 grep+validate-skills exit 0). Cada fix de review citou file:line lido na primária.
- **G2 soft-language:** applied — gates `met` com `evidence.passed: true`; nenhum should/probably/works nas evidências ou no self-review.
- **G6 reference-or-strike:** applied — evidências carregam comando+exit+sha verbatim; reviewGate `at: 00dd0cd` + reviewFile real.
- **Exit gates:** 2/2 met com evidência (G-1 test 24/24, G-2 shell). `validate-state` plan+initiative ✓ (GATE-R2 + GATE-R3).
- **Codex review:** ran via `atomic-skills:review-code --mode=both` (local sealed-envelope agent + codex 2-pass blind→informed) @ HEAD `00dd0cd`, verdict `needs_changes→all fixed`, counts final `0B/0C/4M/0m/0n` (blind `0B/0C/3M/1m`, pass-2 subiu F-003 minor→major; local disjunto `2M/2m`), file `.atomic-skills/reviews/2026-06-19-1803-wlf-f8-finalize-plan-aware.md`. Todos os 8 findings corrigidos e re-verificados.
- **Lessons:** 2 ratificadas (L-001 enum completo no work-order Mode-2; L-002 matriz fail-closed em módulos guard) em `lessons/worktree-lifecycle-finalization-f8-finalize-plan-aware-branch.md`. Recorrência do auto-report Codex não-confiável NÃO re-lessonada (corrective do F0 segurou).
