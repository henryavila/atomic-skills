# Audit Delivery — implement-orchestrator-loop
**Date:** 2026-10-15
**Mode:** audit
**Depth:** full
**Axes:** product, residual
**Intent sources:** conversa ratificada + branch `feat/implement-orchestrator-loop` (pedido do operador: `feat/implemment-orchestrator-loop`)
**Verdict:** OPEN

## Intent Package
### Decisions
| ID | Decision | Why |
|----|----------|-----|
| D1 | Quem chama `implement`, depois de resolver slug e worktree, se `planApprovedAt` é ISO, só imprime uma linha `/loop` de `--card` e para. Não codifica, não spawna, não corre A–I. | A sessão que pede implement não é o orquestrador. |
| D2 | Sem `planApprovedAt`, não imprime `/loop`. Manda para `project approve`. `--from-plan` sai com código diferente de zero. | Sem aceite não há implementação. |
| D3 | `planApprovedAt` não é `userValidatedAt`. O tick não grava aceite de entrega. | O fim do plano continua humano. |
| D4 | `--from-plan` lê o plano e as fases, só cataloga tasks existentes, despacha partes disjuntas com dependência pronta, segura caminho sobreposto, no máximo um merge, review é outro agente, a terceira falha é `blocked-human` sem `operatorOverride`. | O quadro é a memória entre wakeups. |
| D5 | O texto antes de `## END OF ENTRY` não contém a ordem de spawnar um phase agent nem “you are the single-threaded coder”. Essas leis ficam depois do corte. | A entry não pode ensinar o caminho antigo. |
| D6 | Não há daemon. O processo Node não spawna agentes. A sessão do `/loop` executa as ações impressas. O detalhe de gate está no tick, na referência e no maestro. | O harness reusa o que já existe. |

### Original problems
| ID | Problem | Expected fix shape |
|----|---------|-------------------|
| P1 | Nada reabria o turno, então o agente parava. | Um cartão `/loop` para uma sessão nova, que corre um tick e não imprime outro `/loop`. |
| P2 | A política de continue se contradizia: perguntar ao operador versus carimbar continue. | A sessão que invoca não pergunta “continuo?”. |
| P3 | A–I e “code the change” eram a entry de `implement`. | Esses passos vivem em `implement-harness-reference.md`. `implement.md` não contém o heading do Step 2. |

### Acceptance / doneWhen
| ID | Criterion | Source |
|----|-----------|--------|
| A1 | `--card` é uma linha que começa com `/loop `, traz slug e worktree, e manda não gravar `userValidatedAt` nem imprimir outro `/loop`. | D1 |
| A2 | `--from-plan` sem aceite sai 1. Depois do stamp, duas tasks pendentes disjuntas com dependência `done` são despachadas juntas. | D2, D4 |
| A3 | Antes de `END OF ENTRY`, as duas frases de D5 estão ausentes. | D5 |

### Vocabulary delta
| OLD | NEW | Scope |
|-----|-----|-------|
| perguntar ao operador para continuar / `awaiting-operator-advance` como entry | cartão `/loop` numa sessão nova; o próximo wakeup é o continue | skill + cursor |
| Steps A–I e Step 2 como entry de `implement` | `END OF ENTRY`; referência lida só para uma ação impressa | skill |
| carimbo `operator-continue` como avanço da sessão que invocou | `planApprovedAt` e depois o tick | estado do plano |

### Surface inventory
| Surface | Path / system | Role |
|---------|---------------|------|
| Entry | `skills/core/implement.md` | launcher |
| Projeto | `skills/core/project.md` | `approve` |
| Tick | `skills/shared/implement-orchestrator-tick.md` | procedimento da sessão `/loop` |
| Referência | `skills/shared/implement-harness-reference.md` | gates, não entry |
| Antipattern | `skills/shared/implement-antipatterns.md` | ensino |
| Maestro | `skills/shared/implement-automate-maestro.md` | ensino do loop antigo |
| CLI | `scripts/orchestrator-tick.js`, `scripts/stamp-plan-approval.js` | card, stamp, from-plan |
| Máquina | `src/orchestrator-board.js`, `src/orchestrator-snapshot.js`, `src/plan-approval.js` | tick e carimbo |
| Teste | `tests/orchestrator-tick.test.js` | contrato |
| Schema | `meta/schemas/plan.schema.json` | `planApprovedAt` |

