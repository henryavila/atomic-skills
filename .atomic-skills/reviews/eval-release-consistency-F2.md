# evaluationReport
planSlug: release-consistency
phaseId: F2
verdict: pass
evaluatedAt: 2026-09-24T23:51:12Z
worktree: /Volumes/External/code/atomic-skills/.worktrees/release-consistency
HEAD: 71e46ace84bbfb19b3b6d5f803719cbdeee66cd1
claimReport: .atomic-skills/status/automate/release-consistency-claims.json
claimVerifiedCommit: f58f49c29700b16962d1f45a205842521af33b12
writerTasks: T-006 claimed-pass (a2bd78da); T-007 claimed-pass (4287e01a); T-008 claimed-pass (a9ee9ffa)

## Summary
F2 goal met: consumer hygiene fixture at `tests/fixtures/release-hygiene-consumer/` proves chooser plan, dual-mode refuse-when-Action-missing, and save-and-push PR-only language without touching the blackbox fixture; Atomic Skills `.github/workflows/publish.yml` migrated to OIDC `npm stage publish` with runbook `docs/kb/release-npm-stage.md`; `product.what_is_not` keeps not-a-git-workflow replacement and adds agent-gate clarification (PR-only, stage+2FA, chooser). Live G-F2-1 and G-F2-2 verifiers: exit 0. `tests/fixtures/release-consumer/` blob unchanged across F2 (blackbox intact). Durable plan/initiative gate stamps remain `pending` for orchestrator phase-done.

## findings
- note / gate / plan.md:G-F2-1,G-F2-2 + phases/f2-…:exitGates / Criterion status fields are still `pending` in durable plan/initiative YAML. Content predicates and live verifiers pass; orchestrator stamps at phase-done.
- note / blackbox-intact / tests/fixtures/release-consumer/package.json / F2 merge `f58f49c2` does not touch `tests/fixtures/release-consumer/` or `tests/release-blackbox.test.js`. Blob id `3f67593d…` identical at F2 base `f42dfb9b` and HEAD. Hygiene path is distinct (`@example/release-hygiene-consumer`, `private: false`) vs blackbox (`atomic-skills-release-consumer-fixture`, `private: true`). `tests/release-fixture.test.js` asserts non-collision.
- note / blackbox-suite / tests/release-blackbox.test.js:173 / Live `node --test tests/release-blackbox.test.js` exits 1 on HEAD due to `validate-runtime-closure.js` unresolved literal `…/new-plan/stage-N.md` referenced from `project-create-plan.md` (placeholder pattern; real files are `stage-1.md`…`stage-9.md`). Same reference exists at pre-F2 tip `f42dfb9b`. Not an F2 path, not in G-F2-1/G-F2-2, not caused by overwriting the consumer fixture. Alignment note 2 satisfied via distinct hygiene path + intact blackbox package contract.
- note / hygiene / tests/fixtures/release-hygiene-consumer/ + tests/release-fixture.test.js / Fixture includes package.json, CHANGELOG Unreleased/Added, adopted stage workflow byte-equal to `skills/shared/release-assets/templates/publish-stage.yml` (`pin: atomic-skills/release-assets/publish-stage@v1`, `stage publish`, no bare `npm publish`). Chooser plans `0.1.0`+feat → minor `0.2.0`. Skill dual-mode refuse/adopt/GH-only opt-out language asserted; save-and-push HARD-GATE still refuses default push / no push-directly ask. Live suite: 7 pass / 0 fail.
- note / as-dogfood / .github/workflows/publish.yml + docs/kb/release-npm-stage.md + CHANGELOG.md:Unreleased / Workflow renamed “Publish to npm (stage)”; `id-token: write`; `npx npm@11.19.1 stage publish --access public`; comments forbid NODE_AUTH_TOKEN / bare npm publish happy path. Runbook documents Trusted Publisher stage-only + human **stage approve** on npm UI. CHANGELOG Unreleased Changed notes the process migration. No Bypass 2FA tokens. Live T-007 verifier exit 0.
- note / catalog-reframe / meta/catalog.yaml:16-19 + tests/catalog-product-boundary.test.js / `what_is_not` retains “A replacement for your IDE, model, or git workflow” and adds ownership/agent-gates line (PR-only, npm stage+2FA, deterministic chooser) without claiming AS replaces git workflow. Install primary unchanged (`npx @henryavila/atomic-skills install`). Host-tier honesty line kept. README PRODUCT region + docs/skills/{release,save-and-push}.md mention shared release contract. `check-docs` exit 0; `validate-skills` 17 OK. Live G-F2-2 / T-008 exit 0.
- note / claims / release-consistency-claims.json / All three tasks `claimed-pass` with exit 0 transcripts; merge commit `f58f49c2` lands 14 files (+485/−14): hygiene fixture+tests, publish.yml+runbook+CHANGELOG, catalog/README/docs/site + boundary test. Checkpoint HEAD `71e46ace` after merge.

## businessIntentCheck
value: pass — Fixture proves the consumer release contract; AS dogfood migrates publish.yml to stage; catalog `what_is_not` clarifies agent gates without claiming git-workflow replacement (`tests/release-fixture.test.js`; `.github/workflows/publish.yml` stage publish; `meta/catalog.yaml:16-19`).

workflow: pass — (1) Hygiene-consumer fixture + `tests/release-fixture.test.js` (T-006). (2) AS publish.yml → npm stage publish + `docs/kb/release-npm-stage.md` + CHANGELOG (T-007). (3) `what_is_not` reframe + docs sync + `tests/catalog-product-boundary.test.js` (T-008).

rules: pass — Fixture under `tests/fixtures/release-hygiene-consumer/` (not `release-consumer/` blackbox). No real registry publish in tests. PR-only remains (save-and-push assertions). Stage+2FA; no Bypass 2FA / NODE_AUTH_TOKEN happy path. `what_is_not` keeps not-a-git-workflow **and** adds agent gates.

outOfScope: pass — PR-only not weakened. NODE_AUTH_TOKEN publish happy path not reinstalled. Install primary unchanged. No claim that AS replaces git workflow. Blackbox fixture not overwritten. Installer journal effects untouched by F2 paths.

doneWhen: pass — Live `node --test tests/release-fixture.test.js` → 7 pass / 0 fail; `rg -q 'stage publish' .github/workflows/publish.yml` and no `^\s+- run: npm publish` happy path; `docs/kb/release-npm-stage.md` present with stage approve|Trusted Publisher; `node --test tests/catalog-product-boundary.test.js` → 3 pass; `npm run validate-skills` exit 0; `npm run check-docs` exit 0. G-F2-1 and G-F2-2 content criteria satisfied; durable gate status remains pending for orchestrator stamp.

## exitGates
- id: G-F2-1
  status: pass
  note: FAILS-when = fixture tests red OR AS publish.yml still uses direct npm publish as happy path. Live combined verifier (`node --test tests/release-fixture.test.js && rg -q 'stage publish' .github/workflows/publish.yml && ! rg -q '^\s+- run: npm publish' .github/workflows/publish.yml`) exit 0 on this worktree. Plan/initiative criterion field still `pending` (orchestrator phase-done stamps; not a content fail).
- id: G-F2-2
  status: pass
  note: FAILS-when = catalog reframe drops not-a-git-workflow boundary OR omits agent-gate clarification. `tests/catalog-product-boundary.test.js` asserts both clauses + README PRODUCT region + shared-contract docs. Live verifier exit 0. Durable stamp pending.

## Counts
blocker: 0
critical: 0
major: 0
minor: 0
note: 7
total: 7
