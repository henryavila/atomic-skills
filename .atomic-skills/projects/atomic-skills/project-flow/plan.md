---
schemaVersion: "0.1"
slug: project-flow
title: Project Flow — schema, painel e dentes no implement
version: "1.0"
status: active
started: 2026-08-13T16:51:58.727Z
lastUpdated: 2026-08-13T21:47:54.910Z
branch: plan/project-flow
currentPhase: F1
parallelismAllowed: false
principles:
  - id: P1
    title: Process-map descartado
    body: "`process.yaml` / `map.html` nunca cumprem flow. Sem dual-read de produto."
  - id: P2
    title: Obrigação no implement
    body: "`ready` sem flow é legal. Sem stage `flow` inescapável. Sem `operatorSkip`."
  - id: P3
    title: Humano valida no comando
    body: só `buildFlowRatification` escreve `ratifiedAt` + `ratifiedGraphSha` depois de show + AskUserQuestion. Chat ok não carimba.
  - id: P4
    title: Render próprio
    body: sem Mermaid, Graphviz ou D2 como motor. Sem editor visual no browser.
  - id: P5
    title: Grafo não vem de phases
    body: draft de design/source/`businessIntent`. Proibido colapsar `phases[]` em nós.
  - id: P6
    title: Um schema vivo
    body: string `"1.0"`; shape MODEL. Sem dual-validator. Sem bump `"2.0"`. Sem mergear `86c1c2d4`.
  - id: P7
    title: F1 termina impecável
    body: primeiro incremento pode ser tosco; exit gate de F1 é UI no DS do repo. F2 mostra o painel já polido.
glossary:
  - term: flow.json
    definition: L1 SoT em `<planDir>/flow/flow.json` (actors + graph + machines)
  - term: flow.html
    definition: HTML gerado em `<planDir>/flow/flow.html`. Nome `map.html` abolido
  - term: graph
    definition: "BPM: activity, xor, and, join, subprocess, event, end"
  - term: messages
    definition: Conversa no nó; alimenta a sequência; pode narrar UI
  - term: machines
    definition: Todas as FSMs do plano; transição com effects kind+label+target
  - term: --strict
    definition: "Detector: grafo válido + ≥1 messages + ≥1 machine + stamp + flow.html sha"
  - term: buildFlowRatification
    definition: Único escritor do stamp no comando `project flow`
  - term: M4
    definition: "LEDGER: três camadas obrigatórias para implement / detector --strict"