### Non-goals / do-not-reopen
- Daemon, workqueue, skill que se agenda.
- Gravar `userValidatedAt` ou cunhar `operatorOverride` no tick.
- Implementar `release-consistency` ou `project-flow`.
- Nome de modelo (`grok-4.7-fast`) na skill.
- O processo Node não spawna agentes Grok.

### Key SSOT paths
- `skills/core/implement.md`
- `skills/shared/implement-orchestrator-tick.md`
- `src/orchestrator-board.js`
- `src/orchestrator-snapshot.js`
- `src/plan-approval.js`
- `scripts/orchestrator-tick.js`

## Spec Package (criteria strip — no success narrative)
IDs D1–D6, P1–P3, A1–A3. Cadeia esperada: prosa da entry → CLI `--card` / `--from-plan` → board/snapshot → teste. Non-goals acima. Termos OLD/NEW acima. SSOT acima.

## Matrix A — Decisions (stages S C U O T X)
| ID | Decision | Expected chain | S | C | U | O | T | X | Status | Evidence |
|----|----------|----------------|---|---|---|---|---|---|--------|----------|
| D1 | Entry só imprime `/loop` e para | implement.md → card → CLI → teste | ok | ok | ok | ok | ok | ok | RESOLVED | `skills/core/implement.md:39-47`; `src/orchestrator-board.js:116-119`; `scripts/orchestrator-tick.js` ramo `--card`; `tests/orchestrator-tick.test.js` card |
| D2 | Sem aceite, sem comando; `--from-plan` sai 1 | skill → stamp → CLI | ok | ok | ok | parcial | ok | parcial | PARTIAL | `--from-plan` sai 1 no teste de round-trip. `--card` não lê `planApprovedAt` (`scripts/orchestrator-tick.js:35-43` só exigem plan e worktree) |
| D3 | Tick não grava `userValidatedAt` | stamp → tick → teste | ok | ok | ok | ok | ok | ok | RESOLVED | `src/plan-approval.js` só acrescenta `planApprovedAt`; `src/orchestrator-board.js:9` e `:312-314`; teste exige ausência da chave |
| D4 | Catálogo, paralelo disjunto, um merge, review outro agente, teto sem override | snapshot → board → teste | ok | parcial | ok | parcial | parcial | fail | PARTIAL | Primeiro tick ok (`orchestrator-board.js:276-309`). O agente gravado nasce `lease: false`, `alive: false` (`:338-347`) |
| D5 | Frases de spawn/coder só depois do corte | implement.md → teste | ok | n/a | ok | ok | ok | ok | RESOLVED | Corte em `implement.md:51`. Frases em `:70` e `:97`. Teste exige ausência antes do heading |
| D6 | Sem daemon; sessão executa a ação impressa | header do board → seção do tick | ok | ok | parcial | parcial | parcial | fail | PARTIAL | Node não spawna. `implement-orchestrator-tick.md:71-82` diz “the one action”. O tick pode imprimir vários dispatches (`:60`, `:107-108`) |

## Matrix B — Problems
| ID | Problem | Expected fix shape | S | C | U | O | T | X | Status | Evidence |
|----|---------|-------------------|---|---|---|---|---|---|--------|----------|
| P1 | Nada reabria o turno | cartão `/loop` que corre um tick | ok | ok | ok | ok | ok | fail | PARTIAL | O cartão existe. O segundo `--from-plan` não continua o dispatch (gap 1) |
| P2 | Continue contraditório | entry não pergunta “continuo?” | ok | n/a | ok | fail | parcial | fail | PARTIAL | Entry para (`implement.md:47`). Maestro ainda manda `clearContinue` no mesmo turno (`implement-automate-maestro.md:58`, `:73`) |
| P3 | A–I era a entry | Step 2 sai de `implement.md` | ok | n/a | ok | ok | ok | ok | RESOLVED | Heading do Step 2 só em `implement-harness-reference.md:113`. Teste falha se voltar para `implement.md` |

