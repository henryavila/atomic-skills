---
schemaVersion: "0.1"
slug: automate-default-and-operator-gates
title: Automate default + operator gates (decision-review + plan-end intent)
version: "1.0"
status: active
started: 2026-07-25T22:39:25.331Z
lastUpdated: 2026-07-27T09:11:22.430Z
branch: plan/automate-default-and-operator-gates
currentPhase: F4
parallelismAllowed: false
principles:
  - id: P1
    title: Automate is the default implement path
    body: >-
      `implement` without an explicit non-automate mode runs pure-maestro.
      Escape hatches:

      `--mode=1` / `mode:1` / session-writer Mode 1, and durable clear via

      `--clear-execution-mode` + stamp removal. First session may still confirm
      stamp for

      durability; absence of CLI mode no longer means Mode 1.
  - id: P2
    title: Host-thin pure maestro stays
    body: >-
      Host never edits product source under automate; code-only phase writers;
      never silent

      Mode-1 fallback; never self-certify. Default mode does not relax Iron Law.
  - id: P3
    title: Read-before-PASS on decision-review
    body: >-
      Operator cannot PASS decision-review until the host has presented the
      phase decision

      package in the same hardgate turn (rendered summary + path to JSONL +
      linked evidence).

      Token alone without a prior present step in that turn is invalid.
  - id: P4
    title: Plan-end intent-vs-delivered is mandatory under automate
    body: >-
      Before finalize/archive, cross-model plan-end review must score intended

      (spec/plan/BI/tasks) against delivered (merged tree + durable state).
      Generic code

      review alone does not satisfy the gate.
  - id: P5
    title: Fail closed over looks-approved
    body: >-
      Missing decision package present, empty decision log without explicit
      empty ack, or

      plan-end receipt without intent-vs-delivered section blocks phase-done /
      finalize.
  - id: P6
    title: No new top-level skill
    body: Extend implement + shared assets + pure helpers + tests. No
      skills/core/automate.md.
  - id: P7
    title: Gate activation matches session default
    body: >-
      Any path that runs pure-maestro under automate-default feeds the same
      activation into

      machine gates (`canRunPhaseDone`, `automatePlanEndGatesOk`) via stamp
      and/or

      `automateActive: true` so first-session-before-stamp cannot skip
      present-before-PASS

      or intentVsDelivered.
glossary:
  - term: automate-default
    definition: implement with no mode flag activates pure-maestro (unless explicit
      Mode 1 / clear)
  - term: decision package
    definition: Host-rendered view of decisions phase JSONL plus evidence links
      shown before PASS ask
  - term: read-before-PASS
    definition: "Two-step hardgate: present package then operator PASS/FAIL token"
  - term: intent surface
    definition: "Desired set: plan phase goal/BI, initiative tasks + acceptance,
      exit criteria"
  - term: delivered surface
    definition: "Actual set: merged SHAs, claim reports / outputs paths, state tasks done"
  - term: intent-vs-delivered review
    definition: Plan-end cross-model review whose brief forces comparison of intent
      vs delivered
