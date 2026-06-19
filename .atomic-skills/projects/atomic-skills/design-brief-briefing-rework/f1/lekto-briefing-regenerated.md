<!-- v2 — regeneração CEGA VÁLIDA (2026-06-19) a partir da cópia limpa /home/henry/lekto-blind-regen
     (sem memória/prompts contaminados). Consolida 00-design-system + 01-screens + 02-fixtures.
     v1 preservado em f1/lekto-briefing-regenerated-v1.md. Gerado pela skill design-brief + fix T-006. -->

# ============ 00 · DESIGN SYSTEM ============

# Prompt 1 — Design System do Lekto (construir primeiro, herdar em tudo)

> **Preâmbulo (vinculante).** Construa um Design System que herdaremos sem alteração em todas as
> telas. Defina tokens e componentes **uma vez, por nome semântico**; o prompt de telas
> referenciará esses nomes e **nunca** redefinirá cor, tipografia, espaçamento, raio, sombra ou
> qualquer componente. Onde houver um requisito abaixo, ele é uma **restrição mensurável**, nunca
> uma solução visual — **a forma é sua escolha**.

## Contexto do produto (para calibrar o tom, não para prescrever forma)

Lekto é um app de **repetição espaçada** para reter o que se lê. O coração é um **ritual de
revisão cronometrado**: sessões curtas, foco total, um gesto para avaliar. O DS precisa servir
tanto a esse momento de **alta concentração e baixo atrito** (a tela de revisão) quanto a telas de
**navegação e análise** mais calmas (início, explorar, progresso, perfil). O conteúdo é majoritariamente
em **português**, denso e textual (frases de 1 a 5 sentenças). Suporte a **tema claro e escuro** é
obrigatório (o app hoje é só escuro; defina ambos).

## 1. Contrato de tokens (semântico, não literal)

Nomeie tokens por **papel/intenção**, nunca por valor. O valor literal mora só no DS; as telas
ligam os nomes. Cubra no mínimo:

- **Cores por papel**, em **claro e escuro**: superfícies em pelo menos três profundidades
  (base / elevada / sobreposta), texto em uma escala de ênfase (primário / secundário / suave /
  tênue), uma **ação primária** (de marca) com seus estados, e **papéis de estado semânticos**.
- **Os três papéis de avaliação** são parte do contrato e carregam significado distinto —
  **negativo / parcial / positivo** (no produto: "errei" / "quase" / "lembrei"). Defina-os como
  três papéis semânticos distinguíveis **sem depender só da cor** (ver WCAG abaixo). Há ainda um
  papel de **destaque de constância/sequência** (a "ofensiva" de dias).
- **Escala tipográfica** adequada a blocos de texto longo legíveis (o card de revisão exibe
  parágrafos curtos que precisam ser confortáveis em mobile).
- **Escala de espaçamento**, **raios**, **sombras/elevação**.
- **Durações de movimento** por papel: defina ao menos uma cadência **rápida** (microfeedback de
  toque/gesto), uma **média** (transições de conteúdo, virar de card) e uma **deliberada**
  (entrada/saída de overlay). As telas referenciarão essas cadências por nome.

Nenhum valor literal pode vazar para a camada de telas.

## 2. Inventário de componentes (com todos os estados)

Para cada componente, defina **todos os estados** que ele pode assumir (default, hover, foco,
ativo, desabilitado, carregando, erro, vazio, selecionado — os que se aplicarem) para que as telas
nunca precisem inventar um estado faltante. O app precisa, por papel semântico:

- **Casca de aplicação** com navegação principal persistente (uma forma para desktop e uma para
  mobile) e uma região de conteúdo. A navegação cobre **5 destinos** no desktop e **4** no mobile
  (o destino de análise/progresso fica fora da navegação primária mobile — ver prompt de telas).
- **Item de navegação** (estados selecionado/não-selecionado).
- **Cartão de deck** (capa, título, descrição com possível truncamento, autor/avatar, e métricas
  de contagem) — em duas densidades: uma rica (grade) e uma compacta (lista).
- **Indicador de progresso linear** (proporção concluída).
- **Indicador de métrica radial** (um valor 0–100% no centro) e **indicador de métrica linear**.
- **Mapa de atividade** ao longo do tempo (intensidade por dia; precisa de uma forma densa para
  desktop e uma compacta para mobile).
- **Cartão de revisão de duas faces** (frente = estímulo curto; verso = resposta), com a noção de
  **revelar** e de **sair de cena** após a avaliação.
- **Indicador de contagem regressiva por card** (um tempo restante visível, da ordem de segundos).
- **Sobreposição de "prepare-se"** antes da sessão (um aquecimento de poucos batimentos).
- **Afordância de avaliação por gesto em três direções** (negativo / parcial / positivo), com
  **feedback proporcional ao avanço do gesto** e estado de cancelamento.
