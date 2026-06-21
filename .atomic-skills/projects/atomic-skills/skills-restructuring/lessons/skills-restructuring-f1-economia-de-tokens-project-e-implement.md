---
schemaVersion: "0.2"
slug: skills-restructuring-f1-economia-de-tokens-project-e-implement
projectId: atomic-skills
parentPlan: skills-restructuring
lessons:
  - id: L-F1-1
    statement: >-
      Um gap de leniência entre o gate de admissão SPEC (scripts/lint-source.js
      isDeterministicVerifier, que decide "determinístico" só pelo token `kind <X>`) e o
      materializer do verifier por-task introduzido em T1.5 (src/decompose.js
      parseTaskVerifier) + o schema deixou um `verifier: kind shell` (sem command) passar
      na admissão mas materializar um objeto `{kind:shell}` schema-inválido que HARD-FALHA
      o validate-state. Gate admite → materialize emite inválido → validador rejeita.
    corrective: >-
      Quando um gate e um materializer compartilham um contrato (admite ↔ produz), teste os
      inputs-limite degenerados que o gate aceita contra o schema de saída do materializer —
      adicione o caso do verifier bare/incompleto. Locus: alinhar a checagem de completude em
      lint-source.js (isDeterministicVerifier/lintSpec) aos campos required por-kind do schema,
      e endurecer parseTaskVerifier para nunca emitir um objeto verifier incompleto. Heurística
      geral: um gate que afirma "X é válido" e um produtor que materializa X devem concordar no
      mesmo schema; cubra o boundary que o gate é leniente o bastante para deixar passar.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      .atomic-skills/reviews/2026-06-16-1428-skills-restructuring-f1.md (finding #1 + #2,
      follow-up FU-F1-1); verificado em lint-source.js:275-276,351-356 e
      decompose.js:354,362,366,368,370,877.
    createdAt: 2026-06-16T14:28:01Z
    validatedAt: 2026-06-16T14:28:01Z
---

# Lessons — F1 Economia de tokens: project e implement (skills-restructuring)

Destilada no phase-done da F1 a partir de um sinal real: 1 finding major do review local
(`review-code --mode=local` sobre `2d6b618..390d447`) — drift de contrato entre o gate de
admissão SPEC, o materializer de verifier por-task (novo em T1.5) e o schema. Ratificada pelo
operador. O finding foi deferido a uma task de `fix` dedicada (FU-F1-1), não corrigido nesta
fase (toca lint-source.js, fora do diff de F1). `scope: reusable` + `status: open` é disposta no
início de cada fase futura via `node scripts/list-lessons.js --phase <id>` — relevante porque
F2/F3 tocam mais dessa superfície gate↔materialize.
