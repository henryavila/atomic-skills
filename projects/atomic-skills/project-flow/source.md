# Project Flow — schema, painel e dentes no implement

Substitui o process-map por um fluxo operacional: grafo SoT (`flow/flow.json`), painel de 3 camadas (render próprio, F1 termina impecável) e hard-gate no entry do `implement`. Fonte: `projects/atomic-skills/project-flow/design.md` (LEDGER + MODEL ratificados). schemaVersion permanece `"1.0"` (nada publicado); o shape muda.

## Principles

- **P1 Process-map descartado** — `process.yaml` / `map.html` nunca cumprem flow. Sem dual-read de produto.
- **P2 Obrigação no implement** — `ready` sem flow é legal. Sem stage `flow` inescapável. Sem `operatorSkip`.
- **P3 Humano valida no comando** — só `buildFlowRatification` escreve `ratifiedAt` + `ratifiedGraphSha` depois de show + AskUserQuestion. Chat ok não carimba.
- **P4 Render próprio** — sem Mermaid, Graphviz ou D2 como motor. Sem editor visual no browser.
- **P5 Grafo não vem de phases** — draft de design/source/`businessIntent`. Proibido colapsar `phases[]` em nós.
- **P6 Um schema vivo** — string `"1.0"`; shape MODEL. Sem dual-validator. Sem bump `"2.0"`. Sem mergear `86c1c2d4`.
- **P7 F1 termina impecável** — primeiro incremento pode ser tosco; exit gate de F1 é UI no DS do repo. F2 mostra o painel já polido.

## Glossary

| Term | Definition |
|------|------------|
| flow.json | L1 SoT em `<planDir>/flow/flow.json` (actors + graph + machines) |
| flow.html | HTML gerado em `<planDir>/flow/flow.html`. Nome `map.html` abolido |
| graph | BPM: activity, xor, and, join, subprocess, event, end |
| messages | Conversa no nó; alimenta a sequência; pode narrar UI |
| machines | Todas as FSMs do plano; transição com effects kind+label+target |
| --strict | Detector: grafo válido + ≥1 messages + ≥1 machine + stamp + flow.html sha |
| buildFlowRatification | Único escritor do stamp no comando `project flow` |
| M4 | LEDGER: três camadas obrigatórias para implement / detector --strict |

## F0 — Modelo no disco

Goal: Schema `"1.0"` expressa o MODEL (activity/xor/and/join/subprocess/event/end, messages, machines[], effects kind+label+target). validate-flow (AJV 2020 + regras de grafo) aceita o dogfood reescrito e rejeita o shape velho (`type: sequence`, `states` único, `effect.statusTo`). Sem regras PDTI no core.

### T-001 Substituir flow.schema.json pelo MODEL

- Files: meta/schemas/flow.schema.json
- scopeBoundary: do not rewrite scripts/lib/validate-flow.js graph walk in this task; do not edit dogfood JSON here; do not change process-map.schema.json; do not bump schemaVersion off 1.0
- acceptance: schemaVersion const remains 1.0; node type enum is activity xor and join subprocess event end; machines array exists; transition effect requires kind (email notify write other) plus label plus target; sequence decision and single states object are not valid node/root shapes
- verifier: kind shell command: "node -e \"const s=require('./meta/schemas/flow.schema.json'); if(s.properties.schemaVersion.const!=='1.0') process.exit(1); const t=s.\$defs.graph.properties.nodes.additionalProperties.allOf; if(!JSON.stringify(s).includes('activity')) process.exit(1); if(JSON.stringify(s).includes('\\\"const\\\":\\\"sequence\\\"')) process.exit(1);\""

### T-002 Reescrever validate-flow para os tipos MODEL

- Files: scripts/lib/validate-flow.js, tests/validate-flow.test.js
- scopeBoundary: do not copy validateProcessMap; do not add PDTI domain rules (status 10, three decisions, ids D1); do not implement render-flow or find-missing-flow; subgraphs max depth is a named constant (8)
- acceptance: neighbors walk activity xor and join subprocess event end; actorRef on messages; xor and and require >=2 branches; join.of must name an and; machines require >=1 node; effects key required (empty array valid); schemaVersion 1.0 with type sequence fails; tests cover broken next, one-branch xor, ghost actor, missing effects key, empty machine nodes
- verifier: kind shell command: "node --test tests/validate-flow.test.js"

### T-003 Reescrever fixtures dogfood para o MODEL

