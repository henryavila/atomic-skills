---
schemaVersion: "0.2"
slug: worktree-lifecycle-finalization-f1-integrationref-configuravel
projectId: atomic-skills
parentPlan: worktree-lifecycle-finalization
lessons:
  - id: L-001
    statement: >-
      O resolver puro `resolveIntegrationRef` (scripts/integration-ref.js) lia
      `routingConfig.integrationRef` pela cadeia de protótipos (não-OWN), e o
      doc-string prometia nunca-assume-em-silêncio de forma ampla demais — para
      input malformado (não-string OWN) ele caía no default silenciosamente. No
      review-gate --mode=both o pass BLIND cross-model (Codex) pegou a leitura de
      protótipo (F-001), DISJOINTO do pass local; o pass local pegou a over-promise
      do doc (#1). A reconciliação informed dropou F-001 como inalcançável sob
      JSON.parse, mas o guard foi aplicado como hardening barato.
    corrective: >-
      Numa função pura sobre conteúdo externo já parseado (config/JSON), ler só
      propriedade OWN (Object.hasOwn) antes de honrar um campo, e escopar promessas
      absolutas do doc-string ao caso exato honrado (aqui o not-configured nunca é
      assumido é honrado; o default é fallback documentado, não uma promessa de
      nunca-assumir). Rodar review-code --mode=both em mudança de contrato/resolver:
      o pass cross-model pega a classe own-vs-inherited que o mesmo-modelo local não
      enxerga.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      .atomic-skills/reviews/2026-06-17-1414-wlf-f1-integrationref.md (codex blind
      F-001 + local #1); fix commit 357f49e (Object.hasOwn + doc-contract +
      inherited-prop test)
    createdAt: 2026-06-17T14:14:34Z
    validatedAt: 2026-06-17T14:14:34Z
  - id: L-002
    statement: >-
      O campo aditivo `integrationRef` (string opcional em routing.schema.json)
      levantou o caso whitespace-passa-minLength-1-e-é-honrado-como-declared em
      AMBOS os revisores (local #3 + codex F-002). A reconciliação informed do Codex
      dropou-o sob a constraint de que a validade de FORMATO do ref (whitespace,
      control chars, git check-ref-format) e o uso real contra git moram no
      consumidor (project finalize, F3), fora do diff aditivo da F1.
    corrective: >-
      Para um campo de ref/identificador configurável, o schema valida só SHAPE
      (string não-vazia, minLength 1); a validade de FORMATO/semântica (por exemplo
      formato de git-ref via git check-ref-format) pertence ao consumidor que usa o
      valor contra o sistema externo — deferir lá, não meia-validar no schema aditivo
      (um pattern parcial dá falsa confiança e duplica a validação real do ponto de
      uso). Locus do consumo: F2 (teardown verifica contra o ref) e F3 (finalize
      cria/usa o ref).
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: >-
      .atomic-skills/reviews/2026-06-17-1414-wlf-f1-integrationref.md (local #3 +
      codex F-002, dropped -> deferred to F3); fix commit 357f49e
    createdAt: 2026-06-17T14:14:34Z
    validatedAt: 2026-06-17T14:14:34Z
---

# Lessons — F1 integrationRef configurável (worktree-lifecycle-finalization)

Distiladas no phase-done de F1 a partir de sinal real: o review-gate `--mode=both`
sobre o diff da fase (`b50a6dd..HEAD`). O pass local (envelope selado) achou 1 major
(over-promise de doc/contrato no resolver) + 3 minors; o pass Codex blind achou um
finding DISJOINTO (F-001, leitura de propriedade herdada pela cadeia de protótipos) que
o local não viu, mais o whitespace (F-002, corroborando o local #3). A reconciliação
informed do Codex dropou ambos os blind sob constraints verificáveis (resolver opera
sobre conteúdo schema-válido de JSON.parse; validade de formato do ref mora no
consumidor F3) — verdict final `approve`. Ambas ratificadas pelo operador.

**Confirmação (não-lição nova):** a `design-brief` `L-001` (rodar `review-code
--mode=both` para um contrato/schema porta-de-mão-única; o pass cross-model pega o que o
local mesmo-modelo não pega) **validou-se aqui** — o Codex pegou a leitura de protótipo
(F-001), disjunta do pass local. Nenhuma lição nova; é um data point confirmatório que
sustenta manter o `--mode=both` para fases de contrato/schema.

**Confirmação (não-lição nova):** a `mode2 L-001` (o auto-report `-o` do Codex é
não-confiável; o adjudicador é o re-run do verifier na primária MERGED) segurou nas DUAS
dispatches Mode 2 desta fase (T-001 e T-002): o Codex auto-reportou pass; o adjudicador
foi sempre o re-run determinístico na primária merged (4/4 e 6/6). O corrective fez seu
trabalho — nenhuma lição nova.
