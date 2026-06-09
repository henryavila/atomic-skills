---
schemaVersion: "0.1"
slug: quick-idea-capture-f0-captura-barata-mvp-do-inbox
title: Captura barata (MVP do inbox)
goal: Entregar a captura end-to-end — script determinístico de append, o detail
  file com o fork de dois modos e o `idea list`, mais o wiring no router e a
  paridade de install — sem tocar no modelo plan/initiative.
status: active
branch: null
started: 2026-06-09T18:41:40.321Z
lastUpdated: 2026-06-09T18:52:55Z
nextAction: "Start T-001: idea-add.js — append determinístico ao ideas.md"
parentPlan: quick-idea-capture
phaseId: F0
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 3
exitGates:
  - id: F0-G1
    description: Captura funciona end-to-end — idea-add.js cria e atualiza o
      ideas.md e a suíte do script passa.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/idea-add.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/idea-add.test.js"
  - id: F0-G2
    description: Validação de skills e compatibilidade cross-agent verdes para o
      novo detail file project-idea.md (sem nomes de ferramenta fixos).
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills && node --test tests/compatibility.test.js
      expectExitCode: 0
    verifierLabel: "shell: npm run validate-skills && node --test tests/compatibility.…"
  - id: F0-G3
    description: idea e idea list alcançáveis pela dispatch table do router e
      paridade de install/uninstall do novo asset garantida.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js && grep -q
        'project-idea.md' skills/core/project.md
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/install-uninstall-roundtrip.test.js && gr…"
stack:
  - id: 1
    title: Captura barata (MVP do inbox)
    type: task
    openedAt: 2026-06-09T18:41:40.321Z
tasks:
  - id: T-001
    title: idea-add.js — append determinístico ao ideas.md
    status: pending
    lastUpdated: 2026-06-09T18:41:40.321Z
    summary: Script determinístico que cria/atualiza o ideas.md e numera a ideia.
    scopeBoundary:
      - scripts/idea-add.js
      - tests/idea-add.test.js
    acceptance:
      - "Cria scripts/idea-add.js + tests/idea-add.test.js; CLI `node scripts/idea-add.js --title <t> --desc <d> [--scope <s>] [--context <c>] [--project-id <id>]` faz append de um registro conforme a gramática §5 do plan.md"
      - "Resolução de path: --project-id explícito vence; senão único dir em .atomic-skills/projects/* → usa-o; múltiplos → exit 1 exigindo --project-id; nenhum → project-id = basename do repo (cria .atomic-skills/projects/<basename>/ideas.md)"
      - "Cabeçalho '# 💡 Ideas — <project-id>' + linha-guia criado uma única vez; appends nunca o duplicam"
      - "Id = max(## #<N> existentes)+1; arquivo ausente/vazio → 1; meta line com data UTC YYYY-MM-DD, branch:<branch ou ->, status:pending, scope/context só quando passados"
      - "--title ou --desc ausentes → exit 1 com mensagem clara; nenhum arquivo além do ideas.md resolvido é tocado; função core exportada para import direto nos testes; sucesso imprime o id atribuído e o path"
    verifier:
      kind: shell
      command: node --test tests/idea-add.test.js
      expectExitCode: 0
  - id: T-002
    title: project-idea.md — fork de captura mais idea list
    status: pending
    lastUpdated: 2026-06-09T18:41:40.321Z
    summary: Detail file com o fork de captura de dois modos e o idea list.
    scopeBoundary:
      - skills/shared/project-assets/project-idea.md
    acceptance:
      - "Detail file sem frontmatter, header '# project — idea (captura + inbox) (lazy detail)', seguindo as convenções de project-transitions.md/project-emergence.md"
      - "Fork de dois modos via {{ASK_USER_QUESTION_TOOL}} (Só salvar / Analisar) conforme plan.md §4; ambos coletam título+descrição; nenhum promove; Analisar persiste scope/context via flags do idea-add.js"
      - "Procedimento `idea list` zero-token (leitura do ideas.md resolvido); seção malformada exibe status:?"
      - "Gramática §5 restated no arquivo (contrato que o modelo deve respeitar ao exibir/escrever)"
      - "Sem nomes de ferramenta hardcoded (Bash/Read tool/etc.), sem $ARGUMENTS, sem host-orchestration tools fora de {{#if ide.claude-code}}"
    verifier:
      kind: shell
      command: npm run validate-skills && node --test tests/compatibility.test.js
      expectExitCode: 0
  - id: T-003
    title: Router wiring mais paridade de install
    status: pending
    lastUpdated: 2026-06-09T18:41:40.321Z
    summary: Liga os verbos no router e garante a paridade de install do novo asset.
    scopeBoundary:
      - skills/core/project.md
    acceptance:
      - "Grammar ganha as linhas `idea` e `idea list` (captura + inbox)"
      - "Dispatch table ganha a row `idea`, `idea list` → {{READ_TOOL}} {{ASSETS_PATH}}/project-idea.md"
      - "No-args summary ganha a linha `IDEAS    <N> pending` impressa só quando N>0, zero-token e fail-open (mesmo padrão da linha DRIFT)"
      - "Paridade de install do novo asset é automática (auto-discovery em project-assets/) — o roundtrip test prova; nenhuma mudança em src/install.js"
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js && grep -q 'project-idea.md' skills/core/project.md
      expectExitCode: 0
parked: []
emerged: []
summary: "O inbox barato: script de append, detail file com o fork Analisar/Só
  salvar, idea list, wiring e paridade de install."
planTitle: Quick Idea Capture
planActive: true
current: true
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

## Links

- Plano: `.atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md` (§4 contrato de captura, §5 gramática do ideas.md)
- Design: `.atomic-skills/projects/atomic-skills/quick-idea-capture/design.md`
- Review codex: `.atomic-skills/reviews/2026-06-09-1851-quick-idea-capture-codex.md`

## Session handoff

- **Narrative:** F0 com spec interior escrito nas 3 tasks (todas spec-ready, verifiers determinísticos). Investigação read-only concluída e registrada em Decisions. Prestes a cortar 3 worktrees (`impl/qic-t-001..003` em `../.wt-qic-t-00N`) e despachar Codex workspace-write concorrente; merge-back será serial com re-verify na primária mesclada.
- **Decision log:** ver `## Decisions` acima (path resolution do ideas.md, distribuição de scripts resolvida, catálogo fora do T-003, roteamento Mode 2 das 3 tasks).
- **Single nextAction:** Criar as worktrees a partir de HEAD limpo e despachar os 3 work-orders Codex (`codex -a never exec -c model_reasoning_effort=high --sandbox workspace-write --skip-git-repo-check --ephemeral -o <out> - < <briefing>` com cwd na worktree, timeout 600s).
- **Verbatim state:** verifiers F0: `node --test tests/idea-add.test.js` · `npm run validate-skills && node --test tests/compatibility.test.js` · `node --test tests/install-uninstall-roundtrip.test.js && grep -q 'project-idea.md' skills/core/project.md`. Routing: `.atomic-skills/status/routing.json` (`mode2Enabled: true`). Bridge: `skills/shared/codex-bridge-assets/invocation-workspace-write.txt`.
- **Uncommitted changes:** somente este arquivo de fase (spec interior + handoff); será commitado imediatamente antes do corte das worktrees.
