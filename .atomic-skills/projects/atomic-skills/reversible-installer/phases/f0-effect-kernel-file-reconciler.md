---
schemaVersion: "0.1"
slug: reversible-installer-f0-effect-kernel-file-reconciler
title: Effect Kernel + file reconciler
goal: estabelecer o contrato fechado de efeito (apply/revert/before-state) + o
  journal + o efeito de reconciliação de arquivos portado da lógica 3-hash
  atual, sem tocar no instalador legado.
status: done
branch: plan/reversible-installer
started: 2026-06-17T15:13:50.418Z
lastUpdated: 2026-06-17T16:41:21.000Z
nextAction: null
parentPlan: reversible-installer
phaseId: F0
tasksDone: 3
tasksTotal: 3
gatesMet: 2
gatesTotal: 2
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-1
    description: O efeito reconcileFileSet reproduz o comportamento de
      install/update/uninstall de arquivos dos testes atuais.
    status: met
    metAt: 2026-06-17T16:41:21.000Z
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/reconciler.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T16:41:21.000Z
      passed: true
      exitCode: 0
      testsCollected: 4
      outputSummary: node --test test/kernel/reconciler.test.js — tests 4, pass 4,
        fail 0 (inclui o teste de path-containment do review gate).
    verifierLabel: "test: node --test test/kernel/reconciler.test.js"
    evidenceSummary: passed · 4 tests · 2026-06-17
  - id: G-2
    description: O contrato de efeito tem fixture de round-trip que prova apply
      seguido de revert restaurando o baseline.
    status: met
    metAt: 2026-06-17T16:41:21.000Z
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/effect.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T16:41:21.000Z
      passed: true
      exitCode: 0
      testsCollected: 4
      outputSummary: node --test test/kernel/effect.test.js — tests 4, pass 4, fail 0
        (round-trip apply→revert restaura baseline).
    verifierLabel: "test: node --test test/kernel/effect.test.js"
    evidenceSummary: passed · 4 tests · 2026-06-17
stack:
  - id: 1
    title: Effect Kernel + file reconciler
    type: task
    openedAt: 2026-06-17T15:13:50.418Z
