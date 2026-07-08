# Materialização lazy de fases + gate de validação de negócio

## Context

A skill `atomic-skills:project` tem um gap confirmado em três pontos encadeados
(análise aterrissada em 2026-06-28, citações verificadas abaixo):

1. **Fases podem ser materializadas vazias.** `materializeDecomposition`
   materializa TODAS as fases num loop (`src/decompose.js:866`, `for (let idx =
   0; idx < initiatives.length; idx++)` escreve um arquivo por fase). O schema
   exige o campo `tasks` (`meta/schemas/initiative.schema.json:20`, `required`
   contém `"tasks"`) mas NÃO impõe `minItems` (`:116`, definição do array sem
   `minItems`). Resultado: uma fase cujo markdown-fonte só detalhou a F0
   materializa com `tasks: []` e valida limpo — vira um esqueleto "goal-only".

2. **Não existe verbo de materialização e há uma instrução quebrada.** Na
   fronteira de fase, `phase-done` manda *"propose `atomic-skills:project new
   initiative` to materialize the next initiative"*
   (`skills/shared/project-assets/project-transitions.md:170`). Mas a fase já foi
   materializada no `new plan`, então `new initiative` colide e aborta na
   checagem de colisão (`skills/shared/project-assets/project-create-initiative.md:17`,
   *"if the resolved target exists … abort"*). Instrução vestigial da era
   flat-layout, contraditória com a realidade "todas as fases já existem".

3. **Todos os gates são de nível de código.** O SPEC gate admite uma task só com
   `Files` (paths) + `scopeBoundary` (paths) + `acceptance` + verifier
   determinístico (`skills/shared/project-assets/project-create-plan.md:88`;
   implementação em `scripts/lint-source.js:283-355`, `lintSpec`). O usuário
   confirma estrutura (contagem + 3 títulos + resumos), nunca semântica de
   negócio. Uma decomposição errada na camada de feature passa por todos os
   gates. Quando uma fase vazia ativa, nenhum passo a decompõe — `implement`
   degrada para "loop solto, sem inventar spec" (`skills/core/implement.md:51`
   e `:114-116`).

O objetivo: garantir que cada fase seja decomposta em tasks **no momento
certo**, após responder e validar com o usuário perguntas de **negócio**
(feature/workflow/regra), antes de qualquer implementação.

## Decisions

**D1 — Materialização lazy de fases (lazy FORTE).** `materializeDecomposition`
passa a materializar, no `new plan`, apenas a iniciativa da **F0** (com tasks) e
os **descritores** `phases[]` COMPLETOS para F1..N — **sem** arquivo de iniciativa
para fases não-ativas, e **sem extrair tasks** para F1..N. "Completo" = os campos
que `plan.schema.json:214` exige no `phaseDescriptor`
(`id`/`slug`/`title`/`goal`/`dependsOn`/`subPhaseCount`/`exitGate`/`status`).
Para F1..N, `subPhaseCount` materializa como **`0` (placeholder honesto — "número
desconhecido até materializar")** e `exitGate.criteria` é retido da fonte up-front
(`decompose.js` já percorre o documento inteiro em `decomposePlan`). As **tasks**
de F1..N **não** são extraídas no `new plan` — só quando a fase ativa (lazy forte,
não lazy-fraco de "pré-extrair e só adiar o write"). *Why duplo:* (1) elimina o
estado-morto e resolve a contradição do ponto 2 (se F1..N não têm initiative file,
a instrução "materialize the next" do `phase-done` ganha alvo real, sem colisão);
(2) só o lazy forte realiza a justificativa de **contexto fresco + lições da fase
anterior** — se as tasks fossem pré-extraídas no `new plan`, F1 herdaria decisões
tomadas ANTES das lições de F0. A sinergia com o gate de lessons
(`project-create-initiative.md:32`, *Phase-start lessons gate*) exige que a
decomposição de F1 aconteça na ativação, com F0 já concluída.

*Nota (descritor vs materializada):* `subPhaseCount:0` num descritor F1..N **não**
significa "fase materializada vazia" — é o estado "descritor-only, pendente de
materialização". O detector e os leitores distinguem os dois estados pela
ausência do arquivo de iniciativa (não pelo `subPhaseCount`).

**D2 — Novo verbo `materialize <phase>` — caminho de implementação DECIDIDO.** É o
trigger explícito (e o caminho reutilizável por `phase-done`/`switch`/
`phase-reopen`) que leva uma fase de "descritor" a "iniciativa com tasks". Hoje
`materializeDecomposition` (`src/decompose.js:771`) constrói o array `phases[]`
inteiro de uma vez (`initiatives.map` em `:797`, F1 referencia F0 via
`dependsOn`) e depois escreve um arquivo por fase num loop (`:866`); **não há
iteração isolável nem função `decomposeOnePhase`**. O verbo é implementado por um
**refactor mecânico** (R-ORCH-10 respeitado: formato-fonte e heurísticas de
extração congelados — só a ESTRUTURA da função muda):

1. Extrair `decomposeOnePhase(phaseSource, ctx)` de `decomposePlan` — encapsula a
   extração de tasks (`extractTasks`) + montagem da iniciativa para UMA fase. A
   heurística é a mesma, agora invocável por-fase.
2. Extrair `writeInitiativeFile(initiative, planSlug, ctx)` do corpo do loop
   (`src/decompose.js:866+`) — o bloco que escreve `phases/f<N>-*.md`.
3. `materializeDecomposition` passa a chamar `writeInitiativeFile` **só para
   F0** (D1); `materialize <phase>` chama `decomposeOnePhase` (sobre a fonte
   retida da fase-alvo, com as lições da fase anterior em contexto) + aplica o
   gate `businessIntent` (D3) + chama `writeInitiativeFile`.

**Retenção do decompose-result (resolve a antiga open-question):** o `materialize`
precisa da **fonte** da fase-alvo (não das tasks pré-extraídas — D1 é lazy forte).
A fonte parseada por-fase é **persistida em estado** sob o diretório do plano
(candidato: `phases/<slug>.source.json` ou campo no descriptor) entre o `new plan`
e o `materialize`. *Why:* sem reter a fonte, `materialize` teria que
re-`decomposePlan` o plano inteiro (caro, descarta o "retenha"), o que
contradiz o lazy. Reter a fonte por-fase é o caminho mínimo.

*Mecanismo reutilizável:* `phase-done`/`switch`/`phase-reopen` chamam o mesmo
`materialize` internamente (D7), não duplicam lógica.

**D3 — Gate de validação de negócio (`businessIntent`).** Novo campo aditivo
`businessIntent` na fase, morando no descriptor `plan.phases[]` **e** na
initiative (mesmo padrão do `summary`, ver `find-missing-summaries.js`). Espinha
canônica FIXA: `value` (valor de negócio entregue), `workflow` (fluxo que
habilita), `rules` (regras/decisões de negócio), `outOfScope` (o que
explicitamente não faz), `doneWhen` ("pronto" no nível de feature). Cauda
derivada opcional `derived[]` (perguntas extras autoradas pela IA a partir do
goal, **não** gateadas). *Why:* a espinha fixa é deterministicamente checável e
reprodutível (zerando o risco "a IA escolhe as perguntas erradas"); a cauda
derivada enriquece sem virar ponto de falha.

**D3.1 — A IA marca `[NEEDS CLARIFICATION]`, não preenche plausível (refino R1,
re-grounded fora do SDD).** Em vez de a IA *inventar* uma resposta plausível para
um campo que não sabe (o que reintroduz "a IA escolhe errado"), ela deixa o campo
aberto com o marcador `[NEEDS CLARIFICATION]` e o detector (D4) bloqueia até o
usuário preencher. *Why:* mata o preenchimento-plausível na origem; o marcador é
deterministicamente detectável (mesmo molde do `find-missing-*`). *Nota:* o
paralelo com SDD foi **retirado** — SDD usa marcadores num fluxo de geração de
código; aqui é elicitação de requisitos. O mecanismo é válido sem a citação.

**D3.2 — `outOfScope` é non-goal de primeira classe (refino R2).** `outOfScope`
carrega a distinção *non-goal vs negated-goal* (Google): não é "o sistema não deve
travar" (negated-goal); é algo que poderia ser goal mas foi **deliberadamente
excluído** (ex.: "ACID compliance nesta fase"). *Mandatory onde?* **No detector
(D4), quando `businessIntent` está presente — NÃO no schema.** `businessIntent`
inteiro é **opcional no schema** (espelha `summary`, que é `properties`-only em
`plan.schema.json`, fora do `required` em `:214` — o hard-block do `summary` é só
no fluxo, via `find-missing-summaries.js`). Logo um plano legado sem
`businessIntent` **continua validando** no schema; o "obrigatório" de `outOfScope`
aplica-se apenas quando uma fase passa pelo gate (ativação pós-mudança, D5). Isto
é **coerente com D5** (nenhum plano congela no dia 1) e com o Non-goal "planos
antigos não são migrados". *Why:* non-goals é o campo mais universal da prática
madura (Google/Rust/HashiCorp) e fronteira nº 1 contra scope-creep; o gate de
fluxo é o lugar certo do mandatory, não o schema versionado.

**D3.3 — `value` distingue business vs customer value; SEM cota "≥2 use-cases"
(refino R4).** `value` deve declarar **ambos** os eixos — valor para o *negócio*
(econômico/operacional) e para o *cliente/usuário* (produto amado desligado por
não gerar valor de negócio é falha real, Torres/OST). O `audience` já no schema é
usado. A cota "≥2 casos de uso concretos" do R4 original é **descartada**: o nº
"2" veio importado do Rust sem justificativa para o domínio de fase. *Why:*
business-vs-customer é a distinção que previne "feature amada que não paga";
exigir contagem arbitrária adicionaria fricção sem benefício.

**D3.4 — Blank-field-prompting: o usuário ESCREVE, não aprova (novo, da revisão
adversarial).** O gate NÃO apresenta um `businessIntent` pré-preenchido para o
usuário assinar. O `materialize` apresenta os campos da espinha **em branco ou
marcados `[NEEDS CLARIFICATION]`** (D3.1); o usuário os preenche (pode editar uma
sugestão que a IA oferece separadamente, mas o campo não vem preenchido para
simples assinatura). *Why:* "usuário valida saída plausível de IA que não
autorou" é o caso-arquetípico de validation-theatre — humanos rubber-stampam, e a
sycophancy da IA agrava o problema (literatura documenta LLMs
desproporcionalmente servis; ver `research-plan-quality.md` Revisão adversarial).
Exigir produção do valor é o mecanismo plausível de redução do rubber-stamp.

*Honestidade sobre o que é e NÃO é garantido (achado de crítico):* o **detector
(D4) só consegue verificar "campo presente, não-vazio, não-marcado"** — é
estritural, **não consegue distinguir "usuário escreveu" de "IA preencheu e o
usuário aceitou"**. Logo o blank-field-prompting é uma **restrição de UX/fluxo do
verbo `materialize`**, não uma propriedade validável por exit-0/1. A **eficácia
anti-rubber-stamp é parte da hipótese não-provada de D9**, não um benefício
estabelecido — o design NÃO afirma "isto garante X% de redução". O que o gate
*garanta* deterministicamente é: nenhum campo da espinha fica vazio/marcado num
fase ativada (D4). O que ele *espera* (e mede, D9) é que isso reduza rework.

**D4 — Detector determinístico `find-missing-business-intent.js`.** **Mesmo molde
de SAÍDA** que `find-missing-summaries.js` (scan puro em node, exit 0/1, resolve a
língua configurada via `configuredLanguage`), mas **lógica mais próxima de
`validate-state.js`**: `businessIntent` é um OBJETO com 5 campos aninhados
obrigatórios (`value`/`workflow`/`rules`/`outOfScope`/`doneWhen`) + cauda
`derived[]` opcional, não um scalar como `summary`. O detector checa, **por fase**,
cada um dos 5 campos nas **2 superfícies** onde `businessIntent` mora (descriptor
`plan.phases[]` **e** initiative) — reporta o primeiro campo ausente/vazio/marcado
`[NEEDS CLARIFICATION]`. *Complexidade honesta:* são 5 campos × 2 superfícies por
fase (≈10 checagens), não a checagem scalar de `find-missing-summaries`. HARD-BLOCK
a ativação/implementação de uma fase enquanto a espinha não está preenchida
(preenchimento = não-vazio/não-marcado; a validação *com o usuário* é o passo de
fluxo do `materialize`, D3.4, não checável por script).

**D5 — Backfill-on-activation.** O gate enforce apenas em fases que **ativam**
depois da mudança. Um plano/fase já em execução não congela. *Why:* menor
fricção no dia 1; ainda enforce going forward; aproveita o momento natural de
"agora vamos comprometer com esta fase".

**D6 — Fire points.** O gate dispara em toda ativação de fase (`materialize`,
`switch`, `phase-reopen`) e tem o `implement` como backstop duro (recusa fase
descritor-only ou sem business-intent, em vez de degradar).

**D6.1 — Re-validação encolhida a 2 eventos concretos (refino R5, encolhido).**
Além da ativação, o `businessIntent` é re-questionado em **2 eventos explícitos e
finitos**, não num event-bus amplo de "mudança": (a) o crítico/critic aponta que a
fase driftou do `businessIntent` original; (b) o `implement` (Step 2.1,
"stop-and-report") reporta que uma task saiu do seu `scopeBoundary` em runtime.
*Why:* o R5 original pedia maquinária de detecção de eventos que o design não tem;
estes 2 gatilhos reusam fluxo existente — o crítico já é parte do ciclo de design,
e o `implement` já reporta saída de escopo. *Precisão (achado de crítico):* o
gatilho (b) **NÃO** é o `lint-source.js` (esse valida `scopeBoundary` no
*admit-time* da task, pré-implementação); é o **report de runtime** do
`implement.md` quando a execução tenta tocar fora do boundary. Não há detector
estático novo — o re-questionamento é acionado pelo report do `implement`, não por
um scan. *Non-goal:* re-questionar o businessIntent a cada scope-creep percebido —
fricção excessiva; o congelamento pós-materialização (D1) permanece dentro da fase.

**D7 — `materialize` é verbo top-level do router.** Forma canônica
`/atomic-skills:project materialize <phase>`, e NÃO um sub-passo de `phase-done`.
*Why:* `phase-done`, `switch` e `phase-reopen` chamam o mesmo caminho
internamente — a gramática do router é decisão estrutural (contrato de chamada
de três transitores já versionados), não ergonômica, então é decidida aqui e não
deixada para o dogfooding ( promovida de open-question a decisão após achado do
crítico).

**D8 — DoD técnico universal no nível do projeto (refino R7).** Um Definition of
Done **técnico** no nível do projeto — barra de qualidade que toda fase herda,
distinta do `doneWhen` (que é AC-like, por fase). Exigência: deve ser
**falsificável como checklist exit 0/1** (estilo SPEC gate / Zimmermann: critérios
concretos, não prosa aspiracional). Exemplos canônicos: "passes `npm test`",
"lint limpo", "sem `TODO`/placeholder pendurado". *Why:* separa o "pronto desta
fase" (`doneWhen`) do "pronto de toda entrega" (DoD técnico) — hoje o DoD técnico
é implícito e disperso. Falsificabilidade evita virar bullet-list vaga. *Onde
mora + optionalidade:* campo `definitionOfDone[]` no nível do `plan` (raiz do
`plan.schema.json`, que é `additionalProperties:false` `:11` — exige adição formal
ao schema), herdado (e extensível) por fase. **É `optional` (não-required)** no
schema — um plano legado sem o campo continua validando. O **fallback quando
ausente** vive explícito em `skills/core/implement.md` (o único leitor que age
sobre o DoD; fallback = o SPEC gate existente por task).

**D9 — Gate-como-hipótese (postura DECIDIDA; instrumento fica OPEN, não é
entregável deste plano) (novo, da revisão adversarial).** **Decidido (postura):**
o gate de `businessIntent` é tratado como uma **hipótese a ser medida**, não como
verdade comprovada — não há evidência empírica (a favor nem contra) de que um gate
de business-intent IA-rascunhado + humano-escrito reduza rework. Importá-lo como
"best practice provada" seria importar doutrina não-provada (a pesquisa admitiu
SDD = doutrina, não prova). O gate **ainda** hard-blocks por default (D5/D6) — não
se adia à melhoria empírica o enforcement básico; mas o design **declara**
explicitamente que aposta numa hipótese não-provada. **Aberto (NÃO conta como
entregável deste plano):** o *instrumento concreto* de medição. O sinal obvio
("contador de re-decomposição pós-materialização") mede rework que **ocorreu**,
não rework que o gate **preveniu** (o contrafactual é inobservável). Definir um
sinal operacionalizável honesto fica como Open question — o plano pode ser
executado sem ele (o gate funciona sem telemetria); a telemetria é trabalho
separado quando houver volume para medir. *Why:* separa a postura de design
(decidida) da instrumentação (não-resolvida, não-bloqueante).

**D10 — Constituição de anti-patterns é iniciativa SEPARADA; alternatives ficam
no nível do plano (refinos R6-split + R3-re-scoped).** Dois cortes de escopo:
(a) **R6 split** — consolidar os anti-patterns espalhados (CLAUDE.md,
`.claude/rules/`, `implement-antipatterns.md`) num catálogo "constituição" que o
gate de implementação consulta é **trabalho de curadoria próprio**, fora do
escopo deste design (vira iniciativa separada, dependência futura); aqui só se
decide que o SPEC gate *continua* validando a task (Files/verifier) e não assume
uma constituição inexistente. (b) **R3 re-escopo** — captura de
alternativas/trade-offs descartados pertence no **nível do plano** (o `design.md`
já tem `## Rejected alternatives`; o plano herda essa seção), **não por fase** —
`alternatives` por fase é non-goal (granularidade errada, inflação editorial para
1 usuário). *Why:* R6-como-escrito pedia maquinária (catálogo + motor de
consulta) que não existe; R3-como-escrito importava burocracia de RFC para o
nível errado. Ambos viram non-goals explícitos aqui, mantendo o design enxuto.

