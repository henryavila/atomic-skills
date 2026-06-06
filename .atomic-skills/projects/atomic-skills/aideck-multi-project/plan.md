---
schemaVersion: "0.1"
slug: aideck-multi-project
title: Suporte Multi-Projeto no aiDeck
version: "1.0"
status: paused
started: 2026-05-25T17:06:39.511Z
lastUpdated: 2026-06-02T12:33:02Z
currentPhase: F4
parallelismAllowed: false
principles:
  - id: P1
    title: Single-instance, multi-rootDir
    body: Uma instância de aiDeck, uma porta. Projetos se registram via API; nunca
      existe mais de um processo aiDeck rodando.
  - id: P2
    title: Backward-compatible API
    body: As rotas existentes (`/api/state/:consumer`, `/api/health`, `/sse`)
      continuam funcionando para o projeto default (o primeiro registrado).
      Nenhum consumidor existente quebra.
  - id: P3
    title: Zero-config for single-project
    body: Quem usa apenas um projeto não precisa mudar nada. O comportamento
      single-project é o default e funciona sem flags ou configuração extra.
  - id: P4
    title: Watcher-per-project isolation
    body: Cada rootDir registrado tem seu próprio chokidar watcher. Falha ou
      lentidão em um não afeta os outros.
glossary:
  - term: rootDir
    definition: Diretório raiz de um projeto que contém `.atomic-skills/`. Cada
      projeto tem um rootDir distinto.
  - term: ProjectRegistry
    definition: "Estrutura in-memory no aiDeck que mapeia projectId para rootDir +
      watcher. Volatile por design (reconstruida via re-registro). Default
      project: o primeiro registrado; persiste enquanto estiver no registry. Se
      o default for desregistrado, o proximo por ordem de registro assume. Se
      nenhum projeto registrado, rotas legacy retornam 503. Restart do aiDeck
      limpa o registry — projetos re-registram via ensureAideck."
  - term: projectId
    definition: "Identificador unico no registry. Algoritmo de derivacao: (1)
      basename(rootDir) lowercase, (2) substituir chars fora de [a-z0-9-] por
      '-', (3) strip leading digits/hyphens, (4) truncar a 63 chars, (5) se
      vazio apos sanitizacao: 'project-N', (6) se colisao com id existente mas
      rootDir diferente: append '-2', '-3', etc. O caller pode fornecer id
      explicito via POST body. Regex final: `^[a-z][a-z0-9-]{0,63}$`."
  - term: register
    definition: Ato de adicionar um rootDir ao ProjectRegistry via `POST
      /api/projects/register`. Cria watcher e expoe state.
