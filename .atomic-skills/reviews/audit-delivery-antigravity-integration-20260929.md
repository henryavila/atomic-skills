# Audit Delivery — antigravity-integration
**Date:** 2026-09-29
**Mode:** audit-and-fix
**Depth:** full
**Axes:** product,residual
**Intent sources:** PR #49 (`feat/antigravity-integration`), User Prompt Requests 1–10, `ANTIGRAVITY.md`, `CLAUDE.md`, `AGENTS.md`
**Verdict:** CLOSED

## Intent Package

### Decisions
| ID | Decision | Why |
|----|----------|-----|
| D1 | Add Antigravity (`antigravity` / `agy`) as a first-party IDE host | Provide native integration with `.agent/skills/atomic-skills/<skill>/SKILL.md`, explicit tool profiles, and first-class discovery |
| D2 | Complete removal and deprecation of Gemini CLI | Drop obsolete `GEMINI.md`, `docs/kb/gemini-cli-compatibility.md`, and contracts; preserve `.gemini` paths exclusively in `LEGACY_NAMESPACE_PATHS` for safe uninstallation of existing installs |
| D3 | Expand Cross-Model Review Provider Matrix with Antigravity (`agy`) | Enable multi-agent review with `codex`, `grok`, `claude`, and `agy` using Strategy A (Flash default, Pro escalation via `--model-agy`) |
| D4 | Implement headless bridge assets for `agy` | Standardize headless invocation (`agy -p`) and preflight checks in `skills/shared/codex-bridge-assets/providers/agy/` |
| D5 | Universal skill tool abstraction audit | Ensure all 17 core skills use template abstractions (`{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{WRITE_TOOL}}`, `{{REPLACE_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`, `{{INVESTIGATOR_TOOL}}`, `{{ASK_USER_QUESTION_TOOL}}`, `{{ARG_VAR}}`) without hardcoding |
| D6 | Cross-platform Windows installer compatibility | Ensure case-insensitive home/root resolution, `.exe` / `.cmd` binary lookup, and PowerShell/CMD safety |
| D7 | Dual conditional rendering support for `ide.antigravity` and `ide.agy` | Allow skill authors to target either `{{#if ide.antigravity}}` or `{{#if ide.agy}}` interchangeably |

### Original problems
| ID | Problem | Expected fix shape |
|----|---------|-------------------|
| P1 | Gemini CLI is obsolete and lacks first-party agentic capabilities (subagents, interactive modal questions) | Complete drop of Gemini CLI from active hosts, replacing with Antigravity |
| P2 | Antigravity was not recognized as an IDE host or cross-model review peer | Register `antigravity` in `PUBLIC_IDE_IDS`, configure tool map, and add review provider bridge |
| P3 | Cross-model review matrix lacked Google DeepMind / Gemini models in review loops | Implement Strategy A resolver (`gemini-3.8-flash-high` default, `gemini-3.1-pro-high` escalation) |
| P4 | Potential path casing and binary extension issues on Windows | Normalize root comparison in `src/scope.js` and lookup `.cmd`/`.exe` in runtime layers |

### Acceptance / doneWhen
| ID | Criterion | Source |
|----|-----------|--------|
| A1 | 100% test suite pass rate (`npm test`), including `tests/antigravity-contract.test.js` and `tests/install-uninstall-roundtrip.test.js` | User prompt & repo CI gates |
| A2 | Clean install/uninstall roundtrip on both `project` and `user` scopes with zero leftover artifacts | `CLAUDE.md` Install/Uninstall parity rule |
| A3 | Pull Request opened against `develop` without merging | User request 8: "abra PR contra develop (sem merge ainda)" |
| A4 | Delivery audit performed using repo's `audit-delivery` skill with full adversarial axes | User request 10: "rode a skil laudit-delivery ue esxite neste repo" |
| A5 | Zero open CRITICAL or HIGH residual issues across product code, tests, docs, and scripts | `skills/shared/audit-delivery-assets/verdict-gate.md` |

