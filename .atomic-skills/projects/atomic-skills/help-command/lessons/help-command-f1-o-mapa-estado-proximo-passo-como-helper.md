---
schemaVersion: "0.1"
slug: help-command-f1-o-mapa-estado-proximo-passo-como-helper
projectId: atomic-skills
parentPlan: help-command
lessons:
  - id: L-001
    statement: A detecção de "a fase current é descriptor-only" foi feita por
      `fm.phaseId ≠ currentPhase`, mas o comando corretivo `materialize <phase>`
      tirou seu argumento da iniciativa RESOLVIDA por fallback (uma fase já
      materializada), não de `currentPhase` — emitindo `materialize <fase-errada>`.
    corrective: Quando um estado é detectado por "resolvido ≠ current", os
      argumentos do comando corretivo têm que vir do ponteiro `current`, nunca da
      entidade resolvida por fallback — no `resolveState` de
      `scripts/compute-help.js`, o override `phaseId → currentPhase` quando
      descriptor-only.
    scope: reusable
    appliesTo:
      - F2
    status: open
    confidence: 2
    evidence: "review-code local finding #1 (phase-done F1); fix commit c3c2135"
    createdAt: 2026-07-05T15:34:11Z
    validatedAt: 2026-07-05T15:34:11Z
  - id: L-002
    statement: A lógica dividida em núcleo puro (`classify`) + camada de IO
      (`resolveState`) teve o núcleo bem-coberto por fixtures sintéticos, mas a
      derivação frontmatter→flags (a parte mais bug-prone) só tinha 1 teste
      happy-path — e o bug do L-001 morava exatamente nessa costura não-testada,
      passando verde em 25 testes.
    corrective: Quando a lógica separa `puro(classify)` + `IO(derivação)`, a
      camada de IO precisa de fixtures de integração por-branch, não só o núcleo
      puro — senão regressões na derivação de flags shipam verdes.
    scope: reusable
    appliesTo:
      - F2
    status: open
    confidence: 2
    evidence: "review-code local finding #2 (phase-done F1); guardado pelos 2
      fixtures de integração descriptor-only/blocked adicionados no fix c3c2135"
    createdAt: 2026-07-05T15:34:11Z
    validatedAt: 2026-07-05T15:34:11Z
---

# Lessons — F1 (O mapa estado→próximo-passo como helper determinístico)

Distiladas no phase-done da F1 (2026-07-05), ratificadas pelo usuário. Ambas nascem
do review-code local do diff da fase (`abcf00c..HEAD`): o finding #1 major (bug real)
e a lacuna de cobertura (#2) que o escondeu.

- **L-001** (reusable → F2): quando um estado é detectado por "resolvido ≠ current",
  o comando corretivo deve tirar seus argumentos do ponteiro `current`, não da
  entidade resolvida por fallback.
- **L-002** (reusable → F2): a costura pura/IO precisa de fixtures de integração
  por-branch na camada de IO — o núcleo puro testado não cobre a derivação de flags,
  que é onde o bug morava.
