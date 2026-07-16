---
schemaVersion: "0.1"
slug: grok-build-integration
title: Grok Build native integration + cross-model review
version: "1.0"
status: active
started: 2026-07-16T13:00:21.670Z
lastUpdated: 2026-07-16T14:12:41.000Z
branch: plan/grok-build-integration
currentPhase: F1
parallelismAllowed: false
principles:
  - id: P1
    title: Plugin is the only Grok skill root
    body: From F0, install writes `~/.grok/plugins/atomic-skills/` (or project
      `.grok/plugins/atomic-skills/`). Never a parallel tree under
      `.grok/skills/atomic-skills/`.
  - id: P2
    title: Host is not the external reviewer
    body: "Cross-model review defaults: Grok host to Codex, Codex host to Grok,
      Claude host to Codex (with Grok and Codex+Grok available). Same-family
      interactive: confirm then local sealed path. Same-family non-interactive:
      HARD ABORT unless --accept-same-family-as-local (records provider:local,
      never counts as cross-model)."
  - id: P3
    title: Shared envelope, pluggable providers
    body: Two-pass sealed briefing stays provider-agnostic; only preflight and
      invocation are provider leaves under `cross-model-bridge` (logical module;
      assets may remain under codex-bridge-assets/providers/{codex,grok}/).
  - id: P4
    title: Install/uninstall parity
    body: Every journal effect for Grok plugin and hooks reverses cleanly;
      round-trip tests are the gate.
  - id: P5
    title: Skill bodies stay tool-abstract
    body: "Use defined vars `{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{WRITE_TOOL}}`,
      `{{REPLACE_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`,
      `{{INVESTIGATOR_TOOL}}`, `{{ASK_USER_QUESTION_TOOL}}` plus `ide.grok` /
      `ide.codex` profiles; no hardcoding `Bash` or `Read tool` for non-Claude
      hosts."
glossary:
  - term: Plugin root
    definition: Directory `.grok/plugins/atomic-skills/` (user or project scope)
      holding plugin.json, skills/, _assets/, hooks/
  - term: External provider
    definition: "Headless CLI family used for sealed cross-model review: codex or grok"
  - term: Same-family request
    definition: External mode whose provider family matches the host session;
      interactive confirm→local; non-interactive abort unless
      --accept-same-family-as-local
  - term: CROSS-MODEL REVIEW
    definition: Product label replacing CODEX REVIEW for cadence tracking;
      only family-different external providers qualify
