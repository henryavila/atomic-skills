---
schemaVersion: "0.1"
slug: product-docs-site-f4-deploy-offline-access-and-release-cutove
title: Deploy, offline access, and release cutover
goal: Publish the site to the canonical domain and ensure maintainers can open
  docs without relying only on memory of the README.
status: active
branch: plan/product-docs-site
started: 2026-07-17T16:22:27.652Z
lastUpdated: 2026-07-17T16:22:27.652Z
nextAction: Start T-011 deploy workflow
parentPlan: product-docs-site
phaseId: F4
businessIntent:
  value: Publish static product docs and give maintainers offline access + release
    notes for the cutover.
  workflow: Add CI/docs deploy path; document offline site/dist; CHANGELOG cutover note.
  rules: No secrets in repo; deploy git-driven; offline works without DNS.
  outOfScope: Actual production DNS flip if credentials missing; version bump
    without request.
  doneWhen: deploy path exists in-repo; CHANGELOG mentions docs site; offline path
    documented.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: F4-G1
    description: Deploy path for the static site exists in-repo.
    verifier:
      kind: shell
      command: test -f .github/workflows/deploy-docs.yml -o -f
        .github/workflows/pages.yml -o -f docs/deploy.md -o -f site/DEPLOY.md
      expectExitCode: 0
    status: pending
  - id: F4-G2
    description: CHANGELOG records the docs site cutover.
    verifier:
      kind: shell
      command: grep -Eiq 'atomic-skills.henryavila.com|docs site|product docs'
        CHANGELOG.md
      expectExitCode: 0
    status: pending
stack:
  - id: 1
    title: Deploy, offline access, and release cutover
    type: task
    openedAt: 2026-07-17T16:22:27.652Z
tasks:
  - id: T-011
    title: CI deploy workflow for the static site
    scopeBoundary:
      - Do not store production secrets in the repo. Do not change skill install
        paths.
    acceptance:
      - it - A workflow or documented deploy command publishes the static dist
        to the host behind atomic-skills.henryavila.com.; it Deploy is driven
        from git (main or release tag), not hand-edited remote HTML.
    verifier:
      kind: shell
      command: test -f .github/workflows/deploy-docs.yml -o -f
        .github/workflows/pages.yml -o -f docs/deploy.md -o -f site/DEPLOY.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: .github/workflows/deploy-docs.yml
      - kind: file
        path: site/DEPLOY.md
    summary: Workflow/docs de deploy estático para o domínio.
    weight: 2
    status: pending
    lastUpdated: 2026-07-17T16:22:27.652Z
  - id: T-012
    title: Offline or package-local docs path
    scopeBoundary:
      - Do not require network for the offline path once artifacts are present.
    acceptance:
      - it - Maintainers have a documented way to open the generated product
        docs from a checkout or installed package without editing remote DNS.;
        it Path is referenced from README or package description.
    verifier:
      kind: shell
      command: grep -Eiq 'generate-site|site/dist|docs
        site|atomic-skills.henryavila.com' README.md package.json
      expectExitCode: 0
    outputs:
      - kind: file
        path: package.json
      - kind: file
        path: README.md
      - kind: file
        path: bin/cli.js
    summary: Caminho offline/package-local para abrir o site gerado.
    weight: 2
    status: pending
    lastUpdated: 2026-07-17T16:22:27.652Z
  - id: T-013
    title: Release checklist for docs cutover
    scopeBoundary:
      - Do not bump package version without maintainer request; document the
        cutover steps even if version bump is separate.
    acceptance:
      - it - CHANGELOG or release note describes site URL, slim README, and
        catalog v0.3 product fields.; it Explicit note that engineering archive
        MD is not on the product site.
    verifier:
      kind: shell
      command: grep -Eiq 'atomic-skills.henryavila.com|docs site|product docs'
        CHANGELOG.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: CHANGELOG.md
    summary: CHANGELOG/cutover note do site de docs.
    weight: 1
    status: pending
    lastUpdated: 2026-07-17T16:22:27.652Z
parked: []
emerged: []
summary: Deploy CI, acesso offline/local e nota de release/CHANGELOG.
---

# F4 deploy offline release
