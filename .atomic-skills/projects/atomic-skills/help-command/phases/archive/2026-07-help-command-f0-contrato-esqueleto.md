---
schemaVersion: "0.1"
slug: help-command-f0-contrato-esqueleto
title: Contrato + esqueleto
goal: Registrar `help` no router, criar o asset detalhe stub e catalogar o
  comando — dispatch + descriptor + no-op verde, sem render completo.
status: archived
branch: null
started: 2026-07-05T11:37:28.309Z
lastUpdated: 2026-07-05T12:40:24Z
nextAction: null
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
tasksDone: 3
tasksTotal: 3
gatesMet: 5
gatesTotal: 5
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-1
    description: validate-skills passa (exit 0)
    status: met
    metAt: 2026-07-05T12:33:53Z
    verifier:
      kind: shell
      command: npm run validate-skills
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-05T12:33:53Z
      exitCode: 0
      passed: true
      outputSummary: npm run validate-skills → All 15 skills valid (schema_version 0.2)
    verifierLabel: "shell: npm run validate-skills"
    evidenceSummary: passed · 2026-07-05
  - id: G-2
    description: strip-test de compatibilidade passa (exit 0)
    status: met
    metAt: 2026-07-05T12:33:53Z
    verifier:
      kind: test
      runner: node --test
      pattern: tests/compatibility.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-05T12:33:53Z
      exitCode: 0
      testsCollected: 128
      passed: true
      outputSummary: node --test tests/compatibility.test.js → tests 128, pass 128, fail 0
    verifierLabel: "test: node --test tests/compatibility.test.js"
    evidenceSummary: passed · 128 tests · 2026-07-05
  - id: G-3
    description: uma linha da dispatch table (âncora `|`) casa `help` E resolve para
      project-help.md
    status: met
    metAt: 2026-07-05T12:33:53Z
    verifier:
      kind: shell
      command: grep -qE '^\|.*help.*project-help\.md' skills/core/project.md
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-05T12:33:53Z
      exitCode: 0
      passed: true
      outputSummary: grep -qE '^\|.*help.*project-help\.md' skills/core/project.md →
        match (exit 0)
    verifierLabel: "shell: grep -qE '^\\|.*help.*project-help\\.md' skills/core/project.…"
    evidenceSummary: passed · 2026-07-05
  - id: G-4
    description: o asset project-help.md existe no disco
    status: met
    metAt: 2026-07-05T12:33:53Z
    verifier:
      kind: shell
      command: test -f skills/shared/project-assets/project-help.md
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-05T12:33:53Z
      exitCode: 0
      passed: true
      outputSummary: test -f skills/shared/project-assets/project-help.md → exists (exit 0)
    verifierLabel: "shell: test -f skills/shared/project-assets/project-help.md"
    evidenceSummary: passed · 2026-07-05
  - id: G-5
    description: "o catálogo tem a entrada `name: help` com signature `--html`"
    status: met
    metAt: 2026-07-05T12:33:53Z
    verifier:
      kind: shell
      command: "awk '/name: help/{f=1} f&&/signature:/{print;exit}' meta/catalog.yaml
        | grep -q -- --html"
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-05T12:33:53Z
      exitCode: 0
      passed: true
      outputSummary: awk name:help → signature line matches --html (exit 0)
    verifierLabel: "shell: awk '/name: help/{f=1} f&&/signature:/{print;exit}' meta/ca…"
    evidenceSummary: passed · 2026-07-05
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
    status: done
    lastUpdated: 2026-07-05T12:12:54Z
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
    closedAt: 2026-07-05T12:12:54Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-05T12:12:54Z
      exitCode: 0
      passed: true
      outputSummary: npm run validate-skills → All 15 skills valid (schema_version 0.2)
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

## Self-review against code-quality gates