phases:
  - id: F0
    slug: project-flow-f0-modelo-no-disco
    title: Modelo no disco
    summary: Schema 1.0 no disco passa a ser o MODEL; o shape sequence/states deixa de validar.
    goal: 'Schema `"1.0"` expressa o MODEL (activity/xor/and/join/subprocess/event/end, messages, machines[], effects kind+label+target). event.kind é timer|error. xor.when é único por xor. join.of nomeia um and. subprocess.ref ∈ subgraphs. via, se presente, aponta branch existente. ciclo = next a ancestral. subgraphs: profundidade máxima 8. Lifecycle (planSlug, actor, scenario, audience, ratifiedAt, ratifiedGraphSha) permanece. validate-flow (AJV 2020 + regras de grafo) aceita o dogfood reescrito e rejeita o shape velho (`type: sequence`, `states` único, `effect.statusTo`). Sem regras PDTI no core.'
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-F0-1
          description: FAILS when old shape still validates — type sequence or single states object must be invalid; MODEL dogfood must pass with machines[]
          status: met
          verifier:
            kind: shell
            command: node --test tests/validate-flow.test.js && node -e "import { validateFlow } from './scripts/lib/validate-flow.js'; import { readFileSync } from 'node:fs'; const dog=JSON.parse(readFileSync('docs/design/project-flow/dogfood/fluxo-sugestao.json','utf8')); if(!validateFlow(dog).valid) process.exit(1); if(!Array.isArray(dog.machines)||dog.machines.length<1) process.exit(1); const old={schemaVersion:'1.0',planSlug:'probe',title:'p',scenario:'x',actor:'Requester',audience:'layperson',actors:[{id:'U',label:'Requester',kind:'actor'}],graph:{entry:'S1',nodes:{S1:{type:'sequence',processLabel:'x',messages:[{from:'U',to:'U',text:'t',async:false}],next:'E'},E:{type:'end',processLabel:'done'}}}}; if(validateFlow(old).valid) process.exit(1);"
          metAt: 2026-08-13T21:42:42.676Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-08-13T21:42:42.676Z
            verifiedCommit: c7f4c29d8cd24fc2314c7cc930260f1fcf7ea067
            passed: true
            exitCode: 0
            outputSummary: 30/30 tests; dogfood+machines; sequence probe invalid; exit 0
        - id: G-F0-2
          description: FAILS when schemaVersion is not 1.0 or when PDTI status rules live in validate-flow.js
          status: met
          verifier:
            kind: shell
            command: node -e "const s=require('./meta/schemas/flow.schema.json'); if(s.properties.schemaVersion.const!=='1.0') process.exit(1);" && ! rg -q 'statusTo === 10|status 10|three decisions' scripts/lib/validate-flow.js
          metAt: 2026-08-13T21:42:42.676Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-08-13T21:42:42.676Z
            verifiedCommit: c7f4c29d8cd24fc2314c7cc930260f1fcf7ea067
            passed: true
            exitCode: 0
            outputSummary: schemaVersion const 1.0; no PDTI strings in validate-flow.js; exit 0
    status: done
    businessIntent:
      value: O PO navega e valida um fluxo operacional (negócio + conversa + estados). O shape 1.0 no disco passa a ser o MODEL. Implement recusa plano sem flow ratificado.
      workflow: Schema "1.0" novo → validate-flow + dogfood reescrito → (F1/F2 depois). Draft do grafo a partir de design/source/BI, nunca de phases[].
      rules: Sem dual-read process.yaml. Sem regras PDTI no core. Sem bump "2.0". Sem mergear 86c1c2d4. effects[] vazio é válido; key ausente não.
      outOfScope: Renderer, comando project flow, detector, implement HARD, copiar Arch, editor visual, pacote npm, feature PDTI.
      doneWhen: 'G-F0-1 verde: dogfood MODEL valida com machines[]; probe type sequence é inválido; suite validate-flow no modelo novo. schemaVersion continua "1.0".'
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-project-flow-F0.md
      verifiedAt: 2026-08-13T21:42:42.676Z
      at: c7f4c29d8cd24fc2314c7cc930260f1fcf7ea067
    lessonsState: recorded
    lessonsPath: .atomic-skills/projects/atomic-skills/project-flow/lessons/project-flow-f0-modelo-no-disco.md
    reviewGate:
      status: passed
      mode: local
      at: c7f4c29d8cd24fc2314c7cc930260f1fcf7ea067
      reviewFile: .atomic-skills/reviews/project-flow-F0-phase-local.md
      overrideReason: operator requested review-code --mode=local for this implement session
      verifiedAt: 2026-08-13T21:42:42.676Z
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-project-flow-F0.md
      verdict: PARTIAL
      verifiedAt: 2026-08-13T21:42:42.676Z
      at: c7f4c29d8cd24fc2314c7cc930260f1fcf7ea067
    decisionReview:
      status: pending
      packagePath: .atomic-skills/reviews/project-flow-F0-decision-package.md
      packagePresentedAt: 2026-08-13T21:42:42.676Z
      evidencePath: .atomic-skills/projects/atomic-skills/project-flow/decisions/F0.jsonl
  - id: F1
    slug: project-flow-f1-painel-de-3-camadas
    title: Painel de 3 camadas
    summary: Painel próprio das três camadas; nasce tosco e só fecha impecável no DS.
    goal: Render próprio (HTML/CSS/SVG no repo, sem Mermaid/Graphviz/D2) projeta sequência + fluxo BPM + máquinas a partir de flow.json. Primeiro incremento pode ser tosco. Exit = UI impecável no DS do repo (`site/assets/ds.css`). Artefato canônico `flow/flow.html`. Sem editor.
    dependsOn:
      - F0
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-F1-1
          description: FAILS when render-flow uses Mermaid/Graphviz/D2 (import or sequenceDiagram/flowchart/stateDiagram in HTML), emits map.html, or omits one of the three native surfaces
          status: pending
          verifier:
            kind: shell
            command: node --test tests/render-flow.test.js && ! rg -qi 'mermaid|graphviz|d2' scripts/lib/render-flow.js scripts/render-flow.js && node scripts/render-flow.js docs/design/project-flow/dogfood/fluxo-sugestao.json -o /tmp/project-flow-f1-g1.html && ! rg -qi 'mermaid|sequencediagram|statediagram|graphviz' /tmp/project-flow-f1-g1.html && rg -qi 'sequência|messages' /tmp/project-flow-f1-g1.html && rg -qi 'machine' /tmp/project-flow-f1-g1.html && rg -qi 'bpm|fluxo|activity' /tmp/project-flow-f1-g1.html && ! rg -q 'map\.html' scripts/render-flow.js
        - id: G-F1-2
          description: FAILS when the generated dogfood HTML still looks like a prototype (no DS custom properties from site/assets/ds.css, surfaces collapsed, mermaid present). Do not look for a `ds-` class prefix — ds.css has none.
          status: pending
          verifier:
            kind: shell
            command: node scripts/render-flow.js docs/design/project-flow/dogfood/fluxo-sugestao.json -o /tmp/project-flow-f1-gate.html && rg -q -- '--bg-canvas|--fg-default' /tmp/project-flow-f1-gate.html && ! rg -qi 'mermaid' /tmp/project-flow-f1-gate.html
    status: active
    businessIntent:
      value: O PO navega e valida o fluxo nas três camadas (conversa/messages, BPM, machines) num painel HTML próprio, no design system do repo. F1 fecha impecável; o primeiro incremento pode ser tosco.
      workflow: render-flow (lib) → CLI grava flow.html (nunca map.html) → polish com tokens --bg-canvas/--fg-default de site/assets/ds.css (só consume).
      rules: Sem Mermaid, Graphviz ou D2. Sem editor visual. Sem mergear 86c1c2d4. Superfície sequência = messages, não sequenceDiagram. Labels BPM sem clique/modal/tela. ds.css não é output.
      outOfScope: Comando project flow, detector, implement HARD, remover process-map, pacote npm, editor no browser, mudar validate-flow.
      doneWhen: "G-F1-1: HTML próprio com as três superfícies, sem mermaid/map.html. G-F1-2: HTML usa --bg-canvas|--fg-default e não tem mermaid."
  - id: F2
    slug: project-flow-f2-comando-e-dentes
    title: Comando e dentes
    summary: Comando project flow + implement recusa sem flow; process-map sai do write path.
    goal: "`project flow` gera/atualiza/exibe/ratifica; generate lê design/source/businessIntent e não phases[]; ratify = show + AskUserQuestion + só buildFlowRatification; detector `--strict` exige M4 + stamp do documento (grafo+messages+machines) + flow.html sha; `implement` recusa sem flow em todo plano que implement aceita (AS multi/1-phase, foreign); ad-hoc sem plan file = N/A; process-map sai do write path; Iron Law vira NO IMPLEMENT WITHOUT VALIDATED FLOW. Reusar do worktree só `flowPathsForPlan` e `buildFlowRatification`."
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-F2-1
          description: FAILS when find-missing-flow --strict or project flow --check accepts a document missing any M4 piece, when process.yaml alone satisfies the detector, or when those tests omit a --check path on the migrated dogfood fixture
          status: pending
          verifier:
            kind: shell
            command: node --test tests/find-missing-flow.test.js tests/flow-ratification.test.js && rg -q -- '--check' tests/flow-ratification.test.js && rg -q 'process.yaml' tests/find-missing-flow.test.js
        - id: G-F2-2
          description: FAILS when implement can spawn without flow or when CREATION_STAGES still lists process-map
          status: pending
          verifier:
            kind: shell
            command: rg -q 'find-missing-flow' skills/core/implement.md && node -e "import { CREATION_STAGES } from './scripts/creation-gates.js'; if(CREATION_STAGES.includes('process-map')) process.exit(1);"
    status: pending