## Chosen approach

**Materialização + gate combinados, decisão-by-decisão (ratificada pelo usuário
em 2026-06-28):**

- *Estratégia de materialização* — **Lazy/estrutural (D1+D2)** venceu sobre
  *Incremental* (manter materialize-all + verbo fill). O caminho lazy conserta a
  contradição na origem e elimina o estado-morto; o incremental deixaria a
  "fase-vazia-no-início" como wart permanente e criaria duas fontes de tasks.
- *Conjunto de perguntas* — **Híbrido (D3)** venceu sobre *Fixo-canônico-only* e
  *Derivado-por-fase*. A espinha fixa entrega enforcement reprodutível; a cauda
  derivada entrega flexibilidade sem reintroduzir o risco de escolha errada (que
  o modelo *Derivado-por-fase* reintroduz no nível da pergunta).
- *Backward compat* — **Backfill-on-activation (D5)** venceu sobre
  *Grandfather-por-versão* e *Universal*.

**Fluxo resultante:**

```
new plan <slug>
  → plan.md {phases[F0(active,com tasks), F1(desc-only), F2(desc-only)]}
  + phases/f0-*.md   (initiative com tasks — decomposta no new plan, com businessIntent)
  (F1, F2: NÃO ganham initiative file ainda)

phase-done F0 → advance → dispara materialize F1:
  1. gate de lessons (project-create-initiative.md:32) — lições de F0 aplicadas
  2. business-validation gate — espinha canônica; a IA marca [NEEDS CLARIFICATION]
     onde não sabe e o usuário ESCREVE os valores (proof-of-work, D3.4), não aprova
  3. decompose F1 em tasks (SPEC gate: Files/escopo/acceptance/verifier — nível código)
  4. escreve phases/f1-*.md com tasks + businessIntent
  5. detector find-missing-business-intent.js → exit 0 libera
  6. status: active
```

