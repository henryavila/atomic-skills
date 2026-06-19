<!--
PROVENANCE — vendored verbatim (2026-06-15) from a Lekto dogfooding post-mortem:
  ~/lekto/docs/design/2026-06-15-instrucoes-skill-gerador-de-prompt-de-telas.md
This is the CANONICAL spec for the anti-contamination heart of the `design-brief`
skill (plan: skills-restructuring, phase F5, decision D5). Lekto/FSRS appears only
as the worked "gold example"; the three-layer model + R1–R9 are app-agnostic and
must be encoded generically in the skill assets. Do NOT abstract the load-bearing
detail away when porting into the assets — that abstraction IS the failure R2/R3
warn against.
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
| **2. Modelo de interação / comportamento** | classe do gesto (rápido × deliberado); ritmo/tempo **com valores**; densidade de texto (curtíssimo × verboso); alcance (uma mão/polegar); latência (instantâneo); gatilho (só após X); reversibilidade; paridade mobile-gesto ↔ desktop-teclado | **Produto** | **Especificar, concreto** |
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

- **R2 — Colher a essência comportamental do código, não a mecânica nem a abstração.** A skill **lê o app real** e extrai os valores que governam a interação — e os carrega para o prompt como requisito. Minere, por tela: tempos/defaults (timers e durações que dão **ritmo** — a cadência, não o ms cru), **contagens** (quantos níveis de resposta, quantos itens), **comprimentos** (quão curto é o conteúdo na hora da decisão), **modalidade** (gesto/teclado/toque), **gatilhos** (o que só fica disponível depois de quê), e **o que o domínio mantém oculto** (ex.: o algoritmo de agenda). Abstrair esses valores ("uma escala curta") é uma falha; declará-los como essência + calibração atual ("~3 níveis; ritmo da ordem de segundos; ~8s no app atual") é o conserto.

  **Filtro de mineração — essência, nunca mecânica.** O que entra no prompt é a **essência comportamental** (ritmo, contagem, comprimento, modalidade, gatilho), expressa como essência **com a calibração atual**. A **mecânica de implementação fica fora do escopo de R2**: medidas de layout em `px`, `axis-lock` de gesto, `debounce`/durações em ms cru e a **copy literal** (texto de botão/label) são incidentais da implementação, não requisito de produto, e contaminam o prompt se entrarem como valor. *Des-induzir uma constante:* um handler de swipe com `axis-lock: 'x'`, limiar de `80px` e `debounce` de 16ms **não** vira "axis-lock X, 80px, 16ms" no prompt — vira a essência: "um único gesto rápido, horizontal, alcançável com o polegar, que perdoa toque acidental". Minere a essência; descarte o `axis-lock`, o `80px`, o `debounce` e a copy literal.

  **Proveniência — código não vincula por si só (camada 2).** A presença de um valor no código o marca como **atual / de referência** (a calibração de hoje), **não** como invariante. Um valor de camada-2 só vira **invariante vinculante** quando há **corroboração da intenção de produto** (a intenção declarada, o porquê do domínio) — existir no código **não basta**. Sem corroboração, todo valor minerado entra como calibração-com-banda (R9), aberto a melhoria; com corroboração da intenção, o valor sobe para guardrail (R6).

- **R3 — Auditoria de omissão (obrigatória, por tela).** Antes de fechar cada tela, perguntar: *"se eu não disser este parâmetro (tempo, contagem, comprimento, modalidade, o-que-fica-oculto), um agente razoável preencheria com algo que contradiz o produto?"* Se sim, **diga o parâmetro**. Omissão é decisão.

- **R4 — Descrever interação por atributos de comportamento, não por widget.** Vocabulário permitido: *classe do gesto* (rápido/deliberado/digitação), *latência* (instantâneo/sub-segundo/deliberado), *esforço* (uma mão/polegar), *densidade de texto* (curtíssimo/verboso), *gatilho* (só após X), *reversibilidade* (perdoa toque acidental), *paridade* (mobile-gesto ↔ desktop-teclado, igualmente rápido). Proibido: nomear botão/lista/aba/barra/card-de-UI/heatmap/chip/modal ou descrever cor/borda/sombra/espaçamento.

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
7. **Estados** — vazio/carregando/erro/offline/primeira-vez/populado.
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
- [ ] **Fixtures reais** presentes, com a **textura** (brevidade) visível.
- [ ] Cobre **mobile e desktop**, **claro e escuro**, e **todos os estados**.
- [ ] **Consome o DS** por nome, sem redefinir; manda **parar e sinalizar** se faltar algo no DS.
- [ ] **Proveniência aplicada:** todo valor de camada-2 entra como **calibração-com-banda** (R9) — exceto os **invariantes corroborados pela intenção**, que aparecem como **guardrail R6**, nunca como número cru de referência.

---

## 7. O que continua valendo (não regredir)

- O **DS é consumido**, nunca redefinido pelo prompt de telas.
- O prompt **silencia sobre forma visual** — mas isso vale **só** para a camada 1.
- **Nenhuma tela de fora**; cada uma com seus **estados**, em **mobile/desktop** e **claro/escuro**.
- Texto em **pt-BR** (ou a língua configurada).
- A diferença que sustenta tudo: **forma = do designer (silêncio); comportamento e filosofia = do produto (especificar).**
