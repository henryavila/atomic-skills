---
date: 2026-07-04T16:52:42-03:00
topic: guide-command-plan
artifact: docs/design/project-onboarding/guide-command-plan.md
skill: review-plan
reviewer: gpt-5-codex
codex_version: 0.142.5
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 0}
schema_version: "1.0"
---

# Cross-Model Review — guide-command-plan

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has a source-of-truth conflict at its core: it says `guide` must read persisted `nextAction`, but the implementation tasks define a second deterministic decision engine that emits its own `nextStep.command`. That makes the terminal guide capable of disagreeing with the existing no-args summary.

There are also concrete viability gaps around command shape, priority ordering, drift detection semantics, and the undocumented `manifest.json` fallback for `guide --html`. These are fixable, but they need to be resolved before implementation because they affect the helper contract and tests.

## Findings

### F-001 [critical] contradiction — docs/design/project-onboarding/guide-command-plan.md:7-89

**Evidence:**
> Ele **não recomputa** o próximo passo do zero: o campo `nextAction` já é autorado e persistido a cada `done`/transição (`project-transitions.md` step 3b). `guide` **lê** esse ponteiro e o **enriquece**

> Aplica a tabela de prioridade acima. Emite JSON: `{ youAreHere, doneSummary, nextStep:{command,reason,why}, escapes, spineStage:{n,m} }`.

**Claim:** The plan declares persisted `nextAction` as the command source of truth, but T-004 makes `compute-guide.js` derive `nextStep.command` from a separate state-priority table, creating two independent authorities for the next command.

**Impact:** `project guide` can print a different next step than the existing no-args `NEXT <nextAction>` line, and tests can pass by validating the table while the persisted workflow pointer is stale or contradictory.

**Recommendation:** Make `nextAction` the only source for `nextStep.command`; use the table only to annotate `reason`, `why`, and `spineStage`, with an explicit stale-or-missing fallback path and tests that compare guide output to persisted `nextAction`.

**Confidence:** high

---

### F-002 [major] ordering — docs/design/project-onboarding/guide-command-plan.md:19-30

**Evidence:**
> | Plano ativo · fase atual `descriptor-only` | `materialize <phase>` | Fase é só descritor; precisa do `businessIntent` antes de implementar. |
> | Fase materializada · tasks `pending` | `implement`  (ou `done <first-actionable>`) | Há trabalho admitido pronto para executar. |
> | Plano `blocked` por `dependsOnPlans[]` | `switch <prereq>` | Não se avança um plano bloqueado; resolver o pré-requisito. |
> | Drift detectado (`detect-completion --json` → `drift:true`) | `reconcile` | Itens parecem prontos no código mas não no estado. |

> O helper resolve a **primeira** situação aplicável nessa ordem de prioridade (bloqueios de dependência e reconciliação vêm antes do fluxo feliz).

**Claim:** The text says dependency blocks and reconciliation outrank the happy path, but the table order places `descriptor-only`, `pending`, and other happy-path states before `dependsOnPlans[]` and drift.

**Impact:** A row-order implementation will recommend `materialize` or `implement` for a blocked or drifted plan, while a prose-order implementation will recommend `switch` or `reconcile`; overlapping states will produce inconsistent behavior across implementations.

**Recommendation:** Replace the table with a numbered precedence list in the actual intended order and add overlapping fixtures such as “blocked + pending” and “drift + pending” that assert the higher-priority command.

**Confidence:** high

---

### F-003 [major] ambiguity — docs/design/project-onboarding/guide-command-plan.md:15-118

**Evidence:**
> O helper mapeia o estado detectado para UM comando concreto.

> | Zero tasks abertas na fase | `phase-done` (in-plan) · `archive <slug>` (standalone) | Fase pronta para fechar; exit-gate + code review. |
> | Todas as fases `done` | `finalize` (PR) → depois `archive` | Plano concluído; publicar. |
> | Ideias pendentes (`ideas.md`) | `idea list` / `idea promote <n>` | Inbox não-vazio (informativo, não bloqueia). |

> Todo `nextStep.command` que o helper pode emitir tem que ser um subcomando real em `meta/catalog.yaml`.

**Claim:** The decision table requires one concrete command but includes alternatives, command sequences, placeholders, and an argument-less `finalize`, while T-007 only checks subcommand vocabulary rather than a runnable command shape.

**Impact:** `guide` may print non-executable instructions like `idea list / idea promote <n>` or `finalize`, and the proposed vocabulary test can still pass because the first token exists in the catalog.

**Recommendation:** Define `nextStep.command` as exactly one fully invokable command string with resolved required arguments, and extend T-007 to validate command signatures or explicit allowed placeholders, not just first-token membership.

**Confidence:** high

---

### F-004 [major] viability — docs/design/project-onboarding/guide-command-plan.md:27-89

**Evidence:**
> | Drift detectado (`detect-completion --json` → `drift:true`) | `reconcile` | Itens parecem prontos no código mas não no estado. |

> reusa `detect-completion.js` para o flag de drift (não reimplementa).

> qualquer erro de I/O → saída parcial, exit 0 (fail-open)

**Claim:** The plan relies on `detect-completion.js --json` for drift while also treating helper failures as fail-open, but it does not specify that drift-signaling nonzero exits must be parsed as valid output rather than handled as errors.

**Impact:** An implementation using `execFileSync` or similar can catch the nonzero drift exit as a failure, discard `stdout`, and silently omit the `reconcile` recommendation exactly when drift exists.

**Recommendation:** Add an explicit detector contract: parse JSON stdout for both exit 0 and the drift exit, treat only unparsable output or I/O failure as fail-open, and add a fixture that simulates drift JSON with a nonzero exit.

**Confidence:** high

---

### F-005 [major] dependency break — docs/design/project-onboarding/guide-command-plan.md:52-109

**Evidence:**
> **Resolução (na ordem):** (1) o caminho de contrato; (2) fallback opcional `guideHtmlPath` no `manifest.json` do install, se o usuário publicar o HTML noutro lugar

> Files: `skills/shared/project-assets/project-guide.md`, `scripts/compute-guide.js` (só a resolução/existência do caminho — a abertura fica no asset via `{{BASH_TOOL}}`)

> verifier: `kind test` — `node --test tests/guide/html-resolve.test.js` (presente→resolve o caminho; ausente→sinaliza sem erro; a abertura em si é mockada).

**Claim:** The `guideHtmlPath` fallback depends on an install `manifest.json`, but the plan does not define its path, schema, ownership, fixture, or any task that updates or validates it.

**Impact:** Two implementers can read different manifest locations or field shapes, making `guide --html` fallback behavior non-portable and leaving the documented fallback untested in realistic install layouts.

**Recommendation:** Specify the exact manifest path and `guideHtmlPath` schema in T-006b, add a fixture covering that fallback, or remove the manifest fallback from the contract.

**Confidence:** medium

## Questions (non-findings)

- docs/design/project-onboarding/guide-command-plan.md:131 — Which aliases are actually part of the accepted command surface for this plan: `guide` only, or `guide` plus `next`?

## Out of scope

- HTML page generation or validation
- aiDeck dashboard changes
- Replacing the existing no-args summary command
- Network-dependent behavior
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The central defect remains: the plan says `guide` must read persisted `nextAction`, but then specifies a helper that derives `nextStep.command` from a separate priority table. Given the external constraint that `nextAction` already exists and powers the current no-args `NEXT` line, this is a real source-of-truth split.

The other material risks are implementation-shaping: contradictory priority order, non-concrete command outputs, incorrect handling risk for drift detector exit code 1, and an undefined `manifest.guideHtmlPath` fallback key. These should be resolved before implementation because they affect helper contracts and tests.