references:
  - kind: file
    path: projects/atomic-skills/project-flow/design.md
  - kind: file
    path: docs/design/project-flow/LEDGER.md
  - kind: file
    path: docs/design/project-flow/MODEL.md
planActive: true
planTitle: Project Flow — schema, painel e dentes no implement
---

# Project Flow — schema, painel e dentes no implement

## 0. Which plan this is

Este `plan.md` **é** o plano AS de 2026-08-13: schema MODEL + painel HTML/CSS/SVG próprio + dentes no `implement`. Fonte de implementação: `projects/atomic-skills/project-flow/design.md` (D1–D7) + `docs/design/project-flow/LEDGER.md` + `MODEL.md`.

Este plano **não é** a cascata `execute-plan/fa94153b` / tip `86c1c2d4` / **PR2 Mermaid**. Não mergear esse worktree. Não copiar `scripts/lib/render-flow.js` de lá. Não implementar `docs/design/project-flow/design.md` D3/D5 (tabs `sequenceDiagram` / `flowchart` / `stateDiagram`). Esse `design.md` (2026-08-12) e `dogfood/fluxo-completo.html` são **histórico** — LEDGER §6. `docs/design/project-flow/IMPLEMENTATION.md` (“ainda não é plan.md AS”) está **superado** por este arquivo.

