---
schemaVersion: "0.2"
slug: skills-restructuring-f0-pente-fino-de-consistencia
projectId: atomic-skills
parentPlan: skills-restructuring
lessons:
  - id: L-001
    statement: >-
      Ao adicionar o gate G9 em code-quality-gates.md, o passo 2 do próprio protocolo
      "Adding a new gate" (atualizar o matrix rule x skill) foi pulado — G9 entrou só
      como seção, sem linha nem nota no matrix, ao contrário do G8.
    corrective: >-
      Em docs/kb/code-quality-gates.md, ao adicionar um gate, completar na mesma edição a
      seção E a entrada no matrix (linha marcada ou footnote explicando a ausência) —
      seguir o protocolo auto-descrito do doc por inteiro, não só a parte óbvia. Heurística
      geral: quando um doc descreve seu próprio procedimento de manutenção, executar todos
      os passos, não só o evidente.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      f0-pente-fino-de-consistencia.md (Self-review against gates at phase-done); fix em
      commit 8a35a17.
    createdAt: 2026-06-16T12:22:09Z
    validatedAt: 2026-06-16T12:22:09Z
---

# Lessons — F0 Pente fino de consistência (skills-restructuring)

Destilada no phase-done da F0 a partir de um sinal real: 1 finding minor do review local
(`review-code --mode=local` sobre HEAD~1..HEAD) — G9 adicionado sem a entrada de matrix que o
próprio protocolo do doc exige. Ratificada pelo operador. O finding já foi corrigido em
`8a35a17`; a lição captura a regra geral. `scope: reusable` + `status: open` é disposta no
início de cada fase futura via `node scripts/list-lessons.js --phase <id>`.
