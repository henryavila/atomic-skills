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
