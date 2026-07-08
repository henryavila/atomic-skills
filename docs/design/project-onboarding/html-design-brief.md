# Brief — Página de documentação visual da skill `project` (atomic-skills)

> **Para o agente de design (claude.ai/design):** este documento contém o **OBJETIVO** e os **DADOS REAIS**. Ele NÃO contém nenhuma decisão visual — cor, tipografia, grid, ilustração, hierarquia visual, motion e layout são inteiramente suas. Duas regras invioláveis sobre o conteúdo: **(1) fidelidade** — não invente, não renomeie e não omita nenhum comando, estado, regra ou etapa abaixo; identificadores técnicos aparecem verbatim. **(2) o "não pode" é tão importante quanto o "pode"** — dê à seção de proibições o mesmo peso que ao fluxo feliz.

---

## 1. Objetivo da página

Uma **página web única, auto-contida**, que ensina o **modelo mental** da skill `project` a quem **nunca a usou**. O processo é grande e multi-etapa; o público é visual; fluxos escritos em Markdown ficam ilegíveis. A página existe para que a pessoa entenda, **antes de tocar em qualquer comando**:

1. **O que o sistema é** (as entidades e como se aninham).
2. **O fluxo de vida do trabalho** (da ideia ao arquivamento).
3. **O que pode e o que NÃO pode** ser feito pela skill.
4. **Qual comando usar em cada momento**.

O que a página **NÃO é** (para não competir com o que já existe):
- **Não é um dashboard.** O estado vivo de um projeto é mostrado pelo aiDeck (`status --browser`). Esta página é conhecimento **estável**, não dados.
- **Não é um GPS contextual.** "Onde estou / próximo passo" é o comando `project help` no terminal; `project help --html` abre o guia visual. Esta página é a **"constituição"** — vale para qualquer projeto, em qualquer momento.

## 2. Público e idioma

- **Público:** desenvolvedor(a) que vai adotar atomic-skills e nunca viu a skill `project`. Assume familiaridade com git e terminal, mas **zero** conhecimento do vocabulário da skill (Plano / Fase / Task / gate / materialização / initiative ancorada).
- **Idioma da página:** **Português (BR)** na prosa. **Tokens técnicos permanecem verbatim na forma real** — nunca traduza um identificador: `phase-done`, `descriptor-only`, `businessIntent`, `blocked`, `dependsOnPlans[]`, `.atomic-skills/` etc. permanecem como estão.

## 3. Tom

Direto, de engenharia, sem marketing. A pessoa quer entender uma máquina de estados e um contrato de gates, não ser convencida. Uma frase-âncora do próprio sistema pode abrir a página: **"NENHUMA IMPLEMENTAÇÃO SEM INITIATIVE ANCORADA."**

---

# DADOS REAIS (conteúdo obrigatório da página)

## Seção A — O modelo mental (as entidades)

A skill rastreia trabalho numa hierarquia de 3 níveis, mais um inbox e frames laterais. Estado canônico vive em `.atomic-skills/` (versionado em git; **nunca editado à mão**).

| Entidade | O que é | Aninhamento |
|---|---|---|
| **Plano** (Plan) | Uma entrega multi-fase com um objetivo. Tem um branch próprio (`plan/<slug>`). | Contém Fases. |
| **Fase** (Phase / Initiative) | Um estágio do plano (F0, F1, …). Cada fase é uma *initiative* com um **exit-gate**. | Contém Tasks. Uma initiative *standalone* é um plano degenerado de 1 fase. |
| **Task** | Uma unidade de trabalho implementável (T-001, …), com critérios de aceite e um verificador. | Folha da árvore. |
| **Ideas** (`ideas.md`) | Inbox de ideias cruas, antes de virarem trabalho. | Fora da árvore; entra via `idea promote`. |
| **Stack frames** | Investigações laterais empilhadas sobre o trabalho atual (`push`/`pop`). | Pilha temporária. |
| **Backlog** (`parked[]` / `emerged[]`) | Trabalho futuro classificado pela *emergence ladder* antes de aterrissar. | Vira Task via `promote`. |