- **Passo-a-passo de primeira vez** (sequência curta navegável, com indicador de posição).
- **Painel de atalhos** (somente desktop) que espelha os gestos no teclado.
- **Campos de formulário** (texto, e-mail, senha com revelar/ocultar), com estados de foco/erro.
- **Ações** em três pesos: **primária**, **secundária/neutra** e **destrutiva**.
- **Interruptor (liga/desliga)** com estado em transição.
- **Diálogo de confirmação** (sobreposto, para ações destrutivas/irreversíveis).
- **Exibição de segredo/credencial com copiar** e confirmação efêmera de cópia.
- **Filtros em pílula / categorias** (selecionável, rolável horizontalmente).
- **Campo de busca**.
- **Bloco de estado vazio** (ícone/ilustração + mensagem + ação de saída).
- **Indicador de carregamento**.
- **Selo de status** (ex.: pendente vs em dia; ativo vs inativo).
- **Banner/CTA** de destaque.
- **Sinal de feedback efêmero** (confirmação de ação como "copiado", "na lista").

## 3. Um template-base

Produza **exatamente 1 template-base**: uma única página composta — a casca do app com a navegação,
uma região de conteúdo e **uma visão de dados representativa** (uma coleção de cartões de deck com
um CTA no topo) — que exercite os tokens e o inventário juntos. É o ponto de fork que o prompt de
telas reutiliza; **não** um catálogo de tipos de página.

## 4. Acessibilidade (WCAG 2.2 — restrições mensuráveis, não tratamentos)

- Contraste texto/fundo atende WCAG 2.2 AA (≥ 4.5:1 corpo; ≥ 3:1 texto grande), em **claro e escuro**.
- Foco sempre visível, atendendo ao mínimo de aparência de foco 2.2.
- Alvos de toque atendem ao mínimo de tamanho 2.2 (≥ 24×24 px CSS ou espaçamento equivalente) —
  crítico para o gesto de avaliação feito com o polegar.
- **Nada transmite estado apenas por cor** — em especial os três papéis de avaliação (errei/quase/
  lembrei) precisam de um segundo canal além da cor (forma, ícone, posição, rótulo).

---

### Checklist antes de entregar o DS

- [ ] Tokens nomeados por papel, com claro + escuro; nenhum valor literal vaza para as telas.
- [ ] Inventário lista todos os estados de cada componente.
- [ ] Exatamente **1 template-base** (não um conjunto).
- [ ] Itens WCAG 2.2 como restrições mensuráveis, nunca como solução visual.
- [ ] Saída em pt-BR.

# ============ 01 · TELAS ============

# Prompt 2 — Telas do Lekto (consome o DS herdado; nunca o redefine)

> **Há duas autoridades distintas neste briefing — não um carimbo único de "tudo vinculante":**
> — **Forma visual** (widget, cor, formato, espaçamento): é **sua** para decidir — não prescrevemos.
> — **Filosofia / o que fica oculto / quem decide** (camada 3): **requisito de produto vinculante**, não negociável.
> — **Comportamento de interação** (camada 2): é a **calibração atual** do app — a **banda comportamental vincula** (ex.: "a cadência é da ordem de segundos"), mas o **valor exato é o que o app faz hoje (~8s), melhorável por você dentro da banda**, nunca um número congelado.
> Consumimos o **Design System existente** pelo nome semântico e **nunca** o redefinimos. Se uma tela
> precisa de algo que o DS não tem, **pare e sinalize** — não improvise.

As fixtures reais e o lane de `copy (mutável)` estão em `02-fixtures.md` e devem ser usados na seção
"Informação visível" de cada tela. **Cobrir todos os estados, em mobile e desktop, claro e escuro.**

---

## Tela 4 — Revisão (`/review`) — o ritual central

### 1. Propósito
A pessoa revisa, numa micro-sessão curta e concentrada, os cards que o sistema selecionou para hoje:
lê o estímulo, tenta lembrar, revela a resposta e expressa como foi — uma vez por card, em ritmo rápido.

### 2. Informação visível
Use o deck real **"Hábitos Atômicos"** (fixtures): frente curta (uma pergunta de 1–3 frases), verso
de 2–5 frases — veja a **textura real**: as respostas têm várias frases, não one-liners. Em tela há,
por vez, **um** card; o nome do deck; o progresso da sessão (posição atual sobre o total da
micro-sessão, ~N de ~10); e, antes de revelar, o tempo restante de reflexão. Estados de fim e vazio
têm suas próprias mensagens (fixtures).

### 3. O que a pessoa precisa fazer
Concentrar-se num item por vez; revelar a resposta quando quiser (ou deixar revelar sozinha);
e, vista a resposta, **expressar o quão bem lembrou** num gesto só. Nada mais compete por atenção.

### 4. Modelo de interação (camada 2 — calibração atual, banda vincula)
- **Brevidade:** cada card é **muito curto** (poucas linhas). A pessoa decide com pouco texto na tela.
- **Cadência / tempo de reflexão:** da **ordem de segundos**. Há um limite suave por card que, ao
  expirar, **revela o verso sozinho**. Calibração atual: ~5 a 15 s, **escalando com o tamanho do
  verso** (≈8 s num verso típico). A banda — "alguns segundos, proporcional ao tamanho da resposta"
  — vincula; o número exato é melhorável por você dentro dela.
- **Aquecimento de início de sessão:** antes do primeiro card há um "prepare-se" de **poucos
  batimentos** (calibração: três contagens de ~1 s e um "vai!" de ~0,8 s) que também antecipa as três
  direções de resposta. Banda: "um aquecimento curto, de poucos batimentos".