- **G1 read-before-claim**: 3 tasks fechadas com evidência `passed:true` (T-001/T-002/T-003), cada uma ligada aos seus `outputs[]`. Fase de contrato/esqueleto (markdown+catálogo), sem asserção sobre código existente não-verificada.
- **G2 soft-language**: escaneado `nextAction` + descrições de task/critério pela ban-list; 0 ocorrências. `nextAction` nulificado no phase-done.
- **G6 reference-or-strike**: 5 exit-criteria, **5 met** com `evidence:` populada (todos verifiers determinísticos exit 0; G-2 = 128/128 testes). 0 deferred, 0 bare.
- **G10 gate-must-be-able-to-fail**: cada critério tem verifier determinístico que fica vermelho quando o alvo falha (grep sem match, teste falhando, `test -f` ausente, `validate-skills` não-zero). Nenhum critério de vaidade.
- **Review gate (G2)**: `atomic-skills:review-code 11b1543..HEAD --mode=local`, verdict findings_exist, counts `{blocker:0, critical:0, major:0, minor:2}`. Modo `local` escolhido pelo sinal destrutivo=false (diff +54/-0, sem drop-tokens). Finding #1 (spec `--html` citava `xdg-open` cru vs `open_url` WSL-aware) CORRIGIDO em `54bf8a7`; finding #2 (dispatch-row sem teste persistente) diferido p/ F3 (virou lição L-002). Registrado no descritor da fase como `reviewGate: { status: passed, at: 54bf8a7, mode: local }` — GATE-R3 satisfeito.
- **Lessons (G1)**: distiladas 2 lições em `lessons/help-command-f0-contrato-esqueleto.md` (2 reusable: L-001→F2, L-002→F3), ratificadas pelo usuário. Os start-gates de F2/F3 as dispõem.

## Session handoff

- **Narrative:** Plano `help-command` adotado em `.atomic-skills/` (era `guide`, renomeado p/ `help` em tudo — verbo/asset/helper/testes/slug). **F0 COMPLETO: as 3 tasks fechadas via `done` com evidência `passed:true`** — T-001 (router grammar+dispatch), T-002 (asset stub `project-help.md`), T-003 (catálogo `help [--html]` + regen catalog.json/skill-docs). F0 no boundary de fase; `phase-done` ainda NÃO rodado (opt-in do usuário). Restam as fases F1 (helper `compute-help.js` — descriptor-only), F2 (render + `--html` — descriptor-only), F3 (vocab-guard — descriptor-only).
- **Decision log:** (1) `guide`→`help` em todo lugar, slug `help-command`; (2) `branch: null` → implement roda direto na árvore `develop`, sem worktree hop; (3) review Codex aplicado: F-001 apertou os verifiers de F0 (G-3 dispatch-row ancorado `grep -qE '^\|.*help.*project-help\.md'`, +G-4 asset-existe, +G-5 catálogo-tem-help-com---html), F-003 apertou o contrato runtime de `help --html` em F2, F-004 especificou local da evidência manual F2/G-3; F-002 (gate de reuse do transition-graph) ACEITO-com-mitigação (o `help-vocab.test.js` do F3 cobre comandos-são-verbos-reais).
- **Single nextAction:** Rodar `phase-done` — executa os 5 exit-gates de F0 (G-1 `npm run validate-skills` · G-2 `node --test tests/compatibility.test.js` · G-3 dispatch-row · G-4 asset-existe · G-5 catálogo) + o gate obrigatório `review-code` do diff da fase, avança o plano p/ F1 e materializa F1 (descriptor-only).
- **Verbatim state:** exit-gates F0: `npm run validate-skills`; `node --test tests/compatibility.test.js`; `grep -qE '^\|.*help.*project-help\.md' skills/core/project.md`; `test -f skills/shared/project-assets/project-help.md`; `awk '/name: help/{f=1} f&&/signature:/{print;exit}' meta/catalog.yaml | grep -q -- --html`. Router `skills/core/project.md` = 23222 bytes. Commits F0: adopt `cd90adb` · review+refino `e4de654` · T-001 `789db5e`/`28d6ac6` · handoff `6886fec` · T-002 `0a3da9a`/`38210e1` · T-003 `71f3396`/`fe01324`.
- **Uncommitted changes:** árvore limpa após `fe01324`, exceto esta edição do handoff (commitada no snapshot).