**Conceito-chave nº1 — Materialização lazy.** Um plano novo NÃO materializa todas as fases de uma vez. `new plan` cria o `plan.md`, materializa **só a F0**, e mantém F1..N como **descritores** (`descriptor-only`) até você rodar `materialize <phase>`. Isso evita comprometer detalhe em fases distantes que ainda vão mudar.
- `descriptor-only` = a fase existe no plano como uma linha, mas ainda não tem arquivo de initiative com tasks.
- `materializada` = virou um arquivo de initiative completo, com tasks, pronta para `implement`.

**Conceito-chave nº2 — businessIntent.** No momento de `materialize`, um **gate HARD** captura a "espinha de intenção de negócio" da fase, com 5 campos: **value / workflow / rules / outOfScope / doneWhen**. Uma fase não materializa sem isso. É a ponte de um plano decomposto para a implementação.

**Conceito-chave nº3 — Exit-gate.** Cada fase tem critérios de saída verificáveis. Você não avança de fase enquanto um critério estiver `pending`. Cada critério é fechado por um **verificador** (shell / test / query), não por "achismo".

---

## Seção B — O FLUXO DE VIDA (a espinha — provavelmente o herói visual da página)

O trabalho percorre uma espinha única, da ideia ao arquivamento. Cada seta é gateada: **não se avança de um estágio com uma pergunta em aberto.** Este é o fluxo que fica horrível em Markdown e que a página precisa tornar óbvio visualmente.

```
IDEIA ──▶ DESIGN ──▶ PLANO ──▶ DECOMPOSE ──▶ MATERIALIZE ──▶ IMPLEMENT ──▶ VERIFY ──▶ REVIEW ──▶ DONE ──▶ ARCHIVE
         (brainstorm)        (SPEC gate)   (businessIntent)  (por task)  (verificador) (phase-done)         (finalize→PR)
```

### O fluxo de criação de um Plano (`new plan`) — 9 estágios reais, em ordem, cada um gateia o próximo:

1. **Validar slug.** Nome do plano.
2. **DESIGN (brainstorm).** Antes de decompor qualquer plano, o WHAT/WHY + a abordagem escolhida têm que existir como um `design.md` aprovado por um crítico. Delega para a skill **`atomic-skills:brainstorm`** (frame → diverge → usuário ratifica → escreve → gate do crítico). Produz `design.md`.
3. **Fonte do plano.** Com o `design.md` aprovado, produz o markdown "source plan" que o Estágio 5 consome (semeado das Decisões do design, ou apontado para um markdown existente, ou preenchido de template).
4. **Receber o markdown + lint No-Placeholders.** Um lint determinístico (scan de string, zero-token, roda igual em qualquer host) **BLOQUEIA (HARD)** se houver marcador de template deixado para trás: `REPLACE_*`, `TODO`/`TBD`/`FIXME`, placeholders fuzzy (`<path>`, `<file>`, `<dir>`, `<…>`) ou hand-waving "similar to Task N". Nenhum arquivo é escrito até limpar. **Nenhuma raia é isenta deste gate.**
5. **Decompose + SPEC per-task admission gate.** Quebra o plano em fases e tasks. Depois, o **gate SPEC** exige que cada task carregue seus **4 campos HOW**: `Files:` (caminhos exatos), `scopeBoundary:`, `acceptance:` (critérios), e um `verifier:` **determinístico** (`kind shell`/`test`/`query` — `manual` NÃO satisfaz). **Nenhuma task é admitida ao `implement` sem os 4.** Tasks destrutivas (deletam classe/tabela/coluna, mass-delete) exigem ainda **≥1 critério de aceite de impacto-de-DADOS**, não só de código (grep-zero de referências de código é necessário mas não suficiente).
6. **Criar Plano + Initiatives.** Materializa a estrutura (lazy: só F0). Aqui se decide o isolamento: **worktree própria** (paralelo), **pausar as outras** (sequencial), ou **prosseguir** (aceitar drift). Escreve um *creation-gate run record* como autoridade de resume/cancel.
7–9. **Resumos + peso + sinal de conclusão + validação com o usuário.** Cada fase e cada task recebem um `summary` de uma linha (no idioma configurado), um `weight` (proxy de complexidade) e um sinal de conclusão (`verifier` OU `outputs[].path`). Tudo é **validado com o usuário** antes de finalizar — uma correção de resumo é tratada como sinal de que a fase pode estar mal-escopada, não só mal-escrita.

