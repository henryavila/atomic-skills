---
schemaVersion: "0.1"
slug: reversible-installer-f0-effect-kernel-file-reconciler
projectId: atomic-skills
parentPlan: reversible-installer
lessons:
  - id: L-001
    statement: O review local pegou 2 bugs major latentes (crash em manifesto
      `null`; path-traversal em apply/revert) que os verifiers por-task não
      pegaram, porque a acceptance interpretou "manifesto antigo" como `{}` e não
      considerou paths com `..`.
    corrective: Work-orders de efeitos do kernel (F1+) devem exigir na acceptance
      o contrato COMPLETO de input dos módulos pareados (ex. `manifest.js`
      retorna `null` para projeto nunca instalado) e segurança de filesystem
      (contenção de path), não só o happy-path. Boundary de API one-way-door
      (Blast radius D5/D6) merece o caso null/vazio/malformado explícito.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: ".atomic-skills/reviews/2026-06-17-1641-reversible-installer-f0.md (findings #1, #2)"
    createdAt: 2026-06-17T16:41:21.000Z
    validatedAt: 2026-06-17T16:41:21.000Z
  - id: L-002
    statement: O teste de path-traversal do fix vazou `../escapee.txt` no `/tmp`
      compartilhado (pai de todos os mkdtemp), porque o `afterEach` só limpa o
      subdir — o vazamento contaminou runs seguintes e quase mascarou o resultado
      do mutation-kill.
    corrective: Testes que exercitam `..`/escape devem manter o alvo de escape
      DENTRO do tempDir aninhado e limpo pelo `afterEach` (`basePath =
      join(tempDir, 'install')`, alvo = `join(tempDir, 'escapee.txt')`), nunca o
      pai `tmpdir`. Verificar zero resíduo no `/tmp` após o mutation-kill.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: "test/kernel/reconciler.test.js — teste 'refuses paths that escape basePath'; mutation-kill no review file"
    createdAt: 2026-06-17T16:41:21.000Z
    validatedAt: 2026-06-17T16:41:21.000Z
  - id: L-003
    statement: Nas 3 tasks o executor Codex (Mode 2) auto-reportou `tests 1`
      enquanto os runs reais foram 4/4/3 — sub-contagem consistente do
      self-report do executor.
    corrective: Nunca fechar uma task por contagem auto-reportada do executor; o
      re-run do verifier na árvore mesclada é a única evidência (R-EXEC-28).
      Padrão observado é sistemático no Codex CLI 0.139.0 — ler o diff e re-rodar,
      não a narrativa.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: ".atomic-skills/status/dispatch-log.json (T-001/T-002/T-003 routingReason)"
    createdAt: 2026-06-17T16:41:21.000Z
    validatedAt: 2026-06-17T16:41:21.000Z
---

# Lessons — F0 (Effect Kernel + file reconciler)

Destiladas no ratify gate do `phase-done` F0 (2026-06-17), todas ratificadas pelo usuário. Sinais de falha reais: 2 findings major do `review-code` local + 1 defeito de teste (vazamento) + o padrão de mis-report do executor. O phase-start gate de F1+ deve dispor as `reusable`+`open`.
