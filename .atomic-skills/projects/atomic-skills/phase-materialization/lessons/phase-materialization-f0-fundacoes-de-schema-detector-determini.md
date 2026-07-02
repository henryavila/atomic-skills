---
schemaVersion: "0.2"
slug: phase-materialization-f0-fundacoes-de-schema-detector-determini
projectId: atomic-skills
parentPlan: phase-materialization
lessons:
  - id: L-001
    statement: T-001 adicionou o sub-schema businessIntent aos 2 schemas-fonte
      (meta/schemas/plan.schema.json + initiative.schema.json) e fechou green no
      seu verificador per-task (node --test business-intent-schema.test.js,
      11/11), mas NÃO regerou o bundle consumer
      assets/aideck-consumer/schema.json gerado a partir deles. O drift ficou
      invisível ao verificador estreito da task e só eclodiu quando o gate de
      fase F0-G1 rodou a suíte mais ampla (tests/schema-drift.test.js falhou
      sobre o bundle desatualizado).
    corrective: Quando uma task muta um FONTE que alimenta um artefato
      GERADO/bundled, parear o verificador per-task com um drift-check — regerar
      o artefato (npm run build:aideck-schema) e rodar o guard de drift (node
      --test tests/schema-drift.test.js). O verificador explícito/estreito
      passar é necessário mas não suficiente — o gap fonte→artefato deve ser
      pego no close da task, não adiado para o gate de fase. Locus — seleção de
      verificador no SPEC admission; em tasks cujo outputs[] inclua ou alimente
      artefato gerado, exigir o passo regen + drift-check como parte do
      verifier.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: drift-fix desta fase (commit chore(schema) regen do bundle em
      67f1257..HEAD) + tests/schema-drift.test.js (guard) + F0-G1 verifier
      amendment (node --test 'tests/phase-materialization/*.test.js')
    createdAt: 2026-06-30T16:10:18Z
    validatedAt: 2026-07-01T12:35:00.000Z
---

# Lessons — F0 Fundações de schema + detector determinístico (phase-materialization)

Distilada no phase-done da F0 a partir de um sinal real de falha — T-001 fechou green
num verificador per-task estreito que não cobria o artefato gerado (schema-drift no
bundle consumer), pego só pelo gate de fase mais amplo. Ratificada pelo operador. A
`scope: reusable` + `status: open` é disposta no início de cada fase futura via
`node scripts/list-lessons.js --phase <id>`.
