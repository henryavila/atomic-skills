# Suporte Multi-Projeto no aiDeck

Hoje o aiDeck opera com um único rootDir por instância. Quando um segundo projeto chama `ensureAideck()`, a instância existente é morta e reiniciada apontando para o novo CWD. Isso impede que dois ou mais projetos compartilhem o mesmo dashboard simultaneamente. Este plano implementa o suporte a múltiplos rootDirs por instância, com registro dinâmico via API e visualização separada por projeto no dashboard.

## Inviolable principles

- **P1 Single-instance, multi-rootDir** — Uma instância de aiDeck, uma porta. Projetos se registram via API; nunca existe mais de um processo aiDeck rodando.
- **P2 Backward-compatible API** — As rotas existentes (`/api/state/:consumer`, `/api/health`, `/sse`) continuam funcionando para o projeto default (o primeiro registrado). Nenhum consumidor existente quebra.
- **P3 Zero-config for single-project** — Quem usa apenas um projeto não precisa mudar nada. O comportamento single-project é o default e funciona sem flags ou configuração extra.
- **P4 Watcher-per-project isolation** — Cada rootDir registrado tem seu próprio chokidar watcher. Falha ou lentidão em um não afeta os outros.

## Glossary

- **rootDir** — Diretório raiz de um projeto que contém `.atomic-skills/`. Cada projeto tem um rootDir distinto.
- **ProjectRegistry** — Estrutura in-memory no aiDeck que mapeia projectId para rootDir + watcher. Volatile por design (reconstruída via re-registro).
- **projectId** — Identificador derivado do basename do rootDir. Regex: `^[a-z][a-z0-9-]{0,63}$`. Deve ser único no registry.
- **register** — Ato de adicionar um rootDir ao ProjectRegistry via `POST /api/projects/register`. Cria watcher e expoe state.

## F0 — ProjectRegistry no aiDeck

Goal: Criar a estrutura ProjectRegistry in-memory e a API de registro/desregistro/listagem de projetos no aiDeck server.

### Sub-fases (tarefas)

- **F0.T-001 — Criar ProjectRegistry class.** Classe com Map<projectId, {rootDir, name, watcher, registeredAt}>. Métodos: register(id, rootDir, name?), unregister(id), get(id), list(), getDefault(). O primeiro projeto registrado é marcado como default. Arquivo: `aideck/src/server/project-registry.ts`.
- **F0.T-002 — Integrar ProjectRegistry no startServer.** ServerOptions.rootDir vira o primeiro registro automático (projectId derivado de basename(rootDir)). ApiDeps ganha referência ao registry em vez de rootDir scalar. Arquivo: `aideck/src/server/index.ts`.
- **F0.T-003 — Rota POST /api/projects/register.** Body: `{ id?, rootDir, name? }`. Se id omitido, deriva de basename(rootDir). Retorna 201 com o projeto registrado. Se rootDir já registrado, retorna 200 idempotente. Validação: rootDir deve existir e conter `.atomic-skills/`. Arquivo: `aideck/src/server/routes/api.ts`.
- **F0.T-004 — Rotas GET /api/projects e DELETE /api/projects/:id.** GET lista todos os projetos registrados com rootDir, name, registeredAt, health. DELETE para e remove watcher + entrada do registry. Arquivo: `aideck/src/server/routes/api.ts`.
- **F0.T-005 — Atualizar /api/health para multi-projeto.** Retornar `projects: [{id, rootDir, name}]` em vez de `rootDir: string`. Manter `rootDir` no response por backward-compat (aponta para o default). Arquivo: `aideck/src/server/routes/api.ts`.

```yaml
exit_gate:
  - id: F0-G1
    description: POST /api/projects/register aceita rootDir, cria entrada no registry, retorna 201
    verifier: { kind: shell, command: "cd /Volumes/External/code/aideck && npm test -- --grep 'register'", expectExitCode: 0 }
  - id: F0-G2
    description: GET /api/projects lista projetos registrados
    verifier: { kind: shell, command: "cd /Volumes/External/code/aideck && npm test -- --grep 'projects'", expectExitCode: 0 }
  - id: F0-G3
    description: /api/health retorna campo projects[] com ao menos o projeto default
    verifier: { kind: shell, command: "cd /Volumes/External/code/aideck && npm test -- --grep 'health.*projects'", expectExitCode: 0 }
```

## F1 — Multi-watcher por projeto

Goal: Cada projeto registrado no ProjectRegistry ganha seu proprio watcher chokidar, com ciclo de vida gerenciado pelo registry.