## 1. Context

Substitui o process-map por um fluxo operacional: grafo SoT (`flow/flow.json`), painel de 3 camadas (render próprio, F1 termina impecável) e hard-gate no entry do `implement`. Fonte: `projects/atomic-skills/project-flow/design.md` (LEDGER + MODEL ratificados). schemaVersion permanece `"1.0"` (nada publicado); o shape muda. verified_by: `projects/atomic-skills/project-flow/design.md` D1–D7; `docs/design/project-flow/LEDGER.md` R1–R11 / M4–M5; `docs/design/project-flow/MODEL.md`.

## 2. Inviolable principles

- **P1 Process-map descartado** — `process.yaml` / `map.html` nunca cumprem flow. Sem dual-read de produto.
- **P2 Obrigação no implement** — `ready` sem flow é legal. Sem stage `flow` inescapável. Sem `operatorSkip`.
- **P3 Humano valida no comando** — só `buildFlowRatification` escreve `ratifiedAt` + `ratifiedGraphSha` depois de show + AskUserQuestion. Chat ok não carimba.
- **P4 Render próprio** — sem Mermaid, Graphviz ou D2 como motor. Sem editor visual no browser.
- **P5 Grafo não vem de phases** — draft de design/source/`businessIntent`. Proibido colapsar `phases[]` em nós.
- **P6 Um schema vivo** — string `"1.0"`; shape MODEL. Sem dual-validator. Sem bump `"2.0"`. Sem mergear `86c1c2d4`.
- **P7 F1 termina impecável** — primeiro incremento pode ser tosco; exit gate de F1 é UI no DS do repo. F2 mostra o painel já polido.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Alignment notes (review-plan 2026-08-13)

- **Lazy F1/F2.** Só F0 está materializada. F1/F2 são descriptor-only (`phases/*.source.json`, `subPhaseCount: 0`). Contrato: `docs/kb/project-lazy-materialization.md`. Não é gap de cobertura até `materialize`.
- **LEDGER M4 vs effects vazios.** LEDGER §7 M4 diz "estados + efeitos". Leitura fechada em design D6 / T-002: key `effects` obrigatória; `[]` é válido; `--strict` não exige efeito não-vazio.
- **`--open`.** T-008 (source) documenta `--open`; design D5 lista generate/update/show/ratify/`--check`. Extra aceito: `--open` é UX do comando, não produto novo.
- **G-F0-2.** Já passa no tip atual (schemaVersion `"1.0"`; validate-flow sem strings PDTI). É guarda de regressão, não prova de F0. A prova de F0 é G-F0-1 (reescrito para falhar hoje).
- **LEDGER.md / MODEL.md.** SSOT citados pelo design. Ausentes neste worktree no início do review; copiados de `docs/design/project-flow/` do checkout principal sem edição. Permanecem artefatos — este review não os altera.
- **T-006 `site/assets/ds.css`.** Descriptor F1 lista o CSS como output e o scopeBoundary manda só ler. Corrigir via `project-status` / materialize: Files = consume, não output.
- **G-F1-2 `ds-`.** `site/assets/ds.css` não contém a substring `ds-` (tokens são `--bg-*` / `--fg-*` / `--status-*`). O verifier antigo era premissa falsa. Gate do plan.md reescrito para `--bg-canvas|--fg-default`. O descriptor F1 / T-006 ainda tem `rg -q 'ds-|data-flow-'` — corrigir no materialize via `project-status`.
- **T-010 write-path.** Descriptor F2 não lista `stage-process-map.md`, `stage-7.md`, `project-process-map.md`, `tests/find-missing-process-map.test.js` (trava `CREATION_STAGES` + contrato do stage). Incluir no materialize. `find-missing-process-map.js` fica reader legado (scopeBoundary T-010).
- **Mermaid morta.** Implementar D4 do design AS (HTML/CSS/SVG). `docs/design/project-flow/design.md` (2026-08-12) ainda descreve projeções Mermaid e “próxima sessão = PR2” — **não** é trabalho. G-F1-1 agora falha se o HTML tiver `sequenceDiagram` / `stateDiagram` / `mermaid`.

