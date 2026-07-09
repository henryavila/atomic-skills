---
schemaVersion: "0.1"
slug: installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks
projectId: atomic-skills
parentPlan: installer-hooks-cross-ide
lessons:
  - id: L-001
    statement: O contrato de ambiente para hooks precisa distinguir a arvore de skills do
      arquivo de hook; usar apenas `.agents/` deixou projetos Codex com
      `.codex/hooks.json` fora do fluxo.
    corrective: "Em fases que conectem suporte de host a hooks, revisar os dois sinais no
      mesmo teste: path de skills e path de hook config, com regressao cobrindo a
      deteccao antes da fallback generica."
    scope: reusable
    appliesTo:
      - F1
      - F2
      - F3
    status: closed
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-09-0628-installer-hooks-cross-ide.md; fixes
      124c46a and 0f48aa8; applied in F1 T-001 acceptance and G-1 at materialization
    createdAt: 2026-07-09T11:08:55Z
    validatedAt: 2026-07-09T11:18:44Z
---

# Lessons — F0 (Contrato cross-IDE de hooks)

Distilada no phase-done da F0 e ratificada pelo usuario em 2026-07-09. Nasce do
review-code, que encontrou um bug real na deteccao de ambiente Codex antes da
fallback generica de setup.

- **L-001** (reusable): contrato de host para hooks deve cobrir path de skills e
  path de hook config no mesmo teste.
