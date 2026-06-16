---
schemaVersion: "0.1"
slug: design-brief-source-of-truth-f2-integracao-no-design-brief
title: Integração no design-brief
goal: o design-brief consome o catálogo com reconstrução-primeiro, comuta o R2
  por regime, e persiste o catálogo na árvore do app-alvo.
status: active
branch: plan/design-brief
started: 2026-06-16T15:34:48Z
lastUpdated: 2026-06-16T15:34:48Z
nextAction: "RE-DECOMPOR F2 antes do implement: as 3 tasks são anteriores à Revisão 2
  e têm verifiers inadequados (grep-presença em T-001/T-002; persist.test.js já-passa em T-003)."
parentPlan: design-brief-source-of-truth
phaseId: F2
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: o design-brief consome o catálogo, o R2 comuta por regime, e o
      catálogo persiste no app-alvo passando pela validação emit-time.
    status: pending
    verifier:
      kind: shell
      command: node --test test/app-map/persist.test.js && grep -qi 'app-map'
        skills/core/design-brief.md
    verifierLabel: "shell: node --test test/app-map/persist.test.js && grep -qi 'app-m…"
stack:
  - id: 1
    title: Integração no design-brief
    type: task
    openedAt: 2026-06-15T19:46:08.157Z
tasks:
  - id: T-001
    title: Step 2 consome o catálogo
    status: pending
    lastUpdated: 2026-06-15T19:46:08.157Z
    summary: Step 2 lê o catálogo e reconstrói antes; route-Glob vira legado opt-in.
    description: "Reescreve o Step 2 para ler o catálogo e rodar a reconstrução
      antes de consumir. Files: skills/core/design-brief.md,
      skills/shared/design-brief-assets/screens-prompt.md"
    scopeBoundary:
      - não tocar o coração anti-contaminação (camadas 2 e 3); só o Step 2 de
        inventário.
    acceptance:
      - o Step 2 lê o catálogo
      - ausente ou stale dispara reconstrução primeiro
      - o route-Glob ao vivo aparece como legado opt-in, nunca o default.
    verifier:
      kind: shell
      command: grep -qi 'app-map' skills/core/design-brief.md
  - id: T-002
    title: Switch do R2 por regime
    status: pending
    lastUpdated: 2026-06-15T19:46:08.157Z
    summary: R2 minera em brownfield e pergunta em greenfield; nunca silencia.
    description: "Faz o R2 minerar do código em brownfield e perguntar ao operador
      em greenfield. Files: skills/core/design-brief.md,
      skills/shared/design-brief-assets/anti-contamination.md"
    scopeBoundary:
      - não alterar a regra de silêncio da camada 1; só a fonte dos parâmetros
        do R2.
    acceptance:
      - brownfield minera valores do código
      - greenfield pergunta ao operador semeado pelos artefatos
      - nunca silencia o parâmetro.
    verifier:
      kind: shell
      command: grep -qi 'greenfield' skills/core/design-brief.md
  - id: T-003
    title: Persistência na árvore do app-alvo
    status: pending
    lastUpdated: 2026-06-15T17:00:00.000Z
    summary: Grava o catálogo na árvore do app-alvo, validando na emissão.
    description: "Grava o catálogo no app-alvo, validando na emissão. Files:
      src/app-map/persist.js, test/app-map/persist.test.js"
    scopeBoundary:
      - catálogo na árvore do app-alvo, não na do repo, salvo dogfooding do
        próprio atomic-skills.
    acceptance:
      - grava o app-map.json e o espelho .md sob a árvore do app-alvo
      - o project-id vem do basename do alvo ou é fornecido
      - valida na emissão antes de gravar.
      - path exato app-alvo/.atomic-skills/app-map/app-map.json + espelho .md,
        marcados como output gerado (regenerado, nunca editado à mão).
    verifier:
      kind: shell
      command: node --test test/app-map/persist.test.js
parked: []
emerged: []
summary: "Pluga o catálogo no design-brief: Step 2, switch do R2 e persistência
  no app-alvo."
planTitle: "design-brief: reconstrução da fonte-de-verdade (catálogo app-map)"
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F2 — Integração no design-brief**. Materializada no phase-done da F1
(2026-06-16): metadados stale corrigidos (`branch` era `plan/skills-restructuring`; `started`/
`lastUpdated` herdados do scaffold), ativada, e a phase-start lessons gate dispositada (abaixo).

> **NÃO SPEC-READY — re-decompor antes do implement.** As 3 tasks T-001…T-003 abaixo foram
> decompostas em 2026-06-15, **antes da Revisão 2 da F1** (justapor + confirmação-por-divergência,
> persistência como memória-de-decisão, schema 0.2, confirmDivergences). O DESIGN (Revisão 2) já
> cobre a F2 (D5' persistência, D6' switch R2, Step 2 reconstrução-primeiro, path `<app-alvo>/
> .atomic-skills/app-map/`), então a F2 **não volta ao DESIGN — volta ao DECOMPOSE+SPEC**. Problemas:
> - **T-001/T-002:** verifier `grep -qi 'app-map'/'greenfield'` é presença-de-string, não comportamento
>   — false-green trivial (escrever a palavra passa). O alvo é prosa de skill (`skills/core/design-brief.md`),
>   então o verifier precisa checar a *estrutura* da integração, não a menção.
> - **T-003:** verifier `node --test test/app-map/persist.test.js` **já passa** (persist.js foi
>   construído na F1/T-005) — não gateia o trabalho novo de T-003 (resolução do path do app-alvo +
>   wiring no design-brief + marcar output gerado). Verifier tautológico.

## Decisions

- **2026-06-16 — Lessons da phase-start gate (disposição):**
  - **[F1 L-001] APLICAR** a T-003: persist grava arquivos reais na árvore do app-alvo — a nova task
    deve ter ≥1 teste contra FS real (`mkdtempSync`), não só stub (a F1 já adicionou esse teste em
    `persist.test.js`; T-003 deve reusá-lo/estendê-lo para o path do app-alvo).
  - **[F0 L-003] APLICAR**: qualquer teste novo da F2 deve ser descoberto pelo `npm test` (glob
    `test/**` já ampliado na F0); confirmar, não assumir.
  - **[F0 L-001] MANTER**: a F2 consome o contrato porta-de-mão-única mas não produz schema novo;
    rodar `review-code` no diff de integração (modo `local` salvo se mexer no schema → `both`).
  - **[F1 L-002] / [F0 L-002, L-004] MANTER como referência** (específicas de extração/schema; não
    diretamente acionáveis na integração de prosa).

## Links

- Doc de design (Revisão 2, fonte da F2): `../design.md` (D5'/D6', Chosen approach pós-Revisão 2)
- Alvo da integração: `skills/core/design-brief.md` (Step 2 / R2), `skills/shared/design-brief-assets/`
- Contratos construídos na F1: `src/app-map/{sources,code-scan,diverge,confirm,persist,hash}.js`
