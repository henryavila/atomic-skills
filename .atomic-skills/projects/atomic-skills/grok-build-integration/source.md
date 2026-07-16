# Grok Build native integration + cross-model review

Ship Atomic Skills as a first-class Grok Build surface (plugin-owned skills and hooks) and generalize adversarial review so the external reviewer is never the same model family as the host session. Design source of truth: `design.md` in this plan folder (user-approved 2026-07-16).

## Principles

- **P1 Plugin is the only Grok skill root** — From F0, install writes `~/.grok/plugins/atomic-skills/` (or project `.grok/plugins/atomic-skills/`). Never a parallel tree under `.grok/skills/atomic-skills/`.
- **P2 Host is not the external reviewer** — Defaults Grok→Codex, Codex→Grok, Claude→Codex (+Grok/external-both). Same-family interactive: confirm→local. Same-family non-interactive: HARD ABORT unless `--accept-same-family-as-local` (provider:local, never CROSS-MODEL).
- **P3 Shared envelope, pluggable providers** — Two-pass sealed briefing provider-agnostic; provider leaves under logical `cross-model-bridge` (assets may stay in codex-bridge-assets/providers/{codex,grok}/).
- **P4 Install/uninstall parity** — Every journal effect for Grok plugin and hooks reverses cleanly; round-trip tests are the gate.
- **P5 Skill bodies stay tool-abstract** — Defined vars `{{BASH_TOOL}}` `{{READ_TOOL}}` `{{WRITE_TOOL}}` `{{REPLACE_TOOL}}` `{{GREP_TOOL}}` `{{GLOB_TOOL}}` `{{INVESTIGATOR_TOOL}}` `{{ASK_USER_QUESTION_TOOL}}` plus `ide.grok` / `ide.codex`; no hardcoded Bash or Read tool for non-Claude hosts.

## Glossary

| Term | Definition |
| --- | --- |
| Plugin root | Directory `.grok/plugins/atomic-skills/` (user or project scope) holding plugin.json, skills/, _assets/, hooks/ |
| External provider | Headless CLI family used for sealed cross-model review: codex or grok |
| Same-family request | External mode matching host family; interactive confirm→local; non-interactive abort unless --accept-same-family-as-local |
| CROSS-MODEL REVIEW | Cadence label for family-different external review only (not same-family local remap) |

## F0 — Install + render foundation (L1+L2)

Goal: Grok is a first-class install IDE that materializes only the plugin package with correct tool names for Grok and Codex renders.

### T-001 Add IDE_CONFIG and detect for grok plugin delivery

Add `grok` to IDE_CONFIG with plugin delivery shape (`dir` under `.grok/plugins/atomic-skills/skills`, `delivery: 'plugin'`, filePattern without nested namespace), IDE_DETECT_DIRS, PUBLIC_IDE_IDS, and getAssetsDir special-case for plugin `_assets`.

- Files: src/config.js, src/detect.js, tests/install.test.js, tests/config.test.js
- scopeBoundary: do not implement full plugin journal effects or hooks Soft/Strict in this task
- acceptance: detectIDEs and IDE_CONFIG expose grok; getAssetsDir('grok') resolves to the plugin _assets path; no skill path under .grok/skills/atomic-skills is registered
- verifier: { kind: shell, command: "node --test tests/config.test.js tests/install.test.js", expectExitCode: 0 }
- RED→GREEN: failing test asserts IDE_CONFIG.grok and assets path; then implement config/detect

### T-002 Render tool profiles for grok and codex

Extend renderTemplate so ide.grok and ide.codex get non-Claude tool maps (Grok provisional map from design D2; Codex map appropriate to Codex CLI tools). Add snapshot or unit tests locking the map.

- Files: src/render.js, tests/render.test.js, docs/kb/grok-build-compatibility.md
- scopeBoundary: do not change skill source bodies except if a test fixture skill is required
- acceptance: render for grok substitutes ask_user_question and run_terminal_command (or locked ids); render for codex does not emit Read tool or Bash as tool names; KB documents the map
- verifier: { kind: shell, command: "node --test tests/render.test.js", expectExitCode: 0 }
- RED→GREEN: assert rendered output for ideId grok and codex; implement map

