---
schemaVersion: "0.1"
slug: implement-phase-agents-f0-contract-freeze-and-antipatterns
title: Contract freeze and antipatterns
goal: Freeze the operator-facing automate contract in durable skill prose and
  antipatterns so later code phases implement one agreed shape.
status: active
branch: plan/implement-phase-agents
started: 2026-07-22T20:36:08.845Z
lastUpdated: 2026-07-22T21:10:00.000Z
nextAction: "Pure-maestro F0: spawn code-only phase writer for T-001..T-003
  (host-thin contract freeze)."
parentPlan: implement-phase-agents
phaseId: F0
businessIntent:
  value: "Sob automate o host fica magro: cada fase roda em agente fresco; no
    inicio da fase o skill apresenta objetivo + lista de tasks + businessIntent
    rascunhado para o operador so validar (titulos e BI); decisoes do agente
    ficam no decision log; phase-done exige hardgate manual de decision-review
    (so o operador escreve PASS)."
  workflow: Congelar contrato em prosa e antipatterns (F0) → decision log duravel
    (F1) → ban de execucao de produto no host e banners (F2) → schema e
    preflight decisionReview (F3) → ritual phase-start package + Step H (F4) →
    testes fixture + dogfood checklist (F5).
  rules: Nunca pedir BI em branco. Skill rascunha objetivo, tasks e BI; operador
    so valida ou edita e ratifica. Nunca auto-PASS de BI ou decision-review.
    Nunca editar product source no host sob automate. Nao remover evaluationGate
    review both lessons lease claim. Sem skills/core/automate.md. Mode 1 e Mode
    2 intocados.
  outOfScope: Daemon Layer 4 multi-host; default automate global; trabalho de
    produto em curta; reescrever Mode 1 ou Mode 2; auto-PASS de gates manuais de
    produto.
  doneWhen: Contrato host-thin + phase-start package (draft BI + validate-only) +
    decision-review hardgate greppable em implement/maestro/antipatterns; Henry
    PASS no gate manual F0-G3.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 3
exitGates:
  - id: F0-G1
    description: Contract strings for host-thin, phase-start package (draft
      businessIntent / validate-only), and decision-review appear in implement
      and maestro assets.
    status: pending
    verifier:
      kind: shell
      command: rg -n 'host-thin|decision-review|phase-start|validate-only|draft'
        skills/core/implement.md skills/shared/implement-automate-maestro.md
      expectExitCode: 0
  - id: F0-G2
    description: Antipatterns file covers host product diagnostics and auto PASS on
      decision-review.
    status: pending
    verifier:
      kind: shell
      command: rg -n 'decision-review|compose|build_edl'
        skills/shared/implement-antipatterns.md
      expectExitCode: 0
  - id: F0-G3
    description: "Manual HARD — Henry confirms F0 contract: host-thin; phase-start
      presents objective+tasks+draft BI; operator only validates titles and BI;
      decision-review hardgate."
    status: pending
    verifier:
      kind: manual
      description: Henry acks F0 contract in gate-signoff or chat with explicit PASS
        on design alignment.
stack:
  - id: 1
    title: Contract freeze and antipatterns
    type: task
    openedAt: 2026-07-22T20:36:08.845Z
