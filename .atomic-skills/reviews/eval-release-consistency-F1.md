# evaluationReport
planSlug: release-consistency
phaseId: F1
verdict: pass
evaluatedAt: 2026-09-24T23:27:10Z
worktree: /Volumes/External/code/atomic-skills/.worktrees/release-consistency
HEAD: b3d3cb5ec24fee4fa715bef9a6a567cfc2574ec3
claimReport: .atomic-skills/status/automate/release-consistency-claims.json
claimVerifiedCommit: 2e6d7afc7fb5355c4faf27235161219d0681e845
writerTasks: T-003 claimed-pass (626a5965); T-004 claimed-pass (3715f9cd, de8fde3f); T-005 claimed-pass (0f610f48)

## Summary
F1 goal met: deterministic chooser (`scripts/release/semver-bump.js` + `release.js` plan/apply/ship) refuses feature→patch; core skill `release` + catalog `iron_law` + docs; stage and GH-only templates under `skills/shared/release-assets/templates/`; adopt MUST check+diff+consent. Dual-mode D4 documented in skill (npm scope / stage Action / refuse bare publish / offer adopt). AS `.github/workflows/publish.yml` not migrated (still direct `npm publish`). Live G-F1-1 and G-F1-2 verifiers: exit 0. Durable plan/initiative gate stamps remain `pending` for orchestrator phase-done.

## findings
- note / gate / plan.md:G-F1-1,G-F1-2 + phases/f1-…:exitGates / Criterion status fields are still `pending` in durable plan/initiative YAML. Content predicates and live verifiers pass; orchestrator stamps at phase-done.
- note / oos / .github/workflows/publish.yml:28 / Out-of-scope held: AS publish workflow still `npm publish --provenance --access public`. No F1 diff on that path. Fixture dogfood / AS stage migration remains F2.
- note / chooser / scripts/release/semver-bump.js:136-143, tests/semver-bump.test.js / `classifyBump` maps feat/Added/Changed→minor, fix/Fixed-only→patch, 0.x breaking→minor; gate `featureSignal forbids patch` upgrades erroneous patch. `release.js` plan prints next; apply rewrites package.json + CHANGELOG Unreleased; ship refuses `kind=none` and already-published npm versions; no `npm publish` in ship path.
- note / skill+catalog / skills/core/release.md:8-23,46-56; meta/catalog.yaml:115-163; docs/skills/release.md / Iron Law `NO BUMP WITHOUT THE CHOOSER.`; HARD-GATE forbids inventing bump and bare registry publish; Dual-mode D4 table (no npm→GH-only; npm+stage→stage publish+2FA; npm without stage→refuse implied npm publish + offer adopt). Catalog entry `release` with `iron_law`; `validate-skills` 17 skills OK.
- note / templates+adopt / skills/shared/release-assets/templates/publish-stage.yml:6-40; publish-gh-only.yml; adopt.md:21-67; tests/release-adopt.test.js / Stage template: `release: types: [published]`, `id-token: write`, `npm@11.19.1 stage publish --access public` — not bare `npm publish`. GH-only template has no registry publish. adopt.md MUST dry-run/`--check`+pin → show diff → consent → write; installer/`reconcileFileSet` must not write consumer `.github`. release.md points at adopt.md.
- note / dual-mode depth / skills/core/release.md:46-56 vs scripts/release/release.js / Dual-mode is skill-protocol + template contract. `release.js --ship` never runs npm publish (GH tag/release only). No executable detector in `release.js` that inspects adopted stage Action before ship — matches T-004 acceptance (“documents dual-mode”), not a G-F1-1/G-F1-2 fail. Executable stage-Action presence checks remain agent-facing via release.md Refuse/Adopt steps.
- note / claims / release-consistency-claims.json / All three tasks `claimed-pass` with exit 0 transcripts; merge commit `2e6d7afc` lands chooser, skill/catalog/docs/site, templates+adopt+tests (17 files, +1798). Checkpoint HEAD `b3d3cb5e` after merge.

## businessIntentCheck
value: pass — Operators/agents cut release via deterministic chooser and stage/GH-only templates; skill forbids inventing semver and bare `npm publish` (`skills/core/release.md:8-23`; `semver-bump.js` feature-forbids-patch gate; stage template `stage publish` only).

workflow: pass — (1) Chooser plan/apply/ship + `tests/semver-bump.test.js` / `tests/release-cli.test.js` (T-003). (2) Skill + catalog + docs/skills/release.md + validate-skills (T-004). (3) Templates stage/GH-only + adopt check/diff/consent; dual-mode D4 in skill (T-005).

rules: pass — Chooser does not invent bump (feat/Added/Changed→minor; fix→patch; 0.x breaking→minor). Dual-mode: no npm→GH-only; npm without stage→refuse implied npm publish + offer adopt (`release.md:46-56`). Adopt MUST `--check`+diff+consent (`adopt.md:21-59`). Installer must not write consumer `.github` (`adopt.md:5-7`, `release.md:112`). AS publish.yml not migrated this phase.

outOfScope: pass — `.github/workflows/publish.yml` still direct npm publish (F2). No fixture dogfood. No `product.what_is_not` reframe. No auto-merge. No Bypass 2FA tokens. save-and-push PR-only not weakened (F1 paths do not touch that skill body beyond catalog/site regen for release entry).

doneWhen: pass — Live `node --test tests/semver-bump.test.js tests/release-cli.test.js` → 19 pass / 0 fail; `rg '^  release:' meta/catalog.yaml` exit 0; `npm run validate-skills` exit 0; `node --test tests/release-adopt.test.js` → 5 pass / 0 fail; stage template uses `stage publish`; adopt requires check/diff/consent. G-F1-1 and G-F1-2 content criteria satisfied; durable gate status remains pending for orchestrator stamp.

## exitGates
- id: G-F1-1
  status: pass
  note: FAILS-when = chooser allows inventing patch for feat OR release missing from catalog. classifyBump + release-cli feature-forbids-patch tests green; catalog has `release:`; validate-skills exit 0. Live combined verifier exit 0 on this worktree. Plan/initiative criterion field still `pending` (orchestrator phase-done stamps; not a content fail).
- id: G-F1-2
  status: pass
  note: FAILS-when = stage template uses direct npm publish as happy path OR adopt skips check/diff/consent. `tests/release-adopt.test.js` asserts stage `stage publish` without unprotected `npm publish`, GH-only has no registry publish, adopt.md requires check/pin/diff/consent, release.md points at adopt. Live verifier exit 0. Durable stamp pending.

## Counts
blocker: 0
critical: 0
major: 0
minor: 0
note: 7
total: 7
