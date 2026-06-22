<!--
PROVENANCE — vendored verbatim (2026-06-15) from a Lekto dogfooding post-mortem:
  ~/lekto/docs/design/2026-06-15-instrucoes-skill-gerador-de-prompt-de-telas.md
This is the CANONICAL spec for the anti-contamination heart of the `design-brief`
skill (plan: skills-restructuring, phase F5, decision D5). Lekto/FSRS appears only
as the worked "gold example"; the three-layer model + R1–R9 are app-agnostic and
must be encoded generically in the skill assets. Do NOT abstract the load-bearing
detail away when porting into the assets — that abstraction IS the failure R2/R3
warn against.

REVISÃO 2 (2026-06-22) — o spec ganhou um SEGUNDO eixo. R1–R9 cobrem a
anti-contaminação do EXCESSO (mecânica/constante/copy legada congelada como
"vinculante"); a Revisão 2 adiciona o eixo da OMISSÃO + o rigor de fixtures:
duas-testemunhas / grafo-de-verbos (R10), contrato-de-casca (R11), cobertura
monotônica (R12), gate-de-realidade-de-feature (R13), auditoria-de-contradição
R2b (R14), promessa-&-amplitude-de-marca (R15), modelo-de-informação +
hub×dashboard + definir-termos (R16) e rigor-de-fixtures (R17). Continuam
app-agnósticos — Lekto/FSRS segue apenas como exemplo-ouro, nunca como fato de
skill. As novas regras ESTENDEM o núcleo silêncio-na-camada-1 /
especificar-camadas-2-3; nunca o contradizem.
-->

# Briefing para a skill geradora de "prompt de telas" (para o agente que constrói a skill)

> **Para quem lê:** você está construindo/ajustando uma **skill** que gera, a partir de um app real, um **"prompt de telas"** entregue a um **agente de design** (ex.: Claude Design). Este documento te dá **contexto** e as **regras** para que o prompt gerado **não repita uma falha específica** já observada. Não é uma correção de um prompt pronto — é instrução para a **geração**.

---

## 0. Resumo em uma frase

A skill precisa gerar prompts que **silenciam sobre a forma visual** mas **especificam, com valores concretos, o comportamento da interação e a filosofia (quem decide o quê)** — porque tratar interação/filosofia como "decisão do designer" e omiti-las foi exatamente o que produziu um prompt ruim.

---

## 1. Contexto — o que a skill produz e quem consome

- **Entrada:** um app real (codebase) + a intenção de produto.
- **Saída:** um **prompt de telas** em **pt-BR** (ou a língua configurada), entregue a um agente de design que vai redesenhar o app.
- **Divisão de responsabilidade que a skill assume:**
  - O **Design System (DS)** é construído/owned **à parte**. O prompt de telas **consome o DS herdado** — referencia tokens/componentes **pelo nome semântico** e **nunca redefine** cor, tipografia, espaçamento, raio, sombra ou componentes. Se uma tela precisa de algo que o DS não tem, o prompt manda **parar e sinalizar**, não improvisar.
  - O agente de design **decide a forma visual**. O prompt **não** decide.
- **Estrutura por tela na saída:** propósito · informação visível (com **fixtures reais**) · o que a pessoa precisa conseguir fazer · fluxo · estados (vazio/carregando/erro/offline/primeira-vez/populado) · restrições/filosofia. Para **mobile e desktop**, **claro e escuro**.

---

## 2. A falha central que a skill PRECISA evitar (o porquê)

Houve uma tentativa anterior de gerar esse prompt à mão. Ela falhou por um motivo único e generalizável. A skill tem que ser desenhada **contra** ele.

### 2.1 A confusão de raiz: interação foi tratada como se fosse forma visual

Existem **três camadas**, com **donos diferentes**:

| Camada | Exemplos | Dono | No prompt |
|---|---|---|---|
| **1. Forma visual** | cor, raio, sombra, qual widget, espaçamento, tipografia | Agente de design | **Silêncio** |
| **2. Modelo de interação / comportamento** | classe do gesto (rápido × deliberado); ritmo/tempo **com valores**; densidade de texto (curtíssimo × verboso); alcance (uma mão/polegar); latência (instantâneo); gatilho (só após X); reversibilidade; paridade mobile-gesto ↔ desktop-teclado | **Produto** | **Especificar, concreto** (a banda vincula; o valor exato é calibração atual, melhorável) |
| **3. Filosofia / quem decide o quê** | qual decisão é **humana** × qual é do **sistema**; o que fica **oculto** | **Produto** | **Especificar como guardrail** |

