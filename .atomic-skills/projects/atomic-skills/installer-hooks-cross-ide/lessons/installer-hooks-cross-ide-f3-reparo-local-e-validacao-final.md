---
schemaVersion: "0.1"
slug: installer-hooks-cross-ide-f3-reparo-local-e-validacao-final
projectId: atomic-skills
parentPlan: installer-hooks-cross-ide
lessons:
  - id: L-001
    statement: Verifier final de fase nao pode validar apenas um subconjunto do
      estado; isso deixa a fase ativa fora da cobertura.
    corrective: Em tasks/gates de validacao final, usar `node
      scripts/validate-state.js` no estado completo antes das suites
      especificas.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-10-1217-installer-hooks-cross-ide-f3-local.md;
      finding major corrigida antes do fechamento de F3
    createdAt: 2026-07-10T14:23:04Z
    validatedAt: 2026-07-10T14:23:04Z
---

# Lessons - F3 (Reparo local e validacao final)

Destilada no phase-done da F3 e ratificada pelo usuario em 2026-07-10. Nasce do
review local, que encontrou uma lacuna major: o verifier final validava apenas um
subconjunto do estado e deixava a fase ativa fora da cobertura.

- **L-001** (reusable): verifiers finais de fase usam `node
  scripts/validate-state.js` no estado completo antes das suites especificas.
