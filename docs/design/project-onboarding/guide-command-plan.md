# Plano — comando `guide` (GPS de terminal da skill `project`)

**Objetivo.** Dar a quem retoma um projeto (ou está no meio de um) uma resposta de uma tela para *"onde estou e qual o próximo passo?"* — o padrão BMAD, mas **derivado do estado real** (`.atomic-skills/`) e do grafo de transições, não de um roteiro codificado. É a camada "GPS": complementa o HTML (que ensina o sistema) e o aiDeck (que mostra o estado vivo).

**`guide` e o guia visual são o MESMO conceito em dois renderizadores.** O HTML (construído por outro agente) é o guia em forma de página; `guide` é o guia no terminal. Por isso `guide --html` abre a versão visual — não é uma feature separada, é o mesmo guia noutra superfície. Contrato com a camada HTML na seção § Contrato com o guia visual (HTML).

**Princípio de design (não-negociável).** `guide` é **read-only, zero-mutação, fail-open** — como o resumo no-args. Ele **não recomputa** o próximo passo do zero: o campo `nextAction` já é autorado e persistido a cada `done`/transição (`project-transitions.md` step 3b). `guide` **lê** esse ponteiro e o **enriquece** com (a) a posição no grafo de vida, (b) o *porquê* daquele passo, (c) escapes se travar. A lógica determinística vive num helper (`scripts/compute-guide.js`), no padrão dos 11 detectores que já existem — não em prosa que raciocina do zero ([[feedback-solutions-at-skill-level]]).

**Não-objetivos.** Não muta estado. Não substitui o no-args (que continua o resumo barato de 5 linhas). Não toca aiDeck nem HTML. Não inventa um novo grafo — reusa as transições reais já documentadas em `project-transitions.md`.

---

## O coração: `nextAction` é o comando; a precedência é a anotação

**Fonte-da-verdade única do comando (F-001).** O `nextStep.command` vem **exclusivamente** do campo `nextAction` persistido — que `project-transitions.md` step 3b já autora como **exatamente um passo imperativo concreto** a cada `done`/transição. `guide` **nunca** recomputa nem inventa o comando: lê `nextAction` verbatim. Isso garante que `guide` e a linha `NEXT <nextAction>` do no-args **nunca divirjam**.

O que o helper computa **além** do comando: a **posição no ciclo** (`spineStage`) e as anotações `reason`/`why`/`escapes`. Para isso ele classifica o estado atual por uma **lista de precedência** — não uma tabela; a ordem É a semântica. A mesma lista serve de **fallback do comando** apenas quando `nextAction` está ausente/vazio, e só então, marcado explicitamente como sugestão.

**Lista de precedência (primeira que casar vence; bloqueios antes do fluxo feliz):**

1. **Sem `.atomic-skills/`** → estágio *setup* · fallback `new plan <slug>`.
2. **Plano `blocked` por `dependsOnPlans[]`** → estágio *blocked* · `switch <prereq>` (`<prereq>` = slug do pré-requisito). *Bloqueio de dependência vem antes de tudo.*
3. **Drift detectado** (`detect-completion.js --json` → `drift:true`) → estágio *reconcile* · `reconcile`.
4. **Task(s) `active` há >24h** → estágio *reconcile* · `reconcile`.
5. **Só restam tasks `blocked`** → estágio *implement* · `unblock <id>` (mostra `blockedBy[]`).
6. **Fase atual `descriptor-only`** → estágio *materialize* · `materialize <phase>`.
7. **Fase materializada · tasks `pending`/`active`** → estágio *implement* · `implement`.
8. **Zero tasks abertas · fase de plano (in-plan)** → estágio *phase-done* · `phase-done`.
9. **Zero tasks abertas · initiative standalone** → estágio *archive* · `archive <slug>`.
10. **Todas as fases `done`** → estágio *finalize* · `finalize`.

Cada comando de fallback é **uma string única e invocável** com os argumentos **resolvidos do estado** (`<slug>`/`<phase>`/`<id>`/`<prereq>` viram os valores reais, nunca ficam como placeholder). Ideias pendentes (`ideas.md` não-vazio) **não** entram na precedência do comando — são uma **linha informativa** à parte (`IDEIAS  N pendentes — idea list`), como já faz o no-args. Fail-open: qualquer erro de leitura → emite o que conseguiu e nunca aborta.

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
- **Resolução:** (1) o caminho de contrato fixo; (2) ausente → `guide --html` imprime *"Guia visual ainda não gerado (esperado em `docs/design/project-onboarding/index.html`)."* e sai 0 (**nunca** erro). Um único caminho fixo, **sem fallback configurável** (F-005: um `manifest.guideHtmlPath` exigiria path/schema/ownership/fixture próprios — mantemos o contrato enxuto e testável com um caminho só).
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