### Sub-fases (tarefas)

- **F1.T-001 — Watcher lifecycle no ProjectRegistry.register().** Ao registrar um projeto, criar e iniciar um watcher apontando para `atomicSkillsRoot(rootDir)`. Ao desregistrar, parar o watcher. Usar a mesma factory `createWatcher()` existente. Arquivo: `aideck/src/server/project-registry.ts`.
- **F1.T-002 — Enriquecer eventos com projectId.** EventBus events ganham campo `projectId: string`. O watcher de cada projeto emite eventos com o projectId correspondente. Tipos afetados: `state-change`, `error`, `annotation-added`, `highlight-added`. Arquivo: `aideck/src/server/event-bus.ts`, `aideck/src/server/watcher.ts`.
- **F1.T-003 — SSE stream inclui projectId.** Eventos SSE enviados ao browser incluem `projectId` no payload JSON. Clientes existentes que ignoram o campo continuam funcionando. Arquivo: `aideck/src/server/routes/sse.ts`.
- **F1.T-004 — Remover watcher singleton de startServer.** O watcher que hoje é criado em `buildApp()` passa a ser criado pelo ProjectRegistry durante o registro do projeto inicial. Remover `opts.skipWatcher` — o registry gerencia isso. Arquivo: `aideck/src/server/index.ts`.

```yaml
exit_gate:
  - id: F1-G1
    description: Registrar 2 projetos cria 2 watchers independentes; file change em um emite evento apenas para aquele projectId
    verifier: { kind: test, runner: npm, pattern: "test -- --grep 'multi-watcher'" }
  - id: F1-G2
    description: Desregistrar um projeto para o watcher sem afetar o outro
    verifier: { kind: test, runner: npm, pattern: "test -- --grep 'unregister.*watcher'" }
```

## F2 — Rotas project-scoped no aiDeck

Goal: Adicionar rotas prefixadas por projectId para acessar state, entities e inbox de projetos especificos.

### Sub-fases (tarefas)

- **F2.T-001 — Rotas /api/projects/:projectId/state/:consumer.** Busca rootDir no registry pelo projectId, chama buildAllForConsumer com esse rootDir. 404 se projectId nao registrado. Arquivo: `aideck/src/server/routes/api.ts`.
- **F2.T-002 — Rotas /api/projects/:projectId/state/:consumer/:slug.** Mesmo pattern para entity lookup. Arquivo: `aideck/src/server/routes/api.ts`.
- **F2.T-003 — Backward-compat nas rotas existentes.** `/api/state/:consumer` continua funcionando: usa o projeto default do registry. Nenhuma rota existente muda de comportamento. Arquivo: `aideck/src/server/routes/api.ts`.
- **F2.T-004 — Rotas de inbox/annotate/highlight project-scoped.** `/api/projects/:projectId/inbox`, `/api/projects/:projectId/annotate`, etc. As rotas sem prefixo continuam usando o default. Arquivo: `aideck/src/server/routes/api.ts`.

```yaml
exit_gate:
  - id: F2-G1
    description: GET /api/projects/:id/state/project-status retorna state do projeto correto
    verifier: { kind: test, runner: npm, pattern: "test -- --grep 'project-scoped state'" }
  - id: F2-G2
    description: Rotas existentes sem prefixo continuam retornando state do projeto default
    verifier: { kind: test, runner: npm, pattern: "test -- --grep 'backward-compat'" }
```

## F3 — ensureAideck como registro

Goal: Modificar ensureAideck() no atomic-skills para registrar o projeto no aiDeck existente em vez de matar e reiniciar.

### Sub-fases (tarefas)

- **F3.T-001 — Substituir kill+restart por POST /api/projects/register.** Quando rootDir difere do aiDeck rodando, chamar `POST /api/projects/register` com `{ rootDir: cwd, id: derivedId }`. Se register retorna 200/201, retornar a URL com `?project=derivedId`. Arquivo: `atomic-skills/src/serve.js` linhas 200-224.
- **F3.T-002 — Derivar projectId do CWD.** `basename(cwd)` kebab-cased, truncado a 63 chars. Se colisao com id existente mas rootDir diferente, append numerico (`-2`, `-3`). Arquivo: `atomic-skills/src/serve.js`.
- **F3.T-003 — Atualizar contract test aideck-contract.test.js.** O teste que valida o fluxo ensureAideck precisa cobrir o cenario multi-projeto: aiDeck rodando com projeto A, ensureAideck chamado de projeto B registra B sem matar A. Arquivo: `atomic-skills/tests/aideck-contract.test.js`.

