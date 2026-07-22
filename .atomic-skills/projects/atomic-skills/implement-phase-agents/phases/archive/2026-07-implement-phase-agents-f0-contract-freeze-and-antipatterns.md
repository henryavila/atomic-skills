---
schemaVersion: "0.1"
slug: implement-phase-agents-f0-contract-freeze-and-antipatterns
title: Contract freeze and antipatterns
goal: Freeze the operator-facing automate contract in durable skill prose and antipatterns so later code phases implement one agreed shape.
status: done
branch: plan/implement-phase-agents
started: 2026-07-22T20:36:08.845Z
lastUpdated: 2026-07-22T22:37:27.000Z
nextAction: null
parentPlan: implement-phase-agents
phaseId: F0
businessIntent:
  value: "Sob automate o host fica magro: cada fase roda em agente fresco; no inicio da fase o skill apresenta objetivo + lista de tasks + businessIntent rascunhado para o operador so validar (titulos e BI); decisoes do agente ficam no decision log; phase-done exige hardgate manual de decision-review (so o operador escreve PASS)."
  workflow: Congelar contrato em prosa e antipatterns (F0) → decision log duravel (F1) → ban de execucao de produto no host e banners (F2) → schema e preflight decisionReview (F3) → ritual phase-start package + Step H (F4) → testes fixture + dogfood checklist (F5).
  rules: Nunca pedir BI em branco. Skill rascunha objetivo, tasks e BI; operador so valida ou edita e ratifica. Nunca auto-PASS de BI ou decision-review. Nunca editar product source no host sob automate. Nao remover evaluationGate review both lessons lease claim. Sem skills/core/automate.md. Mode 1 e Mode 2 intocados.
  outOfScope: Daemon Layer 4 multi-host; default automate global; trabalho de produto em curta; reescrever Mode 1 ou Mode 2; auto-PASS de gates manuais de produto.
  doneWhen: Contrato host-thin + phase-start package (draft BI + validate-only) + decision-review hardgate greppable em implement/maestro/antipatterns; Henry PASS no gate manual F0-G3.
tasksDone: 3
tasksTotal: 3
gatesMet: 3
gatesTotal: 3
weightDone: 4
weightTotal: 4
exitGates:
  - id: F0-G1
    description: Contract strings for host-thin, phase-start package (draft businessIntent / validate-only), and decision-review appear in implement and maestro assets.
    status: met
    verifier:
      kind: shell
      command: rg -n 'host-thin|decision-review|phase-start|validate-only|draft' skills/core/implement.md skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    verifierLabel: "shell: rg -n 'host-thin|decision-review|phase-start|validate-only|…"
    metAt: 2026-07-22T22:37:27.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T22:37:27.000Z
      verifiedCommit: 253e79362931d352944083ccc308cc77e1184128
      passed: true
      exitCode: 0
      outputSummary: rg host-thin|decision-review|phase-start|validate-only|draft implement+maestro EXIT 0
  - id: F0-G2
    description: Antipatterns file covers host product diagnostics and auto PASS on decision-review.
    status: met
    verifier:
      kind: shell
      command: rg -n 'decision-review|compose|build_edl' skills/shared/implement-antipatterns.md
      expectExitCode: 0
    verifierLabel: "shell: rg -n 'decision-review|compose|build_edl' skills/shared/imp…"
    metAt: 2026-07-22T22:37:27.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T22:37:27.000Z
      verifiedCommit: 253e79362931d352944083ccc308cc77e1184128
      passed: true
      exitCode: 0
      outputSummary: rg decision-review|compose|build_edl antipatterns EXIT 0
  - id: F0-G3
    description: "Manual HARD — Henry confirms F0 contract: host-thin; phase-start presents objective+tasks+draft BI; operator only validates titles and BI; decision-review hardgate."
    status: met
    verifier:
      kind: manual
      description: Henry acks F0 contract in gate-signoff or chat with explicit PASS on design alignment.
    verifierLabel: manual
    metAt: 2026-07-22T22:37:27.000Z
    evidence:
      verifierKind: manual
      verifiedAt: 2026-07-22T22:37:27.000Z
      verifiedCommit: 253e79362931d352944083ccc308cc77e1184128
      passed: true
      outputSummary: Henry PASS F0 contract 2026-07-22 (host-thin; phase-start draft BI validate-only; decision-review hardgate)
