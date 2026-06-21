---
lastUpdated: '2026-06-19T20:05:00Z'
schemaVersion: '0.1'
activePlans: 1
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

### reversible-installer — Reversible Installer (✅ DONE — plan-done 2026-06-19)

Extrai o instalador do atomic-skills num kernel genérico de sincronização reversível de arquivos templados, consumível por qualquer projeto via dependência + config; uninstall out-of-the-box. **Concluído package-first:** a engine é o pacote `@henryavila/tooling-installer` (file: link), atomic-skills é o 1º consumidor. Follow-ups fora do plano: publish do pacote ^0.1.x + trocar o file: link; gate de merge de plan/skills-restructuring.

| Phase | Status | Summary |
|-------|--------|---------|
| F0 — Effect Kernel + file reconciler | done | Funda o kernel: contrato de efeito reversível, journal e o reconciler de arquivos (porta do 3-hash). 3/3 tasks, 2/2 gates (codex lane; review local 2 major fixed). |
| F1 — Efeitos built-in não-arquivo | done | Os 3 efeitos não-arquivo (json-merge/refcount/legacy-prune) com before-state + matriz adversária. Construídos in-repo, depois SUPERSEDED → migraram p/ o pacote; paridade no round-trip 9/9. 4/4 tasks, 1/1 gate. |
| F2 — Providers e config two-tier | done | Provider + Driver + config two-tier — fase-ponteiro, 100% no repo do pacote (62/62). 0/3 tasks (no pacote), 1/2 gates (G-2 verifier removido no flip, provado no pacote). |
| F3 — Big-bang rewire e paridade | done | Religa atomic-skills sobre o pacote (SkillsProvider + runtime layers), remove src/kernel/, prova paridade. 6/6 tasks, 2/3 gates (G-2 deferred ambiental); review gate --mode=both achou+corrigiu 2 criticals de reversibilidade. |

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
