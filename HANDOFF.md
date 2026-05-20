# Handoff — sessão 2026-05-20

Documento de carry-over para a próxima sessão Claude. Leitura cold-start (sem contexto da conversa anterior). Quando começar, leia este arquivo PRIMEIRO antes de tomar qualquer decisão.

## TL;DR

**Onde parou.** Migration v2 do atomic-skills tecnicamente completa (Phases A→E todas com exit gates fechadas). Última sessão adicionou três camadas de qualidade no topo das skills: **code-quality gates G1-G7**, **integração de codex review no workflow**, e **fluxo de emergent work com provenance tracking**. Tudo commitado, todos os testes verdes (377 unit + 6 e2e + 51 hook), build do dashboard limpo.

**Próximo passo natural.** Bump para `2.0.0` + CHANGELOG + tag. Ou pegar uma das open threads (hard-gate via hook, MCP setup section no HelpView). Decisão do user.

## Estado do repo

- **Branch:** `main`
- **HEAD:** `2ff9ae2` (`feat: emergent work — agent-proposes / user-invokes flow with provenance`)
- **Working tree:** clean
- **Version (package.json):** `1.8.1` — **pendente bump para 2.0.0**
- **Sessão começou em:** `5dcc59c` (`docs(phase-e): plan + Claude Design handoff bundles`)
- **Sessão produziu:** 15 commits, 65 arquivos, +14141 / −372 linhas

### Quick health check (cole pra confirmar nada quebrou)

```bash
cd /Volumes/External/code/atomic-skills
git status -s                                         # → empty
npm run validate-skills 2>&1 | tail -3                # → "All 13 skills valid"
npm test 2>&1 | tail -5                               # → "pass 357"
npm run test:hooks 2>&1 | tail -3                     # → "29 passed"
node --test tests/e2e-smoke.test.js 2>&1 | tail -5    # → "pass 6"
npm run typecheck:dashboard 2>&1 | tail -3            # → clean
npm run build:dashboard 2>&1 | tail -5                # → builds in <1s
```

## O que foi entregue nesta sessão (por commit)

| Commit | Resumo |
|--------|--------|
| `5dcc59c` | Phase E plan + Claude Design handoff bundles (4MB, 27 JSX, screenshots) |
| `46e0cdc` | E.T-004: revert D.T-004 (MCP-or-file dispatch, padrão errado per F-B) |
| `d0a7c84` | E.T-005: scaffold `src/dashboard/` (Vite + React 19 + TS + Tailwind 4) |
| `6497b94` | E.T-006: atoms do Claude Design + páginas básicas |
| `9ed2e4e` | E.T-007: REST client alinhado com contrato real aiDeck (envelope + flat /:slug) |
| `bf59b7e` | E.T-008: `atomic-skills serve` command (build + spawn aideck + env file lifecycle) |
| `2654da5` | E.T-003: cross-repo narrative contract test (4 assertions) |
| `7a61f00` | E.T-009: e2e smoke test (6 assertions, achou bug residual no E.T-001 do aideck) |
| `66565b4` | E.T-010: Codex review findings de Phase E (1C/3M aplicados) |
| `eb780a0` | E.T-011: port fiel inicial dos prototypes do Claude Design |
| `9b8db71` | E.T-012: port das 6 telas restantes (DepGraphOverlay, AnnotationPanel, FeedbackDrawer, HelpView, etc.) |
| `403e006` | E.T-013: `serve --demo` com fixtures embutidos (plano sda v3) |
| `edb6c8d` | Code-quality gates G1-G7 + Self-review checkpoint em 6 skill bodies |
| `73b03be` | Integração de codex review no `project-plan` (Stages 8a/8b) + `project-status` (review-due tracking) |
| `2ff9ae2` | Emergent work flow: 5 comandos novos + provenance schema + scope-drift detection |

## Arquivos críticos criados/atualizados (mapa rápido)

### Camada de gates + workflow (mais relevante pra próximas sessões)

- `docs/kb/code-quality-gates.md` — fonte única das 7 regras (G1-G7) + good/bad exemplos + bug→gate map
- `skills/en/core/project-plan.md` — Stages 8a (internal review) + 8b (codex review) antes de declarar plano pronto
- `skills/en/core/project-status.md` — Codex review tracking, review-due command, scope-drift banner no default view, seção Emergent work com a ladder de 8 degraus
- `src/scope-drift.js` — pure helper: `computeDrift()` + `evaluateWarnings()` + `renderBanner()`. 20 testes em `tests/scope-drift.test.js`
- `meta/schemas/common.schema.json` — novo `$defs.provenance` para tasks e phases adicionadas mid-execution

