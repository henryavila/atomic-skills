---
lastUpdated: '2026-06-17T00:00:00Z'
schemaVersion: '0.1'
activePlans: 2
activeInitiatives: 0
archivedCount: 7
---

# Project Status Index

Canonical entry point. Auto-updated by `atomic-skills:project-status`. Read first every session.

## Active Plans

### quick-idea-capture — Quick Idea Capture (currentPhase: F1)

Inbox barato de ideias do projeto: captura em segundos (fork Analisar/Só salvar) num único `ideas.md`, promoção sempre separada via emergence ladder. Dashboard fica para fase posterior.

| Phase | Status | Summary |
|-------|--------|---------|
| F0 — Captura barata (MVP do inbox) | done | Script de append, detail file com o fork, `idea list`, wiring e paridade de install. 3/3 tasks, 3/3 gates (codex lane). |
| F1 — Promoção via emergence ladder | done | Verbo `idea promote`: extrai a ideia e roteia pela ladder com ratify, marcando-a triaged. 2/2 tasks, 2/2 gates (codex lane). Plano completo — pronto para `archive`. |

### reversible-installer — Reversible Installer (currentPhase: F0)

Extrai o instalador do atomic-skills num kernel genérico de sincronização reversível de arquivos templados, consumível por qualquer projeto via dependência + config; uninstall out-of-the-box.

| Phase | Status | Summary |
|-------|--------|---------|
| F0 — Effect Kernel + file reconciler | active | Funda o kernel: contrato de efeito reversível, journal e o reconciler de arquivos (porta do 3-hash). 0/3 tasks, 0/2 gates. |
| F1 — Efeitos built-in não-arquivo | pending | Os 3 efeitos não-arquivo (json-merge/refcount/legacy-prune) com before-state + matriz adversária no round-trip. 0/4 tasks, 0/1 gate. |
| F2 — Providers e config two-tier | pending | Config two-tier + SkillsProvider (IDE matrix/render, COMM_LANG opt-out) + API de registro de runtime layer. 0/3 tasks, 0/2 gates. |
| F3 — Big-bang rewire e paridade | pending | Religa atomic-skills sobre o kernel (aiDeck/hooks/auto-update como runtime layers) e prova paridade. 0/5 tasks, 0/3 gates. |

## Paused Plans

| Slug | Status | Current Phase |
|------|--------|---------------|
| refactor-doc-architect | paused | F0 |

## Active Initiatives (standalone)

_(none — all current work is plan-anchored)_

## Recently Archived (last 10)

| Slug | Archived | Final Phase | Note |
|------|----------|-------------|------|
| mode2-anthropic-subagent-tier | 2026-06-09 | F0 (0/3 tasks) | Migrado para o inbox: ideia **#1** em `ideas.md` (era tracker de deferimento; re-entrada via `idea promote 1`). |
| bmad-porting-research | 2026-06-09 | F0 (0/2 tasks) | Migrado para o inbox: ideia **#2** em `ideas.md` (parcialmente superseded por `debate` + `refactor-doc-architect`; re-entrada via `idea promote 2`). |
| project-orchestrator-redesign | 2026-06-07 | F5 (done) | Plan complete; F6 deferred. F5-G1 met (aiDeck Model-B consumer e2e vs @henryavila/aideck 0.1.0). |
| mode2-codex-default-enablement | 2026-06-07 | F0 (done) | Plan complete; 4/4 gates met. T-005 unblocked once F5/Inc7 landed — full suite 797/797, validate-skills 14/14, compatibility 82/82. |
| bmad-af-learnings | 2026-06-08 | F0 (done) | 7/7 tasks (M1–M3 sync mechanisms + quality-gate fields). G-2 met (6 tasks carry scopeBoundary+acceptance); G-1 deferred (drift-reduction outcome under continued observation). |
| aideck-multi-project | 2026-06-08 | F4 (superseded) | **Superseded** by project-orchestrator-redesign (Inc7 Model-B). Targeted the old aiDeck server (ProjectRegistry/ConsumerBands); goal delivered via the new per-project consumer + ProjectCard/`/:projectId` dashboard. No code written to close. |
| fix-superpowers-integration | 2026-06-08 | F0 (cancelled) | **Cancelled** — superpowers was decoupled and is no longer used; the plan's premise (superpowers detection + old `project-plan.md`/skill names) is moot. 0/5 tasks; no work done. |

## Ad-Hoc Sessions Log (last 5)

_(empty)_
