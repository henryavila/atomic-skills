## Intent vs delivered

Plan-end cross-model review answers: **did we build what we planned?**
Score each row as `matched` | `partial` | `missing` | `extra`. Generic code
diff review alone does **not** satisfy the intent-vs-delivered gate.

### Intent surface (planned)

| # | kind | phase | task | text |
|---|------|-------|------|------|
| 1 | phase-goal | F0 |  | Schema `"1.0"` expressa o MODEL (activity/xor/and/join/subprocess/event/end, messages, machines[], effects kind+label+target). event.kind é timer\|error. xor.when é único por xor. join.of nomeia um and. subprocess.ref ∈ subgraphs. via, se presente, aponta branch existente. ciclo = next a ancestral. subgraphs: profundidade máxima 8. Lifecycle (planSlug, actor, scenario, audience, ratifiedAt, ratifiedGraphSha) permanece. validate-flow (AJV 2020 + regras de grafo) aceita o dogfood reescrito e rejeita o shape velho (`type: sequence`, `states` único, `effect.statusTo`). Sem regras PDTI no core. |
| 2 | business-intent | F0 |  | O PO navega e valida um fluxo operacional (negócio + conversa + estados). O shape 1.0 no disco passa a ser o MODEL. Implement recusa plano sem flow ratificado. |
| 3 | business-intent | F0 |  | Schema "1.0" novo → validate-flow + dogfood reescrito → (F1/F2 depois). Draft do grafo a partir de design/source/BI, nunca de phases[]. |
| 4 | business-intent | F0 |  | Sem dual-read process.yaml. Sem regras PDTI no core. Sem bump "2.0". Sem mergear 86c1c2d4. effects[] vazio é válido; key ausente não. |
| 5 | business-intent | F0 |  | Renderer, comando project flow, detector, implement HARD, copiar Arch, editor visual, pacote npm, feature PDTI. |
| 6 | business-intent | F0 |  | G-F0-1 verde: dogfood MODEL valida com machines[]; probe type sequence é inválido; suite validate-flow no modelo novo. schemaVersion continua "1.0". |
| 7 | exit-criteria | F0 |  | FAILS when old shape still validates — type sequence or single states object must be invalid; MODEL dogfood must pass with machines[] |
| 8 | exit-criteria | F0 |  | FAILS when schemaVersion is not 1.0 or when PDTI status rules live in validate-flow.js |
| 9 | phase-goal | F1 |  | Render próprio (HTML/CSS/SVG no repo, sem Mermaid/Graphviz/D2) projeta sequência + fluxo BPM + máquinas a partir de flow.json. Primeiro incremento pode ser tosco. Exit = UI impecável no DS do repo (`site/assets/ds.css`). Artefato canônico `flow/flow.html`. Sem editor. |
| 10 | business-intent | F1 |  | O PO navega e valida o fluxo nas três camadas (conversa/messages, BPM, machines) num painel HTML próprio, no design system do repo. F1 fecha impecável; o primeiro incremento pode ser tosco. |
| 11 | business-intent | F1 |  | render-flow (lib) → CLI grava flow.html (nunca map.html) → polish com tokens --bg-canvas/--fg-default de site/assets/ds.css (só consume). |
| 12 | business-intent | F1 |  | Sem Mermaid, Graphviz ou D2. Sem editor visual. Sem mergear 86c1c2d4. Superfície sequência = messages, não sequenceDiagram. Labels BPM sem clique/modal/tela. ds.css não é output. |
| 13 | business-intent | F1 |  | Comando project flow, detector, implement HARD, remover process-map, pacote npm, editor no browser, mudar validate-flow. |
| 14 | business-intent | F1 |  | G-F1-1: HTML próprio com as três superfícies, sem mermaid/map.html. G-F1-2: HTML usa --bg-canvas\|--fg-default e não tem mermaid. |
| 15 | exit-criteria | F1 |  | FAILS when render-flow uses Mermaid/Graphviz/D2 (import or sequenceDiagram/flowchart/stateDiagram in HTML), emits map.html, or omits one of the three native surfaces |
| 16 | exit-criteria | F1 |  | FAILS when the generated dogfood HTML still looks like a prototype (no DS custom properties from site/assets/ds.css, surfaces collapsed, mermaid present). Do not look for a `ds-` class prefix — ds.css has none. |
| 17 | phase-goal | F2 |  | `project flow` gera/atualiza/exibe/ratifica; generate lê design/source/businessIntent e não phases[]; ratify = show + AskUserQuestion + só buildFlowRatification; detector `--strict` exige M4 + stamp do documento (grafo+messages+machines) + flow.html sha; `implement` recusa sem flow em todo plano que implement aceita (AS multi/1-phase, foreign); ad-hoc sem plan file = N/A; process-map sai do write path; Iron Law vira NO IMPLEMENT WITHOUT VALIDATED FLOW. Reusar do worktree só `flowPathsForPlan` e `buildFlowRatification`. |
| 18 | business-intent | F2 |  | Todo plano que implement aceita tem flow ratificado. O PO gera, vê e carimba o fluxo no comando project flow. Sem process-map no write path. |
| 19 | business-intent | F2 |  | detector --strict (M4 + stamp + flow.html sha) → comando project flow (generate/update/show/ratify/--check/--open) → implement Step 1 + spawn recusam sem flow → CREATION_STAGES sem process-map. |
| 20 | business-intent | F2 |  | Só buildFlowRatification escreve ratifiedAt/ratifiedGraphSha. Sem operatorSkip. Sem stage flow inescapável. Ready sem flow é legal. Reusar do worktree 86c1c2d4 só flowPathsForPlan e buildFlowRatification. Sem mergear HTML Mermaid. |
| 21 | business-intent | F2 |  | Pacote npm, editor visual, copiar Arch, feature PDTI, reabrir Mermaid como produto. |
| 22 | business-intent | F2 |  | G-F2-1: `node --test tests/find-missing-flow.test.js tests/flow-ratification.test.js` exit 0 e `--check` no dogfood; process.yaml sozinho não passa `--strict`. G-F2-2: `rg find-missing-flow skills/core/implement.md` e CREATION_STAGES sem process-map. |
| 23 | exit-criteria | F2 |  | FAILS when find-missing-flow --strict or project flow --check accepts a document missing any M4 piece, when process.yaml alone satisfies the detector, or when those tests omit a --check path on the migrated dogfood fixture |
| 24 | exit-criteria | F2 |  | FAILS when implement can spawn without flow or when CREATION_STAGES still lists process-map |
| 25 | business-intent | F0 |  | O PO navega e valida um fluxo operacional (negócio + conversa + estados). O shape 1.0 no disco passa a ser o MODEL. Implement recusa plano sem flow ratificado. |
| 26 | business-intent | F0 |  | Schema "1.0" novo → validate-flow + dogfood reescrito → (F1/F2 depois). Draft do grafo a partir de design/source/BI, nunca de phases[]. |
| 27 | business-intent | F0 |  | Sem dual-read process.yaml. Sem regras PDTI no core. Sem bump "2.0". Sem mergear 86c1c2d4. effects[] vazio é válido; key ausente não. |
| 28 | business-intent | F0 |  | Renderer, comando project flow, detector, implement HARD, copiar Arch, editor visual, pacote npm, feature PDTI. |
| 29 | business-intent | F0 |  | node --test tests/validate-flow.test.js verde no MODEL. Dogfood valida. type: sequence e states único falham. schemaVersion continua "1.0". |
| 30 | phase-goal | F0 |  | Schema `"1.0"` expressa o MODEL (activity/xor/and/join/subprocess/event/end, messages, machines[], effects kind+label+target). validate-flow (AJV 2020 + regras de grafo) aceita o dogfood reescrito e rejeita o shape velho (`type: sequence`, `states` único, `effect.statusTo`). Sem regras PDTI no core. |
| 31 | task-acceptance | F0 | T-001 | schemaVersion const remains 1.0; node type enum is activity xor and join subprocess event end; machines array exists; transition effect requires kind (email notify write other) plus label plus target; sequence decision and single states object are not valid node/root shapes |
| 32 | task-acceptance | F0 | T-002 | neighbors walk activity xor and join subprocess event end; actorRef on messages; xor and and require >=2 branches; join.of must name an and; machines require >=1 node; effects key required (empty array valid); schemaVersion 1.0 with type sequence fails; tests cover broken next, one-branch xor, ghost actor, missing effects key, empty machine nodes; xor.when is unique per xor; invalid via fails; event.kind is timer\|error; subprocess.ref is in subgraphs; cycle is next to an ancestor |
| 33 | task-acceptance | F0 | T-003 | fluxo-sugestao.json validates; processLabels have no click/modal/screen words; clicks live only in messages; at least one machine with >=1 state and transitions with effects arrays; minimal-xor.json is 2 actors + 1 xor + 1 machine; type sequence and root states object fail validateFlow |
| 34 | business-intent | F1 |  | O PO navega e valida o fluxo nas três camadas (conversa/messages, BPM, machines) num painel HTML próprio, no design system do repo. F1 fecha impecável; o primeiro incremento pode ser tosco. |
| 35 | business-intent | F1 |  | render-flow (lib) → CLI grava flow.html (nunca map.html) → polish com tokens --bg-canvas/--fg-default de site/assets/ds.css (só consume). |
| 36 | business-intent | F1 |  | Sem Mermaid, Graphviz ou D2. Sem editor visual. Sem mergear 86c1c2d4. Superfície sequência = messages, não sequenceDiagram. Labels BPM sem clique/modal/tela. ds.css não é output. |
| 37 | business-intent | F1 |  | Comando project flow, detector, implement HARD, remover process-map, pacote npm, editor no browser, mudar validate-flow. |
| 38 | business-intent | F1 |  | G-F1-1: HTML próprio com as três superfícies, sem mermaid/map.html. G-F1-2: HTML usa --bg-canvas\|--fg-default e não tem mermaid. |
| 39 | task-acceptance | F1 | T-004 | given MODEL dogfood, render returns HTML containing three distinct surfaces (sequence, bpm, machines); labels on bpm omit click words; messages appear on sequence; transitions show kind label target; mutating a next id changes the output; no mermaid script tag or mermaid.initialize |
| 40 | task-acceptance | F1 | T-005 | `node scripts/render-flow.js docs/design/project-flow/dogfood/fluxo-sugestao.json -o /tmp/flow.html` writes HTML; --check exits 0 on matching content-sha; --stdout prints HTML; output filename is flow.html not map.html |
| 41 | task-acceptance | F1 | T-006 | generated HTML uses DS tokens from site/assets/ds.css (inline or linked); three surfaces remain visually distinct (separate landmarks or tabs); typography and spacing match DS scale; no tool watermark; golden HTML snapshot updates only when visual contract changes |
| 42 | business-intent | F2 |  | Todo plano que implement aceita tem flow ratificado. O PO gera, vê e carimba o fluxo no comando project flow. Sem process-map no write path. |
| 43 | business-intent | F2 |  | detector --strict (M4 + stamp + flow.html sha) → comando project flow (generate/update/show/ratify/--check/--open) → implement Step 1 + spawn recusam sem flow → CREATION_STAGES sem process-map. |
| 44 | business-intent | F2 |  | Só buildFlowRatification escreve ratifiedAt/ratifiedGraphSha. Sem operatorSkip. Sem stage flow inescapável. Ready sem flow é legal. Reusar do worktree 86c1c2d4 só flowPathsForPlan e buildFlowRatification. Sem mergear HTML Mermaid. |
| 45 | business-intent | F2 |  | Pacote npm, editor visual, copiar Arch, feature PDTI, reabrir Mermaid como produto. |
| 46 | business-intent | F2 |  | G-F2-1: `node --test tests/find-missing-flow.test.js tests/flow-ratification.test.js` exit 0 e `--check` no dogfood; process.yaml sozinho não passa `--strict`. G-F2-2: `rg find-missing-flow skills/core/implement.md` e CREATION_STAGES sem process-map. |
| 47 | phase-goal | F2 |  | `project flow` gera/atualiza/exibe/ratifica; detector `--strict` exige M4 + stamp + flow.html sha; `implement` recusa sem artefato; process-map sai do write path; Iron Law vira NO IMPLEMENT WITHOUT VALIDATED FLOW. Reusar do worktree só `flowPathsForPlan` e `buildFlowRatification`. |
| 48 | task-acceptance | F2 | T-007 | --strict exit 0 only when flow.json validates, >=1 messages, >=1 machine with >=1 state, ratifiedAt set, ratifiedGraphSha matches, flow.html exists with matching content-sha; missing any piece exits non-zero; process.yaml alone does not satisfy |
| 49 | task-acceptance | F2 | T-008 | grammar lists flow; alias process loads project-flow.md only; buildFlowRatification is the only writer of ratifiedAt and ratifiedGraphSha; generate/update/show/--check/--open are documented; AskUserQuestion after show is required before stamp |
| 50 | task-acceptance | F2 | T-009 | implement Step 1 runs find-missing-flow --strict on the plan path; non-zero refuses code and spawn; assert-automate-gate --gate spawn fails closed without the artifact; docs/kb/flow.md states the Iron Law and the command; no chat waiver |
| 51 | task-acceptance | F2 | T-010 | CREATION_STAGES goes summaries then reviews with no process-map entry; mid-creation process-map remaps to reviews; Iron Law text is NO IMPLEMENT WITHOUT VALIDATED FLOW; project process aliases to flow; ready without flow remains legal |