- **Revelar:** um toque único no card revela; ou a revelação acontece sozinha ao fim do tempo. Latência instantânea.
- **Avaliar:** depois de revelar, a pessoa expressa o recall num **único gesto rápido, alcançável
  com o polegar, instantâneo, que perdoa um toque acidental** (um movimento curto e claro o
  confirma; um movimento pequeno é ignorado e o card volta ao lugar; um movimento na direção
  "errada"/para cima cancela sem avaliar). Há **três expressões humanas** — negativa, parcial e
  positiva ("errei / quase / lembrei"); o feedback do gesto é **proporcional ao avanço** dele.
- **Paridade desktop:** no desktop a mesma avaliação é **igualmente rápida sem mouse** — revelar e
  cada uma das três expressões têm equivalente direto de teclado, com as dicas sempre visíveis.
- **Tamanho da sessão:** uma micro-sessão **curta** (calibração: ~10 cards; cap diário de 50). Banda:
  "curta o bastante para um ritual de poucos minutos". O ciclo pensar→revelar→avaliar→próximo dura
  **alguns segundos** por card.
- **Primeira vez:** na primeiríssima sessão, um explicador de **poucos passos** (calibração: 3)
  apresenta ler→revelar→avaliar; depois disso, não reaparece.

**Vocabulário proibido (R4):** não nomeie botão/lista/aba/barra/modal, nem descreva cor/borda/sombra/
espaçamento — isso é forma, sua escolha. As palavras exatas dos rótulos são **copy mutável**: o que
vincula é o ato de fala ("expressar que errou / quase / lembrou"), não a string.

### 5. Filosofia / guardrails (camada 3 — vinculante)
- A pessoa julga **a própria memória**, nunca **o cronograma**. O intervalo, a data da próxima
  revisão, a dificuldade e a estabilidade são **decisão do sistema (FSRS-6)** e **não aparecem**.
- A pessoa dá **um único juízo** ("lembrei?"). Que isso valha *Good* ou *Easy* é **inferido pelo
  sistema** a partir de a resposta ter vindo **antes ou depois** do tempo de reflexão expirar — **não
  é uma 4ª opção a ponderar**.
- **Proibido (anti-padrão):** mostrar "+N dias" ou "revisar em X"; exibir rótulos técnicos
  (Again/Hard/Good/Easy); transformar a avaliação num seletor de opções com intervalos; oferecer um
  **quarto** nível de resposta ou reduzir a **dois** (binário). **Nenhum número no caminho de resposta.**

### 6. Fluxo
Entrar → (1ª vez: explicador) → "prepare-se" → card visível com tempo correndo → revelar (toque ou
expiração) → avaliar com um gesto → próximo card → … → ao fim da micro-sessão, um fecho com a
contagem revisada e uma saída.

### 7. Estados
Carregando; **sem cards para hoje** (vazio, com saída); explicador de primeira vez; "prepare-se";
ativo-antes-de-revelar (tempo correndo); ativo-depois-de-revelar (avaliação habilitada); gesto em
progresso (feedback proporcional); sessão concluída. **Offline:** a avaliação é registrada e
**sincronizada depois**; a revisão **não trava** por falta de rede (a pessoa não percebe diferença).
Tudo em mobile e desktop, claro e escuro.

### 8. Restrições
Operável **com uma mão**, polegar; **instantâneo**; **perdoa toque acidental**; foco total (sem
elementos competindo); paridade teclado↔gesto no desktop sem perda de velocidade.

---

## Tela 1 — Landing / lista de espera (`/`)

### 1. Propósito
Apresentar o Lekto a um visitante anônimo e captar o e-mail para a lista de espera.

### 2. Informação visível
Mensagem-âncora do produto e os diferenciais (fixtures, lane de copy): retenção, FSRS-6, "3 gestos",
"3 ratings vs binário", a etimologia λεκτός, e o campo de e-mail. Um exemplo ilustrativo do card de
revisão com as **três** direções de resposta aparece como demonstração da filosofia.

### 3. O que a pessoa precisa fazer
Entender a proposta e, se convencida, **deixar o e-mail** para ser avisada — em um passo.

### 4. Modelo de interação
- Captura de e-mail **em um envio**; após enviar, confirmação **instantânea** no lugar do formulário;
  erro de validação reaproveita o mesmo ponto, sem navegação.
- Navegação interna por **âncoras** para as seções (calibração: 4 seções); em telas estreitas o
  conjunto de navegação **recolhe** e expande sob demanda (cadência rápida).
- A demonstração do card reforça, visualmente, que a avaliação tem **três** direções (não binária) —
  coerente com a tela de Revisão.

### 5. Filosofia / guardrails
Página pública: **nenhum dado autenticado**. A promessa exibida deve refletir a filosofia real do
produto (agendamento pelo sistema; 3 níveis de resposta; offline). **Proibido** prometer controles
que o produto nega (ex.: o usuário "ajustar intervalos").

### 6. Fluxo
Chegar → ler proposta/diferenciais/ciência → informar e-mail → ver confirmação (ou corrigir erro).

### 7. Estados
Formulário; enviando; sucesso (confirmação no lugar do formulário); erro (mensagem de validação);
navegação recolhida/expandida (mobile). Mobile e desktop, claro e escuro. *(Sem estado autenticado:
quem está logado é levado ao início.)*

### 8. Restrições
Carrega rápido; um único campo para a ação principal; compreensível sem rolar até o fim.

---

## Tela 2 — Entrar (`/login`)