`materialize <phase>` é o nome do verbo; `phase-done`/`switch`/`phase-reopen`
chamam o mesmo caminho internamente.

**Refinamentos da revisão adversarial (2026-06-28), foldados como D3.1–D3.4 /
D6.1 / D8–D10:** após pesquisa de landscape, uma revisão adversarial (4 críticos
independentes) re-escalonou 7 recomendações (R1–R7) e trouxe 2 achados de design
que as superam em valor. Resultado: **R2** (non-goals) e **R7** (DoD universal)
adotados como-está; **R4** adotado pela metade (business-vs-customer sim, cota
"≥2" descartada); **R1** re-grounded fora do SDD (D3.1); **R3** e **R6** viraram
non-goals (nível do plano / iniciativa separada — D10); **R5** encolhido a 2
eventos (D6.1); e **2 novos** — blank-field-prompting contra rubber-stamp (D3.4,
eficácia = hipótese de D9, não garantida) e gate-como-hipótese (D9, postura
decidida; instrumento fica Open). Detalhe e trace no `research-plan-quality.md`
(seção Revisão adversarial).

## Blast radius

- **Mudança de comportamento de `materializeDecomposition` (D1).** A partir da
  mudança, `new plan` gera F0-com-tasks + descritores F1..N sem initiative file.
  Leitores (`status`, `implement`, `verify`, dashboard) passam a distinguir dois
  estados de fase: (a) "descritor-only, pendente de materialização" (sem arquivo
  de iniciativa) e (b) "materializada" (com arquivo). *Containment:* **planos
  antigos NÃO são migrados** — continuam totalmente materializados e funcionais.
  A mudança lazy afeta apenas `new plan` daqui para frente e ativações futuras.
  Os leitores resolvem fase→initiative de forma lazy (arquivo ausente =
  pendente-de-materialização, estado válido e distinto de `tasks: []`).
