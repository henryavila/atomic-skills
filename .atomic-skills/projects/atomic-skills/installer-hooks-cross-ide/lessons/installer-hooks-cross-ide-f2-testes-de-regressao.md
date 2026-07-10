---
schemaVersion: "0.1"
slug: installer-hooks-cross-ide-f2-testes-de-regressao
projectId: atomic-skills
parentPlan: installer-hooks-cross-ide
lessons:
  - id: L-001
    statement: Teste de matriz cross-IDE nao pode duplicar lista publica de hosts;
      isso deixa a cobertura de documentacao livre para divergir da configuracao
      runtime.
    corrective: Quando uma fase cria asserts sobre hosts ou IDEs publicos, importar
      a fonte canonica (`PUBLIC_IDE_IDS` ou config equivalente) nos testes de
      docs e runtime, deixando a matriz local apenas para expectations de paths
      e contratos.
    scope: reusable
    appliesTo: []
    status: closed
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-09-1439-installer-hooks-cross-ide-f2-local.md;
      finding menor corrigida no commit 65e003a
    createdAt: 2026-07-10T10:28:53Z
    validatedAt: 2026-07-10T12:11:11.688Z
---

# Lessons — F2 (Testes de regressao)

Distilada no phase-done da F2 e ratificada pelo usuario em 2026-07-10. Nasce do
review local, que encontrou uma lacuna menor: `tests/project.test.js` duplicava
a lista de hosts publicos em vez de importar a fonte canonica `PUBLIC_IDE_IDS`.

- **L-001** (reusable): testes de matriz cross-IDE devem importar a fonte
  canonica da lista publica de hosts e reservar matrizes locais para
  expectations de paths e contratos.