## Matrix C — must-not
| ID | Must NOT | Seed | Status | Evidence |
|----|----------|------|--------|----------|
| C1 | Daemon ou skill que se agenda | non-goal | RESOLVED | `scheduler_create` ausente em `skills/**/*.md`. Tick `:115` diz que a skill não agenda |
| C2 | Tick grava `userValidatedAt` | non-goal | RESOLVED | `plan-approval.js` não cunha o campo. Board não atribui a chave |
| C3 | Tick cunha `operatorOverride` | non-goal | RESOLVED | Teto vira `blocked-human` (`orchestrator-board.js:321-329`). O maestro ainda ensina o override (`implement-automate-maestro.md:218`) — isso é ensino, não o tick |
| C4 | Nome de modelo na skill | non-goal | RESOLVED | `grok-4.7-fast` ausente em `skills/**/*.md` |
| C5 | Node spawna agente | non-goal | RESOLVED | `orchestrator-board.js` cabeçalho: não spawna |

## Findings Ledger
| # | Title | Sev | Axis | Evidence | Impact | Suggested fix (one-liner) |
|---|-------|-----|------|----------|--------|---------------------------|
| F1 | Dispatch vira agente morto no wakeup seguinte | CRITICAL | product | `src/orchestrator-board.js:338-347` grava `lease: false`, `alive: false`. Morto exige `lease === true` e `alive !== true` (`:222-230`). `src/orchestrator-snapshot.js:85-90` liga `lease: true` se o arquivo de lease está `active`, e só põe `alive: true` quando `alive == null`. O valor gravado é `false`, não `null` | Com writer no ar, o próximo `--from-plan` trata o agente como morto, gasta redispatch e no teto vira `blocked-human`. Sem lease, o segundo tick devolve `actions: []` e a parte fica `dispatched` | Não persistir o dispatch como morto; reemitir dispatch não observado sem gastar teto; morto só com `alive: false` registrado pela sessão depois de ter estado vivo |
| F2 | Dois protocolos de continue | HIGH | residual | Entry não pergunta (`implement.md:47`). Maestro manda `clearContinue('operator-continue')` no mesmo turno (`implement-automate-maestro.md:58`, `:73`, `:123`). Iron law depois do corte repete o token (`implement.md:76`). Antipattern `:47` e harness `:112` ensinam o mesmo | A sessão `/loop` é mandada a ler o maestro (`implement.md:126`) e reabre o avanço que o wakeup devia substituir | No texto que o tick manda ler, continue entre partes aprovadas é o próximo wakeup; não chamar `clearContinue` nesse caminho |
| F3 | “Uma ação” contra vários dispatches | MEDIUM | product | `implement-orchestrator-tick.md:60` e `:73` | A sessão pode spawnar só o primeiro e deixar o outro no estado de F1 | Executar todas as ações impressas naquele tick e só então sair |
| F4 | Teste não vê o corpo depois do corte nem o segundo tick | MEDIUM | residual | `tests/orchestrator-tick.test.js` só exige as frases antes de `END OF ENTRY` | O corpo em `implement.md:70` e o segundo wakeup ficam verdes | Um teste de dois `--from-plan` seguidos, com lease `active`, não pode emitir novo dispatch |
| F5 | Schema ainda manda confirmação interativa no entry | LOW | residual | `meta/schemas/plan.schema.json:85` | `executionMode` ensina um entry que a skill já tirou | Alinhar a description ao launcher: a sessão que invoca não carimba |
| F6 | Fase com YAML inválido some do catálogo | LOW | product | `scripts/orchestrator-tick.js:63-67` | O tick despacha o resto e não bloqueia | Sair 1 quando um `phases/*.md` não parseia |