phases:
  - id: F0
    slug: grok-build-integration-f0-install-render-foundation-l1-l2
    title: Install + render foundation (L1+L2)
    goal: Grok is a first-class install IDE that materializes only the plugin
      package with correct tool names for Grok and Codex renders.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: G-1
          description: IDE_CONFIG and detect include grok with plugin delivery shape and
            assets path under the plugin package.
          status: met
          metAt: 2026-07-16T13:56:15.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-16T13:56:15.000Z
            passed: true
            exitCode: 0
            outputSummary: "config.test 16 pass"
          verifier:
            kind: shell
            command: node --test tests/config.test.js
            expectExitCode: 0
        - id: G-2
          description: Render snapshots lock grok and codex tool profiles without Claude
            default names for those ides.
          status: met
          metAt: 2026-07-16T13:56:15.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-16T13:56:15.000Z
            passed: true
            exitCode: 0
            outputSummary: "render.test 34 pass"
          verifier:
            kind: shell
            command: node --test tests/render.test.js
            expectExitCode: 0
        - id: G-3
          description: Install/uninstall round-trip for grok plugin tree is clean and
            forbids dual .grok/skills/atomic-skills tree.
          status: met
          metAt: 2026-07-16T13:56:15.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-16T13:56:15.000Z
            passed: true
            exitCode: 0
            outputSummary: "roundtrip 11 pass"
          verifier:
            kind: shell
            command: node --test tests/install-uninstall-roundtrip.test.js
            expectExitCode: 0
    status: done
    reviewGate:
      status: passed
      at: 27c2e453008e44e28406c71ff4276f1ba9f13eb8
      mode: codex
      reviewFile: .atomic-skills/reviews/2026-07-16-1406-grok-build-integration-f0-codex.md
      verifiedAt: 2026-07-16T14:07:05.000Z
    businessIntent:
      value: Atomic Skills installs and runs as a first-class Grok Build plugin
        (skills + hooks), and adversarial review always uses a different model
        family than the host session so self-preference bias is reduced.
      workflow: Install selects grok → plugin package materializes under
        .grok/plugins/atomic-skills → agents invoke skills with correct tool
        names → review-code/plan pick host-aware external provider (Codex or
        Grok) with sealed two-pass envelope → CROSS-MODEL REVIEW tracks cadence
        with provider field.
      rules: Plugin is the only Grok skill root; host is never the external reviewer
        without same-family confirm→local (or non-interactive
        --accept-same-family-as-local); codex-bridge aliases to
        cross-model-bridge; install/uninstall journal parity; skill bodies use
        tool variables not hardcoded Claude names.
      outOfScope: Marketplace publish, MCP project-state server, Mode-2 execution via
        Grok, redesign of sealed-envelope science, auto-apply of external
        findings without human triage.
      doneWhen: F0 install+render plugin tree green with tool maps; F1 hooks
        Soft/Strict on Grok; F2 providers smoke; F3 CROSS-MODEL REVIEW UX; F4
        plugin harden; F5 external-both + final suites green.
  - id: F1
    businessIntent:
      value: Atomic Skills installs and runs as a first-class Grok Build plugin (skills + hooks),
        and adversarial review always uses a different model family than the host session so self-preference
        bias is reduced.
      workflow: "Install selects grok \u2192 plugin package materializes under .grok/plugins/atomic-skills\
        \ \u2192 agents invoke skills with correct tool names \u2192 project Soft/Strict hooks\
        \ fire on Grok with dual-vocab matchers \u2192 auto-update SessionStart registers on Grok\
        \ hook surface."
      rules: Plugin is the only Grok skill root; Soft = SessionStart+PreToolUse and Strict adds
        Stop; dual-vocab matchers accept Grok write tools; install/uninstall journal parity; auto-update
        must not drop Claude when both ides selected.
      outOfScope: Cross-model bridge, review-code mode flags, marketplace publish, Mode-2 Grok
        execution.
      doneWhen: 'F1 gates green: round-trip hooks reverse; project tests list Grok Soft/Strict;
        session-start/pre-write/stop fixtures pass dual-vocab.'
    slug: grok-build-integration-f1-grok-hooks-runtime-l3
    title: Grok hooks runtime (L3)
    goal: Soft and Strict project hooks plus auto-update register on Grok via plugin
      hooks and user auto-update hook file, with dual-vocabulary matchers.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: G-1
          description: Auto-update and project hook registration for Grok reverse cleanly
            in round-trip tests.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/install-uninstall-roundtrip.test.js
            expectExitCode: 0
        - id: G-2
          description: Docs and tests list Grok as a hook-capable host with Soft versus
            Strict semantics.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project.test.js
            expectExitCode: 0
        - id: G-3
          description: Fixture-driven tests fire Soft (SessionStart+PreToolUse) and Strict
            (+Stop) with dual-vocab write matchers for Grok tool names.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project.test.js && bash
              tests/hooks/session-start.test.sh && bash tests/hooks/pre-write.test.sh
              && bash tests/hooks/stop.test.sh
            expectExitCode: 0
    status: active
  - id: F2
    slug: grok-build-integration-f2-cross-model-bridge-core-l7
    title: cross-model-bridge core (L7)
    goal: Rename or alias codex-bridge to cross-model-bridge with pluggable codex
      and grok providers, host default matrix, same-family confirm-to-local
      (interactive) and abort/accept-as-local (non-interactive).
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: G-1
          description: cross-model-bridge module validates and codex alias remains
            installable.
          status: pending
          verifier:
            kind: shell
            command: npm run validate-skills
            expectExitCode: 0
        - id: G-2
          description: Grok invocation-canonical and host-default-external encode matrix
            rows plus same-family interactive and non-interactive rules.
          status: pending
          verifier:
            kind: shell
            command: test -s
              skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt
              && grep -E 'sandbox|timeout|grok' 
              skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt
              && grep -E
              'same-family|accept-same-family-as-local|HARD ABORT|confirm'
              skills/shared/codex-bridge-assets/host-default-external.md
            expectExitCode: 0
        - id: G-3
          description: Pure host-default and same-family routing helper has unit tests for
            every matrix row and non-interactive abort vs accept-as-local.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/cross-model-host-default.test.js
            expectExitCode: 0
    status: active
  - id: F3
    slug: grok-build-integration-f3-review-skill-ux-and-cross-model-revie
    title: Review skill UX and CROSS-MODEL REVIEW surfaces
    goal: review-code and review-plan expose provider modes; product cadence uses
      CROSS-MODEL REVIEW with provider field; review-due and gates stop
      hardcoding Codex-only.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: G-1
          description: validate-skills passes with updated review-code and review-plan
            modes.
          status: pending
          verifier:
            kind: shell
            command: npm run validate-skills
            expectExitCode: 0
        - id: G-2
          description: Active skill assets contain zero user-facing CODEX REVIEW product
            label strings.
          status: pending
          verifier:
            kind: shell
            command: "! rg -n 'CODEX REVIEW' skills/shared/project-assets skills/core"
            expectExitCode: 0
        - id: G-3
          description: Review file template and last-review writers include provider enum
            codex|grok|local with version field; round-trip test covers read path.
          status: pending
          verifier:
            kind: shell
            command: grep -q 'provider' 
              skills/shared/codex-bridge-assets/review-file-template.txt && node
              --test tests/review-provider-field.test.js
            expectExitCode: 0
    status: pending
  - id: F4
    slug: grok-build-integration-f4-plugin-harden-l4
    title: Plugin harden (L4)
    goal: "Grok plugin surface is complete for daily use: inspect smoke, trust docs,
      optional thin agents only if needed, journal edge cases closed."
    dependsOn:
      - F3
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: Plugin.json contract is tested and package keywords include grok.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/install.test.js && node -e "const
              p=require('./package.json'); if(!p.keywords.includes('grok'))
              process.exit(1)"
            expectExitCode: 0
    status: pending
  - id: F5
    slug: grok-build-integration-f5-polish-external-both-merge-final-veri
    title: Polish, external-both merge, final verify
    goal: external-both merges findings for triage with a deterministic contract; L5
      conditionals where needed; full suite green; plan ready to archive.
    dependsOn:
      - F4
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: G-1
          description: external-both merge contract is documented in review-code and
            review-plan (identity, severity conflict, partial failure).
          status: pending
          verifier:
            kind: shell
            command: npm run validate-skills && grep -q 'external-both'
              skills/core/review-code.md && grep -q 'external-both'
              skills/core/review-plan.md && grep -qE
              'merge key|severity conflict|partial' skills/core/review-code.md
              docs/kb/cross-model-review-design.md
            expectExitCode: 0
        - id: G-2
          description: Final regression includes config, install, round-trip, render,
            project suites and validate-skills.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/config.test.js tests/install.test.js
              tests/install-uninstall-roundtrip.test.js tests/render.test.js
              tests/project.test.js && npm run validate-skills
            expectExitCode: 0
        - id: G-3
          description: external-both merge helper unit tests cover duplicate identity and
            severity conflict.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/external-both-merge.test.js
            expectExitCode: 0
    status: pending