## F0 implement constraints (initiative HARD-GATE)

Initiative `phases/f0-modelo-no-disco.md` é a fonte de tarefas. Este bloco registra defeitos da initiative; **não** editar o arquivo da initiative daqui — aplicar via `atomic-skills:project`.

- **T-001 verifier.** A initiative usa `node --test tests/validate-flow.test.js`. Esse suite aceita o dogfood no shape velho (`tests/validate-flow.test.js:29-51`) e um documento `type: sequence` válido (`minimal-xor.json`). Depois de trocar o schema, o suite fica vermelho e T-001 não fecha. Restaurar o verifier de introspecção do schema em `projects/atomic-skills/project-flow/source.md` (T-001).
- **T-003 verifier.** A initiative perdeu o `validateFlow(dogfood)` + `machines.length>=1` que está em source.md T-003. Restaurar. Sem isso G-F0-1 e T-003 não batem.
- **T-002 acceptance.** Incluir o que o MODEL exige e o suite PR1 já testa em parte: `xor.when` único (`tests/validate-flow.test.js:93-98`); `via` inválido falha (`:112-134`); `event.kind` ∈ {timer, error}; `subprocess.ref` ∈ `subgraphs`; ciclo = next a ancestral. A profundidade 8 já está no scopeBoundary.
- **T-002 coupling.** `scripts/lib/validate-flow.js:5` importa `IMPLEMENTATION_TOKEN_RE` de `render-process-map.js` e o walk de `journey` (`:251-322`) usa o regex. MODEL: journey fora do produto. Se T-001 dropa `journey`, T-002 dropa o import e o walk. Se T-001 deixa journey residual, o walk pode ficar. Não copiar `validateProcessMap`.

## F1 implement constraints (initiative HARD-GATE)

Descriptor `phases/f1-painel-de-3-camadas.source.json` é a fonte até o materialize. Não editar o `.source.json` daqui.

- **DS tokens.** `site/assets/ds.css` é consume. Tokens reais: `--bg-canvas` (L21), `--fg-default` (L42). Padrão vivo: `scripts/lib/render-process-map.js` inline do CSS + classes `.pm-*` (`PROCESS_MAP_CSS` L248). Não inventar classes `ds-`.
- **T-006 verifier.** Trocar `ds-|data-flow-` por `--bg-canvas|--fg-default` no materialize. Output `site/assets/ds.css` é erro (já na alignment note).
- **Não Mermaid.** T-004 já proíbe import mermaid e HTML de `86c1c2d4`. Também não copiar builders de `docs/design/project-flow/dogfood/fluxo-completo.html` (`buildSequenceMermaid` / CDN mermaid@11). Superfície “sequência” = conversa (`messages[]`), não `sequenceDiagram`.

## F2 implement constraints (initiative HARD-GATE)

Descriptor `phases/f2-comando-e-dentes.source.json` é a fonte até o materialize. Não editar o `.source.json` daqui.

