---
schemaVersion: "0.1"
slug: reversible-installer-f3-big-bang-rewire-e-paridade
projectId: atomic-skills
parentPlan: reversible-installer
lessons:
  - id: L-001
    statement: O round-trip de paridade cobria só install→uninstall single-install,
      então dois efeitos que gravavam ownership apenas para paths recém-criados
      (stageRuntimeArtifacts não recordava o que já existia; jsonMerge inseria nada
      num re-install) perderam ownership no UPDATE e deixaram resíduo no upgrade
      normal; e o uninstall delegava ao journal sem migrar manifesto legado,
      orfanando installs pré-kernel. Os verifiers das tasks (round-trip 7/7) deram
      false-green; o review gate cross-model de phase-done pegou os 2 criticals.
    corrective: Para todo efeito apply/revert com before-state, o gate de paridade
      DEVE ter fixture install→update→uninstall E legacy/pré-migração→uninstall, não
      só single-install — o caminho de UPDATE é onde a ownership se perde. E o
      before-state anterior (`previous` threadado pelo Driver) deve ser consumido por
      TODO efeito (carry-forward de ownership), não só pelo reconcileFileSet.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: ".atomic-skills/reviews/2026-06-19-1958-reversible-installer-f3.md (CRITICAL A local#1+codex F-002, CRITICAL B codex F-001); fix commits 0a414e3 (atomic-skills) + 036e371 (pacote); tests/install-uninstall-roundtrip.test.js casos update+legacy"
    createdAt: 2026-06-19T20:05:00.000Z
    validatedAt: 2026-06-19T20:05:00.000Z
  - id: L-002
    statement: O review gate de phase-done sobre o diff destrutivo (src/kernel/ +
      test/kernel/ removidos) rodou --mode=both; o codex (cross-model) achou o
      CRITICAL B (legacy-uninstall órfão) que o local same-family pass NÃO viu,
      enquanto o CRITICAL A foi achado por ambos. Confirma empiricamente a regra
      destrutivo→both (o finding disjunto cross-model).
    corrective: Manter --mode=both obrigatório em diff destrutivo (delete/drop de
      arquivo-fonte) — o valor é o finding disjunto que um único modelo perde; nunca
      degradar p/ local-only num diff destrutivo sem override explícito registrado.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: ".atomic-skills/reviews/2026-06-19-1958-reversible-installer-f3.md (codex F-001 disjunto do local)"
    createdAt: 2026-06-19T20:05:00.000Z
    validatedAt: 2026-06-19T20:05:00.000Z
---

# Lessons — F3 (Big-bang rewire e paridade)

Destiladas no ratify gate do `phase-done` F3 (2026-06-19), ambas ratificadas pelo usuário.
Sinal de falha real: o review gate `--mode=both` (diff destrutivo) achou 2 criticals de
reversibilidade que os verifiers single-install das tasks deram como false-green — corrigidos
via TDD (commits 0a414e3 + pacote 036e371), round-trip 9/9, suíte 830/816/2 zero-regressão.
O phase-start gate de fases futuras deve dispor as `reusable`+`open`.
