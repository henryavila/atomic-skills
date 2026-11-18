# Audit Delivery — real-automate F4
**Date:** 2026-10-02T19:45:00Z
**HEAD:** 771849b2229dbf66fc57a4571d89a414fba8c54b
**Mode:** audit
**Depth:** light
**Axes:** product,residual
**Intent sources:** `.atomic-skills/projects/atomic-skills/real-automate/phases/f4-review-e-o-flow-no-audit.md` businessIntent; `plan.md` F4
**Verdict:** CLOSED
**verdict:** CLOSED

Degradação: Audit-delivery axes running inline in shared context — isolation degraded (`--depth=light`; sem fan-out de agentes). Residual via greps no parent.

Grafo lido: `.atomic-skills/projects/atomic-skills/real-automate/flow/flow.json`
`flowDocumentSha` = `8210bfc367f08e285b279b7dc69716d91df665281ffc2af1eebc1be619761285` = `ratifiedGraphSha` (match). Onde BI e grafo discordam, vale o grafo. Página final não substitui este gate.

## Graph coverage (HARD T-002)
machine corrida: pela metade
xor gates: faz
xor review_fase: pela metade
xor mais_fases: pela metade
xor review_plano: não faz
xor review_audit: não faz
xor validacao: não faz

Notas de cobertura (grafo vence BI; F5 fora de escopo da F4 não vira linha `faz`):
- `corrida`: T_recusa (F0) no `main`; T_parte grava `reviewExternalCli` na biblioteca, não pergunta no `main`; T_trava/T_muda da fase na biblioteca; T_*_plano / T_*_audit / T_relatorio / T_valida são F5.
- `gates`: `scripts/automate-run.js` ainda recusa partida sem caneta/flow/review/gt/cartão/UI.
- `review_fase`: `nextPhaseReviewAction` cobre segue/corrige/trava/muda; `main` só com `AUTOMATE_REVIEW_FINDINGS`.
- `mais_fases`: close-and-advance na biblioteca; `openNext` não injetado no `main`; ramo `nao` é F5.
- `review_plano` / `review_audit` / `validacao`: F5 (página, PR, `userValidatedAt`). O gate de phase-done que lê o grafo **não** é o xor `review_audit`.

## Intent Package
### Decisions
| ID | Decision | Why |
|----|----------|-----|
| D1 | Antes da primeira fase, uma pergunta grava `reviewExternalCli`. Both = review local + esse CLI. Recibo real (comando, exit, stderr, veredito). Ninguém pergunta de novo no meio. | Sem CLI persistido, `- internal:` vira recibo. |
| D2 | Agente isolado implementa `pending` na ordem do frontmatter; outro roda both. Brief leva grafo ratificado e esboço escolhido. Task complexa entra nesta review. | Unidade = fase corrente. |
| D3 | Achado grave/major → correção isolada, teto 3. Sem isso, leftovers no sidecar, fase fecha e a seguinte abre. Na terceira, travei. | Loop com teto. |
| D4 | Achado de mistura do bloco carimbado para na hora e não entra no loop. | Mistura não é retrabalho. |
| D5 | Audit lê `flow/flow.json` no `ratifiedGraphSha`; uma linha por máquina e xor (`faz`/`pela metade`/`não faz`); grafo vence BI; close path carrega o grafo; schema-invalid / hash throw / subjects vazios fail-closed. | P8. |
| D6 | Fechar a fase valida o claim e passa em `src/automate-product-fence.js`. | Close sem claim/fence. |

### Original problems
| ID | Problem | Expected fix shape |
|----|---------|-------------------|
| P1 | `overrideReason` sem stderr do CLI externo e recibo escrito pela sessão passavam | Recusa nos dois casos |
| P2 | Audit fechava sem linha do xor | Fixture com xor sem linha falha |
| P3 | Mistura do bloco entrava no loop de correção | Stop imediato, `enterLoop: false` |

### Acceptance / doneWhen
| ID | Criterion | Source |
|----|-----------|--------|
| A1 | `node --test tests/phase-review-gate.test.js` recusa `overrideReason` sem stderr e recibo de sessão | doneWhen / G-1 |
| A2 | Fixture `flow.json` com xor sem linha no relatório falha | doneWhen / T-002 |
| A3 | Mistura do bloco não entra no loop e para na hora | doneWhen / T-003 |
| A4 | Sem achado grave/major a fase fecha e a seguinte abre; na terceira, para | doneWhen / T-003 |