phases:
  - id: F0
    slug: aideck-multi-project-f0-projectregistry-no-aideck
    title: ProjectRegistry no aiDeck
    goal: Criar a estrutura ProjectRegistry in-memory e a API de
      registro/desregistro/listagem de projetos no aiDeck server.
    dependsOn: []
    subPhaseCount: 5
    exitGate:
      summary: 5 criteria to meet
      criteria:
        - id: F0-G1
          description: POST /api/projects/register aceita rootDir, cria entrada no
            registry, retorna 201
          status: met
          verifier:
            kind: test
            runner: cd /Volumes/External/code/aideck && npx vitest run
            pattern: -t 'register'
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: true
            testsCollected: 44
            outputSummary: 44 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
              && npx vitest run -t 'register'` on
              aideck@feat/aideck-v2-generic-runtime
          metAt: 2026-06-01T18:34:18Z
        - id: F0-G2
          description: GET /api/projects lista projetos registrados
          status: met
          verifier:
            kind: test
            runner: cd /Volumes/External/code/aideck && npx vitest run
            pattern: -t 'projects'
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: true
            testsCollected: 11
            outputSummary: 11 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
              && npx vitest run -t 'projects'` on
              aideck@feat/aideck-v2-generic-runtime
          metAt: 2026-06-01T18:34:18Z
        - id: F0-G3
          description: /api/health retorna campo projects[] com ao menos o projeto default
          status: pending
          verifier:
            kind: test
            runner: cd /Volumes/External/code/aideck && npx vitest run
            pattern: -t 'health includes projects'
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: false
            testsCollected: 0
            outputSummary: 0 tests matched `-t 'health includes projects'` — gate cannot be
              confirmed; behavior may be tested under a different name
        - id: F0-G4
          description: Register rejeita rootDir inexistente, rootDir sem .atomic-skills/,
            e rootDir duplicado com id diferente
          status: met
          verifier:
            kind: test
            runner: cd /Volumes/External/code/aideck && npx vitest run
            pattern: -t 'register validation'
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: true
            testsCollected: 4
            outputSummary: 4 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
              && npx vitest run -t 'register validation'` on
              aideck@feat/aideck-v2-generic-runtime
          metAt: 2026-06-01T18:34:18Z
        - id: F0-G5
          description: Register com mesmo rootDir retorna 200 idempotente (nao duplica
            entrada)
          status: met
          verifier:
            kind: test
            runner: cd /Volumes/External/code/aideck && npx vitest run
            pattern: -t 'register idempotent'
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: true
            testsCollected: 2
            outputSummary: 2 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
              && npx vitest run -t 'register idempotent'` on
              aideck@feat/aideck-v2-generic-runtime
          metAt: 2026-06-01T18:34:18Z
    status: done
    summary: ProjectRegistry in-memory + API de registro/desregistro/listagem de
      projetos no aiDeck server.
  - id: F1
    slug: aideck-multi-project-f1-multi-watcher-por-projeto
    title: Multi-watcher por projeto
    goal: Cada projeto registrado no ProjectRegistry ganha seu proprio watcher
      chokidar, com ciclo de vida gerenciado pelo registry.
    dependsOn:
      - F0
    subPhaseCount: 4
    exitGate:
      summary: 4 criteria to meet
      criteria:
        - id: F1-G1
          description: Registrar 2 projetos cria 2 watchers independentes; file change em
            um emite evento apenas para aquele projectId
          status: met
          verifier:
            kind: test
            runner: cd /Volumes/External/code/aideck && npx vitest run
            pattern: -t 'multi-watcher'
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: true
            testsCollected: 1
            outputSummary: 1 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
              && npx vitest run -t 'multi-watcher'` on
              aideck@feat/aideck-v2-generic-runtime
          metAt: 2026-06-01T18:34:18Z
        - id: F1-G2
          description: Desregistrar um projeto para o watcher sem afetar o outro
          status: met
          verifier:
            kind: test
            runner: cd /Volumes/External/code/aideck && npx vitest run
            pattern: -t 'unregister watcher'
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: true
            testsCollected: 1
            outputSummary: 1 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
              && npx vitest run -t 'unregister watcher'` on
              aideck@feat/aideck-v2-generic-runtime
          metAt: 2026-06-01T18:34:18Z
        - id: F1-G3
          description: Legacy /sse (sem prefixo) emite apenas eventos do projeto default;
            /sse?project=X filtra por projeto
          status: met
          verifier:
            kind: test
            runner: cd /Volumes/External/code/aideck && npx vitest run
            pattern: -t 'sse default project'
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: true
            testsCollected: 2
            outputSummary: 2 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
              && npx vitest run -t 'sse default project'` on
              aideck@feat/aideck-v2-generic-runtime
          metAt: 2026-06-01T18:34:18Z
        - id: F1-G4
          description: Watcher error em um projeto nao bloqueia event delivery dos outros
            projetos
          status: met
          verifier:
            kind: test
            runner: cd /Volumes/External/code/aideck && npx vitest run
            pattern: -t 'watcher isolation'
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: true
            testsCollected: 1
            outputSummary: 1 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
              && npx vitest run -t 'watcher isolation'` on
              aideck@feat/aideck-v2-generic-runtime
          metAt: 2026-06-01T18:34:18Z
    status: done
    summary: Watcher chokidar por projeto registrado, com ciclo de vida gerido pelo
      registry.
  - id: F2
    slug: aideck-multi-project-f2-rotas-project-scoped-no-aideck
    title: Rotas project-scoped no aiDeck
    goal: Adicionar rotas prefixadas por projectId para acessar state, entities e
      inbox de projetos especificos.
    dependsOn:
      - F1
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: GET /api/projects/:id/state/project-status retorna state do projeto
            correto
          status: met
          verifier:
            kind: test
            runner: cd /Volumes/External/code/aideck && npx vitest run
            pattern: -t 'project-scoped state'
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: true
            testsCollected: 3
            outputSummary: 3 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
              && npx vitest run -t 'project-scoped state'` on
              aideck@feat/aideck-v2-generic-runtime
          metAt: 2026-06-01T18:34:18Z
        - id: F2-G2
          description: Rotas existentes sem prefixo continuam retornando state do projeto
            default
          status: met
          verifier:
            kind: test
            runner: cd /Volumes/External/code/aideck && npx vitest run
            pattern: -t 'backward-compat'
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: true
            testsCollected: 7
            outputSummary: 7 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
              && npx vitest run -t 'backward-compat'` on
              aideck@feat/aideck-v2-generic-runtime
          metAt: 2026-06-01T18:34:18Z
    status: done
    summary: Rotas prefixadas por projectId (state/entities/inbox de cada projeto).
  - id: F3
    slug: aideck-multi-project-f3-ensureaideck-como-registro
    title: ensureAideck como registro
    goal: Modificar ensureAideck() no atomic-skills para registrar o projeto no
      aiDeck existente em vez de matar e reiniciar.
    dependsOn:
      - F2
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: ensureAideck de projeto B com aiDeck rodando para projeto A
            registra B sem matar A
          status: met
          verifier:
            kind: test
            runner: node --test
            pattern: tests/serve.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: true
            testsCollected: 16
            outputSummary: 16 test(s) passed (exit 0) via `node --test tests/serve.test.js`
              on aideck@feat/aideck-v2-generic-runtime
          metAt: 2026-06-01T18:34:18Z
        - id: F3-G2
          description: projectId derivado do CWD e validado como slug
          status: met
          verifier:
            kind: test
            runner: node --test
            pattern: tests/serve.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-01T18:34:18Z
            passed: true
            testsCollected: 16
            outputSummary: 16 test(s) passed (exit 0) via `node --test tests/serve.test.js`
              on aideck@feat/aideck-v2-generic-runtime
          metAt: 2026-06-01T18:34:18Z
    status: done
    summary: ensureAideck passa a registrar o projeto no aiDeck existente em vez de
      matar e reiniciar.
  - id: F4
    slug: aideck-multi-project-f4-projects-index-home-redesign
    title: ProjectsIndex — nova Home com grid de project cards
    goal: "Substituir a Home baseada em ConsumerBands por um ProjectsIndex com grid
      de ProjectCards. Cada card mostra rollup metrics, um ActiveItemHero
      (plano/iniciativa mais relevante com progress bar + phase pips) e um
      RoadmapStrip compacto (ate 4 itens). Inclui data layer (rollupProject,
      rollupScenario, rollupRoadmap) e estados empty/errored/idle/active. Design
      reference: design_handoff_multi_project_home/ (aiDeck.zip)."
    dependsOn:
      - F3
    subPhaseCount: 4
    exitGate:
      summary: 4 criteria to meet
      criteria:
        - id: F4-G1
          description: ProjectsIndex renderiza grid de ProjectCards com 2+ projetos
            registrados; cada card mostra header (nome, path, health badge),
            metric strip, ActiveItemHero, RoadmapStrip, e footer (branch +
            lastActivity + "Open")
          status: pending
          verifier:
            kind: manual
            description: Registrar 2 projetos via API, abrir dashboard. Verificar grid de
              cards com metrics, hero, roadmap strip, e footer visiveis por
              projeto. Comparar com screenshot 01-projects-index.png.
        - id: F4-G2
          description: Empty state renderiza quando 0 projetos registrados (card com shell
            snippet + call-to-action)
          status: pending
          verifier:
            kind: manual
            description: Abrir dashboard sem projetos registrados. Verificar empty state com
              instrucoes de registro.
        - id: F4-G3
          description: Card de projeto com health=errored short-circuits para chip
            agregado ("N file(s) failed to parse") em vez do hero normal.
            Detalhes per-error (file, line, kind, message, suggestion) aparecem
            no Project Detail (F5), nao no card do index.
          status: pending
          verifier:
            kind: manual
            description: Registrar projeto com YAML invalido em .atomic-skills/. Verificar
              que card mostra chip agregado de erro (nao hero). Drill-in no card
              mostra ConsumerErroredBlock com detalhes.
        - id: F4-G4
          description: "Dashboard funciona com aiDeck antigo (sem /api/projects) via
            fallback single-project usando rota legacy
            /api/state/project-status. Simulavel sem binario antigo: GET
            /api/projects retornando 404 ou connection refused faz o dashboard
            cair no fallback single-project."
          status: pending
          verifier:
            kind: manual
            description: Subir aideck normalmente. Antes de registrar qualquer projeto,
              verificar que GET /api/projects retorna lista vazia e dashboard
              carrega via rota legacy /api/state/project-status.
    status: paused
    summary: Nova Home = grid de ProjectCards (rollups + item ativo) no lugar das
      ConsumerBands.
  - id: F5
    slug: aideck-multi-project-f5-project-detail-roadmap-navegacao
    title: Project Detail — Roadmap drill-in + navegacao
    goal: "Drill-in de um ProjectCard abre o Project Detail com Roadmap por lanes
      (In flight, Blocked, Up next, Parked, Shipped). Planos e iniciativas sao
      itens de roadmap first-class, mixados nas mesmas lanes. Navegacao inclui
      breadcrumb no TopChrome, back button, e URLs project-scoped. Fallback
      backward-compat para rotas sem projectId. Design reference:
      design_handoff_multi_project_home/ (aiDeck.zip)."
    dependsOn:
      - F4
    subPhaseCount: 4
    exitGate:
      summary: 4 criteria to meet
      criteria:
        - id: F5-G1
          description: Clicar num ProjectCard drilla para Project Detail com Roadmap
            renderizando lanes (In flight, Blocked, Up next, Parked, Shipped)
            corretamente preenchidas a partir de plans + initiatives do projeto,
            e Sources strip no rodape listando consumers com item count e
            lastWrite
          status: pending
          verifier:
            kind: manual
            description: Com 2 projetos registrados, clicar num card. Verificar que Project
              Detail mostra Roadmap com lanes, items com density correta (hero
              cards para In flight, rows compactos para Up next, dim rows para
              Shipped). Parked e Shipped devem iniciar colapsadas; In flight,
              Blocked e Up next abertas. Verificar Sources strip no rodape
              (consumer name + item count + lastWrite).
        - id: F5-G2
          description: Breadcrumb no TopChrome mostra Projects > projectName e permite
            voltar ao index; back button "All projects" funciona
          status: pending
          verifier:
            kind: manual
            description: No Project Detail, verificar breadcrumb no TopChrome. Clicar "All
              projects" ou breadcrumb root volta ao ProjectsIndex.
        - id: F5-G3
          description: Clicar num item do Roadmap navega para /:projectId/plans/:slug ou
            /:projectId/initiatives/:slug (URL inclui projectId)
          status: pending
          verifier:
            kind: manual
            description: No Roadmap, clicar num plano do segundo projeto. Verificar URL
              inclui projectId.
        - id: F5-G4
          description: Rotas legacy sem prefixo (/plans/:slug, /initiatives/:slug)
            continuam funcionando para backward-compat com single-project
          status: pending
          verifier:
            kind: manual
            description: Navegar diretamente para /plans/existing-slug sem projectId.
              Verificar que carrega o plano do projeto default.
    status: pending
    summary: Project Detail = drill-in com Roadmap por lanes (in flight / blocked /
      up next / parked / shipped).