### 1. Propósito
Autenticar um usuário existente por e-mail e senha.

### 2. Informação visível
Identidade do produto, os dois campos (e-mail, senha), a opção de **revelar/ocultar** a senha, e um
caminho para quem ainda não tem acesso (→ lista de espera). Mensagem de erro: ver fixtures.

### 3. O que a pessoa precisa fazer
Informar credenciais e entrar; ou seguir para a lista de espera se não tiver conta.

### 4. Modelo de interação
- Envio único; durante a verificação, a ação fica **ocupada** (sem reentrada) e há sinal de espera.
- Alternar a **visibilidade da senha** é instantâneo e reversível.
- Sucesso leva direto ao início.

### 5. Filosofia / guardrails
**Segurança:** o erro de credencial é **genérico e único** — **não revela** se o e-mail existe nem
qual campo falhou. **Proibido** mensagens que diferenciem "e-mail não encontrado" de "senha errada".

### 6. Fluxo
Informar e-mail e senha → enviar → (sucesso: início) / (erro: mensagem genérica, permanecer).

### 7. Estados
Ocioso; enviando (ocupado); erro (mensagem genérica); senha revelada/oculta. Mobile e desktop, claro e escuro.

### 8. Restrições
Foco imediato no primeiro campo; recuperação de erro sem perder o que foi digitado.

---

## Tela 3 — Início / meus decks (`/home`)

### 1. Propósito
Ponto de partida do usuário autenticado: o chamado para revisar hoje e o acesso aos decks próprios e inscritos.

### 2. Informação visível
O quanto há para revisar hoje e a sequência de dias (fixtures: estados conta-nova / em-progresso /
madura); a coleção de **decks próprios** e de **decks inscritos**, cada um com nome, contagem de cards
e quantos estão pendentes; e — desenhada como **funcionalidade real** (decisão do operador) — uma
faixa de **atividade recente, nível/XP e mapa de constância**. Vazios têm mensagem e saída (fixtures).

### 3. O que a pessoa precisa fazer
Iniciar a revisão do dia (ação principal); ou entrar num deck para revisar/gerenciar; ou, sem decks,
ir explorar a biblioteca.

### 4. Modelo de interação
- A ação principal — **iniciar a revisão do dia** — é a mais proeminente e leva ao ritual.
- Abrir um deck **bifurca pelo papel**: deck **próprio** → tela de gerência; deck **de terceiros
  (inscrito)** → detalhe público. Mesma intenção, destino conforme posse.
- Densidade **divergente por porte de tela**: no desktop a coleção é navegável de forma rica; no
  mobile, de forma compacta e tocável. Calibração de agrupamento: dois grupos (próprios / inscritos).
- Progressão/gamificação (atividade, nível/XP, constância) é informativa e **não** se torna uma
  alavanca sobre o agendamento.

### 5. Filosofia / guardrails
O "quanto revisar hoje" é **definido pelo sistema** (fila do FSRS), não um alvo que o usuário ajusta.
A gamificação **motiva**, mas **não** altera o que/quando revisar. **Proibido** sugerir que XP/nível
mudam o cronograma ou que a pessoa pode "adiantar/atrasar" cards manualmente daqui.

### 6. Fluxo
Entrar → ver o chamado do dia + decks → iniciar revisão **ou** abrir um deck **ou** (vazio) ir explorar.

### 7. Estados
Carregando; populado; **próprios vazio** (saída para explorar); **inscritos vazio** (saída para
explorar); deck com pendências vs em dia (selo de status — sem depender só de cor); **degradação
silenciosa** se uma origem de dados falha (mostrar o que veio, sem quebrar). Mobile e desktop, claro
e escuro.

### 8. Restrições
A ação do dia alcançável de imediato; um toque para entrar num deck; estados vazios sempre oferecem saída.

---

## Tela 5 — Explorar biblioteca (`/explore`)

### 1. Propósito
Descobrir e navegar a biblioteca curada de decks públicos.

### 2. Informação visível
Uma coleção de decks públicos (fixtures: deck real "Hábitos Atômicos" + biblioteca representativa),
cada um com nome, descrição (pode truncar), autor e contagens (cards, inscritos). Busca e categorias
**são reais** (decisão do operador). Vazio: ver fixtures.

### 3. O que a pessoa precisa fazer
Encontrar um deck de interesse — por **busca textual**, por **filtro de categoria**, ou rolando — e abri-lo.

### 4. Modelo de interação
- **Busca textual** filtra a coleção conforme se digita (cadência rápida, sub-segundo); **filtro por
  categoria** restringe por tema (calibração: ~6 categorias temáticas + "tudo"); ambos combináveis.
- **Carregar mais** traz o próximo lote sob demanda (paginação real; calibração de lote a definir por
  você dentro de "alguns por vez").
- Abrir um deck leva ao detalhe público. Densidade da coleção **diverge por porte de tela** (rica no
  desktop, compacta no mobile).

### 5. Filosofia / guardrails
Descoberta é **navegação pública**; nada aqui altera o cronograma de ninguém. A ordenação/curadoria da
biblioteca é decisão do produto, não um controle do usuário. **Proibido** expor respostas (verso) de
cards públicos nesta listagem.

### 6. Fluxo
Entrar → buscar/filtrar/rolar → abrir um deck.