### Vocabulary delta
| OLD | NEW | Scope |
|-----|-----|-------|
| `- internal:` como recibo | recibo `command\|exit\|stderr\|verdict` do CLI | review |
| `overrideReason` sem stderr | override + stderr do processo | reviewGate |
| deliveryAuditGate sem `flow.json` | lê `flow/flow.json` @ `ratifiedGraphSha` | close |
| pergunta CLI no meio da corrida | `reviewExternalCli` uma vez | plano |
| park em `<slug>.json` (cursor) | `<slug>-residuals.json` | status |
| hash throw = SHA-equal / subjects vazios passam | fail-closed | audit |
| `merged; stopping` como fim da corrida | loop review/close/advance | programa |

### Surface inventory
| Surface | Path | Role |
|---------|------|------|
| Programa | `scripts/automate-run.js` | partida, writer, hooks de review/loop |
| Review gate | `src/phase-review-gate.js` | CLI, recibo, loop, mix, park |
| Audit gate | `src/phase-delivery-audit-gate.js` | grafo no close |
| Fence | `src/automate-product-fence.js` | claim + product fence |
| Orchestrator | `src/automate-orchestrator-gates.js` | `canRunPhaseDone` |
| Assert | `scripts/assert-automate-gate.js` | `--gate phase-done` carrega o grafo |
| Skill | `skills/core/audit-delivery.md` | HARD graph rule |
| Schema | `meta/schemas/plan.schema.json` | `reviewExternalCli` |
| Grafo | `flow/flow.json` | SSOT ratificado |
| Sidecar | `.atomic-skills/status/automate/<slug>-residuals.json` | residuals park |

### Non-goals / do-not-reopen
- Página final, botão `userValidatedAt`, PR e archive (F5)
- Reabrir marco F3 de um writer/merge
- Chamar `scripts/automate-phase-run.js` no lugar de `scripts/automate-run.js`
- Fila, vários hosts, spawn adapter multi-máquina (P9)

### Key SSOT paths
- `.atomic-skills/projects/atomic-skills/real-automate/flow/flow.json` (`ratifiedGraphSha`)
- `meta/schemas/plan.schema.json` `reviewExternalCli`
- `src/phase-review-gate.js` `PHASE_REVIEW_CAP`
- `src/phase-delivery-audit-gate.js` `deliveryAuditGraphCoverage` / `deliveryAuditAllowsClose`
- `src/automate-product-fence.js` `phaseCloseFenceOk`

## Spec Package (criteria strip — no success narrative)
| ID | Criterion | Expected chain |
|----|-----------|----------------|
| D1 | Campo no schema; ask-once; recibo 4 campos; sem re-ask | schema → resolve/upsert → parse receipt → test |
| D2 | Brief com grafo+esboço; complex na mesma review | buildPhaseReviewBrief → test |
| D3 | Cap 3; park sidecar; travei na 3ª | nextPhaseReviewAction → runPhaseReviewLoop → test |
| D4 | Mix `enterLoop: false` | isArchitectureMixFinding → nextPhaseReviewAction |
| D5 | SHA, linha por subject, close carrega, fail-closed | flowDocumentSha → deliveryAuditGraphCoverage → canRunPhaseDone / assert |
| D6 | Claim inválido ou path sem cobertura recusa close | phaseCloseFenceOk → test |
| P1 | override sem stderr e `- internal:` falham | externalReviewReceiptHonesty / parseExternalReviewReceipt |
| P2 | xor sem linha falha | deliveryAuditGraphCoverage |
| P3 | mix não dispara fix | runPhaseReviewLoop |

Must-not: F5; F3 reopen; `automate-phase-run`; `- internal:` como recibo; pergunta mid-run; página final no lugar do grafo; park no cursor; hash throw como cobertura.

