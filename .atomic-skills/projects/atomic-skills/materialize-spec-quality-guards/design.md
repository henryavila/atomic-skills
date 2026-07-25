# Design: materialize-spec-quality-guards

## Context

O ciclo `project new plan` → `materialize` → `implement` já separa **presença** de contrato (`businessIntent` 5 fields, SPEC 4 HOW, lazy F0-only) de **qualidade** e **fidelidade** do contrato. Três falhas residuais ainda deixam passar trabalho “verde” que implementa a coisa errada:

1. **R1 — rubber-stamp de `businessIntent`.** `find-missing-business-intent.js` só prova campo presente / não-vazio / não-`[NEEDS CLARIFICATION]` (D4). A eficácia anti-rubber-stamp é hipótese D9, não garantia.
2. **R2 — source/SPEC fraco no admit.** `lint-source.js --spec` exige Files / scopeBoundary / acceptance / verifier determinístico, mas aceita verifier teatro (`exit 0`) e acceptance desconectada do verifier.
3. **R3 — rewrite de tasks no `materialize`.** O contrato de skill manda reusar o sidecar (`.source.json`); o publish path `materialize-state.js` não impede initiative com SPEC core diferente do sidecar.

Este design endurece esses três pontos com **detectores zero-token fail-closed** e skill UX proof-of-work — sem LLM no path crítico e sem auto-preencher `businessIntent` (vetado em `docs/kb/automate-orchestrator-realism.md`).

**Evidência (G1):**

```
// scripts/find-missing-business-intent.js — detector só presença
// "The detector is the replicable gate: it HARD-BLOCKS (exit 1) when any
//  materialized phase is missing a spine field"
// SPINE_FIELDS = ['value', 'workflow', 'rules', 'outOfScope', 'doneWhen']
// BLANK_MARKER = '[NEEDS CLARIFICATION]'
```

```
// docs/kb/project-lazy-materialization.md
// D9 - gate-como-hipótese: prova presença, não eficácia anti-rubber-stamp
// D10 - constituição de anti-patterns é non-goal / iniciativa separada
```

```
// scripts/materialize-state.js — single authority de publish, sem fingerprint de tasks
// materializePair({ planPath, initiativePath, planContent, initiativeContent, ... })
```

```
// scripts/lint-source.js --spec — 4 HOW fields; isDeterministicVerifier;
// não rejeita verifier tautológico tipo "exit 0" / "true"
```

## Decisions