### Vocabulary delta
| OLD | NEW | Scope |
|-----|-----|-------|
| `gemini` | `antigravity` | Host ID, IDE configuration, test suites |
| `gemini-cli` | `antigravity` | CLI host name in docs and qualification |
| `gemini-commands` | `antigravity` | Legacy internal command format |
| `GEMINI.md` | `ANTIGRAVITY.md` | Primary instruction file for Antigravity agent |
| `gemini-cli-compatibility.md` | `antigravity-compatibility.md` | Knowledge base documentation |

### Surface inventory
| Surface | Path / system | Role |
|---------|---------------|------|
| Host Config & Profile | `src/config.js`, `src/detect.js`, `src/render.js`, `src/install.js`, `src/uninstall.js` | Core configuration, detection, rendering, and lifecycle |
| Cross-Model Review | `src/cross-model-host-default.js`, `src/resolve-review-model.js`, `src/external-both-merge.js`, `src/review-provider-field.js` | 4-provider review resolution and routing |
| Bridge Assets | `skills/shared/codex-bridge-assets/providers/agy/` | Canonical headless invocation & preflight checks |
| Documentation | `README.md`, `ANTIGRAVITY.md`, `AGENTS.md`, `CLAUDE.md`, `docs/kb/` | Agent instructions and user-facing docs |
| Meta & Schemas | `meta/catalog.yaml`, `meta/host-qualification.json`, `meta/schemas/`, `package.json` | Catalog qualification and metadata |
| Test Suites | `tests/antigravity-contract.test.js`, `tests/install.test.js`, `tests/install-uninstall-roundtrip.test.js`, `tests/hooks/` | Full regression and contract verification |

### Non-goals / do-not-reopen
- Do not reopen Gemini CLI support or retain active code branches for it.
- Do not modify core orchestration logic (`src/decompose.js`).
- Do not merge PR #49 to `develop` without explicit user sign-off.

### Key SSOT paths
- `src/config.js`
- `ANTIGRAVITY.md`
- `docs/kb/antigravity-compatibility.md`
- `skills/shared/codex-bridge-assets/providers/agy/`

## Spec Package (criteria strip — no success narrative)
- D1: `PUBLIC_IDE_IDS` includes `'antigravity'`; `normalizeIdeId('agy') === 'antigravity'`; tool mapping matches native tools (`run_command`, `view_file`, `write_to_file`, `replace_file_content`, `grep_search`, `glob`, `invoke_subagent`, `ask_question`).
- D2: Deletion of `GEMINI.md`, `docs/kb/gemini-cli-compatibility.md`, and `tests/gemini-cli-contract.test.js`; `.gemini` paths preserved solely in `LEGACY_NAMESPACE_PATHS`.
- D3: `src/cross-model-host-default.js` registers `agy` with default `codex`; `src/resolve-review-model.js` resolves `flash` and `pro` via `--model-agy`.
- D4: `invocation-canonical.txt` and `preflight-checks.txt` created under `skills/shared/codex-bridge-assets/providers/agy/`.
- D5: All 17 skills in `skills/core/` use abstract variables; no hardcoded tool names.
- D6: Windows installer path normalization in `src/scope.js` and binary lookup in Grok plugin host.
- D7: `src/render.js` populates both `antigravity` and `agy` in `ideContext`.

## Matrix A — Decisions (stages S C U O T X)
*Stages: S=Spec, C=Code, U=Unit test, O=Orchestration/Lifecycle, T=Tool abstraction, X=cross-platform/cleanup*

