# design-brief — repensar o modelo de AUTORIDADE do briefing (anti-congelamento de legado)

Reescreve como o `design-brief` confere **autoridade** a um valor minerado, para que invariantes de
produto vinculem mas incidentais de implementação legada passem como **calibração atual que o agente de
design pode melhorar** — sem recair na sub-especificação que a skill existe para evitar. Gatilho real:
o feedback de um agente de design sobre o briefing gerado para o redesign do app **Lekto**, que congelou
detalhes legados (`SWIPE_THRESHOLD=80px`, `AXIS_LOCK_DISTANCE=10px`, a copy `"Vai!"`, 3 passos de
onboarding) como "requisitos vinculantes". Direção ratificada pelo operador após painel `brainstorm`
gate-mode (3 vozes + contrária obrigatória); a dissidência (tag explícita por valor) está preservada em
*Rejected alternatives* e re-aberta como upgrade decidido por evidência na F1 (D10).

## Context

O `design-brief` gera dois prompts (Design System + telas) entregues a um agente de design que redesenha
um app real. Seu coração é o **modelo de três camadas**: forma visual (camada 1) → silêncio; modelo de
interação (camada 2) → especificar com valores concretos; filosofia/quem-decide (camada 3) → guardrail
vinculante (`verified_by: skills/core/design-brief.md:23-27`; tabela canônica
`verified_by: skills/shared/design-brief-assets/anti-contamination.md:10-14`).

No dogfood Lekto, o agente de design **nunca viu o código do app antigo** — todo detalhe contaminante que
ele reclamou entrou pelo **prompt que a skill gerou**. A skill é, portanto, o **único vetor de
contaminação** (`verified_by: registro da sessão — PROMPT-FEEDBACK.md, download transitório agora ausente
do disco`). O prompt congelou incidentais de implementação como requisitos de produto: constantes de
física do gesto (`SWIPE_THRESHOLD=80px`, `AXIS_LOCK_DISTANCE=10px`), a copy literal `"Vai!"`, e a
contagem de 3 passos de onboarding — dizendo ao agente que não podia melhorá-los.

A raiz é estrutural, não de execução: **R2 manda "minerar os valores concretos do código" e carregá-los
"como requisito"** (`verified_by: docs/design/design-brief-three-layer-briefing.md:71`) e **R9 carimba
toda a camada-2 como "vinculante"** (`verified_by: skills/shared/design-brief-assets/screens-prompt.md:14-16`).
Não existe discriminador entre **invariante-de-produto** (ex.: "a pessoa julga a memória, nunca a agenda";
"o intervalo nunca aparece"; "~3 níveis de recordação" — `verified_by: screens-prompt.md:79-84`) e
**incidental-legado** (as constantes acima). A skill — construída contra a sub-especificação (silêncio da
camada 1 vazando para 2/3) — **sobre-corrigiu** e passou a tratar "o que o código faz hoje" como "o que o
produto exige". O redesign existe justamente para desfazer isso.

## Decisions

- **D1 — O conserto é 100% na skill, não no agente de design.** Como o agente nunca leu o código antigo,
  toda contaminação é autoria do prompt gerado. Logo a intervenção é em `skills/core/design-brief.md` +
  os assets `design-brief-assets/*` + o spec canônico `three-layer-briefing.md`. Nenhuma mudança no
  agente de design é necessária ou possível.

- **D2 — A raiz a corrigir é a fusão "código faz X" ≡ "produto exige X".** R2 promove todo valor minerado
  a requisito (`verified_by: three-layer-briefing.md:71`); R9 carimba toda a camada-2 como vinculante
  (`verified_by: screens-prompt.md:14-16`). Presença no código é uma afirmação **estritamente mais fraca**
  (o app faz X hoje) do que requisito de produto (o produto exige X). A correção ataca essa promoção
  indevida.

