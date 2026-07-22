---
schemaVersion: "0.1"
slug: implement-phase-agents-f0-contract-freeze-and-antipatterns
title: Contract freeze and antipatterns
goal: Freeze the operator-facing automate contract in durable skill prose and antipatterns so later code phases implement one agreed shape.
status: active
branch: plan/implement-phase-agents
started: 2026-07-22T20:36:08.845Z
lastUpdated: 2026-07-22T22:15:10.198Z
nextAction: Spawn evaluation agent for F0, stamp evaluationGate, then request operator decision-review PASS, then phase-done with review-code --mode=both.
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
gatesMet: 0
gatesTotal: 3
weightDone: 4
weightTotal: 4
exitGates:
  - id: F0-G1
    description: Contract strings for host-thin, phase-start package (draft businessIntent / validate-only), and decision-review appear in implement and maestro assets.
    status: pending
    verifier:
      kind: shell
      command: rg -n 'host-thin|decision-review|phase-start|validate-only|draft' skills/core/implement.md skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    verifierLabel: "shell: rg -n 'host-thin|decision-review|phase-start|validate-only|…"
  - id: F0-G2
    description: Antipatterns file covers host product diagnostics and auto PASS on decision-review.
    status: pending
    verifier:
      kind: shell
      command: rg -n 'decision-review|compose|build_edl' skills/shared/implement-antipatterns.md
      expectExitCode: 0
    verifierLabel: "shell: rg -n 'decision-review|compose|build_edl' skills/shared/imp…"
  - id: F0-G3
    description: "Manual HARD — Henry confirms F0 contract: host-thin; phase-start presents objective+tasks+draft BI; operator only validates titles and BI; decision-review hardgate."
    status: pending
    verifier:
      kind: manual
      description: Henry acks F0 contract in gate-signoff or chat with explicit PASS on design alignment.
    verifierLabel: manual
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
current: true
---

# Narrative / notes

Initiative for phase **F0 — Contract freeze and antipatterns**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_


## Session handoff
- **Narrative:** Pure-maestro F0: phase writer claimed-pass T-001..T-003; FF-merged; post-merge re-verify EXIT 0; lease cleared; all three tasks closed via done with GATE-R2 evidence on HEAD 8c90a36.
- **Decision log:** Automate stamp 8b893e7. Claim exclusivity revalidated with exclusive commitShas only. Merge FF 8c90a36. Complex tasks: none. Lease cleared after merge settle.
- **Single nextAction:** Spawn evaluation agent for F0 → stamp evaluationGate → operator decision-review PASS → phase-done (review-code --mode=both).
- **Verbatim state:** HEAD=8c90a36c660dd4d18bfdeddfea78f3916152cc64; T-001=42ddee2872689cdee652d76c97a758160b0ef008; T-002=e4ad99a9c9d9b31ffd831705a28015e737a6f47f; T-003=8c90a36c660dd4d18bfdeddfea78f3916152cc64; lease=missing; executionMode=automate; tasksDone=3/3.
- **Uncommitted changes:** initiative state checkpoint for T-001..T-003 closes (this write); commit next.
