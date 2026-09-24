# Release consistency — PR-only default branch + GH Release + npm stage

Agentes empurram para a default branch, inventam semver e publicam npm direto. Este plano integra no Atomic Skills a disciplina ratificada em `projects/atomic-skills/release-consistency/design.md`: PR-only na default, chooser determinístico, GitHub Release, npm opcional via stage+2FA, templates opt-in no pacote AS, dogfood do próprio AS após fixture.

## Principles

- **P1 PR-only na default** — `save-and-push` recusa push na default (`origin/HEAD`, fallback main|master); abre ou instrui PR; sem ask de push direto; sem auto-merge.
- **P2 Chooser determinístico** — a skill `release` não inventa bump; script classifica a partir de commits + CHANGELOG Unreleased.
- **P3 Stage para npm** — path feliz npm é Action `npm stage publish` + approve 2FA humano; publish direto é proibido.
- **P4 Dual-mode** — sem npm no escopo → só GH Release; npm sem Action stage → recusar ship npm e oferecer adopt.
- **P5 Templates opt-in** — assets no pacote AS; materialização com `--check` + diff + consentimento; installer não escreve no consumer repo.
- **P6 Enforcement executável** — Iron Laws + scripts/CI com exit non-zero; prosa sozinha não conta.
- **P7 Dogfood após fixture** — migrar `publish.yml` do AS para stage no mesmo plano, só depois da fixture verde.

## Glossary

| Term | Definition |
|------|------------|
| default branch | Branch de integração resolvida via `git symbolic-ref refs/remotes/origin/HEAD`, com fallback `main`/`master` |
| npm no escopo | `package.json` na raiz, `private !== true`, sem opt-out explícito (`--no-npm`) |
| chooser | Script determinístico que emite plan/apply/ship de versão (padrão Titan) |
| stage | Upload npm OIDC que exige `npm stage approve` com 2FA antes de ficar instalável |
| adopt/init | Materialização opt-in de templates release no working tree do consumer |
| pin | Versão/identificador do template no apply, para `--check` e anti-drift |

## F0 — Contrato compartilhado + save-and-push PR-only

Goal: Extrair detecção de default branch e helpers de conventional commit para assets compartilhados; endurecer `save-and-push` para recusar push na default e abrir/instruir PR. Sem skill `release` ainda.

### T-001 Shared default-branch + conventional-commit helpers

- Files: skills/shared/release-assets/default-branch.md, skills/shared/release-assets/conventional-commits.md, tests/release-assets-contract.test.js
- scopeBoundary: do not edit skills/core/save-and-push.md in this task; do not add release skill or chooser scripts; do not write consumer .github workflows
- acceptance: default-branch.md documents origin/HEAD resolution plus main|master fallback; conventional-commits.md documents feat/fix/perf/breaking mapping used by both save-and-push and release; test file asserts both asset files exist and contain origin/HEAD and feat:
- verifier: kind shell command: "node --test tests/release-assets-contract.test.js"

### T-002 Harden save-and-push to PR-only on default branch

- Files: skills/core/save-and-push.md, docs/skills/save-and-push.md, tests/save-and-push-pr-only.test.js
- scopeBoundary: do not implement release skill; do not add auto-merge; do not mutate installer reconcileFileSet; do not change catalog product.what_is_not yet
- acceptance: HARD-GATE refuses push on default branch (no ask to push directly to main/master); documents branch + gh pr create when gh authenticated, else stop with explicit PR instructions; references shared default-branch asset; docs/skills/save-and-push.md matches; test asserts refuse language and absence of push-directly ask
- verifier: kind shell command: "node --test tests/save-and-push-pr-only.test.js"

```yaml
exit_gate:
  criteria:
    - { id: G-F0-1, description: "FAILS when save-and-push still offers push directly to main/master or lacks default-branch detection via origin/HEAD", status: pending, verifier: { kind: shell, command: "node --test tests/save-and-push-pr-only.test.js tests/release-assets-contract.test.js" } }
```

## F1 — Skill release + chooser + templates

Goal: Skill core `release` orquestra plan/apply/ship; scripts determinísticos no pacote; templates stage e GH-only versionados sob release-assets; adopt/init com MUST check+diff+consent; dual-mode D4 enforced. Sem migrar publish.yml do AS ainda.

### T-003 Chooser scripts plan/apply/ship

- Files: scripts/release/semver-bump.js, scripts/release/release.js, tests/semver-bump.test.js, tests/release-cli.test.js
- scopeBoundary: do not edit skills/core/save-and-push.md; do not migrate .github/workflows/publish.yml; do not write into consumer repos from installer; do not auto bump to 1.0.0 on 0.x breaking
- acceptance: classifyBump maps feat/Added/Changed to minor, fix/Fixed-only to patch, 0.x breaking to minor; plan prints next version; apply rewrites package.json version and CHANGELOG Unreleased when present; ship refuses when kind is none or when npm version already published; tests cover feature-forbids-patch gate
- verifier: kind shell command: "node --test tests/semver-bump.test.js tests/release-cli.test.js"

### T-004 Release skill body + catalog entry

