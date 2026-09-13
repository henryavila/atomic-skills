---
schemaVersion: "0.1"
slug: release-consistency
title: Release consistency — PR-only default branch + GH Release + npm stage
version: "1.0"
status: active
started: 2026-09-13T16:27:44.146Z
lastUpdated: 2026-09-13T16:28:04.776Z
branch: plan/release-consistency
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: PR-only na default
    body: "`save-and-push` recusa push na default (`origin/HEAD`, fallback
      main|master); abre ou instrui PR; sem ask de push direto; sem auto-merge."
  - id: P2
    title: Chooser determinístico
    body: a skill `release` não inventa bump; script classifica a partir de commits
      + CHANGELOG Unreleased.
  - id: P3
    title: Stage para npm
    body: path feliz npm é Action `npm stage publish` + approve 2FA humano; publish
      direto é proibido.
  - id: P4
    title: Dual-mode
    body: sem npm no escopo → só GH Release; npm sem Action stage → recusar ship npm
      e oferecer adopt.
  - id: P5
    title: Templates opt-in
    body: assets no pacote AS; materialização com `--check` + diff + consentimento;
      installer não escreve no consumer repo.
  - id: P6
    title: Enforcement executável
    body: Iron Laws + scripts/CI com exit non-zero; prosa sozinha não conta.
  - id: P7
    title: Dogfood após fixture
    body: migrar `publish.yml` do AS para stage no mesmo plano, só depois da fixture
      verde.
glossary:
  - term: default branch
    definition: Branch de integração resolvida via `git symbolic-ref
      refs/remotes/origin/HEAD`, com fallback `main`/`master`
  - term: npm no escopo
    definition: "`package.json` na raiz, `private !== true`, sem opt-out explícito
      (`--no-npm`)"
  - term: chooser
    definition: Script determinístico que emite plan/apply/ship de versão (padrão Titan)
  - term: stage
    definition: Upload npm OIDC que exige `npm stage approve` com 2FA antes de ficar
      instalável
  - term: adopt/init
    definition: Materialização opt-in de templates release no working tree do consumer
  - term: pin
    definition: Versão/identificador do template no apply, para `--check` e anti-drift
phases:
  - id: F0
    slug: release-consistency-f0-contrato-compartilhado-save-and-push-pr
    title: Contrato compartilhado + save-and-push PR-only
    goal: Extrair detecção de default branch e helpers de conventional commit para
      assets compartilhados; endurecer `save-and-push` para recusar push na
      default e abrir/instruir PR. Sem skill `release` ainda.
    dependsOn: []
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F0-1
          description: FAILS when save-and-push still offers push directly to main/master
            or lacks default-branch detection via origin/HEAD
          status: pending
          verifier:
            kind: shell
            command: node --test tests/save-and-push-pr-only.test.js
              tests/release-assets-contract.test.js
    status: active
    businessIntent:
      value: Agentes param de fazer push na default branch sem PR; a base
        compartilhada (default branch + conventional commits) e o save-and-push
        endurecido fecham o atalho.
      workflow: "1) Extrair assets shared de default-branch e conventional-commits com
        testes. 2) Endurecer save-and-push: recusar push na default, abrir ou
        instruir PR. 3) Validar com testes de contrato até G-F0-1."
      rules: Default branch via origin/HEAD com fallback main|master. Sem perguntar
        push direto. Sem auto-merge. Sem implementar skill
        release/chooser/templates nesta fase.
      outOfScope: Skill release, scripts chooser, templates Action, migrar publish.yml
        do AS, reframe catalog what_is_not.
      doneWhen: tests/release-assets-contract.test.js e
        tests/save-and-push-pr-only.test.js verdes; G-F0-1 passa; save-and-push
        nao oferece a opcao push directly to main.
    summary: Base compartilhada e save-and-push recusando push na default.
  - id: F1
    slug: release-consistency-f1-skill-release-chooser-templates
    title: Skill release + chooser + templates
    goal: Skill core `release` orquestra plan/apply/ship; scripts determinísticos no
      pacote; templates stage e GH-only versionados sob release-assets;
      adopt/init com MUST check+diff+consent; dual-mode D4 enforced. Sem migrar
      publish.yml do AS ainda.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-F1-1
          description: FAILS when chooser allows inventing patch for feat or when release
            skill is missing from catalog
          status: pending
          verifier:
            kind: shell
            command: node --test tests/semver-bump.test.js tests/release-cli.test.js && rg
              -q '^  release:' meta/catalog.yaml && npm run validate-skills
        - id: G-F1-2
          description: FAILS when stage template still uses direct npm publish as happy
            path or adopt skips check/diff/consent
          status: pending
          verifier:
            kind: shell
            command: node --test tests/release-adopt.test.js
    status: pending
    summary: Skill release, chooser determinístico e templates stage/GH-only.
  - id: F2
    slug: release-consistency-f2-fixture-dogfood-as-stage-migration-catal
    title: Fixture dogfood + AS stage migration + catalog reframe
    goal: Fixture de consumer prova PR-only, chooser, dual-mode e template stage;
      depois migrar `.github/workflows/publish.yml` do Atomic Skills para stage;
      reframe `product.what_is_not`; documentar runbook de approve.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-F2-1
          description: FAILS when fixture tests are red or when AS publish.yml still uses
            direct npm publish as happy path
          status: pending
          verifier:
            kind: shell
            command: "node --test tests/release-fixture.test.js && rg -q 'stage publish'
              .github/workflows/publish.yml && ! rg -q '^\\s+- run: npm publish'
              .github/workflows/publish.yml"
        - id: G-F2-2
          description: FAILS when catalog reframe drops the not-a-git-workflow boundary or
            omits agent-gate clarification
          status: pending
          verifier:
            kind: shell
            command: node --test tests/catalog-product-boundary.test.js
    status: pending
    summary: Fixture prova o contrato; AS migra para stage; catalog reframe.