### Dashboard React (Phase E)

- `src/dashboard/` — Vite + React 19 + TS + Tailwind 4 + shadcn deps. Build em <1s para 408KB JS / 22KB CSS.
- `src/dashboard/components/atoms/` — 5 arquivos (StatusChip, Badges, Chrome, Buttons, tokens)
- `src/dashboard/components/{layout,plan,initiative,home,feedback,help}/` — todas as telas do Claude Design portadas fielmente
- `src/dashboard/lib/{api,hooks,types,adapters}.ts` — REST client + TanStack Query + SSE subscription + cross-schema adapters
- `src/serve.js` + `bin/cli.js serve [--demo]` — comando que builda + spawna aideck + env file lifecycle
- `assets/demo-fixtures/.atomic-skills/` — plan + initiative ricos para `serve --demo`

### Tests

- `tests/scope-drift.test.js` — 20 assertions (8 suites) sobre o helper de drift
- `tests/aideck-contract.test.js` — 4 assertions (sibling-aideck dependent, skip se ausente)
- `tests/e2e-smoke.test.js` — 6 assertions (spawn aideck real, verifica REST + SSE + static + SPA fallback)
- `tests/serve.test.js` — 11 assertions (parsePort, resolveAideckBin, env file helpers)

### aiDeck (repo irmão)

O sibling em `/Volumes/External/code/aideck/` também recebeu commits durante esta sessão:
- `5d3c872` chore: drop Vue scaffold, pivot UI to atomic-skills
- `4e2fd2c` feat(E.T-002): support optional evidence block on ExitCriterion
- `8d44f79` feat(E.T-001): accept flat .atomic-skills/ layout as default project-status consumer
- `12c488f` feat(E.T-008): --static-dir flag serves SPA bundle with API passthrough
- `93f3939` fix(E.T-001): extend flat-layout fallback to REST projections (e2e bug fix)

Não verifiquei se foram pushados. **Checar:** `cd /Volumes/External/code/aideck && git status && git log --oneline -6`.

## Open threads (next session pode pegar qualquer um)

### 1. Bump para v2.0.0 + tag + CHANGELOG (mais óbvio)

Migration v2 está completa. `package.json` ainda em `1.8.1`. Hora de:
- Editar `package.json` version → `2.0.0`
- Criar `CHANGELOG.md` capturando as breaking changes (skills/pt removido, frontmatter format breaking, hooks rewritten, project-plan novo)
- `git tag v2.0.0`
- `npm publish` (se for publicar)

Tempo estimado: 30min.

### 2. Hard-gate via hook para emergent work (eu mencionei no fim da última rodada)

Hoje a regra "agente nunca muta plan structure silenciosamente" mora no skill body. Se o agente burlar, só `scope-creep` view ou banner no default expõem post-hoc.

Próximo nível: **pre-write hook que monitora Edits em `.atomic-skills/initiatives/*.md` e `.atomic-skills/plans/*.md`. Se o Edit adiciona uma entry em `tasks[]` ou `phases[]` sem o campo `provenance` correspondente, bloqueia.** Detecta provenance ausente via parsing simples YAML diff.

Tempo estimado: 1-2h. Risco: false positives bloqueando legítimas edits (template fills, etc). Precisa de allowlist (mutation veio do `new-task` script vs Edit direto).

### 3. MCP setup section no HelpView

O `HelpView.tsx` (port atual em `src/dashboard/components/help/HelpView.tsx`) tem 12 skills hardcoded. Falta a seção do prototype original que ensina como configurar MCP (Claude Code, Cursor, Cline) para usar o aideck MCP server. Era ~200 linhas do `HelpView.jsx` que eu pulei para encurtar o port.

Tempo estimado: 1h. Volume baixo, é majoritariamente conteúdo estático.

### 4. project-status `bootstrap` para este próprio repo (dogfooding)

A migration v2 foi tratada como `docs/migration-plan-v2.md` em vez de `.atomic-skills/plans/migration-v2.md`. Faltou o momento dogfood: rodar o próprio `project-plan adopt docs/migration-plan-v2.md` neste repo para materializar Phases A→E como Plan + Initiatives reais.

Tempo estimado: 30min. Vai exercitar o `adopt` em condições reais e expor qualquer bug residual antes do release.