A regra "não induza, deixe o agente decidir" **só vale para a camada 1**. A tentativa anterior a estendeu para 2 e 3 e **silenciou as três**. Resultado: subespecificação.

### 2.2 Omissão NÃO é neutra — é um palpite errado terceirizado

Cada fato concreto omitido vira um buraco que o agente de design **preenche com o default convencional dele** — que costuma ser o **anti-padrão do produto**.

**Cadeia causal real (use como teste mental):**

> O prompt não passou o **tempo-padrão do countdown** (~8s) nem disse que o card é **curtíssimo** → o agente inferiu que **revelar** é um ato lento e deliberado → se é lento, um affordance explícito de "revelar" faz sentido → então **avaliar** também vira um conjunto de opções explícitas → e, "ajudando", cada opção ganha **"+N dias"**.

O resultado (vários botões de resposta, cada um expondo o intervalo do agendador) é **tecnicamente** "deixar responder o card", mas **viola o modelo do produto** (no Lekto: a pessoa julga a **memória**; o sistema decide **quando** rever; o intervalo nunca aparece). **O parâmetro omitido era o que travava a cadeia.**

### 2.3 A armadilha da "sobre-correção"

Quando se pede "não nomeie o gesto (swipe)", a reação errada é **deletar** a frase. O certo é **substituir** o rótulo pela sua **essência comportamental**: "swipe" → "um único gesto rápido alcançável com o polegar". Apagar o rótulo **junto com** o comportamento é a forma mais comum de cair na falha 2.1.

---

## 3. Regras de geração que a skill deve embutir

- **R1 — Três camadas, ownership explícito.** Toda tela com interação gera obrigatoriamente um bloco **Modelo de interação** e um **Filosofia/guardrails**, além da informação. Silêncio é permitido **só** sobre forma visual. "Sem estética" nunca apaga comportamento.

- **R2 — Colher a essência comportamental do código, não a mecânica nem a abstração.** A skill **lê o app real** e extrai os valores que governam a interação — e os carrega para o prompt **como a calibração atual** (vinculante só quando a intenção de produto corrobora — ver proveniência abaixo / R9). Minere, por tela: tempos/defaults (timers e durações que dão **ritmo** — a cadência, não o ms cru), **contagens** (quantos níveis de resposta, quantos itens), **comprimentos** (quão curto é o conteúdo na hora da decisão), **modalidade** (gesto/teclado/toque), **gatilhos** (o que só fica disponível depois de quê), e **o que o domínio mantém oculto** (ex.: o algoritmo de agenda). Abstrair esses valores ("uma escala curta") é uma falha; declará-los como essência + calibração atual ("~3 níveis; ritmo da ordem de segundos; ~8s no app atual") é o conserto.

  **Filtro de mineração — essência, nunca mecânica.** O que entra no prompt é a **essência comportamental** (ritmo, contagem, comprimento, modalidade, gatilho), expressa como essência **com a calibração atual**. A **mecânica de implementação fica fora do escopo de R2**: medidas de layout em `px`, `axis-lock` de gesto, `debounce`/durações em ms cru e a **copy literal** (texto de botão/label) são incidentais da implementação, não requisito de produto, e contaminam o prompt se entrarem como valor. *Des-induzir uma constante:* um handler de swipe com `axis-lock: 'x'`, limiar de `80px` e `debounce` de 16ms **não** vira "axis-lock X, 80px, 16ms" no prompt — vira a essência: "um único gesto rápido, horizontal, alcançável com o polegar, que perdoa toque acidental". Minere a essência; descarte o `axis-lock`, o `80px`, o `debounce` e a copy literal.

  **Proveniência — código não vincula por si só (camada 2).** A presença de um valor no código o marca como **atual / de referência** (a calibração de hoje), **não** como invariante. Um valor de camada-2 só vira **invariante vinculante** quando há **corroboração da intenção de produto** (a intenção declarada, o porquê do domínio) — existir no código **não basta**. Sem corroboração, todo valor minerado entra como calibração-com-banda (R9), aberto a melhoria; com corroboração da intenção, o valor sobe para guardrail (R6).