- **Reuse 86c1c2d4.** Só `flowPathsForPlan` e `buildFlowRatification` (`scripts/find-missing-flow.js:40` e `:65` naquele worktree). Não o HTML Mermaid. Neste tip as funções não existem — T-007/T-008 as criam.
- **T-010 files missing from descriptor outputs.** Write-path que quebra se o stage sair e o arquivo ficar: `skills/shared/project-assets/new-plan/stage-process-map.md`, `stage-7.md` (next = process-map), `project-process-map.md`, `tests/find-missing-process-map.test.js:21-28` (ordem summaries→process-map→reviews) e `:30-46` (contrato do stage). `package.json` scripts `render-process-map` / `check-process-maps` / `find-missing-process-map` = residual aceito enquanto o reader legado existir.
- **T-009.** `assert-automate-gate.js:808-822` hoje só cerca ground-truth no spawn. T-009 acrescenta `find-missing-flow --strict` aí e no Step 1 do implement.

## Self-review against code-quality gates

- **G1 read-before-claim**: claims about existing code live in `projects/atomic-skills/project-flow/design.md` (verified_by on process-map, schema 1.0, implement Step 1). Gate rewrite cites `tests/validate-flow.test.js:29-51` (suite aceita dogfood velho) e `meta/schemas/flow.schema.json:117-120` (enum sequence|decision|end). This plan.md is the decompose projection of that design.
- **G2 soft-language**: scanned plan body + frontmatter against the EN ban list (`should|probably|may|typically|usually|I think|it seems|in theory|tends to`); 0 occurrences after this pass.
- **G6 reference-or-strike**: each exit criterion carries a `verifier:` shell command. FAILS-when is in the criterion description. Context points at design.md + LEDGER + MODEL via `references:`.
- **G10 gate-must-be-able-to-fail**: G-F0-1 rewritten to fail on current tip (dogfood sem `machines[]`; probe `type: sequence` ainda valida). G-F0-2 continua verde no tip — guarda de regressão, ver Alignment notes.
- **Ground-truth (Flow E 2026-08-13T21:50:00Z):** Status=complete-with-findings; mode=ground-truth; fp=482b7a7b8c8f; premises=18 (false=1 `ds-`); impacts=6; re-run after F1 materialize (T-006 verifier `--bg-canvas|--fg-default`; ds.css consume). Code premises unchanged. render-flow.js still absent (F1 output). Plano = AS 2026-08-13; não é PR2 Mermaid / 86c1c2d4.

## Reviews

- internal: 11 finding(s) applied/recorded @ uncommitted (2026-08-13T18:09:11Z)
- ground-truth: complete-with-findings | mode=ground-truth | fp=482b7a7b8c8f | premises=18 | impacts=6 @ 23d9a55d (2026-08-13T21:50:00Z)

## Ground-truth review