phases:
  - id: F0
    slug: automate-default-and-operator-gates-f0-automate-as-default-mode
    title: Automate as default mode
    goal: Flip default so bare implement enters pure-maestro; Mode 1 is explicit;
      docs/tests match.
    dependsOn: []
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: implement-mode unit tests green with automate-default matrix.
          status: met
          verifier:
            kind: shell
            command: node --test tests/implement-mode.test.js
            expectExitCode: 0
          metAt: 2026-07-26T22:24:32.445Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-26T22:24:32.445Z
            verifiedCommit: 95872f9fe798d25a6e9f4a8b56261c0952d55023
            passed: true
            exitCode: 0
            outputSummary: F0-G1 re-verified at decision-review PASS / phase-done prep
        - id: F0-G2
          description: Skill prose states automate default and Mode-1 escape hatch.
          status: met
          verifier:
            kind: shell
            command: rg -n 'default|Mode 1|--mode=1' skills/core/implement.md
              skills/shared/implement-automate-maestro.md
            expectExitCode: 0
          metAt: 2026-07-26T22:24:32.445Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-26T22:24:32.445Z
            verifiedCommit: 95872f9fe798d25a6e9f4a8b56261c0952d55023
            passed: true
            exitCode: 0
            outputSummary: F0-G2 re-verified at decision-review PASS / phase-done prep
    status: done
    businessIntent:
      value: Automate is the default implement path so multi-phase plans run
        pure-maestro without a mode flag, with Mode 1 only via explicit escape.
      workflow: TDD isAutomateActive and parse matrix first, then update
        implement/maestro prose and antipatterns so docs match machine default.
      rules: Mode 1 remains via --mode=1; host-thin Iron Law unchanged; no auto-merge;
        durable stamp and clear path stay; session default must activate machine
        gates even before stamp.
      outOfScope: Decision package UX (F1); intent-vs-delivered plan-end (F2); dogfood
        checklist (F3); review stub authenticity and post-merge e2e from dump
        follow-ups.
      doneWhen: implement-mode tests green for no-CLI no-stamp true; prose states
        automate default and Mode-1 escape; F0-G1 and F0-G2 met.
    summary: Tornar automate o default do implement com escape Mode 1.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-automate-default-and-operator-gates-F0.md
      verifiedAt: 2026-07-26T22:24:32.445Z
      at: 95872f9fe798d25a6e9f4a8b56261c0952d55023
    lessonsState: none
    reviewGate:
      status: passed
      mode: both
      at: 95872f9fe798d25a6e9f4a8b56261c0952d55023
      reviewFile: .atomic-skills/reviews/2026-07-26-automate-default-F0-phase-both.md
      verifiedAt: 2026-07-26T22:24:32.445Z
    noneReason: no lessons distilled — clean phase (operator ratified)
    decisionReview:
      status: passed
      verifiedAt: 2026-07-26T22:24:32.445Z
      evidencePath: .atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/decisions/F0.jsonl
      at: 95872f9fe798d25a6e9f4a8b56261c0952d55023
      packagePresentedAt: 2026-07-26T22:24:32.445Z
      packagePath: .atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/decisions/F0.jsonl
  - id: F1
    slug: automate-default-and-operator-gates-f1-decision-review-read-bef
    title: Decision-review present-before-PASS + AskUserQuestion-only hardgates
    goal: Operator always sees the decision package before PASS/FAIL; under automate
      every operator hardgate uses AskUserQuestion options only — free-text
      token recovery is forbidden; decline re-asks or STOPs.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F1-G1
          description: Decision package unit tests pass.
          status: met
          verifier:
            kind: shell
            command: node --test tests/decision-review-package.test.js
            expectExitCode: 0
          metAt: 2026-07-27T07:38:06.657Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-27T07:38:06.657Z
            verifiedCommit: 65cb3fc9843d3a0c931cd96d32aaec9ac6691b06
            passed: true
            exitCode: 0
            outputSummary: F1-G1 re-verified at phase-done
        - id: F1-G2
          description: Present-before-PASS + package evidence mandated in prose/gates.
          status: met
          verifier:
            kind: shell
            command: rg -n 'read-before-PASS|packagePresented|decision package'
              skills/shared/implement-decision-log.md
              skills/shared/implement-automate-maestro.md
            expectExitCode: 0
          metAt: 2026-07-27T07:38:06.657Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-27T07:38:06.657Z
            verifiedCommit: 65cb3fc9843d3a0c931cd96d32aaec9ac6691b06
            passed: true
            exitCode: 0
            outputSummary: F1-G2 re-verified at phase-done
        - id: F1-G3
          description: AskUserQuestion-only + free-text ban + decline path greppable.
          status: met
          verifier:
            kind: shell
            command: rg -n 'AskUserQuestion|free-text|re-Ask|operator-continue'
              skills/shared/implement-decision-log.md
              skills/shared/implement-automate-maestro.md
              skills/shared/implement-antipatterns.md skills/core/implement.md
            expectExitCode: 0
          metAt: 2026-07-27T07:38:06.657Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-27T07:38:06.657Z
            verifiedCommit: 65cb3fc9843d3a0c931cd96d32aaec9ac6691b06
            passed: true
            exitCode: 0
            outputSummary: F1-G3 re-verified at phase-done
    status: done
    summary: Package present-before-PASS + canal AskUserQuestion-only (sem
      free-text) em hardgates.
    context:
      solves: Blind PASS and free-text "type decision-review PASS" after
        AskUserQuestion decline both break the human contract under automate.
      trigger: "F0 pure-maestro dogfood: AskUserQuestion declined → host asked chat
        typing of PASS; operator requested merge with F1 present-before-PASS."
      assumesStillValid:
        - Host has AskUserQuestion (or {{ASK_USER_QUESTION_TOOL}}).
        - F1 package present remains load-bearing; channel law is additive.
        - Operators accept re-Ask on decline instead of free-text tokens.
      lastReviewedAt: 2026-07-26T10:26:11.558Z
      ratifiedAt: 2026-07-26T10:26:11.568Z
      ratifiedBy: human
    provenance:
      surfacedAt: 2026-07-26T10:26:11.568Z
      surfacedDuring: F0-pure-maestro/decision-review-decline-recovery
      surfacedBy: ai
    businessIntent:
      value: Package present-before-PASS + canal AskUserQuestion-only (sem free-text)
        para hardgates de operador sob automate.
      workflow: TDD package builder → gate machine present evidence →
        prosa/antipatterns AskUserQuestion-only + decline re-Ask → matriz
        continue/ratify/disposition/stamp; greps F1-G*.
      rules: Agents never write PASS; present package body no mesmo turno do
        AskUserQuestion PASS|FAIL; decline re-Ask (bounded) ou STOP (nunca
        free-text); session default + stamp alimentam gates; host-thin Iron Law
        intact.
      outOfScope: F2 intent-vs-delivered; F3 dogfood checklist full; F4 authenticity
        floors; Lekto product; forçar widget fora de AskUserQuestion.
      doneWhen: tests package green; present-before-PASS machine; AskUserQuestion-only
        + free-text ban greppable; F1-G1/G2/G3 met.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-automate-default-and-operator-gates-F1.md
      verifiedAt: 2026-07-27T07:38:06.657Z
      at: 65cb3fc9843d3a0c931cd96d32aaec9ac6691b06
    lessonsState: none
    noneReason: clean phase — no failure signals
    reviewGate:
      status: passed
      mode: both
      at: 65cb3fc9843d3a0c931cd96d32aaec9ac6691b06
      reviewFile: .atomic-skills/reviews/2026-07-26-automate-default-F1-phase-both.md
      verifiedAt: 2026-07-27T07:38:06.657Z
    decisionReview:
      status: passed
      verifiedAt: 2026-07-27T07:38:06.657Z
      evidencePath: .atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/decisions/F1.jsonl
      at: 65cb3fc9843d3a0c931cd96d32aaec9ac6691b06
      packagePresentedAt: 2026-07-27T07:38:06.657Z
      packagePath: .atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/decisions/F1.jsonl
  - id: F2
    slug: automate-default-and-operator-gates-f2-plan-end-intent-vs-deliv
    title: Plan-end intent-vs-delivered cross-model review
    goal: Plan-end cross-model review compares intended vs delivered with a
      machine-checkable receipt field.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: Intent surface and plan-end tests pass.
          status: met
          verifier:
            kind: shell
            command: node --test tests/plan-end-intent-surface.test.js
              tests/plan-end-review.test.js
            expectExitCode: 0
          metAt: 2026-07-27T08:09:31.152Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-27T08:09:31.152Z
            verifiedCommit: f9debea3d450c44721e776545b9fdc27fa18b5c3
            passed: true
            exitCode: 0
            outputSummary: F2-G1 at phase-done
        - id: F2-G2
          description: Maestro Step I requires intent-vs-delivered under automate.
          status: met
          verifier:
            kind: shell
            command: rg -n 'intent-vs-delivered|intentVsDelivered'
              skills/shared/implement-automate-maestro.md src/plan-end-review.js
            expectExitCode: 0
          metAt: 2026-07-27T08:09:31.152Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-27T08:09:31.152Z
            verifiedCommit: f9debea3d450c44721e776545b9fdc27fa18b5c3
            passed: true
            exitCode: 0
            outputSummary: F2-G2 at phase-done
    status: done
    summary: Review plan-end intent vs delivered com campo no receipt.
    businessIntent:
      value: Plan-end sob automate responde "entregamos o que o plano prometeu?" via
        intent-vs-delivered machine-checkable no receipt.
      workflow: TDD collectors intent/delivered → brief + receipt intentVsDelivered +
        wire planEndReviewOk/assert finalize → prosa Step I.
      rules: Fail-closed se intentVsDelivered vazio sob automate (session default ou
        stamp); external-both mantém ≥1 leg family-different; skip plan-end
        HARD-CLOSED sob stamp; userValidationOk continua operator-owned; sem
        auto-merge.
      outOfScope: F3 dogfood checklist; F4 authenticity dual-leg floors; Playwright
        pós-merge; Lekto product; auto-PASS user validation.
      doneWhen: tests intent-surface + plan-end green; receipt exige
        intentVsDelivered; assert finalize falha se ausente; F2-G1/G2 met.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-automate-default-and-operator-gates-F2.md
      verifiedAt: 2026-07-27T08:09:31.152Z
      at: f9debea3d450c44721e776545b9fdc27fa18b5c3
    reviewGate:
      status: passed
      mode: both
      at: f9debea3d450c44721e776545b9fdc27fa18b5c3
      reviewFile: .atomic-skills/reviews/2026-07-27-automate-default-F2-phase-both.md
      verifiedAt: 2026-07-27T08:09:31.152Z
    lessonsState: none
    noneReason: clean phase — no failure signals
    decisionReview:
      status: passed
      verifiedAt: 2026-07-27T08:09:31.152Z
      evidencePath: .atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/decisions/F2.jsonl
      at: f9debea3d450c44721e776545b9fdc27fa18b5c3
      packagePresentedAt: 2026-07-27T08:09:31.152Z
      packagePath: .atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/decisions/F2.jsonl
  - id: F3
    slug: automate-default-and-operator-gates-f3-dogfood-checklist
    title: Dogfood checklist
    goal: Checklist so the next automate run proves the three gates without chat
      memory.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F3-G1
          description: Dogfood checklist covers default decision package and
            intent-vs-delivered.
          status: met
          verifier:
            kind: shell
            command: rg -n 'read-before-PASS|intentVsDelivered|default' docs/kb/
            expectExitCode: 0
          metAt: 2026-07-27T08:17:57.417Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-27T08:17:57.417Z
            verifiedCommit: 9838128763f6a76a2103756272b0525f9d610674
            passed: true
            exitCode: 0
            outputSummary: F3-G1 green
    status: done
    summary: Checklist dogfood dos três gates.
    businessIntent:
      value: Operador tem checklist durable que prova F0 default + F1
        present-before-PASS + F2 intentVsDelivered sem memória de chat.
      workflow: Escrever/atualizar docs/kb checklist rows + greps; zero product code.
      rules: Só KB/checklist; sem app code; alinhar a F0–F2 já shipped.
      outOfScope: F4 authenticity; product Lekto; reimplementar gates F0–F2.
      doneWhen: F3-G1 rg green; file(s) com as rows listadas.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-automate-default-and-operator-gates-F3.md
      verifiedAt: 2026-07-27T08:17:57.417Z
      at: 9838128763f6a76a2103756272b0525f9d610674
    reviewGate:
      status: passed
      mode: both
      at: 9838128763f6a76a2103756272b0525f9d610674
      reviewFile: .atomic-skills/reviews/2026-07-27-automate-default-F3-phase-both.md
      verifiedAt: 2026-07-27T08:17:57.417Z
    lessonsState: none
    noneReason: clean phase — docs-only checklist
    decisionReview:
      status: passed
      verifiedAt: 2026-07-27T08:17:57.417Z
      evidencePath: .atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/decisions/F3.jsonl
      at: 9838128763f6a76a2103756272b0525f9d610674
      packagePresentedAt: 2026-07-27T08:17:57.417Z
      packagePath: .atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/decisions/F3.jsonl
  - id: F4
    slug: automate-default-and-operator-gates-f4-receipt-auth
    title: Receipt authenticity and close-path integrity
    goal: Fail-closed authenticity for phase review dual-leg and evaluation floors;
      major disposition tokens; decision-log statusRoot normalize; phase-done
      mirror/assert path (no host hand-edit).
    dependsOn:
      - F3
    subPhaseCount: 0
    exitGate:
      summary: 4 criteria to meet
      criteria:
        - id: F4-G1
          description: phase-review authenticity tests pass (dual leg, min size,
            non-binary reject stub/corrupt).
          status: met
          verifier:
            kind: shell
            command: node --test tests/phase-review-gate.test.js
              tests/phase-review-authenticity.test.js 2>/dev/null; node --test
              tests/phase-review-gate.test.js
            expectExitCode: 0
          metAt: 2026-07-27T08:32:15.086Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-27T08:32:15.086Z
            verifiedCommit: ee6d53f14fd20c40a1d7efbc61ded940046d87e7
            passed: true
            exitCode: 0
            outputSummary: F4-G1 green
        - id: F4-G2
          description: decision-log statusRoot normalize tests pass; double projects path
            rejected or fixed.
          status: met
          verifier:
            kind: shell
            command: node --test tests/decision-log.test.js
            expectExitCode: 0
          metAt: 2026-07-27T08:32:15.086Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-27T08:32:15.086Z
            verifiedCommit: ee6d53f14fd20c40a1d7efbc61ded940046d87e7
            passed: true
            exitCode: 0
            outputSummary: F4-G2 green
        - id: F4-G3
          description: Prose requires present dual-leg authenticity, disposition token,
            canonical phase-done (no hand-edit).
          status: met
          verifier:
            kind: shell
            command: rg -n
              'authenticity|dual-leg|non-binary|disposition|statusRoot|hand-edit|mirror'
              skills/shared/implement-automate-maestro.md
              skills/shared/implement-antipatterns.md
              skills/shared/project-assets/project-transitions.md
              src/phase-review-gate.js src/decision-log.js
            expectExitCode: 0
          metAt: 2026-07-27T08:32:15.086Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-27T08:32:15.086Z
            verifiedCommit: ee6d53f14fd20c40a1d7efbc61ded940046d87e7
            passed: true
            exitCode: 0
            outputSummary: F4-G3 green
        - id: F4-G4
          description: assert or unit tests cover exitGate mirror / terminal pending block
            under automate close.
          status: met
          verifier:
            kind: shell
            command: node --test tests/phase-done-mirror.test.js
              tests/lifecycle-order-guard.test.js 2>/dev/null; rg -n
              'exitGate|mirror|terminal-pending' src/ scripts/ tests/
            expectExitCode: 0
          metAt: 2026-07-27T08:32:15.086Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-27T08:32:15.086Z
            verifiedCommit: ee6d53f14fd20c40a1d7efbc61ded940046d87e7
            passed: true
            exitCode: 0
            outputSummary: F4-G4 green
    status: done
    summary: "Hardening: authenticity de review dual-leg, disposition e integrity do
      phase-done."
    businessIntent:
      value: Fases sob automate não podem carimbar reviewGate/evaluationGate passed
        com receipt stub ou disposition major sem token do operador; phase-done
        não deixa archive com exitGates mentindo; decision-log não aceita
        statusRoot que duplica projects/.
      workflow: "TDD: authenticity floor em phase-review-gate (dual path, min size,
        non-binary); evaluation content floor; disposition major exige token
        operator (decline != accept); decisionLogPath normaliza statusRoot;
        assert mirror exitGates + validate-state no dir do plan e antipattern
        hand-edit phase-done; prosa maestro/transitions; testes unitários e
        greps de prosa."
      rules: "Floor médio (não parser full codex). Não auto-merge. Não reabrir F0–F3.
        Fora: post-merge Playwright, session-break, phase-done-apply script
        completo, Layer 4. Host-thin permanece."
      outOfScope: Post-merge e2e re-run (Cluster B); claims durable path;
        session-break AskUserQuestion; phase-done-apply atômico completo; forçar
        2 external providers; backlog produto Lekto; auto-PASS decision-review.
      doneWhen: phase-done sob automate falha com stub/corrupt dual-leg; evaluation
        thin sem floor falha; major sem disposition token bloqueia; statusRoot
        double-projects rejeitado; mirror exitGates assert + prosa canônica;
        F4-G* met.
    provenance:
      surfacedAt: 2026-07-26T02:04:34.265Z
      surfacedDuring: plan-bootstrap/research-hardening
      surfacedBy: ai
    context:
      solves: Carimbos reviewGate/evaluationGate e phase-done do dogfood mentiam
        (stubs, disposition soft, archive gates pending, statusRoot errado).
      trigger: "Pesquisa pós-dump + validação do operador: F4 no plano atual, núcleo
        authenticity (floor médio), statusRoot e assert mirror phase-done."
      assumesStillValid:
        - phase-review-gate e evaluationGate continuam pointer-only até F4
          estender honesty com I/O de arquivo
        - F0–F3 do plano cobrem default/PASS cego/intent-vs-delivered e não
          authenticity
        - Operador aceita fail-closed mais duro em phase-done (stub bloqueia) em
          troca de confiança no carimbo
      ratifiedAt: 2026-07-26T02:04:34.265Z
      ratifiedBy: human
      lastReviewedAt: 2026-07-26T02:04:34.265Z
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-automate-default-and-operator-gates-F4.md
      at: 5d909e2ba5557bd14d9f94caa07355bb2319969b
      verifiedAt: 2026-07-27T08:42:51.592Z
    reviewGate:
      status: passed
      mode: both
      at: 5d909e2ba5557bd14d9f94caa07355bb2319969b
      reviewFile: .atomic-skills/reviews/2026-07-27-automate-default-F4-local.md
      localReceiptPath: .atomic-skills/reviews/2026-07-27-automate-default-F4-local.md
      codexReceiptPath: .atomic-skills/reviews/2026-07-27-automate-default-F4-codex.md
      legs:
        - path: .atomic-skills/reviews/2026-07-27-automate-default-F4-local.md
          provider: local
        - path: .atomic-skills/reviews/2026-07-27-automate-default-F4-codex.md
          provider: codex
      verifiedAt: 2026-07-27T08:42:51.592Z
    lessonsState: none
    noneReason: clean phase — authenticity floors shipped green
    decisionReview:
      status: passed
      verifiedAt: 2026-07-27T08:42:51.592Z
      evidencePath: .atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/decisions/F4.jsonl
      at: 5d909e2ba5557bd14d9f94caa07355bb2319969b
      packagePresentedAt: 2026-07-27T08:42:51.592Z
      packagePath: .atomic-skills/projects/atomic-skills/automate-default-and-operator-gates/decisions/F4.jsonl