- **D3 — Filtro de mineração em R2 (essência ≠ mecanismo) é a correção PRIMÁRIA.** Os seis baldes de R2 —
  timings/defaults, contagens, comprimentos, modalidade, gatilhos, o-que-fica-oculto
  (`verified_by: three-layer-briefing.md:71`) — **não incluem mecânica de implementação**. Limiar em px,
  distância de axis-lock, debounce-ms-enquanto-mecanismo e strings de copy literal ficam **fora do escopo
  de R2**: minera-se a **essência comportamental** ("um gesto rápido alcançável com o polegar"), nunca a
  constante. Isto remove na origem 100% dos contaminantes documentados no Lekto, a montante de qualquer
  rótulo de autoridade.

- **D4 — Camada-é-autoridade: honrar a distinção que a tabela já faz e que o preâmbulo R9 apagou.** A
  tabela canônica usa **palavras distintas** — camada-2 = "especificar, concreto"; camada-3 = "guardrail
  vinculante" (`verified_by: three-layer-briefing.md:43-48`; `anti-contamination.md:10-14`) — mas o
  preâmbulo R9 achatou ambas em "vinculante" (`verified_by: screens-prompt.md:14-16`). Correção: o
  preâmbulo passa a declarar **duas autoridades** — camada-3 (filosofia / quem-decide / o-que-fica-oculto)
  é **VINCULANTE**; camada-2 (modelo de interação) é a **CALIBRAÇÃO ATUAL do produto**, mostrada para o
  agente dimensionar a interação com fidelidade. A própria camada confere a autoridade; **nenhuma tag nova
  por valor** é introduzida.

- **D5 — Band-pin: a BANDA comportamental vincula; o valor exato é melhorável dentro dela.** Para todo
  valor de camada-2, a banda comportamental vincula (ex.: "cadência da ordem de **segundos**") e o valor
  exato (~8s) é apresentado como o valor atual, melhorável **dentro da banda**. Sem isto, "melhore
  livremente" re-dispara a cadeia de contaminação documentada: cadência lenta → affordance explícito de
  revelar → seletor de opções → "+N dias" (`verified_by: three-layer-briefing.md:55-59`). O band-pin é a
  trava que separa "calibração" de "silêncio".

- **D6 — Code ≠ vínculo: presença no código → ATUAL/referência; invariante exige corroboração de
  intenção.** O ônus corre numa direção só: um valor de camada-2 só é elevado a invariante se for possível
  nomear a linha de filosofia / quem-decide (camada 3) que ele serve. Sem essa credencial, o valor é
  calibração atual. Isto torna a falha do Lekto **estruturalmente impossível de repetir**: uma constante
  incidental não tem intenção a apontar, logo não alcança autoridade vinculante.

- **D7 — Invariantes de camada-2 são expressos COMO guardrail de filosofia (R6), não como tag.** Quando
  uma contagem/timing É load-bearing para o modelo de produto — ex.: "~3 níveis de recordação", onde um 4º
  muda o modelo de julgamento ("fácil" é inferido, não uma 4ª opção)
  (`verified_by: screens-prompt.md:79`; `three-layer-briefing.md:110-112`) — ela vira uma afirmação de
  quem-decide-o-quê + anti-padrão proibido nomeado (R6), herdando a autoridade da camada 3. A invariância
  vem de **ser filosofia**, não de um rótulo separado. (Fecha o gap que a voz contrária concedeu.)

