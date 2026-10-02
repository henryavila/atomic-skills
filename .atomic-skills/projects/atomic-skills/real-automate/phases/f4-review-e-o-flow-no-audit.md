---
schemaVersion: "0.1"
slug: real-automate-f4-review-e-o-flow-no-audit
title: Review e o flow no audit
goal: o programa conduz cada fase até a seguinte. Antes da primeira fase
  pergunta uma vez o CLI externo e grava `reviewExternalCli` no plano. Both é a
  review local mais esse CLI. No meio da corrida ninguém pergunta de novo. A
  unidade é a fase corrente. Um agente isolado implementa todas as tasks
  `pending`, na ordem do frontmatter. Outro agente isolado roda a review both.
  Critical ou major manda um agente isolado corrigir e a review volta. São 3
  reviews. Sem critical e sem major, os findings restantes ficam em
  `.atomic-skills/status/automate/<slug>.json` para o relatório final, a fase
  fecha e a seguinte abre, sempre em agente isolado. Na terceira review,
  critical ou major abre travei e não avança. A linha `- internal:` não
  substitui o recibo. Saída sem veredito não conta. Exit diferente de 0 guarda o
  stderr real. O brief leva o grafo e o esboço escolhido. Task complexa entra
  nessa mesma review, antes de fechar a fase. O audit lê `flow/flow.json` no
  `ratifiedGraphSha` e cobra cada máquina e cada xor, com linha faz, pela metade
  ou não faz. A página final não substitui esse gate. Achado de mistura do bloco
  não entra no loop. O gate que hoje fecha a fase é
  `src/phase-delivery-audit-gate.js` e não lê `flow.json`. F4 estende esse gate.
  A skill `audit-delivery` também não lê o grafo hoje. Fechar a fase valida o
  claim e passa em `src/automate-product-fence.js`.
status: active
branch: plan/real-automate
started: 2026-10-02T16:41:53.105Z
lastUpdated: 2026-10-02T17:00:23.068Z
nextAction: Run `phase-done` after evaluation, lessons, review both,
  decision-review, and audit-delivery.
parentPlan: real-automate
phaseId: F4
businessIntent:
  value: O programa conduz cada fase até a seguinte. Uma pergunta no começo grava
    `reviewExternalCli`. Both é a review local mais esse CLI, com recibo real
    (comando, exit, stderr, veredito). O audit lê `flow/flow.json` no
    `ratifiedGraphSha` e cobra cada máquina e cada xor. Sem critical/major a
    fase fecha (claim + `automate-product-fence.js`) e a seguinte abre; na
    terceira review, critical ou major para.
  workflow: Antes da primeira fase `automate-run.js` pergunta o CLI externo uma
    vez e grava `reviewExternalCli` no plano e no schema. Dispara o CLI, espera
    o processo, grava o recibo. `src/phase-review-gate.js` recusa
    `overrideReason` sem stderr desse processo e recusa recibo escrito pela
    sessão. Um agente isolado implementa as tasks `pending` na ordem do
    frontmatter; outro roda both. Critical ou major dispara correção isolada e a
    review volta, teto 3. Sem critical/major os findings restantes vão para
    `.atomic-skills/status/automate/<slug>.json`.
    `src/phase-delivery-audit-gate.js` passa a ler o grafo; fechar a fase valida
    o claim e passa em `src/automate-product-fence.js`.
  rules: No meio da corrida ninguém pergunta de novo o CLI. A linha `- internal:`
    não substitui o recibo. Saída sem veredito não conta. Exit diferente de 0
    guarda o stderr real. O brief leva o grafo e o esboço escolhido. Task
    complexa entra nesta mesma review, antes de fechar. Achado de mistura do
    bloco não entra no loop e para na hora. Onde `businessIntent` e o grafo
    discordam, vale o grafo. A página final não substitui este gate.
  outOfScope: Página final, botão `userValidatedAt`, PR e archive (F5). Não reabre
    o marco F3 de um writer/merge. Não chama `scripts/automate-phase-run.js` no
    lugar de `scripts/automate-run.js`. Fila, vários hosts e spawn adapter
    multi-máquina (P9).
  doneWhen: "`node --test tests/phase-review-gate.test.js` recusa `overrideReason`
    sem stderr do CLI externo e recusa recibo escrito pela sessão. Um fixture de
    `flow.json` com um xor sem linha no relatório de audit falha. Um achado de
    mistura do bloco não entra no loop e para na hora. Sem critical e sem major
    a fase fecha e a seguinte abre; na terceira, critical ou major para."