- **R3 — Auditoria de omissão (obrigatória, por tela).** Antes de fechar cada tela, perguntar: *"se eu não disser este parâmetro (tempo, contagem, comprimento, modalidade, o-que-fica-oculto), um agente razoável preencheria com algo que contradiz o produto?"* Se sim, **diga o parâmetro**. Omissão é decisão.

- **R4 — Descrever interação por atributos de comportamento, não por widget.** Vocabulário permitido: *classe do gesto* (rápido/deliberado/digitação), *latência* (instantâneo/sub-segundo/deliberado), *esforço* (uma mão/polegar), *densidade de texto* (curtíssimo/verboso), *gatilho* (só após X), *reversibilidade* (perdoa toque acidental), *paridade* (mobile-gesto ↔ desktop-teclado, igualmente rápido). **Proibido (independente de língua — vale em qualquer idioma; e cobre os sinônimos pt-BR):** nomear um widget/controle — *button/botão, list/lista, tab/aba, bar/barra, card-de-UI/cartão, heatmap/mapa-de-calor, chip, modal, dropdown/menu suspenso, toggle/interruptor, slider/controle deslizante, accordion/sanfona, badge/etiqueta, toast, tooltip, breadcrumb, pill, stepper, switch*; nomear um **contêiner de layout** — *grid/grade, sidebar/barra lateral, drawer/gaveta, panel/painel, column/coluna, header/cabeçalho, footer/rodapé, hero, container, wrapper*; descrever **hierarquia visual / forma** — cor, borda, sombra, espaçamento, tipografia, raio, tamanho/peso de fonte, alinhamento, elevação, ou "primário/secundário/destaque" como tratamento visual. Tudo isso é camada-1, do agente de design. (Mantenha esta lista **materialmente equivalente** à do asset `screens-prompt` — sinônimos e contêineres podem variar entre as duas, mas o **conjunto vinculante** é o mesmo.)

- **R5 — Eixo "humano × sistema" em todo ponto de ação.** Dizer qual decisão é **humana** (julgamento significativo) e qual é do **sistema** (técnica, oculta). Proibir expor decisão do sistema como escolha do usuário.

- **R6 — Citar o anti-padrão proibido nas telas de risco.** Cercar a direção-errada por nome (ex.: "avaliar NÃO pode virar N opções técnicas, cada uma mostrando dias até a próxima revisão") **é guardrail, não é ditar forma**. Faça isso onde o default convencional do agente colide com o produto.

  **Roteamento de invariantes de camada-2 → R6.** Quando um valor de camada-2 é de fato um **invariante** (corroborado pela intenção de produto, não só a calibração atual), ele é expresso aqui como **guardrail R6** — nomeando o anti-padrão proibido — e **não** como número cru de referência. Ex.: as **~3 expressões de resposta** não são apenas "um número de calibração"; são guardrail R6 — *é proibido um 4º nível que vire seletor de intervalos ou exponha "+N dias"*. O valor sobe para R6 porque a intenção do produto o corrobora; um valor sem essa corroboração fica como calibração (R9/R2).

- **R7 — Substituir, nunca deletar, ao "des-induzir".** Trocar nome de widget/gesto pela essência comportamental; jamais apagar a essência junto com o rótulo.

- **R8 — Fixtures carregam textura, não só valores.** Usar dados reais do app (extraídos de seeders/testes/conteúdo de produção) **e** mostrar a **textura**: quão pouco texto há na tela no momento da decisão, quão curto é cada item. A brevidade é parte do dado.

- **R9 — Preâmbulo explícito no prompt gerado (duas autoridades).** O prompt deve abrir declarando **duas autoridades distintas**, não um carimbo único: a **forma visual** (widget, cor, formato, espaçamento) é do **agente de design** — não prescrevemos; a **filosofia / o que fica oculto / quem decide** (camada 3) é **requisito de produto vinculante**; o **comportamento de interação** (camada 2) é a **calibração atual** — a **banda comportamental vincula** (ex.: "cadência da ordem de segundos") mas o **valor exato (~8s) é o que o app faz hoje, melhorável dentro da banda**, nunca um número congelado. Consumimos o DS existente, sem redefinir.