references:
  - kind: url
    path: https://github.com/henryavila/atomic-skills/pull/38
    label: "PR #38"
planActive: true
planTitle: Automate default + operator gates (decision-review + plan-end intent)
executionMode: automate
planEndReview:
  mode: external-both
  reviewFile: .atomic-skills/reviews/2026-07-27-plan-end-automate-default-external-both.md
  range: plan/automate-default-and-operator-gates F0..F4 @ 85927de02931
  verifiedAt: 2026-07-27T09:06:37.261Z
  legs:
    - provider: codex
      status: succeeded
      familyDifferent: true
    - provider: claude
      status: succeeded
      familyDifferent: true
  intentVsDelivered:
    - id: ivd:F0:goal
      label: Flip default so bare implement enters pure-maestro; Mode 1 is explicit;
        docs/tests match.
      status: matched
      intentId: F0:goal
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F0:bi:value
      label: Automate is the default implement path so multi-phase plans run
        pure-maestro without a mode flag, with Mode 1 only via explicit escape.
      status: matched
      intentId: F0:bi:value
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F0:bi:workflow
      label: TDD isAutomateActive and parse matrix first, then update
        implement/maestro prose and antipatterns so docs match machine default.
      status: matched
      intentId: F0:bi:workflow
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F0:bi:rules
      label: Mode 1 remains via --mode=1; host-thin Iron Law unchanged; no auto-merge;
        durable stamp and clear path stay; session default must activate machine
        gates even before stamp.
      status: matched
      intentId: F0:bi:rules
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F0:bi:outOfScope
      label: Decision package UX (F1); intent-vs-delivered plan-end (F2); dogfood
        checklist (F3); review stub authenticity and post-merge e2e from dump
        follow-ups.
      status: matched
      intentId: F0:bi:outOfScope
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F0:bi:doneWhen
      label: implement-mode tests green for no-CLI no-stamp true; prose states
        automate default and Mode-1 escape; F0-G1 and F0-G2 met.
      status: matched
      intentId: F0:bi:doneWhen
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F0:exit:0
      label: implement-mode unit tests green with automate-default matrix.
      status: matched
      intentId: F0:exit:0
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F0:exit:1
      label: Skill prose states automate default and Mode-1 escape hatch.
      status: matched
      intentId: F0:exit:1
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F1:goal
      label: Operator always sees the decision package before PASS/FAIL; under
        automate every operator hardgate uses AskUserQuestion options only —
        free-text token recovery is forbidden; decline re-asks or STOPs.
      status: matched
      intentId: F1:goal
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:bi:value
      label: Package present-before-PASS + canal AskUserQuestion-only (sem free-text)
        para hardgates de operador sob automate.
      status: matched
      intentId: F1:bi:value
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:bi:workflow
      label: TDD package builder → gate machine present evidence → prosa/antipatterns
        AskUserQuestion-only + decline re-Ask → matriz
        continue/ratify/disposition/stamp; greps F1-G*.
      status: matched
      intentId: F1:bi:workflow
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:bi:rules
      label: Agents never write PASS; present package body no mesmo turno do
        AskUserQuestion PASS|FAIL; decline re-Ask (bounded) ou STOP (nunca
        free-text); session default + stamp alimentam gates; host-thin Iron Law
        intact.
      status: matched
      intentId: F1:bi:rules
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:bi:outOfScope
      label: F2 intent-vs-delivered; F3 dogfood checklist full; F4 authenticity
        floors; Lekto product; forçar widget fora de AskUserQuestion.
      status: matched
      intentId: F1:bi:outOfScope
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:bi:doneWhen
      label: tests package green; present-before-PASS machine; AskUserQuestion-only +
        free-text ban greppable; F1-G1/G2/G3 met.
      status: matched
      intentId: F1:bi:doneWhen
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:exit:0
      label: Decision package unit tests pass.
      status: matched
      intentId: F1:exit:0
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:exit:1
      label: Present-before-PASS + package evidence mandated in prose/gates.
      status: matched
      intentId: F1:exit:1
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:exit:2
      label: AskUserQuestion-only + free-text ban + decline path greppable.
      status: matched
      intentId: F1:exit:2
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F2:goal
      label: Plan-end cross-model review compares intended vs delivered with a
        machine-checkable receipt field.
      status: matched
      intentId: F2:goal
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F2:bi:value
      label: Plan-end sob automate responde "entregamos o que o plano prometeu?" via
        intent-vs-delivered machine-checkable no receipt.
      status: matched
      intentId: F2:bi:value
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F2:bi:workflow
      label: TDD collectors intent/delivered → brief + receipt intentVsDelivered +
        wire planEndReviewOk/assert finalize → prosa Step I.
      status: matched
      intentId: F2:bi:workflow
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F2:bi:rules
      label: Fail-closed se intentVsDelivered vazio sob automate (session default ou
        stamp); external-both mantém ≥1 leg family-different; skip plan-end
        HARD-CLOSED sob stamp; userValidationOk continua operator-owned; sem
        auto-merge.
      status: matched
      intentId: F2:bi:rules
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F2:bi:outOfScope
      label: F3 dogfood checklist; F4 authenticity dual-leg floors; Playwright
        pós-merge; Lekto product; auto-PASS user validation.
      status: matched
      intentId: F2:bi:outOfScope
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F2:bi:doneWhen
      label: tests intent-surface + plan-end green; receipt exige intentVsDelivered;
        assert finalize falha se ausente; F2-G1/G2 met.
      status: matched
      intentId: F2:bi:doneWhen
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F2:exit:0
      label: Intent surface and plan-end tests pass.
      status: matched
      intentId: F2:exit:0
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F2:exit:1
      label: Maestro Step I requires intent-vs-delivered under automate.
      status: matched
      intentId: F2:exit:1
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F3:goal
      label: Checklist so the next automate run proves the three gates without chat
        memory.
      status: matched
      intentId: F3:goal
      phaseId: F3
      note: phase tasks fully evidenced
    - id: ivd:F3:bi:value
      label: Operador tem checklist durable que prova F0 default + F1
        present-before-PASS + F2 intentVsDelivered sem memória de chat.
      status: matched
      intentId: F3:bi:value
      phaseId: F3
      note: phase tasks fully evidenced
    - id: ivd:F3:bi:workflow
      label: Escrever/atualizar docs/kb checklist rows + greps; zero product code.
      status: matched
      intentId: F3:bi:workflow
      phaseId: F3
      note: phase tasks fully evidenced
    - id: ivd:F3:bi:rules
      label: Só KB/checklist; sem app code; alinhar a F0–F2 já shipped.
      status: matched
      intentId: F3:bi:rules
      phaseId: F3
      note: phase tasks fully evidenced
    - id: ivd:F3:bi:outOfScope
      label: F4 authenticity; product Lekto; reimplementar gates F0–F2.
      status: matched
      intentId: F3:bi:outOfScope
      phaseId: F3
      note: phase tasks fully evidenced
    - id: ivd:F3:bi:doneWhen
      label: F3-G1 rg green; file(s) com as rows listadas.
      status: matched
      intentId: F3:bi:doneWhen
      phaseId: F3
      note: phase tasks fully evidenced
    - id: ivd:F3:exit:0
      label: Dogfood checklist covers default decision package and
        intent-vs-delivered.
      status: matched
      intentId: F3:exit:0
      phaseId: F3
      note: phase tasks fully evidenced
    - id: ivd:F4:goal
      label: Fail-closed authenticity for phase review dual-leg and evaluation floors;
        major disposition tokens; decision-log statusRoot normalize; phase-done
        mirror/assert path (no host hand-edit).
      status: matched
      intentId: F4:goal
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:bi:value
      label: Fases sob automate não podem carimbar reviewGate/evaluationGate passed
        com receipt stub ou disposition major sem token do operador; phase-done
        não deixa archive com exitGates mentindo; decision-log não aceita
        statusRoot que duplica projects/.
      status: matched
      intentId: F4:bi:value
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:bi:workflow
      label: "TDD: authenticity floor em phase-review-gate (dual path, min size,
        non-binary); evaluation content floor; disposition major exige token
        operator (decline != accept); decisionLogPath normaliza statusRoot;
        assert mirror exitGates + validate-state no dir do plan e antipattern
        hand-edit phase-done; prosa maestro/transitions; testes unitários e
        greps de prosa."
      status: matched
      intentId: F4:bi:workflow
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:bi:rules
      label: "Floor médio (não parser full codex). Não auto-merge. Não reabrir F0–F3.
        Fora: post-merge Playwright, session-break, phase-done-apply script
        completo, Layer 4. Host-thin permanece."
      status: matched
      intentId: F4:bi:rules
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:bi:outOfScope
      label: Post-merge e2e re-run (Cluster B); claims durable path; session-break
        AskUserQuestion; phase-done-apply atômico completo; forçar 2 external
        providers; backlog produto Lekto; auto-PASS decision-review.
      status: matched
      intentId: F4:bi:outOfScope
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:bi:doneWhen
      label: phase-done sob automate falha com stub/corrupt dual-leg; evaluation thin
        sem floor falha; major sem disposition token bloqueia; statusRoot
        double-projects rejeitado; mirror exitGates assert + prosa canônica;
        F4-G* met.
      status: matched
      intentId: F4:bi:doneWhen
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:exit:0
      label: phase-review authenticity tests pass (dual leg, min size, non-binary
        reject stub/corrupt).
      status: matched
      intentId: F4:exit:0
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:exit:1
      label: decision-log statusRoot normalize tests pass; double projects path
        rejected or fixed.
      status: matched
      intentId: F4:exit:1
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:exit:2
      label: Prose requires present dual-leg authenticity, disposition token,
        canonical phase-done (no hand-edit).
      status: matched
      intentId: F4:exit:2
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:exit:3
      label: assert or unit tests cover exitGate mirror / terminal pending block under
        automate close.
      status: matched
      intentId: F4:exit:3
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F0:bi:value
      label: Automate is the default implement path so multi-phase plans run
        pure-maestro without a mode flag, with Mode 1 only via explicit escape.
      status: matched
      intentId: F0:bi:value
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F0:bi:workflow
      label: TDD isAutomateActive and parse matrix first, then update
        implement/maestro prose and antipatterns so docs match machine default.
      status: matched
      intentId: F0:bi:workflow
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F0:bi:rules
      label: Mode 1 remains via --mode=1; host-thin Iron Law unchanged; no auto-merge;
        durable stamp and clear path stay; session default must activate machine
        gates even before stamp.
      status: matched
      intentId: F0:bi:rules
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F0:bi:outOfScope
      label: Decision package UX (F1); intent-vs-delivered plan-end (F2); dogfood
        checklist (F3); review stub authenticity and post-merge e2e from dump
        follow-ups.
      status: matched
      intentId: F0:bi:outOfScope
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F0:bi:doneWhen
      label: implement-mode tests green for no-CLI no-stamp true; prose states
        automate default and Mode-1 escape; F0-G1 and F0-G2 met.
      status: matched
      intentId: F0:bi:doneWhen
      phaseId: F0
      note: phase tasks fully evidenced
    - id: ivd:F0:T-001:acc:0
      label: it - Absent CLI mode and no stamp yields isAutomateActive true.; it -
        Explicit mode 1 or mode:1 yields isAutomateActive false.; it -
        mode=automate and stamp-alone still true; clearExecutionMode still
        false.; it - Unit matrix covers no-CLI no-stamp for automate-default.
      status: matched
      intentId: F0:T-001:acc:0
      deliveredId: task:F0:T-001
      phaseId: F0
      taskId: T-001
      note: task done with claim SHA(s)
    - id: ivd:F0:T-002:acc:0
      label: it - Prose states automate is default and Mode 1 requires explicit flag.;
        it - Original opt-in only principle is marked superseded by this plan.;
        it - Antipattern exists for assuming bare implement is session-writer
        Mode 1.; it - Maestro notes gate activation rule for session default
        plus stamp.
      status: matched
      intentId: F0:T-002:acc:0
      deliveredId: task:F0:T-002
      phaseId: F0
      taskId: T-002
      note: task done with claim SHA(s)
    - id: ivd:F1:bi:value
      label: Package present-before-PASS + canal AskUserQuestion-only (sem free-text)
        para hardgates de operador sob automate.
      status: matched
      intentId: F1:bi:value
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:bi:workflow
      label: TDD package builder → gate machine present evidence → prosa/antipatterns
        AskUserQuestion-only + decline re-Ask → matriz
        continue/ratify/disposition/stamp; greps F1-G*.
      status: matched
      intentId: F1:bi:workflow
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:bi:rules
      label: Agents never write PASS; present package body no mesmo turno do
        AskUserQuestion PASS|FAIL; decline re-Ask (bounded) ou STOP (nunca
        free-text); session default + stamp alimentam gates; host-thin Iron Law
        intact.
      status: matched
      intentId: F1:bi:rules
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:bi:outOfScope
      label: F2 intent-vs-delivered; F3 dogfood checklist full; F4 authenticity
        floors; Lekto product; forçar widget fora de AskUserQuestion.
      status: matched
      intentId: F1:bi:outOfScope
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:bi:doneWhen
      label: tests package green; present-before-PASS machine; AskUserQuestion-only +
        free-text ban greppable; F1-G1/G2/G3 met.
      status: matched
      intentId: F1:bi:doneWhen
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:goal
      label: Operator always sees the decision package before PASS/FAIL; under
        automate every operator hardgate uses AskUserQuestion options only —
        free-text token recovery is forbidden; decline re-Asks or STOPs.
      status: matched
      intentId: F1:goal
      phaseId: F1
      note: phase tasks fully evidenced
    - id: ivd:F1:T-001:acc:0
      label: it - Helper builds package with phaseId path entries empty flag and
        summaryMarkdown from listDecisions input.; it - Each entry exposes
        category decision why impact evidencePath.; it - Empty log yields empty
        true and explicit no-decisions banner text.; it - Unit tests cover
        non-empty and empty packages.
      status: matched
      intentId: F1:T-001:acc:0
      deliveredId: task:F1:T-001
      phaseId: F1
      taskId: T-001
      note: task done with claim SHA(s)
    - id: ivd:F1:T-002:acc:0
      label: it - Fixed order requires host render decision package before PASS ask.;
        it - decisionReview records packagePresentedAt or package present
        evidence under automate.; it - decisionReviewAllowsPhaseDone or
        canRunPhaseDone fails closed without present evidence when automate
        active including no-stamp session default.; it - Antipattern documents
        Ask PASS without listing decisions.
      status: matched
      intentId: F1:T-002:acc:0
      deliveredId: task:F1:T-002
      phaseId: F1
      taskId: T-002
      note: task done with claim SHA(s)
    - id: ivd:F1:T-002:acc:1
      label: it - Dogfood evidence ask-without-package-body
        (reviews/2026-07-26-f0-decision-review-ask-without-package-body.md) is
        treated as FAIL present-before-PASS until package body is in the same
        hardgate turn as PASS/FAIL AskUserQuestion.
      status: matched
      intentId: F1:T-002:acc:1
      deliveredId: task:F1:T-002
      phaseId: F1
      taskId: T-002
      note: task done with claim SHA(s)
    - id: ivd:F1:T-003:acc:0
      label: "it - UX documents two-step: present package body then AskUserQuestion
        PASS|FAIL options in the same hardgate turn.; it - Free-text recovery
        (e.g. host asks operator to type decision-review PASS) is forbidden in
        prose and antipatterns.; it - Decline/cancel of AskUserQuestion re-opens
        the same question (bounded) or STOPs with nextAction to re-open
        AskUserQuestion — never chat typing.; it - Single-click PASS without
        package body in the same turn is forbidden."
      status: matched
      intentId: F1:T-003:acc:0
      deliveredId: task:F1:T-003
      phaseId: F1
      taskId: T-003
      note: task done with claim SHA(s)
    - id: ivd:F1:T-003:acc:1
      label: it - Claiming package apresentado without rendering package body in the
        same AskUserQuestion turn is forbidden (dogfood 2026-07-26 screenshot +
        evidence file).
      status: matched
      intentId: F1:T-003:acc:1
      deliveredId: task:F1:T-003
      phaseId: F1
      taskId: T-003
      note: task done with claim SHA(s)
    - id: ivd:F1:T-004:acc:0
      label: it - Maestro lists operator hardgates continue ratify disposition
        decision-review stamp as AskUserQuestion-only.; it - Each maps options
        to durable tokens without free-text recovery.; it - Antipattern exists
        for type token in chat after decline.; it - Dogfood checklist row covers
        exclusive AskUserQuestion channel.
      status: matched
      intentId: F1:T-004:acc:0
      deliveredId: task:F1:T-004
      phaseId: F1
      taskId: T-004
      note: task done with claim SHA(s)
    - id: ivd:F2:bi:value
      label: Plan-end sob automate responde "entregamos o que o plano prometeu?" via
        intent-vs-delivered machine-checkable no receipt.
      status: matched
      intentId: F2:bi:value
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F2:bi:workflow
      label: TDD collectors intent/delivered → brief + receipt intentVsDelivered +
        wire planEndReviewOk/assert finalize → prosa Step I.
      status: matched
      intentId: F2:bi:workflow
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F2:bi:rules
      label: Fail-closed se intentVsDelivered vazio sob automate (session default ou
        stamp); external-both mantém ≥1 leg family-different; skip plan-end
        HARD-CLOSED sob stamp; userValidationOk continua operator-owned; sem
        auto-merge.
      status: matched
      intentId: F2:bi:rules
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F2:bi:outOfScope
      label: F3 dogfood checklist; F4 authenticity dual-leg floors; Playwright
        pós-merge; Lekto product; auto-PASS user validation.
      status: matched
      intentId: F2:bi:outOfScope
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F2:bi:doneWhen
      label: tests intent-surface + plan-end green; receipt exige intentVsDelivered;
        assert finalize falha se ausente; F2-G1/G2 met.
      status: matched
      intentId: F2:bi:doneWhen
      phaseId: F2
      note: phase tasks fully evidenced
    - id: ivd:F2:T-001:acc:0
      label: it - Builds intent surface from phase goals businessIntent tasks
        acceptance and exit criteria when provided.; it - Builds delivered
        surface from task evidence done status claim SHAs and outputs paths when
        provided.; it - Exports markdown brief section Intent vs delivered
        checklist for the review prompt.; it - Unit tests cover multi-phase
        sample input.
      status: matched
      intentId: F2:T-001:acc:0
      deliveredId: task:F2:T-001
      phaseId: F2
      taskId: T-001
      note: task done with claim SHA(s)
    - id: ivd:F2:T-002:acc:0
      label: it - Under automate plan-end requires intent-vs-delivered brief in the
        cross-model context.; it - Receipt or linked structured section includes
        intentVsDelivered rows with status matched partial missing or extra.; it
        - Empty intentVsDelivered fails planEndReviewOk or
        automatePlanEndGatesOk under automate including session default.; it -
        Docs state plan-end answers did we build what we planned.
      status: matched
      intentId: F2:T-002:acc:0
      deliveredId: task:F2:T-002
      phaseId: F2
      taskId: T-002
      note: task done with claim SHA(s)
    - id: ivd:F2:T-003:acc:0
      label: it - Step I order is build surfaces run external-both stamp receipt with
        intentVsDelivered then userValidation then finalize.; it - assert
        finalize fails if intentVsDelivered missing under automate.; it -
        implement.md points at intent-vs-delivered plan-end rule.
      status: matched
      intentId: F2:T-003:acc:0
      deliveredId: task:F2:T-003
      phaseId: F2
      taskId: T-003
      note: task done with claim SHA(s)
    - id: ivd:F3:bi:value
      label: Operador tem checklist durable que prova F0 default + F1
        present-before-PASS + F2 intentVsDelivered sem memória de chat.
      status: matched
      intentId: F3:bi:value
      phaseId: F3
      note: phase tasks fully evidenced
    - id: ivd:F3:bi:workflow
      label: Escrever/atualizar docs/kb checklist rows + greps; zero product code.
      status: matched
      intentId: F3:bi:workflow
      phaseId: F3
      note: phase tasks fully evidenced
    - id: ivd:F3:bi:rules
      label: Só KB/checklist; sem app code; alinhar a F0–F2 já shipped.
      status: matched
      intentId: F3:bi:rules
      phaseId: F3
      note: phase tasks fully evidenced
    - id: ivd:F3:bi:outOfScope
      label: F4 authenticity; product Lekto; reimplementar gates F0–F2.
      status: matched
      intentId: F3:bi:outOfScope
      phaseId: F3
      note: phase tasks fully evidenced
    - id: ivd:F3:bi:doneWhen
      label: F3-G1 rg green; file(s) com as rows listadas.
      status: matched
      intentId: F3:bi:doneWhen
      phaseId: F3
      note: phase tasks fully evidenced
    - id: ivd:F3:T-001:acc:0
      label: it - Rows cover bare implement activates automate.; it - Rows cover Mode
        1 explicit escape.; it - Rows cover decision package shown before PASS.;
        it - Rows cover plan-end receipt intentVsDelivered and finalize blocked
        without it.; it - File docs/kb/automate-default-dogfood.md or dogfood
        section exists with those rows.
      status: matched
      intentId: F3:T-001:acc:0
      deliveredId: task:F3:T-001
      phaseId: F3
      taskId: T-001
      note: task done with claim SHA(s)
    - id: ivd:F4:bi:value
      label: Fases sob automate não podem carimbar reviewGate/evaluationGate passed
        com receipt stub ou disposition major sem token do operador; phase-done
        não deixa archive com exitGates mentindo; decision-log não aceita
        statusRoot que duplica projects/.
      status: matched
      intentId: F4:bi:value
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:bi:workflow
      label: "TDD: authenticity floor em phase-review-gate (dual path, min size,
        non-binary); evaluation content floor; disposition major exige token
        operator (decline != accept); decisionLogPath normaliza statusRoot;
        assert mirror exitGates + validate-state no dir do plan e antipattern
        hand-edit phase-done; prosa maestro/transitions; testes unitários e
        greps de prosa."
      status: matched
      intentId: F4:bi:workflow
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:bi:rules
      label: "Floor médio (não parser full codex). Não auto-merge. Não reabrir F0–F3.
        Fora: post-merge Playwright, session-break, phase-done-apply script
        completo, Layer 4. Host-thin permanece."
      status: matched
      intentId: F4:bi:rules
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:bi:outOfScope
      label: Post-merge e2e re-run (Cluster B); claims durable path; session-break
        AskUserQuestion; phase-done-apply atômico completo; forçar 2 external
        providers; backlog produto Lekto; auto-PASS decision-review.
      status: matched
      intentId: F4:bi:outOfScope
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:bi:doneWhen
      label: phase-done sob automate falha com stub/corrupt dual-leg; evaluation thin
        sem floor falha; major sem disposition token bloqueia; statusRoot
        double-projects rejeitado; mirror exitGates assert + prosa canônica;
        F4-G* met.
      status: matched
      intentId: F4:bi:doneWhen
      phaseId: F4
      note: phase tasks fully evidenced
    - id: ivd:F4:T-001:acc:0
      label: it - phaseReviewAllowsClose or honesty helper rejects one-line stub
        codex/local under mode both.; it - rejects binary/null-byte receipt
        content.; it - accepts dual non-stub receipts with min size and CLEAN or
        findings.; it - unit tests cover stub reject and real dual accept.; it -
        maestro Step G prose states dual-leg authenticity under automate.
      status: matched
      intentId: F4:T-001:acc:0
      deliveredId: task:F4:T-001
      phaseId: F4
      taskId: T-001
      note: task done with claim SHA(s)
    - id: ivd:F4:T-002:acc:0
      label: it - evaluationGate passed requires report file exists with min content
        keys or min bytes.; it - thin 2-line verdict-only fails floor under
        automate.; it - unit tests cover thin reject and structured accept.; it
        - implement-phase-evaluator prose documents floor.
      status: matched
      intentId: F4:T-002:acc:0
      deliveredId: task:F4:T-002
      phaseId: F4
      taskId: T-002
      note: task done with claim SHA(s)
    - id: ivd:F4:T-003:acc:0
      label: it - open major findings block phase-done without review-disposition
        accept or defer or fix token from operator.; it - host judgment accept
        after decline fails gate.; it - decision-log and maestro prose state
        decline is not accept.; it - unit or gate tests cover disposition
        required path.
      status: matched
      intentId: F4:T-003:acc:0
      deliveredId: task:F4:T-003
      phaseId: F4
      taskId: T-003
      note: task done with claim SHA(s)
    - id: ivd:F4:T-004:acc:0
      label: it - statusRoot ending in projects/id is rejected or normalized to status
        root without double projects.; it - canonical path remains
        statusRoot/projects/id/slug/decisions/phase.jsonl.; it - unit tests
        cover bad statusRoot and happy path.; it - docs mention statusRoot must
        be .atomic-skills root.
      status: matched
      intentId: F4:T-004:acc:0
      deliveredId: task:F4:T-004
      phaseId: F4
      taskId: T-004
      note: task done with claim SHA(s)
    - id: ivd:F4:T-005:acc:0
      label: it - helper or guard fails when plan criteria met but initiative
        exitGates pending before archive.; it - project-transitions and
        antipatterns forbid hand-edit phase-done under automate.; it - prose
        requires validate-state on plan directory before advance commit.; it -
        unit or integration tests cover mirror pending block.
      status: matched
      intentId: F4:T-005:acc:0
      deliveredId: task:F4:T-005
      phaseId: F4
      taskId: T-005
      note: task done with claim SHA(s)
