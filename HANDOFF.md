# Handoff — sessão 2026-05-21

Documento de carry-over para a próxima sessão Claude. Cold-start ready (sem contexto da conversa). Leia este arquivo PRIMEIRO antes de tomar qualquer decisão.

## TL;DR

**Onde parou.** A camada de `emergent work` ganhou a peça que faltava: **ratify obrigatório** com bloco `context` (solves/trigger/assumesStillValid) em todo item criado on-the-fly. O hook `pre-write.sh` enforce isso mecanicamente, o skill body documenta o fluxo agente-propõe / usuário-ratifica / agente-commits, o `src/scope-drift.js` agora detecta items com contexto envelhecido. Schema mudou de forma breaking (parked/emerged exigem context). Production ainda em 1.8.1, próximo release planejado: **1.9.0**.

**Próximo passo natural.** Executar o `HANDOFF-cross-repo-context.md` (aideck zod + dashboard types/adapters) — ~1h. Depois CHANGELOG + bump 1.8.1 → 1.9.0 + tag.

## Estado do repo

- **Branch:** `main`
- **HEAD:** `8f9579b` (scope-drift staleness + cross-repo handoff doc)
- **Working tree:** clean
- **Version (package.json):** `1.8.1` — **pendente bump para 1.9.0**
- **Sessão começou em:** `4a28f80` (handoff anterior)
- **Sessão produziu:** 5 commits, 18 arquivos, +2114 / −74 linhas

### Quick health check

```bash
cd /Volumes/External/code/atomic-skills
git status -s                                         # → empty
npm run validate-skills 2>&1 | tail -1                # → "All 13 skills valid"
npm test 2>&1 | grep "ℹ pass\|ℹ fail" | head -2       # → "pass 368, fail 0"
npm run test:hooks 2>&1 | tail -1                     # → "58 passed, 0 failed"
npm run typecheck:dashboard 2>&1 | tail -3            # → clean
```

## O que foi entregue nesta sessão (por commit)