### T-003 Install materializes Grok plugin package

Wire skills file-set and installer so selecting grok writes plugin.json, skills/* /SKILL.md, and _assets under the plugin root only; journal records effects; uninstall removes them; assert zero residual under .grok/skills/atomic-skills.

- Files: src/providers/skills-file-set.js, src/providers/skills-provider.js, src/install.js, src/installer.js, tests/install-uninstall-roundtrip.test.js, tests/install.test.js
- scopeBoundary: do not implement Soft/Strict project hooks content beyond empty hooks/hooks.json stub; do not touch cross-model review skills
- acceptance: install with ides including grok creates plugin.json and at least one SKILL.md under the plugin skills tree; round-trip uninstall restores baseline; test asserts no package-owned files under .grok/skills/atomic-skills
- verifier: { kind: shell, command: "node --test tests/install-uninstall-roundtrip.test.js tests/install.test.js", expectExitCode: 0 }
- RED→GREEN: round-trip fails without plugin tree; implement provider paths

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: "IDE_CONFIG and detect include grok with plugin delivery shape and assets path under the plugin package."
      verifier: { kind: shell, command: "node --test tests/config.test.js", expectExitCode: 0 }
    - id: G-2
      description: "Render snapshots lock grok and codex tool profiles without Claude default names for those ides."
      verifier: { kind: shell, command: "node --test tests/render.test.js", expectExitCode: 0 }
    - id: G-3
      description: "Install/uninstall round-trip for grok plugin tree is clean and forbids dual .grok/skills/atomic-skills tree."
      verifier: { kind: shell, command: "node --test tests/install-uninstall-roundtrip.test.js", expectExitCode: 0 }
```

## F1 — Grok hooks runtime (L3)

Goal: Soft and Strict project hooks plus auto-update register on Grok via plugin hooks and user auto-update hook file, with dual-vocabulary matchers.

### T-001 Auto-update runtime layer for Grok

Extend createAutoUpdateRuntimeProvider (or sibling) to stage SessionStart version-check into Grok hook surface when grok is installed, without removing Claude behavior when both ides are selected.

- Files: src/runtime-layers/auto-update.js, tests/install-uninstall-roundtrip.test.js, tests/install.test.js
- scopeBoundary: do not rewrite project Soft/Strict scripts logic beyond env/tool name dual support if required for this task
- acceptance: install with grok adds a Grok auto-update hook registration; uninstall removes only Atomic Skills entries; Claude path still works when claude-code is selected
- verifier: { kind: shell, command: "node --test tests/install-uninstall-roundtrip.test.js", expectExitCode: 0 }

### T-002 Plugin hooks Soft and Strict for project

Fill plugin hooks/hooks.json (and setup docs) for SessionStart, PreToolUse (Grok write tools), and optional Stop; update project-setup and hooks README to list Grok as a hook host; dual-vocab in pre-write/stop if they parse tool names.

- Files: skills/shared/project-assets/hooks/README.md, skills/shared/project-assets/project-setup.md, skills/shared/project-assets/hooks/pre-write.sh, skills/shared/project-assets/hooks/stop.sh, src/providers/skills-file-set.js, tests/project.test.js, tests/hooks/session-start.test.sh, tests/hooks/pre-write.test.sh, tests/hooks/stop.test.sh
- scopeBoundary: do not implement cross-model bridge or review-code mode flags
- acceptance: README matrices include Grok; Soft setup does not require Stop; matchers include search_replace or write; session-start pre-write and stop fixtures pass for dual-vocab
- verifier: { kind: shell, command: "node --test tests/project.test.js && bash tests/hooks/session-start.test.sh && bash tests/hooks/pre-write.test.sh && bash tests/hooks/stop.test.sh", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: "Auto-update and project hook registration for Grok reverse cleanly in round-trip tests."
      verifier: { kind: shell, command: "node --test tests/install-uninstall-roundtrip.test.js", expectExitCode: 0 }
    - id: G-2
      description: "Docs and tests list Grok as a hook-capable host with Soft versus Strict semantics."
      verifier: { kind: shell, command: "node --test tests/project.test.js", expectExitCode: 0 }
    - id: G-3
      description: "Fixture-driven Soft and Strict hook dispatch tests pass with dual-vocab matchers."
      verifier: { kind: shell, command: "bash tests/hooks/session-start.test.sh && bash tests/hooks/pre-write.test.sh && bash tests/hooks/stop.test.sh", expectExitCode: 0 }
```

## F2 — cross-model-bridge core (L7)

Goal: Rename or alias codex-bridge to cross-model-bridge with pluggable codex and grok providers, host default matrix, same-family confirm-to-local (interactive) and HARD ABORT or --accept-same-family-as-local (non-interactive).

### T-001 Module layout and codex-bridge alias

Introduce skills/modules/cross-model-bridge and shared cross-model-review-assets (or restructure codex-bridge-assets) with providers/codex and providers/grok; keep codex-bridge as compatibility alias in catalog and install.

- Files: skills/modules/cross-model-bridge/module.yaml, skills/modules/codex-bridge/module.yaml, skills/shared/codex-bridge-assets/envelope-orchestration.md, meta/catalog.yaml, tests/validate-skills.test.js
- scopeBoundary: do not change review-code or review-plan mode UX in this task beyond asset path references if required
- acceptance: validate-skills and catalog resolve cross-model-bridge; codex provider assets still load; no broken ASSETS_PATH references in envelope orchestration
- verifier: { kind: shell, command: "node --test tests/validate-skills.test.js && npm run validate-skills", expectExitCode: 0 }

### T-002 Grok provider preflight and invocation

Add providers/grok preflight-checks and invocation-canonical proven against installed grok CLI; portable timeout; read-only sandbox; capture output file; document locked flags.

- Files: skills/shared/codex-bridge-assets/providers/grok/preflight-checks.txt, skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt, tests/fixtures, scripts or tests that smoke the invocation shape if present
- scopeBoundary: do not implement external-both merge or rename CROSS-MODEL REVIEW product line in this task
- acceptance: preflight documents which grok and auth failure messages; invocation uses timeout wrapper and non-interactive flags; fixture or test asserts required flags appear in the canonical file
- verifier: { kind: shell, command: "test -s skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt && grep -E 'grok|sandbox|timeout' skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt", expectExitCode: 0 }

### T-003 Envelope orchestration parameterized by provider and host matrix

Update envelope-orchestration to bind provider preflight and invocation; document host default external matrix and same-family interactive confirm plus non-interactive abort/accept-as-local; extract pure host-default helper with unit tests.

- Files: skills/shared/codex-bridge-assets/envelope-orchestration.md, skills/shared/codex-bridge-assets/host-default-external.md, src/cross-model-host-default.js, tests/cross-model-host-default.test.js
- scopeBoundary: do not rewrite full review-plan body modes list until F3
- acceptance: orchestration steps name PROVIDER slots; host-default-external.md encodes matrix plus HARD ABORT and --accept-same-family-as-local; unit tests cover every host row and non-interactive branches
- verifier: { kind: shell, command: "grep -E 'same-family|accept-same-family-as-local|HARD ABORT' skills/shared/codex-bridge-assets/host-default-external.md && node --test tests/cross-model-host-default.test.js", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: "cross-model-bridge module validates and codex alias remains installable."
      verifier: { kind: shell, command: "npm run validate-skills", expectExitCode: 0 }
    - id: G-2
      description: "Grok invocation and host-default assets encode matrix and same-family interactive plus non-interactive rules."
      verifier: { kind: shell, command: "test -s skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt && grep -E 'same-family|accept-same-family-as-local|HARD ABORT' skills/shared/codex-bridge-assets/host-default-external.md", expectExitCode: 0 }
    - id: G-3
      description: "Pure host-default and same-family routing helper unit tests pass for every matrix row."
      verifier: { kind: shell, command: "node --test tests/cross-model-host-default.test.js", expectExitCode: 0 }
```

## F3 — Review skill UX and CROSS-MODEL REVIEW surfaces

Goal: review-code and review-plan expose provider modes; product cadence uses CROSS-MODEL REVIEW with provider field; review-due and gates stop hardcoding Codex-only.

### T-001 review-code and review-plan modes

Add modes grok, both-codex, both-grok, external-both wiring; Step 0 picker host-aware; both uses host external default; same-family interactive confirm and non-interactive abort/accept-as-local.

- Files: skills/core/review-code.md, skills/core/review-plan.md, docs/kb/cross-model-review-design.md, tests/skill-byte-budget.test.js
- scopeBoundary: do not implement external-both findings merge algorithm beyond calling two providers sequentially if already specified; full merge UI can complete in F5
- acceptance: skill bodies document modes, host defaults, and same-family non-interactive rules; validate-skills passes; byte budget within limits or updated deliberately
- verifier: { kind: shell, command: "npm run validate-skills && node --test tests/skill-byte-budget.test.js", expectExitCode: 0 }

### T-002 Rename CODEX REVIEW to CROSS-MODEL REVIEW

Update project-drift, project-view, project-verify, last-review schema or writers, index templates to CROSS-MODEL REVIEW with provider field; migration note for old INDEX rows.

- Files: skills/shared/project-assets/project-drift.md, skills/shared/project-assets/project-view.md, skills/shared/project-assets/project-verify.md, skills/shared/codex-bridge-assets/review-file-template.txt, skills/shared/codex-bridge-assets/index-row-template.txt, meta/schemas if last-review is schema-backed
- scopeBoundary: do not change aiDeck widget layout beyond string labels if any
- acceptance: zero user-facing CODEX REVIEW strings in active skill assets; provider field appears in review file template
- verifier: { kind: shell, command: "! rg -n 'CODEX REVIEW' skills/shared/project-assets skills/core", expectExitCode: 0 }

### T-003 review-due and provider field persistence

Replace hardcoded --mode=codex in project-create-plan and project-drift review-due with host external default; specify provider enum codex|grok|local plus version; round-trip test for writers/readers.

- Files: skills/shared/project-assets/project-create-plan.md, skills/shared/project-assets/project-drift.md, skills/shared/project-assets/project-review.md, skills/shared/codex-bridge-assets/review-file-template.txt, tests/review-provider-field.test.js
- scopeBoundary: do not change decompose or materialize code
- acceptance: assets use host-default language; provider field round-trip test passes; same-family remap never writes provider codex/grok for a same-family run
- verifier: { kind: shell, command: "grep -q 'provider' skills/shared/codex-bridge-assets/review-file-template.txt && node --test tests/review-provider-field.test.js", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: "validate-skills passes with updated review-code and review-plan modes."
      verifier: { kind: shell, command: "npm run validate-skills", expectExitCode: 0 }
    - id: G-2
      description: "Active skill assets contain zero user-facing CODEX REVIEW product label strings."
      verifier: { kind: shell, command: "! rg -n 'CODEX REVIEW' skills/shared/project-assets skills/core", expectExitCode: 0 }
    - id: G-3
      description: "Provider field enum and round-trip tests cover review receipts and review-due readers."
      verifier: { kind: shell, command: "node --test tests/review-provider-field.test.js", expectExitCode: 0 }
```

## F4 — Plugin harden (L4)

Goal: Grok plugin surface is complete for daily use: inspect smoke, trust docs, optional thin agents only if needed, journal edge cases closed.

### T-001 Plugin inspect and list smoke

Add documented smoke commands and automated checks that a temp install shows atomic-skills under grok plugin list or filesystem plugin.json contract; fix journal gaps found.

- Files: docs/kb/grok-build-compatibility.md, tests/install.test.js, src/ as needed for plugin.json fields
- scopeBoundary: do not publish marketplace catalog entries
- acceptance: plugin.json has name atomic-skills and version from package; install test asserts required plugin.json keys
- verifier: { kind: shell, command: "node --test tests/install.test.js", expectExitCode: 0 }

### T-002 Trust and setup documentation

Document folder trust, hooks-trust, and Soft fail-open when project plugin untrusted; update CLAUDE.md or AGENTS only if required for multi-agent note; README generator catalog keyword grok.

- Files: docs/kb/grok-build-compatibility.md, package.json, meta/catalog.yaml, scripts/generate-readme.js related fixtures if any, README.md if generated
- scopeBoundary: do not add MCP server
- acceptance: package.json keywords include grok; KB documents trust; catalog or README mentions Grok Build
- verifier: { kind: shell, command: "node -e \"const p=require('./package.json'); if(!p.keywords.includes('grok')) process.exit(1)\"", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: "Plugin.json contract is tested and package keywords include grok."
      verifier: { kind: shell, command: "node --test tests/install.test.js && node -e \"const p=require('./package.json'); if(!p.keywords.includes('grok')) process.exit(1)\"", expectExitCode: 0 }
```

## F5 — Polish, external-both merge, final verify

Goal: external-both merges findings for triage; L5 conditionals where needed; full suite green; plan ready to archive criteria met.

### T-001 external-both findings merge

Implement sequential Codex then Grok envelope on the same cleaned artifact; merge key file:line plus normalized claim; severity conflict keeps higher severity with dual provenance; partial provider failure keeps the other side and surfaces error; unit tests for merge helper; document in KB.

- Files: skills/shared/codex-bridge-assets/envelope-orchestration.md, skills/core/review-code.md, skills/core/review-plan.md, docs/kb/cross-model-review-design.md, src/external-both-merge.js, tests/external-both-merge.test.js
- scopeBoundary: do not auto-apply fixes without human triage
- acceptance: external-both documented in review-code and review-plan with merge key severity and partial-failure rules; merge unit tests pass; validate-skills passes
- verifier: { kind: shell, command: "npm run validate-skills && grep -q 'external-both' skills/core/review-code.md && grep -q 'external-both' skills/core/review-plan.md && node --test tests/external-both-merge.test.js", expectExitCode: 0 }

### T-002 ide.grok conditionals on hot skills

Add minimal ide.grok guidance in implement, parallel-dispatch, and project-related assets only where spawn_subagent or ask_user_question behavior differs.

- Files: skills/core/implement.md, skills/core/parallel-dispatch.md, skills/core/project.md, tests/render.test.js
- scopeBoundary: do not invent new agent types unless a failing task requires them
- acceptance: rendered grok output includes any new conditionals; validate-skills passes
- verifier: { kind: shell, command: "npm run validate-skills && node --test tests/render.test.js", expectExitCode: 0 }

### T-003 Final verification suite

Run config, install, round-trip, render, project suites and validate-skills; record results in plan Reviews section.

- Files: tests/config.test.js, tests/install.test.js, tests/install-uninstall-roundtrip.test.js, tests/render.test.js, tests/project.test.js, package.json
- scopeBoundary: no new features; fix only regressions found by the suite
- acceptance: the listed test commands exit 0
- verifier: { kind: shell, command: "node --test tests/config.test.js tests/install.test.js tests/install-uninstall-roundtrip.test.js tests/render.test.js tests/project.test.js && npm run validate-skills", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: G-1
      description: "external-both merge contract documented in review-code and review-plan; validate-skills passes."
      verifier: { kind: shell, command: "npm run validate-skills && grep -q 'external-both' skills/core/review-code.md && grep -q 'external-both' skills/core/review-plan.md", expectExitCode: 0 }
    - id: G-2
      description: "Final regression includes config install round-trip render project and validate-skills."
      verifier: { kind: shell, command: "node --test tests/config.test.js tests/install.test.js tests/install-uninstall-roundtrip.test.js tests/render.test.js tests/project.test.js && npm run validate-skills", expectExitCode: 0 }
    - id: G-3
      description: "external-both merge helper unit tests pass."
      verifier: { kind: shell, command: "node --test tests/external-both-merge.test.js", expectExitCode: 0 }
```