1. **Entregar o pacote completo P0–P3 + instrumentação D9 measure** neste plano (não só P0). Ordem de ship: P0 → P1 → P2 → P3; cada fase tem exit gate com detector/tests que a fase introduziu.
2. **R1 — lint de qualidade da spine é HARD-BLOCK** em `materialize` e no gate F0 de `new plan`, no mesmo molde exit-0/1 de `find-missing-business-intent.js`. Limiares calibráveis (constantes no script + testes de golden), não “opinião do agente”.
3. **R1 — UX proof-of-work na skill:** o agente **não** pré-preenche os 5 fields da resposta do usuário; “ok/yes/do it” genérico **não** conta como spine aceita (espelha ratify). Pode oferecer perguntas/exemplos **separados**.
4. **R2 — verifier smoke no admit:** estender `lint-source.js --spec` (ou detector irmão invocado no mesmo gate) para rejeitar verifiers tautológicos e incompletos de forma determinística; checar que paths de teste/comandos não são placeholder. **Seed ban (HARD, exact-match após trim do corpo do comando, estendível via golden fixtures):** `exit 0`, `true`, `:`, corpo vazio, `echo ok`, `echo OK`. incompletos já cobertos em parte por `isIncompleteQueryVerifier`; smoke cobre shell/test tautológicos.
5. **R2 — acceptance↔verifier overlap:** WARN no SPEC gate + finding no `review-plan` initiative-depth; HARD só quando **zero** overlap e verifier não-manual. **Interseção (determinística):** (a) basenames normalizados de paths em `Files:` + linhas de `acceptance:` + string do `verifier:`; (b) tokens argv0/subcommand do comando shell/test (split whitespace, sem flags `-x`). Pass fixture: acceptance menciona `lint-source.js` e verifier roda esse path. HARD-fail fixture: acceptance só prosa sem path/token e verifier é `npm test -- foo` sem menção mútua.
6. **R2 — revalidação de sidecar velho:** opt-in no `materialize` se o sidecar tem idade > N dias (constante, default 14) **ou** task count > K (default 12): perguntar “Revalidar SPEC desta fase?”; default **não** re-decompõe. **Idade** = `capturedAt` no sidecar se existir; senão mtime do `.source.json`; senão `plan.started` (último recurso).
7. **R3 — `tasksFingerprint` no sidecar + allowlist no `materialize-state`:** publish **recusa** se o core SPEC das tasks divergir. **Core (mesmos conceitos do sidecar/initiative, não “outputs paths” solto):** `id`, `title` (normalizado: trim + collapse whitespace), `files`/`Files` paths ordenados, `scopeBoundary[]` ordenado, `acceptance[]` ordenado, `verifier` canônico (kind+command). **Titles-only rewrite** após normalize → **refuse** (title é core). Campos allowlist: `summary`, `weight`, `businessIntent`, `startedCommit`, `status`, `nextAction`, rollups, evidence.
8. **R3 — mutação de SPEC na ativação** só via verbo/caminho explícito (`re-spec` documentado ou re-decompose + ratify), nunca como side-effect silencioso de `materialize`.
9. **D9 measure (P3):** emitir eventos/analytics mínimos (materialize com lint fail na 1ª tentativa; refuse por fingerprint; phase-reopen / task reopen em janela) e um script de relatório. **Não** promete prova causal de “menos rubber-stamp”; só instrumenta a hipótese.
10. **D10 constituição full de anti-patterns permanece non-goal** deste plano (D10 original). Red-flags pontuais nas skills tocadas + testes de integração bastam.

## Chosen approach

**Abordagem: detectores aditivos zero-token + fail-closed no publish + skill UX, sem LLM no path crítico.**

| Camada | Mecanismo |
|--------|-----------|
| Spine quality (R1) | Novo detector (ou extensão clara de `find-missing-business-intent`) — min length, ban soft-language (G2), `outOfScope` ≠ eco de `value`, `doneWhen` com token observável |
| Skill UX (R1) | `project-materialize.md` + F0 gate em `project-create-plan.md` — blank fields, anti-pré-preenchimento, anti-ok-genérico |
| SPEC smoke (R2) | `lint-source.js --spec` estendido + testes unitários de golden |
| Overlap (R2) | Heurística determinística path/comando em acceptance ∩ verifier; WARN/HARD conforme decisão 5 |
| Sidecar age (R2) | Preflight em `project-materialize.md` + helper node se necessário |
| Fingerprint (R3) | `captureVersion` continua; campo `tasksFingerprint` no `.source.json` na captura; check em `materializePair` / CLI |
| D9 measure (P3) | JSONL analytics + `scripts/report-plan-quality.js` (ou extensão de completions) |

**Alternativas pesadas e rejeitadas** — ver `## Rejected alternatives`.

**Por que esta ganhou:** alinha ao molde já shipado (exit-0/1, zero-token, host-agnostic); não reintroduz LLM no gate; respeita “spine is operator authority”; dá dente real no R3 (skill-only já falhou na prática de agentes).

## Blast radius

Decisões com custo de reverter / blast em todos os planos:

| Decisão | Reversibilidade | Contenção |
|---------|-----------------|-----------|
| HARD quality spine | Alto atrito operacional se limiares ruins | Constantes + golden tests; flag de env **não** — preferir calibrar limiares e documentar exemplos pass/fail; se necessário, `--allow-weak-spine` só em testes |
| `tasksFingerprint` refuse | Quebra materialize se agent reescreve tasks (intencional) | Allowlist explícita; path `re-spec` documentado; testes round-trip sidecar→initiative |
| SPEC smoke HARD | Bloqueia `new plan` com verifiers fracos | Mensagens acionáveis; só kinds shell/test/query já admitidos |
| Analytics D9 | Baixo | Append-only; fail-open se analytics ausente |

