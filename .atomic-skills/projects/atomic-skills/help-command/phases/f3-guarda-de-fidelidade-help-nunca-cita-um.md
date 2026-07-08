---
schemaVersion: "0.1"
slug: help-command-f3-guarda-de-fidelidade-help-nunca-cita-um
title: Guarda de fidelidade (help nunca cita um verbo que não existe)
goal: Um teste garante que todo comando do domínio de saída existe no catálogo E
  respeita a signature declarada; fechar o cross-link das 3 camadas (HTML e
  terminal).
status: active
branch: develop
started: 2026-07-08T01:40:29Z
lastUpdated: 2026-07-08T01:40:29Z
nextAction: Rode `done T-001` depois de adicionar a cobertura help-vocab e a
  asserção de dispatch em project.test.
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
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 5
exitGates:
  - id: G-1
    description: suíte cheia verde (npm test)
    status: pending
    verifier:
      kind: shell
      command: npm test
    verifierLabel: "shell: npm test"
  - id: G-2
    description: help-vocab.test.js passa
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/help-vocab.test.js
    verifierLabel: "test: node --test tests/help/help-vocab.test.js"
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
    status: pending
    lastUpdated: 2026-07-08T01:40:29Z
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
  - id: T-002
    title: — Cross-link do HTML
    description: No rodapé "Estou perdido" do brief/HTML e no
      docs/skills/project.md, apontar help como o GPS de terminal. Fecha o loop
      das 3 camadas.
    status: pending
    lastUpdated: 2026-07-08T01:40:29Z
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
parked: []
emerged: []
startedCommit: 61349088f34701cfe7781c41097434cb89247c16
planTitle: Comando `help` — GPS de terminal da skill `project`
planActive: true
current: true
---


# Narrative / notes

Initiative for phase **F3 — Guarda de fidelidade (help nunca cita um verbo que não existe)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff

- **Narrative:** F3 ativada a partir do phase-done da F2; a fase fecha a fidelidade do comando `help` com guardas de vocabulário, catálogo, dispatch e cross-link docs/HTML.
- **Decision log:** F0/L-002 aplicada em T-001; F2/L-001 mantida aberta porque F3 não adiciona novo CTA por caminho fixo.
- **Single nextAction:** Rode `done T-001` depois de adicionar a cobertura help-vocab e a asserção de dispatch em project.test.
- **Verbatim state:** `.atomic-skills/projects/atomic-skills/help-command/phases/f3-guarda-de-fidelidade-help-nunca-cita-um.md`; `tests/help/help-vocab.test.js`; `tests/project.test.js`.
- **Uncommitted changes:** commit da transição phase-done pendente.
