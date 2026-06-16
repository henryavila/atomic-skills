---
schemaVersion: "0.1"
slug: app-map-conflict-arbitration
title: "app-map: descritor de conflito rico + canal de arbitragem"
version: "1.0"
status: active
started: 2026-06-16T18:38:32.145Z
lastUpdated: 2026-06-16T18:38:32.145Z
branch: plan/design-brief
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Nunca escolher no silêncio
    body: toda testemunha de um conflito é preservada com sua proveniência; nenhuma
      é descartada por limite de formato. O operador arbitra sobre o conjunto
      completo.
  - id: P2
    title: Proveniência derivada-na-origem
    body: "`kind` (code|artefact) é computado pelo produtor com a regra canônica
      (source casa codeEvidence.path), nunca afirmado independentemente nem
      re-derivado por consumidor."
  - id: P3
    title: Aditivo e versionado
    body: o bump 0.2→0.3 entra como ramo condicional; catálogos 0.1/0.2 seguem lendo
      válidos; porta de direção única respeitada.
  - id: P4
    title: Arbitragem no agente
    body: a resolução de conflito acontece no agente design-brief (via
      ASK_USER_QUESTION_TOOL) chamando persistReconstruction; o CLI não persiste
      decisão.
glossary:
  - term: witness (testemunha)
    definition: "uma afirmação de valor para um campo de página, com sua fonte
      (source) e a natureza dela (kind: code|artefact)."
  - term: conflict
    definition: um campo de página com ≥2 testemunhas discordantes, arbitrado pelo
      operador.
  - term: kind derivado-na-origem
    definition: a classificação code/artefato computada pelo produtor a partir da
      source, não gravada como verdade independente nem recomputada a jusante.
phases:
  - id: F0
    slug: app-map-conflict-arbitration-f0-contrato-schema-0-3-descritor-w
    title: "Contrato: schema 0.3 + descritor witnesses"
    goal: Estabelecer o contrato 0.3 do conflito — o descritor `witnesses[]` no
      schema + a regra de integridade no validador — validável emit-time, antes
      de qualquer produtor ou consumidor emitir a forma nova.
    dependsOn: []
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F0-G1
          description: O schema 0.3 valida o descritor witnesses, rejeita slots proibidos
            e kind inválido, e mantém 0.1/0.2 válidos; o validador reforça a
            integridade resolution.choice em witnesses.
          status: pending
          verifier:
            kind: shell
            command: node --test test/app-map/schema.test.js test/app-map/validate.test.js
            expectExitCode: 0
    status: active
  - id: F1
    slug: app-map-conflict-arbitration-f1-produtor-consumidores-e-prosa
    title: Produtor, consumidores e prosa
    goal: O produtor emite witnesses[] com kind derivado-na-origem e resolution por
      valor+source; o mirror .md lista as N testemunhas; a prosa do §2 do
      design-brief deixa de prometer um --persist que persiste arbitragem;
      cobertura inclui o caso N≥3.
    dependsOn:
      - F0
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F1-G1
          description: A reconstrução end-to-end emite witnesses 0.3 com N≥3 preservado e
            validável; o mirror lista as testemunhas; a prosa do §2 reflete a
            arbitragem programático-only.
          status: pending
          verifier:
            kind: shell
            command: node --test test/app-map/reconstruct.test.js
              test/app-map/persist.test.js
            expectExitCode: 0
    status: pending
references:
  - kind: repo-path
    path: .atomic-skills/projects/atomic-skills/app-map-conflict-arbitration/design.md
    label: "DESIGN — contrato (resolution.choice por value+source, kind derivado-na-origem, blast radius); F0/F1 leem antes de implementar"
    inside_repo: true
planActive: true
planTitle: "app-map: descritor de conflito rico + canal de arbitragem"
---

# app-map: descritor de conflito rico + canal de arbitragem

## 1. Context

Evolui o descritor de conflito do catálogo `app-map` para representar N testemunhas (≥2) sem descarte silencioso, honrando o P2 — nunca escolher no silêncio. Forma decidida por debate de 4 vozes (abordagem C "derivada-na-origem"): `witnesses: [{value, source, kind}]` substitui os 2 slots posicionais, `kind` derivado pelo produtor, bump schemaVersion 0.2→0.3, arbitragem programático-only. Fonte de verdade: `design.md` deste plano. F0 fecha o contrato (schema + validador); F1 produz e consome a forma nova.

## 2. Inviolable principles

- **P1 Nunca escolher no silêncio** — toda testemunha de um conflito é preservada com sua proveniência; nenhuma é descartada por limite de formato. O operador arbitra sobre o conjunto completo.
- **P2 Proveniência derivada-na-origem** — `kind` (code|artefact) é computado pelo produtor com a regra canônica (source casa codeEvidence.path), nunca afirmado independentemente nem re-derivado por consumidor.
- **P3 Aditivo e versionado** — o bump 0.2→0.3 entra como ramo condicional; catálogos 0.1/0.2 seguem lendo válidos; porta de direção única respeitada.
- **P4 Arbitragem no agente** — a resolução de conflito acontece no agente design-brief (via ASK_USER_QUESTION_TOOL) chamando persistReconstruction; o CLI não persiste decisão.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Self-review against code-quality gates

- **G1 read-before-claim**: N/A para o plano — ele decompõe o `design.md` aprovado; os claims sobre código existente (diverge agrega sources; codeValue deriva por proveniência; schema coexiste por versão) vivem no `design.md` com `verified_by:`. Nenhuma asserção nova sobre código existente no corpo do plano.
- **G2 soft-language**: ban-list escaneada no plano + source + design → 0 ocorrências.
- **G6 reference-or-strike**: cada task carrega Files / scopeBoundary / acceptance / verifier determinístico (SPEC gate `node scripts/lint-source.js source.md --spec` → EXIT=0); o WHY vive no `design.md` referenciado.
- **DESIGN gate**: `design.md` aprovado via debate de 4 vozes (`atomic-skills:debate`, 2026-06-16 — abordagem C derivada-na-origem, dissenso preservado) + `node scripts/lint-design.js design.md --migration` → EXIT=0.
- **Review interno (Stage 8a)**: deps consistentes (F1→F0), 0 soft-language, SPEC clean, validate-state verde (plan + 2 phases). Codex cross-model (Stage 8b): pendente do operador.

## Reviews

- DESIGN (debate 4 vozes, 2026-06-16): abordagem C "derivada-na-origem" recomendada; A fallback; B rejeitada 3×1; D rejeitada 4×0. Origem: review-code da F2 `.atomic-skills/reviews/2026-06-16-1702-design-brief-source-of-truth-f2.md` (findings #2/#3).
- PLAN (codex cross-model, Stage 8b, 2026-06-16): `needs_changes` cego (0B/0C/5maj) → `needs_changes` informado (0B/0C/1maj); framing Δ 5→1 (4 dropados por constraint). Único finding (references[] vazio) **corrigido**. Review file: `.atomic-skills/reviews/2026-06-16-1852-app-map-conflict-arbitration-plan.md`.