### 7. Estados
Carregando; populado; **vazio** (sem decks públicos); **busca sem resultado**; **carregando mais**;
**erro de carga** (hoje cai em branco — defina um estado de erro explícito). Mobile e desktop, claro e escuro.

### 8. Restrições
Busca responde rápido; rolar é fluido; abrir um deck é um toque.

---

## Tela 6 — Detalhe de deck público (`/explore/[slug]`)

### 1. Propósito
Mostrar um deck público em detalhe e permitir **inscrever-se** / **cancelar inscrição**.

### 2. Informação visível
Nome, autor, descrição, temas, contagens (cards, inscritos — com plural correto) e uma **prévia** com
**apenas as frentes** de alguns cards (fixtures `sample_cards`). A ação principal varia conforme já
inscrito ou não.

### 3. O que a pessoa precisa fazer
Avaliar o deck pela prévia e **inscrever-se** (ou **cancelar** se já segue).

### 4. Modelo de interação
- A ação de inscrição é **otimista e instantânea** (a contagem de inscritos reflete na hora); cancelar
  é a reversão direta, igualmente imediata.
- Voltar retorna à origem da navegação.
- A prévia expõe **só a frente** dos cards — o suficiente para julgar o deck sem entregar as respostas.

### 5. Filosofia / guardrails
Inscrever-se **não** começa a agendar nada de imediato; o FSRS materializa o estado do card na
**primeira revisão**, decisão do sistema. **Proibido** mostrar o verso dos cards na prévia pública;
**proibido** expor qualquer parâmetro de agendamento aqui.

### 6. Fluxo
Abrir → ler detalhe + prévia → inscrever-se (ou cancelar) → seguir para revisar/voltar.

### 7. Estados
Carregando; populado **não inscrito**; populado **inscrito**; **agindo** (inscrição em curso, ação
ocupada); **não encontrado** (hoje cai em branco — defina um estado explícito). Seções condicionais
(sem descrição / sem temas / sem prévia). Mobile e desktop, claro e escuro.

### 8. Restrições
Decisão de inscrição em um toque e reversível; prévia honesta, sem vazar respostas.

---

## Tela 7 — Gerenciar deck próprio (`/decks/[id]`)

### 1. Propósito
Gerenciar um deck do próprio usuário: revisar, compartilhar publicamente, copiar o link, ou excluir.

### 2. Informação visível
Nome, descrição, temas, contagem de cards e quantos estão pendentes hoje; o estado de **público/
privado**; e, quando público, o **link de compartilhamento**. Confirmação destrutiva: ver fixtures.

### 3. O que a pessoa precisa fazer
Iniciar a revisão deste deck; alternar visibilidade pública; copiar o link; ou excluir o deck.

### 4. Modelo de interação
- **Revisar este deck** leva ao ritual já filtrado por este deck.
- **Tornar público/privado** é um alternar reversível com estado **em transição** (ocupado durante a troca).
- **Copiar o link** é instantâneo, com **confirmação efêmera** de que copiou.
- **Excluir** é **destrutivo e irreversível** → exige **confirmação explícita** em uma etapa
  intermediária antes de efetivar; durante a exclusão, a ação fica ocupada.

### 5. Filosofia / guardrails
Tornar público **expõe o conteúdo do deck a terceiros** — decisão consciente do dono; deixe o efeito
claro. A exclusão **apaga cards e todo o histórico de revisão e não pode ser desfeita**: **proibido**
excluir sem confirmação; **proibido** tornar público sem que o usuário perceba que está publicando.

### 6. Fluxo
Abrir → revisar / alternar visibilidade / copiar link / excluir (→ confirmar → efetivar → sair).

### 7. Estados
Carregando; populado; público **ligado** (com link) vs **desligado**; alternando (ocupado);
confirmação de exclusão; excluindo (ocupado); link copiado (confirmação efêmera); não encontrado.
Mobile e desktop, claro e escuro.

### 8. Restrições
Ação destrutiva sempre confirmada; efeito de "tornar público" inequívoco; copiar dá retorno imediato.

---

## Tela 8 — Dashboard de progresso (`/progress`)

### 1. Propósito
Dar ao usuário uma leitura do próprio aprendizado: retenção, sequência, esforço diário, composição do
conhecimento, histórico de atividade e previsão de volume.

### 2. Informação visível
Retenção de longo prazo (um valor 0–100%), a sequência atual e o recorde, o progresso do dia, a
composição do conhecimento (maduros / jovens / lapsos), o histórico de atividade ao longo do tempo, e
a previsão de volume (amanhã / próximos 7 dias). Saudação por hora do dia. **Use os três estados de
estatística das fixtures — incluindo o estado real de conta nova (tudo zerado / dados insuficientes).**

### 3. O que a pessoa precisa fazer
**Apenas ler** — entender como vai indo. Não há ação que saia desta tela.

### 4. Modelo de interação
- Tela **somente leitura**: sem gatilhos de navegação para fora.
- A saudação varia por **faixa do dia** (manhã / tarde / noite).
- O histórico de atividade tem densidade **divergente por porte de tela** (calibração: ~20 semanas no
  desktop, ~4 no mobile) — banda: "uma janela longa no desktop, recente no mobile".
- A consistência semanal cobre os **últimos 7 dias**; a previsão resume **amanhã** e a soma de **7 dias**.
- Cada bloco de dado **carrega de forma independente** (um pode estar pronto enquanto outro ainda
  busca), degradando sem quebrar a tela.