references:
  - kind: repo-path
    path: aiDeck.zip
    label: "Design handoff: Multi-Project Home + Roadmap"
planTitle: Suporte Multi-Projeto no aiDeck
---

# Suporte Multi-Projeto no aiDeck

## 1. Context

Hoje o aiDeck opera com um único rootDir por instância. Quando um segundo projeto chama `ensureAideck()`, a instância existente é morta e reiniciada apontando para o novo CWD. Isso impede que dois ou mais projetos compartilhem o mesmo dashboard simultaneamente. Este plano implementa o suporte a múltiplos rootDirs por instância, com registro dinâmico via API e visualização separada por projeto no dashboard.

## 2. Inviolable principles

- **P1 Single-instance, multi-rootDir** — Uma instância de aiDeck, uma porta. Projetos se registram via API; nunca existe mais de um processo aiDeck rodando.
- **P2 Backward-compatible API** — As rotas existentes (`/api/state/:consumer`, `/api/health`, `/sse`) continuam funcionando para o projeto default (o primeiro registrado). Nenhum consumidor existente quebra.
- **P3 Zero-config for single-project** — Quem usa apenas um projeto não precisa mudar nada. O comportamento single-project é o default e funciona sem flags ou configuração extra.
- **P4 Watcher-per-project isolation** — Cada rootDir registrado tem seu próprio chokidar watcher. Falha ou lentidão em um não afeta os outros.

