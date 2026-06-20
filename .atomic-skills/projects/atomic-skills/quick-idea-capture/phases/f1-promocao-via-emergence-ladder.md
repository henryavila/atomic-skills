---
schemaVersion: "0.1"
slug: quick-idea-capture-f1-promocao-via-emergence-ladder
title: Promoção via emergence ladder
goal: Adicionar o verbo idea promote que extrai uma ideia do inbox, roteia pela
  emergence ladder com ratify e marca a ideia como triaged, sem reinventar
  classificação.
status: done
branch: null
started: 2026-06-09T18:41:40.321Z
lastUpdated: 2026-06-09T21:35:00Z
nextAction: F1 fechada (2/2 tasks, 2/2 gates met). Plano completo — arquivar via
  `archive` quando o usuário decidir.
parentPlan: quick-idea-capture
phaseId: F1
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: F1-G1
    description: Promoção converte uma ideia em task ou iniciativa via ladder e
      marca a ideia triaged; a suíte de idea-mark passa.
    status: met
    metAt: 2026-06-09T21:35:00Z
    verifier:
      kind: shell
      command: node --test tests/idea-mark.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-09T21:35:00Z
      passed: true
      exitCode: 0
      outputSummary: "Final tree: tests 5, pass 5, fail 0."
    verifierLabel: "shell: node --test tests/idea-mark.test.js"
    evidenceSummary: passed · 2026-06-09
  - id: F1-G2
    description: idea promote extrai a ideia do inbox, roteia pela emergence ladder
      com ratify e materializa/encaminha a task ou iniciativa; fixture prova
      extração e handoff.
    status: met
    metAt: 2026-06-09T21:35:00Z
    verifier:
      kind: shell
      command: node --test tests/idea-promote.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-09T21:35:00Z
      passed: true
      exitCode: 0
      outputSummary: "Final tree: tests 3, pass 3, fail 0 (extração estruturada,
        handoff confinado à meta line, CLI round-trip)."
    verifierLabel: "shell: node --test tests/idea-promote.test.js"
    evidenceSummary: passed · 2026-06-09
stack:
  - id: 1
    title: Promoção via emergence ladder
    type: task
    openedAt: 2026-06-09T18:41:40.321Z