- **T-004 — `scripts/compute-guide.js`.** Helper puro-leitura, zero-token, fail-open. Resolve projeto/plano/fase ativos (reusa a resolução do `status`/no-args), lê rollups (`tasksDone/Total`, `gatesMet/Total`), status da fase, tasks `blocked`, e classifica o estado pela lista de precedência acima para derivar `spineStage`/`reason`/`why`. **O `nextStep.command` é o `nextAction` persistido lido verbatim** (F-001); a precedência só fornece o comando quando `nextAction` está ausente/vazio, marcado `commandSource: "fallback"` (senão `"persisted"`). Emite JSON: `{ youAreHere, doneSummary, nextStep:{command, commandSource, reason, why}, escapes, spineStage:{n,m} }`.
  - **Contrato do detector de drift (F-004):** `detect-completion.js --json` sai **1 quando há drift**, 0 sem drift, 2 em bad-args (`scripts/detect-completion.js:57`). Portanto: parsear o **stdout como JSON tanto em exit 0 quanto em exit 1**; tratar como fail-open (sem drift) **somente** stdout não-parseável, exit 2, ou falha de spawn. NUNCA um `execFileSync` que trate exit 1 como erro e descarte o stdout — isso engoliria o `reconcile` exatamente quando há drift.
  - Files: `scripts/compute-guide.js`
  - scopeBoundary: só leitura + classificação + leitura do `nextAction`; NUNCA escreve estado; reusa `detect-completion.js` (não reimplementa).
  - acceptance: (1) `nextAction` presente → `nextStep.command === nextAction` verbatim e `commandSource: "persisted"`; (2) drift simulado (JSON válido **+ exit 1**) → `spineStage` reconcile e o fallback é `reconcile`; (3) erro de I/O / exit 2 / stdout não-parseável → saída parcial, exit 0 (fail-open); (4) zero mutação (nenhum write no state tree).
  - verifier: `kind test` — `node --test tests/guide/compute-guide.test.js`

- **T-005 — Fixtures dos estados.** Um fixture por item da lista de precedência + **fixtures sobrepostos que provam a ordem** (F-002): `blocked+pending` → `switch` (não `implement`); `drift+pending` → `reconcile` (não `implement`); `active>24h + descriptor-only` → `reconcile` (não `materialize`). Mais um par de fonte-do-comando: um com `nextAction` presente (prova `command === nextAction`) e um sem (prova o fallback pela precedência).
  - Files: `tests/guide/fixtures/*`, `tests/guide/compute-guide.test.js`
  - acceptance: cada item da precedência coberto; os 3 fixtures sobrepostos asseguram o comando de MAIOR prioridade; o par presente/ausente cobre as duas `commandSource`.
  - verifier: `kind test` — `node --test tests/guide/compute-guide.test.js`

- **Gate F1:** `node --test tests/guide/compute-guide.test.js` exit 0 (mapa de decisão coberto + fail-open provado).

### F2 — Rendering do bloco de ensino

- **T-006 — Render em `project-guide.md`.** O asset chama `compute-guide.js`, formata o bloco de 5 linhas + o mini-mapa ASCII com "você está aqui" na `spineStage`. Fail-open: se o helper falhar, cai para o resumo no-args e diz onde travou. Documenta a relação com o no-args (no-args = resumo barato; `guide` = view de ensino) e os aliases decididos.
  - Files: `skills/shared/project-assets/project-guide.md`
  - acceptance: (1) rodar `guide` num projeto real (ex.: `phase-materialization`) imprime o bloco com PRÓXIMO PASSO batendo com o `nextAction` persistido; (2) mini-mapa marca a fase certa; (3) SE TRAVAR lista `why`/`status --browser`/`guide`.
  - verifier: `kind shell` — smoke que roda o fluxo do asset contra um fixture e diffa o bloco renderizado (`manual` NÃO satisfaz o gate; usar um render-harness determinístico).

- **T-006b — Flag `guide --html` (abrir o guia visual).** Implementar a checagem de existência do **caminho de contrato fixo** (`docs/design/project-onboarding/index.html`) + abertura via `open`/`xdg-open`; fail-open quando ausente (mensagem + exit 0). Imprime a linha GUIA VISUAL no `guide` normal só quando o HTML existe. Reusa o mecanismo de abertura de `status --browser` onde aplicável.
  - Files: `skills/shared/project-assets/project-guide.md`, `scripts/compute-guide.js` (só a checagem de existência do caminho fixo — a abertura fica no asset via `{{BASH_TOOL}}`)
  - scopeBoundary: só a checagem do caminho fixo + abertura; NÃO gera nem valida o HTML (isso é do outro agente); nenhuma dependência de rede; sem fallback configurável (F-005).
  - acceptance: (1) HTML presente no caminho de contrato → `guide --html` abre no navegador; (2) HTML ausente → mensagem clara apontando o caminho esperado + exit 0 (fail-open); (3) linha GUIA VISUAL aparece no `guide` sem-flag apenas quando o arquivo existe.
  - verifier: `kind test` — `node --test tests/guide/html-resolve.test.js` (presente→resolve o caminho; ausente→sinaliza sem erro; a abertura em si é mockada).

- **Gate F2:** smoke de render verde contra fixture · `html-resolve.test.js` verde · eyeball num projeto real registrado como evidência.

### F3 — Guarda de fidelidade (guide nunca cita um verbo que não existe)

- **T-007 — Teste guide-command ⊆ catalog + forma válida (F-003).** Todo `nextStep.command` do domínio de saída (persistido OU fallback) tem que: (a) ter como verbo um subcomando real em `meta/catalog.yaml`, **E** (b) casar a **signature** declarada daquele subcomando — não basta o primeiro token existir. Ex.: `finalize` sem-arg é válido; `materialize` exige `<phase>` **resolvido**; um comando com placeholder `<…>` não-resolvido **falha**. Impede o mapa de driftar dos verbos reais (que mudam — `materialize`/`unblock`/`review`/`depend` entraram recentemente) e de emitir instruções não-invocáveis.
  - Files: `tests/guide/guide-vocab.test.js`
  - acceptance: cada comando do domínio de saída existe no catálogo E respeita a signature; um placeholder não-resolvido ou um verbo removido do catálogo quebra o teste.
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