- **Adição de campo `businessIntent` (D3).** Aditivo e opcional → compatível com
  estados existentes. O detector (D5) backfill-on-activation → nenhum plano
  congela no dia 1.
- **Novo verbo `materialize` (D2).** Aditivo à gramática do router; nada é
  removido, nada renomeado.
- **Leitores + `implement.md` (D6).** `status`/`verify`/dashboard passam a
  distinguir "fase descritor-only, pendente de materialização" (sem arquivo de
  iniciativa) de "materializada". O `implement.md` **Step 1 ganha uma verificação
  real** — fase-materializada + `businessIntent`-preenchido antes de carregar
  tasks, **recusando** em vez de degradar ao loop solto (`implement.md:114-116`).
  Isto altera o fluxo do degraded mode, não apenas o reusa: efeito concreto no
  blast radius, não refactor gratuito.
- **`plan.schema.json` — campo `businessIntent` (D3), OPCIONAL no schema.** O
  `phaseDescriptor` (`plan.schema.json:211`) é `additionalProperties:false`, então
  `businessIntent` deve ser **formalmente adicionado ao schema** como
  `properties`-only, **fora do `required`** (espelha `summary`, que é opcional no
  schema e hard-blocked só no fluxo). Seus sub-campos (`value`/`workflow`/`rules`/
  `outOfScope`/`doneWhen` + cauda opcional `derived[]`) são obrigatórios **apenas
  via o detector D4 quando `businessIntent` está presente** (condicional), nunca
  no `required` do schema. Assim um plano legado sem `businessIntent` **continua
  validando** — coerente com D5 e o Non-goal "planos antigos não migrados".