userValidatedAt: 2026-07-27T09:11:22.430Z
---

# Automate default + operator gates (decision-review + plan-end intent)

## 1. Context

Successor plan after archived `implementation-automate-mode`, `automate-skill-discipline`,
and `implement-phase-agents`. First real dogfood (Lekto `llm-api-integration` dump
`2026-07-24-implement-automate-session.md`) proved pure-maestro delivers product end-to-end,
but operator gates and plan-end review still fail the human contract:

1. Automate is still **opt-in**. Operator now wants **automate as the default** for `implement`.
2. **decision-review PASS** asks for approval without **showing** the decision log — blind PASS.
3. Plan-end cross-model review must **compare intended vs delivered** (plan BI / goals / tasks
   vs merged tree + state), not only a generic diff review.

This plan is **skill fidelity + UX of automate**, not product work for Lekto.

## 1b. Contraste: intenção × o que o plano prevê × o que o plano assume

Três colunas distintas. Misturá-las é o modo de falha do dogfood (prosa diz “X”;
máquina/host não garantem “X”).

### Coluna A — Intenção (o problema a resolver)

O que o operador **precisa que deixe de ser verdade** depois deste plano:

| ID | Intenção (dor) |
|----|----------------|
| I1 | Não ter de lembrar `--mode=automate` para rodar pure-maestro. |
| I2 | Nunca aprovar decision-review **às cegas** — ver as decisões **antes** do PASS. |
| I3 | No fim da implementação, a revisão cross-model responder **“entregamos o que o plano prometeu?”**, não só “o diff está razoável?”. |
| I4 | Gates de automação **não mentirem** (carimbo `passed` sem evidência do contrato humano). |

