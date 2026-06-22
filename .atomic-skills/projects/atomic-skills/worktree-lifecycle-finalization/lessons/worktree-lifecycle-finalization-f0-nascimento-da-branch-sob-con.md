---
schemaVersion: "0.2"
slug: worktree-lifecycle-finalization-f0-nascimento-da-branch-sob-con
projectId: atomic-skills
parentPlan: worktree-lifecycle-finalization
lessons:
  - id: L-001
    statement: O auto-report do Codex (`ℹ tests N`) foi não-confiável nas DUAS dispatches
      de F0 — reportou `tests 1` enquanto a suíte real tinha 5 (T-001) e 9 (T-002) testes;
      a re-execução do verifier na primária merged deu a contagem e o pass corretos.
    corrective: No lane Mode 2, nunca tratar o resumo `-o` do Codex como evidência de
      contagem ou de pass — o único adjudicador é a re-execução do verifier determinístico
      na primária MERGED (verify-claim / GATE-R2). O sinal confirma que o re-run é
      load-bearing, não cerimônia; mantê-lo como passo obrigatório de todo merge-back.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/phases/f0-nascimento-da-branch-sob-con.md
    createdAt: 2026-06-16T17:31:21Z
    validatedAt: 2026-06-16T17:31:21Z
---

# Lessons — F0 Nascimento da branch sob concorrência (worktree-lifecycle-finalization)

Distilada no phase-done de F0 a partir de sinal real: o auto-report de contagem de testes
do Codex divergiu da realidade nas duas dispatches (Mode 2), reforçando que só o re-run do
verifier na primária merged conta como evidência. Ratificada pelo operador. A fase em si foi
limpa (review-code local sem blocker/major; nenhuma task reaberta; nenhum gate deferido). A
`scope: reusable` + `status: open` é disposta no início de cada fase futura via
`node scripts/list-lessons.js --phase <id>`.
