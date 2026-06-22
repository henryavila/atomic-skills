---
schemaVersion: "0.2"
slug: design-brief-source-of-truth-f1-reconstrucao-artefato-e-codigo
projectId: atomic-skills
parentPlan: design-brief-source-of-truth
lessons:
  - id: L-001
    statement: O emitCatalog (cujo job central é gravar no FS) nunca rodou contra um
      filesystem real — todo teste injetava um stub de writeFile — então o mkdirSync
      ausente (ENOENT no 1º run, o caso de uso primário) passava verde e só caiu no
      review-code de contexto-limpo rodando o caminho real.
    corrective: Para uma função cujo job central é um efeito de I/O, manter ≥1 teste que
      roda o writer REAL contra um tmp dir (mkdtempSync) e lê o resultado de volta;
      reservar stubs para injeção de erro/branch, não para o efeito sob teste.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-16-1518-design-brief-source-of-truth-f1.md
    createdAt: 2026-06-16T15:18:21Z
    validatedAt: 2026-06-16T15:18:21Z
  - id: L-002
    statement: sources.js emitia um candidato de heading E um de inline para a mesma página
      num único doc; a máquina de divergência então reportava isso como conflito doc-vs-doc
      fantasma — minando o objetivo anti-fadiga que a própria fase existe para servir.
    corrective: Quando múltiplos modos de extração podem casar a mesma entidade lógica numa
      fonte, fundir por-fonte ANTES da comparação cross-source; duas menções num documento
      são uma testemunha, não duas (divergência cross-source é preservada pela fusão por-arquivo).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-16-1518-design-brief-source-of-truth-f1.md
    createdAt: 2026-06-16T15:18:21Z
    validatedAt: 2026-06-16T15:18:21Z
---

# Lessons — F1 Reconstrução (justapor + confirmação-por-divergência)

Distiladas no phase-done da F1 a partir de sinais reais de falha: 1 critical (L-001, persist sem
mkdir mascarado por stub) e 1 major (L-002, double-emit→conflito-fantasma) achados pelo review-code
local de contexto-limpo sobre `5d8efe9`. Ratificadas pelo operador. As `scope: reusable` +
`status: open` são dispostas no início de cada fase futura via `node scripts/list-lessons.js --phase <id>`.
