---
schemaVersion: "0.1"
slug: project-flow-f1-painel-de-3-camadas
title: Painel de 3 camadas
goal: Render próprio (HTML/CSS/SVG no repo, sem Mermaid/Graphviz/D2) projeta
  sequência + fluxo BPM + máquinas a partir de flow.json. Primeiro incremento
  pode ser tosco. Exit = UI impecável no DS do repo (`site/assets/ds.css`).
  Artefato canônico `flow/flow.html`. Sem editor.
status: done
branch: plan/project-flow
started: 2026-08-13T21:47:54.910Z
lastUpdated: 2026-08-13T21:47:54.910Z
nextAction: "Start T-004: Renderer puro das 3 camadas"
parentPlan: project-flow
phaseId: F1
businessIntent:
  value: O PO navega e valida o fluxo nas três camadas (conversa/messages, BPM,
    machines) num painel HTML próprio, no design system do repo. F1 fecha
    impecável; o primeiro incremento pode ser tosco.
  workflow: render-flow (lib) → CLI grava flow.html (nunca map.html) → polish com
    tokens --bg-canvas/--fg-default de site/assets/ds.css (só consume).
  rules: Sem Mermaid, Graphviz ou D2. Sem editor visual. Sem mergear 86c1c2d4.
    Superfície sequência = messages, não sequenceDiagram. Labels BPM sem
    clique/modal/tela. ds.css não é output.
  outOfScope: Comando project flow, detector, implement HARD, remover process-map,
    pacote npm, editor no browser, mudar validate-flow.
  doneWhen: "G-F1-1: HTML próprio com as três superfícies, sem mermaid/map.html.
    G-F1-2: HTML usa --bg-canvas|--fg-default e não tem mermaid."
tasksDone: 3
tasksTotal: 3
gatesMet: 2
gatesTotal: 2
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-F1-1
    description: FAILS when render-flow uses Mermaid/Graphviz/D2 (import or
      sequenceDiagram/flowchart/stateDiagram in HTML), emits map.html, or omits
      one of the three native surfaces
    status: met
    verifier:
      kind: shell
      command: node --test tests/render-flow.test.js && ! rg -qi 'mermaid|graphviz|d2'
        scripts/lib/render-flow.js scripts/render-flow.js && node
        scripts/render-flow.js
        docs/design/project-flow/dogfood/fluxo-sugestao.json -o
        /tmp/project-flow-f1-g1.html && ! rg -qi
        'mermaid|sequencediagram|statediagram|graphviz'
        /tmp/project-flow-f1-g1.html && rg -qi 'sequência|messages'
        /tmp/project-flow-f1-g1.html && rg -qi 'machine'
        /tmp/project-flow-f1-g1.html && rg -qi 'bpm|fluxo|activity'
        /tmp/project-flow-f1-g1.html && ! rg -q 'map\.html'
        scripts/render-flow.js
    metAt: 2026-08-13T22:00:22.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-08-13T22:00:22.000Z
      verifiedCommit: 80f51680c780879fac5bcd049067ffe1bc913340
      passed: true
      exitCode: 0
      outputSummary: G-F1-1 exit 0; 19/19 tests; no mermaid/map.html; three surfaces
    verifierLabel: "shell: node --test tests/render-flow.test.js && ! rg -qi 'mermaid|…"
    evidenceSummary: passed · 2026-08-13
  - id: G-F1-2
    description: FAILS when the generated dogfood HTML still looks like a prototype
      (no DS tokens, surfaces collapsed, mermaid present)
    status: met
    verifier:
      kind: shell
      command: node scripts/render-flow.js
        docs/design/project-flow/dogfood/fluxo-sugestao.json -o
        /tmp/project-flow-f1-gate.html && rg -q -- '--bg-canvas|--fg-default'
        /tmp/project-flow-f1-gate.html && ! rg -qi 'mermaid'
        /tmp/project-flow-f1-gate.html
    metAt: 2026-08-13T22:00:22.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-08-13T22:00:22.000Z
      verifiedCommit: 80f51680c780879fac5bcd049067ffe1bc913340
      passed: true
      exitCode: 0
      outputSummary: G-F1-2 exit 0; --bg-canvas|--fg-default present; no mermaid
    verifierLabel: "shell: node scripts/render-flow.js docs/design/project-flow/dogfoo…"
    evidenceSummary: passed · 2026-08-13