- **`businessIntent` refinações (D3.1–D3.4).** `value` ganha sub-distinção
  business/customer; `outOfScope` é mandatory **no detector (D4)** quando
  `businessIntent` presente, não no schema. O marcador `[NEEDS CLARIFICATION]` é
  um valor-string reservado que o detector trata como "ausente".
  **Blank-field-prompting (D3.4)** não é campo de schema nem checável por script —
  é uma **restrição de UX do verbo `materialize`** (apresenta campos em
  branco/marcados, não pré-preenchidos para assinar). Altera a UX do verbo; sua
  eficácia anti-rubber-stamp **não é garantida** (é parte da hipótese D9).
- **`definitionOfDone[]` na raiz do `plan` (D8), OPCIONAL.** Novo campo na raiz do
  `plan.schema.json` (que é `additionalProperties:false` `:11` — exige adição
  formal), **não-required** — plano legado sem o campo continua validando.
  Herdado/extensível por fase. Fallback quando ausente: **explícito em
  `skills/core/implement.md`** (único leitor que age sobre o DoD; fallback = SPEC
  gate por task). Schema-change aditivo, contrato versionado.
- **`gate-como-hipótese` (D9).** Não muda schema nem fluxo de enforcement (o gate
  continua hard-block por default, D5/D6). O **instrumento de medição é
  projetado, NÃO especificado** (o sinal óbvio mede rework ocorrido, não prevenido
  — contrafactual inobservável); fica como Open question e **não é entregável
  deste plano**. Incluído no blast radius apenas porque declara a natureza
  não-provada do gate — uma claim de postura de design, não um campo concreto.