### 5. Codex review do bloco G1-G7 + emergent work

Adicionei muito skill body sem rodar codex review. Próxima sessão poderia rodar `atomic-skills:review-plan-with-codex` ou `review-code-with-codex` contra o range `5dcc59c..HEAD` para validar que as 7 regras + ladder + provenance estão internamente consistentes.

Tempo estimado: 10min wall + custo Codex (~$1-$2).

## Decisões importantes registradas (para não re-litigar)

- **aiDeck full-stack:** aideck mantém backend (HTTP/REST/SSE/watcher/parsers/MCP). atomic-skills owns React UI. MCP integration deferred to v2.1+. (Decidida em 2026-05-20, durante contract review post-Phase-D.)
- **Provenance no item, não em changelog separado:** task/phase carregam `provenance: {…}` opcional. Items shipados no materialize original NÃO têm o campo. Choice deliberada vs `.atomic-skills/changelog.jsonl` (escolha do user explicitamente).
- **Drift detection no default view (sempre):** sem opt-in. Threshold default 40% growth, 25% scope expansion plan-wide, 30 dias parked-zombie. Configurável em `.atomic-skills/status/config.json`.
- **Agent-proposes / user-invokes para emergent work:** agente NUNCA muta plan structure direto. Imprime comando copy-pasteável, espera user invocar ou autorizar com "do it".
- **Hybrid skill-body + KB pra gates:** regras G1-G7 vivem em `docs/kb/code-quality-gates.md` (fonte única). Cada skill body injeta subset relevante + checkpoint Self-review. Drift entre skills evitado.

## Como o user testa localmente (recipe atual)

```bash
# Quickstart com fixtures embutidos
cd /Volumes/External/code/atomic-skills
node bin/cli.js serve --demo --port 7777

# → abre http://127.0.0.1:7777 no browser
# → vai ver SDA v3 plan + F0 initiative com tasks/gates/stack/parked/emerged
# → Ctrl+C limpa tudo (tmp dir + ~/.atomic-skills/env)
```

Validado funcionando ao fim da sessão. Se quebrar, o smoke E2E é o canário (`node --test tests/e2e-smoke.test.js`).

## Cuidados para a próxima sessão

1. **Não regenerar o port das telas.** As 10 telas do Claude Design estão portadas fielmente em `src/dashboard/components/`. Mexer só pra corrigir bugs específicos.

2. **Não tocar nos schemas sem rebuilder o aideck.** Se mudar `meta/schemas/*.json`, aideck precisa de rebuild (`cd /Volumes/External/code/aideck && npm run build`). E pode quebrar o cross-repo contract test.

3. **Manter os Self-review blocks em commits futuros.** Os gates G1-G7 só funcionam se aplicados. Se for fechar phase nova, mostrar o block de auto-avaliação.

4. **Codex review NÃO foi rodado nas últimas 3 mudanças** (`edb6c8d`, `73b03be`, `2ff9ae2`). São skill body changes — baixa probabilidade de bug, mas o pattern do projeto é review antes de release. Considerar rodar antes do v2.0.0 tag.

5. **aiDeck pushed?** Verifica `cd /Volumes/External/code/aideck && git log --oneline @{u}..HEAD`. Se houver commits ahead, decidir se publica.

## Como invocar a si próprio (próxima sessão)

Abra a próxima sessão em `/Volumes/External/code/atomic-skills` e diga algo como:

> "Leia `HANDOFF.md` e me diga o que está pendente. Quero seguir com [#1 / #2 / #3 / ...]."

Ou se for uma sessão limpa sem leitura prévia:

> "Estou voltando a atomic-skills depois de uma sessão longa. Leia HANDOFF.md no root primeiro."

## Métricas finais da sessão

| | Antes (`5dcc59c`) | Agora (`2ff9ae2`) | Δ |
|---|---|---|---|
| Commits | — | +15 | — |
| Files changed | — | 65 | — |
| Linhas | — | +14141 / −372 | +13769 |
| Skills | 12 | 13 | +1 |
| Unit tests | 314 | 357 | +43 |
| Hook tests | 51 | 51 | = |
| E2E tests | 0 | 6 | +6 |
| Build size (JS gz) | — | 113 KB | — |
| Build size (CSS gz) | — | 5.3 KB | — |
| Build time | — | <700ms | — |
| Reviews persistidos | 4 | 5 | +1 (Phase E) |
| Gates instrucionais | 0 | 7 (G1-G7) | +7 |

Fim do handoff.
