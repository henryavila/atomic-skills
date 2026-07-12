---
schemaVersion: "0.2"
slug: integrity-remediation-f0-runtime-autocontido-e-setup-confiavel
projectId: atomic-skills
parentPlan: integrity-remediation
lessons:
  - id: L-001
    statement: Um runtime publicado pode false-green quando o teste inspeciona o
      pacote ou aponta para o checkout sem executar a instalação consumível real.
    corrective: Locus - verifiers de distribuição e runtime. Empacotar o `.tgz`,
      instalá-lo sob HOME e CWD isolados, executar seus entrypoints e rejeitar
      qualquer resolução para o checkout fonte.
    scope: reusable
    appliesTo:
      - F1
      - F2
      - F5
      - F6
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-12-1120-integrity-remediation-f0-code-review.md
    createdAt: 2026-07-12T12:48:08Z
    validatedAt: 2026-07-12T12:48:08Z
  - id: L-002
    statement: Cleanup recursivo por path derivado não prova ownership e pode
      atingir dados externos quando um ancestor é symlink ou o txDir já existia.
    corrective: Locus - autoridades de mutação filesystem. Canonicalizar a raiz,
      recusar componentes symlink, derivar journal paths, criar txDir com
      exclusividade e remover somente diretórios criados pela própria operação.
    scope: reusable
    appliesTo:
      - F4
      - F6
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-12-1120-integrity-remediation-f0-code-review.md#f-003
    createdAt: 2026-07-12T12:48:08Z
    validatedAt: 2026-07-12T12:48:08Z
  - id: L-003
    statement: Uma transação pode ser recuperável em bytes e ainda publicar estado
      semanticamente parcial, obsoleto ou contraditório.
    corrective: Locus - autoridade de transições em F4. Construir candidatos com
      todos os metadados ratificados, exigir expected-before sob exclusão por plan
      e validar foco único quando parallelismAllowed for false.
    scope: reusable
    appliesTo:
      - F4
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-12-1120-integrity-remediation-f0-code-review.md#f-001-f-002-f-004
    createdAt: 2026-07-12T12:48:08Z
    validatedAt: 2026-07-12T12:48:08Z
  - id: L-004
    statement: Logs e projeções derivados ficam silenciosamente inúteis quando
      writers misturam formatos ou uma transição não recompõe os rollups.
    corrective: Locus - observabilidade e lifecycle em F2/F4. Manter um único
      formato por log, migrar atomically com reader compatível e regenerar índices
      a partir do estado canônico com teste de consistência.
    scope: reusable
    appliesTo:
      - F2
      - F4
      - F6
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-07-12-1120-integrity-remediation-f0-code-review.md#f-005-f-006
    createdAt: 2026-07-12T12:48:08Z
    validatedAt: 2026-07-12T12:48:08Z
---

# Lessons — F0 Runtime autocontido e setup confiável

Quatro lessons destiladas de falhas reais da fase e dos findings mantidos pelo
review Codex. Ratificadas pelo usuário em 2026-07-12T12:48:08Z; todas permanecem
abertas para disposition nos gates de entrada das fases indicadas.