## Non-goals

- **Não substituir o SPEC gate de código.** `Files`/`scopeBoundary`/`verifier`
  continuam obrigatórios por task. O gate de negócio (D3) é COMPLEMENTAR —
  valida semântica de feature, não substitui validação de implementação.
- **Não mover validação de negócio para o aiDeck.** aiDeck permanece agnóstico
  (`feedback-aideck-stays-agnostic`); o campo `businessIntent` vive no estado
  versionado do consumer, o dashboard apenas o lê.
- **Não re-decompor fases já implementadas.** Fases `done`/`archived` são
  intocadas.
- **Não mudar a F0.** A F0 continua decomposta no `new plan` (e também passa pelo
  gate de businessIntent D3 no momento da criação).
- **Não construir a "constituição" de anti-patterns aqui (D10).** Consolidar os
  anti-patterns num catálogo consultado pelo gate é trabalho de curadoria próprio
  — iniciativa separada, fora de escopo. O SPEC gate de código segue validando a
  task; este design não assume uma constituição inexistente.
- **Não exigir `alternatives` por fase (D10).** Trade-offs/alternativas
  descartadas vivem no nível do **plano** (já coberto por `## Rejected
  alternatives`); exigir por fase é inflação editorial — non-goal.
- **Não tratar o gate como empiricamente provado (D9).** O design declara o gate
  como hipótese instrumentável; "best practice comprovada" não é claim feita.