### 5. Filosofia / guardrails
Tudo aqui é **observação**, não controle: a **meta de retenção** e o agendamento são do **sistema** e
**não** são alavancas que o usuário ajusta. **Proibido** transformar qualquer métrica (retenção,
intervalos) em um controle editável; **proibido** expor parâmetros internos do FSRS como ajustáveis.

### 6. Fluxo
Entrar → ler os indicadores (que chegam progressivamente) → sair pela navegação.

### 7. Estados
Carregando (geral e por bloco); **conta nova / vazio** (tudo zerado, "dados insuficientes para
tendência", histórico/previsão vazios); populado; tendência presente vs ausente; sequência ativa vs
inativa (sem depender só de cor); precisão indisponível. Mobile e desktop, claro e escuro.
**A resolver (divergência):** hoje a Progresso está no menu lateral do desktop mas **ausente** da
navegação primária do mobile — alcançável só por URL. Recomendação: torná-la alcançável no mobile;
tratar como decisão de produto, não default silencioso.

### 8. Restrições
Legível num relance; nenhuma métrica deve sugerir interatividade que não existe (é leitura).

---

## Tela 9 — Perfil (`/profile`)

### 1. Propósito
Identidade do usuário, alguns indicadores de cabeçalho, gerência do **token de API (MCP)** e sair.

### 2. Informação visível
Nome e e-mail; sequência (atual + recorde), revisados hoje, quantidade de decks; o **token MCP**
quando gerado; e a saída. Avisos do token e rótulos: ver fixtures.

### 3. O que a pessoa precisa fazer
Conferir a própria conta; **gerar/copiar** um token MCP; ou **sair**.

### 4. Modelo de interação
- **Gerar token** produz um segredo exibido **uma única vez**; **copiar** é instantâneo com
  **confirmação efêmera** (calibração: ~2 s); **gerar novo** substitui o anterior (revogando-o).
- **Sair** encerra a sessão e leva ao login.

### 5. Filosofia / guardrails
**Segurança:** o token é um **segredo mostrado uma só vez** — deixe claro que não será reexibido e que
gerar um novo invalida o anterior. **Proibido** reexibir um token antigo ou sugerir que ele pode ser
recuperado depois.

### 6. Fluxo
Abrir → conferir conta → (opcional) gerar e copiar token → (opcional) sair.

### 7. Estados
Carregando; populado; **sem token ainda** (só a ação de gerar); **gerando** (ocupado); **token
presente** (segredo + copiar; ação vira "gerar novo"); **copiado** (confirmação efêmera). Mobile e
desktop, claro e escuro.

### 8. Restrições
O segredo é tratado como sensível (mostrado uma vez, copiável); sair é inequívoco.

---

## Auditoria de omissão (R3) — verificada por tela antes de fechar
Para cada tela acima foi perguntado: *"se eu omitir este parâmetro (tempo, contagem, tamanho,
modalidade, o que fica oculto), um agente razoável preencheria com algo que contradiz o produto?"* —
onde sim, o parâmetro foi declarado (ex.: a inferência Good/Easy na Revisão; a mensagem de erro
genérica no Login; a confirmação destrutiva em Gerenciar deck; o token exibido uma vez no Perfil; o
agendamento oculto em todas). O silêncio permanece **apenas** sobre forma visual.

# ============ 02 · FIXTURES ============

# Fixtures reais + lane de copy (pareie com "Informação visível" de cada tela)

> **Procedência (R8).** Não há banco de dados de desenvolvimento provisionado. O conteúdo **real**
> do repositório é o export Kindle de ***Hábitos Atômicos* (James Clear)** — `tests/fixtures/
> kindle-habitos-atomicos.html`, **123 destaques reais** em português — somado a pares de card
> reais em testes e às **regras de formato de card** do validador. Os cards abaixo foram
> **transformados a partir de destaques reais do livro** respeitando o validador (frente = 1–3
> frases, **pergunta, nunca sim/não**; verso = 2–5 frases; sem markdown/bullets/emoji). Itens
> marcados **[representativo]** são metadados de biblioteca sem fonte real no repo (existe só um
> livro real) — sinalizados, não passados como reais.
>
> **Textura é dado.** Observe a densidade real: respostas têm 2–4 frases (não one-liners), o
> português usa travessões `—`, e — crucialmente — **a conta recém-criada do Lekto nasce vazia**
> (o seeder cria 2 usuários e **zero decks/zero cards**). Por isso os estados **vazio / primeira
> vez** são reais e de primeira classe, não decoração.

## Regras de formato de card (do `FlashcardValidator` — restrição real)

- **Frente:** 1 a 3 frases; é uma **pergunta**; **proibido** pergunta de sim/não.
- **Verso:** 2 a 5 frases.
- **Proibido** em ambos: markdown, títulos (`#`), bullets (`•`), emojis.
- `timer_seconds` por card = `clamp(4 + palavras_do_verso × 0.6, 5, 15)` → **5 a 15 s**, cresce com
  o tamanho do verso. (Calibração atual; a banda — "da ordem de segundos" — é o que vincula.)

---

## Deck real — "Hábitos Atômicos" (fonte: export Kindle real)