### Delivered surface (actual)

- **commit SHAs (4):** `e681fbd616d6d21dd4f060641a47f3a404664fe8`, `cbb2a9147edc204d76e946a8e0c029adf5ae62fb`, `adeccc3c30a4a94a224fff022e49a823a875f012`, `af59723da5fc60fd2647cdf462d343e921a2d31f`
- **paths (22):** `[object Object]`, `scripts/find-missing-flow.js`, `tests/find-missing-flow.test.js`, `skills/core/project.md`, `skills/shared/project-assets/project-flow.md`, `scripts/lib/flow-ratification.js`, `tests/flow-ratification.test.js`, `skills/core/implement.md`, `scripts/assert-automate-gate.js`, `tests/assert-automate-gate.test.js`, `docs/kb/flow.md`, `scripts/creation-gates.js`, `tests/creation-gates.test.js`, `skills/shared/project-assets/project-create-plan.md`, `skills/shared/project-assets/new-plan/stage-8.md`, `skills/shared/project-assets/new-plan/stage-9.md`, `CLAUDE.md`, `docs/kb/process-map.md`, `skills/shared/project-assets/new-plan/stage-process-map.md`, `skills/shared/project-assets/new-plan/stage-7.md`, `skills/shared/project-assets/project-process-map.md`, `tests/find-missing-process-map.test.js`