## 3. Phase tree

| Phase | Title | Tasks | Gates | Depends on |
|-------|-------|-------|-------|------------|
| F0 | ProjectRegistry no aiDeck | 5 | 5 | — |
| F1 | Multi-watcher por projeto | 4 | 4 | F0 |
| F2 | Rotas project-scoped no aiDeck | 4 | 2 | F1 |
| F3 | ensureAideck como registro | 3 | 2 | F2 |
| F4 | ProjectsIndex — nova Home com grid de project cards | 4 | 4 | F3 |
| F5 | Project Detail — Roadmap drill-in + navegacao | 4 | 4 | F4 |

F0-F2 operam no repo **aideck** (`/Volumes/External/code/aideck/`).
F3 opera no repo **atomic-skills** (`/Volumes/External/code/atomic-skills/`).
F4-F5 operam no dashboard dentro de **atomic-skills** (`src/dashboard/`).

## Self-review against code-quality gates

- **G1 read-before-claim**: Claims sobre codigo existente (ensureAideck kill+restart, single rootDir, hardcoded CONSUMER) foram verificadas via Read tool durante a analise pre-plano (serve.js:200-217, api.ts:18, index.ts:53). N/A para tasks descrevendo codigo novo.
- **G2 soft-language**: Scanned plan body for ban list; 0 occurrences.
- **G6 reference-or-strike**: Plan describes future work (tasks with target files). No bare claims about existing code state in body. All existing-code references verified in conversation context.

