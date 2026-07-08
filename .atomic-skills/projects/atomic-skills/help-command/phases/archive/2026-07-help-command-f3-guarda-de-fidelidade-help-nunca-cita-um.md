---
schemaVersion: "0.1"
slug: help-command-f3-guarda-de-fidelidade-help-nunca-cita-um
title: Guarda de fidelidade (help nunca cita um verbo que não existe)
goal: Um teste garante que todo comando do domínio de saída existe no catálogo E
  respeita a signature declarada; fechar o cross-link das 3 camadas (HTML e
  terminal).
status: done
branch: develop
started: 2026-07-08T01:40:29Z
lastUpdated: 2026-07-08T12:06:00Z
nextAction: null
parentPlan: help-command
phaseId: F3
businessIntent:
  value: "Fecha a fidelidade do GPS de terminal: o help passa a ter guardas
    persistentes que impedem comandos inexistentes ou assinaturas divergentes
    entre helper, catálogo, docs e guia visual. Para o usuário, reduz regressão
    silenciosa no comando exato de retomada."
  workflow: "Manutenção e retomada de projeto: antes de encerrar o plano
    help-command, a suíte valida que os comandos que o terminal/HTML/docs citam
    existem no catálogo e continuam roteando para o asset correto."
  rules: Read-only e zero-mutação continuam valendo para help; todo
    nextStep.command persistido ou fallback deve apontar para subcomando real em
    meta/catalog.yaml e casar a signature declarada; aplica F0/L-002 com
    asserção persistente para help/help --html/next -> project-help.md; F2/L-001
    permanece aberta para futuras fases que habilitem UI/CTA por caminho fixo.
  outOfScope: Não redesenha o render do help, não troca o mecanismo de abertura
    HTML, não muda aiDeck e não gera novo guia visual.
  doneWhen: help-vocab.test.js passa, npm test passa e os cross-links de docs/HTML
    citam project help como resposta operacional para onde estou.
  derived:
    - question: Como F0/L-002 altera a F3?
      answer: "F0/L-002 foi aplicada em T-001: além do help-vocab, a fase deve travar
        em tests/project.test.js a dispatch-row help/help --html/next ->
        project-help.md."
    - question: Como F2/L-001 foi dispositionada na F3?
      answer: "Keep: F3 não habilita novo CTA por caminho fixo; a lesson segue aberta
        para futuras fases que adicionem recursos por path fixo."
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
weightDone: 5
weightTotal: 5
exitGates:
  - id: G-1
    description: suíte cheia verde (npm test)
    status: met
    verifier:
      kind: shell
      command: npm test
    metAt: 2026-07-08T12:06:00Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-08T12:06:00Z
      exitCode: 0
      passed: true
      outputSummary: npm test -> tests 1610, pass 1608, fail 0, skipped 2
    verifierLabel: "shell: npm test"
    evidenceSummary: passed · 2026-07-08
  - id: G-2
    description: help-vocab.test.js passa
    status: met
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/help-vocab.test.js
    metAt: 2026-07-08T12:06:00Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-08T12:06:00Z
      exitCode: 0
      testsCollected: 4
      passed: true
      outputSummary: node --test tests/help/help-vocab.test.js -> tests 4, pass 4, fail 0
    verifierLabel: "test: node --test tests/help/help-vocab.test.js"
    evidenceSummary: passed · 4 tests · 2026-07-08
stack:
  - id: 1
    title: Guarda de fidelidade (help nunca cita um verbo que não existe)
    type: task
    openedAt: 2026-07-08T01:40:29Z