| # | kind | phase | task | status | shas |
|---|------|-------|------|--------|------|
| 1 | task-done | F0 | T-001 | done | 0 |
| 2 | output-path | F0 | T-001 |  | 0 |
| 3 | task-done | F0 | T-002 | done | 0 |
| 4 | output-path | F0 | T-002 |  | 0 |
| 5 | output-path | F0 | T-002 |  | 0 |
| 6 | task-done | F0 | T-003 | done | 0 |
| 7 | output-path | F0 | T-003 |  | 0 |
| 8 | output-path | F0 | T-003 |  | 0 |
| 9 | output-path | F0 | T-003 |  | 0 |
| 10 | task-done | F1 | T-004 | done | 0 |
| 11 | output-path | F1 | T-004 |  | 0 |
| 12 | output-path | F1 | T-004 |  | 0 |
| 13 | task-done | F1 | T-005 | done | 0 |
| 14 | output-path | F1 | T-005 |  | 0 |
| 15 | output-path | F1 | T-005 |  | 0 |
| 16 | task-done | F1 | T-006 | done | 0 |
| 17 | output-path | F1 | T-006 |  | 0 |
| 18 | output-path | F1 | T-006 |  | 0 |
| 19 | task-done | F2 | T-007 | done | 0 |
| 20 | output-path | F2 | T-007 |  | 0 |
| 21 | output-path | F2 | T-007 |  | 0 |
| 22 | task-done | F2 | T-008 | done | 0 |
| 23 | output-path | F2 | T-008 |  | 0 |
| 24 | output-path | F2 | T-008 |  | 0 |
| 25 | output-path | F2 | T-008 |  | 0 |
| 26 | output-path | F2 | T-008 |  | 0 |
| 27 | task-done | F2 | T-009 | done | 0 |
| 28 | output-path | F2 | T-009 |  | 0 |
| 29 | output-path | F2 | T-009 |  | 0 |
| 30 | output-path | F2 | T-009 |  | 0 |
| 31 | output-path | F2 | T-009 |  | 0 |
| 32 | task-done | F2 | T-010 | done | 0 |
| 33 | output-path | F2 | T-010 |  | 0 |
| 34 | output-path | F2 | T-010 |  | 0 |
| 35 | output-path | F2 | T-010 |  | 0 |
| 36 | output-path | F2 | T-010 |  | 0 |
| 37 | output-path | F2 | T-010 |  | 0 |
| 38 | output-path | F2 | T-010 |  | 0 |
| 39 | output-path | F2 | T-010 |  | 0 |
| 40 | output-path | F2 | T-010 |  | 0 |
| 41 | output-path | F2 | T-010 |  | 0 |
| 42 | output-path | F2 | T-010 |  | 0 |
| 43 | output-path | F2 | T-010 |  | 0 |
| 44 | output-path | F2 | T-010 |  | 0 |
| 45 | claim | F2 | T-007 | claimed-pass | 1 |
| 46 | claim | F2 | T-008 | claimed-pass | 1 |
| 47 | claim | F2 | T-009 | claimed-pass | 1 |
| 48 | claim | F2 | T-010 | claimed-pass | 1 |
| 49 | extra |  |  |  | 0 |
| 50 | extra |  |  |  | 0 |

