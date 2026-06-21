---
schemaVersion: "0.1"
slug: fix-aideck-dashboard-f1-shell-project-centric-no-aideck
title: "Shell project-centric no aiDeck (nav.style: projects)"
goal: "No ../aideck/src/client, adicionar um modo de nav NOMEADO
  project-centric: Panorama fixo como landing no topo + lista de PROJETOS na
  sidebar (em vez de CONSUMERS), single consumer, header de página alinhado.
  Shell customizável por MODO nomeado, não free-form. É a correção dominante — o
  manifest sozinho não resolve."
status: done
branch: plan/fix-aideck-dashboard
started: 2026-06-16T11:57:08.891Z
lastUpdated: 2026-06-20T00:00:00Z
parentPlan: fix-aideck-dashboard
phaseId: F1
nextAction: "Código FEITO e committado no ../aideck (/home/henry/aideck @
  2b54987, branch feat/ds-v2.1-widgets). Resta o gate G-1 (kind: manual):
  validação VISUAL do owner — render do shell projects vs imagem de referência
  #2. Sem chrome-headless neste ambiente; o aiDeck serve em :7777. Depois da
  validação passar: publicar a v2.1 no npm (ÚLTIMO passo, gate do owner). Sem
  task codificável pendente p/ implement."
summary: "Shell nav.style:'projects' IMPLEMENTADO E COMMITADO no aiDeck (commit
  1610a10 em feat/ds-v2.1-widgets; HEAD avançou p/ 2b54987 —
  schema+Sidebar+landing+ testes de fixture neutra + gate domain-agnostic +
  page.showInNav). G-1 (render vs imagem #2 via CDP) PENDENTE: validação VISUAL
  do owner. Publicar é o último passo, só depois da validação."
tasksDone: 0
tasksTotal: 0
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: A sidebar renderiza Panorama no topo + lista PROJETOS
      (atomic-skills/arch/lekto) sob UM consumer, validado por captura CDP
      comparada à imagem de referência do design.
    status: deferred
    deferredReason: Owner valida visualmente após o merge (decisão do owner, 2026-06-20).
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
    evidenceSummary: "deferred: Owner valida visualmente após o merge (decisão do
      owner, 2026-06-20)."
stack: []
tasks: []
parked: []
emerged: []
planTitle: "fix-aideck-dashboard: corrigir a integração com aiDeck"
---

# F1 · Shell project-centric no aiDeck (nav.style: projects)

Fase **ativa**, mas o trabalho de CÓDIGO está **feito e committado** no repositório
sibling `../aideck` (`/home/henry/aideck`, branch `feat/ds-v2.1-widgets` @ `2b54987`):
schema do `nav.style:'projects'`, `Sidebar.vue` (Panorama landing + lista de PROJETOS),
fixture neutra + gate domain-agnostic, e `page.showInNav`. O que falta é o gate de
saída **G-1**, que é `kind: manual` — a **validação VISUAL do owner** (render do shell
vs imagem de referência #2). Não há chrome-headless neste ambiente para captura
automática; o aiDeck serve em `:7777`.

## Session handoff

- **Narrative:** O `fix-aideck-dashboard` (plan.md v2.0) está com TODO o código feito e
  verde. F1 (shell `nav.style:'projects'`) committado no `../aideck` (@ `2b54987`); F2
  (manifest realinhado) committado aqui (`16e7e91` etc.); F3 (guardrail widget∈registry,
  G-2) committado aqui e MET. Esta sessão destravou um resume gate quebrado (WIP de outros
  planos solto neste worktree → stashado) e reconciliou o estado (plan.md v2.0 estava
  dessincronizado das fases v1.x + focus.json velho). O que resta NÃO é trabalho de
  `implement`: 3 gates `kind: manual` (validação visual do owner) + publish no npm (gate
  do owner).
- **Decision log:** (1) O WIP solto (página Ritmo standalone + wiring de fork + links.json)
  era de OUTROS planos — Ritmo é variante OBSOLETA (o canônico é uma `section` já CONCLUÍDA
  em `plan/deadline-burnup-forecast`); o fork wiring era a ÚNICA cópia (deferido em
  `plan-fork`) → **stash** (lossless), não discard. (2) Materializei as fases v2.0 a partir
  do `plan.md` (fonte canônica) e arquivei as fases v1.x obsoletas (React client removido em
  38cf2a9), corrigindo o shadow do `findPhaseInitiative` que mantinha o `focus.json` velho.
  (3) A reconciliação de estado é `project`, não `implement` — o código já estava pronto.
- **Single nextAction:** Owner valida VISUALMENTE o render do shell projects vs imagem #2
  (abrir `http://localhost:7777/` com o aiDeck v2.1 servindo); se passar, marca os gates
  G-1 (F1/F2/F3) met via `phase-done` e publica `../aideck` v2.1 no npm (último passo).
- **Verbatim state:**
  - Verifier F3 G-2 (verde, árvore limpa): `node --test tests/aideck-manifest-widget-registry.test.js` → 4 pass / 0 fail / tests=4
  - F2 substrate (verde): `node --test tests/aideck-consumer-manifest.test.js` → 26 pass / 0 fail
  - aiDeck sibling: `/home/henry/aideck` @ `2b54987` (branch `feat/ds-v2.1-widgets`); serve em `http://localhost:7777/` (HTTP 200); `dist/cli.js` + `dist/client` presentes; SEM chrome-headless no PATH
  - WIP solto preservado: `git stash list` → `stash@{0}` ("foreign-WIP-in-fix-aideck-wt: ritmo standalone-page … + fork manifest wiring/links.json")
  - Reconciliação: `node scripts/refresh-state.js .` + `node scripts/validate-state.js .atomic-skills/projects/atomic-skills/fix-aideck-dashboard/plan.md`
- **Uncommitted changes (`git status --porcelain` @ snapshot):** só a reconciliação de
  fix-aideck-dashboard —
  `M .atomic-skills/focus.json` ·
  `M .atomic-skills/projects/atomic-skills/fix-aideck-dashboard/plan.md` (F3 G-2 verifier
  `kind: command`→`shell` + evidence; era inválido no schema e nunca tinha sido validado) ·
  `R phases/f1-validar-…md → phases/archive/` · `R phases/f2-repensar-…md → phases/archive/` ·
  `?? phases/{f0-auditoria,f1-shell,f2-realinhar,f3-higiene}-*.md` (4 fases v2.0). WIP de
  outros planos NÃO está no tree (preservado em `stash@{0}`).