- **D8 — Copy literal e contagem-de-passos de fluxo são forma/conteúdo do agente.** `"Vai!"` sai do escopo
  de R2 (D3) e é substituído pelo ato-de-fala ("uma confirmação curta e afirmativa") — R7
  substituir-nunca-deletar (`verified_by: anti-contamination.md:39-43`). A contagem de passos de um fluxo
  (ex.: 3 telas de onboarding) é incidental: o que vincula é a **pré-condição** ("o que precisa ser
  verdade antes do primeiro uso"), não a cardinalidade de telas. Copy literal real, quando útil, vai para
  o canal de **textura/fixtures** (`verified_by: fixtures-recipe.md:28-32`), marcada como conteúdo real
  porém mutável, nunca como requisito de interação.

- **D9 — Gate F1 de não-reincidência = crítico adversarial alimentado com o feedback real, ancorado por
  rubrica.** Contraste manual é rejeitado como *gate* (não sobrevive ao próximo app/autor). O checklist §6
  **já é** uma rubrica e o Lekto **passou em todas as caixas** congelando 80px
  (`verified_by: anti-contamination.md:51-69`) — logo o crítico que **re-deriva** a objeção a cada rodada é
  o componente load-bearing; a rubrica derivada dos padrões transversais é a âncora reproduzível. O
  **predicado do gate = o predicado da geração** (D6): todo valor in-scope ou é calibração-com-banda, ou
  rastreia uma intenção de produto que o eleva a invariante. Um invariante sem rastro de intenção = recaída
  = FALHA.

- **D10 — Cláusula de escalonamento decidida por evidência (a decisão ratificada do fork).** Adota-se o
  **modelo leve (D3–D8) agora**. A questão "o modelo leve basta, ou é preciso a **tag explícita por valor**
  (novo R10)?" fica registrada como questão aberta com **critério de falsificação pré-registrado**: a
  regeneração do briefing Lekto na F1. Se o crítico adversarial da F1 flagrar **qualquer** valor in-scope
  sobre-vinculado que o modelo leve deixou passar, escala-se para a tag — upgrade **aditivo** (a tag = modelo
  leve + rótulo por linha), sem reescrever o spec. Razão da escolha: a F1 já é um teste de reincidência;
  usar o experimento que será rodado como juiz da dúvida é mais honesto que cravar a tag especulativamente,
  e adota a evidência (todo contaminante documentado morre no filtro D3) em vez de superfície de
  classificação nova.

## Chosen approach

**Modelos de autoridade pesados no painel (CRUX Q1):**

1. **(A) Tier binário explícito por valor** — cada valor minerado tagueado INVARIANTE/CALIBRAÇÃO, emitido
   como dois blocos rotulados. *Rejeitada agora* (vira upgrade D10).
2. **(B) Provenance-as-test** — binding derivado de proveniência (filosofia/intenção → vincula; constante
   crua → referência). *Adotada como o TESTE* (D6), sem o rótulo per-valor que B propunha emitir.
3. **(C) Filtro + camada-é-autoridade** *(núcleo da escolha)* — tighten R2 para nunca minerar mecânica
   (D3) e honrar a distinção camada-2/camada-3 que a tabela já faz (D4).

**Escolhido: síntese filtro-primeiro (C) + provenance-as-test (B/D6) + band-pin (D5), com a tag (A)
diferida para escalonamento por evidência (D10).** Adota a evidência textual mais forte do painel — os
seis baldes de R2 não cobrem `80px`/`10px` — e o fato de que as próprias vozes A e B objetaram contra o
risco de "depósito sancionado" da sua tag.

**Como aterrissa (superfície de edição da F0 — Refazer):**

- `skills/core/design-brief.md` — Iron Law e o passo R2 ganham o **filtro essência≠mecanismo** (D3) e a
  asserção code≠vínculo (D6).
- `docs/design/design-brief-three-layer-briefing.md` (spec canônico R1–R9) — R2 deixa de promover todo
  valor a "requisito"; R9 deixa de achatar camada-2 em "vinculante"; band-pin (D5) e o roteamento de
  invariantes-de-camada-2 para R6 (D7) entram no texto. **Coordenação com `skills-restructuring`** (owner
  via F5/D5 — ver *Blast radius*).
- `skills/shared/design-brief-assets/screens-prompt.md` — preâmbulo R9 reescrito para duas autoridades
  (D4); §4 do bloco "Modelo de interação" passa a expressar banda-vinculante + valor-atual-melhorável.
- `skills/shared/design-brief-assets/anti-contamination.md` — DEFINE/DECIDE e §6 alinhados ao novo modelo.
- `skills/shared/design-brief-assets/fixtures-recipe.md` — roteamento de copy literal para textura (D8).

**Forma de execução em duas fases:** **F0 Refazar** (reescrever a skill + assets + spec conforme D3–D9) e
**F1 Validar** — em **sessão nova**, regenerar o briefing Lekto e contrastá-lo com o feedback via o gate
adversarial (D9), o que também resolve empiricamente o fork D10. (Detalhe de tarefas → `project new plan`,
não aqui.)

**Critérios de aceitação (verificáveis):**

1. **Nenhum dos quatro contaminantes documentados do Lekto** (`80px`, `10px`, `"Vai!"`, 3-passos) reaparece
   no briefing regenerado como valor/requisito — todos devem ter morrido no filtro D3 ou virado essência.
2. **Todo valor de camada-2 no briefing regenerado** ou é calibração-com-banda (D5), ou rastreia uma
   intenção de produto que o eleva a invariante via R6 (D6/D7). Um invariante sem rastro = falha.
3. **Os invariantes legítimos sobrevivem** ("julga memória, não agenda"; "intervalo nunca aparece";
   "~3 níveis") — o modelo leve não pode sub-especificar de volta.
4. **O crítico adversarial da F1**, alimentado com o feedback real, não identifica recaída em nenhum dos
   padrões transversais; se identificar, dispara D10 (escalar para a tag).

## Non-goals

- **Não muda o modelo de três camadas em si** (forma = silêncio; comportamento/filosofia = especificar) —
  conserta **como a autoridade é expressa**, não as camadas.
- **Não adiciona a tag explícita por valor (R10) agora** — fica como upgrade aditivo gated pela F1 (D10).
- **Não toca a fase de reconstrução app-map / coverage ledger** — escopo do plano `app-map-conflict-arbitration`;
  este plano apenas o `references`.
- **Não reformula R8/fixtures** — só roteia copy literal para o canal de textura (D8).
- **Não regenera o briefing Lekto nesta fase** — isso é a F1, em sessão nova (o requisito explícito do
  operador: gerar de novo e contrastar para checar reincidência).

## Blast radius

- **Porta de mão única — a Iron Law (`verified_by: skills/core/design-brief.md:11`) + o spec canônico
  R1–R9 (`docs/design/design-brief-three-layer-briefing.md`).** O spec é **vendored verbatim do
  post-mortem Lekto** e está marcado como owned pelo plano **`skills-restructuring` (F5/D5)**
  (`verified_by: docs/design/design-brief-three-layer-briefing.md:1-10`). Errar o modelo de autoridade e
  publicá-lo propaga em todo briefing futuro e num artefato canônico cross-referenciado. **Contenção:**
  (i) o modelo leve é **reversível-para-frente** — a única evolução prevista (a tag) é aditiva (D10), não
  uma reescrita; (ii) **a F1 é o gate** que valida o spec editado contra reincidência **antes** de
  considerá-lo assentado; (iii) **nota de coordenação obrigatória com `skills-restructuring`**: este rework
  edita o artefato que aquele plano introduziu — confirmar com o operador se o rework assume a ownership das
  R-rules tocadas ou se reabre F5. Não é `dependsOn` (sem dependência reversa — decisão já ratificada); é
  coordenação de ownership de artefato.
- **Médio — reescrever o preâmbulo R9 e o §4 do screens-prompt** (de "tudo vinculante" para duas
  autoridades). Toca um caminho gerador existente. Contenção: o band-pin (D5) e os critérios de aceitação
  travam a regressão para silêncio.
- **Baixo — o filtro R2 (D3) e o roteamento de copy (D8)** são, em sua maior parte, regras negativas
  (o que **não** minerar) e aditivas; não alteram a estrutura das oito seções por tela.

## Open questions

- **(a) [A questão de escalonamento — D10]** O modelo leve (D3–D8) basta, ou é preciso a tag explícita por
  valor (R10)? **Evidência que resolve:** a regeneração Lekto + crítico adversarial na F1. Decisão
  pré-registrada em D10 (escalar se houver qualquer sobre-vínculo flagrado).
- **(b) Coordenação de ownership** com `skills-restructuring` (owner do spec canônico via F5/D5): este
  rework edita `three-layer-briefing.md`. Confirmar com o operador o modo de coordenação (rework vira owner
  das R-rules tocadas vs. reabrir F5). *(coordenação, não dependência)*
- **(c) [PLAN]** Redação exata da lista de mecânica fora-de-escopo de R2 (px / axis-lock / debounce-ms /
  copy literal) — é uma regra negativa; o PLAN fixa o texto + exemplos canônicos.
- **(d) [PLAN]** Forma exata da rubrica derivada dos padrões transversais do feedback que ancora o crítico
  adversarial da F1 (D9).

## Rejected alternatives

- **Opção 2 — tag explícita por valor (INVARIANTE/CALIBRAÇÃO, novo R10).** Dissidência preservada verbatim:
  > *Voz A (generator-design):* "Combine (A) and (B), with (B) as the derivation rule and (A) as the
  > emitted structural channel — two distinct labeled blocks in the generated prompt."
  > *Voz B (consumer-reception):* "every layer-2/3 line carries an inline tag the agent reads as a verb.
  > INVARIANT = 'do not change this'; CALIBRATION = 'current value, you may improve it'."

  Vantagem real reconhecida: torna o gate F1 **mecanizável** ("toda linha de camada-2 tem tag; todo
  INVARIANTE rastreia uma intenção"). Rejeitada **agora** (não no mérito do end-state) por três razões:
  (i) **A e B objetaram contra a própria proposta** — *Voz A:* "The moment the author has a blessed second
  bin labeled 'free to improve,' the path of least resistance is to shovel genuinely binding values into the
  calibration block" (depósito sancionado → falha de sub-vínculo no lugar da de sobre-vínculo); (ii) a voz
  contrária provou que os contaminantes documentados **morrem no filtro** D3, então a tag protege um modo de
  falha **não-documentado** a custo de superfície de classificação nova — *Voz C:* "R2 was applied to values
  it does not cover. Adding a tier label to those values asks the operator to correctly classify a value
  that should never have been mined"; (iii) é upgrade **aditivo** gated por evidência (D10), logo não precisa
  ser cravada especulativamente.

- **"Camada=autoridade" puro, sem rotear invariantes-contagem para a filosofia.** Rejeitada: a voz contrária
  concedeu o único gap real — "~3 níveis" é uma contagem (camada-2 pela tabela) que **é** invariante; deixá-la
  como referência crua a sub-protege. Resolvida por D7 (roteia para guardrail R6).

- **Contraste manual como o gate F1.** Rejeitado (D9): não-reproduzível, não sobrevive ao próximo app/autor;
  o checklist §6 já era uma rubrica e o Lekto passou nela congelando 80px.

## Self-review against code-quality gates

- **G1 read-before-claim:** applied — afirmações sobre código/spec existente citam file:line e colam a
  asserção load-bearing (design-brief.md:11, :23-27, :70-89; three-layer-briefing.md:1-10, :43-48, :55-59,
  :71, :75, :81, :85, :110-112; screens-prompt.md:14-16, :37-39, :78-84; anti-contamination.md:10-14,
  :39-43, :51-69; fixtures-recipe.md:28-32). As citações verbatim das três vozes são do registro do painel
  desta sessão (subagentes A/B/C). A descrição do feedback Lekto (os quatro contaminantes) vem do **registro
  da sessão** — o arquivo `PROMPT-FEEDBACK.md` era um download transitório, hoje ausente do disco — e está
  marcada como tal, não citada como arquivo presente.
- **G2 soft-language:** applied — ban list (should/probably/may/typically/usually + hedges pt-BR
  deveria/talvez/provavelmente/geralmente/parece/acho) escaneada: **0 ocorrências**.
- **G6 reference-or-strike:** applied — asserções sobre código/spec carregam `verified_by`; a claim sobre o
  feedback Lekto carrega proveniência explícita (registro da sessão, arquivo ausente); decisões net-new
  (D1–D10) estão marcadas como decisões do operador/painel, não como citações.