### Intent vs delivered checklist

| # | status | label | note |
|---|--------|-------|------|
| 1 | partial | Schema `"1.0"` expressa o MODEL (activity/xor/and/join/subprocess/event/end, messages, machines[], effects kind+label+target). event.kind é timer\|error. xor.when é único por xor. join.of nomeia um and. subprocess.ref ∈ subgraphs. via, se presente, aponta branch existente. ciclo = next a ancestral. subgraphs: profundidade máxima 8. Lifecycle (planSlug, actor, scenario, audience, ratifiedAt, ratifiedGraphSha) permanece. validate-flow (AJV 2020 + regras de grafo) aceita o dogfood reescrito e rejeita o shape velho (`type: sequence`, `states` único, `effect.statusTo`). Sem regras PDTI no core. | phase partially evidenced |
| 2 | partial | O PO navega e valida um fluxo operacional (negócio + conversa + estados). O shape 1.0 no disco passa a ser o MODEL. Implement recusa plano sem flow ratificado. | phase partially evidenced |
| 3 | partial | Schema "1.0" novo → validate-flow + dogfood reescrito → (F1/F2 depois). Draft do grafo a partir de design/source/BI, nunca de phases[]. | phase partially evidenced |
| 4 | partial | Sem dual-read process.yaml. Sem regras PDTI no core. Sem bump "2.0". Sem mergear 86c1c2d4. effects[] vazio é válido; key ausente não. | phase partially evidenced |
| 5 | partial | Renderer, comando project flow, detector, implement HARD, copiar Arch, editor visual, pacote npm, feature PDTI. | phase partially evidenced |
| 6 | partial | G-F0-1 verde: dogfood MODEL valida com machines[]; probe type sequence é inválido; suite validate-flow no modelo novo. schemaVersion continua "1.0". | phase partially evidenced |
| 7 | partial | FAILS when old shape still validates — type sequence or single states object must be invalid; MODEL dogfood must pass with machines[] | phase partially evidenced |
| 8 | partial | FAILS when schemaVersion is not 1.0 or when PDTI status rules live in validate-flow.js | phase partially evidenced |
| 9 | partial | Render próprio (HTML/CSS/SVG no repo, sem Mermaid/Graphviz/D2) projeta sequência + fluxo BPM + máquinas a partir de flow.json. Primeiro incremento pode ser tosco. Exit = UI impecável no DS do repo (`site/assets/ds.css`). Artefato canônico `flow/flow.html`. Sem editor. | phase partially evidenced |
| 10 | partial | O PO navega e valida o fluxo nas três camadas (conversa/messages, BPM, machines) num painel HTML próprio, no design system do repo. F1 fecha impecável; o primeiro incremento pode ser tosco. | phase partially evidenced |
| 11 | partial | render-flow (lib) → CLI grava flow.html (nunca map.html) → polish com tokens --bg-canvas/--fg-default de site/assets/ds.css (só consume). | phase partially evidenced |
| 12 | partial | Sem Mermaid, Graphviz ou D2. Sem editor visual. Sem mergear 86c1c2d4. Superfície sequência = messages, não sequenceDiagram. Labels BPM sem clique/modal/tela. ds.css não é output. | phase partially evidenced |
| 13 | partial | Comando project flow, detector, implement HARD, remover process-map, pacote npm, editor no browser, mudar validate-flow. | phase partially evidenced |
| 14 | partial | G-F1-1: HTML próprio com as três superfícies, sem mermaid/map.html. G-F1-2: HTML usa --bg-canvas\|--fg-default e não tem mermaid. | phase partially evidenced |
| 15 | partial | FAILS when render-flow uses Mermaid/Graphviz/D2 (import or sequenceDiagram/flowchart/stateDiagram in HTML), emits map.html, or omits one of the three native surfaces | phase partially evidenced |
| 16 | partial | FAILS when the generated dogfood HTML still looks like a prototype (no DS custom properties from site/assets/ds.css, surfaces collapsed, mermaid present). Do not look for a `ds-` class prefix — ds.css has none. | phase partially evidenced |
| 17 | partial | `project flow` gera/atualiza/exibe/ratifica; generate lê design/source/businessIntent e não phases[]; ratify = show + AskUserQuestion + só buildFlowRatification; detector `--strict` exige M4 + stamp do documento (grafo+messages+machines) + flow.html sha; `implement` recusa sem flow em todo plano que implement aceita (AS multi/1-phase, foreign); ad-hoc sem plan file = N/A; process-map sai do write path; Iron Law vira NO IMPLEMENT WITHOUT VALIDATED FLOW. Reusar do worktree só `flowPathsForPlan` e `buildFlowRatification`. | phase partially evidenced |
| 18 | partial | Todo plano que implement aceita tem flow ratificado. O PO gera, vê e carimba o fluxo no comando project flow. Sem process-map no write path. | phase partially evidenced |
| 19 | partial | detector --strict (M4 + stamp + flow.html sha) → comando project flow (generate/update/show/ratify/--check/--open) → implement Step 1 + spawn recusam sem flow → CREATION_STAGES sem process-map. | phase partially evidenced |
| 20 | partial | Só buildFlowRatification escreve ratifiedAt/ratifiedGraphSha. Sem operatorSkip. Sem stage flow inescapável. Ready sem flow é legal. Reusar do worktree 86c1c2d4 só flowPathsForPlan e buildFlowRatification. Sem mergear HTML Mermaid. | phase partially evidenced |
| 21 | partial | Pacote npm, editor visual, copiar Arch, feature PDTI, reabrir Mermaid como produto. | phase partially evidenced |
| 22 | partial | G-F2-1: `node --test tests/find-missing-flow.test.js tests/flow-ratification.test.js` exit 0 e `--check` no dogfood; process.yaml sozinho não passa `--strict`. G-F2-2: `rg find-missing-flow skills/core/implement.md` e CREATION_STAGES sem process-map. | phase partially evidenced |
| 23 | partial | FAILS when find-missing-flow --strict or project flow --check accepts a document missing any M4 piece, when process.yaml alone satisfies the detector, or when those tests omit a --check path on the migrated dogfood fixture | phase partially evidenced |
| 24 | partial | FAILS when implement can spawn without flow or when CREATION_STAGES still lists process-map | phase partially evidenced |
| 25 | partial | O PO navega e valida um fluxo operacional (negócio + conversa + estados). O shape 1.0 no disco passa a ser o MODEL. Implement recusa plano sem flow ratificado. | phase partially evidenced |
| 26 | partial | Schema "1.0" novo → validate-flow + dogfood reescrito → (F1/F2 depois). Draft do grafo a partir de design/source/BI, nunca de phases[]. | phase partially evidenced |
| 27 | partial | Sem dual-read process.yaml. Sem regras PDTI no core. Sem bump "2.0". Sem mergear 86c1c2d4. effects[] vazio é válido; key ausente não. | phase partially evidenced |
| 28 | partial | Renderer, comando project flow, detector, implement HARD, copiar Arch, editor visual, pacote npm, feature PDTI. | phase partially evidenced |
| 29 | partial | node --test tests/validate-flow.test.js verde no MODEL. Dogfood valida. type: sequence e states único falham. schemaVersion continua "1.0". | phase partially evidenced |
| 30 | partial | Schema `"1.0"` expressa o MODEL (activity/xor/and/join/subprocess/event/end, messages, machines[], effects kind+label+target). validate-flow (AJV 2020 + regras de grafo) aceita o dogfood reescrito e rejeita o shape velho (`type: sequence`, `states` único, `effect.statusTo`). Sem regras PDTI no core. | phase partially evidenced |
| 31 | partial | schemaVersion const remains 1.0; node type enum is activity xor and join subprocess event end; machines array exists; transition effect requires kind (email notify write other) plus label plus target; sequence decision and single states object are not valid node/root shapes | task evidence incomplete (done xor SHAs) |
| 32 | partial | neighbors walk activity xor and join subprocess event end; actorRef on messages; xor and and require >=2 branches; join.of must name an and; machines require >=1 node; effects key required (empty array valid); schemaVersion 1.0 with type sequence fails; tests cover broken next, one-branch xor, ghost actor, missing effects key, empty machine nodes; xor.when is unique per xor; invalid via fails; event.kind is timer\|error; subprocess.ref is in subgraphs; cycle is next to an ancestor | task evidence incomplete (done xor SHAs) |
| 33 | partial | fluxo-sugestao.json validates; processLabels have no click/modal/screen words; clicks live only in messages; at least one machine with >=1 state and transitions with effects arrays; minimal-xor.json is 2 actors + 1 xor + 1 machine; type sequence and root states object fail validateFlow | task evidence incomplete (done xor SHAs) |
| 34 | partial | O PO navega e valida o fluxo nas três camadas (conversa/messages, BPM, machines) num painel HTML próprio, no design system do repo. F1 fecha impecável; o primeiro incremento pode ser tosco. | phase partially evidenced |
| 35 | partial | render-flow (lib) → CLI grava flow.html (nunca map.html) → polish com tokens --bg-canvas/--fg-default de site/assets/ds.css (só consume). | phase partially evidenced |
| 36 | partial | Sem Mermaid, Graphviz ou D2. Sem editor visual. Sem mergear 86c1c2d4. Superfície sequência = messages, não sequenceDiagram. Labels BPM sem clique/modal/tela. ds.css não é output. | phase partially evidenced |
| 37 | partial | Comando project flow, detector, implement HARD, remover process-map, pacote npm, editor no browser, mudar validate-flow. | phase partially evidenced |
| 38 | partial | G-F1-1: HTML próprio com as três superfícies, sem mermaid/map.html. G-F1-2: HTML usa --bg-canvas\|--fg-default e não tem mermaid. | phase partially evidenced |
| 39 | partial | given MODEL dogfood, render returns HTML containing three distinct surfaces (sequence, bpm, machines); labels on bpm omit click words; messages appear on sequence; transitions show kind label target; mutating a next id changes the output; no mermaid script tag or mermaid.initialize | task evidence incomplete (done xor SHAs) |
| 40 | partial | `node scripts/render-flow.js docs/design/project-flow/dogfood/fluxo-sugestao.json -o /tmp/flow.html` writes HTML; --check exits 0 on matching content-sha; --stdout prints HTML; output filename is flow.html not map.html | task evidence incomplete (done xor SHAs) |
| 41 | partial | generated HTML uses DS tokens from site/assets/ds.css (inline or linked); three surfaces remain visually distinct (separate landmarks or tabs); typography and spacing match DS scale; no tool watermark; golden HTML snapshot updates only when visual contract changes | task evidence incomplete (done xor SHAs) |
| 42 | partial | Todo plano que implement aceita tem flow ratificado. O PO gera, vê e carimba o fluxo no comando project flow. Sem process-map no write path. | phase partially evidenced |
| 43 | partial | detector --strict (M4 + stamp + flow.html sha) → comando project flow (generate/update/show/ratify/--check/--open) → implement Step 1 + spawn recusam sem flow → CREATION_STAGES sem process-map. | phase partially evidenced |
| 44 | partial | Só buildFlowRatification escreve ratifiedAt/ratifiedGraphSha. Sem operatorSkip. Sem stage flow inescapável. Ready sem flow é legal. Reusar do worktree 86c1c2d4 só flowPathsForPlan e buildFlowRatification. Sem mergear HTML Mermaid. | phase partially evidenced |
| 45 | partial | Pacote npm, editor visual, copiar Arch, feature PDTI, reabrir Mermaid como produto. | phase partially evidenced |
| 46 | partial | G-F2-1: `node --test tests/find-missing-flow.test.js tests/flow-ratification.test.js` exit 0 e `--check` no dogfood; process.yaml sozinho não passa `--strict`. G-F2-2: `rg find-missing-flow skills/core/implement.md` e CREATION_STAGES sem process-map. | phase partially evidenced |
| 47 | partial | `project flow` gera/atualiza/exibe/ratifica; detector `--strict` exige M4 + stamp + flow.html sha; `implement` recusa sem artefato; process-map sai do write path; Iron Law vira NO IMPLEMENT WITHOUT VALIDATED FLOW. Reusar do worktree só `flowPathsForPlan` e `buildFlowRatification`. | phase partially evidenced |
| 48 | matched | --strict exit 0 only when flow.json validates, >=1 messages, >=1 machine with >=1 state, ratifiedAt set, ratifiedGraphSha matches, flow.html exists with matching content-sha; missing any piece exits non-zero; process.yaml alone does not satisfy | task done with claim SHA(s) |
| 49 | matched | grammar lists flow; alias process loads project-flow.md only; buildFlowRatification is the only writer of ratifiedAt and ratifiedGraphSha; generate/update/show/--check/--open are documented; AskUserQuestion after show is required before stamp | task done with claim SHA(s) |
| 50 | matched | implement Step 1 runs find-missing-flow --strict on the plan path; non-zero refuses code and spawn; assert-automate-gate --gate spawn fails closed without the artifact; docs/kb/flow.md states the Iron Law and the command; no chat waiver | task done with claim SHA(s) |
| 51 | matched | CREATION_STAGES goes summaries then reviews with no process-map entry; mid-creation process-map remaps to reviews; Iron Law text is NO IMPLEMENT WITHOUT VALIDATED FLOW; project process aliases to flow; ready without flow remains legal | task done with claim SHA(s) |
| 52 | extra | Post-F2 diagram engine / HTTP show / flow instance (not in F0-F2 SPEC) | 34 commits after 025269ca; render-flow still list-based (memory next session) |

Receipt field: stamp non-empty `intentVsDelivered` rows (status one of
`matched` | `partial` | `missing` | `extra`) on the plan-end receipt.