## Open questions

*Regra de fronteira Decisions↔Open (achado de crítico):* uma questão vira DECISÃO
quando o design tem evidência suficiente para fechá-la sem decompose especulativo;
permanece OPEN quando ainda admite >1 caminho razoável ou depende de dado externo.
Itens abaixo são OPEN genuínos — `new plan` pode decompor as DECISÕES sem esperar
por eles, mas cada um pode gerar uma task de "validar/evidenciar X".

- **Sub-schema `businessIntent` + onde mora a cauda `derived[]`.** Confirmar a
  FORMA exata do sub-schema (objeto com 5 campos obrigatórios + `derived[]`
  opcional) a ser adicionado a `plan.schema.json` como `properties`-only (fora do
  `required`, ver Blast radius). D4 já define a LÓGICA de detecção (5 campos × 2
  superfícies); falta esboçar o sub-schema. *Evidence que resolve:* esboçar no
  decompose do plano; confirmar `additionalProperties:false` do `phaseDescriptor`
  (`plan.schema.json:211`) exige a adição formal.
- **Distinguir "descritor-only sem arquivo de iniciativa" de "materializada com
  `tasks: []`"** nos leitores. (D4 já trata `subPhaseCount:0` como placeholder
  honesto, não como "vazia materializada".) *Evidence:* validar contra
  `initiative.schema.json` e os readers de `status`/`verify` — a distinção é pela
  ausência do arquivo de iniciativa, não pelo `subPhaseCount`.
- **Instrumentação do gate-como-hipótese (D9) — o que medir.** NÃO-BLOQUEANTE: o
  gate funciona sem telemetria. "Registrar se o gate preveniu rework" é
  inobservável no contrafactual; o sinal honesto mede rework **ocorrido**
  (re-decomposição pós-materialização). *Evidence:* definir o sinal quando houver
  volume para medir; decidir se é log-only ou surfacing no dashboard (agnóstico —
  só lê). Trabalho separado, não entrega deste plano.
- **Quais 2 eventos concretos para D6.1.** "(a) crítico aponta drift;
  (b) implement Step 2.1 reporta saída de scopeBoundary" — confirmar que não há um
  3º barato de alto valor. *Evidence:* o crítico é parte do fluxo; o report do
  `implement` é runtime (não `lint-source`); validar que nenhum depende de
  maquinária por criar.
- **Constituição de anti-patterns como iniciativa separada (D10).** *Evidence:*
  fora de escopo aqui — capturar como plano/iniciativa futura dependente.

## Rejected alternatives

- **A — Incremental (manter materialize-all + verbo fill).** Rejeitado: deixa a
  "fase vazia pré-materializada" como estado-morto permanente, exige modo fill
  (caso especial de "já existe") e NÃO conserta a contradição do ponto 2 na
  origem — só a maqueia. Cria duas fontes de tasks (decompose up-front + fill),
  com coerência frágil.