## Matrix A — Decisions (stages S C U O T X)
| ID | Decision | Expected chain | S | C | U | O | T | X | Status | Evidence |
|----|----------|----------------|---|---|---|---|---|---|--------|----------|
| D1 | reviewExternalCli + recibo real | schema → resolve → receipt → test | pass | pass | pass | pass | pass | pass | RESOLVED | `meta/schemas/plan.schema.json:87-94`; `src/phase-review-gate.js:174-209,258-377`; `scripts/automate-run.js:515-549,764-768`; tests reviewExternalCli + receipt 10/10. Residual HIGH: `main` sem `ask` e ignora `prepared.ok`. |
| D2 | Isolados + brief grafo/esboço/complex | brief → spawn review → test | pass | pass | pass | pass | pass | pass | RESOLVED | Writer F3 em `runWriterSession`; `buildPhaseReviewBrief` `:390-406`; tests brief 2/2. Residual HIGH: `runPhaseReviewBoth` no `main` sem `flowGraph`/`architectureSketch` (`scripts/automate-run.js:774-778`). |
| D3 | Loop teto 3 / park / travei / close+advance | action → park sidecar → test | pass | pass | pass | pass | pass | pass | RESOLVED | `PHASE_REVIEW_CAP=3` `:408`; `nextPhaseReviewAction` `:527-563`; `residualFindingsStatusPath` `:476-478`; tests loop 7/7. Residual HIGH: `main` só com env; sem `spawnFixAgent`/`closePhase`/`openNext`; JSON inválido vira `[]`. |
| D4 | Mix para na hora | mix predicate → stop | pass | pass | pass | pass | pass | pass | RESOLVED | `isArchitectureMixFinding` `:419-437`; `enterLoop: false` `:531-537`; test `:637-653`. Residual HIGH: `chosen` interpolado em RegExp sem escape. |
| D5 | Grafo no audit e no close | sha → subjects → coverage → close | pass | pass | pass | pass | pass | pass | RESOLVED | `deliveryAuditGraphCoverage` `:536-664`; `deliveryAuditAllowsClose` `:804-848` sempre chama coverage; `canRunPhaseDone` `:496-517`; `assert-automate-gate.js:1113-1124` passa `planPath`. Independent 52/52. Este relatório emite as 7 linhas. |
| D6 | Claim + fence no close | fence fn → automate-run export → test | pass | pass | pass | pass | pass | pass | RESOLVED | `phaseCloseFenceOk` `src/automate-product-fence.js:165-183`; `validatePhaseClose` `scripts/automate-run.js:576-578`; fence 12/12. Residual HIGH: `validatePhaseClose` não é chamado de `main`. |

## Matrix B — Problems
| ID | Problem | Expected fix shape | S | C | U | O | T | X | Status | Evidence |
|----|---------|-------------------|---|---|---|---|---|---|--------|----------|
| P1 | override sem stderr / recibo de sessão | recusa | pass | pass | pass | pass | pass | pass | RESOLVED | `externalReviewReceiptHonesty` `:354-377`; `parseExternalReviewReceipt` `:282-335`; tests `:387-428`. Residual HIGH: `phaseReviewAllowsClose` both usa floor de tamanho, não o parser do recibo. |
| P2 | xor sem linha | fail | pass | pass | pass | pass | pass | pass | RESOLVED | test `a flow.json fixture with one xor and a report missing that line fails`; `deliveryAuditGraphCoverage` missing → `ok: false`. |
| P3 | mix no loop | stop imediato | pass | pass | pass | pass | pass | pass | RESOLVED | test mix; `runPhaseReviewLoop` não chama `spawnFixAgent` no mix (`tests/phase-review-gate.test.js:718-729`). |

## Matrix C — must-not
| ID | Must NOT | Seed | Status | Evidence |
|----|----------|------|--------|----------|
| MN1 | Página F5 / `userValidatedAt` / PR / archive | outOfScope | RESOLVED | `f5-pagina-final.md` ausente; só `.source.json`. `userValidatedAt` ausente em `scripts/automate-run.js`. |
| MN2 | Reabrir F3 writer/merge | outOfScope | RESOLVED | `runWriterSession` intacto; writer tests 22/22; stderr ainda `merged; stopping` (keep-green F3). |
| MN3 | Chamar `automate-phase-run.js` | outOfScope | RESOLVED | zero matches em `scripts/automate-run.js`. |
| MN4 | `- internal:` como recibo | rules | RESOLVED | parser recusa; searched-and-absent como ok-path. |
| MN5 | Perguntar CLI no meio | rules | RESOLVED | `resolveReviewExternalCli` stored → `asked: false`. `main` não pergunta (gap H1, não re-ask). |
| MN6 | Página final substitui o gate do grafo | rules | RESOLVED | test `the final page does not substitute this gate`; `finalPage`/`userValidatedAt` só anotam a reason. |
| MN7 | Park sobrescreve o cursor maestro | T-003 / F4-fix3 | RESOLVED | `parkResidualFindings` → `*-residuals.json`; `redirectParkPathOffMaestroCursor` em `writeStatus` (`scripts/automate-run.js:797-801`). Test cursor intact. |
| MN8 | Hash throw / subjects vazios = cobertura | T-002 / F4-fix3 | RESOLVED | catch de `flowDocumentSha` → `ok: false`; `subjects.length === 0` → `ok: false`. Tests `:504-559`. |