---

## 4. Estrutura obrigatória de cada tela (no prompt gerado)

Para cada tela, a skill emite:

1. **Para que serve** — o objetivo da pessoa.
2. **Informação visível** — o que precisa estar à vista, com **fixtures reais**.
3. **O que a pessoa precisa conseguir fazer** — intenções, não widgets.
4. **Modelo de interação** *(novo, obrigatório nas telas com interação)* — os atributos da R4 **com os valores concretos da R2** (ritmo/tempos, contagens, comprimentos, modalidade, gatilhos, paridade mobile/desktop).
5. **Filosofia / guardrails** *(novo, obrigatório)* — eixo humano × sistema (R5) + o que fica **oculto** + o **anti-padrão proibido** (R6).
6. **Fluxo** — a sequência momento a momento.
7. **Estados — ledger dos 6 estados** — vazio/carregando/erro/offline/primeira-vez/populado, cada um endereçado explicitamente. Um estado que de fato não existe naquela tela é marcado **N/A com justificativa** (ex.: "offline: N/A — tela só acessível online"); omitir um estado em silêncio é proibido — o ledger só fecha quando os seis têm fixture real **ou** um `N/A` justificado.
8. **Restrições** — usabilidade (uma mão, instantâneo, perdoa erro, etc.).

---

## 5. Exemplo-ouro (o padrão que a saída deve atingir) — "como o card é respondido"

**Superficial (a falha — NÃO gerar assim):**
> *"Avaliar o quão bem lembrou, numa escala curta — não lembrei → quase → lembrei."*

**Correto (comportamento + parâmetros + guardrails, sem widget — GERAR assim):**
> **Modelo de interação.** Cada card é **curtíssimo** (uma pergunta de poucas linhas). A cadência é de **segundos**: a pessoa pensa e há um **tempo-limite suave da ordem de poucos segundos** (no app atual, ~8s) antes de o verso aparecer sozinho. Após revelar, a pessoa expressa a recordação num **único gesto rápido, alcançável com o polegar**, **instantâneo** e que **perdoa toque acidental**; no desktop, igualmente rápido **sem mouse**. São **~3 expressões humanas** (não lembrei / quase / lembrei); um "lembrei fácil" é **inferido** da prontidão da resposta, não é uma 4ª opção a pesar. O ato inteiro (pensar→revelar→responder→próximo) dura **poucos segundos**.
>
> **Filosofia / guardrails (vinculante).** A pessoa julga a **memória**, nunca a **agenda**. O intervalo/agendamento (ex.: FSRS) é do **sistema** e **não aparece**. É **proibido**: mostrar "+N dias", usar rótulos técnicos ("Difícil/Bom/Fácil") ou transformar a resposta num seletor de opções com intervalos. Nenhum número no caminho de responder.

Repare: **zero** menção a cor/widget, mas o agente **não consegue mais** derivar o botão-com-dias. Esse é o alvo de qualidade.

---

## 6. Checklist de aceitação (a skill se auto-verifica, por tela)

A geração só está pronta quando, para **cada** tela com interação:

- [ ] Tem bloco **Modelo de interação** com **valores concretos** (algum tempo/contagem/comprimento/modalidade), não só adjetivos.
- [ ] Tem bloco **Filosofia/guardrails** dizendo **quem decide** (humano × sistema) e **o que fica oculto**.
- [ ] **Nomeia o anti-padrão proibido** onde o default do agente colidiria com o produto.
- [ ] Passou na **auditoria de omissão** (R3): nenhum parâmetro load-bearing ficou de fora.
- [ ] **Não** nomeia widget nem descreve forma visual (cor/borda/sombra/espaçamento).
- [ ] **Nenhuma constante de mecânica** (px, axis-lock, debounce-ms) **nem copy literal entra como requisito** — a mecânica fica fora de R2 (filtro de mineração); a copy literal é lane de textura mutável, não valor vinculante.
- [ ] **Fixtures reais** presentes, com a **textura** (brevidade) visível.
- [ ] Cobre **mobile e desktop**, **claro e escuro**, e **todos os estados**.
- [ ] **Consome o DS** por nome, sem redefinir; manda **parar e sinalizar** se faltar algo no DS.
- [ ] **Proveniência aplicada:** todo valor de camada-2 entra como **calibração-com-banda** (R9) — exceto os **invariantes corroborados pela intenção**, que aparecem como **guardrail R6**, nunca como número cru de referência.
- [ ] **Realidade de feature classificada** (R13): cada feature marcada *system-backed* × *stub-only*; nenhum *greenfield* entrou em silêncio — houve **pare-e-pergunte** (briefar-completo ou cortar).
- [ ] **Gatilho de inferência registrado** (R10/R16): toda superfície/verbo/termo *intent-only* (na intenção, ausente do código) virou tela/bloco de 1ª classe, não foi descartado por não-aparecer-no-código.
- [ ] **Contradição sinalizada** (R14): onde intenção e código divergem, há **correção-de-fato + sinalização explícita** — nenhuma escolha resolvida no silêncio.
- [ ] **Varredura de substantivos feita** (R16): objetos/entidades do domínio mapeados (taxonomia por eixos + papéis + público/privado), termos ambíguos **definidos e ensinados**; "ver todos" dimensionado pela **escala-alvo**.
- [ ] **Ledger de estados completo** (§4.7): os seis estados endereçados, cada um com fixture real **ou** `N/A` justificado — nenhuma omissão silenciosa.
- [ ] **Rigor de fixtures aplicado** (R17): cada item no **degrau mais rico em forma-alvo** alcançado (verbatim > transformação > sintético), **tier marcado por item**, comprimento **medido** (não chutado), **edge = máximo global real**, **path de proveniência verificado resolvível**, e **não regrediu** vs. a geração anterior (memória-de-regeneração).
- [ ] **Validação obrigatória cumprida** (R18): **CP2** (escopo congelado) e **CP5** (sign-off) passaram, e **todo** *stop-and-ask* (feature-reality, R2b, greenfield, camada-3, autorização de fixtures) foi resolvido pelo operador — nada gerado nem entregue em silêncio.

---

## 7. O que continua valendo (não regredir)

- O **DS é consumido**, nunca redefinido pelo prompt de telas.
- O prompt **silencia sobre forma visual** — mas isso vale **só** para a camada 1.
- **Nenhuma tela de fora**; cada uma com seus **estados**, em **mobile/desktop** e **claro/escuro**.
- Texto em **pt-BR** (ou a língua configurada).
- A diferença que sustenta tudo: **forma = do designer (silêncio); comportamento e filosofia = do produto (especificar).**

---

## 8 — Além da mineração: as superfícies que o código não mostra

R1–R9 defendem contra o **EXCESSO** (congelar mecânica/constante/copy legada como requisito). Mas a skill minera o app existente — e isso tem uma falha **oposta** e simétrica: a **OMISSÃO**. Tudo que o redesenho **adiciona** é invisível à mineração; toda superfície/verbo/casca/amplitude que existe só na **intenção de produto** (não no código de hoje) some do briefing. As regras abaixo cobrem esse eixo. Elas **estendem** o núcleo — nunca o contradizem.

**Meta-modelo (vale para todas as R10–R16):** há **duas testemunhas**. O **código** é o que o app faz **hoje** — uma testemunha, e muitas vezes justamente a coisa a ser redesenhada (não é autoridade de "o que deve existir"). A **intenção de produto** — os **verbos**, as **superfícies**, a **promessa** do produto — é a outra testemunha, a fonte do redesenho. Briefe a **UNIÃO** das duas; faça **aflorar a DIFERENÇA** (o que uma tem e a outra não); **nunca** congele o legado como requisito (eixo do EXCESSO) e **nunca** descarte uma superfície por ela não-aparecer-no-código (eixo da OMISSÃO).

- **R10 — Duas testemunhas / grafo de verbos.** Briefe a **UNIÃO** de código + intenção, não só o que o código revela. Levante o **grafo de verbos** do produto — cada **verbo × objeto** (o que a pessoa *faz* a *qual* entidade) — a partir da intenção, não só dos handlers existentes. **Toda superfície que existe apenas na intenção (intent-only) é tela de 1ª classe**, com o mesmo bloco completo (§4) de uma tela minerada — nunca uma nota de rodapé "a fazer". Um verbo da intenção sem tela é uma omissão, não um silêncio legítimo.