Metadados (campos reais do modelo `Deck`): `name: "Hábitos Atômicos"`, `domain: pessoal`,
`format: livro (book)`, `level: iniciante`, `content_language: pt-BR`, `owner_name: "Henry"`.

### Cards (transformados de destaques reais — set state-aware com linhas de borda)

1. **frente:** "O que acontece se você melhorar 1% a cada dia durante um ano?"
   **verso:** "Você termina cerca de 37 vezes melhor do que começou. Se piorar 1% ao dia, declina
   quase a zero. Pequenas escolhas diárias se compõem em resultados enormes ao longo do tempo."
   *(verso longo → timer perto do teto, ~12–15 s)*

2. **frente:** "Por que se diz que hábitos são os juros compostos do autoaperfeiçoamento?"
   **verso:** "Porque, assim como o dinheiro rende com juros compostos, os efeitos dos hábitos se
   multiplicam quando você os repete. Mudanças que parecem pequenas no início trazem resultados
   notáveis se você persistir nelas por anos."

3. **frente:** "O que significa dizer que seus resultados são uma 'mensuração tardia' dos seus hábitos?"
   **verso:** "Significa que o que você colhe hoje reflete hábitos passados: seu peso reflete
   hábitos alimentares; seu conhecimento, hábitos de aprendizado; seu patrimônio, hábitos
   financeiros. Você colhe o que planta e cultiva."

4. **frente:** "Quais são os quatro passos que formam o ciclo de um hábito?"
   **verso:** "Estímulo, desejo, resposta e recompensa. O estímulo dispara o comportamento, o
   desejo é a motivação, a resposta é o hábito em si e a recompensa é o benefício que reforça o ciclo."

5. **frente:** "Devemos nos preocupar mais com a trajetória atual ou com os resultados atuais?"
   **verso:** "Com a trajetória. Os resultados de hoje importam menos do que a direção para onde
   seus hábitos estão levando você."
   *(verso curto, 2 frases → linha de borda: timer perto do piso, ~5–6 s)*

6. **frente:** "Como o tempo age sobre os bons e os maus hábitos?"
   **verso:** "O tempo amplia a margem entre sucesso e fracasso, multiplicando aquilo que você
   cultiva. Bons hábitos transformam o tempo em aliado; maus hábitos o tornam seu inimigo."

7. **frente:** "O que define um hábito?"
   **verso:** "É uma rotina ou comportamento realizado regularmente e, em muitos casos, de modo
   automático. A repetição torna a ação cada vez mais inconsciente ao longo do tempo."

8. **frente:** "Por que hábitos importam mais que metas?" *(par real do onboarding/validador)*
   **verso:** "Porque sistemas determinam o progresso, enquanto metas só definem a direção. Você
   não se eleva ao nível de suas metas; você cai ao nível de seus sistemas."

**Linhas de borda incluídas de propósito:** card 1 (verso no teto de tamanho → timer máximo),
card 5 (verso mínimo de 2 frases → timer mínimo). **Frente mais longa:** card 3.
**Cardinalidade real do deck no repo:** uma micro-sessão é de **~10 cards**; o cap diário é **50**.

### `sample_cards` (preview pública — só a frente é exposta)

`[{front: "O que acontece se você melhorar 1% a cada dia durante um ano?"},
{front: "Quais são os quatro passos que formam o ciclo de um hábito?"},
{front: "O que define um hábito?"}]`

---

## Biblioteca de Explorar (cardinalidade > 1)

O deck **"Hábitos Atômicos"** acima é real. Os demais são **[representativo]** (metadados plausíveis
nos domínios reais do enum `DeckDomain`; sem conteúdo de card real no repo):

| name | domain | tags | cards_count | owner_name | subscribers_count | descrição (copy mutável) |
|------|--------|------|-------------|------------|-------------------|--------------------------|
| Hábitos Atômicos | pessoal | ["Hábitos","Produtividade"] | 8 | Henry | 1 | *(real)* "Os princípios centrais de James Clear sobre construir bons hábitos." |
| Vocabulário N5 de Japonês `[representativo]` | idiomas | ["Idiomas","Japonês"] | 120 | Aurélio | 34 | "Os primeiros kanji e palavras para o JLPT N5." |
| Direito Constitucional `[representativo]` | exames | ["Concurso","Direito"] | 240 | Aurélio | 56 | "Artigos essenciais e jurisprudência para concursos." |
| Fundamentos de UX `[representativo]` | artes/design | ["Design","UX"] | 42 | Henry | 12 | "Leis de usabilidade e heurísticas aplicadas." |

**Linha de borda:** deck com `description: null` e `tags: null` (a capa cai no ícone/gradiente
padrão; o rótulo de categoria some). **Estado vazio real:** biblioteca sem decks públicos →
*"Nenhum deck público disponível ainda."*

---

## Estados de estatística (tela de Progresso / Início / Perfil)

Campos reais do endpoint `/stats`. Três estados — e o **vazio é o real de uma conta nova**:

### A) Conta nova / fria (estado real do seeder — primeira classe)

`current_streak: 0`, `longest_streak: 0`, `reviewed_today: 0`, `total_due: 0`,
`average_retention: null`, `accuracy_today: null`, `mature_cards: 0`, `young_cards: 0`,
`lapse_cards: 0`, `focus_time_today_ms: 0`, `total_reviews: 0`. Heatmap **vazio**; forecast **vazio**;
retenção → *"Dados insuficientes para tendência"*; sequência → *"Inativo"*.

