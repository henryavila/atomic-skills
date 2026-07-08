---
schemaVersion: "0.1"
slug: help-command-f0-contrato-esqueleto
projectId: atomic-skills
parentPlan: help-command
lessons:
  - id: L-001
    statement: O asset F0 parafraseou "reusar o mecanismo de `status --browser`"
      como o comando cru `open`/`xdg-open`, descartando silenciosamente o guard
      WSL2 embutido no helper canônico `open_url`.
    corrective: Em qualquer spec/asset que delega a outro mecanismo (o `--html` de
      F2), cite o helper canônico pelo nome + arquivo (`open_url` em
      `project-view.md`), nunca o comando cru — e valide que o comando citado
      casa o canônico.
    scope: reusable
    appliesTo:
      - F2
    status: closed
    confidence: 2
    evidence: "review-code local finding #1 (phase-done F0); ver bloco Self-review
      da iniciativa arquivada"
    createdAt: 2026-07-05T12:40:24Z
    validatedAt: 2026-07-07T19:33:21Z
  - id: L-002
    statement: A dispatch-row `help`/`help --html`/`next` → `project-help.md` é
      verificada só pelo grep one-shot do gate G-3, sem asserção persistente na
      suíte — uma edição futura poderia derrubar o alias `next` verde.
    corrective: Em F3 (`help-vocab.test.js`), adicionar uma asserção em
      `project.test.js` que trave o mapeamento `help`/`help --html`/`next` →
      `project-help.md`, espelhando as asserções por-subcomando existentes.
    scope: reusable
    appliesTo:
      - F3
    status: closed
    confidence: 2
    evidence: "review-code local finding #2 (phase-done F0); applied at F3
      materialization via T-001 tests/project.test.js dispatch assertion"
    createdAt: 2026-07-05T12:40:24Z
    validatedAt: 2026-07-08T01:40:29Z
---


# Lessons — F0 (Contrato + esqueleto)

Distiladas no phase-done da F0 (2026-07-05), ratificadas pelo usuário. Ambas nascem
dos 2 findings minor do review-code local do diff da fase (`11b1543..HEAD`).

- **L-001** (reusable → F2): specs que delegam a outro mecanismo devem citar o helper
  canônico pelo nome, não parafrasear o comando cru (o guard se perde na paráfrase).
- **L-002** (reusable → F3): a dispatch-row nova precisa de asserção persistente na
  suíte, não só do grep de gate.