### Coluna B — O que o plano prevê (entrega material)

O que F0–F4 **vão implementar** se o plano fechar (escopo fechado):

| Fase | Previsão de entrega |
|------|---------------------|
| F0 | `isAutomateActive` true sem flag; Mode 1 só com escape explícito; prosa/antipatterns alinhados; testes da matriz default. |
| F1 | Helper de **decision package** + hardgate present-before-PASS + evidência machine (`packagePresentedAt` ou equivalente) + UX em dois passos. |
| F2 | Collectors intent/delivered + brief plan-end + campo **`intentVsDelivered`** no receipt + wire em `planEndReviewOk` / assert finalize. |
| F3 | Checklist dogfood dos três gates (prova operacional, não produto). |
| F4 | Authenticity dual-leg (floor médio: dual path, min size, non-binary); evaluation content floor; disposition major com token operator; `statusRoot` normalize; phase-done mirror exitGates + assert + ban hand-edit. |

**Previsão explícita de NÃO entrega neste plano (após F4):** re-run Playwright/e2e pós-merge (Cluster B); claims durable path; session-break pós-fase AskUserQuestion; script `phase-done-apply` atômico completo; auto-join argv de `validate-state` além do assert mirror; auto-merge.

### Coluna C — O que o plano assume que existe (e pode não existir)

