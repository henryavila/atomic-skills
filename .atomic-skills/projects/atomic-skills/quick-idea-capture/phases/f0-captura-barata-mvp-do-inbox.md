---
schemaVersion: "0.1"
slug: quick-idea-capture-f0-captura-barata-mvp-do-inbox
title: Captura barata (MVP do inbox)
goal: Entregar a captura end-to-end — script determinístico de append, o detail
  file com o fork de dois modos e o `idea list`, mais o wiring no router e a
  paridade de install — sem tocar no modelo plan/initiative.
status: done
branch: null
started: 2026-06-09T18:41:40.321Z
lastUpdated: 2026-06-09T20:35:00Z
nextAction: "F0 fechada (3/3 tasks, 3/3 gates met). Próximo: F1 — idea promote."
parentPlan: quick-idea-capture
phaseId: F0
tasksDone: 3
tasksTotal: 3
gatesMet: 3
gatesTotal: 3
exitGates:
  - id: F0-G1
    description: Captura funciona end-to-end — idea-add.js cria e atualiza o
      ideas.md e a suíte do script passa.
    status: met
    metAt: 2026-06-09T20:35:00Z
    verifier:
      kind: shell
      command: node --test tests/idea-add.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-09T20:35:00Z
      passed: true
      exitCode: 0
      outputSummary: "Final tree: tests 9, pass 9, fail 0."
    verifierLabel: "shell: node --test tests/idea-add.test.js"
    evidenceSummary: passed · 2026-06-09
  - id: F0-G2
    description: Validação de skills e compatibilidade cross-agent verdes para o
      novo detail file project-idea.md (sem nomes de ferramenta fixos).
    status: met
    metAt: 2026-06-09T20:35:00Z
    verifier:
      kind: shell
      command: npm run validate-skills && node --test tests/compatibility.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-09T20:35:00Z
      passed: true
      exitCode: 0
      outputSummary: "Final tree: validate-skills ✓ All 14 skills valid; compatibility
        tests 84, pass 84, fail 0."
    verifierLabel: "shell: npm run validate-skills && node --test tests/compatibility.…"
    evidenceSummary: passed · 2026-06-09
  - id: F0-G3
    description: idea e idea list alcançáveis pela dispatch table do router e
      paridade de install/uninstall do novo asset garantida.
    status: met
    metAt: 2026-06-09T20:35:00Z
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js && grep -q
        'project-idea.md' skills/core/project.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-09T20:35:00Z
      passed: true
      exitCode: 0
      outputSummary: "Final tree: roundtrip tests 4, pass 4, fail 0; grep
        project-idea.md in skills/core/project.md exit 0."
    verifierLabel: "shell: node --test tests/install-uninstall-roundtrip.test.js && gr…"
    evidenceSummary: passed · 2026-06-09
stack:
  - id: 1
    title: Captura barata (MVP do inbox)
    type: task
    openedAt: 2026-06-09T18:41:40.321Z