Não é migração de dados de usuário em produção externa; é contrato de tooling no monorepo atomic-skills e installs. Sidecars antigos **sem** fingerprint: materialize exige recompute a partir do sidecar atual (hash do conteúdo de tasks no load) — se ausência de campo, calcular on-the-fly e **não** recusar só por falta de campo (compat); recusar só se fingerprint presente **e** mismatch, ou se sempre calcular do sidecar vs initiative (preferido: **sempre** hash do sidecar live vs initiative core — campo gravado é otimização/audit).

**Decisão de compat (load-bearing):** na ativação, o adjudicator é **hash(live sidecar tasks core) vs hash(initiative tasks core)**; o campo `tasksFingerprint` no sidecar é escrito na captura para audit e testes, mas o refuse não depende de sidecars legados terem o campo.

## Non-goals

- Auto-preencher `businessIntent` com LLM e pedir “aprova?” (validation theatre).
- Auto-materialize no `phase-done` sem parar no spine humano.
- Detector semântico LLM no path exit-0/1 crítico.
- Constituição D10 full (catálogo global de anti-patterns consultado por todos os gates).
- Provar causalmente que R1 reduz rework (só medir — D9).
- Re-decompose silencioso de todas as fases no `new plan` (lazy F0 permanece).
- Segunda skill top-level `automate` / reimplementar implement.

## Rejected alternatives

1. **Só skill prose / red-flags (sem detector)** — barato; não fecha R1/R3 sob pressão de agente. Rejeitado: sem dente.
2. **WARN-only em spine quality** — reduz atrito; deixa rubber-stamp como default. Rejeitado pelo operador (HARD).
3. **Fingerprint WARN-only** — reporta rewrite mas publica. Rejeitado: R3 precisa refuse.
4. **LLM quality judge da spine** — não-reprodutível; fura molde zero-token. Rejeitado.
5. **Escopo só P0** — deixa R2/R3 abertos. Rejeitado pelo operador (pacote completo + D9 measure).
6. **D10 constituição neste plano** — curadoria grande, escopo inchado; D10 original já split. Rejeitado como non-goal.

## Open questions

1. Limiares exatos de min-length / ban-list tokens para PT (install language `pt`) vs EN — calibrar na F0 com fixtures reais de spines boas/ruins do monorepo.
2. Janela exata de “rework” para D9 (7 vs 14 dias) — default 14; ajustar com primeiro relatório.
3. Nome do verbo de re-spec (`project re-spec <phase>` vs documentar “edit source + re-capture”) — decidir na fase R3 com mínimo de superfície de comando.

## Implementation sketch (não é task list final)

Mapa P↔F (ship labels → fases):

| Ship | Fase | Entrega |
|------|------|---------|
| P0 | **F0** | Detector spine quality + wiring materialize/new-plan F0 + skill UX anti-pré-preenchimento + golden tests |
| P1 | **F1** | Hash live tasks core + allowlist no `materialize-state` + refuse + skill red-flag R3 |
| P2 | **F2** | Verifier smoke + acceptance overlap + review-plan depth + opt-in sidecar age |
| P3 | **F3** | D9 measure (eventos + report) + docs kb |
| (integração) | **F4** | Suite regressão R1/R2/R3 + surface install/skills + dogfood gates |

Critic nits F-001/F-002/F-003 incorporados nas Decisions 4–7 e neste mapa (2026-07-22).

## Self-review against code-quality gates

- G1 read-before-claim: applied — claims sobre find-missing-business-intent, materialize-state, lint-source, D9/D10 citam trechos/paths versionados acima
- G2 soft-language: applied — decisões usam deve/recusa/HARD-BLOCK; ban should/probably em claims de garantia
- G6 reference-or-strike: applied — cada claim de comportamento atual aponta script/doc; eficácia anti-rubber-stamp marcada como hipótese (D9), não fato
