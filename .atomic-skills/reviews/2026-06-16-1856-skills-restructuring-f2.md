---
date: 2026-06-16T18:56:10Z
topic: skills-restructuring-f2
artifact: 113d5e8..HEAD (F2 — economia de tokens, padrões transversais; T2.1–T2.7)
skill: atomic-skills:review-code
mode: local
reviewer: claude-opus-4-8 (sealed-envelope agent, clean context)
final_verdict: needs_changes_all_fixed
counts: blocker=0 critical=0 major=1 minor=1
schema_version: "1.0"
---

# Local Review — skills-restructuring F2

**Ref:** `113d5e8..HEAD` (clean range: a única commit da F2 `8c4afad`; `113d5e8` = phase-done F6, o boundary — sem poluição de F6).
**Mode:** local (sealed-envelope agent, clean context, sem intent). DESTRUCTIVE=false (+539/−423, additive; 0 arquivos inteiros deletados).
**Files reviewed (skills/asset apenas, state-tracking excluído):** skills/core/{brainstorm,debate,fix,hunt,parallel-dispatch,parallel-dispatch-audit,review-code,review-plan,verify-claim}.md; skills/shared/codex-bridge-assets/envelope-orchestration.md; skills/shared/parallel-dispatch-assets/{rationalization,templates}.md.
**Passes:** 2.

## Findings — 2 confirmados reais, ambos FIXED este sessão

| # | Summary | Severity | File:line | Disposition |
|---|---------|----------|-----------|-------------|
| 1 | review-plan liga `«ARTIFACT»` a `{{ARTIFACT_PATH}}` ← plan_path E `{{ARTIFACT}}` ← composite, mas o esqueleto `envelope-orchestration.md` definia o slot como só `{{ARTIFACT}}` (singular) e o step-3 substituía só `{{ARTIFACT}}`. `pass1-briefing-template-plan.txt:32` tem um `{{ARTIFACT_PATH}}` real → ficaria por substituir no briefing codex do plan (regressão introduzida em T2.2; review-code não afetado, seu template não tem ARTIFACT_PATH). | major | binding review-plan.md:348; gap envelope-orchestration.md:20,45; placeholder órfão pass1-briefing-template-plan.txt:32 | **FIXED** (commit 2e09b596) — slot `«ARTIFACT»` (linha 20) + step-3 (linha 46) cobrem `{{ARTIFACT_PATH}}` com guarda "só quando o template do caller carrega". Re-verificado: T2.2 verifier PASS. |
| 2 | verify-claim step 1 aponta `project-transitions.md § kind: manual`, seção que não existe lá (project-transitions.md só menciona `kind: manual` inline na L218); o `### kind: manual` real está em `verifier-exec.md:44`. Pré-existente, mas o edit T2.5 (step 3 → verifier-exec) tornou a inconsistência step1↔step3 visível. | minor | verify-claim.md:26 | **FIXED** (commit 2e09b596) — ponteiro → `verifier-exec.md § kind: manual`. Re-verificado: T2.5 verifier PASS (testsCollected=2). |

## Verificação dos fixes
- ARTIFACT_PATH agora em envelope-orchestration.md:20 (slot) + :46 (step-3, com guarda).
- verify-claim.md:26 manual-acceptance gate → verifier-exec.md § kind: manual.
- `npm run validate-skills`: All 15 skills valid. T2.2 + T2.5 verifiers re-PASS. F2-G1 exit gate PASS.

## Checklist (resumo do agente)
- Broken reference/dangling pointer: 2 findings (ambos fixed) — demais ponteiros resolvem (envelope slots ↔ bindings, templates.md §, rationalization.md §, debug-techniques.md §2, verifier-exec.md, worktree-isolation.md, code-quality-gates G1-G9).
- Lost behavior (relocated): ok — templates.md/rationalization.md contêm equivalente do conteúdo removido; brainstorm/debate Rationalization deletada (não relocada) com Red Flags resident, sem dangling ref.
- Malformed placeholder/undefined slot: finding #1 (resolvido).
- Structural/markdown: ok — fences aninhados balanceados, tabelas íntegras, validate-skills passa.
- Verifier-grep fragility: ok — nenhum script conta `Rationalization` headings; assets usam `## parallel-dispatch`, não `## Rationalization`.
- Internal consistency: finding #2 (resolvido); intros de gate comprimidas batem com os self-review blocks.

**Final status:** Code approved (2 findings fixed this session, re-verified).