tasksDone: 3
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-1
    description: "`node --test tests/phase-review-gate.test.js` recusa
      overrideReason sem stderr do comando externo e recusa um recibo escrito
      pela sessão. Um fixture de flow.json com um xor sem linha no relatório de
      audit falha. Um achado de mistura do bloco não entra no loop e para na
      hora."
    status: pending
    verifier:
      kind: shell
      command: node --test tests/phase-review-gate.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/phase-review-gate.test.js"
stack:
  - id: 1
    title: Review e o flow no audit
    type: task
    openedAt: 2026-10-02T16:41:53.105Z
tasks:
  - id: T-001
    title: Both com falha real
    description: "Antes da primeira fase o programa grava `reviewExternalCli` e não
      pergunta de novo. Both é a review local mais esse CLI. Dispara o CLI,
      espera e grava o recibo com comando, exit, stderr e veredito.
      `overrideReason` sem stderr desse processo não passa. Recibo escrito pela
      sessão não passa. O brief leva o grafo e o esboço escolhido. Task complexa
      entra nesta review, antes de fechar a fase. Verifier: `node --test
      tests/phase-review-gate.test.js` cobrindo esses casos."
    status: done
    lastUpdated: 2026-10-02T17:00:23.068Z
    scopeBoundary:
      - Do not ask for the external CLI again mid-run.
      - Do not accept a session-written `- internal:` line as the external
        receipt.
      - Do not implement F5 page, button, PR, or archive.
    acceptance:
      - it - reviewExternalCli is stored on the plan before the first phase and
        is not asked again.
      - it - overrideReason without stderr of that external CLI process fails.
      - it - a receipt written by the session fails.
      - it - receipt records command, exit, stderr, and verdict.
    verifier:
      kind: shell
      command: node --test tests/phase-review-gate.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/automate-run.js
      - kind: file
        path: src/phase-review-gate.js
      - kind: file
        path: tests/phase-review-gate.test.js
      - kind: file
        path: meta/schemas/plan.schema.json
    summary: Grava reviewExternalCli, dispara o CLI externo, recusa overrideReason
      sem stderr e recibo de sessão.
    weight: 1
    closedAt: 2026-10-02T17:00:23.068Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-10-02T17:00:23.068Z
      verifiedCommit: b2b507549365f9295822649a4e1216e506074d40
      passed: true
      exitCode: 0
      outputSummary: "node --test tests/phase-review-gate.test.js: ℹ tests 44 ℹ pass
        44 ℹ fail 0"
  - id: T-002
    title: Audit lê o grafo
    description: "`audit-delivery` recusa sha divergente e emite uma linha por
      máquina e por xor. Onde o `businessIntent` discorda, vale o grafo. Esta
      task estende `src/phase-delivery-audit-gate.js`, que hoje não lê
      `flow.json`. A skill também não lê o grafo hoje. Verifier: fixture de flow
      com um xor e relatório sem a linha sai falho."
    status: done
    lastUpdated: 2026-10-02T17:00:23.068Z
    scopeBoundary:
      - Do not treat the final page as this audit gate.
      - Do not skip reading flow/flow.json at ratifiedGraphSha.
      - Do not implement F5 page, button, PR, or archive.
    acceptance:
      - it - audit-delivery refuses a divergent ratifiedGraphSha.
      - it - a flow.json fixture with one xor and a report missing that line
        fails.
      - it - where businessIntent disagrees with the graph, the graph wins.
    verifier:
      kind: shell
      command: node --test tests/phase-delivery-audit-gate.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/phase-delivery-audit-gate.js
      - kind: file
        path: tests/phase-delivery-audit-gate.test.js
      - kind: file
        path: skills/core/audit-delivery.md
    summary: Audit lê flow/flow.json no ratifiedGraphSha; xor sem linha no relatório
      falha.
    weight: 1
    closedAt: 2026-10-02T17:00:23.068Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-10-02T17:00:23.068Z
      verifiedCommit: b2b507549365f9295822649a4e1216e506074d40
      passed: true
      exitCode: 0
      outputSummary: "node --test tests/phase-delivery-audit-gate.test.js: ℹ tests 44
        ℹ pass 44 ℹ fail 0"
  - id: T-003
    title: Loop com teto
    description: "Critical ou major corrige num agente isolado e a review volta. O
      teto é 3 reviews. Sem critical e sem major, os findings restantes vão para
      `.atomic-skills/status/automate/<slug>.json`, a fase fecha e a seguinte
      abre. Na terceira, critical ou major abre travei. Mistura do bloco
      carimbado para na hora e não entra no loop. Verifier: teste do contador no
      programa."
    status: done
    lastUpdated: 2026-10-02T17:00:23.068Z
    scopeBoundary:
      - Do not advance after a third review that still has critical or major.
      - Do not put a mix finding of the stamped block into the review loop.
      - Do not implement F5 page, button, PR, or archive.
    acceptance:
      - it - critical or major dispatches an isolated fix agent and review
        returns, cap 3.
      - it - without critical or major, remaining findings go to
        status/automate/<slug>.json, the phase closes, and the next opens.
      - it - on the third review, critical or major stops.
      - it - a mix finding of the stamped block stops immediately and does not
        enter the loop.
      - it - phase close validates the claim and passes
        src/automate-product-fence.js.
    verifier:
      kind: shell
      command: node --test tests/phase-review-gate.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/automate-run.js
      - kind: file
        path: src/automate-product-fence.js
      - kind: file
        path: tests/automate-product-fence.test.js
      - kind: file
        path: tests/phase-review-gate.test.js
    summary: Loop de 3 reviews com teto; mistura para na hora; claim e product fence
      no close.
    weight: 1
    closedAt: 2026-10-02T17:00:23.068Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-10-02T17:00:23.068Z
      verifiedCommit: b2b507549365f9295822649a4e1216e506074d40
      passed: true
      exitCode: 0
      outputSummary: "node --test tests/phase-review-gate.test.js: ℹ tests 44 ℹ pass
        44 ℹ fail 0; tests/automate-product-fence.test.js: ℹ tests 12 ℹ pass 12
        ℹ fail 0"
parked: []
emerged: []
startedCommit: a011a538572eed002e6c90dba116562f6ee2d392
planTitle: real-automate
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F4 — Review e o flow no audit**.

Lessons applied at start: L-F2-1 (cited path must fail closed), L-F2-2 (size-cap; do not inflate parser).

## Session handoff
- **Narrative:** F4 writer merged on plan/real-automate. T-001–T-003 closed through post-merge verifiers (review 44/44, audit 44/44, fence 12/12). Keep-green writer 22/22 and pen 34/34. Cursor step E.
- **Decision log:** operator-continue F3→F4. Ratify F4 + apply L-F2-1/L-F2-2. Writer claimed-pass exclusive SHAs 3974ee76, 3df2f38f, 8aa3017a.
- **Single nextAction:** Spawn evaluation agent for F4 (Step F), then lessons/review/decision-review/audit-delivery before phase-done.
- **Verbatim state:** HEAD `b2b507549365f9295822649a4e1216e506074d40`; verifiers `node --test tests/phase-review-gate.test.js` 44/44, `node --test tests/phase-delivery-audit-gate.test.js` 44/44, `node --test tests/automate-product-fence.test.js` 12/12.
- **Uncommitted changes:** this done checkpoint (initiative + completions + cursor).

