---
lastUpdated: '2026-06-17T21:15:00Z'
schemaVersion: '0.1'
activePlans: 2
activeInitiatives: 0
archivedCount: 7
---

# Project Status Index

Canonical entry point. Auto-updated by `atomic-skills:project-status`. Read first every session.

## Active Plans

### worktree-lifecycle-finalization — Finalização do ciclo de vida da worktree-do-plano (currentPhase: F6)

Cada plano forka branch+worktree na criação; publicar (`finalize` → push + PR feature→develop) e encerrar (`archive`, zero-git pós-merge) são máquinas de estado separadas, operator-prompted; nunca remover trabalho não-provado-integrado (fail-closed: em indeterminação, BLOQUEIA).

| Phase | Status | Summary |
|-------|--------|---------|
| F0 — Always-fork na criação (Decisão 1) | done | Fork incondicional branch+worktree no nascimento do plano; "1 worktree = 1 feature = 1 PR limpo" mecânico. |
| F1 — integrationRef configurável | done | Resolver puro de `integrationRef`/`baseRef` (routing.json + schema), base do PR e dos git ops separadas. |
| F2 — Teardown seguro squash-safe (Decisão 2) | done | `isTeardownSafe` — liveness via `gh pr view` (MERGED+headRefOid) + veto local; squash-safe; fail-closed. |
| F3 — project finalize dedicado (Decisão 3) | done | Comando `finalize`: push + `gh pr create --base <integrationRef>`, grava pr-url; archive intocado. 1/1 tasks, 2/2 gates. |
| F4 — Check de colisão cross-WT no finalize (Decisão 7) | done | Gate determinístico `cross-wt-gate.js` (≥2 WTs, merge especulativo, fail-closed) + advisory A/B read-only no finalize; archive→teardown wired. 3/3 tasks, 2/2 gates. |
| F5 — Coupling interim de .atomic-skills/ (Decisão 5) | done | `focus.json` git-ignored (pré-existente) + `dispatch-log.json`→NDJSON com `merge=union` provado (union lossless só line-oriented); round-trip preservado. 1/1 tasks, 2/2 gates (Mode 2/Codex). |
| F6 — Backstop read-only no project verify (Decisão 6) | active | 9º check read-only: WARN para órfãos do modelo PR→develop (worktree de feature mergeada; branch arquivada não-integrada). |
| F7 — Dedup de review em duas camadas (Decisão 8) | pending | Ledger de superfície unificado (`last-review.json` ponteiro→conjunto) + run-record do composer; ambos falham-para-RE-revisar. |

### quick-idea-capture — Quick Idea Capture (currentPhase: F1)

Inbox barato de ideias do projeto: captura em segundos (fork Analisar/Só salvar) num único `ideas.md`, promoção sempre separada via emergence ladder. Dashboard fica para fase posterior.

| Phase | Status | Summary |
|-------|--------|---------|
| F0 — Captura barata (MVP do inbox) | done | Script de append, detail file com o fork, `idea list`, wiring e paridade de install. 3/3 tasks, 3/3 gates (codex lane). |
| F1 — Promoção via emergence ladder | done | Verbo `idea promote`: extrai a ideia e roteia pela ladder com ratify, marcando-a triaged. 2/2 tasks, 2/2 gates (codex lane). Plano completo — pronto para `archive`. |

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
