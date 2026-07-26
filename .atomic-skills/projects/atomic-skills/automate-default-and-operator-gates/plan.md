---
schemaVersion: "0.1"
slug: automate-default-and-operator-gates
title: Automate default + operator gates (decision-review + plan-end intent)
version: "1.0"
status: active
started: 2026-07-25T22:39:25.331Z
lastUpdated: 2026-07-26T22:47:22.480Z
branch: plan/automate-default-and-operator-gates
currentPhase: F1
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
          metAt: 2026-07-26T22:46:27.662Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-26T22:46:27.662Z
            verifiedCommit: 8879297ae66517a51f9c5af952b67aed95b8ddb3
            passed: true
            exitCode: 0
            outputSummary: F1-G1 green after F1 merge re-verify
        - id: F1-G2
          description: Present-before-PASS + package evidence mandated in prose/gates.
          status: met
          verifier:
            kind: shell
            command: rg -n 'read-before-PASS|packagePresented|decision package'
              skills/shared/implement-decision-log.md
              skills/shared/implement-automate-maestro.md
            expectExitCode: 0
          metAt: 2026-07-26T22:46:27.662Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-26T22:46:27.662Z
            verifiedCommit: 8879297ae66517a51f9c5af952b67aed95b8ddb3
            passed: true
            exitCode: 0
            outputSummary: F1-G2 green after F1 merge re-verify
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
          metAt: 2026-07-26T22:46:27.662Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-26T22:46:27.662Z
            verifiedCommit: 8879297ae66517a51f9c5af952b67aed95b8ddb3
            passed: true
            exitCode: 0
            outputSummary: F1-G3 green after F1 merge re-verify
    status: active
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
      verifiedAt: 2026-07-26T22:47:22.480Z
      at: 001b1caf08ef01b1a3e9bc721ffde61b0d6310be
    lessonsState: none
    noneReason: clean phase — no failure signals
    reviewGate:
      status: passed
      mode: both
      at: 001b1caf08ef01b1a3e9bc721ffde61b0d6310be
      reviewFile: .atomic-skills/reviews/2026-07-26-automate-default-F1-phase-both.md
      verifiedAt: 2026-07-26T22:47:22.480Z
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
          status: pending
          verifier:
            kind: shell
            command: node --test tests/plan-end-intent-surface.test.js
              tests/plan-end-review.test.js
            expectExitCode: 0
        - id: F2-G2
          description: Maestro Step I requires intent-vs-delivered under automate.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'intent-vs-delivered|intentVsDelivered'
              skills/shared/implement-automate-maestro.md src/plan-end-review.js
            expectExitCode: 0
    status: pending
    summary: Review plan-end intent vs delivered com campo no receipt.
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
          status: pending
          verifier:
            kind: shell
            command: rg -n 'read-before-PASS|intentVsDelivered|default' docs/kb/
            expectExitCode: 0
    status: pending
    summary: Checklist dogfood dos três gates.
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
          status: pending
          verifier:
            kind: shell
            command: node --test tests/phase-review-gate.test.js && rg -n
              'authenticity|dual-leg|stub|non-binary' src/phase-review-gate.js
              skills/shared/implement-automate-maestro.md
            expectExitCode: 0
        - id: F4-G2
          description: decision-log statusRoot normalize tests pass; double projects path
            rejected or fixed.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/decision-log.test.js
            expectExitCode: 0
        - id: F4-G3
          description: Prose requires present dual-leg authenticity, disposition token,
            canonical phase-done (no hand-edit).
          status: pending
          verifier:
            kind: shell
            command: rg -n
              'authenticity|dual-leg|non-binary|disposition|statusRoot|hand-edit|mirror'
              skills/shared/implement-automate-maestro.md
              skills/shared/implement-antipatterns.md
              skills/shared/project-assets/project-transitions.md
              src/phase-review-gate.js src/decision-log.js
            expectExitCode: 0
        - id: F4-G4
          description: assert or unit tests cover exitGate mirror / terminal pending block
            under automate close.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/lifecycle-order-guard.test.js && rg -n
              'mirror|exitGate|hand-edit|terminal-pending' src/
              skills/shared/project-assets/project-transitions.md
              skills/shared/implement-antipatterns.md
            expectExitCode: 0
    status: pending
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
references: []
planActive: true
planTitle: Automate default + operator gates (decision-review + plan-end intent)
executionMode: automate
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