## Findings

### F-001 [critical] contradiction — docs/design/project-onboarding/guide-command-plan.md:7-85

**Evidence:**
> Ele **não recomputa** o próximo passo do zero: o campo `nextAction` já é autorado e persistido a cada `done`/transição (`project-transitions.md` step 3b). `guide` **lê** esse ponteiro e o **enriquece**

> Aplica a tabela de prioridade acima. Emite JSON: `{ youAreHere, doneSummary, nextStep:{command,reason,why}, escapes, spineStage:{n,m} }`.

**Claim:** The plan declares persisted `nextAction` as the command source of truth, but T-004 makes `compute-guide.js` derive `nextStep.command` from a separate state-priority table.

**Impact:** `project guide` can print a different next step than the existing no-args `NEXT <nextAction>` line, and tests can pass by validating the table while the persisted workflow pointer is stale or contradictory.

**Recommendation:** Make `nextAction` the only source for `nextStep.command`; use the table only to annotate `reason`, `why`, and `spineStage`, with tests that compare guide output to persisted `nextAction`.

**Confidence:** high

---

### F-002 [major] ordering — docs/design/project-onboarding/guide-command-plan.md:20-30

**Evidence:**
> | Plano ativo · fase atual `descriptor-only` | `materialize <phase>` | Fase é só descritor; precisa do `businessIntent` antes de implementar. |
> | Fase materializada · tasks `pending` | `implement`  (ou `done <first-actionable>`) | Há trabalho admitido pronto para executar. |
> | Plano `blocked` por `dependsOnPlans[]` | `switch <prereq>` | Não se avança um plano bloqueado; resolver o pré-requisito. |
> | Drift detectado (`detect-completion --json` → `drift:true`) | `reconcile` | Itens parecem prontos no código mas não no estado. |

> O helper resolve a **primeira** situação aplicável nessa ordem de prioridade (bloqueios de dependência e reconciliação vêm antes do fluxo feliz).

**Claim:** The text says dependency blocks and reconciliation outrank the happy path, but the table order places happy-path states before `dependsOnPlans[]` and drift.

**Impact:** A row-order implementation will recommend `materialize` or `implement` for a blocked or drifted plan, while a prose-order implementation will recommend `switch` or `reconcile`.

**Recommendation:** Replace the table with a numbered precedence list in the intended order and add overlapping fixtures such as “blocked + pending” and “drift + pending”.

**Confidence:** high

---

### F-003 [major] ambiguity — docs/design/project-onboarding/guide-command-plan.md:15-118

**Evidence:**
> O helper mapeia o estado detectado para UM comando concreto.

> | Zero tasks abertas na fase | `phase-done` (in-plan) · `archive <slug>` (standalone) | Fase pronta para fechar; exit-gate + code review. |
> | Todas as fases `done` | `finalize` (PR) → depois `archive` | Plano concluído; publicar. |
> | Ideias pendentes (`ideas.md`) | `idea list` / `idea promote <n>` | Inbox não-vazio (informativo, não bloqueia). |

> Todo `nextStep.command` que o helper pode emitir tem que ser um subcomando real em `meta/catalog.yaml`.

**Claim:** The decision table requires one concrete command but includes alternatives, command sequences, placeholders, and catalog-only validation.

**Impact:** `guide` may print non-executable instructions like `idea list / idea promote <n>` or `archive <slug>`, and the vocabulary test can still pass because the command name exists.

**Recommendation:** Define `nextStep.command` as exactly one invokable command string with resolved required arguments, and extend T-007 to validate full command shape or explicit allowed placeholders.

**Confidence:** high

---

### F-004 [major] viability — docs/design/project-onboarding/guide-command-plan.md:27-88

**Evidence:**
> | Drift detectado (`detect-completion --json` → `drift:true`) | `reconcile` | Itens parecem prontos no código mas não no estado. |

> reusa `detect-completion.js` para o flag de drift (não reimplementa).

> qualquer erro de I/O → saída parcial, exit 0 (fail-open)

**Claim:** The plan relies on `detect-completion.js --json` for drift but does not specify that drift-signaling exit 1 must still have stdout parsed as valid JSON.

**Impact:** An implementation using `execFileSync` can catch exit 1 as a failure, discard stdout, and silently omit the `reconcile` recommendation exactly when drift exists.

**Recommendation:** Add an explicit detector contract: parse JSON stdout for exit 0 and exit 1; treat only unparsable output, bad args, or I/O failure as fail-open.

**Confidence:** high

---

### F-005 [major] dependency break — docs/design/project-onboarding/guide-command-plan.md:53-109

**Evidence:**
> **Resolução (na ordem):** (1) o caminho de contrato; (2) fallback opcional `guideHtmlPath` no `manifest.json` do install, se o usuário publicar o HTML noutro lugar

> Files: `skills/shared/project-assets/project-guide.md`, `scripts/compute-guide.js` (só a resolução/existência do caminho — a abertura fica no asset via `{{BASH_TOOL}}`)

> verifier: `kind test` — `node --test tests/guide/html-resolve.test.js` (presente→resolve o caminho; ausente→sinaliza sem erro; a abertura em si é mockada).

**Claim:** The `guideHtmlPath` fallback depends on an install manifest key, but the plan does not define its schema, ownership, write path, or fixture coverage.

**Impact:** Implementers can read different manifest locations or field shapes, making `guide --html` fallback behavior non-portable and unvalidated in realistic install layouts.

**Recommendation:** Specify `.atomic-skills/manifest.json` as the manifest path and define `guideHtmlPath` as a string path field with a fixture test, or remove the manifest fallback.

**Confidence:** high

## Questions (non-findings)

- docs/design/project-onboarding/guide-command-plan.md:131 — Which aliases are accepted for this plan: `guide` only, or `guide` plus `next`?

## Out of scope

- HTML page generation or validation
- aiDeck dashboard changes
- Replacing the existing no-args summary command
- Network-dependent behavior

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [critical] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-004-final [major] — same
- F-005-blind → F-005-final [major] — same

### Emerged

- _(none)_
## Briefings used

<details>
<summary>Pass 1 briefing</summary>

You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Non-goals (factual, no rationale)

- The command is read-only; it never mutates state files.
- It does not replace the existing no-args 5-line summary command.
- It does not modify the aiDeck dashboard, nor generate or validate the HTML page.
- It requires no network access.
- The HTML page itself is built by a separate agent; this plan covers only the terminal command and how it opens that page.

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Environment constraints (externally verifiable facts)

- Runtime: Node.js `^22.18.0 || >=24.11.0` (package.json engines).
- Test runner: `node --test 'tests/**/*.test.js' 'test/**/*.test.js'` (package.json scripts.test).
- Skill validation: `node scripts/validate-skills.js` (package.json scripts.validate-skills).
- Existing sibling helper scripts in `scripts/`: detect-completion.js, refresh-state.js, detect-scope.js, find-missing-business-intent.js, find-missing-summaries.js, find-missing-task-summaries.js, find-signalless-tasks.js, find-unclosed-done.js, find-unreviewed-plans.js, find-unweighted-tasks.js, detect-orphan-worktrees.js.
- The `nextAction` field already exists on initiative state and is referenced by skills/core/project.md, skills/core/implement.md, and several project-assets files.
- The no-args summary in skills/core/project.md already prints a `NEXT <nextAction>` line.
- Skill markdown files must pass a Gemini-compat strip test (compatibility.test.js); tool references use `{{READ_TOOL}}`/`{{BASH_TOOL}}` placeholders and `{{#if}}` blocks must be block-form.

## Artifact to review

