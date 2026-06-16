# Review — app-map-conflict-arbitration (PLAN, Stage 8b cross-model)

- **Date:** 2026-06-16T18:52Z
- **Artifact:** `.atomic-skills/projects/atomic-skills/app-map-conflict-arbitration/plan.md` (+ F0/F1 initiative summaries as context)
- **Mode:** codex (two-pass sealed envelope) · reviewer `gpt-5-codex`
- **Initiatives discovered:** 2/2 (F0, F1)

## Verdict

- **Pass 1 (blind):** `needs_changes` — 0B / 0C / **5 major** / 0 minor.
- **Pass 2 (informed):** `needs_changes` — 0B / 0C / **1 major** / 0 minor.
- **Framing Δ:** 5 → 1 (**4 dropped** by external constraints, 1 maintained, 0 emerged).

The blind pass flagged 5 majors that were all artifacts of reviewing the plan body
in isolation; the informed pass (given the verifiable constraints — the sibling
`design.md` carries the frozen contract, the task acceptance lives in the initiative
files, and no 0.2 catalog is persisted) dropped 4 and kept 1.

## Final findings (post-reconciliation)

| # | Severity | Plan:line | Finding | Action |
|---|---|---|---|---|
| F-001 | major | plan.md:88 (`references: []`) | O plano declara `design.md` como fonte de verdade no Context mas não o lista em `references[]` (vazio) → tooling/implementadores podem executar do phase-tree sem carregar o contrato exato (resolution.choice, kind-derivation, blast radius). | **applied** — adicionado `design.md` a `references[]` (kind repo-path, inside_repo). |

## Dropped from blind pass (framing-induced, invalidados por constraint)

- **F-001-blind** (coverage — agent arbitration path) — DROPPED: a arbitragem roda no skill `design-brief` pré-existente (interativo), que já chama `persistReconstruction`; este plano muda o descritor + a prosa, não constrói o agente.
- **F-002-blind** (coverage — kind não testado) — DROPPED: F1-T-001 acceptance já exige um teste determinístico de produtor para a derivação canônica do `kind`.
- **F-003-blind** (ambiguity — resolution.choice) — DROPPED: o `design.md` (D4) fixa a forma (value+source) e F0-T-002 acceptance reforça a pertença em `witnesses`.
- **F-004-blind** (coverage — backward-compat dos consumidores) — DROPPED: nenhum catálogo 0.1/0.2 persistido e sem consumidores externos (non-goal: sem migração de dados).

## Notes (codex questions)

- "porta de direção única" no nível de impl = o ramo 0.2 do schema fica intacto (catálogos 0.2 lêem válidos); o 0.3 entra como ramo condicional aditivo. Detalhe no `design.md` (D5) + F0-T-001 acceptance.
- O `.md` mirror alvo = `app-map.md` espelho gerado por `persist.js:mirrorMarkdown` (F1-T-002).

## Outcome

**Plano aprovado com 1 fix aplicado.** Verdict pós-fix: 0 blocker/critical; o único major (references vazio) foi corrigido. Stage 8b completo.
