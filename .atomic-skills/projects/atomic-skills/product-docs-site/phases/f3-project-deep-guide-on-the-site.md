---
schemaVersion: "0.1"
slug: product-docs-site-f3-project-deep-guide-on-the-site
title: Project deep guide on the site
goal: Move the project mental-model documentation onto the site as a data-driven
  page, without stuffing domain model into core.project catalog fields.
status: active
branch: plan/product-docs-site
started: 2026-07-17T16:13:16.000Z
lastUpdated: 2026-07-17T16:13:16.000Z
nextAction: Start T-009 project-guide dataset
parentPlan: product-docs-site
phaseId: F3
businessIntent:
  value: Project mental model lives on the product site via a dedicated dataset,
    not core.project catalog bloat.
  workflow: Author meta/product/project-guide.yaml; render
    site/dist/project/index.html; deprecation note on onboarding monólito.
  rules: Do not expand core.project with state machines; keep skill runtime unchanged.
  outOfScope: Deploy, README further, retiring all docs/skills.
  doneWhen: generate-site emits project guide page; onboarding path deprecation
    documented.
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F3-G1
    description: Site includes a project guide page built from a dedicated dataset.
    verifier:
      kind: shell
      command: npm run generate-site && (test -f site/dist/project/index.html || test
        -f docs/site/dist/project/index.html || test -f site/dist/project.html
        || test -f docs/site/dist/project.html)
      expectExitCode: 0
    status: pending
stack:
  - id: 1
    title: Project deep guide on the site
    type: task
    openedAt: 2026-07-17T16:13:16.000Z
tasks:
  - id: T-009
    title: Project-guide dataset and route
    scopeBoundary:
      - Do not change project skill runtime behavior or .atomic-skills state
        schemas. Do not delete docs/design/project-onboarding/index.html until
        the site page is verified equivalent in content coverage for model,
        flow, can/cannot, and commands index.
    acceptance:
      - it - Dataset encodes entities, lifecycle spine stages, can-do and
        cannot-do rules, and command groups sufficient to render a guide page.;
        it Site build emits a project guide page that lists those structures.;
        it core.project in catalog.yaml is not expanded with full state-machine
        graphs.
    verifier:
      kind: shell
      command: npm run generate-site && (test -f site/dist/project/index.html || test
        -f docs/site/dist/project/index.html || test -f site/dist/project.html
        || test -f docs/site/dist/project.html)
      expectExitCode: 0
    outputs:
      - kind: file
        path: meta/product/project-guide.yaml
      - kind: file
        path: scripts/lib/render-site.js
      - kind: file
        path: scripts/generate-site.js
    summary: Dataset project-guide + rota no site.
    weight: 4
    status: pending
    lastUpdated: 2026-07-17T16:13:16.000Z
  - id: T-010
    title: Onboarding HTML deprecation path
    scopeBoundary:
      - Do not break package.json files list consumers without a replacement
        path for offline guide if still shipped.
    acceptance:
      - it - Either the package ships the new site project page as the offline
        guide, or docs/design/project-onboarding clearly points to the site
        route as canonical with a dated deprecation note.; it package.json files
        array remains consistent with what is shipped.
    verifier:
      kind: shell
      command: npm run generate-site && (test -f site/dist/project/index.html || test
        -f docs/site/dist/project/index.html || test -f site/dist/project.html
        || test -f docs/site/dist/project.html)
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/design/project-onboarding/index.html
      - kind: file
        path: docs/design/project-onboarding/README.md
      - kind: file
        path: package.json
    summary: Deprecar ou redirecionar onboarding HTML monólito.
    weight: 1
    status: pending
    lastUpdated: 2026-07-17T16:13:16.000Z
parked: []
emerged: []
summary: Guia profundo do project no site via dataset dedicado (não expandir
  core.project).
---

# F3 project guide