tasks:
  - id: T-001
    title: idea promote — procedimento mais wiring
    status: done
    lastUpdated: 2026-06-09T21:05:00Z
    closedAt: 2026-06-09T21:05:00Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-09T21:05:00Z
      passed: true
      exitCode: 0
      outputSummary: "Re-run on MERGED primary: validate-skills ✓ 14 skills;
        compatibility tests 84, pass 84, fail 0; ambos os greps de 'idea
        promote' exit 0. Executor: codex lane, worktree impl/qic-f1-t-001."
    summary: Documenta e liga idea promote, roteando pela emergence ladder.
    scopeBoundary:
      - skills/shared/project-assets/project-idea.md
      - skills/core/project.md
    acceptance:
      - "project-idea.md ganha a seção `idea promote <n>`: extração
        determinística via `node scripts/idea-mark.js --id <n> --extract`
        (JSON), roteamento pela emergence ladder de
        {{ASSETS_PATH}}/project-emergence.md com Proposed-mutation block +
        ratify (Drafted context seedado do corpo/scope/context da ideia), e só
        após a mutação aplicada: `node scripts/idea-mark.js --id <n> --dest
        <target-id>`"
      - A ideia nunca é deletada do ideas.md (audit trail); promote sobre ideia
        já triaged falha com a mensagem do script; promote nunca acontece dentro
        da captura
      - "skills/core/project.md: grammar ganha `idea promote <n>` e a dispatch
        row de idea passa a `idea`, `idea list`, `idea promote` → {{READ_TOOL}}
        {{ASSETS_PATH}}/project-idea.md"
      - Sem nomes de ferramenta hardcoded, sem $ARGUMENTS, sem
        host-orchestration tools fora de {{#if ide.claude-code}}
    verifier:
      kind: shell
      command: npm run validate-skills && node --test tests/compatibility.test.js &&
        grep -q 'idea promote' skills/core/project.md && grep -q 'idea promote'
        skills/shared/project-assets/project-idea.md
      expectExitCode: 0
  - id: T-002
    title: idea-mark.js — transição de status para triaged
    status: done
    lastUpdated: 2026-06-09T21:30:00Z
    closedAt: 2026-06-09T21:30:00Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-09T21:30:00Z
      passed: true
      exitCode: 0
      outputSummary: "Re-run on MERGED primary: idea-mark.test.js tests 5, pass 5,
        fail 0; idea-promote.test.js tests 3, pass 3, fail 0. Executor: codex
        lane, worktree impl/qic-f1-t-002 (self-check também verde)."
    summary: Script que marca a ideia como triaged sem mexer no resto do ideas.md.
    scopeBoundary:
      - scripts/idea-mark.js
      - tests/idea-mark.test.js
      - tests/idea-promote.test.js
    acceptance:
      - "Cria scripts/idea-mark.js (ESM, mesmas convenções do idea-add.js): CLI
        `node scripts/idea-mark.js [<root>] --id <n> (--dest <target> |
        --extract) [--project-id <id>]`; mesma resolução de path do idea-add.js;
        exporta extractIdea(root, n, opts) e markTriaged(root, n, dest, opts)"
      - "--extract imprime JSON {id, title, date, branch, status, scope?,
        context?, desc} sem mutação; --dest reescreve SOMENTE a meta line do
        registro #n: status:pending → status:triaged→<target>, byte-preservando
        todo o resto do arquivo"
      - "Erros claros exit 1: id inexistente; registro malformado (sem meta
        line) em qualquer operação; mark sobre ideia já triaged ('already
        triaged→X'); ids duplicados (edição manual) → opera na PRIMEIRA
        ocorrência com warning não-fatal em stderr (§5 do plan.md)"
      - "tests/idea-mark.test.js: transição pending→triaged, erro re-mark,
        warning duplicata, erro malformado, byte-preservation dos outros
        registros"
      - "tests/idea-promote.test.js (fixture de extração+handoff): seed com 2+
        ideias (uma com scope/context) → extract retorna campos estruturados →
        mark --dest T-005 flipa só a meta line do #n; diff do arquivo restrito
        àquela linha"
    verifier:
      kind: shell
      command: node --test tests/idea-mark.test.js && node --test
        tests/idea-promote.test.js
      expectExitCode: 0
parked: []
emerged: []
summary: "O verbo idea promote: extrai a ideia e roteia pela emergence ladder
  com ratify, marcando-a como triaged."
planTitle: Quick Idea Capture
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Promoção via emergence ladder**.

## Session handoff

- **Narrative:** F1 FECHADA — plano quick-idea-capture COMPLETO (F0+F1). As 2 tasks executadas pela lane Codex (worktrees `impl/qic-f1-t-001/002`, base `6802e1a`), mescladas serialmente com re-verify na primária. Gates F1-G1 (5/5) e F1-G2 (3/3) met na árvore final. Suíte completa: tests 816, pass 814, fail 0.
- **Decision log:** ver `## Decisions` abaixo.
- **Single nextAction:** Oferecer ao usuário o `archive` do plano completo (mutação user-opted) e/ou um `review-due` cross-model do diff F0+F1.
- **Verbatim state:** gates met: `node --test tests/idea-mark.test.js` (5/5) · `node --test tests/idea-promote.test.js` (3/3). Suíte: `npm test` → tests 816, pass 814, fail 0. Dispatch-log: `.atomic-skills/status/dispatch-log.json` (5 registros codex, 0 escalações).
- **Uncommitted changes:** estado `.atomic-skills/` deste fechamento (sendo commitado); código todo em main.

## Self-review against code-quality gates

- G1 read-before-claim: applied — T-001 e T-002 fechadas com o run do verifier na primária mesclada colado no evidence (84/84+greps · 5/5+3/3); idea-mark.js (255 linhas) e o diff completo de T-001 lidos integralmente no merge-back.
- G2 soft-language: applied — claims de conclusão são `passed: true` com exitCode/outputSummary; handoff escaneado contra a ban list, 0 ocorrências.
- G6 reference-or-strike: applied — literais verbatim (base `6802e1a`, worktrees impl/qic-f1-t-00N, contagens 5/5 · 3/3 · 814/816).
- Codex review (phase-diff): NÃO rodado no phase-done — sessão autônoma; mesmo registro do F0 (plano teve review codex two-pass; código autorado pelo executor codex com verifiers re-rodados por Opus na árvore mesclada). `review-due` cross-model do diff da fase recomendado como follow-up; registrado em vez de silenciado.

## Decisions

- 2026-06-09: Extração ganhou casa no `idea-mark.js` (subverbo `--extract`, JSON em stdout) em vez de um script separado — um único parser do ideas.md para extract+mark, e tests/idea-promote.test.js (F1-G2) prova extração+handoff deterministicamente. O roteamento pela ladder continua 100% procedimento LLM (P5: reusa project-emergence.md, não reinventa).
- 2026-06-09: Interface fixa do script no spec (flags, JSON shape, erros) para permitir dispatch concorrente de T-001 (docs) e T-002 (script) — scope-disjuntos, merge serial.

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