tasks:
  - id: T-001
    title: — Teste help-command subconjunto do catalog + forma válida
    description: "Todo nextStep.command do domínio de saída (persistido OU fallback)
      tem que ter como verbo um subcomando real em meta/catalog.yaml E casar a
      signature declarada daquele subcomando. finalize sem-arg é válido;
      materialize exige phase resolvido; um comando com placeholder
      não-resolvido falha. Aplica F0/L-002: adicionar em tests/project.test.js
      uma asserção persistente para help/help --html/next -> project-help.md,
      além do domínio de saída em tests/help/help-vocab.test.js."
    status: done
    lastUpdated: 2026-07-08T02:03:14.546Z
    scopeBoundary:
      - só o teste de vocabulário; não altera o helper nem o catálogo.
    acceptance:
      - cada comando do domínio de saída existe no catálogo E respeita a
        signature; um placeholder não-resolvido ou um verbo removido do catálogo
        quebra o teste.
      - tests/project.test.js trava help/help --html/next -> project-help.md;
        remover o alias next ou trocar o asset quebra teste persistente.
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/help-vocab.test.js
    outputs:
      - kind: file
        path: tests/help/help-vocab.test.js
      - kind: file
        path: tests/project.test.js
    summary: Cria guarda de vocabulário para comandos emitidos pelo help e trava a
      dispatch-row help/help --html/next -> project-help.md em teste
      persistente.
    weight: 3
    closedAt: 2026-07-08T02:03:14.546Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-08T02:03:14.546Z
      exitCode: 0
      testsCollected: 4
      passed: true
      outputSummary: node --test tests/help/help-vocab.test.js -> tests 4, pass 4, fail 0
  - id: T-002
    title: — Cross-link do HTML
    description: No rodapé "Estou perdido" do brief/HTML e no
      docs/skills/project.md, apontar help como o GPS de terminal. Fecha o loop
      das 3 camadas.
    status: done
    lastUpdated: 2026-07-08T02:09:20.860Z
    scopeBoundary:
      - só as linhas de cross-link nos dois docs; nenhuma mudança de código.
    acceptance:
      - ambos citam project help como a resposta a "onde estou".
    verifier:
      kind: shell
      command: grep -q 'project help'
        docs/design/project-onboarding/html-design-brief.md
    outputs:
      - kind: file
        path: docs/design/project-onboarding/html-design-brief.md
      - kind: file
        path: docs/skills/project.md
    summary: Atualiza docs/HTML para apontarem project help como GPS de terminal no
      fluxo estou perdido.
    weight: 2
    closedAt: 2026-07-08T02:09:20.860Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-08T02:09:20.860Z
      exitCode: 0
      passed: true
      outputSummary: grep -q 'project help'
        docs/design/project-onboarding/html-design-brief.md -> match (exit 0)
parked: []
emerged: []
startedCommit: 61349088f34701cfe7781c41097434cb89247c16
planTitle: Comando `help` — GPS de terminal da skill `project`
---


# Narrative / notes

Initiative for phase **F3 — Guarda de fidelidade (help nunca cita um verbo que não existe)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff

- **Narrative:** F3 está ativa em `develop`; T-001 e T-002 estão fechadas com evidência `passed: true`. A fase não tem tasks abertas e está no boundary de `phase-done`.
- **Decision log:** T-001 foi executada via Mode 2 na worktree `/Volumes/External/code/atomic-skills-help-command-t001` e mesclada pelo commit `28f7a2e feat(T-001): add help command vocabulary guard`; T-002 foi executada via Mode 2 na worktree `/Volumes/External/code/atomic-skills-help-command-t002` e mesclada pelo commit `8911014 docs(T-002): cross-link project help`. `.atomic-skills/status/dispatch-log.json` não foi editado nesta fase porque o arquivo existente está em formato misto e o consumidor atual `scripts/append-completion.js` declara JSON array.
- **Single nextAction:** Rode `phase-done`.
- **Verbatim state:** `rtk node --test tests/help/help-vocab.test.js` -> `tests 4`, `pass 4`, `fail 0`; `rtk node --test tests/project.test.js` -> `tests 51`, `pass 51`, `fail 0`; `rtk grep -q 'project help' docs/design/project-onboarding/html-design-brief.md` -> match, exit 0; `rtk grep -q 'project help' docs/skills/project.md` -> match, exit 0; `.atomic-skills/projects/atomic-skills/help-command/phases/f3-guarda-de-fidelidade-help-nunca-cita-um.md`; `.atomic-skills/analytics/completions.jsonl`; `docs/design/project-onboarding/html-design-brief.md`; `docs/skills/project.md`.
- **Uncommitted changes:** clean tree.

## Self-review against code-quality gates

- **G1 read-before-claim**: 2 tasks closed, each with source outputs in `tasks[].outputs`; review re-read changed source lines before stamping the gate.
- **G2 soft-language**: scanned `nextAction`, task descriptions, criterion descriptions, review notes, and the phase close text; 0 violations requiring rewrite.
- **G6 reference-or-strike**: 2 exit criteria, 2 met with `evidence:` populated, 0 deferred, 0 unverified.
- **G10 gate-must-be-able-to-fail**: both criteria fail concretely on non-zero shell/test exit; `tests/help/help-vocab.test.js` also rejects unresolved placeholders. Criteria without a stateable failure: none.
- **Codex review**: non-destructive phase diff selected local `review-code` mode; local inline review at HEAD = `58357c52831158668fd3cc8854f50d34af2c78ba`, verdict `clean after fix`, counts before fix `blocker:0 critical:0 major:1 minor:0`, after fix `blocker:0 critical:0 major:0 minor:0`, file `.atomic-skills/reviews/2026-07-08-1146-help-command-f3-local.md`. Isolation degraded because subagent spawning is not permitted by this session's tool policy.
- **Review gate (G2)**: recorded on the phase descriptor as `reviewGate: { status: passed, at: 58357c52831158668fd3cc8854f50d34af2c78ba, mode: local, reviewFile: .atomic-skills/reviews/2026-07-08-1146-help-command-f3-local.md }`.
- **Lessons (G1)**: distilled 1 lesson into `lessons/help-command-f3-guarda-de-fidelidade-help-nunca-cita-um.md` (1 reusable, 0 local), ratified by the user.