references: []
planActive: true
planTitle: Grok Build native integration + cross-model review
---

# Grok Build native integration + cross-model review

## 1. Context

Ship Atomic Skills as a first-class Grok Build surface (plugin-owned skills and hooks) and generalize adversarial review so the external reviewer is never the same model family as the host session. Design source of truth: `design.md` in this plan folder (user-approved 2026-07-16).

## 2. Inviolable principles

- **P1 Plugin is the only Grok skill root** — From F0, install writes `~/.grok/plugins/atomic-skills/` (or project `.grok/plugins/atomic-skills/`). Never a parallel tree under `.grok/skills/atomic-skills/`.
- **P2 Host is not the external reviewer** — Defaults: Grok→Codex, Codex→Grok, Claude→Codex (+Grok / external-both). Same-family: interactive confirm→`local`; non-interactive HARD ABORT unless `--accept-same-family-as-local` (records `provider: local`, never CROSS-MODEL).
- **P3 Shared envelope, pluggable providers** — Two-pass sealed briefing provider-agnostic; leaves under `cross-model-bridge` (logical; assets under `codex-bridge-assets/providers/{codex,grok}/`).
- **P4 Install/uninstall parity** — Every journal effect for Grok plugin and hooks reverses cleanly; round-trip tests are the gate.
- **P5 Skill bodies stay tool-abstract** — Defined vars only: `{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{WRITE_TOOL}}`, `{{REPLACE_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`, `{{INVESTIGATOR_TOOL}}`, `{{ASK_USER_QUESTION_TOOL}}` + `ide.grok` / `ide.codex` profiles. No hardcoded `Bash` / `Read tool` for non-Claude hosts.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

