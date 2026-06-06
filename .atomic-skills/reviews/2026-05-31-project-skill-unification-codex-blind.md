---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 5, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has a viable high-level direction but contains execution-breaking contradictions and missing migration work. The largest failure is that the required flat, prefixed asset contract is contradicted by the phase instructions, which would produce assets the current installer will not copy and paths the router cannot read. Several validation steps are also incomplete: generated skill docs leave orphan files, install tests with hard-coded asset counts are not covered, and installed templates/hooks can keep pointing users at deleted commands.

## Findings

### F-001 [critical] contradiction — docs/plan-project-skill-unification.md:39-118

**Evidence:**
```md
| D2 | **Router fino + lazy** | `skills/core/project.md` = dispatch + invariantes; procedures por subcomando como arquivos **FLAT** em `skills/shared/project-assets/`, lidos via `{{READ_TOOL}} {{ASSETS_PATH}}/project-<x>.md`. ⚠️ **Sem subdiretório** — `install.js` copia assets files-only/não-recursivo (`if (!f.isFile()) continue`); um `project/` subdir seria ignorado. `{{ASSETS_PATH}}` resolve para um `_assets/` **único e compartilhado** entre todas as skills → nomes precisam de prefixo `project-` para evitar colisão. Padrão idêntico ao `review-plan` (assets flat). |
| 2 | Extrair view/verify/setup → `project-assets/project/{view,verify,setup}.md` (verify é NOVO) | novos | 1h |
| 3 | Extrair create → `create-plan.md` + `create-initiative.md` + `discover.md` (de project-plan) | novos | 1h |
| 4 | Extrair `emergence.md` + `transitions.md` + `migrate.md` + `drift.md` | novos | 1h30 |
```

**Claim:** The phase list contradicts the installer-compatible asset layout by putting files under a `project/` subdirectory and by naming lazy files without the required `project-` prefix.

**Impact:** If implemented as written, `src/install.js` will skip nested asset files because it copies only direct files from each `*-assets` directory, and router instructions using `{{ASSETS_PATH}}/project-<x>.md` will not match files named `create-plan.md`, `emergence.md`, or `view.md`.

**Recommendation:** Rewrite phases 2-4 to create only direct files under `skills/shared/project-assets/` with the exact installed names from the layout table, e.g. `project-view.md`, `project-verify.md`, `project-create-plan.md`, `project-emergence.md`, and make the router dispatch table use those same names.

**Confidence:** high

---

### F-002 [major] dependency-break — docs/plan-project-skill-unification.md:38-63

**Evidence:**
```md
| D1 | **1 skill `project`** | `atomic-skills:project`. Delete `project-status` + `project-plan`. |
```

```md
/project                                  → resumo compacto (no-args, barato)
/project status [--browser] [--terminal]  → view (compacto / dashboard / CLI)
/project status verify                    → reconciliar estado ⇄ código (NOVO)
/project new                              → menu fixo (plan | initiative) + dica
/project new plan <slug>                  → bootstrap multi-fase
/project new initiative <slug>            → iniciativa (standalone ou de fase)
/project done|push|pop|park|emerge|promote|switch|phase-done|phase-reopen|archive
/project why|re-ratify|scope-creep|review-due
/project adopt <file.md>|discover|migrate <slug>|split-phase <id>
# válidos mas NÃO listados (uso por intenção via ladder, ou digitados por power-user):
/project new-task|new-phase
```

**Claim:** The grammar documents `/project` even though the repository’s installer generates namespaced commands such as `/atomic-skills:project` for the decided skill name.

**Impact:** The catalog examples, generated docs, gate templates, and user instructions can point to a command that does not exist in Claude Code’s current command path or the generated namespace, leaving users unable to invoke the new skill from documented examples.

**Recommendation:** Replace the grammar examples with the canonical installed invocation `/atomic-skills:project ...`, or add an explicit implementation phase for a real `/project` alias across all supported IDE formats and tests proving the alias is installed.

**Confidence:** high

---

### F-003 [major] coverage-gap — docs/plan-project-skill-unification.md:126-129

**Evidence:**
```md
| 12 | Regenerar docs: `npm run generate-docs` (README + HelpView + skill-docs) | scripts | 15min |
| 15 | Validação final: `npm test`, `npm run validate-catalog`, `npm run build:dashboard`, check manual do HelpView + invocação `/project` em repo limpo | scripts | 30min |
```

**Claim:** The plan omits deletion of `docs/skills/project-status.md` and `docs/skills/project-plan.md`, and `npm run generate-docs` does not remove orphan skill docs.

**Impact:** After deleting the catalog entries and generating `docs/skills/project.md`, `npm run validate-catalog` will fail during `check-docs` because `scripts/generate-skill-docs.js --check` reports orphaned skill docs that remain on disk.

**Recommendation:** Add an explicit phase before final validation to delete `docs/skills/project-status.md` and `docs/skills/project-plan.md`, then regenerate docs and run `npm run check-docs` or `npm run validate-catalog`.

**Confidence:** high

---

### F-004 [major] coverage-gap — docs/plan-project-skill-unification.md:125