## Findings Ledger
| # | Title | Sev | Axis | Evidence | Impact | Suggested fix (one-liner) |
|---|-------|-----|------|----------|--------|---------------------------|
| H1 | `main` não pergunta/recusa `reviewExternalCli` ausente | HIGH | product | `scripts/automate-run.js:764-771` | Writer arranca sem CLI gravado | `ask` ou `process.exit` se `!prepared.ok` |
| H2 | Spawn de review opt-in, brief vazio, exit/veredito ignorados | HIGH | product | `scripts/automate-run.js:774-782` | Both não corre no default; brief `{}` | Sempre spawn após merge; passar grafo/esboço; falhar se exit≠0 ou sem veredito |
| H3 | Loop/close/advance não estão no `main`; JSON inválido → `[]` | HIGH | product | `scripts/automate-run.js:784-809` | Predicados só em biblioteca; lixo de env fecha a fase | Injetar `spawnFixAgent`/`closePhase`/`openNext`; chamar `validatePhaseClose`; JSON inválido fail-closed |
| H4 | `closePhase()` não é awaited/checado antes de `openNext()` | HIGH | product | `src/phase-review-gate.js:580-587` | Avança com close recusado | Exigir `{ok:true}` do close |
| H5 | Close both não parseia recibo externo | HIGH | residual | `src/phase-review-gate.js:223-285` vs honesty both | `- internal:` longo ainda passa o floor | Ligar `parseExternalReviewReceipt` no close both |
| H6 | Schema `reviewGate` sem `externalStderr`/`stderr` (`additionalProperties: false`) | HIGH | residual | `meta/schemas/plan.schema.json:685-767`; honesty `:928-932` | Stamp honesto Ajv-inválido | Acrescentar os campos ou ler o recibo |
| H7 | `extractVerdictToken` aceita PASS/CLEAN soltos | HIGH | residual | `src/phase-review-gate.js:234-245` | Log adverso vira PASSED | Só `verdict:` estruturado |
| H8 | `readPlanReviewExternalCli` casa o body inteiro, sem cap | HIGH | residual | `src/phase-review-gate.js:130-134` | Linha no body seleciona o CLI | Só frontmatter + cap (L-F2-2) |
| H9 | Mix RegExp com `chosen` sem escape | HIGH | residual | `src/phase-review-gate.js:431-435` | Crash ou falso mix | Escape / includes |
| M1 | Goal/source ainda ensinam park em `<slug>.json` | MEDIUM | residual | `plan.md:487`; `source.md` T-003 | Teaching vs sidecar | Atualizar prosa para `*-residuals.json` |
| L1 | `constructor` no prototype conta como coverage | LOW | residual | `src/phase-delivery-audit-gate.js` parse maps | Id exótico passa sem linha | Map / null-prototype |
| L2 | `reportContents` não alimenta coverage | LOW | residual | `reportTextForGraphCoverage` `:748-769` | Caller com map falha coverage | Resolver o mesmo blob da authenticity |

zero CRITICAL. Os dois findings local-review (hash throw / park no cursor) estão resolved em F4-fix3 (`1eac7bbf`).

## Residual (ordered)
| # | Title | Sev | Class | Evidence | Status |
|---|-------|-----|-------|----------|--------|
| H1–H3 | `main` ainda ensina F3 `merged; stopping` e só continua com env | HIGH | teaching + dual SSOT | `scripts/automate-run.js:674,774,784` | OPEN — Accept Record |
| H5 | Floor both ≠ parser de recibo | HIGH | dual SSOT | phase-review-gate both vs parseExternalReviewReceipt | OPEN — Accept Record |
| H6 | Schema vs honesty stderr | HIGH | dual SSOT | plan.schema.json reviewGate | OPEN — Accept Record |
| H7 | Token PASS solto | HIGH | alias | extractVerdictToken | OPEN — Accept Record |
| H8 | Body match CLI | HIGH | storage | readPlanReviewExternalCli | OPEN — Accept Record |
| H9 | RegExp mix | HIGH | recovery gap | isArchitectureMixFinding | OPEN — Accept Record |
| M1 | Prosa `<slug>.json` | MEDIUM | teaching | plan/source vs code sidecar | OPEN |
| MN7/MN8 | Cursor park / hash throw | — | dead (fixed) | F4-fix3 | reviewed-OK |