references: []
planActive: true
planTitle: Release consistency — PR-only default branch + GH Release + npm stage
---

# Release consistency — PR-only default branch + GH Release + npm stage

## 1. Context

Agentes empurram para a default branch, inventam semver e publicam npm direto. Este plano integra no Atomic Skills a disciplina ratificada em `projects/atomic-skills/release-consistency/design.md`: PR-only na default, chooser determinístico, GitHub Release, npm opcional via stage+2FA, templates opt-in no pacote AS, dogfood do próprio AS após fixture.

## 2. Inviolable principles

- **P1 PR-only na default** — `save-and-push` recusa push na default (`origin/HEAD`, fallback main|master); abre ou instrui PR; sem ask de push direto; sem auto-merge.
- **P2 Chooser determinístico** — a skill `release` não inventa bump; script classifica a partir de commits + CHANGELOG Unreleased.
- **P3 Stage para npm** — path feliz npm é Action `npm stage publish` + approve 2FA humano; publish direto é proibido.
- **P4 Dual-mode** — sem npm no escopo → só GH Release; npm sem Action stage → recusar ship npm e oferecer adopt.
- **P5 Templates opt-in** — assets no pacote AS; materialização com `--check` + diff + consentimento; installer não escreve no consumer repo.
- **P6 Enforcement executável** — Iron Laws + scripts/CI com exit non-zero; prosa sozinha não conta.
- **P7 Dogfood após fixture** — migrar `publish.yml` do AS para stage no mesmo plano, só depois da fixture verde.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Self-review against code-quality gates

- **G1 read-before-claim**: claims about existing code cite `skills/core/save-and-push.md` L8–12 (ask-before-push), `.github/workflows/publish.yml` L28 (`npm publish` direto), `skills/shared/local-review-assets/diff-capture.md` (`origin/HEAD`), `meta/catalog.yaml` `what_is_not` git workflow. verified_by: Stage 8 ground-truth scan.
- **G2 soft-language**: ban-list grep on plan + F0 initiative — 0 occurrences.
- **G6 reference-or-strike**: phase goals and principles map to design.md Decisions D1–D9; new work paths are creates (unverified until implemented). Unverified assertions: none that claim current code falsely.
- **G10 gate-must-be-able-to-fail**: each exit criterion states FAILS when … — none without a failure mode.

## Ground-truth review

**Status:** complete
**Scanned:** skills/core/save-and-push.md; .github/workflows/publish.yml; skills/shared/local-review-assets/diff-capture.md; meta/catalog.yaml; skills/core/ (no release.md); scripts/ (no scripts/release/)

### A — Plan premises vs code

| Premise | Result | Evidence |
|---------|--------|----------|
| save-and-push asks before push on main/master (to be hardened) | confirmed | skills/core/save-and-push.md:8-12 |
| AS publish.yml uses direct npm publish | confirmed | .github/workflows/publish.yml:28 |
| Default-branch pattern via origin/HEAD exists in review assets | confirmed | skills/shared/local-review-assets/diff-capture.md:72 |
| product.what_is_not includes not a git workflow replacement | confirmed | meta/catalog.yaml:18 |
| skills/core/release.md does not exist yet (create in F1) | confirmed absent | skills/core/ listing |
| scripts/release/* does not exist yet (create in F1) | confirmed absent | scripts/ listing |

### B — Code present, plan silent

| Area | Impact | Disposition |
|------|--------|-------------|
| plan-branch-policy.js (plan/<slug> bookkeeping) | indirect — not product default-branch policy | oos — design Non-goals / research-digest already separates |
| tests/release-blackbox.test.js (AS tarball qualification) | indirect — different meaning of "release" | oos — not consumer release hygiene |
| Installer reconcileFileSet host-only | direct constraint on template delivery | accepted — D5 / T-005 scopeBoundary |

**Counts:** premises=6 impacts=3 (0 undisposed direct)

## Reviews

- internal: clean | mode=local | 0 major+ | @ uncommitted (2026-09-13T16:43:19.882Z)
- ground-truth: complete | mode=ground-truth | fp=e33b0ac42ffa | premises=6 | impacts=3 @ uncommitted (2026-09-13T16:43:19.882Z)
- cross-model: SKIPPED — operator: sem token do revisor externo; nao tem como fazer agora; prosseguir com receipts local + ground-truth
