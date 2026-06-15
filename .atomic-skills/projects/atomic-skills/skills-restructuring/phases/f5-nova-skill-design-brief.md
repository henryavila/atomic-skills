---
schemaVersion: "0.1"
slug: skills-restructuring-f5-nova-skill-design-brief
title: "Nova skill: design-brief"
goal: criar a skill design-brief que gera prompts DS-first e telas-consomem-DS,
  nascida enxuta, com os quatro aprendizados do dogfooding.
status: pending
branch: null
started: 2026-06-15T13:37:12.477Z
lastUpdated: 2026-06-15T14:21:04.364Z
nextAction: "Start T5.1: Corpo da skill design-brief"
parentPlan: skills-restructuring
phaseId: F5
tasksDone: 0
tasksTotal: 5
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F5-G1
    description: A skill design-brief e seus assets existem e a validação passa.
    status: pending
    verifier:
      kind: shell
      command: test -f skills/core/design-brief.md && test -f
        skills/shared/design-brief-assets/ds-prompt.md && test -f
        skills/shared/design-brief-assets/screens-prompt.md && test -f
        skills/shared/design-brief-assets/fixtures-recipe.md && test -f
        skills/shared/design-brief-assets/anti-contamination.md && grep -q
        'design-brief-assets' skills/core/design-brief.md && npm run
        validate-skills
      expectExitCode: 0
    verifierLabel: "shell: test -f skills/core/design-brief.md && test -f skills/share…"
stack:
  - id: 1
    title: "Nova skill: design-brief"
    type: task
    openedAt: 2026-06-15T13:37:12.477Z
tasks:
  - id: T5.1
    title: Corpo da skill design-brief
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Corpo enxuto da skill design-brief
    description: "Criar o corpo fino da skill com a Iron Law anti-contaminação, o
      fluxo DS-first, auto-detecção de fonte e ponteiros para os assets lazy.
      Arquivos: skills/core/design-brief.md"
    scopeBoundary:
      - não embutir os esqueletos de prompt nem a recipe de fixtures no corpo;
        eles vivem em assets.
    acceptance:
      - o corpo existe e cita anti-contaminação, DS-first e consumo do DS
        herdado.
    verifier:
      kind: shell
      command: test -f skills/core/design-brief.md && grep -qiE
        'anti-contamin|DS-first|herdado' skills/core/design-brief.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/design-brief.md
  - id: T5.2
    title: Asset do prompt de Design System
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Asset do prompt de DS (token contract + 1 template base)
    description: "Criar o esqueleto do prompt de DS com token contract semântico,
      inventário de componentes com estados, 1 template base que exercita o DS,
      e constraints WCAG 2.2. Arquivos:
      skills/shared/design-brief-assets/ds-prompt.md"
    scopeBoundary:
      - pedir exatamente 1 template (não um set); templates por papel, sem
        hardcodar componentes de projeto.
    acceptance:
      - o asset existe e cita 1 template e token contract semântico.
    verifier:
      kind: shell
      command: test -f skills/shared/design-brief-assets/ds-prompt.md && grep -qiE '1
        template|um template' skills/shared/design-brief-assets/ds-prompt.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/design-brief-assets/ds-prompt.md
  - id: T5.3
    title: Asset do prompt de telas
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Asset do prompt de telas (consome DS herdado + estados)
    description: "Criar o esqueleto do prompt de telas com preâmbulo de consumo do
      DS herdado, template de tela por seção, checklist de estados e instrução
      de forkar do template base. Arquivos:
      skills/shared/design-brief-assets/screens-prompt.md"
    scopeBoundary:
      - o prompt de telas não redeclara tokens; consome o DS por nome.
    acceptance:
      - o asset existe e cita consumo do DS herdado e checklist de estados.
    verifier:
      kind: shell
      command: test -f skills/shared/design-brief-assets/screens-prompt.md && grep
        -qiE 'herdado|consom|estados'
        skills/shared/design-brief-assets/screens-prompt.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/design-brief-assets/screens-prompt.md
  - id: T5.4
    title: Assets de fixtures e anti-contaminação
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Assets de fixtures state-aware e anti-contaminação
    description: "Criar a recipe de fixtures state-aware (cardinalidade,
      comprimento, distribuição, edge-rows) e o checklist anti-contaminação mais
      a tabela DEFINE/DECIDE. Arquivos:
      skills/shared/design-brief-assets/fixtures-recipe.md,
      skills/shared/design-brief-assets/anti-contamination.md"
    scopeBoundary:
      - fixtures sintéticos sem PII; o checklist converte requisito visual em
        constraint, nunca em solução.
    acceptance:
      - ambos os assets existem
      - a recipe cita cardinalidade e edge-rows.
    verifier:
      kind: shell
      command: test -f skills/shared/design-brief-assets/fixtures-recipe.md && test -f
        skills/shared/design-brief-assets/anti-contamination.md && grep -qiE
        'cardinalidade|edge'
        skills/shared/design-brief-assets/fixtures-recipe.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/design-brief-assets/fixtures-recipe.md
      - kind: file
        path: skills/shared/design-brief-assets/anti-contamination.md
  - id: T5.5
    title: Registrar e validar a skill no catálogo
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: design-brief registrada no catálogo e validada
    description: "Registrar design-brief no meta/catalog.yaml e garantir que a
      validação de skills passa com a skill nova e seus assets. Arquivos:
      meta/catalog.yaml"
    scopeBoundary:
      - não alterar outras entradas do catálogo; só adicionar design-brief.
    acceptance:
      - o catálogo cita design-brief
      - a suite de validação de skills passa.
    verifier:
      kind: shell
      command: grep -q 'design-brief' meta/catalog.yaml && npm run validate-skills
      expectExitCode: 0
    outputs:
      - kind: file
        path: meta/catalog.yaml
parked: []
emerged: []
summary: "Skill design-brief: gera prompts DS-first + telas-consomem-DS, sem
  contaminar o visual."
planTitle: Reestruturação das skills atomic-skills
planActive: true
---

# Narrative / notes

Initiative for phase **F5 — Nova skill: design-brief**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