### O loop de execução (por fase, depois que o plano existe):

```
materialize <phase>  →  implement (task a task)  →  cada task fecha só via done + verificador  →  phase-done
       │                                                                                             │
   businessIntent gate                                                              exit-gates verificados + code review obrigatório
                                                                                                     ↓
                                                                                            avança currentPhase
```

- **`implement`** (skill `atomic-skills:implement`) é o driver single-threaded que leva as tasks admitidas ao DONE, fechando cada uma só via *verify-on-done*.
- **`done <task-id>`** é a autoridade de fechamento: roda o verificador, só então marca `done`, e reescreve o `nextAction` (o ponteiro que uma sessão fria lê primeiro).
- **`phase-done`** verifica cada critério do exit-gate pelo seu verificador, roda um **code review obrigatório**, e só então avança `currentPhase`.

### O fim:

- **`finalize`** publica o branch do plano como PR (`push plan/<slug>` + `gh pr create`).
- **`consolidate`** é o contraparte 1:N: integra ≥2 worktrees prontas numa branch de integração + PR.
- **`archive`** move o plano/initiative terminado para `archive/` (arquivar um plano cascateia para suas fases).

---

## Seção C — Máquinas de estado (transições reais)

A página deve mostrar estas como diagramas de estado, não como listas.

### Estado de uma **Task**
```
pending ──▶ active ──▶ done
   │          │
   │          ▼
   └──────▶ blocked ──(unblock)──▶ active/pending
```
- `pending` → ainda não começou.
- `active` → em andamento. Uma task `active` há >24h dispara o **gate de reconciliação** na próxima mutação (o usuário precisa dizer: ainda ativa? done? blocked?).
- `blocked` → status de primeira classe. **A única saída para frente documentada é `unblock`** (que NÃO fecha a task — devolve ao estado trabalhável). Antes existia o beco: uma task `blocked` só podia ir a `done` ou ser editada à mão (proibido pela Iron Law). `unblock` é a saída.
- `done` → fechada, com `closedAt` e evidência do verificador.

### Estado de uma **Fase**
```
descriptor-only ──(materialize)──▶ active ──(phase-done)──▶ done ──▶ archive
                                      │
                              (phase-reopen reverte)
```
- `phase-reopen` reverte um `phase-done`: restaura a initiative para `active`, limpa `metAt` dos critérios, reseta tasks para `pending`.
- `split-phase` divide uma fase grande demais em sub-fases (preserva proveniência; arquiva a original como `archived`, não `done`).

### Estado de um **Plano**
```
active ⇄ paused   (switch pausa um, ativa outro)
  │
  ▼
archived
```
- **Dependências entre planos** (`dependsOnPlans[]`): um plano pode estar **bloqueado** por um pré-requisito. Uma transição que detecta o bloqueio **para antes** de mudar status — o operador nunca avança um plano bloqueado seguindo um next-action obsoleto. As raias do dashboard: `Liberado agora` / `Em andamento` / `Bloqueado` / `Concluido`.

---

## Seção D — O QUE PODE / O QUE NÃO PODE (o ouro da página; duas colunas)

Esta seção é o que nenhuma outra superfície ensina. Dê a ela peso visual máximo.

