---
schemaVersion: "0.2"
slug: worktree-lifecycle-finalization-f6-backstop-read-only-no-projec
projectId: atomic-skills
parentPlan: worktree-lifecycle-finalization
lessons:
  - id: L-001
    statement: >-
      `findOrphanWorktrees` decidia "esta branch foi mergeada/integrada?" em DOIS lugares:
      a condição A (flag de worktree viva) checava `pr.state === 'MERGED' OR isMerged()`;
      a condição B (suprimir branch archived) checava SÓ `pr.state`, ignorando `isMerged`.
      O review local mesmo-modelo AFIRMOU positivamente "Logic correctness (A/B): clean";
      o Codex cross-model blind pegou a assimetria como major (F-001): uma branch archived
      mergeada via ancestralidade (merge-base) mas sem PR gravado (`pr: null`) era
      falso-flagada `archived-never-pr` ("never reached develop"). 6ª fase consecutiva
      (wlf-f1..f5) em que o mesmo-modelo racionaliza um gap de lógica que o cross-model
      pega. DUPLAMENTE validado: o PRIMEIRO fix tornou A branch-level mas deixou B
      per-plan, re-introduzindo a assimetria como duplo-flag — o teste de lock-in
      (re-verify na primária MERGED) pegou a regressão do próprio fix.
    corrective: >-
      Quando dois caminhos de código classificam o MESMO conceito de domínio (aqui "a
      branch alcançou o integration ref?"), extraia-o num ÚNICO predicado nomeado usado
      por ambos (`isBranchMerged`), nunca duplique a lógica inline — lógica duplicada
      deriva para assimetria (um caminho ganha um sinal que o outro não tem), e o review
      mesmo-modelo lê cada caminho como localmente sensato e perde a divergência. Adicione
      um teste que exercite OS DOIS caminhos no mesmo input, pra a assimetria virar uma
      contradição visível (um caminho flaga enquanto o outro suprime o mesmo estado).
      Rode `review-code --mode=both`: o cross-model é o que pega a assimetria. E
      RE-RODE o verifier após aplicar o fix — um fix que toca caminhos paralelos pode
      re-introduzir a mesma assimetria que está removendo (foi o que aconteceu aqui; o
      teste pegou). Locus: scripts/detect-orphan-worktrees.js (`isBranchMerged`,
      compartilhado pelas condições A e B).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    recurrenceOf: worktree-lifecycle-finalization-f4-check-de-colisao-cross-wt-no/L-001
    evidence: >-
      .atomic-skills/reviews/2026-06-17-2130-wlf-f6-orphan-worktrees.md (codex blind F-001
      major: condition-B/isMerged asymmetry, local declarou A/B "clean"; informed pass-2
      emerged slug-selection minor); scripts/detect-orphan-worktrees.js (isBranchMerged
      simétrico em A e B); tests/detect-orphan-worktrees.test.js (6→11, lock-ins F-001/F-002
      + isMerged-throws/no-plan/malformed); fix commits f2e0ab2, bb3183b
    createdAt: 2026-06-17T21:30:00Z
    validatedAt: 2026-06-17T21:30:00Z
---

# Lessons — F6 backstop read-only no project verify (worktree-lifecycle-finalization)

Distilada no phase-done de F6 a partir de sinal real: o review-gate `--mode=both` sobre o
diff de código da fase (`scripts/detect-orphan-worktrees.js` novo + teste + check #9 em
`project-verify.md`). O pass local (mesmo-modelo) achou 1 major (cobertura de teste) + 3
minor + 2 nit e julgou a LÓGICA "clean"; o Codex blind achou 2 major de LÓGICA (a
assimetria condição-B/isMerged + first-match-wins em planos duplicados) que o local
perdeu; o informed pass-2 confirmou closure e emergiu 1 minor (slug do plano stale).
Fixes em `f2e0ab2` + `bb3183b`; verdict efetivo needs_changes→all-fixed; suite 6→11.

**Validação `--mode=both` (6ª fase seguida, a mais forte):** desta vez o local não só
perdeu como AFIRMOU "Logic correctness (A/B): clean" — o cross-model pegou a assimetria
de lógica mesmo assim. A L-001 generaliza: a classe de bug é a ASSIMETRIA entre dois
caminhos que classificam o mesmo conceito; a cura é um predicado compartilhado + um teste
que exercita ambos no mesmo input.

**Re-verify pegou a regressão do próprio fix:** o primeiro fix de F-001 corrigiu A mas
deixou B inconsistente (duplo-flag) — o lock-in test na primária MERGED falhou e forçou
a generalização para `isBranchMerged` simétrico. Aplicar um review fix É uma mudança que
precisa ser re-verificada, especialmente quando toca caminhos paralelos.

**Pass-2 emergiu de novo (2ª vez no plano, após wlf-f4):** o informed pass pegou o slug
do plano stale no caso de planos duplicados — confirma que o pass-2 não é redundante.