| ID | Decision | Expected chain | S | C | U | O | T | X | Status | Evidence |
|----|----------|----------------|---|---|---|---|---|---|--------|----------|
| D1 | Antigravity host profile | `config.js` → `detect.js` → `install.js` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | RESOLVED | `src/config.js:28,49`, `tests/antigravity-contract.test.js:40` |
| D2 | Gemini CLI drop | Delete docs/contracts → clean active code → legacy prune | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | RESOLVED | Files deleted; `.gemini` in `LEGACY_NAMESPACE_PATHS` |
| D3 | Cross-model review matrix | `cross-model-host-default.js` → `resolve-review-model.js` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | RESOLVED | `src/cross-model-host-default.js:14,24`, `src/resolve-review-model.js:52` |
| D4 | Headless bridge assets | Provider directory `providers/agy/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | RESOLVED | `skills/shared/codex-bridge-assets/providers/agy/` |
| D5 | Universal skill tool abstraction | All 17 skills use `{{...}}` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | RESOLVED | `scripts/validate-skills.js`, `skills/core/*.md` |
| D6 | Windows installer compatibility | Case-insensitive root + binary lookup | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | RESOLVED | `src/scope.js:26-30`, `src/runtime-layers/grok-plugin-host.js` |
| D7 | Dual conditional rendering | `render.js` ideContext `{ antigravity, agy }` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | RESOLVED | `src/render.js:17-23`, `tests/antigravity-contract.test.js:107` |

## Matrix B — Problems
| ID | Problem | Expected fix shape | S | C | U | O | T | X | Status | Evidence |
|----|---------|-------------------|---|---|---|---|---|---|--------|----------|
| P1 | Gemini CLI lack of first-party tools | Replaced by Antigravity first-party mapping | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | RESOLVED | `HOST_TOOL_PROFILES.antigravity` |
| P2 | Antigravity missing from IDE ecosystem | Registered in installer & public host tables | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | RESOLVED | `PUBLIC_IDE_IDS`, `TESTED_IDE_IDS` |
| P3 | Cross-model review missing Antigravity | Integrated in 4-provider review loop | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | RESOLVED | `PROVIDER_ENUM`, `EXTERNAL_PROVIDER_ORDER` |
| P4 | Windows path & executable lookup issues | Case-insensitive path checks and `where.exe` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | RESOLVED | `src/scope.js`, `tests/windows-paths.test.js` |

## Matrix C — must-not
| ID | Must NOT | Seed | Status | Evidence |
|----|----------|------|--------|----------|
| C1 | Must NOT freeride Claude tool names on Antigravity | Intent D1 | PASS | `HOST_TOOL_PROFILES.antigravity` specifies native tools |
| C2 | Must NOT leave active code references to Gemini CLI | Intent D2 | PASS | Zero active references; `.gemini` only in legacy cleanup |
| C3 | Must NOT leave uninstall residue on roundtrip | Hard Gate | PASS | `tests/install-uninstall-roundtrip.test.js` passes 100% |
| C4 | Must NOT merge PR #49 to develop prematurely | User Constraint | PASS | PR #49 open against `develop`, unmerged |

## Findings Ledger
| # | Title | Sev | Axis | Evidence | Impact | Resolution |
|---|-------|-----|------|----------|--------|------------|
| GAP-1 | Missing `ide.agy` conditional in renderer | MED | Product | `src/render.js:18` | `{{#if ide.agy}}` blocks were dropped | Fixed: added `agy: true` alongside `antigravity: true` in `ideContext` |
| F-RES-01 | Active Gemini probe branch in `run-host-probes.js` | CRIT | Residual | `scripts/run-host-probes.js:180` | Probes checked obsolete Gemini binary | Fixed: replaced with `antigravity` operational probe |
| F-RES-02 | Lingering Gemini CLI in README Tested/Theoretical | HIGH | Residual | `README.md:45,47` | Docs taught Gemini CLI as theoretical | Fixed: moved Antigravity to Tested, removed Gemini |
| F-RES-03 | Lingering `"gemini"` keyword in package.json | HIGH | Residual | `package.json:55` | Package metadata advertised Gemini | Fixed: replaced with `"antigravity"`, `"agy"` |
| F-RES-04 | Lingering Gemini CLI column in Grok compatibility doc | HIGH | Residual | `docs/kb/grok-build-compatibility.md:99` | Teaching obsolete Gemini tool mapping | Fixed: updated table with Antigravity tool mapping |
| F-RES-05 | Lingering Gemini CLI in frontmatter spec compatibility | HIGH | Residual | `docs/kb/skill-frontmatter-spec.md:98` | Examples referenced Gemini | Fixed: replaced with Antigravity |
| F-RES-06 | Obsolete Gemini comments in `meta/schemas/routing.schema.json` | HIGH | Residual | `meta/schemas/routing.schema.json:38` | Schema docstrings taught Gemini | Fixed: updated schema docstrings |
| F-RES-07 | Obsolete Gemini comments in lint scripts | LOW | Residual | `scripts/lint-design.js:6`, `scripts/lint-source.js:7` | Code comments mentioned Gemini | Fixed: updated comments to generic reader |
| F-RES-08 | Hook test assertions checking obsolete `.gemini` directory | MED | Residual | `tests/hooks/*.test.sh` | Tests created `.gemini` instead of `.agent` | Fixed: updated to `.agent` across all hook tests |
| F-RES-09 | Obsolete JSDoc comments in UI and config | LOW | Residual | `src/ui.js:308`, `src/config.js:9,111`, `src/render.js:93` | Misleading JSDoc referencing gemini-commands | Fixed: cleaned up JSDoc comments |
| F-RES-10 | Pre-commit hook test missing `site/` directory in tmp repo | MED | Quality | `tests/hooks/pre-commit.test.sh:31` | `generate-site.js` failed to find `site/assets/ds.css` | Fixed: added `site` to copied directories |

## Residual (ordered)
| # | Title | Sev | Class | Evidence | Status |
|---|-------|-----|-------|----------|--------|
| 1 | Operational probe for Antigravity | CRIT | storage/active | `scripts/run-host-probes.js` | RESOLVED |
| 2 | Host qualification in README | HIGH | teaching | `README.md` | RESOLVED |
| 3 | Package keywords | HIGH | teaching | `package.json` | RESOLVED |
| 4 | Grok compatibility documentation table | HIGH | teaching | `docs/kb/grok-build-compatibility.md` | RESOLVED |
| 5 | Skill frontmatter specification examples | HIGH | teaching | `docs/kb/skill-frontmatter-spec.md` | RESOLVED |
| 6 | Routing schema descriptions | HIGH | teaching | `meta/schemas/routing.schema.json` | RESOLVED |
| 7 | Hook test stubs | MED | dead | `tests/hooks/*.test.sh` | RESOLVED |
| 8 | Code comments in lint scripts | LOW | dead | `scripts/lint-*.js` | RESOLVED |
| 9 | JSDoc comments in config and UI | LOW | dead | `src/config.js`, `src/ui.js`, `src/render.js` | RESOLVED |

### Residual protocol
- Terms: OLD=`gemini`, `gemini-cli`, `gemini-commands`, `GEMINI.md`, `gemini-cli-compatibility.md` | NEW=`antigravity`, `agy`, `ANTIGRAVITY.md`, `antigravity-compatibility.md`
- Validity: valid — all identified residuals resolved directly in the working tree.
- Surfaces hunted: 12 surfaces (src, scripts, meta, docs, skills, tests, .github, package.json, README.md, AGENTS.md, ANTIGRAVITY.md, CLAUDE.md).

## Accept Register (Accept Records)
*No open HIGH or CRITICAL issues remain. All 11 findings from product and residual axes have been resolved with passing tests and verified diffs.*

## Tests / commands observed
| Command | Result | Notes |
|---------|--------|-------|
| `npm test` | PASS (3,550 passed, 0 failed, 2 skipped) | Full suite including install-uninstall roundtrip |
| `node --test tests/antigravity-contract.test.js` | PASS (9 passed, 0 failed) | Layout, tools, conditionals (`antigravity` + `agy`), Codex dual install, live probe |
| `npm run test:hooks` | PASS (166 passed, 0 failed) | `session-start` (38), `stop` (47), `pre-write` (76), `pre-commit` (5) |
| `npm run check-docs` | PASS (exit 0) | README, skill docs, catalog JSON, site in sync |
| `npm run validate-catalog` | PASS (exit 0) | All 17 skills valid (schema_version 0.2) |

## Self-review against gates
- **G1 read-before-claim:** All claims verified against direct file reads, unit test executions, and git diff inspection.
- **G2 soft-language:** Verdict is strict: **CLOSED**. All CRITICAL/HIGH/MEDIUM gaps resolved.
- **G6 reference-or-strike:** All referenced files exist and paths have been validated.

## Confidence %
100% confidence. Both product and residual axes have been rigorously audited via adversarial subagents, all identified gaps have been remediated in code and documentation, and the full test suite and documentation sync passed with zero errors.