```yaml
exit_gate:
  - id: F3-G1
    description: ensureAideck de projeto B com aiDeck rodando para projeto A registra B sem matar A
    verifier: { kind: test, runner: npm, pattern: "test -- --grep 'multi-project register'" }
  - id: F3-G2
    description: projectId derivado do CWD e validado como slug
    verifier: { kind: test, runner: npm, pattern: "test -- --grep 'derive projectId'" }
```

## F4 — Dashboard multi-projeto na HomePage

Goal: Dashboard exibe projetos registrados como bands separadas na HomePage, cada um com seus planos e iniciativas.

### Sub-fases (tarefas)

- **F4.T-001 — API client: getProjects() e getProjectState(projectId).** `getProjects()` chama `GET /api/projects`. `getProjectState(projectId)` chama `GET /api/projects/:id/state/project-status`. Arquivo: `atomic-skills/src/dashboard/lib/api.ts`.
- **F4.T-002 — Adapter: adaptMultiProjectForHome().** Recebe array de `{project, state}`, retorna `UIConsumer[]` com um consumer por projeto. Cada consumer tem `id: projectId`, `name: projectName`, `path: rootDir`. Arquivo: `atomic-skills/src/dashboard/lib/adapters.ts`.
- **F4.T-003 — HomePage busca todos os projetos.** Novo hook `useMultiProjectState()` que faz getProjects() seguido de getProjectState() para cada. Renderiza N ConsumerBands. Fallback: se /api/projects retorna 404 (aiDeck antigo), cai no fluxo single-project existente. Arquivo: `atomic-skills/src/dashboard/pages/HomePage.tsx`, `atomic-skills/src/dashboard/lib/hooks.ts`.
- **F4.T-004 — SSE invalidation project-aware.** useStateChangeSubscription() usa projectId do evento para invalidar apenas as queries daquele projeto. Arquivo: `atomic-skills/src/dashboard/lib/hooks.ts`.

```yaml
exit_gate:
  - id: F4-G1
    description: HomePage renderiza 2 ConsumerBands quando 2 projetos registrados
    verifier: { kind: manual, description: "Registrar 2 projetos via API, abrir dashboard, verificar 2 bands visualmente" }
  - id: F4-G2
    description: Dashboard funciona com aiDeck antigo (sem /api/projects) via fallback single-project
    verifier: { kind: manual, description: "Apontar dashboard para aiDeck sem rotas /api/projects, verificar que homepage carrega normalmente" }
```

## F5 — Navegacao project-scoped no Dashboard

Goal: Rotas, links e navigation do dashboard incluem contexto de projeto para que planos/iniciativas de projetos diferentes nao colidam.

### Sub-fases (tarefas)

- **F5.T-001 — Rotas com prefixo /:projectId.** `/:projectId/plans/:slug`, `/:projectId/initiatives/:slug`, `/:projectId/discover`. Rotas sem prefixo continuam funcionando (usam projeto default). Arquivo: `atomic-skills/src/dashboard/App.tsx`.
- **F5.T-002 — ConsumerBand links usam projectId.** Cada PlanRow e InitiativeRow navega para `/:projectId/plans/:slug` em vez de `/plans/:slug`. Arquivo: `atomic-skills/src/dashboard/components/home/HomeComponents.tsx`.
- **F5.T-003 — PlanPage e InitiativePage extraem projectId do URL.** `useParams()` extrai projectId, passa para as chamadas de API project-scoped. Arquivo: `atomic-skills/src/dashboard/pages/PlanPage.tsx`, `atomic-skills/src/dashboard/pages/InitiativePage.tsx`.
- **F5.T-004 — Project selector no TopChrome.** Dropdown ou breadcrumb no header mostrando o projeto ativo, com link para home. Arquivo: `atomic-skills/src/dashboard/components/layout/LayoutShell.tsx`.

```yaml
exit_gate:
  - id: F5-G1
    description: Clicar num plano do projeto B navega para /project-b/plans/slug (nao /plans/slug)
    verifier: { kind: manual, description: "Registrar 2 projetos, clicar num plano do segundo, verificar URL inclui projectId" }
  - id: F5-G2
    description: Rotas sem prefixo continuam funcionando para backward-compat
    verifier: { kind: manual, description: "Abrir /plans/existing-slug sem projectId, verificar que carrega o plano do projeto default" }
```