## Residual (ordered)
| # | Title | Sev | Class | Evidence | Status |
|---|-------|-----|-------|----------|--------|
| R1 | Maestro ensina `clearContinue` como o avanço atual | HIGH | teaching | `implement-automate-maestro.md:58`, `:73` | open |
| R2 | Iron law depois do corte ainda ordena spawn de phase agent | HIGH | teaching | `implement.md:70` | open |
| R3 | `project-transitions.md` repete `clearContinue` no phase-done | HIGH | teaching | citado pelo eixo residual, fora do núcleo do tick | open |
| R4 | Referência ainda é script de Step 2 e resumo A–I | MEDIUM | teaching | `implement-harness-reference.md:113` | open |
| R5 | Lease do cursor antigo não entra no heal do tick | MEDIUM | recovery | `src/maestro-cursor.js` continua dono de `awaiting-operator-advance` | open |

### Residual protocol
- Terms: OLD = continue do operador, `awaiting-operator-advance`, `operator-continue`, Step 2, spawn de phase agent, “single-threaded coder”, Steps A–I, `clearContinue`. NEW = `planApprovedAt`, `END OF ENTRY`, `/loop`, `--from-plan`, `--card`, `orchestratorCard`, `blocked-human`, harness reference.
- Validity: valid
- Surfaces hunted: 13 no inventário do pacote

## Accept Register (Accept Records)
| Finding | Risk | Mitigation | Operator | At | Expires |
|---------|------|------------|----------|-----|---------|
| — | — | — | — | — | — |

Nenhum HIGH ou CRITICAL foi aceito. Chat não conta.

## Tests / commands observed
| Command | Result | Notes |
|---------|--------|-------|
| `node --test tests/orchestrator-tick.test.js` | 17 pass (eixo product) | Não cobre o segundo wakeup. Suite verde não sobe o veredito |

## Self-review against gates
- G1 read-before-claim: F1 conferido em `orchestrator-board.js:222-230` e `:338-347` e `orchestrator-snapshot.js:85-90`. F2 conferido em `implement-automate-maestro.md:58` e `:73` e `implement.md:47` e `:76`.
- G2 soft-language: veredito é OPEN.
- G6 reference-or-strike: cada RESOLVED/PARTIAL/NO da matriz aponta arquivo.

## Confidence %
72. O segundo wakeup foi lido no código, não executado de novo nesta sessão. Não houve sessão real colando `/loop`.

### Audit Delivery — Summary

**Intent source:** branch `feat/implement-orchestrator-loop`
**Mode:** audit
**Depth:** full
**Verdict:** OPEN
**Decisions:** 3 RESOLVED, 3 PARTIAL, 0 NO
**Problems:** 1 RESOLVED, 2 PARTIAL, 0 NO
**Findings:** 1 CRITICAL, 1 HIGH, 2 MEDIUM, 2 LOW (abertos)
**Fix rounds:** 0
**Report:** `.atomic-skills/reviews/audit-delivery-implement-orchestrator-loop-20261015.md`

| # | Residual | Sev | Next action |
|---|----------|-----|-------------|
| 1 | Dispatch persistido como morto | CRITICAL | Não gravar `alive: false` no dispatch; segundo tick com lease ativo não redispacha |
| 2 | `clearContinue` ainda é o avanço ensinado | HIGH | Maestro e iron law: entre partes aprovadas o continue é o próximo wakeup |
| 3 | “Uma ação” vs vários dispatches | MEDIUM | A sessão executa todas as ações do tick |

**Suggestion:** corrigir fora deste audit e re-rodar `audit-delivery --mode=reaudit --out=.atomic-skills/reviews/audit-delivery-implement-orchestrator-loop-20261015.md`. `review-code` no diff da correção, à parte.