- **R11 — Contrato de casca.** Telas **não são ilhas**. Abra o briefing **pelo app inteiro**: a **casca** (o que persiste em volta de toda tela), o **grafo de navegação** (como se vai de uma superfície a outra), a distinção **focada × com-casca** (tela imersiva sem cromo × tela embutida no shell de navegação), o **item ativo** (como a casca mostra onde você está), e **mobile × desktop** (a casca difere por viewport). Garanta **paridade de núcleos**: o mesmo conjunto de superfícies-núcleo é alcançável em ambos os viewports — nenhuma cair só porque a mineração de um deles veio mais magra.

- **R12 — Cobertura monotônica.** Desminere o **COMO** (a mecânica/forma de hoje — eixo R2), **nunca o QUÊ** (a superfície existir). **Nunca apague uma tela** que o código ou a intenção testemunham. A cobertura de telas só pode **crescer ou se manter** entre gerações — jamais encolher. Tirar uma superfície do briefing exige justificativa explícita de produto (corte deliberado), nunca o subproduto de uma re-mineração mais estreita.

- **R13 — Gate de realidade de feature.** Classifique cada feature: **system-backed** (há sistema real por trás — lógica/dados/backend) × **stub-only** (só casca, sem nada atrás). Onde a feature é stub/ausente mas a intenção a pede, **pare-e-pergunte**: *briefar como greenfield-completo ou cortar?* — não infira a resposta. O gate é **por-feature**, não por-página: uma página pode misturar features system-backed e stub-only, e cada uma é classificada separadamente.

- **R14 — Auditoria de contradição (R2b).** Quando a **intenção contradiz o código** (a intenção diz X, o código faz Y), a saída é **correção-de-fato + pare-e-sinalize**: registre que há divergência e exponha as duas leituras ao operador — **nunca escolha um lado em silêncio**. (Complementa R2: R2 diz "código não vincula sozinho"; R2b diz "quando código e intenção brigam, sinalize, não arbitre calado".)

- **R15 — Promessa & amplitude de marca.** A **promessa** e a **amplitude** do produto saem da **intenção**, não do código. O código frequentemente implementa um **subconjunto** mais estreito do que a marca promete; quando o código é **mais estreito** que a promessa, **sinalize a lacuna** — não deixe a amplitude do briefing encolher para o tamanho do que já foi construído.

- **R16 — Modelo de informação + hub × dashboard + definir-termos.** Levante o **modelo de informação** do domínio: a **taxonomia** dos objetos por **eixos** + **papéis** + visibilidade **público/privado** (varredura de substantivos — quais entidades existem, como se relacionam, quem as vê). Distinga **hub-de-ação** (superfície para *fazer*: agir, criar, despachar) de **dashboard-de-análise** (superfície para *entender*: ler estado, métricas, tendência) — são contratos diferentes e a mineração tende a achatar um no outro. **Defina e ensine** os termos/sentidos ambíguos do produto (um pequeno conjunto de sentidos direcionais, papéis homônimos, jargão de domínio) em vez de assumi-los. E dimensione qualquer "ver todos" pela **escala-alvo** real (quantos itens o domínio realmente tem), não pela cardinalidade do seed de hoje.

- **R18 — Validação obrigatória do operador (não-adiável).** A geração é **checkpointed**, não one-shot: o julgamento do operador é a **única** fonte do que a mineração não vê (verbos, superfícies, amplitude, decisões ocultas), então a skill **para em checkpoints fixos**, mostra o que decidiu/decompôs, e exige **decisão explícita** do operador antes de seguir — escolhas concretas para **aprovar/corrigir**, nunca pergunta aberta. Checkpoints: **CP1** intenção (promessa/amplitude, fronteira humano×sistema, anti-padrões proibidos + os pontos de validação derivados da intenção); **CP2** inventário (grafo de verbos + ledger — o **escopo congela** aqui: nada se gera antes); **CP3** por tela (valores minerados com triagem de proveniência + filosofia + perguntas de omissão/contradição/realidade); **CP4** fonte de fixtures (degrau, autorização de pull read-only, diff de regeneração); **CP5** sign-off final (ledger + decisões por tela + self-check §6 — o brief não é entregue sem ele). **Não-adiável:** sem passar **CP2** (escopo) e **CP5** (sign-off) e sem resolver **todo** *stop-and-ask* (feature-reality, R2b, greenfield, camada-3 ausente, autorização de fixtures), o brief é **inválido por construção**. **Sem TTY (hook/loop) → a skill aborta**, não pula a validação.