- Files: docs/design/project-flow/dogfood/fluxo-sugestao.json, docs/design/project-flow/dogfood/minimal-xor.json, tests/validate-flow.test.js
- scopeBoundary: do not put PDTI status 10/1/11 or statusTo in core validator; do not copy Arch HTML; do not change fluxo-completo.html in this task
- acceptance: fluxo-sugestao.json validates; processLabels have no click/modal/screen words; clicks live only in messages; at least one machine with >=1 state and transitions with effects arrays; minimal-xor.json is 2 actors + 1 xor + 1 machine; type sequence and root states object fail validateFlow
- verifier: kind shell command: "node --test tests/validate-flow.test.js && node -e \"import { validateFlow } from './scripts/lib/validate-flow.js'; import { readFileSync } from 'node:fs'; const d=JSON.parse(readFileSync('docs/design/project-flow/dogfood/fluxo-sugestao.json','utf8')); const r=validateFlow(d); if(!r.valid) { console.error(r.errors); process.exit(1); } if(!Array.isArray(d.machines) || d.machines.length<1) process.exit(1);\""

```yaml
exit_gate:
  criteria:
    - { id: G-F0-1, description: "FAILS when old shape still validates — type sequence or single states object must be invalid; MODEL dogfood must pass", status: pending, verifier: { kind: shell, command: "node --test tests/validate-flow.test.js" } }
    - { id: G-F0-2, description: "FAILS when schemaVersion is not 1.0 or when PDTI status rules live in validate-flow.js", status: pending, verifier: { kind: shell, command: "node -e \"const s=require('./meta/schemas/flow.schema.json'); if(s.properties.schemaVersion.const!=='1.0') process.exit(1);\" && ! rg -q 'statusTo === 10|status 10|three decisions' scripts/lib/validate-flow.js" } }
```

## F1 — Painel de 3 camadas

Goal: Render próprio (HTML/CSS/SVG no repo, sem Mermaid/Graphviz/D2) projeta sequência + fluxo BPM + máquinas a partir de flow.json. Primeiro incremento pode ser tosco. Exit = UI impecável no DS do repo (`site/assets/ds.css`). Artefato canônico `flow/flow.html`. Sem editor.

### T-004 Renderer puro das 3 camadas

- Files: scripts/lib/render-flow.js, tests/render-flow.test.js
- scopeBoundary: do not import mermaid or graphviz or d2; do not reuse .worktrees execute-plan Mermaid HTML; do not write project flow skill command; do not drop process-map stage
- acceptance: given MODEL dogfood, render returns HTML containing three distinct surfaces (sequence, bpm, machines); labels on bpm omit click words; messages appear on sequence; transitions show kind label target; mutating a next id changes the output; no mermaid script tag or mermaid.initialize
- verifier: kind shell command: "node --test tests/render-flow.test.js"

### T-005 CLI render-flow e path flow.html

- Files: scripts/render-flow.js, tests/render-flow.test.js
- scopeBoundary: do not add find-missing-flow.js here; do not write ratifiedAt; do not emit map.html
- acceptance: `node scripts/render-flow.js docs/design/project-flow/dogfood/fluxo-sugestao.json -o /tmp/flow.html` writes HTML; --check exits 0 on matching content-sha; --stdout prints HTML; output filename is flow.html not map.html
- verifier: kind shell command: "node --test tests/render-flow.test.js && node scripts/render-flow.js docs/design/project-flow/dogfood/fluxo-sugestao.json -o /tmp/project-flow-render.html && test -f /tmp/project-flow-render.html && ! rg -q 'map\\.html' scripts/render-flow.js"

### T-006 UI impecável no DS

- Files: scripts/lib/render-flow.js, tests/render-flow.test.js, site/assets/ds.css
- scopeBoundary: do not add a browser visual editor; do not introduce mermaid; do not change validate-flow rules; site/assets/ds.css is read/consumed, not redesigned
- acceptance: generated HTML uses DS tokens from site/assets/ds.css (inline or linked); three surfaces remain visually distinct (separate landmarks or tabs); typography and spacing match DS scale; no tool watermark; golden HTML snapshot updates only when visual contract changes
- verifier: kind shell command: "node --test tests/render-flow.test.js && node scripts/render-flow.js docs/design/project-flow/dogfood/fluxo-sugestao.json -o /tmp/project-flow-polish.html && rg -q 'ds-|data-flow-|Sequência|sequence' /tmp/project-flow-polish.html && ! rg -qi 'mermaid' /tmp/project-flow-polish.html"

```yaml
exit_gate:
  criteria:
    - { id: G-F1-1, description: "FAILS when render-flow emits mermaid or map.html or omits one of the three surfaces", status: pending, verifier: { kind: shell, command: "node --test tests/render-flow.test.js && ! rg -qi 'mermaid|graphviz|d2' scripts/lib/render-flow.js scripts/render-flow.js" } }
    - { id: G-F1-2, description: "FAILS when the generated dogfood HTML still looks like a prototype (no DS tokens, surfaces collapsed, mermaid present)", status: pending, verifier: { kind: shell, command: "node scripts/render-flow.js docs/design/project-flow/dogfood/fluxo-sugestao.json -o /tmp/project-flow-f1-gate.html && rg -q 'ds-|data-flow' /tmp/project-flow-f1-gate.html && ! rg -qi 'mermaid' /tmp/project-flow-f1-gate.html" } }
```

