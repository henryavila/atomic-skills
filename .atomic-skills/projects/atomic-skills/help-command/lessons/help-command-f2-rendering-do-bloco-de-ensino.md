---
schemaVersion: "0.1"
slug: help-command-f2-rendering-do-bloco-de-ensino
projectId: atomic-skills
parentPlan: help-command
lessons:
  - id: L-001
    statement: O contrato "HTML presente" precisa testar arquivo regular, não só
      existência de path; um diretório em `docs/design/project-onboarding/index.html`
      passava pelo render/opener.
    corrective: Para próximas fases que adicionem recursos por caminho fixo, cobrir
      "path existe mas não é arquivo" no teste de resolução antes de ativar UI/CTA.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: `.atomic-skills/reviews/2026-07-07-1958-help-command-f2-local.md`;
      fix `1ed2f9e`
    createdAt: 2026-07-08T01:22:16Z
    ratifiedAt: 2026-07-08T01:22:16Z
---

# Lessons — F2 (Rendering do bloco de ensino)

Distilada no phase-done da F2 (2026-07-07) e ratificada pelo usuário em
2026-07-08. Nasce do review-code local do diff da fase, que encontrou um bug real
no contrato de presença do guia HTML.

- **L-001** (reusable): caminhos fixos que habilitam UI/CTA devem testar arquivo
  regular, não só existência de path.