### B) Conta em progresso `[representativo]`

`current_streak: 5`, `longest_streak: 12`, `reviewed_today: 8`, `total_due: 14`,
`average_retention: 0.78`, `accuracy_today: 0.86`, `mature_cards: 23`, `young_cards: 41`,
`lapse_cards: 3`, `focus_time_today_ms: 480000` (→ "8m"), `total_reviews: 312`.

### C) Conta madura `[representativo]` (linha de borda: números grandes, pt-BR)

`current_streak: 1`, `longest_streak: 167`, `reviewed_today: 50`, `total_due: 50`,
`average_retention: 0.91`, `accuracy_today: 0.94`, `mature_cards: 1.240`, `young_cards: 88`,
`lapse_cards: 12`, `focus_time_today_ms: 5400000` (→ "1h 30m"), `total_reviews: 9.870`.

### Heatmap (`/stats/heatmap`) — `Array<{date, count}>` `[representativo]`

Distribuição realista: maioria dos dias 0–4 revisões, alguns picos de 30–50, lacunas (dias 0).
Desktop = 20 semanas; mobile = 4 semanas. Linha de borda: hoje com count alto (50) e ontem 0.

### Forecast (`/stats/forecast`) — `Array<{date, count}>` `[representativo]`

`[{amanhã: 12}, {+2: 9}, {+3: 22}, {+4: 4}, {+5: 0}, {+6: 15}, {+7: 7}]` → "Amanhã" = 12; "7 Dias" = soma.

### Retenção (`/stats/retention`) — `Array<{days_ago, total, retention}>` `[representativo]`

`[{days_ago: 7, total: 60, retention: 0.82}, {days_ago: 30, total: 210, retention: 0.79}]`
→ tendência "+3,0% vs últimos 30 dias". Linha de borda: bucket com `retention: null` → "Dados insuficientes".

---

## Lane de `copy (mutável)` — textura real, palavras editáveis pelo agente

> Mineradas do app **como textura** (tom, brevidade, voz pt-BR). **O agente PODE reescrever as
> palavras.** O que vincula é o **ato de fala** (descrito no bloco de Interação de cada tela), não a string.

- **Landing:** H1 *"Nunca esqueça o que você escolheu aprender"*; subtítulo cita *"algoritmo FSRS-6"*,
  *"18 regras cognitivas"*, *"revisões mobile em 3 gestos"*; diferenciais *"FSRS-6 vs SM-2"*,
  *"3 Ratings vs Binário"*, *"18 Regras vs Cópia"*; CTAs *"Garantir acesso"* / *"Quero ser notificado"*;
  sucesso *"Você está na lista. Avisaremos quando o Lekto estiver pronto."*; etimologia λεκτός.
- **Login:** *"ENTRAR"*, placeholders *"Email"* / *"Senha"*, erro genérico *"Credenciais inválidas"*,
  link *"Ainda não tem acesso?"* / *"Entrar na lista de espera"*.
- **Início:** banner *"Pronto para hoje?"* / *"Você tem {N} cards para revisar hoje."* /
  *"Sequência: {N} dias"* / CTA *"Iniciar Revisão"*; seções *"Meus Decks"*, *"Inscritos"*;
  vazio *"Nenhum deck criado"* / *"Crie seu primeiro deck ou explore a comunidade…"*.
- **Revisão:** countdown *"Prepare-se"* → 3 / 2 / 1 / *"Vai!"*; rótulos de gesto *"Errei"* / *"Quase"* /
  *"Lembrei"*; verso *"Toque para revelar"*; fim *"Session complete!"* / *"{N} cards reviewed"*
  (hoje em inglês — textura a corrigir para pt-BR pelo agente); onboarding 3 passos
  *"Leia e tente lembrar"* / *"Revele a resposta"* / *"Avalie deslizando"*.
- **Explorar:** *"Explorar"* / *"Descubra novos horizontes…"*; busca *"Buscar baralhos, temas ou
  autores..."*; categorias *Design · Programação · Psicologia · Idiomas · Marketing · Finanças*;
  detalhe *"Inscrever-se"* / *"Cancelar inscrição"* / *"{N} cards · {N} inscrito(s)"*.
- **Gerenciar deck:** *"Revisar este deck"*, *"Tornar público"*, *"Copiar"*, *"Excluir deck"*;
  confirmação *"Excluir deck?"* / *"Todos os cards e dados de revisão serão perdidos. Esta ação não
  pode ser desfeita."*.
- **Progresso:** *"Dashboard de Progresso"*, *"{saudação}, {nome}."*, *"Retenção de Longo Prazo"*,
  qualidades *"Excelente"* / *"Bom"* / *"Em progresso"*; *"Histórico de Atividade (20 Semanas)"*.
  (Títulos hoje em inglês — *"Streak details"*, *"Today stats"*, *"Knowledge breakdown"*,
  *"Consistency"* — textura a unificar em pt-BR pelo agente.)
- **Perfil:** *"{N}"* / *"dias seguidos"* / *"recorde: {N}"*; *"Token da API (MCP)"* / *"Este token
  não será exibido novamente…"* / *"Copiar"* → *"Copiado!"*; *"Sair"*.