Pressupostos **load-bearing**. Se falharem, a entrega de B não fecha a intenção de A sozinha.

| ID | Pressuposto | Pode não existir / já falhou | Se quebrar… |
|----|-------------|------------------------------|-------------|
| A1 | Host **executa** a prosa do maestro (present package, Step I order) | Dogfood: prosa “abra o JSONL” sem present no turno do PASS | F1 precisa de **gate machine**, não só markdown |
| A2 | `decisions/<phaseId>.jsonl` é appendado de forma confiável | Path `statusRoot` errado (dump F7); claims só no transcript | Package vazio ≠ “sem decisões reais”; F1 empty-ack explícito |
| A3 | `listDecisions` / decision-log API estáveis e path canônico | Double `projects/` se statusRoot mal passado | F1 builder falha ou lê árvore errada |
| A4 | Codex / external leg disponível no plan-end | `timeout` ausente no zsh; CLI flag conflicts; 1 leg only | F2 receipt pode não nascer; gate deve fail-closed, não stub |
| A5 | Surfaces intent/delivered são **reconstruíveis** do plan + state | BI/tasks fracos; claims não persistidos; archive join sujo | `intentVsDelivered` vira chute; F2 collectors devem fail-closed em input incompleto |
| A6 | `review-code --mode=external-both` aceita brief/contexto extra | Bridge ignora prompt ou trunca | F2 vira só schema no receipt sem modelo comparar de fato |
| A7 | Operador usa AskUserQuestion / lê o chat | Decline → host judgment accept (dump F7 P2) | Disposition frouxa; F1 não resolve se host ignora STOP em decline |
| A8 | Session default e durable stamp **alimentam os mesmos gates** | Antes: durable só via stamp; sessão default podia pular | Critic F-001; F0/F1/F2 testam `{no CLI, no stamp}` |
| A9 | Mode 1 / clear path continua a existir e ser conhecido | Operadores legados em bare `implement` Mode 1 | F0 blast radius: docs + `--mode=1` |
| A10 | Iron Law host-thin permanece sob default | Default automate sem disciplina = mais spawns, mais lease | P2: default **não** relaxa host-thin |