stack:
  - id: 1
    title: Contract freeze and antipatterns
    type: task
    openedAt: 2026-07-22T20:36:08.845Z
tasks:
  - id: T-001
    title: Operator contract in implement and maestro
    status: done
    lastUpdated: 2026-07-22T22:15:10.198Z
    scopeBoundary:
      - Do not change Mode 1 Step 2 session-writer coding path. Do not remove evaluation agent or plan-end external-both. Do not add skills/core/automate.md.
    acceptance:
      - "it - Automate iron laws state host-thin role: no product source edits and no product diagnostic entrypoints except verbatim verifiers."
      - it - Maestro phase-start package presents phase objective, task list (id and title), and a drafted businessIntent before spawn.
      - it - Operator role is validate-only for task titles and businessIntent (edit allowed); blank-fill BI and silent auto-PASS are forbidden.
      - it - Maestro states one fresh phase agent per phase and that decision-review is a mandatory manual hardgate before phase-done under automate.
      - it - Text names that agents never write decision-review PASS.
    verifier:
      kind: shell
      command: rg -n 'host-thin|phase-start|decision-review|validate-only|draft' skills/core/implement.md skills/shared/implement-automate-maestro.md && rg -n 'never.*PASS|agent never|operator PASS|validate' skills/core/implement.md skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
    summary: Congela host-thin, phase-start package (draft BI) e decision-review no implement/maestro.
    weight: 2
    closedAt: 2026-07-22T22:15:10.198Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T22:15:10.198Z
      verifiedCommit: 8c90a36c660dd4d18bfdeddfea78f3916152cc64
      passed: true
      exitCode: 0
      outputSummary: "skills/shared/implement-automate-maestro.md:11:When `isAutomateActive` is true, **do not** run Mode 1 Step 2 (session codes). After Step 1 hard gates pass, run this **host-thin** spine. The host never edits product source and does not run product diagnostic entrypoints (e.g. `compose`, `build_edl`) except **verbatim** task/exit-gate verifiers. Detail for the phase writer contract: `{{READ_TOOL}} skills/shared/implement-phase-writer.md`. Isolation/lease: `{{READ_TOOL}} skills/shared/worktree-isol"
  - id: T-002
    title: Antipatterns for host product debug and mega-session close
    status: done
    lastUpdated: 2026-07-22T22:15:10.198Z
    scopeBoundary:
      - Do not delete existing Mode-1 silent fallback antipatterns. Do not document Layer 4 daemon as in-scope for this plan.
    acceptance:
      - it - Red flag exists for host running compose or build_edl diagnostics under automate.
      - it - Red flag exists for closing an entire phase A through I as host mega-session without phase agent spawn.
      - it - Red flag exists for auto-writing decision-review PASS or silent auto-PASS of drafted businessIntent.
      - it - Red flag exists for dumping a blank businessIntent form on the operator instead of a drafted package.
      - it - Each red flag has a Temptation to Reality refutation entry.
    verifier:
      kind: shell
      command: rg -n 'compose|build_edl|mega-session|decision-review|blank|draft' skills/shared/implement-antipatterns.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-antipatterns.md
    summary: "Antipatterns: debug de produto no host, mega-sessao e auto-PASS."
    weight: 1
    closedAt: 2026-07-22T22:15:10.198Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T22:15:10.198Z
      verifiedCommit: 8c90a36c660dd4d18bfdeddfea78f3916152cc64
      passed: true
      exitCode: 0
      outputSummary: 29:- "Automate is on but I need to see the failure — I'll run compose / build_edl (or start the app server) from the host to diagnose." → Under host-thin automate the host does **not** run product diagnostic entrypoints (`compose`, `build_edl`, app servers, etc.) except **verbatim** task/exit-gate verifier commands. Diagnostics belong in the phase agent / fix agent or in a deliberate Mode-1 session after explicit leave-automate — host product debug is the mega-session smell that pure maestro for
  - id: T-003
    title: "KB note: operator mental model update"
    status: done
    lastUpdated: 2026-07-22T22:15:10.198Z
    scopeBoundary:
      - Do not claim a full maestro daemon is implemented. Do not document auto-materialize of businessIntent.
    acceptance:
      - it - Document states host-thin phase agents and phase-start package (objective + tasks + drafted BI, operator validate-only) as the operator mental model under automate.
      - it - Document states decision-review manual hardgate as required for phase close under automate.
      - it - Document still marks Layer 4 full daemon as non-goal for this plan.
    verifier:
      kind: shell
      command: rg -n 'host-thin|decision-review|phase-start|draft|validate|Layer 4' docs/kb/automate-orchestrator-realism.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/kb/automate-orchestrator-realism.md
    summary: Atualiza KB realism com mental model host-thin + hardgate.
    weight: 1
    closedAt: 2026-07-22T22:15:10.198Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T22:15:10.198Z
      verifiedCommit: 8c90a36c660dd4d18bfdeddfea78f3916152cc64
      passed: true
      exitCode: 0
      outputSummary: 17:| Schema / validate-state | executionMode, planEndReview shape, evaluationGate shape, reviewGate GATE-R3 | Strong on disk state | 32:- `canCloseTasksFromClaims` — claim validate + optional reachability 36:**Next cheap wins:** wire the same predicates into `validate-state` as 61:### Layer 4 — Full maestro (only if product-critical) 63:**Non-goal for the current implement-phase-agents plan.** Layer 4 full daemon 65:implemented by host-thin phase agents / phase-start package work. 73:**Do not st
