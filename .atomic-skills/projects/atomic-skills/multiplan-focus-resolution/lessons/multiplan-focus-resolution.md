---
schemaVersion: "0.2"
slug: multiplan-focus-resolution
projectId: atomic-skills
parentPlan: multiplan-focus-resolution
lessons:
  - id: L-001
    statement: pickFocus (emit-focus.js) caía em pool=activePlans quando nenhum plano
      reivindicava a branch atual, mostrando um plano de outra worktree como foco — um
      sinal falso que os testes de T-005 não cobriam. O review do phase-done pegou.
    corrective: Numa seleção tree-relative (ou qualquer escolha "qual entidade é a
      corrente para ESTE contexto"), quando nenhum claimer casa, retornar vazio + uma flag
      (unclaimedBranch), nunca um candidato arbitrário de outro contexto. Locus
      scripts/emit-focus.js:pickFocus.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-16-1308-code-multiplan-focus-phasedone.md
    createdAt: 2026-06-16T13:08:36Z
    validatedAt: 2026-06-16T13:08:36Z
  - id: L-002
    statement: O agente de review em contexto selado citou file:line que não existiam
      (§1.2 linha 90-92 / um project_chip em §3.1) mesmo quando a substância do finding era
      real em OUTRAS linhas. Loci alucinados com substância verdadeira.
    corrective: G1 read-before-claim na triagem — abrir cada finding no arquivo real antes
      de agir; rejeitar o locus alucinado e só aplicar a correção se a substância se
      confirmar na linha verdadeira. Nunca editar sobre um file:line não verificado.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/2026-06-16-1308-code-multiplan-focus-phasedone.md
    createdAt: 2026-06-16T13:08:36Z
    validatedAt: 2026-06-16T13:08:36Z
---

# Lições — multiplan-focus-resolution F0

Destiladas no phase-done (ratificadas pelo usuário). A próxima fase as superfície via
`node scripts/list-lessons.js --phase <id>`.