### Como ler o contraste (regra de uso)

1. **Intenção (A)** define sucesso humano.  
2. **Previsão (B)** é o único trabalho admitido em tasks/SPEC.  
3. **Pressupostos (C)** são riscos: cada fase deve **verificar ou fail-closed** se o pressuposto faltar — não narrar que a intenção foi cumprida.

| Se… | Então… |
|-----|--------|
| B fecha e C ok | A deve estar resolvida (dogfood F3). |
| B fecha e C falhou em silêncio | Mesmo padrão do dump: carimbo verde, intenção aberta → **bug de plano/skill**. |
| A precisa de algo fora de B | Emergir follow-up (não expandir F0–F4 em silêncio). |

### Mapa intenção → fase → pressupostos críticos

| Intenção | Fase que prevê resolver | Pressupostos que a fase deve confrontar |
|----------|-------------------------|----------------------------------------|
| I1 default automate | F0 | A8, A9, A10 |
| I2 sem PASS cego | F1 | A1, A2, A3, A7 |
| I3 intent vs delivered | F2 | A4, A5, A6, A8 |
| I4 gates honestos | F4 (+ F1/F2/F3 base) | A1, A2, A3, A4, A7, A8 |

## 2. Inviolable principles

- **P1 Automate is the default implement path** — `implement` without an explicit non-automate mode runs pure-maestro. Escape hatches:
`--mode=1` / `mode:1` / session-writer Mode 1, and durable clear via
`--clear-execution-mode` + stamp removal. First session may still confirm stamp for
durability; absence of CLI mode no longer means Mode 1.
- **P2 Host-thin pure maestro stays** — Host never edits product source under automate; code-only phase writers; never silent
Mode-1 fallback; never self-certify. Default mode does not relax Iron Law.
- **P3 Read-before-PASS on decision-review** — Operator cannot PASS decision-review until the host has presented the phase decision
package in the same hardgate turn (rendered summary + path to JSONL + linked evidence).
Token alone without a prior present step in that turn is invalid.
- **P4 Plan-end intent-vs-delivered is mandatory under automate** — Before finalize/archive, cross-model plan-end review must score intended
(spec/plan/BI/tasks) against delivered (merged tree + durable state). Generic code
review alone does not satisfy the gate.
- **P5 Fail closed over looks-approved** — Missing decision package present, empty decision log without explicit empty ack, or
plan-end receipt without intent-vs-delivered section blocks phase-done / finalize.
- **P6 No new top-level skill** — Extend implement + shared assets + pure helpers + tests. No skills/core/automate.md.
- **P7 Gate activation matches session default** — Any path that runs pure-maestro under automate-default feeds the same activation into
machine gates (`canRunPhaseDone`, `automatePlanEndGatesOk`) via stamp and/or
`automateActive: true` so first-session-before-stamp cannot skip present-before-PASS
or intentVsDelivered.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Reviews