Path: docs/design/project-onboarding/guide-command-plan.md

---BEGIN ARTIFACT---
# Plano — comando `guide` (GPS de terminal da skill `project`)

**Objetivo.** Dar a quem retoma um projeto (ou está no meio de um) uma resposta de uma tela para *"onde estou e qual o próximo passo?"* — o padrão BMAD, mas **derivado do estado real** (`.atomic-skills/`) e do grafo de transições, não de um roteiro codificado. É a camada "GPS": complementa o HTML (que ensina o sistema) e o aiDeck (que mostra o estado vivo).

**`guide` e o guia visual são o MESMO conceito em dois renderizadores.** O HTML (construído por outro agente) é o guia em forma de página; `guide` é o guia no terminal. Por isso `guide --html` abre a versão visual — não é uma feature separada, é o mesmo guia noutra superfície. Contrato com a camada HTML na seção § Contrato com o guia visual (HTML).

**Princípio de design (não-negociável).** `guide` é **read-only, zero-mutação, fail-open** — como o resumo no-args. Ele **não recomputa** o próximo passo do zero: o campo `nextAction` já é autorado e persistido a cada `done`/transição (`project-transitions.md` step 3b). `guide` **lê** esse ponteiro e o **enriquece** com (a) a posição no grafo de vida, (b) o *porquê* daquele passo, (c) escapes se travar. A lógica determinística vive num helper (`scripts/compute-guide.js`), no padrão dos 11 detectores que já existem — não em prosa que raciocina do zero ([[feedback-solutions-at-skill-level]]).

**Não-objetivos.** Não muta estado. Não substitui o no-args (que continua o resumo barato de 5 linhas). Não toca aiDeck nem HTML. Não inventa um novo grafo — reusa as transições reais já documentadas em `project-transitions.md`.

---

## O coração: o mapa estado → próximo passo

Esta é a peça load-bearing. O helper mapeia o estado detectado para UM comando concreto. A tabela abaixo tem que espelhar as transições **reais** (senão `guide` mente). Fonte de verdade das transições: `project-transitions.md` + a lógica de `nextAction`.

| Situação detectada | PRÓXIMO PASSO (comando) | POR QUÊ |
|---|---|---|
| Sem `.atomic-skills/` | `new plan <slug>` (setup) | Nenhum estado ainda. |
| Plano ativo · fase atual `descriptor-only` | `materialize <phase>` | Fase é só descritor; precisa do `businessIntent` antes de implementar. |
| Fase materializada · tasks `pending` | `implement`  (ou `done <first-actionable>`) | Há trabalho admitido pronto para executar. |
| Task(s) `active` há >24h | `reconcile`  (ou `done`/`unblock` a específica) | Gate de reconciliação: estado pode estar defasado do código. |
| Só restam tasks `blocked` | `unblock <id>` | Única saída para frente de `blocked`; mostra `blockedBy[]`. |
| Zero tasks abertas na fase | `phase-done` (in-plan) · `archive <slug>` (standalone) | Fase pronta para fechar; exit-gate + code review. |
| Todas as fases `done` | `finalize` (PR) → depois `archive` | Plano concluído; publicar. |
| Plano `blocked` por `dependsOnPlans[]` | `switch <prereq>` | Não se avança um plano bloqueado; resolver o pré-requisito. |
| Drift detectado (`detect-completion --json` → `drift:true`) | `reconcile` | Itens parecem prontos no código mas não no estado. |
| Ideias pendentes (`ideas.md`) | `idea list` / `idea promote <n>` | Inbox não-vazio (informativo, não bloqueia). |

O helper resolve a **primeira** situação aplicável nessa ordem de prioridade (bloqueios de dependência e reconciliação vêm antes do fluxo feliz). Fail-open: qualquer erro de leitura → emite o que conseguiu e nunca aborta.

## Formato de saída (bloco de ensino, terminal)

```
VOCÊ ESTÁ AQUI   <plano-slug> · <fase-id> (<fase-summary>) — estágio <N>/<M> do ciclo
FEITO            fases <done>/<total> · tasks <done>/<total> · <B> blocked
PRÓXIMO PASSO    → <comando concreto>        <razão de 1 linha>
POR QUÊ          <o gate/condição que esse passo satisfaz>
SE TRAVAR        → project why <id>   ·   project status --browser   ·   project guide
GUIA VISUAL      → project guide --html      (abre a doc visual no navegador)

  IDEIA → DESIGN → PLANO → DECOMPOSE → [MATERIALIZE → IMPLEMENT → VERIFY → PHASE-DONE] → FINALIZE → ARCHIVE
                                                        ▲ você está aqui
```

O mini-mapa ASCII da espinha (com "você está aqui") é o análogo de terminal do fluxo visual do HTML — barato e sempre correto porque a posição vem do estado. A linha **GUIA VISUAL** só é impressa quando o HTML existe no caminho de contrato (fail-open: some silenciosamente enquanto o outro agente não o depositou).

## Contrato com o guia visual (HTML)

O HTML é construído por outro agente. Para `guide --html` encontrá-lo sem acoplar os dois trabalhos, fixamos **um caminho canônico** que o outro agente deve alvejar e que `guide` procura:

- **Caminho de contrato:** `docs/design/project-onboarding/index.html` (co-locado com o brief que o especifica).
- **Resolução (na ordem):** (1) o caminho de contrato; (2) fallback opcional `guideHtmlPath` no `manifest.json` do install, se o usuário publicar o HTML noutro lugar; (3) ausente → `guide --html` imprime *"Guia visual ainda não gerado (esperado em `docs/design/project-onboarding/index.html`)."* e sai 0 (**nunca** erro).
- **Abrir:** reusar o mecanismo de abertura já usado por `status --browser`; para um arquivo local, `open` (macOS) / `xdg-open` (Linux), atrás de uma checagem de existência. Nenhuma dependência de rede.
- **Bidirecional:** o HTML aponta de volta para `project guide` (rodapé "Estou perdido", F3/T-008); `guide` aponta para o HTML (linha GUIA VISUAL). Um par, dois renderizadores.

Este contrato entra como uma linha no brief do HTML para o outro agente saber o alvo (F3/T-008 já toca o brief).

---

## Fases

### F0 — Contrato + esqueleto (dispatch + descriptor + no-op verde)

- **T-001 — Registrar `guide` no router.** Adicionar `guide` (e considerar aliases `next`/`where`) à gramática do router e uma linha na dispatch table apontando para o novo asset.
  - Files: `skills/core/project.md`
  - scopeBoundary: só a gramática + a linha da tabela; nenhuma lógica no router (byte-budget).
  - acceptance: (1) `guide` aparece na dispatch table resolvendo para `project-guide.md`; (2) router continua dentro do byte-budget existente.
  - verifier: `kind shell` — `grep -q 'project-guide.md' skills/core/project.md`

- **T-002 — Criar o asset detalhe `project-guide.md` (stub).** Arquivo com cabeçalho + contrato read-only/fail-open, ainda sem render completo. Usa abstração de ferramentas (`{{READ_TOOL}}`, `{{BASH_TOOL}}`) e block-form `{{#if}}` ([[feedback-strip-test-requires-block-form-if]]).
  - Files: `skills/shared/project-assets/project-guide.md`
  - acceptance: arquivo existe; `compatibility.test.js` passa (strip-test do Gemini limpo).
  - verifier: `kind test` — `node --test tests/**/compatibility.test.js`