parked: []
emerged: []
summary: Congela contrato host-thin, phase-start package (draft→validate) e decision-review.
planTitle: Implement phase agents (host-thin automate)
planActive: true
current: false
---

# Narrative / notes

Initiative for phase **F0 — Contract freeze and antipatterns**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_


## Session handoff
- **Narrative:** F0 closed. Tasks done, evaluation pass, decision-review operator PASS, F0-G3 PASS, review both pass after 2 fix re-dispatches. Phase archived; plan advanced to F1 (descriptor-only — materialize required).
- **Decision log:** Automate stamp. Claim exclusive commitShas. Review critical order mismatch fixed (2 re-dispatches). Operator PASS decision-review + F0-G3 2026-07-22. evaluationGate re-stamped at close HEAD.
- **Single nextAction:** Run project materialize F1 for implement-phase-agents, then implement --mode=automate (stamp already set).
- **Verbatim state:** HEAD=253e79362931d352944083ccc308cc77e1184128; F0 status=done; currentPhase=F1; executionMode=automate; reviewGate.mode=both at=253e79362931d352944083ccc308cc77e1184128; lease=missing.
- **Uncommitted changes:** phase-done advance commit (this write).


## Self-review against code-quality gates

- **G1 read-before-claim**: T-001..T-003 closed with shell evidence + post-merge re-verify EXIT 0; F0-G1/G2 re-run at 253e793.
- **G2 soft-language**: scanned; completion claims are passed:true evidence; decision-review PASS is operator-only.
- **G6 reference-or-strike**: handoff literals use SHAs/commands.
- **G10 gate-must-be-able-to-fail**: F0-G1/G2 greps fail when strings absent; F0-G3 manual.
- **CROSS-MODEL REVIEW**: review-code --mode=both local+codex; receipt .atomic-skills/reviews/implement-phase-agents-F0-both-253e793.md; at=253e79362931d352944083ccc308cc77e1184128.
- **Review gate (G2)**: reviewGate status=passed mode=both at=253e79362931d352944083ccc308cc77e1184128.
- **Lessons (G1)**: no lessons distilled (clean phase after review fixes).
- **decision-review**: operator PASS recorded 2026-07-22T22:37:27.000Z.