**Status:** complete-with-findings
**Codebase class:** populated
**Scanned:** meta/schemas/flow.schema.json, scripts/lib/validate-flow.js, scripts/lib/render-process-map.js, scripts/find-missing-process-map.js, scripts/creation-gates.js, scripts/assert-automate-gate.js, skills/core/implement.md, skills/core/project.md, skills/shared/project-assets/{project-process-map,project-create-plan,new-plan/stage-7,stage-8,stage-9,stage-process-map}.md, tests/{validate-flow,creation-gates,find-missing-process-map}.test.js, site/assets/ds.css, docs/design/project-flow/dogfood/*, .worktrees/execute-plan-fa94153b-pr-4/scripts/find-missing-flow.js → 217 files under scripts/+skills/core+skills/shared/project-assets+meta/schemas+docs/kb+site/assets+docs/design/project-flow
**Commit:** 23d9a55d
**At:** 2026-08-13T21:50:00Z

### A — Plan premises vs code

| # | Premise | Result | Evidence |
|---|---------|--------|----------|
| 1 | flow.schema.json exists; schemaVersion const is 1.0 | ok | meta/schemas/flow.schema.json:20 `const: "1.0"` |
| 2 | graph node types today are sequence/decision/end | ok | meta/schemas/flow.schema.json:117-120 enum |
| 3 | effect today requires only `label` and allows numeric `statusTo` | ok | meta/schemas/flow.schema.json:217-224 |
| 4 | optional root `states` object is a valid shape today | ok | meta/schemas/flow.schema.json:70, :243-263 |
| 5 | validate-flow.js uses AJV 2020 | ok | scripts/lib/validate-flow.js:4 `import Ajv from 'ajv/dist/2020.js'` |
| 6 | neighbors() walks only sequence + decision | ok | scripts/lib/validate-flow.js:56-64 |
| 7 | validate-flow imports IMPLEMENTATION_TOKEN_RE from render-process-map.js | ok | scripts/lib/validate-flow.js:5, used at :283 |
| 8 | CREATION_STAGES includes process-map immediately before reviews | ok | scripts/creation-gates.js:38-48 |
| 9 | implement Step 1 gates ground-truth, not flow | ok | skills/core/implement.md:123-132 `find-plans-missing-ground-truth.js` |
| 10 | assert-automate-gate spawn fences only ground-truth | ok | scripts/assert-automate-gate.js:808-822 |
| 11 | render-flow.js, find-missing-flow.js, flow-ratification.js, project-flow.md, docs/kb/flow.md absent | ok | not existence premises — F1/F2 outputs; glob empty on this tip |
| 12 | dogfood fluxo-sugestao.json is schema 1.0, types sequence/decision/end, no machines[] | ok | docs/design/project-flow/dogfood/fluxo-sugestao.json; validateFlow valid=true today |
| 13 | tests/validate-flow.test.js:29-51 accepts old dogfood and type:sequence | ok | suite 15/15 pass; G-F0-1 probe `old sequence valid true` |
| 14 | G-F0-2 already green (no PDTI strings in validate-flow.js) | ok | rg no hits; schemaVersion const 1.0 |
| 15 | site/assets/ds.css exists with `--bg-*` / `--fg-*` tokens | ok | site/assets/ds.css:21 `--bg-canvas`; :42 `--fg-default` |
| 16 | G-F1-2 / T-006 can detect DS usage via a `ds-` class prefix | false | site/assets/ds.css has 0 matches for `ds-`; process-map uses `.pm-*` + inlined `--*` (scripts/lib/render-process-map.js:248). Plan G-F1-2 rewritten this pass to `--bg-canvas|--fg-default`. Descriptor T-006 still has `ds-` (initiative HARD-GATE — materialize via project-status) |
| 17 | process-map.schema.json exists (T-001 must not change it); validateProcessMap lives in render-process-map.js | ok | meta/schemas/process-map.schema.json; scripts/lib/render-process-map.js:68 |
| 18 | flowPathsForPlan + buildFlowRatification exist on 86c1c2d4 (reuse, do not merge) | ok | .worktrees/execute-plan-fa94153b-pr-4/scripts/find-missing-flow.js:40, :65 |

### B — Code present, plan silent (impact candidates)

| # | Finding | Location | Impact | Disposition |
|---|---------|----------|--------|-------------|
| 1 | Mermaid render-flow + command + implement HARD already exist on 86c1c2d4 | .worktrees/execute-plan-fa94153b-pr-4 | indirect | accepted — P6 reuse only flowPathsForPlan + buildFlowRatification; do not merge |
| 2 | process-map write path still mandatory on this tip (stage, Iron Law, this plan's process/) | scripts/find-missing-process-map.js, CREATION_STAGES, CLAUDE.md:27 | direct | T-010 + this plan's own process/ map until T-010 |
| 3 | validate-flow journey walk + IMPLEMENTATION_TOKEN_RE coupling | scripts/lib/validate-flow.js:5, :251-322 | direct | F0 constraint: T-002 drops import/walk if T-001 drops journey |
| 4 | Write-path files not in T-010 descriptor outputs | stage-process-map.md, stage-7.md, project-process-map.md, tests/find-missing-process-map.test.js:21-46 | direct | F2 constraint — include on materialize; do not leave stage pointing at process-map |
| 5 | DS has no `ds-` prefix; process-map already inlines ds.css | site/assets/ds.css; scripts/lib/render-process-map.js:248-451 | direct | G-F1-2 fixed in plan.md; T-006/source.json via project-status; copy inline pattern, do not invent `ds-` classes |
| 6 | package.json still exposes render-process-map / check-process-maps / find-missing-process-map | package.json:44-46 | indirect | accepted residual while find-missing-process-map.js stays legacy reader (T-010 scopeBoundary) |

**Counts:** premises=18 (missing=0, false=1); impacts=6 (direct=4, indirect=2)