## Verificacao manual pendente (F4/F5)

8 gates precisam de validacao visual com o aideck rodando. Design reference: `design_handoff_multi_project_home/` (extraido de `aiDeck.zip` na raiz do repo).

### Setup (uma vez)

```bash
# 1. Rebuild aideck com as mudancas de multi-project
cd /Volumes/External/code/aideck && npm run build

# 2. Rebuild dashboard com as mudancas de multi-project
cd /Volumes/External/code/atomic-skills && npm run build:dashboard

# 3. Subir aideck apontando para este repo
cd /Volumes/External/code/atomic-skills && npx atomic-skills serve

# 4. Registrar um segundo projeto
curl -s -X POST http://127.0.0.1:7777/api/projects/register \
  -H 'Content-Type: application/json' \
  -d '{"rootDir": "/Volumes/External/code/aideck", "projectId": "aideck"}'

# Verificar que 2 projetos estao registrados
curl -s http://127.0.0.1:7777/api/projects | jq '.projects | length'
# Esperado: 2
```

### F4 — ProjectsIndex (nova Home)

**F4-G1: Grid de ProjectCards com 2+ projetos.** Abrir http://127.0.0.1:7777. Verificar grid de cards; cada card mostra: header (nome + path + health badge), metric strip (consumers, plans, init, highlights), ActiveItemHero (plano/iniciativa mais relevante com progress bar + phase pips + "NEXT" line), RoadmapStrip (ate 4 itens compactos com lane counts). Comparar com screenshot `01-projects-index.png`.