### ✅ O que a skill FAZ por você
- Recarrega o **frame exato** de um projeto multi-dia a cada sessão (qual fase, o que está parkado, por que uma task existe).
- Ancora toda sessão que modifica código a uma initiative ativa.
- Classifica trabalho novo pela **emergence ladder** antes dele aterrissar (`park`/`emerge`/`promote`).
- **Stack frames** para investigações laterais sem perder o trabalho principal (`push`/`pop`).
- **Exit-gates** que bloqueiam avanço até os critérios serem cumpridos.
- Detecção de **scope-creep** e drift estado-vs-código.
- Um comando git-style para todo o ciclo: view, create, mutate, discover, migrate, verify.

### ⛔ O que a skill NÃO permite (invariantes — regras duras)
- **Iron Law: NENHUMA IMPLEMENTAÇÃO SEM INITIATIVE ANCORADA.** Toda sessão que modifica código tem que estar ancorada numa initiative ativa — ou você declara explicitamente "ad-hoc".
- **Nunca editar `.atomic-skills/` à mão.** Use os subcomandos: eles setam proveniência e validam. Edição manual é o antipadrão que a Iron Law proíbe.
- **Não decompor um plano cujo `design.md` não passa no lint.** PLAN nunca começa num design que não linta limpo.
- **Nenhuma task admitida ao `implement` sem os 4 campos HOW** (`Files`, `scopeBoundary`, `acceptance`, `verifier` determinístico).
- **Nenhum placeholder** (`REPLACE_*`/`TODO`/`TBD`/`FIXME`/`<path>`) sobrevive ao gate — HARD-BLOCK, nenhum arquivo escrito.
- **`reconcile` é o ÚNICO caminho de mutação de conclusão.** Fechar tasks/gates que "parecem prontos" só acontece por ali.
- **`review` NUNCA fecha task nem avança fase.** Ele só reporta achados (audita, delega para `review-plan`/`review-code`).
- **Não avança fase com um critério de gate `pending`.** Um critério só passa por verificador (ou é `deferred` com razão explícita).
- **Não avança um plano bloqueado** por um pré-requisito (`dependsOnPlans[]`).
- **Arquivo legacy tem que migrar antes de qualquer mutação.** Sem `schemaVersion` → STOP → `migrate <slug>` primeiro.
- **Não usar para:** perguntas one-shot ou trabalho que cabe na sessão atual.

---

## Seção E — Referência de comandos (agrupados por função)

Prefixo de todos: `/atomic-skills:project`. Bare (`/atomic-skills:project`) imprime um resumo compacto de 5 linhas e para (não abre o browser). Agrupe visualmente por estes grupos.

### View
- **`status`** `[--browser|--terminal|--list|--plan|--phase|--stack|--archived|--report]` — ver estado: resumo compacto, dashboard no browser (aiDeck), view completa no terminal, ou tabelas filtradas. Ex.: `status --browser`.
- **`verify`** `[--fix] [--slug <slug>]` — reconcilia `.atomic-skills/` vs. o repo: schema, layout legacy, match de branch, cobertura de escopo, órfãos, coerência com o aiDeck (read-only, exceto `--fix`).

### Create
- **`new`** `[plan|initiative] <slug>` — cria um Plano (bootstrap multi-fase de 9 estágios) ou uma Initiative (standalone ou ancorada a uma fase); `new` sozinho imprime o menu.
- **`discover`** `[--dry-run|--commit] [--scope=<list>] [--scan=<path>]` — varre o repo (git, PRs, docs, roadmaps, memória), agrupa sinais, e propõe Planos + Initiatives para aprovar/rejeitar.
- **`adopt`** `<file.md>` — captura um plano markdown livre em Plano + Initiatives + Tasks estruturados; mostra preview antes de materializar.

### Stack frames (investigações laterais)
- **`push`** `<description>` — abre um frame lateral sobre o trabalho atual; o tipo é inferido do verbo.
- **`pop`** `[--resolve|--park|--emerge]` — fecha o frame do topo com destino: `--resolve` (descarta), `--park` (nota), `--emerge` (follow-up).