---

## 9 — Rigor de fixtures (R17)

Estende R8 (fixtures carregam textura). R8 diz "puxe dado real"; **R17** define o **rigor** dessa puxada — o que separa um fixture fiel de um plausível-inventado.

- **R17 — Rigor de fixtures.**
  - **Degrau mais rico em forma-alvo.** Suba a escada parando no degrau que entrega o conteúdo **mais rico na forma que a tela-alvo precisa**: **verbatim** (conteúdo real, intacto) > **transformação** (real, reprojetado para a forma da tela) > **sintético** (último recurso). Prefira sempre o degrau mais alto que ainda fala da forma-alvo.
  - **Comprimento medido, bidirecional (~15%).** **Meça** o comprimento real do conteúdo (não chute); o fixture deve cair dentro de **~15%** do real **nos dois sentidos** — nem inflar conteúdo curto em parágrafos, nem encolher conteúdo longo em one-liner.
  - **Edge = máximo global real.** A linha-de-borda é o **máximo global** que existe no dado real (o título mais longo de toda a base, o campo mais cheio), não o maior do seed local — é onde o layout quebra de verdade.
  - **Sem fórmulas / sem mecânica nos fixtures.** Fixture é **conteúdo**, não cálculo: nada de fórmulas, intervalos do agendador, constantes de mecânica ou números de implementação vazando para dentro do fixture.
  - **Sintético subordinado ao frio real.** Quando um degrau sintético for inevitável, ele fica **subordinado ao real frio** já colhido — calibrado pela textura do dado real (cardinalidade/comprimento/distribuição reais), nunca uma invenção solta que ignora o que o real mostrou.
  - **Path de proveniência verificado resolvível.** Todo fixture carrega o **path de proveniência** de onde veio, e esse path é **verificado resolvível** (resolve de fato à fonte) — não uma citação decorativa.
  - **Memória de regeneração.** Ao regerar, **não regrida** vs. a geração anterior: o conjunto novo é pelo menos tão rico (mesma cobertura de estados, mesmas edge rows, mesma textura) quanto o anterior — regeneração nunca empobrece o fixture.
  - **Tag de tier por item.** Cada item é **tagueado com seu tier** (verbatim / transformação / sintético), por item — para o agente de design saber, item a item, o quanto confiar na textura.

---

## 10 — Entrega: o handoff vai para revisão (R19)

A emissão dos arquivos **não é a linha de chegada**. O `design-handoff/` é um **handoff que vai para revisão**, não trabalho entregue.

- **R19 — Handoff para revisão (a emissão não encerra).** Depois do sign-off (CP5) e da escrita dos arquivos, a **mensagem de fechamento** deve deixar **explícito** que o artefato **vai para revisão** — uma tabela seca de "emiti N arquivos" é exatamente a lacuna a fechar. A mensagem nomeia (1) **o que** foi emitido (a pasta + os arquivos `00-design-system.md` / `01-screens.md` / `02-fixtures.md` / `README.md`), (2) **que é para revisão** — o operador **revisa e corrige** e só **então envia ao agente de design**, cujo veredito volta para refinar o próximo round, e (3) **a próxima ação** (revisar → corrigir → enviar ao agente → trazer o feedback). Nunca reportar emissão como "concluído".
  - **Integração com mdprobe (opcional, nunca auto-lançada).** Oferecer abrir o `design-handoff/` no **mdprobe** (viewer/reviewer de markdown com live-reload e anotações persistentes) para a revisão. Abrir o browser é **efeito colateral intrusivo — nunca auto-lançar**; perguntar antes. Em "sim": `mdprobe design-handoff/ 2>/dev/null || npx -y @henryavila/mdprobe design-handoff/` — o fallback `npx -y` cobre a máquina onde o mdprobe não está instalado (auto-detecta; sem precisar de probe "está instalado?" separado); o servidor singleton do mdprobe reusa uma instância já no ar. Em "não": apontar os arquivos em `design-handoff/` para revisão manual.
