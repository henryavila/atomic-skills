---
schemaVersion: "0.1"
slug: installer-hooks-cross-ide-f1-setup-e-documentacao
projectId: atomic-skills
parentPlan: installer-hooks-cross-ide
lessons:
  - id: L-001
    statement: Verifier de gate nao deve passar script `.sh` para `node --test`;
      isso falha com `ERR_UNKNOWN_FILE_EXTENSION`.
    corrective: Quando um gate combinar teste Node e teste shell, usar comando shell
      explicito como `node --test tests/project.test.js && bash
      tests/hooks/session-start.test.sh`.
    scope: reusable
    appliesTo:
      - F2
      - F3
    status: closed
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-09-1148-installer-hooks-cross-ide-f1-local.md;
      G-2 failed with ERR_UNKNOWN_FILE_EXTENSION before verifier correction
    createdAt: 2026-07-09T13:18:57Z
    validatedAt: 2026-07-10T12:11:11.688Z
---

# Lessons — F1 (Setup e documentacao)

Distilada no phase-done da F1 e ratificada pelo usuario em 2026-07-09. Nasce do
gate G-2, que expos um verifier materializado com runner errado para shell test.

- **L-001** (reusable): gates que combinam Node test e shell test precisam usar
  `&& bash <script>.sh`, nao passar o script `.sh` para `node --test`.
