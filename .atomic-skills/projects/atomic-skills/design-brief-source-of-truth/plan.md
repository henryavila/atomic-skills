---
schemaVersion: "0.1"
slug: design-brief-source-of-truth
title: "design-brief: reconstrução da fonte-de-verdade (catálogo app-map)"
version: "1.0"
status: active
started: 2026-06-15T19:46:08.157Z
lastUpdated: 2026-06-16T12:00:18Z
branch: plan/design-brief
currentPhase: F2
parallelismAllowed: false
principles:
  - id: P1
    title: Eixo de IA puro
    body: o catálogo nunca descreve interação (camada 2) nem forma visual (camada
      1); só público, acesso, propósito, status e proveniência.
  - id: P2
    title: Nunca escolher no silêncio
    body: divergência entre artefato e código vai ao operador com proveniência;
      resolução nunca é automática.
  - id: P3
    title: Read-only sobre artefatos humanos
    body: a resolução grava no catálogo, jamais muta brainstorms ou plano.
  - id: P4
    title: Reconstrução primeiro
    body: quando o catálogo está ausente ou stale, a reconstrução roda antes do Step
      2 consumir; route-Glob ao vivo é legado opt-in, nunca o default.
  - id: P5
    title: Desenhado para extração
    body: passo isolado e formato standalone, de modo que promover a skill `app-map`
      seja mecânico.
glossary: []
phases:
  - id: F0
    slug: design-brief-source-of-truth-f0-schema-e-validacao-do-catalogo
    title: Schema e validação do catálogo
    goal: estabelecer o contrato persistido do catálogo — schema JSON, validação na
      emissão e cobertura pelo validate-state — antes de qualquer reconstrução
      consumi-lo.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: schema compila, o validador emit-time rejeita catálogo malformado,
            e o validate-state cobre o catálogo durável.
          status: met
          metAt: 2026-06-16T10:51:14Z
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
          evidence:
            verifierKind: manual
            verifiedAt: 2026-06-16T10:51:14Z
            passed: true
            outputSummary: Confirmado pela evidência determinística da iniciativa (shell 8/8
              + validate-state, exit 0 em 009a95b) + review both (2 codex majors
              corrigidos). Review file 2026-06-16-0749.
    status: done
    reviewGate:
      status: passed
      at: 009a95b99e7ed2b939453fcefd8734dc0554e7ec
      mode: both
      reviewFile: .atomic-skills/reviews/2026-06-16-0749-design-brief-source-of-truth-f0.md
      verifiedAt: 2026-06-16T10:51:14Z
    summary: "Fecha o contrato do catálogo: schema, validação na emissão e cobertura
      pelo validate-state."
  - id: F1
    slug: design-brief-source-of-truth-f1-reconstrucao-artefato-e-codigo
    title: Reconstrução (justapor + confirmação-por-divergência)
    goal: gerar o catálogo coletando candidatos de código + artefatos, justapondo
      sem reconciliar no silêncio; operador arbitra só o delta; persistência como
      memória-de-decisão (evidenceHash por-página).
    dependsOn:
      - F0
    subPhaseCount: 5
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: o catálogo sai com existence, divergências e evidenceHash
            por-página; nenhuma divergência é resolvida no silêncio; os fixtures
            greenfield, envenenado e multi-convenção passam.
          status: met
          metAt: 2026-06-16T15:18:21Z
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
          evidence:
            verifierKind: manual
            verifiedAt: 2026-06-16T15:18:21Z
            passed: true
            outputSummary: Confirmado pelo operador no phase-done sobre a evidência
              determinística (exit-gate shell 26/26, exit 0 em 6bfdc3c) — diverge
              poisoned/multi-convenção, code-scan greenfield→[], persist evidenceHash
              por-página + re-run zero-delta. Review local both-not-needed (diff aditivo);
              1 critical + 4 major endereçados (review 2026-06-16-1518).
    reviewGate:
      status: passed
      at: 6bfdc3c1dfadb9a3e88d567bf710c721d9573301
      mode: local
      reviewFile: .atomic-skills/reviews/2026-06-16-1518-design-brief-source-of-truth-f1.md
      verifiedAt: 2026-06-16T15:18:21Z
    status: done
    summary: Coleta candidatos doc+código, justapõe sem reconciliar, operador
      arbitra o delta, e persiste o catálogo (evidenceHash por-página).
  - id: F2
    slug: design-brief-source-of-truth-f2-integracao-no-design-brief
    title: Integração no design-brief
    goal: o design-brief consome o catálogo com reconstrução-primeiro, comuta o R2
      por regime, e persiste o catálogo na árvore do app-alvo.
    dependsOn:
      - F1
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: o design-brief consome o catálogo, o R2 comuta por regime, e o
            catálogo persiste no app-alvo passando pela validação emit-time.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
    summary: "Pluga o catálogo no design-brief: Step 2, switch do R2 e persistência
      no app-alvo."
