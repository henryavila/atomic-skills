---
schemaVersion: "0.2"
slug: phase-materialization-f1-refactor-mecanico-do-decompose-js-beha
projectId: atomic-skills
parentPlan: phase-materialization
lessons:
  - id: L-001
    statement: O gate de fase F1-G1 (`npm test`, um comando amplo) estava vermelho
      na ENTRADA da fase por 6 falhas PRÉ-EXISTENTES de OUTRA feature
      (plan-dependency — o asset `project-dependencies.md` + a série
      `planEdges.json`), totalmente não-relacionadas ao work mecânico do F1. O
      gate amplo ficou refém de drift alheio e bloqueou `phase-done` até que as
      6 fossem root-cause-adas e corrigidas — decisão do operador foi CORRIGIR
      as 6 (não emendar o gate para escopado).
    corrective: Locus — fronteira entre verificador de gate e o inventário global de
      testes. Quando um gate de fase é um comando amplo (`npm test`/suíte
      cheia), failures pré-existentes e não-relacionadas de outras features
      podem bloquear a conclusão da fase corrente. Antes de tratar, root-cause
      CADA falha (expectation stale vs bug real) — nunca bumpar cego, pois isso
      mascara uma regressão legítima (install copiando largo demais seria um bug
      real escondido por um bump). Corrigir as pré-existentes num commit
      SEPARADO fora do `scopeBoundary` da fase corrente (são trabalho alheio,
      não da fase). Avaliar se gates de fase deveriam ser escopados (`node
      --test 'tests/<dir>/*.test.js'`) quando a suíte cheia carrega drift de
      múltiplas features — trade-off, menos cobertura de regressão cruzada.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: commit 9b5e645 (commit de teste bumpando stale footprint counts para o
      plan-dependency feature) + bloco Self-review do F1 + as 6 assertions stale
      confirmadas (install 70/71/139/51; refresh-state seriesWritten 13) —
      root-cause = 1 asset + 1 série do plan-dependency, não bugs de lógica.
    createdAt: 2026-07-01T08:42:22Z
    validatedAt: 2026-07-01T12:35:00.000Z
---

# Lessons — F1 Refactor mecânico do decompose.js (phase-materialization)

Distilada no phase-done da F1. A fase em si foi clean (review-code local 0
findings, byte-identidade R-ORCH-10 das duas extrações confirmada) — o sinal
real de falha veio do gate amplo F1-G1 (`npm test`) estar vermelho na entrada
por 6 falhas pré-existentes de outra feature (plan-dependency), não do trabalho
do F1. Ratificada pelo operador. Complementar à L-001 da F0 (que tratou do
verificador per-task ESTREITO demais derrubando drift só no gate amplo); esta
trata do gate amplo ficando REFÉM de drift alheio. `scope: reusable` +
`status: open`, disposta no início de cada fase futura via
`node scripts/list-lessons.js --phase <id>`.