### Backlog (emergence ladder)
- **`park`** `<description>` — arquiva uma nota de baixo compromisso em `parked[]`; um gate de ratificação força um `solves`/`trigger` legível.
- **`emerge`** `<description>` — arquiva um follow-up real em `emerged[]` (mesmo gate); `--target <phaseId>` aterrissa noutra fase.
- **`promote`** `<title-or-idx>` — transforma um item parkado numa task real (atribui o próximo T-NNN, carrega o contexto).
- **`idea`** `[list | promote <n>]` — captura uma ideia crua no inbox `ideas.md`; `idea list` é view zero-token; `idea promote <n>` roteia a ideia #n pela emergence ladder.

### Tasks & fases
- **`done`** `<task-id>` — marca uma task como done e carimba `closedAt`; se era a última aberta, oferece `phase-done` ou `archive`.
- **`reconcile`** — fecha tasks/gates que parecem prontos no repo — **o único caminho de mutação de conclusão**; verifier-aware.
- **`materialize`** `<phase-id>` — transforma uma fase `descriptor-only` num arquivo de initiative completo, capturando a espinha `businessIntent` (value/workflow/rules/outOfScope/doneWhen) num gate HARD — a ponte do plano decomposto para o `implement`.
- **`unblock`** `<task-id>` — devolve uma task `blocked` ao estado trabalhável (NÃO a fecha); mostra os `blockedBy[]` e o status deles antes.
- **`phase-done`** — verifica cada critério do exit-gate pelo seu verificador, roda um code review obrigatório, e avança `currentPhase`.
- **`phase-reopen`** `[<phase-id>]` — reverte um `phase-done`: initiative volta a `active`, limpa `metAt`, reseta tasks para `pending`.
- **`split-phase`** `<id>` — divide uma fase grande demais em sub-fases (preserva proveniência; arquiva a original como `archived`).

### Lifecycle
- **`finalize`** — publica o branch do plano como PR (`push plan/<slug>` + `gh pr create --base <integrationRef>`); operator-prompted, pré-merge, pré-archive.
- **`consolidate`** — merge-train de ≥2 worktrees prontas numa branch de integração + PR (contraparte 1:N do finalize).
- **`archive`** `[<slug>]` — move um plano/initiative terminado para `archive/` (arquivar plano cascateia para as fases).
- **`switch`** `<slug>` — pausa o plano/initiative atual e ativa o alvo.
- **`migrate`** `[<slug>]` — dois modos: `migrate <slug>` converte uma initiative legacy para `schemaVersion 0.1`; `migrate` sozinho roda o cut-over de layout flat→`projects/<id>/<slug>/`.
- **`re-bootstrap`** `<slug>` — depois de migrar: re-articula em lote todo item parkado/emerged que ainda segura um placeholder.

### Context & drift
- **`why`** `<id>` — view read-only profunda de um item: status, `solves`/`trigger`/`assumptions` ratificados, proveniência, staleness.
- **`re-ratify`** `<id>` — refresca um item stale: re-confirma as premissas (bump da data) ou reescreve solves/trigger/assumptions.
- **`scope-creep`** — relatório read-only de drift: % de crescimento da fase, % de expansão de escopo, zumbis parkados, itens de contexto stale.
- **`detect-scope`** — sugere um `scope.paths` a partir da atividade git recente, como checklist que você aceita.

### Review
- **`review`** `[<slug>] [--with-code] [--mode=local|both]` — auditoria adversarial mutation-gated de um plano/initiative — delega para `review-plan` (e `review-code` com `--with-code`); **só reporta achados, NUNCA fecha task nem avança fase**.
- **`review-due`** — roda um review cross-model (codex) no diff desde o último review e registra o resultado.

### Dependencies
- **`depend`** `list [<plan>] | add <dependent> <prerequisite> | remove … | resolve … --archived` — gerencia dependências de execução entre planos (`dependsOnPlans[]`); alimenta as raias `Liberado`/`Em andamento`/`Bloqueado`/`Concluido` do dashboard.

---

## Seção F — Como conecta com as outras skills do atomic-skills