tasks:
  - id: T-001
    title: idea-add.js — append determinístico ao ideas.md
    status: done
    lastUpdated: 2026-06-09T20:20:00Z
    closedAt: 2026-06-09T20:20:00Z
    summary: Script determinístico que cria/atualiza o ideas.md e numera a ideia.
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-09T20:20:00Z
      passed: true
      exitCode: 0
      outputSummary: "Re-run on MERGED primary: node --test tests/idea-add.test.js →
        tests 9, pass 9, fail 0, exit 0. Executor: codex lane, worktree
        impl/qic-t-001 (self-check 9/9 também verde)."
    scopeBoundary:
      - scripts/idea-add.js
      - tests/idea-add.test.js
    acceptance:
      - Cria scripts/idea-add.js + tests/idea-add.test.js; CLI `node
        scripts/idea-add.js --title <t> --desc <d> [--scope <s>] [--context <c>]
        [--project-id <id>]` faz append de um registro conforme a gramática §5
        do plan.md
      - "Resolução de path: --project-id explícito vence; senão único dir em
        .atomic-skills/projects/* → usa-o; múltiplos → exit 1 exigindo
        --project-id; nenhum → project-id = basename do repo (cria
        .atomic-skills/projects/<basename>/ideas.md)"
      - Cabeçalho '# 💡 Ideas — <project-id>' + linha-guia criado uma única vez;
        appends nunca o duplicam
      - "Id = max(## #<N> existentes)+1; arquivo ausente/vazio → 1; meta line
        com data UTC YYYY-MM-DD, branch:<branch ou ->, status:pending,
        scope/context só quando passados"
      - --title ou --desc ausentes → exit 1 com mensagem clara; nenhum arquivo
        além do ideas.md resolvido é tocado; função core exportada para import
        direto nos testes; sucesso imprime o id atribuído e o path
    verifier:
      kind: shell
      command: node --test tests/idea-add.test.js
      expectExitCode: 0
  - id: T-002
    title: project-idea.md — fork de captura mais idea list
    status: done
    lastUpdated: 2026-06-09T19:55:00Z
    closedAt: 2026-06-09T19:55:00Z
    summary: Detail file com o fork de captura de dois modos e o idea list.
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-09T19:55:00Z
      passed: true
      exitCode: 0
      outputSummary: "Re-run on MERGED primary (8c8198d): validate-skills ✓ All 14
        skills valid (schema_version 0.2); compatibility.test.js tests 84, pass
        84, fail 0. Executor: codex lane, worktree impl/qic-t-002."
    scopeBoundary:
      - skills/shared/project-assets/project-idea.md
    acceptance:
      - Detail file sem frontmatter, header '# project — idea (captura + inbox)
        (lazy detail)', seguindo as convenções de
        project-transitions.md/project-emergence.md
      - Fork de dois modos via {{ASK_USER_QUESTION_TOOL}} (Só salvar / Analisar)
        conforme plan.md §4; ambos coletam título+descrição; nenhum promove;
        Analisar persiste scope/context via flags do idea-add.js
      - Procedimento `idea list` zero-token (leitura do ideas.md resolvido);
        seção malformada exibe status:?
      - Gramática §5 restated no arquivo (contrato que o modelo deve respeitar
        ao exibir/escrever)
      - Sem nomes de ferramenta hardcoded (Bash/Read tool/etc.), sem $ARGUMENTS,
        sem host-orchestration tools fora de {{#if ide.claude-code}}
    verifier:
      kind: shell
      command: npm run validate-skills && node --test tests/compatibility.test.js
      expectExitCode: 0
  - id: T-003
    title: Router wiring mais paridade de install
    status: done
    lastUpdated: 2026-06-09T20:05:00Z
    closedAt: 2026-06-09T20:05:00Z
    summary: Liga os verbos no router e garante a paridade de install do novo asset.
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-09T20:05:00Z
      passed: true
      exitCode: 0
      outputSummary: "Re-run on MERGED primary: install-uninstall-roundtrip pass 4
        fail 0; grep -q 'project-idea.md' skills/core/project.md exit 0. Codex
        in-worktree self-check had failed only on sandbox EPERM (spawnSync git);
        merged-tree run is the evidence. Worktree impl/qic-t-003."
    scopeBoundary:
      - skills/core/project.md
    acceptance:
      - Grammar ganha as linhas `idea` e `idea list` (captura + inbox)
      - Dispatch table ganha a row `idea`, `idea list` → {{READ_TOOL}}
        {{ASSETS_PATH}}/project-idea.md
      - No-args summary ganha a linha `IDEAS    <N> pending` impressa só quando
        N>0, zero-token e fail-open (mesmo padrão da linha DRIFT)
      - Paridade de install do novo asset é automática (auto-discovery em
        project-assets/) — o roundtrip test prova; nenhuma mudança em
        src/install.js
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js && grep -q
        'project-idea.md' skills/core/project.md
      expectExitCode: 0
parked: []
emerged: []
summary: "O inbox barato: script de append, detail file com o fork Analisar/Só
  salvar, idea list, wiring e paridade de install."
planTitle: Quick Idea Capture
planActive: true
---

# Narrative / notes

Initiative for phase **F0 — Captura barata (MVP do inbox)**.

## Decisions

- 2026-06-09: Baseline do plano commitado em `0684384` antes de qualquer código (resume gate exigia árvore limpa).
- 2026-06-09: Lane Mode 2 ligada (`routing.json` mode2Enabled+codexLane.enabled, codex-cli 0.135.0 presente). Tasks F0 não carregavam `scopeBoundary[]`/`acceptance[]` ⇒ Opus especificou mais forte (spec interior escrito nas 3 tasks) antes do roteamento.
- 2026-06-09: Nota aberta do design (distribuição de scripts) RESOLVIDA por investigação: detail files invocam `node scripts/X.js` direto; consumer repos resolvem via `~/.atomic-skills/package-root` (src/install.js L121–131 + stop.sh resolve chain). Nenhuma mudança no install.js para idea-add.js.
- 2026-06-09: Resolução de path do ideas.md decidida: `--project-id` explícito > único `projects/*` > múltiplos exigem flag (exit 1) > nenhum ⇒ project-id = basename do repo. Sem fallback flat `.atomic-skills/ideas.md` (a nota operacional do design vence o parêntese do D3; um layout canônico só).
- 2026-06-09: Catálogo (meta/catalog.yaml) NÃO entra no T-003 — validate-skills não exige subcommand novo lá; discoverability via catálogo fica como possível park.
- 2026-06-09: Roteamento F0: as 3 tasks são pairwise scope-disjuntas (scripts/+tests/ · project-idea.md · project.md) ⇒ T-001/T-002/T-003 despacham ao Codex em worktrees concorrentes; merge-back serial com re-verify na árvore mesclada (R-XAGENT-03).
- 2026-06-09: Self-check do T-003 falhou DENTRO do sandbox codex por `spawnSync git EPERM` (limitação do sandbox, roundtrip test spawna git); o verifier passou na primária mesclada — o juiz é sempre o re-run de Opus, nunca o relato.
- 2026-06-09: EMERGENTE — `tests/install.test.js` fixa contagens exatas do footprint de install; o novo asset (+1 por namespace) quebrou 5 asserts (52→53, 53→54, 103→105, 52→53, 34→35). Corrigido inline (provenance: surfaced durante F0 phase-done full-suite sanity, surfacedBy: ai); suíte completa de volta a verde (806 pass / 0 fail).

## Links

- Plano: `.atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md` (§4 contrato de captura, §5 gramática do ideas.md)
- Design: `.atomic-skills/projects/atomic-skills/quick-idea-capture/design.md`
- Review codex: `.atomic-skills/reviews/2026-06-09-1851-quick-idea-capture-codex.md`

## Session handoff

- **Narrative:** F0 FECHADA. As 3 tasks foram executadas pela lane Codex (worktrees `impl/qic-t-001..003`, base `53dbcc3`), mescladas serialmente com re-verify na primária a cada merge, e os 3 exit gates re-rodaram verdes na árvore final. Trabalho emergente: contagens de footprint em `tests/install.test.js` ajustadas (+1 asset). Suíte completa verde: 806 pass / 0 fail.
- **Decision log:** ver `## Decisions` acima.
- **Single nextAction:** Spec-harden as 2 tasks da F1 (`f1-promocao-via-emergence-ladder.md`) e despachar pela lane Codex (mesmo fluxo da F0).
- **Verbatim state:** gates met com evidência: `node --test tests/idea-add.test.js` (9/9) · `npm run validate-skills && node --test tests/compatibility.test.js` (84/84) · `node --test tests/install-uninstall-roundtrip.test.js && grep -q 'project-idea.md' skills/core/project.md` (4/4 + exit 0). Dispatch-log: `.atomic-skills/status/dispatch-log.json` (3 registros codex). Suíte: `npm test` → tests 808, pass 806, fail 0.
- **Uncommitted changes:** estado `.atomic-skills/` desta fase (sendo commitado no fechamento); código todo commitado em main.

## Self-review against code-quality gates

- G1 read-before-claim: applied — cada task fechada linka o run do verifier na primária mesclada (T-001 9/9, T-002 validate-skills+84/84, T-003 roundtrip 4/4+grep); os 3 deliverables foram lidos integralmente no merge-back (project-idea.md 105 linhas, idea-add.js 155 linhas, diff do router 5 hunks).
- G2 soft-language: applied — claims de conclusão são `passed: true` com exitCode/outputSummary; handoff escaneado contra a ban list, 0 ocorrências.
- G6 reference-or-strike: applied — todos os literais do handoff são paths/comandos/saídas verbatim (commits 0684384/8c8198d/7b7582a, worktrees impl/qic-t-00N, contagens de teste).
- Codex review (phase-diff): NÃO rodado no phase-done — sessão autônoma; o plano teve review codex two-pass em 2026-06-09 (5 majors aplicados) e 100% do código da fase foi AUTORADO pelo executor codex com verifiers determinísticos re-rodados por Opus na árvore mesclada. Recomenda-se `review-due` cross-model sobre o diff da fase como follow-up; registrado aqui em vez de silenciado.