| Phase | Title | Status | Materialized |
|-------|-------|--------|--------------|
| F0 | Install + render foundation (L1+L2) | active | yes (3 tasks) |
| F1 | Grok hooks runtime (L3) | pending | descriptor-only |
| F2 | cross-model-bridge core (L7) | pending | descriptor-only |
| F3 | Review skill UX + CROSS-MODEL REVIEW | pending | descriptor-only |
| F4 | Plugin harden (L4) | pending | descriptor-only |
| F5 | Polish, external-both, final verify | pending | descriptor-only |

## 4. Same-family policy (D7 — load-bearing)

verified_by: design.md D7 (user-ratified 2026-07-16; non-interactive closed after codex review).

| Context | Behavior |
|---------|----------|
| Interactive + same-family mode | Confirm: equivalent to clean local agent, not cross-model. Yes → `local`. No → abort or offer other family. |
| Non-interactive + same-family, no flag | **HARD ABORT** with message naming cross-family default and `--accept-same-family-as-local`. |
| Non-interactive + `--accept-same-family-as-local` or env `ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL=1` | Run `local`; receipt `provider: local`, `sameFamilyRemap: true`; **does not** satisfy CROSS-MODEL REVIEW cadence. |
| Same-family headless CLI as “external” | **Forbidden** product path. |

## 5. external-both merge contract (F5)

verified_by: design.md open-questions resolution post-codex-review.

- Order: Codex envelope, then Grok envelope, same cleaned artifact.
- Merge key: `file:line` + normalized claim text.
- Severity conflict: keep higher severity; provenance lists both providers.
- Partial failure: keep successful provider findings; surface the failed provider error; never drop the good half silently.
- Human triage remains mandatory (auto-apply is non-goal).

## 6. Existing-code baseline (G1)

| Claim | Evidence |
|-------|----------|
| No `grok` in IDE_CONFIG today | verified_by: `src/config.js` IDE_CONFIG keys claude-code, cursor, gemini, gemini-commands, codex, opencode, github-copilot only |
| Non-Gemini render defaults to Claude tool names | verified_by: `src/render.js` `isGemini` branch vs else (`BASH_TOOL = 'Bash'`, `READ_TOOL = 'Read tool'`) |
| Auto-update only merges `.claude/settings.json` | verified_by: `src/runtime-layers/auto-update.js` jsonMerge path `.claude/settings.json` |
| Project hooks README lists Claude + Codex only | verified_by: `skills/shared/project-assets/hooks/README.md` Host hook contract section |
| Cross-model review is Codex-only today | verified_by: `docs/kb/cross-model-review-design.md` + `skills/shared/codex-bridge-assets/invocation-canonical.txt` |

Grok headless flag ids: unverified: until F2 smoke against installed `grok` CLI.

## Self-review against code-quality gates

- G1 read-before-claim: applied — §6 table pastes path-level evidence; design.md cites live inventory.
- G2 soft-language: applied on phase goals and exit criteria (deterministic shell verifiers).
- G6 reference-or-strike: §4–§6 use verified_by/unverified; task Files lists remain concrete paths in F0 initiative / source sidecars.

## Reviews

- internal: 2026-07-16 — structural OK (6 phases, F0 active with businessIntent + 3 tasks + 3 gates; F1–F5 descriptor-only). Receipt for Stage 8c.
- codex: 2026-07-16 — `needs_changes` | major:8 | [review file](../../../reviews/2026-07-16-1013-grok-build-integration.md)
- codex-triage: 2026-07-16 — **all 8 majors applied** to plan gates/principles/body + design D7 non-interactive; source.md + sidecars aligned. No re-run of codex envelope in this triage pass.