- **T-003 — Catalogar `guide`.** Entrada em `meta/catalog.yaml` (grupo `View` ou novo grupo `Guidance`) com signature `[--html]`, regenerar `meta/catalog.json` + `docs/skills/project.md` pelo gerador existente.
  - Files: `meta/catalog.yaml`, `meta/catalog.json`, `docs/skills/project.md`
  - acceptance: `validate-skills` verde; `guide` listado no catálogo com signature `[--html]` e example reais.
  - verifier: `kind shell` — `npm run validate-skills`

- **Gate F0:** `npm run validate-skills` exit 0 · `node --test tests/**/compatibility.test.js` exit 0 · dispatch row resolve.

### F1 — O mapa estado→próximo-passo como helper determinístico

- **T-004 — `scripts/compute-guide.js`.** Helper puro-leitura, zero-token, fail-open: resolve projeto/plano/fase ativos (reusa a resolução do `status`/no-args), lê `nextAction`, rollups (`tasksDone/Total`, `gatesMet/Total`), status da fase (`descriptor-only`/`active`), tasks `blocked`, e o flag de drift (`detect-completion.js --json`). Aplica a tabela de prioridade acima. Emite JSON: `{ youAreHere, doneSummary, nextStep:{command,reason,why}, escapes, spineStage:{n,m} }`.
  - Files: `scripts/compute-guide.js`
  - scopeBoundary: só leitura + o mapa de decisão; NUNCA escreve estado; reusa `detect-completion.js` para o flag de drift (não reimplementa).
  - acceptance: (1) para cada situação da tabela existe uma fixture e o helper emite o comando esperado; (2) qualquer erro de I/O → saída parcial, exit 0 (fail-open); (3) zero mutação (nenhum write no state tree).
  - verifier: `kind test` — `node --test tests/guide/compute-guide.test.js`

- **T-005 — Fixtures dos estados.** Um fixture por linha da tabela (descriptor-only, pending, active>24h, só-blocked, zero-abertas, todas-done, plano-bloqueado, drift, ideias, sem-`.atomic-skills/`).
  - Files: `tests/guide/fixtures/*`, `tests/guide/compute-guide.test.js`
  - acceptance: cada fixture mapeia para o `nextStep.command` esperado; tabela de decisão coberta 100%.
  - verifier: `kind test` — `node --test tests/guide/compute-guide.test.js`

- **Gate F1:** `node --test tests/guide/compute-guide.test.js` exit 0 (mapa de decisão coberto + fail-open provado).

### F2 — Rendering do bloco de ensino

- **T-006 — Render em `project-guide.md`.** O asset chama `compute-guide.js`, formata o bloco de 5 linhas + o mini-mapa ASCII com "você está aqui" na `spineStage`. Fail-open: se o helper falhar, cai para o resumo no-args e diz onde travou. Documenta a relação com o no-args (no-args = resumo barato; `guide` = view de ensino) e os aliases decididos.
  - Files: `skills/shared/project-assets/project-guide.md`
  - acceptance: (1) rodar `guide` num projeto real (ex.: `phase-materialization`) imprime o bloco com PRÓXIMO PASSO batendo com o `nextAction` persistido; (2) mini-mapa marca a fase certa; (3) SE TRAVAR lista `why`/`status --browser`/`guide`.
  - verifier: `kind shell` — smoke que roda o fluxo do asset contra um fixture e diffa o bloco renderizado (`manual` NÃO satisfaz o gate; usar um render-harness determinístico).

- **T-006b — Flag `guide --html` (abrir o guia visual).** Implementar a resolução do caminho de contrato + fallback `manifest.guideHtmlPath` + abertura via `open`/`xdg-open` atrás de checagem de existência; fail-open quando ausente (mensagem + exit 0). Imprime a linha GUIA VISUAL no `guide` normal só quando o HTML existe. Reusa o mecanismo de abertura de `status --browser` onde aplicável.
  - Files: `skills/shared/project-assets/project-guide.md`, `scripts/compute-guide.js` (só a resolução/existência do caminho — a abertura fica no asset via `{{BASH_TOOL}}`)
  - scopeBoundary: só a resolução do caminho + abertura; NÃO gera nem valida o HTML (isso é do outro agente); nenhuma dependência de rede.
  - acceptance: (1) HTML presente no caminho de contrato → `guide --html` abre no navegador; (2) HTML ausente → mensagem clara apontando o caminho esperado + exit 0 (fail-open); (3) linha GUIA VISUAL aparece no `guide` sem-flag apenas quando o arquivo existe.
  - verifier: `kind test` — `node --test tests/guide/html-resolve.test.js` (presente→resolve o caminho; ausente→sinaliza sem erro; a abertura em si é mockada).

- **Gate F2:** smoke de render verde contra fixture · `html-resolve.test.js` verde · eyeball num projeto real registrado como evidência.

### F3 — Guarda de fidelidade (guide nunca cita um verbo que não existe)

- **T-007 — Teste guide-vocab ⊆ catalog.** Todo `nextStep.command` que o helper pode emitir tem que ser um subcomando real em `meta/catalog.yaml`. Isso impede o mapa de decisão de driftar dos verbos reais (que mudam — `materialize`/`unblock`/`review`/`depend` entraram recentemente).
  - Files: `tests/guide/guide-vocab.test.js`
  - acceptance: cada comando do domínio de saída do helper existe no catálogo; um comando removido do catálogo quebra este teste.
  - verifier: `kind test` — `node --test tests/guide/guide-vocab.test.js`

- **T-008 — Cross-link do HTML.** No rodapé "Estou perdido" do brief/HTML e no `docs/skills/project.md`, apontar `guide` como o GPS de terminal. Fecha o loop das 3 camadas.
  - Files: `docs/design/project-onboarding/html-design-brief.md`, `docs/skills/project.md`
  - acceptance: ambos citam `project guide` como a resposta a "onde estou".
  - verifier: `kind shell` — `grep -q 'project guide' docs/design/project-onboarding/html-design-brief.md`

- **Gate F3:** suíte cheia verde (`npm test`) · `guide-vocab.test.js` passa.

---

## Riscos & decisões em aberto

- **D1 — aliases.** `guide` só, ou também `next`/`where`? (Recomendo `guide` + `next` como alias; `where` é ruído.) — decidir em F0/T-001.
- **D2 — relação com no-args.** Manter os dois? Sim: no-args continua o resumo de 5 linhas zero-custo; `guide` é a view de ensino mais rica (mini-mapa + porquê + escapes). Documentar em F2.
- **D3 — multi-projeto.** Quando há >1 projeto em `projects/*`, `guide` opera no ativo do branch atual (mesma resolução do `status`); se ambíguo, cai na disambiguation já existente em `project-view.md`.
- **D4 — render-harness do gate F2.** O verifier de F2 não pode ser `manual`. Precisa de um harness determinístico que execute o caminho do asset contra um fixture e compare o bloco — decidir a forma (script node que importa `compute-guide.js` + um formatador puro extraído do asset) em F2/T-006. **Implicação:** a formatação do bloco deve viver numa função pura testável (ex.: `formatGuide(json)` em `compute-guide.js`), não só em prosa do asset, para o gate ter o que verificar.

## Sequência de execução

F0 → F1 → F2 → F3, estritamente. F1 é o núcleo (o mapa determinístico); F2 depende de F1; F3 é a guarda anti-drift. Cada fase fecha por `phase-done` (exit-gate verificado + code review), no fluxo normal da própria skill `project`.

---

### Como levar este plano ao rastreamento (opcional)

Este doc é decompose-shaped (fases + tasks com Files/scopeBoundary/acceptance/verifier determinístico). Para rastrear em `.atomic-skills/`, rode `/atomic-skills:project adopt docs/design/project-onboarding/guide-command-plan.md` — ele captura como Plano + Fases + Tasks. Se preferir passar pelo gate de DESIGN antes, `/atomic-skills:project new plan guide-command` (que exige o `design.md` via brainstorm primeiro).
---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only. If verdict is approve, say so in one sentence and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
<exact snippet from artifact — quote literally>

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