### Residual protocol
- Terms: OLD=`- internal:`, override sem stderr, audit sem grafo, ask mid-run, park cursor, hash throw=equal, `merged; stopping`. NEW=`reviewExternalCli`, recibo 4 campos, `ratifiedGraphSha`, `*-residuals.json`, `PHASE_REVIEW_CAP`, `travei`, `phaseCloseFenceOk`.
- Validity: valid
- Surfaces hunted: 12
- Residual excluded? no

## Accept Register (Accept Records)
| Finding | Risk | Mitigation | Operator | At | Expires |
|---------|------|------------|----------|-----|---------|
| H1 ask/refuse ausente no `main` | Corrida sem CLI gravado | Biblioteca+testes cobrem ask-once; env `AUTOMATE_REVIEW_EXTERNAL_CLI`; slice F4 doneWhen é o suite | operator (decision 11) | 2026-10-02T19:38:21Z | — |
| H2 spawn review opt-in / brief vazio | Both não corre no default | `runPhaseReviewBoth` + brief testados com injeção; host real argv é follow-up | operator (decision 11) | 2026-10-02T19:38:21Z | — |
| H3 loop/close não no `main`; JSON `[]` | Predicados só em lib; lixo fecha | `nextPhaseReviewAction` / park / fence testados; maestro phase-done ainda exige gates | operator (decision 11) | 2026-10-02T19:38:21Z | — |
| H4 close não awaited | Avança com close recusado | `openNext` não injetado no `main` desta slice | operator (decision 11) | 2026-10-02T19:38:21Z | — |
| H5 both close sem parser de recibo | `- internal:` longo no floor | Parser recusa sessão; dual-leg paths exigidos no both | operator (decision 11) | 2026-10-02T19:38:21Z | — |
| H6 schema sem stderr | Stamp local Ajv-inválido | Default F4 é both (paths, não stderr no schema) | operator (decision 11) | 2026-10-02T19:38:21Z | — |
| H7 PASS solto | Veredito falso | Recibo formatado usa `verdict=`; follow-up | operator (decision 11) | 2026-10-02T19:38:21Z | — |
| H8 body match CLI | Exemplo no body seleciona CLI | Schema enum + testes de frontmatter; L-F2-2 no coverage parser | operator (decision 11) | 2026-10-02T19:38:21Z | — |
| H9 mix RegExp | Crash no `chosen` especial | Mix stop também por `stampedBlockMix` / `kind=mix` / texto fixo | operator (decision 11) | 2026-10-02T19:38:21Z | — |

Fonte: `.atomic-skills/reviews/2026-10-02-real-automate-F4-decision-package.md` #11; reviewGate both `771849b2`. Chat sozinho não fecha HIGH; este registro é o Accept Record durável.

## Tests / commands observed
| Command | Result | Notes |
|---------|--------|-------|
| `node` `flowDocumentSha(flow.json)` | `8210bfc367f08e285b279b7dc69716d91df665281ffc2af1eebc1be619761285` | match `ratifiedGraphSha` |
| `graphCoverageSubjects` | corrida + 6 xor | 7 subjects |
| `node --test tests/phase-review-gate.test.js tests/phase-delivery-audit-gate.test.js tests/automate-product-fence.test.js tests/automate-run-writer.test.js` | 131 pass / 0 fail | evidence for rows, not a verdict upgrade |
| F5 materialization | `f5-pagina-final.md` absent | descriptor-only |

## Self-review against gates
- G1 read-before-claim: cada RESOLVED/PARTIAL/NO cita `file:line` ou comando; SHA via `flowDocumentSha`, não sha256 cru do ficheiro.
- G2 soft-language: verdict CLOSED.
- G6 reference-or-strike: linhas de grafo emitidas; subjects vazios não passam.

## Confidence %
78 — depth light, eixos inline. Core doneWhen e T-002 close-path verificados neste HEAD. HIGH de wiring do `main` aceites pelo operador, não retestados com host real.

## Verdict rationale
- zero CRITICAL (never Accept-Recorded)
- HIGH open: 9 (Accept Records: 9)
- Residual: ran, valid, not excluded
- Suite/tests: evidence only — not a gate upgrade
- Load-bearing D1–D6 e P1–P3: RESOLVED
- Graph coverage: 7/7 linhas presentes

**Verdict:** CLOSED