tasks:
  - id: T-001
    title: Operator contract in implement and maestro
    status: pending
    lastUpdated: 2026-07-22T20:36:08.845Z
    scopeBoundary:
      - Do not change Mode 1 Step 2 session-writer coding path. Do not remove
        evaluation agent or plan-end external-both. Do not add
        skills/core/automate.md.
    acceptance:
      - "it - Automate iron laws state host-thin role: no product source edits
        and no product diagnostic entrypoints except verbatim verifiers."
      - it - Maestro phase-start package presents phase objective, task list (id
        and title), and a drafted businessIntent before spawn.
      - it - Operator role is validate-only for task titles and businessIntent
        (edit allowed); blank-fill BI and silent auto-PASS are forbidden.
      - it - Maestro states one fresh phase agent per phase and that
        decision-review is a mandatory manual hardgate before phase-done under
        automate.
      - it - Text names that agents never write decision-review PASS.
    verifier:
      kind: shell
      command: rg -n 'host-thin|phase-start|decision-review|validate-only|draft'
        skills/core/implement.md skills/shared/implement-automate-maestro.md &&
        rg -n 'never.*PASS|agent never|operator PASS|validate'
        skills/core/implement.md skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
    summary: Congela host-thin, phase-start package (draft BI) e decision-review no
      implement/maestro.
    weight: 2
  - id: T-002
    title: Antipatterns for host product debug and mega-session close
    status: pending
    lastUpdated: 2026-07-22T20:36:08.845Z
    scopeBoundary:
      - Do not delete existing Mode-1 silent fallback antipatterns. Do not
        document Layer 4 daemon as in-scope for this plan.
    acceptance:
      - it - Red flag exists for host running compose or build_edl diagnostics
        under automate.
      - it - Red flag exists for closing an entire phase A through I as host
        mega-session without phase agent spawn.
      - it - Red flag exists for auto-writing decision-review PASS or silent
        auto-PASS of drafted businessIntent.
      - it - Red flag exists for dumping a blank businessIntent form on the
        operator instead of a drafted package.
      - it - Each red flag has a Temptation to Reality refutation entry.
    verifier:
      kind: shell
      command: rg -n 'compose|build_edl|mega-session|decision-review|blank|draft'
        skills/shared/implement-antipatterns.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-antipatterns.md
    summary: "Antipatterns: debug de produto no host, mega-sessao e auto-PASS."
    weight: 1
  - id: T-003
    title: "KB note: operator mental model update"
    status: pending
    lastUpdated: 2026-07-22T20:36:08.845Z
    scopeBoundary:
      - Do not claim a full maestro daemon is implemented. Do not document
        auto-materialize of businessIntent.
    acceptance:
      - it - Document states host-thin phase agents and phase-start package
        (objective + tasks + drafted BI, operator validate-only) as the operator
        mental model under automate.
      - it - Document states decision-review manual hardgate as required for
        phase close under automate.
      - it - Document still marks Layer 4 full daemon as non-goal for this plan.
    verifier:
      kind: shell
      command: rg -n 'host-thin|decision-review|phase-start|draft|validate|Layer 4'
        docs/kb/automate-orchestrator-realism.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/kb/automate-orchestrator-realism.md
    summary: Atualiza KB realism com mental model host-thin + hardgate.
    weight: 1
parked: []
emerged: []
summary: Congela contrato host-thin, phase-start package (draft→validate) e
  decision-review.
---

# Narrative / notes

Initiative for phase **F0 — Contract freeze and antipatterns**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_


## Session handoff
- **Narrative:** Pure-maestro pre-dispatch snapshot (Step B). F0 pending T-001..T-003. About to acquire writer lease and spawn sibling phase writer on `impl/implement-phase-agents-F0-writer` from base `8b893e77c0ccebeafa5c1bef8bae3106258e8d91`.
- **Decision log:** Ratify 2026-07-22 — skill drafts package; operator validates titles+BI only; never blank form; never silent BI PASS; agent never decision-review PASS. | 2026-07-22 automate entry: operator `y` → stampExecutionMode(plan, automate) commit 8b893e7. | Pre-dispatch 2026-07-22: canSpawnPhaseWriter ok (lease missing); sibling path `.worktrees/implement-phase-agents-F0-writer`.
- **Single nextAction:** Acquire lease + create sibling worktree + spawn code-only phase writer for F0 (T-001, T-002, T-003); SYNC WAIT for claim report.
- **Verbatim state:** planSlug=implement-phase-agents phaseId=F0 executionMode=automate HEAD=8b893e77c0ccebeafa5c1bef8bae3106258e8d91 baseRef=8b893e77c0ccebeafa5c1bef8bae3106258e8d91 writerBranch=impl/implement-phase-agents-F0-writer worktreePath=/Volumes/External/code/atomic-skills/.worktrees/implement-phase-agents-F0-writer initiativePath=.atomic-skills/projects/atomic-skills/implement-phase-agents/phases/f0-contract-freeze-and-antipatterns.md
- **Uncommitted changes:** clean tree after pre-dispatch handoff microcommit (this block).