- <file>:<line> — <question to author>

## Out of scope

- <item>

## Format rules

- IDs must match regex F-\d{3} (e.g. F-001).
- Severity enum: blocker | critical | major | minor | nit.
- Confidence enum: high | medium | low.
- counts numbers must equal actual finding count by severity.
- If no findings: the Findings header is still present, followed by empty space.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above

Begin review now.

</details>

<details>
<summary>Pass 2 briefing</summary>

You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Non-goals (factual, no rationale)

- The command is read-only; it never mutates state files.
- It does not replace the existing no-args 5-line summary command.
- It does not modify the aiDeck dashboard, nor generate or validate the HTML page.
- It requires no network access.
- The HTML page itself is built by a separate agent; this plan covers only the terminal command and how it opens that page.

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Environment constraints (externally verifiable facts)

- Runtime: Node.js `^22.18.0 || >=24.11.0` (package.json engines).
- Test runner: `node --test 'tests/**/*.test.js' 'test/**/*.test.js'` (package.json scripts.test).
- Skill validation: `node scripts/validate-skills.js` (package.json scripts.validate-skills).
- Existing sibling helper scripts in `scripts/`: detect-completion.js, refresh-state.js, detect-scope.js, find-missing-business-intent.js, find-missing-summaries.js, find-missing-task-summaries.js, find-signalless-tasks.js, find-unclosed-done.js, find-unreviewed-plans.js, find-unweighted-tasks.js, detect-orphan-worktrees.js.
- The `nextAction` field already exists on initiative state and is referenced by skills/core/project.md, skills/core/implement.md, and several project-assets files.
- The no-args summary in skills/core/project.md already prints a `NEXT <nextAction>` line.
- Skill markdown files must pass a Gemini-compat strip test (compatibility.test.js); tool references use `{{READ_TOOL}}`/`{{BASH_TOOL}}` placeholders and `{{#if}}` blocks must be block-form.

## Artifact to review

Path: docs/design/project-onboarding/guide-command-plan.md

---BEGIN ARTIFACT---
# Plano — comando `guide` (GPS de terminal da skill `project`)

**Objetivo.** Dar a quem retoma um projeto (ou está no meio de um) uma resposta de uma tela para *"onde estou e qual o próximo passo?"* — o padrão BMAD, mas **derivado do estado real** (`.atomic-skills/`) e do grafo de transições, não de um roteiro codificado. É a camada "GPS": complementa o HTML (que ensina o sistema) e o aiDeck (que mostra o estado vivo).

**`guide` e o guia visual são o MESMO conceito em dois renderizadores.** O HTML (construído por outro agente) é o guia em forma de página; `guide` é o guia no terminal. Por isso `guide --html` abre a versão visual — não é uma feature separada, é o mesmo guia noutra superfície. Contrato com a camada HTML na seção § Contrato com o guia visual (HTML).

**Princípio de design (não-negociável).** `guide` é **read-only, zero-mutação, fail-open** — como o resumo no-args. Ele **não recomputa** o próximo passo do zero: o campo `nextAction` já é autorado e persistido a cada `done`/transição (`project-transitions.md` step 3b). `guide` **lê** esse ponteiro e o **enriquece** com (a) a posição no grafo de vida, (b) o *porquê* daquele passo, (c) escapes se travar. A lógica determinística vive num helper (`scripts/compute-guide.js`), no padrão dos 11 detectores que já existem — não em prosa que raciocina do zero ([[feedback-solutions-at-skill-level]]).

**Não-objetivos.** Não muta estado. Não substitui o no-args (que continua o resumo barato de 5 linhas). Não toca aiDeck nem HTML. Não inventa um novo grafo — reusa as transições reais já documentadas em `project-transitions.md`.

---

## O coração: o mapa estado → próximo passo

Esta é a peça load-bearing. O helper mapeia o estado detectado para UM comando concreto. A tabela abaixo tem que espelhar as transições **reais** (senão `guide` mente). Fonte de verdade das transições: `project-transitions.md` + a lógica de `nextAction`.

| Situação detectada | PRÓXIMO PASSO (comando) | POR QUÊ |
|---|---|---|
| Sem `.atomic-skills/` | `new plan <slug>` (setup) | Nenhum estado ainda. |
| Plano ativo · fase atual `descriptor-only` | `materialize <phase>` | Fase é só descritor; precisa do `businessIntent` antes de implementar. |
| Fase materializada · tasks `pending` | `implement`  (ou `done <first-actionable>`) | Há trabalho admitido pronto para executar. |
| Task(s) `active` há >24h | `reconcile`  (ou `done`/`unblock` a específica) | Gate de reconciliação: estado pode estar defasado do código. |
| Só restam tasks `blocked` | `unblock <id>` | Única saída para frente de `blocked`; mostra `blockedBy[]`. |
| Zero tasks abertas na fase | `phase-done` (in-plan) · `archive <slug>` (standalone) | Fase pronta para fechar; exit-gate + code review. |
| Todas as fases `done` | `finalize` (PR) → depois `archive` | Plano concluído; publicar. |
| Plano `blocked` por `dependsOnPlans[]` | `switch <prereq>` | Não se avança um plano bloqueado; resolver o pré-requisito. |
| Drift detectado (`detect-completion --json` → `drift:true`) | `reconcile` | Itens parecem prontos no código mas não no estado. |
| Ideias pendentes (`ideas.md`) | `idea list` / `idea promote <n>` | Inbox não-vazio (informativo, não bloqueia). |

O helper resolve a **primeira** situação aplicável nessa ordem de prioridade (bloqueios de dependência e reconciliação vêm antes do fluxo feliz). Fail-open: qualquer erro de leitura → emite o que conseguiu e nunca aborta.

## Formato de saída (bloco de ensino, terminal)

```
VOCÊ ESTÁ AQUI   <plano-slug> · <fase-id> (<fase-summary>) — estágio <N>/<M> do ciclo
FEITO            fases <done>/<total> · tasks <done>/<total> · <B> blocked
PRÓXIMO PASSO    → <comando concreto>        <razão de 1 linha>
POR QUÊ          <o gate/condição que esse passo satisfaz>
SE TRAVAR        → project why <id>   ·   project status --browser   ·   project guide
GUIA VISUAL      → project guide --html      (abre a doc visual no navegador)

  IDEIA → DESIGN → PLANO → DECOMPOSE → [MATERIALIZE → IMPLEMENT → VERIFY → PHASE-DONE] → FINALIZE → ARCHIVE
                                                        ▲ você está aqui
```

O mini-mapa ASCII da espinha (com "você está aqui") é o análogo de terminal do fluxo visual do HTML — barato e sempre correto porque a posição vem do estado. A linha **GUIA VISUAL** só é impressa quando o HTML existe no caminho de contrato (fail-open: some silenciosamente enquanto o outro agente não o depositou).

## Contrato com o guia visual (HTML)

O HTML é construído por outro agente. Para `guide --html` encontrá-lo sem acoplar os dois trabalhos, fixamos **um caminho canônico** que o outro agente deve alvejar e que `guide` procura:

- **Caminho de contrato:** `docs/design/project-onboarding/index.html` (co-locado com o brief que o especifica).
- **Resolução (na ordem):** (1) o caminho de contrato; (2) fallback opcional `guideHtmlPath` no `manifest.json` do install, se o usuário publicar o HTML noutro lugar; (3) ausente → `guide --html` imprime *"Guia visual ainda não gerado (esperado em `docs/design/project-onboarding/index.html`)."* e sai 0 (**nunca** erro).
- **Abrir:** reusar o mecanismo de abertura já usado por `status --browser`; para um arquivo local, `open` (macOS) / `xdg-open` (Linux), atrás de uma checagem de existência. Nenhuma dependência de rede.
- **Bidirecional:** o HTML aponta de volta para `project guide` (rodapé "Estou perdido", F3/T-008); `guide` aponta para o HTML (linha GUIA VISUAL). Um par, dois renderizadores.

Este contrato entra como uma linha no brief do HTML para o outro agente saber o alvo (F3/T-008 já toca o brief).

---

## Fases

### F0 — Contrato + esqueleto (dispatch + descriptor + no-op verde)

- **T-001 — Registrar `guide` no router.** Adicionar `guide` (e considerar aliases `next`/`where`) à gramática do router e uma linha na dispatch table apontando para o novo asset.
  - Files: `skills/core/project.md`
  - scopeBoundary: só a gramática + a linha da tabela; nenhuma lógica no router (byte-budget).
  - acceptance: (1) `guide` aparece na dispatch table resolvendo para `project-guide.md`; (2) router continua dentro do byte-budget existente.
  - verifier: `kind shell` — `grep -q 'project-guide.md' skills/core/project.md`

- **T-002 — Criar o asset detalhe `project-guide.md` (stub).** Arquivo com cabeçalho + contrato read-only/fail-open, ainda sem render completo. Usa abstração de ferramentas (`{{READ_TOOL}}`, `{{BASH_TOOL}}`) e block-form `{{#if}}` ([[feedback-strip-test-requires-block-form-if]]).
  - Files: `skills/shared/project-assets/project-guide.md`
  - acceptance: arquivo existe; `compatibility.test.js` passa (strip-test do Gemini limpo).
  - verifier: `kind test` — `node --test tests/**/compatibility.test.js`

- **T-003 — Catalogar `guide`.** Entrada em `meta/catalog.yaml` (grupo `View` ou novo grupo `Guidance`) com signature `[--html]`, regenerar `meta/catalog.json` + `docs/skills/project.md` pelo gerador existente.
  - Files: `meta/catalog.yaml`, `meta/catalog.json`, `docs/skills/project.md`
  - acceptance: `validate-skills` verde; `guide` listado no catálogo com signature `[--html]` e example reais.
  - verifier: `kind shell` — `npm run validate-skills`

- **Gate F0:** `npm run validate-skills` exit 0 · `node --test tests/**/compatibility.test.js` exit 0 · dispatch row resolve.

### F1 — O mapa estado→próximo-passo como helper determinístico

- **T-004 — `scripts/compute-guide.js`.** Helper puro-leitura, zero-token, fail-open: resolve projeto/plano/fase ativos (reusa a resolução do `status`/no-args), lê `nextAction`, rollups (`tasksDone/Total`, `gatesMet/Total`), status da fase (`descriptor-only`/`active`), tasks `blocked`, e o flag de drift (`detect-completion.js --json`). Aplica a tabela de prioridade acima. Emite JSON: `{ youAreHere, doneSummary, nextStep:{command,reason,why}, escapes, spineStage:{n,m} }`.
  - Files: `scripts/compute-guide.js`
  - scopeBoundary: só leitura + o mapa de decisão; NUNCA escreve estado; reusa `detect-completion.js` para o flag de drift (não reimplementa).
  - acceptance: (1) para cada situação da tabela existe uma fixture e o helper emite o comando esperado; (2) qualquer erro de I/O → saída parcial, exit 0 (fail-open); (3) zero mutação (nenhum write no state tree).
  - verifier: `kind test` — `node --test tests/guide/compute-guide.test.js`

- **T-005 — Fixtures dos estados.** Um fixture por linha da tabela (descriptor-only, pending, active>24h, só-blocked, zero-abertas, todas-done, plano-bloqueado, drift, ideias, sem-`.atomic-skills/`).
  - Files: `tests/guide/fixtures/*`, `tests/guide/compute-guide.test.js`
  - acceptance: cada fixture mapeia para o `nextStep.command` esperado; tabela de decisão coberta 100%.
  - verifier: `kind test` — `node --test tests/guide/compute-guide.test.js`

- **Gate F1:** `node --test tests/guide/compute-guide.test.js` exit 0 (mapa de decisão coberto + fail-open provado).

### F2 — Rendering do bloco de ensino

- **T-006 — Render em `project-guide.md`.** O asset chama `compute-guide.js`, formata o bloco de 5 linhas + o mini-mapa ASCII com "você está aqui" na `spineStage`. Fail-open: se o helper falhar, cai para o resumo no-args e diz onde travou. Documenta a relação com o no-args (no-args = resumo barato; `guide` = view de ensino) e os aliases decididos.
  - Files: `skills/shared/project-assets/project-guide.md`
  - acceptance: (1) rodar `guide` num projeto real (ex.: `phase-materialization`) imprime o bloco com PRÓXIMO PASSO batendo com o `nextAction` persistido; (2) mini-mapa marca a fase certa; (3) SE TRAVAR lista `why`/`status --browser`/`guide`.
  - verifier: `kind shell` — smoke que roda o fluxo do asset contra um fixture e diffa o bloco renderizado (`manual` NÃO satisfaz o gate; usar um render-harness determinístico).

- **T-006b — Flag `guide --html` (abrir o guia visual).** Implementar a resolução do caminho de contrato + fallback `manifest.guideHtmlPath` + abertura via `open`/`xdg-open` atrás de checagem de existência; fail-open quando ausente (mensagem + exit 0). Imprime a linha GUIA VISUAL no `guide` normal só quando o HTML existe. Reusa o mecanismo de abertura de `status --browser` onde aplicável.
  - Files: `skills/shared/project-assets/project-guide.md`, `scripts/compute-guide.js` (só a resolução/existência do caminho — a abertura fica no asset via `{{BASH_TOOL}}`)
  - scopeBoundary: só a resolução do caminho + abertura; NÃO gera nem valida o HTML (isso é do outro agente); nenhuma dependência de rede.
  - acceptance: (1) HTML presente no caminho de contrato → `guide --html` abre no navegador; (2) HTML ausente → mensagem clara apontando o caminho esperado + exit 0 (fail-open); (3) linha GUIA VISUAL aparece no `guide` sem-flag apenas quando o arquivo existe.
  - verifier: `kind test` — `node --test tests/guide/html-resolve.test.js` (presente→resolve o caminho; ausente→sinaliza sem erro; a abertura em si é mockada).

- **Gate F2:** smoke de render verde contra fixture · `html-resolve.test.js` verde · eyeball num projeto real registrado como evidência.

### F3 — Guarda de fidelidade (guide nunca cita um verbo que não existe)

- **T-007 — Teste guide-vocab ⊆ catalog.** Todo `nextStep.command` que o helper pode emitir tem que ser um subcomando real em `meta/catalog.yaml`. Isso impede o mapa de decisão de driftar dos verbos reais (que mudam — `materialize`/`unblock`/`review`/`depend` entraram recentemente).
  - Files: `tests/guide/guide-vocab.test.js`
  - acceptance: cada comando do domínio de saída do helper existe no catálogo; um comando removido do catálogo quebra este teste.
  - verifier: `kind test` — `node --test tests/guide/guide-vocab.test.js`