stack:
  - id: 1
    title: Painel de 3 camadas
    type: task
    openedAt: 2026-08-13T21:47:54.910Z
tasks:
  - id: T-004
    title: Renderer puro das 3 camadas
    closedAt: 2026-08-13T22:00:22.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-08-13T22:00:22.000Z
      verifiedCommit: 80f51680c780879fac5bcd049067ffe1bc913340
      passed: true
      exitCode: 0
      outputSummary: 19/19 tests; exit 0
    description: Renderer HTML das três camadas, sem Mermaid.
    status: done
    lastUpdated: 2026-08-13T21:47:54.910Z
    scopeBoundary:
      - do not import mermaid or graphviz or d2; do not reuse .worktrees
        execute-plan Mermaid HTML; do not write project flow skill command; do
        not drop process-map stage
    acceptance:
      - given MODEL dogfood, render returns HTML containing three distinct
        surfaces (sequence, bpm, machines); labels on bpm omit click words;
        messages appear on sequence; transitions show kind label target;
        mutating a next id changes the output; no mermaid script tag or
        mermaid.initialize
    verifier:
      kind: shell
      command: node --test tests/render-flow.test.js
    outputs:
      - kind: file
        path: scripts/lib/render-flow.js
      - kind: file
        path: tests/render-flow.test.js
  - id: T-005
    title: CLI render-flow e path flow.html
    closedAt: 2026-08-13T22:00:22.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-08-13T22:00:22.000Z
      verifiedCommit: 80f51680c780879fac5bcd049067ffe1bc913340
      passed: true
      exitCode: 0
      outputSummary: 19/19 tests; exit 0
    description: CLI grava flow.html e checa content-sha; nunca map.html.
    status: done
    lastUpdated: 2026-08-13T21:47:54.910Z
    scopeBoundary:
      - do not add find-missing-flow.js here; do not write ratifiedAt; do not
        emit map.html
    acceptance:
      - "`node scripts/render-flow.js
        docs/design/project-flow/dogfood/fluxo-sugestao.json -o /tmp/flow.html`
        writes HTML; --check exits 0 on matching content-sha; --stdout prints
        HTML; output filename is flow.html not map.html"
    verifier:
      kind: shell
      command: node --test tests/render-flow.test.js && node scripts/render-flow.js
        docs/design/project-flow/dogfood/fluxo-sugestao.json -o
        /tmp/project-flow-render.html && test -f /tmp/project-flow-render.html
        && ! rg -q 'map\\.html' scripts/render-flow.js
    outputs:
      - kind: file
        path: scripts/render-flow.js
      - kind: file
        path: tests/render-flow.test.js
  - id: T-006
    title: UI impecável no DS
    closedAt: 2026-08-13T22:00:22.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-08-13T22:00:22.000Z
      verifiedCommit: 80f51680c780879fac5bcd049067ffe1bc913340
      passed: true
      exitCode: 0
      outputSummary: 19/19 tests; exit 0
    description: Visual no DS; F1 não fecha enquanto parecer protótipo.
    status: done
    lastUpdated: 2026-08-13T21:47:54.910Z
    scopeBoundary:
      - do not add a browser visual editor; do not introduce mermaid; do not
        change validate-flow rules; site/assets/ds.css is read/consumed, not
        redesigned
    acceptance:
      - generated HTML uses DS tokens from site/assets/ds.css (inline or
        linked); three surfaces remain visually distinct (separate landmarks or
        tabs); typography and spacing match DS scale; no tool watermark; golden
        HTML snapshot updates only when visual contract changes
    verifier:
      kind: shell
      command: node --test tests/render-flow.test.js && node scripts/render-flow.js
        docs/design/project-flow/dogfood/fluxo-sugestao.json -o
        /tmp/project-flow-polish.html && rg -q -- '--bg-canvas|--fg-default'
        /tmp/project-flow-polish.html && ! rg -qi 'mermaid'
        /tmp/project-flow-polish.html
    outputs:
      - kind: file
        path: scripts/lib/render-flow.js
      - kind: file
        path: tests/render-flow.test.js
parked: []
emerged: []
planTitle: Project Flow — schema, painel e dentes no implement
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Painel de 3 camadas**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
