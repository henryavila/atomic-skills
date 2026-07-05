---
schemaVersion: "0.1"
slug: help-command-f0-contrato-esqueleto
title: Contrato + esqueleto
goal: Registrar `help` no router, criar o asset detalhe stub e catalogar o
  comando — dispatch + descriptor + no-op verde, sem render completo.
status: active
branch: null
started: 2026-07-05T11:37:28.309Z
lastUpdated: 2026-07-05T12:07:18Z
nextAction: "Start T-002: criar o asset project-help.md (stub)"
parentPlan: help-command
phaseId: F0
businessIntent:
  value: Estabelece o contrato do comando `help` (router + asset + catálogo) para
    a camada GPS de terminal existir e ser descoberta, ainda sem renderizar.
  workflow: O dev roda `/atomic-skills:project help`; o router resolve para o
    asset `project-help.md`; o catálogo lista `help [--html]`.
  rules: read-only, zero-mutação, fail-open; nenhuma lógica no router
    (byte-budget); abstração de ferramentas + block-form if no asset.
  outOfScope: Nenhuma classificação de estado nem render (isso é F1/F2); não toca
    aiDeck nem gera o HTML.
  doneWhen: "`help` resolve na dispatch table para `project-help.md`,
    `validate-skills` verde e strip-test de compatibilidade limpo."
tasksDone: 1
tasksTotal: 3
gatesMet: 0
gatesTotal: 5
weightDone: 1
weightTotal: 3
exitGates:
  - id: G-1
    description: validate-skills passa (exit 0)
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills
    verifierLabel: "shell: npm run validate-skills"
  - id: G-2
    description: strip-test de compatibilidade passa (exit 0)
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: tests/compatibility.test.js
    verifierLabel: "test: node --test tests/compatibility.test.js"
  - id: G-3
    description: uma linha da dispatch table (âncora `|`) casa `help` E resolve para
      project-help.md
    status: pending
    verifier:
      kind: shell
      command: grep -qE '^\|.*help.*project-help\.md' skills/core/project.md
    verifierLabel: "shell: grep -qE '^\\|.*help.*project-help\\.md' skills/core/project.…"
  - id: G-4
    description: o asset project-help.md existe no disco
    status: pending
    verifier:
      kind: shell
      command: test -f skills/shared/project-assets/project-help.md
    verifierLabel: "shell: test -f skills/shared/project-assets/project-help.md"
  - id: G-5
    description: "o catálogo tem a entrada `name: help` com signature `--html`"
    status: pending
    verifier:
      kind: shell
      command: "awk '/name: help/{f=1} f&&/signature:/{print;exit}' meta/catalog.yaml
        | grep -q -- --html"
    verifierLabel: "shell: awk '/name: help/{f=1} f&&/signature:/{print;exit}' meta/ca…"
stack:
  - id: 1
    title: Contrato + esqueleto
    type: task
    openedAt: 2026-07-05T11:37:28.309Z
tasks:
  - id: T-001
    title: — Registrar `help` no router
    description: Adicionar `help` (e o alias `next`) à gramática do router e uma
      linha na dispatch table apontando para o novo asset `project-help.md`.
    status: done
    lastUpdated: 2026-07-05T12:07:18Z
    scopeBoundary:
      - só a gramática + a linha da tabela; nenhuma lógica no router
        (byte-budget).
    acceptance:
      - help aparece numa linha da dispatch table (âncora `|`) resolvendo para
        project-help.md; router continua dentro do byte-budget existente.
    verifier:
      kind: shell
      command: grep -qE '^\|.*help.*project-help\.md' skills/core/project.md
    outputs:
      - kind: file
        path: skills/core/project.md
    closedAt: 2026-07-05T12:07:18Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-05T12:07:18Z
      exitCode: 0
      passed: true
      outputSummary: 54:| `help`, `help --html`, `next` | {{READ_TOOL}}
        {{ASSETS_PATH}}/project-help.md |
  - id: T-002
    title: — Criar o asset detalhe `project-help.md` (stub)
    description: Arquivo com cabeçalho + contrato read-only/fail-open, ainda sem
      render completo. Usa abstração de ferramentas (READ_TOOL, BASH_TOOL) e
      block-form if.
    status: pending
    lastUpdated: 2026-07-05T11:37:28.309Z
    scopeBoundary:
      - só o stub do asset; sem lógica de render nem alteração no helper.
    acceptance:
      - arquivo existe; strip-test do Gemini (compatibility) limpo.
    verifier:
      kind: test
      runner: node --test
      pattern: tests/compatibility.test.js
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-help.md
  - id: T-003
    title: — Catalogar `help`
    description: Entrada em meta/catalog.yaml (grupo View ou novo grupo Guidance)
      com signature [--html], regenerar meta/catalog.json +
      docs/skills/project.md pelo gerador existente.
    status: pending
    lastUpdated: 2026-07-05T11:37:28.309Z
    scopeBoundary:
      - só a entrada de catálogo do help + regeneração; não altera outras
        entradas.
    acceptance:
      - validate-skills verde; help listado no catálogo com signature [--html] e
        exemplos reais.
    verifier:
      kind: shell
      command: npm run validate-skills
    outputs:
      - kind: file
        path: meta/catalog.yaml
      - kind: file
        path: meta/catalog.json
      - kind: file
        path: docs/skills/project.md
parked: []
emerged: []
planTitle: Comando `help` — GPS de terminal da skill `project`
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Contrato + esqueleto**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