- **T-008 — Cross-link do HTML.** No rodapé "Estou perdido" do brief/HTML e no `docs/skills/project.md`, apontar `guide` como o GPS de terminal. Fecha o loop das 3 camadas.
  - Files: `docs/design/project-onboarding/html-design-brief.md`, `docs/skills/project.md`
  - acceptance: ambos citam `project guide` como a resposta a "onde estou".
  - verifier: `kind shell` — `grep -q 'project guide' docs/design/project-onboarding/html-design-brief.md`

- **Gate F3:** suíte cheia verde (`npm test`) · `guide-vocab.test.js` passa.

---

## Riscos & decisões em aberto

- **D1 — aliases.** `guide` só, ou também `next`/`where`? (Recomendo `guide` + `next` como alias; `where` é ruído.) — decidir em F0/T-001.
- **D2 — relação com no-args.** Manter os dois? Sim: no-args continua o resumo de 5 linhas zero-custo; `guide` é a view de ensino mais rica (mini-mapa + porquê + escapes). Documentar em F2.
- **D3 — multi-projeto.** Quando há >1 projeto em `projects/*`, `guide` opera no ativo do branch atual (mesma resolução do `status`); se ambíguo, cai na disambiguation já existente em `project-view.md`.
- **D4 — render-harness do gate F2.** O verifier de F2 não pode ser `manual`. Precisa de um harness determinístico que execute o caminho do asset contra um fixture e compare o bloco — decidir a forma (script node que importa `compute-guide.js` + um formatador puro extraído do asset) em F2/T-006. **Implicação:** a formatação do bloco deve viver numa função pura testável (ex.: `formatGuide(json)` em `compute-guide.js`), não só em prosa do asset, para o gate ter o que verificar.

## Sequência de execução

F0 → F1 → F2 → F3, estritamente. F1 é o núcleo (o mapa determinístico); F2 depende de F1; F3 é a guarda anti-drift. Cada fase fecha por `phase-done` (exit-gate verificado + code review), no fluxo normal da própria skill `project`.

---

### Como levar este plano ao rastreamento (opcional)

Este doc é decompose-shaped (fases + tasks com Files/scopeBoundary/acceptance/verifier determinístico). Para rastrear em `.atomic-skills/`, rode `/atomic-skills:project adopt docs/design/project-onboarding/guide-command-plan.md` — ele captura como Plano + Fases + Tasks. Se preferir passar pelo gate de DESIGN antes, `/atomic-skills:project new plan guide-command` (que exige o `design.md` via brainstorm primeiro).
---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only. If verdict is approve, say so in one sentence and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
<exact snippet from artifact — quote literally>

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

- <file>:<line> — <question to author>

## Out of scope

- <item>

## Format rules

- IDs must match regex F-\d{3} (e.g. F-001).
- Severity enum: blocker | critical | major | minor | nit.
- Confidence enum: high | medium | low.
- counts numbers must equal actual finding count by severity.
- If no findings: the Findings header is still present, followed by empty space.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above


## External constraints (verifiable)

The constraints below are verifiable externally. Each line includes how to
verify if needed. Treat as ground truth.

- Runtime is Node.js `^22.18.0 || >=24.11.0` — verify: `grep -A2 engines package.json`.
- Test runner is `node --test 'tests/**/*.test.js' 'test/**/*.test.js'` — verify: `package.json` `scripts.test`.
- Skill validation is `node scripts/validate-skills.js` — verify: `package.json` `scripts.validate-skills`.
- `scripts/detect-completion.js` exists and is invoked as `node scripts/detect-completion.js --json` by the no-args DRIFT line — verify: `ls scripts/detect-completion.js` and `grep -n detect-completion skills/core/project.md`.
- `nextAction` is a persisted field on initiative state, rewritten to one concrete next step on every `done`/transition (documented at `project-transitions.md` step 3b) — verify: `grep -rn nextAction skills/`.
- The no-args summary in `skills/core/project.md` already prints a `NEXT <nextAction>` line — verify: `grep -n 'NEXT' skills/core/project.md` (line 87).
- Eleven sibling helper scripts already exist in `scripts/` (detect-completion, refresh-state, detect-scope, find-missing-business-intent, find-missing-summaries, find-missing-task-summaries, find-signalless-tasks, find-unclosed-done, find-unreviewed-plans, find-unweighted-tasks, detect-orphan-worktrees) — verify: `ls scripts/`.
- Skill markdown must pass a Gemini strip test (`compatibility.test.js`); `{{#if}}` blocks must be block-form and tool refs use `{{READ_TOOL}}`/`{{BASH_TOOL}}` — verify: `node --test tests/**/compatibility.test.js`.
- The install `manifest.json` referenced by the plan is the one written by `src/install.js` under the runtime dir; the plan does NOT currently define a `guideHtmlPath` key — verify: `grep -rn guideHtmlPath src/ meta/ || echo absent`.

## Pass 1 (blind) findings

The following findings were produced by your previous review WITHOUT the
constraints above. Re-evaluate each against the constraints.

---BEGIN PASS 1 OUTPUT---
---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has a source-of-truth conflict at its core: it says `guide` must read persisted `nextAction`, but the implementation tasks define a second deterministic decision engine that emits its own `nextStep.command`. That makes the terminal guide capable of disagreeing with the existing no-args summary.

There are also concrete viability gaps around command shape, priority ordering, drift detection semantics, and the undocumented `manifest.json` fallback for `guide --html`. These are fixable, but they need to be resolved before implementation because they affect the helper contract and tests.

## Findings

### F-001 [critical] contradiction — docs/design/project-onboarding/guide-command-plan.md:7-89

**Evidence:**
> Ele **não recomputa** o próximo passo do zero: o campo `nextAction` já é autorado e persistido a cada `done`/transição (`project-transitions.md` step 3b). `guide` **lê** esse ponteiro e o **enriquece**

> Aplica a tabela de prioridade acima. Emite JSON: `{ youAreHere, doneSummary, nextStep:{command,reason,why}, escapes, spineStage:{n,m} }`.

**Claim:** The plan declares persisted `nextAction` as the command source of truth, but T-004 makes `compute-guide.js` derive `nextStep.command` from a separate state-priority table, creating two independent authorities for the next command.

**Impact:** `project guide` can print a different next step than the existing no-args `NEXT <nextAction>` line, and tests can pass by validating the table while the persisted workflow pointer is stale or contradictory.

**Recommendation:** Make `nextAction` the only source for `nextStep.command`; use the table only to annotate `reason`, `why`, and `spineStage`, with an explicit stale-or-missing fallback path and tests that compare guide output to persisted `nextAction`.

**Confidence:** high

---

### F-002 [major] ordering — docs/design/project-onboarding/guide-command-plan.md:19-30

**Evidence:**
> | Plano ativo · fase atual `descriptor-only` | `materialize <phase>` | Fase é só descritor; precisa do `businessIntent` antes de implementar. |
> | Fase materializada · tasks `pending` | `implement`  (ou `done <first-actionable>`) | Há trabalho admitido pronto para executar. |
> | Plano `blocked` por `dependsOnPlans[]` | `switch <prereq>` | Não se avança um plano bloqueado; resolver o pré-requisito. |
> | Drift detectado (`detect-completion --json` → `drift:true`) | `reconcile` | Itens parecem prontos no código mas não no estado. |

> O helper resolve a **primeira** situação aplicável nessa ordem de prioridade (bloqueios de dependência e reconciliação vêm antes do fluxo feliz).

**Claim:** The text says dependency blocks and reconciliation outrank the happy path, but the table order places `descriptor-only`, `pending`, and other happy-path states before `dependsOnPlans[]` and drift.

**Impact:** A row-order implementation will recommend `materialize` or `implement` for a blocked or drifted plan, while a prose-order implementation will recommend `switch` or `reconcile`; overlapping states will produce inconsistent behavior across implementations.