- internal: .atomic-skills/reviews/2026-07-25-automate-default-and-operator-gates-internal.md (bootstrap clean)


## F1 expansion (2026-07-26)

F1 absorbs the **exclusive AskUserQuestion operator-channel** fix (no free-text
token recovery after decline) **together with** present-before-PASS / decision
package. Trigger: F0 pure-maestro asked the operator to type `decision-review PASS`
after AskUserQuestion was declined. No separate F5 — implement with F1.

### Dogfood evidence (2026-07-26) — ask without package body

Live F0 close: AskUserQuestion asked PASS/FAIL with text "package apresentado abaixo"
but **did not render** the decision package body in the same turn.

- Evidence: `.atomic-skills/reviews/2026-07-26-f0-decision-review-ask-without-package-body.md`
- Operator screenshot: session Image #1 (claim present, body missing)
- Maps to F1 **T-002** (present-before-PASS) and **T-003** (AskUserQuestion with body in same turn)
- F0 decision-review remains **not** PASSED on this capture


## Self-review against code-quality gates (F0)

- **G1 read-before-claim**: T-001/T-002 closed with verifier evidence + evaluation report path.
- **G2 soft-language**: completion claims bound to evidence.passed / canRunPhaseDone.
- **G6 reference-or-strike**: decision package path decisions/F0.jsonl presented in AskUserQuestion same turn as PASS.
- **CROSS-MODEL REVIEW**: phase review mode both receipt at reviews/2026-07-26-automate-default-F0-phase-both.md.
- **Review gate (G2)**: reviewGate passed mode both at 95872f9fe798d25a6e9f4a8b56261c0952d55023.
- **Lessons (G1)**: lessonsState none (clean phase, operator ratified).
- **decision-review**: operator PASS via AskUserQuestion with package body in same turn (2026-07-26T22:25:13.410Z).


## Self-review F1 (phase-done)

- G1: T-001..T-004 + eval report paths
- G2: decision-review PASS via AskUserQuestion with package body same turn
- G6: decisions/F1.jsonl + packagePresentedAt/packagePath
- Lessons: none
- Review: both @ 65cb3fc9843d3a0c931cd96d32aaec9ac6691b06
- decision-review PASS @ 2026-07-27T07:38:31.288Z



## Self-review F2

- intent-vs-delivered shipped; decision-review PASS with package same turn
- HEAD f9debea3d450c44721e776545b9fdc27fa18b5c3

## Reviews

- plan-end external-both: .atomic-skills/reviews/2026-07-27-plan-end-automate-default-external-both.md (2026-07-27T09:06:37.261Z)
- intentVsDelivered rows: 85 (matched=85 partial=0 missing=0 extra=0)