| Commit | Resumo |
|--------|--------|
| `45453d6` | pre-write.sh hook (HANDOFF #2 anterior — provenance gate em Edit/Write/MultiEdit) |
| `3fbadba` | ratify mandatory + bloco `context` exigido por schema em parked/emerged + conditional em task/phase |
| `46add74` | hook estende para parked/emerged + `staleContextDays`/`parkedZombieDays` no config; memoria registrada sobre versionamento |
| `8f9579b` | `computeStaleContext` em src/scope-drift.js + HANDOFF-cross-repo-context.md para a peça que falta antes do release |

## Arquivos críticos criados/atualizados (mapa rápido)

### Schema
- `meta/schemas/common.schema.json` — novo `$defs.context` (solves/trigger/assumesStillValid/ratifiedAt/ratifiedBy/lastReviewedAt)
- `meta/schemas/initiative.schema.json` — task ganha context condicional (`if provenance then context`); parked/emerged exigem context unconditionalmente
- `meta/schemas/plan.schema.json` — phaseDescriptor ganha context condicional

### Hooks
- `skills/shared/project-status-assets/hooks/pre-write.sh` — PreToolUse hook que gate Edit/Write/MultiEdit em `.atomic-skills/{initiatives,plans}/*.md`. Detecta tasks/phases/parked/emerged sem provenance OU sem context.{solves,trigger,ratifiedAt}. Dry-run default, strict opt-in.
- `skills/shared/project-status-assets/hooks/config.json` — knobs novos: `emergent_strict_mode`, `staleContextDays: 14`, `parkedZombieDays: 30`
- `skills/shared/project-status-assets/hooks/README.md` — documenta pre-write.sh, log format, bypass

### Skill body
- `skills/en/core/project-status.md` — seção "Emergent work" renomeada para "proposal / ratify / commit pattern"; todos os 8 comandos da ladder ganham ratify gate; novos comandos `why <id>` e `re-ratify <id>`; views (default, --list, scope-creep) mostram `solves` inline

### Lib
- `src/scope-drift.js` — novo `computeStaleContext()` + integração em `computeDrift()`/`evaluateWarnings()`/`renderBanner()`. `DEFAULT_THRESHOLDS` ganha `staleContextDays: 14`.
- `src/migrate.js` — legacy parked/emerged ganham placeholder context honesto durante migração

### Fixtures
- `tests/fixtures/state/initiatives/v3-f0-foundation-repair.md` — emerged[0] ganhou context real ratificado
- `assets/demo-fixtures/.atomic-skills/initiatives/v3-f0-foundation-repair.md` — parked[0] + emerged[0] ganharam context completo

### Tests
- `tests/validate-state.test.js` — 3 testes novos (context required iff provenance; complete context passes; parked-sem-context falha)
- `tests/hooks/pre-write.test.sh` — 17 → 23 cases (T18-T19: partial context; T20-T23: parked/emerged gating + regressão)
- `tests/scope-drift.test.js` — 8 testes novos para `computeStaleContext` + assertion de threshold keys

### Memória
- `.ai/memory/feedback-versioning.md` — não inflar versão autonomamente; usuário prefere minor (1.x.y) mesmo para mudanças de schema

### Docs
- `HANDOFF-cross-repo-context.md` — handoff específico para o trabalho cross-repo antes de cortar v1.9.0 (aideck zod + dashboard types/adapters)

## Open threads

### 1. Cross-repo plumbing (HANDOFF-cross-repo-context.md) — ~1h

Levar `context` para aideck (zod validators) + dashboard (TS types + adapters). Sem isso o release funciona mas o dashboard nunca mostra `solves`/`trigger`, e o aideck dropa silenciosamente o campo no parse. Documento auto-contido com diffs concretos antes/depois — peg up cold em uma sessão.

**Decisão do usuário** (registrada na conversa): vai fazer isso antes de lançar a versão.

### 2. Release v1.9.0 — ~15 min após (#1)

- Bump `package.json` 1.8.1 → 1.9.0
- Escrever `CHANGELOG.md` cobrindo: pre-write hook, ratify+context obrigatório, gate parked/emerged, why/re-ratify, scope-drift staleness, cross-repo plumbing
- `git tag v1.9.0`
- `npm publish` (opcional)

**NÃO bumpar versão sem perguntar** — registrado em `.ai/memory/feedback-versioning.md`. Usuário decide qual versão (1.9.0 confirmado).

### 3. Codex review do range completo (opcional, recomendado pré-release) — 10 min + ~$1-2

Range `4a28f80..HEAD` (5 commits, ~2100 linhas) não passou por codex review. Patrão do projeto é review pré-release. Comando: `atomic-skills:review-code-with-codex`.

### 4. Dogfood: `project-plan adopt` para este repo (deferido da sessão anterior) — 30 min

A migração v2 foi tratada como doc plana (`docs/migration-plan-v2.md`) em vez de Plan + Initiatives reais. Rodar `project-plan adopt` materializaria as Phases A→E como estrutura `.atomic-skills/` real. Vai exercitar `adopt` em condições reais — bom regression test, ruim timing (depois do release).

### 5. MCP setup section no HelpView (deferido da sessão anterior) — 1h

~200 linhas de conteúdo estático (configuração MCP para Claude Code/Cursor/Cline) pulado durante port do Claude Design. Baixa prioridade, conteúdo majoritariamente estático.

## Decisões importantes registradas

- **Ratify é obrigatório, não opt-in.** Reflexo "yes"/"ok"/"do it" NÃO conta como ratify — usuário tem que tipar literal `ratify` ou colar bloco editado. Sem isso o gate vira ceremonial e perde a função.
- **Context vive no item (frontmatter YAML), não em sidecar log.** Sobrevive archive, audita por grep, sem dual-write divergência, ratify tem onde escrever.
- **`parked[]` e `emerged[]` exigem context UNCONDITIONALLY.** São emergentes por definição. Tasks/phases usam `if/then` porque podem ser original-materialization.
- **Original-materialization items não têm context.** Narrativa vive no body do plan/initiative — duplicar em cada task seria ceremonial e apodreceria.
- **`re-ratify` AVANÇA `ratifiedAt`, não anexa.** Audit trail vive no git history do .md, não em campo separado, pra evitar context bloat.
- **Não inflar versão autonomamente.** Production em 1.8.1, próximo 1.9.0 (não 2.0.0 como handoff anterior sugeria). Registrado em `feedback-versioning.md`. O texto "Frozen at 0.1 for atomic-skills v2.0.0" no `common.schema.json` foi corrigido para frase agnóstica.
- **Hook é dry-run por default.** Strict mode opt-in via `emergent_strict_mode: true` após drift.log limpo por 7+ dias. Knob independente do `strict_mode` da stop.sh.

## Como o usuário testa localmente (recipe atual)

```bash
cd /Volumes/External/code/atomic-skills
node bin/cli.js serve --demo --port 7777
# Abre http://127.0.0.1:7777
# Vai ver demo fixtures com parked + emerged carregando context real
# Quando #1 (HANDOFF-cross-repo-context) fechar, ParkedPanel/EmergedPanel
# vão mostrar o `solves` inline abaixo do título.
```

## Cuidados para a próxima sessão

1. **Não tocar nos schemas sem rebuild do aideck.** Se mudar `meta/schemas/*.json`, aideck precisa rebuild. E pode quebrar o cross-repo contract test.

2. **Não bumpar `package.json` sem perguntar.** Memória registrada: `feedback-versioning.md`. Próximo release decidido: 1.9.0.

3. **Não regenerar o port das telas do Claude Design.** As 10 telas já estão portadas fielmente em `src/dashboard/components/`.

4. **Antes de aplicar HANDOFF-cross-repo-context:** rebuild aideck PRIMEIRO (`cd /Volumes/External/code/aideck && npm run build`), ou o cross-repo contract test falha.

5. **Hook em strict mode pode bloquear edits legítimos.** Se for promover `emergent_strict_mode: true`, primeiro revise `.atomic-skills/status/emergent-drift.log` por 7+ dias de dry-run e confirme zero false positives.

## Métricas finais da sessão

| | Antes (`4a28f80`) | Agora (`8f9579b`) | Δ |
|---|---|---|---|
| Commits | — | +5 (incluindo o de pre-write da última fase da sessão anterior) | — |
| Linhas | — | +2114 / −74 | +2040 |
| Unit tests | 357 | 368 | +11 |
| Hook tests | 29 (session-start+stop) | 87 (+58 do pre-write) | +58 |
| Skills | 13 | 13 | = |
| Schemas com context | 0 | 3 (common, initiative, plan) | +3 |
| Memory files | 7 | 8 (+feedback-versioning) | +1 |

## Como invocar a próxima sessão

> "Leia `HANDOFF.md` e me diga o que está pendente. Quero seguir com #1 (cross-repo plumbing) antes do release v1.9.0."

Ou pra release direto:

> "Cross-repo plumbing já fechou (commits na main). Quero cortar v1.9.0 agora — escreva o CHANGELOG cobrindo as 5 mudanças desta linha de commits, bumpa o package.json e cria o tag."

Fim do handoff.