## F2 — Comando e dentes

Goal: `project flow` gera/atualiza/exibe/ratifica; detector `--strict` exige M4 + stamp + flow.html sha; `implement` recusa sem artefato; process-map sai do write path; Iron Law vira NO IMPLEMENT WITHOUT VALIDATED FLOW. Reusar do worktree só `flowPathsForPlan` e `buildFlowRatification`.

### T-007 Detector find-missing-flow --strict

- Files: scripts/find-missing-flow.js, tests/find-missing-flow.test.js
- scopeBoundary: do not implement the project flow skill UX here; do not remove CREATION_STAGES process-map in this task; do not write ratifiedAt except via a test helper that is not the product command
- acceptance: --strict exit 0 only when flow.json validates, >=1 messages, >=1 machine with >=1 state, ratifiedAt set, ratifiedGraphSha matches, flow.html exists with matching content-sha; missing any piece exits non-zero; process.yaml alone does not satisfy
- verifier: kind shell command: "node --test tests/find-missing-flow.test.js"

### T-008 Comando project flow + buildFlowRatification

- Files: skills/core/project.md, skills/shared/project-assets/project-flow.md, scripts/lib/flow-ratification.js, tests/flow-ratification.test.js
- scopeBoundary: do not add a creation stage named flow; do not keep process-map as a product fallback; do not stamp ratifiedAt from free-text chat
- acceptance: grammar lists flow; alias process loads project-flow.md only; buildFlowRatification is the only writer of ratifiedAt and ratifiedGraphSha; generate/update/show/--check/--open are documented; AskUserQuestion after show is required before stamp
- verifier: kind shell command: "test -f skills/shared/project-assets/project-flow.md && rg -q 'project flow|buildFlowRatification' skills/core/project.md skills/shared/project-assets/project-flow.md && rg -q 'buildFlowRatification' scripts/lib/flow-ratification.js && node --test tests/flow-ratification.test.js"

### T-009 implement HARD + assert-automate-gate spawn

- Files: skills/core/implement.md, scripts/assert-automate-gate.js, tests/assert-automate-gate.test.js, docs/kb/flow.md
- scopeBoundary: do not run show+ratify inside implement; do not add operatorSkip for missing flow; do not rewrite automate maestro A-I beyond the spawn fence
- acceptance: implement Step 1 runs find-missing-flow --strict on the plan path; non-zero refuses code and spawn; assert-automate-gate --gate spawn fails closed without the artifact; docs/kb/flow.md states the Iron Law and the command; no chat waiver
- verifier: kind shell command: "rg -q 'find-missing-flow' skills/core/implement.md && rg -q 'find-missing-flow' scripts/assert-automate-gate.js && rg -q 'NO IMPLEMENT WITHOUT VALIDATED FLOW|validated flow' docs/kb/flow.md && node --test tests/assert-automate-gate.test.js"

### T-010 Remover process-map do write path e da Iron Law

- Files: scripts/creation-gates.js, tests/creation-gates.test.js, skills/core/project.md, skills/shared/project-assets/project-create-plan.md, skills/shared/project-assets/new-plan/stage-8.md, skills/shared/project-assets/new-plan/stage-9.md, CLAUDE.md, docs/kb/process-map.md
- scopeBoundary: do not delete find-missing-process-map.js in this task (legacy reader only); do not merge 86c1c2d4; do not extract an npm package
- acceptance: CREATION_STAGES goes summaries then reviews with no process-map entry; mid-creation process-map remaps to reviews; Iron Law text is NO IMPLEMENT WITHOUT VALIDATED FLOW; project process aliases to flow; ready without flow remains legal
- verifier: kind shell command: "node -e \"import { CREATION_STAGES } from './scripts/creation-gates.js'; if(CREATION_STAGES.includes('process-map')) process.exit(1); const i=CREATION_STAGES.indexOf('summaries'); const j=CREATION_STAGES.indexOf('reviews'); if(!(i>=0 && j===i+1)) process.exit(1);\" && rg -q 'NO IMPLEMENT WITHOUT VALIDATED FLOW' skills/core/project.md CLAUDE.md && node --test tests/creation-gates.test.js"

```yaml
exit_gate:
  criteria:
    - { id: G-F2-1, description: "FAILS when project flow --check on migrated dogfood is non-zero or when process.yaml alone satisfies the detector", status: pending, verifier: { kind: shell, command: "node --test tests/find-missing-flow.test.js tests/flow-ratification.test.js" } }
    - { id: G-F2-2, description: "FAILS when implement can spawn without flow or when CREATION_STAGES still lists process-map", status: pending, verifier: { kind: shell, command: "rg -q 'find-missing-flow' skills/core/implement.md && node -e \"import { CREATION_STAGES } from './scripts/creation-gates.js'; if(CREATION_STAGES.includes('process-map')) process.exit(1);\"" } }
```