- **B — Perguntas derivadas por fase (sem espinha fixa).** Rejeitado: reproduz
  exatamente o problema que motivou o design ("a IA escolhe errado") no nível da
  PERGUNTA. Além disso, não é deterministicamente enforceable — um detector não
  consegue checar "a pergunta certa foi feita", só "alguma pergunta existe".
- **Universal backfill (bloqueia tudo no dia 1).** Rejeitado: fricção alta no
  deploy; todo plano existente em qualquer instalação consumidora trava até
  preenchimento manual.
- **Grandfather por versão (flag/schemaVersion).** Rejeitado: menos natural que
  backfill-on-activation. O momento de ativação já é o ponto semântico certo
  ("agora comprometemos com esta fase"); versionar o plano inteiro como legacy
  cria uma classe de planos isentos para sempre, mesmo em fases novas.
- **Painel debate (--gate) na fase B1.** Considerado (o limiar era atingido:
  ≥2 abordagens + decisão cara-de-reverter). Não executado: os forks reais foram
  surfaced e o usuário (dono do skill) ratificou a direção diretamente em B2;
  o crítico independente (B4) permanece como gate obrigatório.

## Self-review against code-quality gates

- **G1 read-before-claim:** aplicado — toda alegação sobre código existente
  carrega `verified_by` com arquivo:linha: loop de materialização
  (`src/decompose.js:866`); `tasks` required-sem-minItems
  (`meta/schemas/initiative.schema.json:20` e `:116`); instrução quebrada do
  phase-done (`skills/shared/project-assets/project-transitions.md:170`) vs
  checagem de colisão (`project-create-initiative.md:17`); SPEC gate
  (`project-create-plan.md:88`, `scripts/lint-source.js:283-355`); degradação do
  implement (`skills/core/implement.md:51`,`:114-116`); padrão do detector
  (`scripts/find-missing-summaries.js`); gate de lessons
  (`project-create-initiative.md:32`).
- **G2 soft-language:** aplicado — varrido o doc em busca da ban-list
  (deveria/provavelmente/talvez/normalmente/parece); decisões escritas no
  indicativo. 0 ocorrências da ban-list. *Achado de crítico (rodada 1) corrigido:*
  o quantificador vago "~50% mais servis" e a asserção nua "baixo custo, alto
  valor" foram removidos — o primeiro suavizado para "LLMs desproporcionalmente
  servis (literatura)", o segundo substituído por explicação concreta.
- **G6 reference-or-strike:** aplicado — toda afirmação carrega `verified_by`
  (arquivo:linha) ou é decisão nova (D1–D10, marcada como decisão, não alegação
  sobre código existente). Nenhuma alegação nua sobre código; afirmações sobre a
  prática madura (Google/Rust/HashiCorp/SDD) moram no `research-plan-quality.md`
  com fontes.
- **Revisão adversarial (2026-06-28) + crítico (rodada 1, needs_changes →
  corrigido):** 4 críticos atacaram a pesquisa de landscape e seu uso (distorções
  factuais corrigidas; veredito rebaixado de "validado" para
  "plausível/doutrina-alinhado, empiricamente não-provado"; R1–R7 re-escalonados).
  Em seguida um crítico independente sobre o design doc retornou
  `needs_changes` (1 bloqueador + 2 críticos + 4 maiores + 5 menores); TODOS
  foldados nesta revisão: bloqueador (businessIntent opcional no schema,
  mandatory só no detector), crítico #1 (blank-field-prompting é UX não
  checável — eficácia é hipótese D9), crítico #2 (caminho de implementação de
  `materialize` virou DECISÃO D2 — extrair `decomposeOnePhase` + reter fonte),
  maiores (definitionOfDone optional + fallback no implement; D6.1(b) = runtime
  report não lint-source; D9 instrumento fica Open), menores (subPhaseCount:0
  placeholder; numeração; regra Decisions↔Open). A revisão é o porquê de
  D8/D9/D10 e D3.1–D3.4/D6.1 existirem — codificadas como decisões (alinhado a
  `feedback-solutions-at-skill-level`).