references: []
planActive: true
planTitle: "design-brief: reconstrução da fonte-de-verdade (catálogo app-map)"
---

# design-brief: reconstrução da fonte-de-verdade (catálogo app-map)

## 1. Context

Enriquece o `design-brief` com uma fase de reconstrução da superfície de páginas que cruza artefatos e código, emite um catálogo de IA persistido (`app-map.json`), e é desenhada para extração futura numa skill `app-map`. Fonte de verdade: o `design.md` aprovado deste plano.

## 2. Inviolable principles

- **P1 Eixo de IA puro** — o catálogo nunca descreve interação (camada 2) nem forma visual (camada 1); só público, acesso, propósito, status e proveniência.
- **P2 Nunca escolher no silêncio** — divergência entre artefato e código vai ao operador com proveniência; resolução nunca é automática.
- **P3 Read-only sobre artefatos humanos** — a resolução grava no catálogo, jamais muta brainstorms ou plano.
- **P4 Reconstrução primeiro** — quando o catálogo está ausente ou stale, a reconstrução roda antes do Step 2 consumir; route-Glob ao vivo é legado opt-in, nunca o default.
- **P5 Desenhado para extração** — passo isolado e formato standalone, de modo que promover a skill `app-map` seja mecânico.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Self-review against code-quality gates

- **G1 read-before-claim**: N/A — o plano decompõe o `design.md` aprovado; claims sobre código existente vivem no design (com `verified_by:`). Nenhuma asserção nova sobre código existente.
- **G2 soft-language**: ban-list scaneado no plano + iniciativas → 0 ocorrências.
- **G6 reference-or-strike**: cada task carrega Files/acceptance/scopeBoundary/verifier determinístico; o WHY vive no design referenciado.
- **Codex review (Stage 8b)**: needs_changes (0B/2C/3M) → todos os 5 endereçados (ver `## Reviews`).

## Reviews

- DESIGN rev1 (both): `.atomic-skills/reviews/2026-06-15-1543-design-brief-source-of-truth.md` — 1B/2C/3M, 6 fixes.
- DESIGN rev2 (codex): `.atomic-skills/reviews/2026-06-15-1620-design-brief-source-of-truth-rev2.md` — 0B/0C/5M, revisão de contrato.
- PLAN (codex, Stage 8b): `.atomic-skills/reviews/2026-06-15-1658-design-brief-source-of-truth-plan.md` — 0B/2C/3M, 5 fixes aplicados.
- DESIGN rev3 / **Revisão 2** (claude, gate critic, 2 rounds): `.atomic-skills/reviews/2026-06-16-1341-design-brief-source-of-truth-rev3.md` — **Approved** (r1 needs_changes 1M/1m → r2 approve_with_nits 1m/1nit, todos endereçados). Re-design após defeito encontrado no IMPLEMENT + debate de 4 vozes. **F1 (T-001…T-004) invalidada; re-decompor no PLAN.**