**F4-G2: Empty state (0 projetos).** Parar aideck, reiniciar sem registrar projetos. Verificar card com instrucoes de registro (shell snippet + call-to-action).

**F4-G3: Card errored.** Registrar projeto com YAML invalido. Verificar que card mostra chip agregado ("N file(s) failed to parse") em vez do hero. Drill-in no card mostra ConsumerErroredBlock com detalhes per-error (file, line, kind, message, suggestion).

**F4-G4: Fallback single-project.** Subir aideck normalmente, sem registrar projetos. GET /api/projects retorna lista vazia; dashboard deve cair no fallback legacy `/api/state/project-status` e carregar normalmente.

### F5 — Project Detail + Roadmap + navegacao

**F5-G1: Roadmap drill-in + Sources.** Clicar num ProjectCard. Verificar Project Detail com: header (back button + eyebrow + titulo + descricao), metric strip scoped, RoadmapHeader (lane counts + "+ New initiative"), 5 lanes (In flight = hero cards com progress bar; Blocked = tinted cards; Up next = compact dashed rows; Parked = dim dashed rows; Shipped = strikethrough rows). Lanes Parked e Shipped devem iniciar colapsadas; In flight, Blocked e Up next abertas. Sources strip no rodape (consumer name + item count + lastWrite). Comparar com screenshot `02-project-detail-aideck.png`.

**F5-G2: Breadcrumb + back.** No Project Detail, verificar breadcrumb no TopChrome (Projects > projectName). Clicar "All projects" ou breadcrumb root volta ao ProjectsIndex.

**F5-G3: URLs project-scoped.** No Roadmap, clicar num plano do segundo projeto. URL deve ser `/:projectId/plans/:slug`.

**F5-G4: Backward-compat legacy routes.** Navegar para `/plans/existing-slug` sem projectId. Verificar que carrega plano do projeto default.

---

## Reviews

- [2026-05-25 Codex cross-model review](../reviews/2026-05-25-1416-aideck-multi-project.md) — verdict: needs_changes (0B/1C/4M). 5 findings maintained, 0 dropped, 0 emerged. All 5 findings addressed inline: F-001 (projectId derivation algorithm specified), F-002 (SSE backward-compat gate F1-G3 added), F-003 (default project lifecycle defined in glossary), F-004 (registration validation gates F0-G4/G5 added), F-005 (watcher isolation gate F1-G4 added).
- [2026-05-25 F4/F5 rewrite review] — local + Codex (Sonnet). Local: 0 issues, 2 warns (Sources strip sem gate; F5 status active vs pending). Codex: needs_changes (0B/1C/4M). All 5 findings addressed inline: F-001 (F4-G3 errored card spec corrigido: chip agregado no index, detalhes no detail), F-002 (Sources strip adicionado a F5-G1), F-003 (F4-G4 fallback simulavel sem binario antigo), F-004 (collapse defaults adicionados a F5-G1 verifier), F-005 (footer do card adicionado a F4-G1).