tasks:
  - id: T-001
    title: Contrato e registry de efeitos
    status: done
    lastUpdated: 2026-06-17T16:10:22.000Z
    closedAt: 2026-06-17T16:10:22.000Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T16:10:22.000Z
      passed: true
      exitCode: 0
      testsCollected: 4
      outputSummary: "Re-run on MERGED primary @37d0e24: node --test
        test/kernel/effect.test.js — tests 4, suites 1, pass 4, fail 0. Full npm
        test 825 tests, 811 pass, 2 fail (pré-existentes: dashboard bundle
        ausente — provadas no pai 850746a). Executor: codex lane, worktree
        impl/ri-f0-t001."
    summary: Interface Effect (apply/revert/before-state) + registry que rejeita
      tipo duplicado e efeito sem revert.
    description: "Define a interface Effect (type, apply(ctx), revert(ctx,
      beforeState)) e registerEffectType com validação de unicidade e presença
      de revert. Primeiro passo: ampliar o glob do `npm test` para incluir os
      testes do kernel (hoje a suíte é só tests/*.test.js)."
    scopeBoundary:
      - não edita src/install.js, src/uninstall.js nem src/providers; só o
        contrato e o registry
    acceptance:
      - registry rejeita tipo duplicado
      - efeito registrado sem função revert é rejeitado no registro
      - round-trip de um efeito de teste restaura o baseline
      - package.json `test` é ampliado para `node --test tests/**/*.test.js
        test/**/*.test.js` (1º passo da fase) para que os verifiers de kernel
        sob test/ rodem no npm test
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/effect.test.js
  - id: T-002
    title: Journal como extensão do manifesto
    status: done
    lastUpdated: 2026-06-17T16:15:50.000Z
    closedAt: 2026-06-17T16:15:50.000Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T16:15:50.000Z
      passed: true
      exitCode: 0
      testsCollected: 4
      outputSummary: "Re-run on MERGED primary @83be588: node --test
        test/kernel/journal.test.js — tests 4, pass 4, fail 0. Prova round-trip
        via writeManifest/readManifest, replay reverso e3→e2→e1, manifesto
        antigo sem effects lido como [], throw em tipo não-registrado. Imutável
        (manifest original não mutado). Executor: codex lane, worktree
        impl/ri-f0-t002."
    summary: "Journal estende o manifesto: before-state por efeito, revert em ordem
      inversa, lê manifesto antigo."
    description: Persiste por efeito aplicado o type + before-state mínimo; expõe
      replayReverse iterando do efeito mais novo ao mais antigo.
    scopeBoundary:
      - não altera o schema de arquivos do manifesto além de acrescentar o array
        effects; mantém leitura do manifesto antigo
    acceptance:
      - o journal grava e relê o before-state de um efeito
      - replay reverso chama revert na ordem inversa de apply
      - manifesto antigo sem o array effects é lido sem erro
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/journal.test.js
  - id: T-003
    title: Efeito reconcileFileSet (porta da lógica 3-hash)
    status: done
    lastUpdated: 2026-06-17T16:21:35.000Z
    closedAt: 2026-06-17T16:21:35.000Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T16:21:35.000Z
      passed: true
      exitCode: 0
      testsCollected: 3
      outputSummary: "Re-run on MERGED primary @f92c7c0: node --test
        test/kernel/reconciler.test.js — tests 3, pass 3, fail 0. classifyFile
        porta 3-hash (unchanged/keep-local/conflict); revert remove só
        não-modificado + prune dirs, preserva modificado. Full npm test 832
        tests, 818 pass, 2 fail (pré-existentes dashboard, idênticas ao pai —
        zero regressão dos kernels). Executor: codex lane, worktree
        impl/ri-f0-t003."
    summary: Efeito reconcileFileSet portando 3-hash + remoção de órfão unmodified-only.
    description: Porta a detecção 3-hash de src/install.js:1049-1083 e a remoção de
      órfão unmodified-only de src/install.js:896-918 para um efeito
      reutilizável.
    scopeBoundary:
      - só o conjunto de arquivos; não toca settings.json, refcount nem paths
        legados
    acceptance:
      - arquivo instalado e não-modificado é removido no uninstall
      - arquivo modificado pelo usuário é preservado
      - conflito é detectado quando disco e pacote divergem ambos do hash
        registrado
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/reconciler.test.js
parked: []
emerged: []
summary: "Funda o kernel: contrato de efeito reversível, journal e o reconciler
  de arquivos (porta do 3-hash)."
planTitle: Reversible Installer — motor de instalação reversível e reutilizável
---


# Narrative / notes

Initiative for phase **F0 — Effect Kernel + file reconciler**.

## Decisions

- **2026-06-17 — Roteamento Mode 2 (Codex) ligado.** `routing.json` tem `mode2Enabled:true` + `codexLane.enabled:true`; Codex 0.139.0 autenticado (ChatGPT). T-001/T-002/T-003 são spec-ready com verifier `kind:test` → executor default = Codex. Cadeia de dependência (T-001 contrato → T-002 journal → T-003 reconciler) ⇒ dispatch/merge SERIAL, uma worktree por vez.
- **2026-06-17 — Layout de teste do kernel.** Suíte existente em `tests/` (plural); kernel novo em `test/` (singular) conforme verifier patterns do plano (`test/kernel/*.test.js`). T-001 amplia `package.json` `test` para `node --test tests/**/*.test.js test/**/*.test.js`.

## Links

- Plano: `../../plan.md` · Design (fonte de verdade): `../../design.md`
- Lane: `skills/shared/mode2-codex-lane.md` · Worktree: `skills/shared/worktree-isolation.md`

## Self-review against code-quality gates

- **G1 read-before-claim**: 3 tasks fechadas, cada uma com `evidence` linkando o run do verifier que a fechou (re-run na árvore mesclada). Findings do review citaram `file:line` lidos antes do fix.
- **G2 soft-language**: scan da ban-list em nextAction + descrições + claims de conclusão; 0 violações — toda conclusão é `passed:true` com contagem real.
- **G6 reference-or-strike**: 2 exit-criteria, ambos `met` com `evidence` populada (testsCollected 4/4); literais do handoff são paths/comandos/shas verbatim.
- **Review gate (G2)**: `review-code --mode=local` rodado no diff da fase `86c7278..f92c7c0` (DESTRUCTIVE=false → local). 2 major + 1 minor; os 2 majors corrigidos e verificados (incl. mutation-kill no fix de path-traversal), minor #3 registrado. Fixes em `8869e31`. Detalhe: `.atomic-skills/reviews/2026-06-17-1641-reversible-installer-f0.md`. **NB:** o campo estruturado `phases[].reviewGate` (GATE-R3) descrito no asset NÃO é suportado pelo `plan.schema.json`/`validate-state` desta versão (rejeitado como additional property) — o review gate fica registrado nesta prosa + no review file, não no descriptor.
- **Lessons (G1)**: distiladas no ratify gate do phase-done (ver `lessons/`).
- **Executor (Mode 2)**: T-001/T-002/T-003 via Codex lane; cada self-report sub-contou os testes (`tests 1` vs real 4/4/3) — re-run na árvore mesclada foi o adjudicador (R-EXEC-28).

## Session handoff
- **Narrative:** F0 em 3/3 — TODAS as tasks DONE. T-001 (contrato Effect+registry), T-002 (journal/manifest extension), T-003 (reconcileFileSet/3-hash port) executadas via Codex Mode 2, mescladas fast-forward serial no primário, cada verifier re-rodado na árvore mesclada. HEAD primário `f92c7c0`. Worktrees do Codex todas removidas. **Fronteira de fase: pronto para `phase-done F0` (opt-in do usuário).**
- **Decision log:** O Codex auto-reportou `tests 1` nas TRÊS tasks; runs reais foram 4/4/3 — re-execução na árvore mesclada é o adjudicador, não a narrativa do executor (padrão consistente de mis-report). As 2 falhas de `npm test` (`dist/dashboard` ausente) são pré-existentes (provadas idênticas no pai `850746a`), não regressão — suíte foi de 825→832 (+7 kernels), pass 818, mesmas 2 fails. `package.json` test-glob com aspas. T-002 imutável sem tocar `manifest.js`; T-003 porta fiel de install.js:1049-1083 (3-hash) + 896-918 (órfão/prune).
- **Single nextAction:** Rodar `phase-done F0` (com opt-in do usuário): executa os exit-gates G-1 (`node --test test/kernel/reconciler.test.js`) e G-2 (`node --test test/kernel/effect.test.js`), roda `review-code` no diff da fase (`850746a..f92c7c0`, ~3 commits de feat + state), grava `reviewGate` no plan.md, distila lessons, e avança currentPhase F0→F1.
- **Verbatim state:** Verifiers que passaram na árvore mesclada: `node --test test/kernel/effect.test.js` (4/4), `node --test test/kernel/journal.test.js` (4/4), `node --test test/kernel/reconciler.test.js` (3/3). HEAD primário `f92c7c0`. Exit-gates F0: G-1 reconciler.test.js, G-2 effect.test.js — ambos `pending`, a verificar no phase-done. Diff da fase: `850746a..f92c7c0`. Branch: `plan/reversible-installer`. Falhas pré-existentes (NÃO bloqueiam F0): `serve constants > DEFAULT_BUNDLE_DIR resolves to <pkg>/dist/dashboard` + `the dashboard bundle has been built (E.T-005 prerequisite)`.
- **Uncommitted changes:** state files (f0 phase, dispatch-log.json) a commitar com este snapshot; código de T-001/T-002/T-003 já em `37d0e24`/`83be588`/`f92c7c0`. Árvore limpa após o commit.