**Recommendation:** Replace the table with a numbered precedence list in the actual intended order and add overlapping fixtures such as “blocked + pending” and “drift + pending” that assert the higher-priority command.

**Confidence:** high

---

### F-003 [major] ambiguity — docs/design/project-onboarding/guide-command-plan.md:15-118

**Evidence:**
> O helper mapeia o estado detectado para UM comando concreto.

> | Zero tasks abertas na fase | `phase-done` (in-plan) · `archive <slug>` (standalone) | Fase pronta para fechar; exit-gate + code review. |
> | Todas as fases `done` | `finalize` (PR) → depois `archive` | Plano concluído; publicar. |
> | Ideias pendentes (`ideas.md`) | `idea list` / `idea promote <n>` | Inbox não-vazio (informativo, não bloqueia). |

> Todo `nextStep.command` que o helper pode emitir tem que ser um subcomando real em `meta/catalog.yaml`.

**Claim:** The decision table requires one concrete command but includes alternatives, command sequences, placeholders, and an argument-less `finalize`, while T-007 only checks subcommand vocabulary rather than a runnable command shape.

**Impact:** `guide` may print non-executable instructions like `idea list / idea promote <n>` or `finalize`, and the proposed vocabulary test can still pass because the first token exists in the catalog.

**Recommendation:** Define `nextStep.command` as exactly one fully invokable command string with resolved required arguments, and extend T-007 to validate command signatures or explicit allowed placeholders, not just first-token membership.

**Confidence:** high

---

### F-004 [major] viability — docs/design/project-onboarding/guide-command-plan.md:27-89

**Evidence:**
> | Drift detectado (`detect-completion --json` → `drift:true`) | `reconcile` | Itens parecem prontos no código mas não no estado. |

> reusa `detect-completion.js` para o flag de drift (não reimplementa).

> qualquer erro de I/O → saída parcial, exit 0 (fail-open)

**Claim:** The plan relies on `detect-completion.js --json` for drift while also treating helper failures as fail-open, but it does not specify that drift-signaling nonzero exits must be parsed as valid output rather than handled as errors.

**Impact:** An implementation using `execFileSync` or similar can catch the nonzero drift exit as a failure, discard `stdout`, and silently omit the `reconcile` recommendation exactly when drift exists.

**Recommendation:** Add an explicit detector contract: parse JSON stdout for both exit 0 and the drift exit, treat only unparsable output or I/O failure as fail-open, and add a fixture that simulates drift JSON with a nonzero exit.

**Confidence:** high

---

### F-005 [major] dependency break — docs/design/project-onboarding/guide-command-plan.md:52-109

**Evidence:**
> **Resolução (na ordem):** (1) o caminho de contrato; (2) fallback opcional `guideHtmlPath` no `manifest.json` do install, se o usuário publicar o HTML noutro lugar

> Files: `skills/shared/project-assets/project-guide.md`, `scripts/compute-guide.js` (só a resolução/existência do caminho — a abertura fica no asset via `{{BASH_TOOL}}`)

> verifier: `kind test` — `node --test tests/guide/html-resolve.test.js` (presente→resolve o caminho; ausente→sinaliza sem erro; a abertura em si é mockada).

**Claim:** The `guideHtmlPath` fallback depends on an install `manifest.json`, but the plan does not define its path, schema, ownership, fixture, or any task that updates or validates it.

**Impact:** Two implementers can read different manifest locations or field shapes, making `guide --html` fallback behavior non-portable and leaving the documented fallback untested in realistic install layouts.

**Recommendation:** Specify the exact manifest path and `guideHtmlPath` schema in T-006b, add a fixture covering that fallback, or remove the manifest fallback from the contract.

**Confidence:** medium

## Questions (non-findings)

- docs/design/project-onboarding/guide-command-plan.md:131 — Which aliases are actually part of the accepted command surface for this plan: `guide` only, or `guide` plus `next`?

## Out of scope

- HTML page generation or validation
- aiDeck dashboard changes
- Replacing the existing no-args summary command
- Network-dependent behavior---END PASS 1 OUTPUT---

## Your task in this pass

1. Re-evaluate ALL findings from Pass 1 against the External Constraints.
   For EACH Pass 1 finding, decide one of:
   - **DROP** — finding is invalid given a constraint or non-goal
   - **MAINTAIN** — finding stands, severity unchanged
   - **REFINE** — finding stands but severity changes

2. Identify NEW findings that emerge ONLY because of these constraints.

3. Output the FULL final findings list (use new sequential IDs starting at
   F-001) plus a complete `## Pass 2 reconciliation` block.

## Output format

# Required Output Format — Pass 2 (Informed)

Same template as Pass 1 PLUS an obligatory `## Pass 2 reconciliation` block.
You MUST respond in this exact structure.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id>
pass: informed
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words>

## Findings

### F-001 [<severity>] <category> — <file>:<line>

**Evidence:** <...>
**Claim:** <...>
**Impact:** <...>
**Recommendation:** <...>
**Confidence:** <...>

---

### F-002 ... (final IDs — these are the post-constraints findings)

## Questions (non-findings)

- <file>:<line> — <question>

## Out of scope

- <item>

## Pass 2 reconciliation

### Dropped from blind pass

<For each Pass 1 finding you are dropping, write one line:>

- F-001-blind [<severity>] <category> — DROPPED: <one-sentence reason citing
  which constraint or non-goal makes it invalid>

<If no drops: write `- _(none)_`>

### Maintained

<For each Pass 1 finding kept (with or without severity change):>

- F-002-blind → F-001-final [<severity>] — <same | severity changed: was X, now Y>

<If no maintained: write `- _(none)_`>

### Emerged

<For each NEW finding that surfaced only because constraints were revealed:>

- F-XXX-final [<severity>] <category> — emerged: <one-sentence reason citing
  the constraint that triggered the finding>

<If no emerged: write `- _(none)_`>
````

## Rules specific to Pass 2

- Final findings use sequential IDs `F-001, F-002, ...` (no `-final` suffix in the `## Findings` section — only in reconciliation references).
- In reconciliation, refer to blind findings with `-blind` suffix and maintained mappings with `→ F-XXX-final`.
- `counts` is the COUNT OF FINAL findings (post-reconciliation), not blind.
- `pass: informed` (literal).
- All universal rules from `output-template-pass1.md` apply.

Begin reconciliation now.

</details>

## Fixes applied in this session

<!-- Append-only. Triage step adds lines here as user approves/skips. -->

- F-001 [critical] applied — `nextAction` is now the SOLE source of `nextStep.command` (read verbatim); the precedence list only derives `spineStage`/`reason`/`why` and supplies a `commandSource:"fallback"` command when `nextAction` is absent. Test added comparing guide output to persisted `nextAction`.
- F-002 [major] applied — decision table replaced by a numbered precedence list in true order (dependency-block → drift/reconcile → happy path); T-005 adds overlapping fixtures (blocked+pending, drift+pending, active>24h+descriptor-only).
- F-003 [major] applied — each fallback command is one invokable string with resolved args; ideas moved to a separate informational line; T-007 now validates command SHAPE (signature), not just first-token membership.
- F-004 [major] applied — explicit drift-detector contract in T-004: parse stdout JSON on exit 0 AND exit 1 (drift signals via exit 1 per detect-completion.js:57); only unparsable/exit-2/spawn-failure is fail-open; fixture simulates drift JSON + exit 1.
- F-005 [major] applied — removed the `manifest.guideHtmlPath` fallback; `guide --html` resolves a single fixed contract path only (kept the contract lean + testable).
- Q (aliases) — recorded as open decision D1 (guide only vs guide+next), unchanged.