**Evidence:**
```md
| 11 | Testes: renomear/fundir `tests/project-status.test.js` + `tests/project-plan.test.js` → `tests/project.test.js`; ajustar `e2e-smoke.test.js`, `validate-skills`, **e `tests/aideck-contract.test.js`** (ref ao dir `project-status-assets` + parser path — ver F2/F3) | edits | 1h15 |
```

**Claim:** The test migration phase omits `tests/install.test.js`, which hard-codes core skill counts and project-status/project-plan asset counts.

**Impact:** `npm test` will fail after deleting two skills and consolidating asset directories because install assertions currently expect counts such as `10 core`, `8 project-status assets`, and `1 project-plan asset`, plus specific asset names copied into `_assets`.

**Recommendation:** Add `tests/install.test.js` to phase 11 and update both count assertions and asset-existence assertions to the new `project` skill plus consolidated `project-assets` file set.

**Confidence:** high

---

### F-005 [major] coverage-gap — docs/plan-project-skill-unification.md:106-124

**Evidence:**
```md
| templates (existentes) | `plan.template.md`, `initiative.template.md`, `PROJECT-STATUS.md.template.md`, `CLAUDE.md-gate.template.md`, `AGENTS.md.template.md`, `bootstrap-*.template.md`, `minimal-source.template.md`, `hooks/` (hooks já são tratados fora do asset-loop) |
```

```md
| 10 | `CLAUDE.md` (projeto) + `CLAUDE.md-gate.template.md` + hooks README/session-start.sh: refs ao nome da skill | edits | 30min |
```

**Claim:** The template update phase covers only `CLAUDE.md-gate.template.md` and selected hook files, leaving other shipped templates that currently contain old skill invocations out of scope.

**Impact:** Fresh installs can still generate `AGENTS.md`, `PROJECT-STATUS.md`, bootstrap index text, or hook comments that tell users to run deleted commands such as `atomic-skills:project-status` or `atomic-skills:project-plan`, causing first-time setup and discover/bootstrap workflows to fail at the instruction layer.

**Recommendation:** Expand phase 10 to grep and update every file under the consolidated `skills/shared/project-assets/`, including `AGENTS.md.template.md`, `PROJECT-STATUS.md.template.md`, all `bootstrap-*.template.md` files, and every hook file or hook test path that embeds the old asset directory or skill command names.

**Confidence:** high

---

### F-006 [major] ambiguity — docs/plan-project-skill-unification.md:44-97

**Evidence:**
```md
| D7 | **`status verify` (NOVO)** | Reconciliar `.atomic-skills/` ⇄ código. Recurso novo — não existe hoje um comando único de coerência estado⇄código. |
```

```md
| `project-verify.md` | **NOVO** — reconciliação estado⇄código |
```

**Claim:** The new `status verify` command has no executable contract beyond “reconcile state ⇄ code.”

**Impact:** Implementers must guess which files are authoritative, which checks are read-only versus mutating, whether it runs schema validation, git scope checks, branch matching, orphan detection, aiDeck compatibility, or repair steps, and tests cannot assert correct behavior without inventing requirements.

**Recommendation:** Define `project-verify.md` before implementation with explicit inputs, checks, allowed mutations, failure messages, and verification tests; at minimum specify whether it wraps existing `validate-state`, scope drift checks, branch/active initiative matching, orphan plan/initiative detection, and aiDeck parser contract checks.

**Confidence:** high

---

### F-007 [minor] ordering — docs/plan-project-skill-unification.md:126-129

**Evidence:**
```md
| 12 | Regenerar docs: `npm run generate-docs` (README + HelpView + skill-docs) | scripts | 15min |
| 13 | Entrada no `CHANGELOG.md` sob a v2.0.0 (sem bump — ver D9) | edit | 10min |
| 15 | Validação final: `npm test`, `npm run validate-catalog`, `npm run build:dashboard`, check manual do HelpView + invocação `/project` em repo limpo | scripts | 30min |
```

**Claim:** The docs generation phase runs before the CHANGELOG edit even though generated README release-highlight content is catalog-driven and validation only happens later.

**Impact:** If the v2.0.0 release note or catalog `release_highlight` needs to mention the consolidation, running docs generation before the changelog/catalog finalization can leave generated README/HelpView data stale until the final validation fails.

**Recommendation:** Move changelog and any catalog release-highlight edits before `npm run generate-docs`, then run `npm run validate-catalog` immediately after generation rather than delaying all feedback to phase 15.

**Confidence:** medium

## Questions (non-findings)

- docs/plan-project-skill-unification.md:145 — Should the aiDeck domain key remain `project-status` permanently, or only until a coordinated aiDeck migration is scheduled?
- docs/plan-project-skill-unification.md:175 — Is “Alternativa: manter compat alias” truly open, or is a compatibility alias explicitly out of scope for this release?

## Out of scope

- Whether merging `project-status` and `project-plan` into one skill is the right product decision.
- Whether the chosen skill name `project` is good.
- Whether the release should bump version.
- Whether `adopt` should remain a separate top-level verb.