A `project` é um orquestrador fino: ela **delega** partes do ciclo para skills irmãs. A página deve mostrar essas conexões (quem chama quem, em que momento).

| Momento no ciclo | Skill irmã | Papel |
|---|---|---|
| DESIGN (Estágio 2 de `new plan`) | **`atomic-skills:brainstorm`** | Produz o `design.md` aprovado por crítico antes de decompor. |
| Divergência / painel adversarial | **`atomic-skills:debate`** | Vozes independentes num debate de design. |
| Decompose (Estágio 5) | *(interno, `src/decompose.js`)* | Quebra o plano em fases + tasks com o gate SPEC. |
| Execução (pós-`materialize`) | **`atomic-skills:implement`** | Driver single-threaded que leva as tasks admitidas ao DONE. |
| Fechamento de task / gate | **`atomic-skills:verify-claim`** | Transforma um "done/passa/fixed" num fato verificado de uma execução fresca. |
| `review` / `phase-done` | **`atomic-skills:review-plan`** + **`atomic-skills:review-code`** | Auditoria adversarial do plano e do código (self-loop local ou cross-model codex). |
| Bug encontrado no meio | **`atomic-skills:fix`** | Diagnóstico de causa-raiz + fix por TDD. |
| Estado vivo do projeto | **aiDeck** (`status --browser`) | Dashboard: grafos Mermaid, status dos exit-gates, SSE em tempo real. |

---

## 4. Estrutura sugerida da página (ordem em que um novato precisa; a forma é sua)

1. **Herói** — a frase-âncora ("nenhuma implementação sem initiative ancorada") + o modelo mental em 30s (Plano ⊃ Fases ⊃ Tasks).
2. **O fluxo de vida** (Seção B) — o herói visual: a espinha ideia→archive com os gates. Setas clicáveis/expansíveis para cada estágio.
3. **Máquinas de estado** (Seção C) — Task / Fase / Plano como diagramas de estado.
4. **Pode / Não pode** (Seção D) — duas colunas; dê peso máximo à coluna "não pode".
5. **Referência de comandos** (Seção E) — agrupada por função; navegável.
6. **Skills conectadas** (Seção F) — o mapa de delegação.
7. **"Estou perdido"** — rodapé que aponta: **`project help`** (terminal, "onde estou / próximo passo") e `status --browser` (aiDeck, estado vivo). Fecha o loop entre as 3 camadas (aprender aqui → orientar no terminal → agir no dashboard). Cite `project help` textualmente: a invocação completa é `/atomic-skills:project help`, e o comando de terminal abre **esta mesma página** via `project help --html`, então os dois são o mesmo guia em superfícies diferentes.

---

## 5. Notas de fidelidade para o agente de design

- **Não invente comandos, estados ou flags.** Tudo que existe está acima. Se precisar de um exemplo, use um dos `example:` reais.
- **Não traduza identificadores.** `descriptor-only` continua `descriptor-only`; `businessIntent` continua `businessIntent`.
- **Slugs de exemplo reais:** `v3-redesign`, `p1-schema`/`p2-api` (dependência), `T-005` (task), `F1`/`F2` (fase).
- **Prosa em Português; código/tokens em inglês.**
- **A forma é 100% sua** — cor, tipografia, layout, ilustração, motion, densidade. Este brief é deliberadamente silencioso sobre visual.

## 6. Onde salvar (contrato com o comando de terminal)

O comando `project help --html` abre esta página, então o arquivo final tem um **caminho canônico** que o comando procura:

- **Salve a página em:** `docs/design/project-onboarding/index.html` — arquivo único, auto-contido (todo CSS/JS/assets inline; sem dependência de rede, igual à regra de Artifacts).
- Se por algum motivo for para outro lugar, o caminho tem que ser registrável em `manifest.json` como `guideHtmlPath`; senão o comando não o encontra e cai no fallback ("guia visual ainda não gerado").
- **Página estável, um arquivo.** O comando faz `open`/`xdg-open` nesse caminho — não há servidor.