- Files: skills/core/release.md, meta/catalog.yaml, docs/skills/release.md, scripts/validate-skills.js
- scopeBoundary: do not migrate AS publish.yml; do not weaken save-and-push PR-only; do not add installer scaffolding of consumer .github
- acceptance: release.md Iron Law forbids inventing bump; documents plan/apply/ship via scripts/release; documents dual-mode npm scope and stage-only Action; catalog lists release under core with iron_law; validate-skills exits 0; docs/skills/release.md generated or authored in sync
- verifier: kind shell command: "rg -q 'NO.*BUMP|não invent|never invent|chooser|semver-bump' skills/core/release.md && rg -q '^  release:' meta/catalog.yaml && npm run validate-skills"

### T-005 Templates stage + GH-only and adopt/init flow

- Files: skills/shared/release-assets/templates/publish-stage.yml, skills/shared/release-assets/templates/publish-gh-only.yml, skills/shared/release-assets/adopt.md, skills/core/release.md, tests/release-adopt.test.js
- scopeBoundary: do not have installer reconcileFileSet write consumer workflows; do not remove uninstall parity tests; do not migrate live AS publish.yml in this task
- acceptance: publish-stage.yml uses release published trigger, id-token write, and npm stage publish (not bare npm publish); adopt.md requires dry-run/--check with template pin, show diff, write only after consent; release.md points at adopt; test asserts stage template has stage publish and lacks unprotected npm publish as happy path
- verifier: kind shell command: "node --test tests/release-adopt.test.js"

```yaml
exit_gate:
  criteria:
    - { id: G-F1-1, description: "FAILS when chooser allows inventing patch for feat or when release skill is missing from catalog", status: pending, verifier: { kind: shell, command: "node --test tests/semver-bump.test.js tests/release-cli.test.js && rg -q '^  release:' meta/catalog.yaml && npm run validate-skills" } }
    - { id: G-F1-2, description: "FAILS when stage template still uses direct npm publish as happy path or adopt skips check/diff/consent", status: pending, verifier: { kind: shell, command: "node --test tests/release-adopt.test.js" } }
```

## F2 — Fixture dogfood + AS stage migration + catalog reframe

Goal: Fixture de consumer prova PR-only, chooser, dual-mode e template stage; depois migrar `.github/workflows/publish.yml` do Atomic Skills para stage; reframe `product.what_is_not`; documentar runbook de approve.

### T-006 Consumer fixture proves release contract

- Files: tests/fixtures/release-consumer/, tests/release-fixture.test.js
- scopeBoundary: do not migrate .github/workflows/publish.yml yet; do not publish real packages to npm registry; do not weaken PR-only gate
- acceptance: fixture repo includes sample package.json changelog and adopted stage workflow; tests assert chooser plan on fixture, refuse ship when Action missing without explicit GH-only opt-out, and save-and-push contract still refuses default push language; no network publish required
- verifier: kind shell command: "node --test tests/release-fixture.test.js"

### T-007 Migrate Atomic Skills publish.yml to npm stage

- Files: .github/workflows/publish.yml, docs/kb/release-npm-stage.md, CHANGELOG.md
- scopeBoundary: do not reintroduce Bypass 2FA tokens; do not change installer journal effects; do not skip fixture gate — this task assumes T-006 green
- acceptance: publish.yml stages with npm stage publish under OIDC (no NODE_AUTH_TOKEN publish happy path); docs/kb/release-npm-stage.md documents Trusted Publisher stage-only and human stage approve; CHANGELOG notes the process change under Unreleased or the release section being cut
- verifier: kind shell command: "rg -q 'stage publish' .github/workflows/publish.yml && ! rg -q '^\\s+- run: npm publish' .github/workflows/publish.yml && test -f docs/kb/release-npm-stage.md && rg -q 'stage approve|Trusted Publisher' docs/kb/release-npm-stage.md"

### T-008 Catalog what_is_not reframe + skill docs sync

- Files: meta/catalog.yaml, README.md, docs/skills/save-and-push.md, docs/skills/release.md, tests/catalog-product-boundary.test.js
- scopeBoundary: do not claim AS replaces git workflow; do not remove host-tier honesty lines; do not change install primary command
- acceptance: product.what_is_not still says AS is not a git workflow replacement AND clarifies persistence/release skills impose agent gates (PR-only, stage+2FA, chooser); release and save-and-push docs mention the shared contract; catalog-product-boundary test asserts both clauses; generate/check docs path stays green if required by repo scripts
- verifier: kind shell command: "node --test tests/catalog-product-boundary.test.js && npm run validate-skills"

```yaml
exit_gate:
  criteria:
    - { id: G-F2-1, description: "FAILS when fixture tests are red or when AS publish.yml still uses direct npm publish as happy path", status: pending, verifier: { kind: shell, command: "node --test tests/release-fixture.test.js && rg -q 'stage publish' .github/workflows/publish.yml && ! rg -q '^\\s+- run: npm publish' .github/workflows/publish.yml" } }
    - { id: G-F2-2, description: "FAILS when catalog reframe drops the not-a-git-workflow boundary or omits agent-gate clarification", status: pending, verifier: { kind: shell, command: "node --test tests/catalog-product-boundary.test.js" } }
```
