---
schemaVersion: "0.1"
slug: help-command-f0-contrato-esqueleto
title: Contrato + esqueleto
goal: Registrar `help` no router, criar o asset detalhe stub e catalogar o
  comando — dispatch + descriptor + no-op verde, sem render completo.
status: active
branch: null
started: 2026-07-05T11:37:28.309Z
lastUpdated: 2026-07-05T12:11:11Z
nextAction: "Start T-003: catalogar help em meta/catalog.yaml + regenerar
  catalog.json/docs"
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
tasksDone: 2
tasksTotal: 3
gatesMet: 0
gatesTotal: 5
weightDone: 2
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
    status: done
    lastUpdated: 2026-07-05T12:11:11Z
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
    closedAt: 2026-07-05T12:11:11Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-05T12:11:11Z
      exitCode: 0
      testsCollected: 128
      passed: true
      outputSummary: node --test tests/compatibility.test.js → tests 128, pass 128, fail 0
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

## Session handoff

- **Narrative:** Plano `help-command` adotado em `.atomic-skills/` (era `guide`, renomeado p/ `help` em tudo — verbo/asset/helper/testes/slug — a pedido do usuário). F0 ativo. T-001 (registrar `help`+`next` no router grammar+dispatch table) FECHADO via `done` com evidência de shell-verifier `passed:true`. Restam T-002 (criar o asset stub `project-help.md`) e T-003 (catalogar).
- **Decision log:** (1) `guide`→`help` em todo lugar, slug `help-command`; (2) `branch: null` → implement roda direto na árvore `develop`, sem worktree hop; (3) review Codex aplicado: F-001 apertou os verifiers de F0 (G-3 dispatch-row ancorado `grep -qE '^\|.*help.*project-help\.md'`, +G-4 asset-existe, +G-5 catálogo-tem-help-com---html), F-003 apertou o contrato runtime de `help --html` em F2, F-004 especificou local da evidência manual F2/G-3; F-002 (gate de reuse do transition-graph) ACEITO-com-mitigação (o `help-vocab.test.js` do F3 cobre comandos-são-verbos-reais).
- **Single nextAction:** Implementar T-002 — criar `skills/shared/project-assets/project-help.md` (stub read-only/fail-open, abstração de ferramentas `{{READ_TOOL}}`/`{{BASH_TOOL}}` + block-form `{{#if}}`), rodar o verifier `node --test tests/compatibility.test.js`, commitar, depois `done T-002`.
- **Verbatim state:** verifier T-001 (passou): `grep -qE '^\|.*help.*project-help\.md' skills/core/project.md` → exit 0, row `54:| \`help\`, \`help --html\`, \`next\` | {{READ_TOOL}} {{ASSETS_PATH}}/project-help.md |`. verifier T-002: `node --test tests/compatibility.test.js`. verifier T-003: `npm run validate-skills`. Router em `skills/core/project.md` (23222 bytes). Commits: adopt `cd90adb` · review+refino `e4de654` · T-001 impl `789db5e` · T-001 checkpoint `28d6ac6`.
- **Uncommitted changes:** árvore limpa após `28d6ac6`, exceto esta edição do handoff (commitada no snapshot).
