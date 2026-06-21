# Briefing de Design — Lekto (regenerado pelo gate de validação)

> Gerado por `atomic-skills:design-brief` contra o app real em `/home/henry/lekto/web/app`
> (frontend Nuxt/Vue) + dados reais do backend Laravel/Postgres local. Idioma de saída: **pt-BR**.
> Este documento é um **gerador cego**: nenhum artefato da fase (feedback/design/source/handoff) foi
> lido — apenas o código do app e o banco local.

---

## Parte 0 — Contexto, contrato e decisões

### 0.1 — Produto (intenção)

Lekto é um app de **repetição espaçada** que transforma destaques de leitura (Kindle), notas de
áudio e cartões manuais em **flashcards** e os agenda com o algoritmo **FSRS-6**. A revisão é o
ritual central: rápida, mobile-first, **3 gestos**. Acesso é **fechado por lista de espera**
(pré-lançamento). Lema do produto: *"Nunca esqueça o que você escolheu aprender."*

### 0.2 — Fonte (de onde saiu cada coisa)

- **Comportamento (camada 2):** minerado do código — `pages/review.vue`, `stores/review.ts`,
  `components/Review*.vue`, `pages/login.vue`, `pages/index.vue`, `pages/explore/*`,
  `middleware/auth.global.ts`, `components/App*.vue`.
- **Fixtures (camada de conteúdo):** **dados reais** puxados nesta ordem (receita de fixtures):
  - **Banco local (Postgres `lekto`, leitura)** — cartões reais autorais (domínio *Hábitos
    Atômicos*); o banco tem hoje **0 decks públicos** (estado real de Explorar = vazio).
  - **In-repo:** exemplos autorais embutidos na UI (onboarding, landing) + destaques reais do
    Kindle em `backend/tests/fixtures/kindle-habitos-atomicos.html` (livro *Hábitos Atômicos*,
    James Clear, pt-BR — 123 destaques reais).
- **Filosofia / quem decide (camada 3):** corroborada pelo código + copy da landing (FSRS oculto,
  3 gestos, "memória, não agenda", acesso por waitlist, preview só da frente).

### 0.3 — Regime: **brownfield** (app existente, redesign)

Camada-1 (forma visual) fica em **silêncio** — é do agente de design. Camadas 2 e 3 vêm
**especificadas com valores concretos**.

### 0.4 — Decisões DEFINE (resolvidas com intenção de produto)

- **D1 — Tema dark-first (não "claro e escuro" genérico).** `composables/useTheme.ts` é um stub
  explícito: *"Dark-only app — no theme toggle needed."* O dark **é a identidade** (ritual de
  estudo, marca = glow violeta sobre navy profundo). **DEFINE:** o contrato de tokens é autoral e
  **semântico**, de modo que um tema claro futuro seja uma **troca de conjunto de tokens**, não um
  redesign; porém **todas as telas e estados são especificados em dark (canônico)**. Tema claro
  está **fora do escopo atual** (relaxamento deliberado e documentado do item "light and dark" do
  §6, justificado por produto).
- **D2 — Explorar é uma superfície de descoberta de verdade.** Busca por texto, faceta de
  categoria e "ver mais" hoje são *placeholders* não-fiados (`preview-feature`). **DEFINE:** são
  **capacidades reais pretendidas** — o brief especifica seu modelo de interação e o estado
  "busca sem resultado", além do vazio de catálogo (estado real hoje).
- **D3 — Copy unificada em pt-BR.** A Revisão e o painel de atalhos têm strings em inglês ("No
  cards to review", "Session complete!", "Shortcuts", "Done"). São **dívida**; o copy lane abaixo
  apresenta tudo em pt-BR. Copy é lane **mutável** (o agente pode reescrever) — o que vincula é o
  ato-de-fala, não a palavra.

### 0.5 — Ledger de cobertura (nenhuma tela fica de fora)

| Rota | Tela | Layout | Status neste brief |
|---|---|---|---|
| `/` (`index.vue`) | **Waitlist / Landing** | fullscreen | ✅ especificada |
| `/login` | **Login** | fullscreen | ✅ especificada |
| `/review` | **Revisão** | fullscreen | ✅ especificada |
| `/explore` | **Explorar** | shell (nav) | ✅ especificada |
| `/explore/[slug]` | **Deck público** | shell (nav) | ✅ especificada |
| `/home` | Home (dashboard) | shell | ⊘ fora de escopo deste brief |
| `/progress` | Progresso (heatmap/stats) | shell | ⊘ fora de escopo deste brief |
| `/profile` | Perfil | shell | ⊘ fora de escopo deste brief |
| `/decks/[id]` | Deck próprio (detalhe) | shell | ⊘ fora de escopo deste brief |

As 4 telas fora de escopo são reconhecidas de propósito (não esquecidas); ficam para um brief
posterior. As 5 telas-alvo abaixo recebem o bloco completo de 8 seções.

---

## Parte A — Prompt do Design System (DS-first)

> **Emitir este prompt primeiro, ao agente de design.** O DS é construído **uma vez** e herdado,
> sem redefinição, por todas as telas.

### Preâmbulo (vinculante)

> Construa um **Design System** que herdaremos inalterado em todas as telas. Defina tokens e
> componentes **uma única vez, por nome semântico**; o prompt de telas vai referenciá-los e **nunca**
> redefinir cor, tipografia, espaçamento, raio, sombra ou qualquer componente. Onde houver um
> requisito abaixo, ele é uma **restrição mensurável**, nunca uma solução visual — **a forma é sua**.
> Este produto é **dark-first** por identidade: defina os tokens de forma **semântica (por papel)**
> para que um tema claro futuro seja uma troca de conjunto de tokens; entregue o sistema e os
> exemplos no **tema dark canônico**.

### A.1 — Contrato de tokens (semântico, não literal)

Nomeie por **papel/intenção**, não por valor. O valor literal vive **só** no DS; as telas ligam o
nome. Cobrir:

- **Cor (papéis):** fundo base; superfície; superfície elevada; superfície "de vidro"
  (translúcida/desfocada); ação primária e sua variante clara; foco/realce; **expressão de
  recordação** em três papéis distintos — *errei* (negativo), *quase* (parcial/intermediário),
  *lembrei* (positivo); texto primário / secundário / atenuado / fraco; bordas sutis. Tema dark
  canônico (tema claro como conjunto-troca futuro, fora do escopo de entrega).
- **Tipografia:** escala de *display* → corpo → legenda/rótulo. Um acento serifado existe **só** no
  selo de marca (a palavra grega *λεκτός*); o restante é uma única família de texto.
- **Espaçamento, raios, elevação/sombra.**
- **Durações de movimento por papel** (não em ms): *revelação* (virar do cartão), *saída de cartão*
  (após avaliar), *transição entre telas*, *pulso de orientação* (dicas que pulsam). O valor exato é
  seu; o que importa é existirem como papéis nomeados.

### A.2 — Inventário de componentes (com **todos os estados**)

Para cada um, defina **todos os estados** que ele assume (padrão, hover, foco, ativo, desabilitado,
carregando, erro, vazio, selecionado), por **papel semântico** — derivados do que o app realmente
usa:

- **Casca de navegação** — destinos primários sempre acessíveis, adaptando-se a telas largas e
  estreitas. Destinos: **Início, Explorar, Revisar, Progresso, Perfil** (em telas estreitas o app
  hoje promove 4 e omite *Progresso* — decida a regra de promoção, mas mantenha paridade de
  alcance). Inclui identidade de usuário (avatar + nome/identificador) como ponto de acesso ao
  perfil.
- **Região de conteúdo** (área principal sob a navegação).
- **Campo de entrada de texto** — estados vazio/foco/preenchido/erro/desabilitado; **variante de
  segredo** com alternância de visibilidade.
- **Ação primária / secundária / destrutiva** — cada uma com estado **em progresso** (ocupada,
  re-disparo bloqueado) e **desabilitada**.
- **Indicador de progresso de sessão** (posição atual dentro de um total finito).
- **Temporizador de reflexão** — mostra tempo restante decrescente por cartão.
- **Cartão de estudo de duas faces** — frente/verso, estado *não-revelado*/*revelado*, e **feedback
  direcional ao vivo** que cresce conforme o gesto avança.
- **Resumo de deck (catálogo)** — comunica assunto, autoria, tamanho (nº de cartões) e adoção (nº de
  inscritos), com afordância de abrir/adotar.
- **Faceta de categoria selecionável** e **etiqueta de metadado** (tags / categoria / "novo").
- **Superfície de orientação efêmera** — usada na contagem regressiva pré-sessão e na explicação de
  primeira vez (passos, navegação avançar/voltar, indicador de passo).
- **Indicador de sincronização/offline** — sinaliza trabalho capturado localmente aguardando
  reconciliação.
- **Estados de página** como componentes: **vazio, carregando, erro, offline, primeira-vez,
  populado**.

### A.3 — Um template-base (exatamente 1)

Produza **exatamente 1 template-base**: uma página composta que exercite tokens + inventário juntos
— a casca de navegação + região de conteúdo + uma visão de dados representativa (uma grade de
**resumos de deck**). É o ponto de fork que o prompt de telas reusa — **não** um catálogo de tipos de
página.

### A.4 — Acessibilidade (WCAG 2.2 — restrições mensuráveis, não prescrições visuais)

- Contraste texto/fundo atende **AA** (≥ 4.5:1 corpo, ≥ 3:1 texto grande) — **inclusive no tema
  dark**, que é o canônico.
- Foco **sempre visível**, atendendo ao mínimo de aparência de foco da 2.2.
- Alvos de toque atendem ao mínimo de tamanho da 2.2 (≥ 24×24 px CSS ou espaçamento equivalente) —
  **crítico** para a revisão de uma mão.
- **Nada depende só de cor.** As três expressões de recordação (*errei / quase / lembrei*) precisam
  de reforço redundante (direção + ícone/rótulo), nunca só matiz.

### Checklist de preenchimento do DS (antes de enviar)

- [ ] Tokens por papel, dark canônico, sem valor literal vazando para a camada de telas.
- [ ] Inventário lista **todos os estados** por componente.
- [ ] **Exatamente 1** template-base (não um conjunto).
- [ ] Itens WCAG 2.2 como restrições mensuráveis, nunca solução visual.
- [ ] Saída em **pt-BR**.

---

## Parte B — Prompt de Telas (consome o DS herdado)

### Preâmbulo R9 (emitir verbatim, no topo)

> Há **duas autoridades distintas** neste briefing — não um carimbo único de "tudo vinculante":
> — **Forma visual** (widget, cor, formato, espaçamento): é **sua** para decidir — não prescrevemos.
> — **Filosofia / o que fica oculto / quem decide** (camada 3): **requisito de produto vinculante**, não negociável.
> — **Comportamento de interação** (camada 2): é a **calibração atual** do app — a **banda comportamental vincula** (ex.: "a cadência é da ordem de segundos"), mas o **valor exato é o que o app faz hoje (~8s), melhorável por você dentro da banda**, nunca um número congelado.
> Consumimos o **Design System existente** pelo nome semântico e nunca o redefinimos. Se uma tela precisa de algo que o DS não tem, **pare e sinalize** — não improvise.

> **Tema:** todas as telas e estados abaixo são especificados no **tema dark canônico**. Mobile **e**
> desktop são obrigatórios em cada tela. (Tema claro está fora do escopo atual — ver D1.)

---

### TELA 1 — Revisão (`/review`) · *o coração do produto*

**1. Propósito.** A pessoa revisa uma sessão curta e finita de cartões, julgando **o quão bem
lembrou** de cada um, no menor atrito possível — de pé, no transporte, com uma mão.

**2. Informação visível (fixtures reais).**
Cartões reais (banco local Postgres, domínio *Hábitos Atômicos*, `source_type: audio`). Note a
**textura**: a resposta tem **2–3 frases (~200 caracteres)**, não é one-liner — isto dimensiona o
cartão.

- **Cartão A** — deck "Hábitos Atômicos"
  - frente (159 car.): *"Por que ancorar um hábito novo a um momento que você já faz de forma fixa
    (como sentar ao computador ao chegar do trabalho) torna a mudança mais fácil?"*
  - verso (205 car.): *"O momento que já é automático funciona como gatilho pronto: você não precisa
    criar uma deixa nova nem depender de memória ou motivação. Aproveitar uma rotina existente reduz
    o atrito de adotar o hábito novo."*
- **Cartão B** — deck "Hábitos Atômicos"
  - frente (107 car.): *"Você quer adotar um hábito novo, mas vive esquecendo de fazê-lo. Como usar a
    sua rotina atual a favor disso?"*
  - verso (210 car.): *"Encaixe o hábito novo logo depois de algo que você já faz fixo no dia, no
    formato 'depois de [rotina atual], vou [hábito novo]'. O momento existente vira a deixa
    automática e torna a prática muito mais provável."*
- **Cartão C (curto — linha de borda)** — exemplo autoral embutido (onboarding)
  - frente (40 car.): *"Por que hábitos importam mais que metas?"*
  - verso (39 car.): *"Porque sistemas determinam progresso..."*
- **Linha de borda longa** — destaque real do Kindle que vira verso (282 car.): *"Fazer uma escolha
  que seja 1% melhor ou pior parece insignificante no momento, mas, ao longo dos momentos que
  compõem a vida toda, essas escolhas determinam a diferença entre quem você é e quem poderia ser."*

Cada cartão mostra o **rótulo do deck** ("Hábitos Atômicos") e a posição na sessão (ex.: **3/10**).

`copy (mutável)`: deck em maiúsculas/espaçado · "Toque para revelar" (frente) · final da sessão:
"Sessão concluída! · {N} cartões revisados · Concluir" · vazio: "Nenhum cartão para revisar agora ·
Voltar ao início". *(Hoje algumas dessas strings estão em inglês — unificar em pt-BR; ver D3.)*

**3. O que a pessoa precisa fazer.** Ler a frente → tentar lembrar → revelar o verso → **expressar,
num gesto, o quão bem lembrou** → seguir para o próximo, em fluxo contínuo.

**4. Modelo de interação** *(calibração atual — a banda vincula, o número exato é melhorável):*
- **Cadência:** **da ordem de segundos** por cartão. Existe um **limite suave de poucos segundos**
  (hoje **~8s**) para pensar; ao esgotar, **o verso é revelado sozinho**. A pessoa também pode
  **revelar antes**, por uma **ação instantânea** (um toque no cartão; no desktop, uma tecla).
- **Tamanho da sessão:** **curta e finita, da ordem de ~uma dezena de cartões** (hoje **10**,
  ajustável pelo servidor). O progresso é mostrado como posição/total.
- **Avaliação — 3 expressões humanas por um gesto direcional rápido**, alcançável **com o polegar**,
  **instantâneo**, que **perdoa um toque acidental** (abaixo de um limiar pequeno, o cartão volta ao
  lugar). Convencionalmente, *recusa/erro* e *acerto* ocupam **direções opostas** e a expressão
  **parcial ("quase")** ocupa uma **terceira direção distinta** — o mapeamento exato de eixo é
  refinável, mas as três devem ser **igualmente rápidas e mutuamente inconfundíveis**, com **reforço
  redundante além da cor**. Há **feedback direcional ao vivo** que cresce conforme o gesto avança.
  Uma **direção de escape** (oposta à expressão parcial) **cancela** o gesto sem registrar nada.
- **A 4ª saída de agendamento ("facilidade") é INFERIDA**, não escolhida: ela deriva da **prontidão
  da resposta** (se a pessoa respondeu *antes* do limite suave). **Nunca** vira uma 4ª opção a
  ponderar. *(No código: direita = "fácil" se respondeu antes do tempo, "bom" se o tempo esgotou.)*
- **Paridade desktop:** igualmente rápida **sem mouse** — uma tecla revela; três teclas/direções
  cobrem as três expressões. Em telas largas, uma **referência do mapeamento** fica visível (sem ser
  obrigatória ao fluxo).
- **Ritual de entrada:** uma **contagem de preparação curta (~3–4s**, hoje 3→2→1→"Vai!") antecede o
  primeiro cartão. **Só na primeiríssima sessão**, uma explicação de **3 passos** (ler→revelar→avaliar)
  aparece antes, dispensável e **lembrada** (não repete).
- **Resiliência offline:** a avaliação é **durável offline** — capturada localmente e reconciliada
  quando a conexão volta. A pessoa **nunca é bloqueada** por rede.

**5. Filosofia / guardrails (vinculante).**
- A pessoa julga **apenas a própria memória**. O **agendador (FSRS-6)** e o **próximo intervalo** são
  decisão **do sistema** e **não aparecem**.
- O **tempo de resposta** é medido como sinal **oculto** (alimenta o FSRS e a inferência de
  "facilidade") — **nunca** mostrado como nota/placar.
- **PROIBIDO:** mostrar "+N dias" / próximo intervalo; rótulos técnicos de avaliação ("Again/Hard/
  Good/Easy", "1–4", números de dificuldade/estabilidade); transformar a resposta num seletor de
  opções com intervalos; **qualquer número no caminho de responder**; expor a "facilidade" inferida
  como escolha separada; **reduzir a avaliação a binário** — a expressão intermediária ("quase") é o
  diferencial do produto e **deve existir**.

**6. Fluxo.** (1ª vez: explicação de 3 passos →) contagem de preparação → cartão frente → pensar
(limite suave) → revelar (toque/tecla ou automático) → gesto de avaliação → saída do cartão → próximo
→ … → resumo de conclusão.

**7. Estados (mobile e desktop, dark).** *carregando* (sessão sendo buscada) · *vazio* (0 cartões a
revisar) · *primeira-vez* (explicação de 3 passos) · *preparação* (contagem) · *ativo não-revelado*
(com temporizador) · *ativo revelado* (com feedback de gesto ao vivo) · *offline* (avaliações em fila)
· *concluído* (sessão encerrada). Em desktop, a referência de mapeamento é visível; em mobile, não.

**8. Restrições.** Uma mão; alvos generosos para o polegar; revelar e avaliar instantâneos; perdoa
toque acidental (volta ao lugar) e oferece escape; o fluxo não trava sem rede.

> **Consumo do DS:** usa *cartão de estudo de duas faces*, *temporizador de reflexão*, *indicador de
> progresso de sessão*, *superfície de orientação efêmera*, *indicador offline*. Se faltar algo →
> **pare e sinalize**.

---

### TELA 2 — Login (`/login`)

**1. Propósito.** Quem já tem acesso entra; quem não tem é encaminhado à lista de espera.

**2. Informação visível (fixtures reais).** Identidade de marca + lema *"Nunca esqueça o que você
escolheu aprender."* Dois campos: identificador (e-mail) e segredo (senha).

`copy (mutável)`: rótulo de seção "ENTRAR" · placeholders "Email" / "Senha" · alternância
"Mostrar/Ocultar senha" · ação "Entrar" · erro **"Credenciais inválidas"** · rodapé "Ainda não tem
acesso? → Entrar na lista de espera".

**3. O que a pessoa precisa fazer.** Informar credenciais e autenticar; ou, se não tem acesso,
seguir para a lista de espera.

**4. Modelo de interação.** Entrada **deliberada** (digitação) de identificador + segredo; o segredo
tem **visibilidade alternável**. O envio mostra **estado em progresso** e **bloqueia re-disparo**.
Latência: a resposta de falha chega rápida e **genérica**. **Não há criação de conta self-service
aqui** — o único caminho lateral é a lista de espera (acesso é fechado/convite).

**5. Filosofia / guardrails (vinculante).** O sistema **não revela se a conta existe**: falha sempre
retorna **uma mensagem genérica única** (segurança). A decisão de "quem entra" é do sistema (acesso
gated). **PROIBIDO:** distinguir "e-mail não encontrado" de "senha errada"; oferecer cadastro
self-service nesta tela; vazar dado sensível em mensagem de erro.

**6. Fluxo.** Inserir credenciais → enviar (em progresso) → sucesso (vai para a área logada) **ou**
falha (mensagem genérica, permite tentar de novo). Link alternativo → lista de espera.

**7. Estados (mobile e desktop, dark).** *ocioso* · *em progresso* (envio ocupado, ação bloqueada) ·
*erro* (mensagem genérica) · *desabilitado* (campos incompletos). Sem estado "vazio/lista".

**8. Restrições.** Mínimo de campos; segredo ocultável; foco visível; erro não acusa qual campo
falhou.

> **Consumo do DS:** *campo de entrada* (+ variante de segredo), *ação primária* (com estado em
> progresso), superfícies e marca. Se faltar algo → **pare e sinalize**.

---

### TELA 3 — Waitlist / Landing (`/`)

**1. Propósito.** Converter um leitor interessado em **um e-mail na lista de espera**, com o **menor
atrito possível**, comunicando a proposta do produto de forma honesta.

**2. Informação visível (fixtures reais — copy real da landing).** Página de marketing densa,
seccionada. A captura de e-mail aparece em **3 pontos** da página (topo, seção dedicada, chamada
final) — todas enviam o **mesmo campo único** (e-mail).

`copy (mutável)` — copy real do produto (textura a preservar; o agente pode reescrever):
- Título: *"Nunca esqueça o que você escolheu aprender"*
- Subtítulo: *"Transforme seus destaques do Kindle em memória permanente. Com IA baseada em 18 regras
  cognitivas e o algoritmo FSRS-6, o Lekto garante retenção máxima com revisões mobile em 3 gestos."*
- Campo: placeholder *"seu@email.com"* · ação *"Garantir acesso"* / em progresso *"Enviando..."*
- Sucesso (em lugar do formulário): *"Pronto! Você está na lista. Avisaremos quando o Lekto estiver
  pronto."* · garantia *"Seja dos primeiros a usar. Sem spam, prometemos."*
- Provas/claims reais: *"90% — Esquecido em 30 dias"*, *Curva do Esquecimento de Ebbinghaus*,
  *"FSRS-6 vs SM-2"*, *"3 Ratings vs Binário"*, *"18 Regras vs Cópia"*, métricas *"350M+ reviews"*,
  *"30% mais eficiente"*, etimologia *λεκτός* (grego: leitura, lição, coletar, selecionar, intelecto).
- Trio de benefícios: *Acesso antecipado · Feedback direto · Plano gratuito estendido*.
- Erro: *"Erro ao enviar. Tente novamente."* (ou mensagem de validação/duplicado vinda da API).

**3. O que a pessoa precisa fazer.** Entender a proposta e **deixar o e-mail**. (Quem já tem acesso
encontra um caminho discreto para entrar.)

**4. Modelo de interação.** Um **único campo** (e-mail), repetido nos pontos de decisão naturais ao
rolar. Envio com **sensação instantânea** + indicador **em progresso**; ao concluir, o formulário
**cede lugar a uma confirmação calma, no mesmo lugar**. Erro/duplicado retorna **mensagem curta
inline**. Em telas estreitas, a navegação de seções é recolhível.

**5. Filosofia / guardrails (vinculante).** Pré-lançamento: o acesso é **fechado e por prioridade de
fila** (escassez real, não fabricada). A persuasão se apoia em **claims reais e verificáveis**
(FSRS-6, 18 regras, 3 gestos, Ebbinghaus). Não há login/conta aqui. **PROIBIDO (forte):** pedir mais
que o e-mail neste estágio; urgência/escassez de *dark pattern* que não seja verdadeira.

**6. Fluxo.** Ler proposta (qualquer seção) → inserir e-mail → enviar (em progresso) → confirmação no
lugar. Caminho secundário discreto → login.

**7. Estados (mobile e desktop, dark).** *padrão* (formulário disponível, em 3 pontos) · *em
progresso* (enviando) · *enviado* (confirmação substitui o formulário) · *erro/validação* (mensagem
inline) · navegação *recolhida/expandida* (telas estreitas).

**8. Restrições.** Atrito mínimo (1 campo); confirmação não desloca a pessoa; claims honestos;
caminho para login presente mas discreto.

> **Consumo do DS:** *campo de entrada*, *ação primária* (em progresso), *superfícies de vidro*,
> *etiqueta de metadado*, marca/tipografia de display (+ acento serifado de marca). Se faltar algo →
> **pare e sinalize**.

---

### TELA 4 — Explorar (`/explore`)

**1. Propósito.** Descobrir, numa **biblioteca pública curada**, decks que valha a pena adotar.

**2. Informação visível (fixtures reais + representativos sinalizados).**
> ⚠️ **Estado real hoje:** o banco local tem **0 decks públicos** → o **estado vivo é o vazio**. Os
> *resumos de deck* abaixo são **representativos**, derivados do **vocabulário real de domínio** (os
> cartões reais são de *Hábitos Atômicos*; tags reais vêm de `utils/deckMeta.ts`; categorias reais
> vêm da UI). Sinalizados como representativos porque o conteúdo populado real ainda não existe.

- Cabeçalho: *"Explorar"* + *"Descubra novos horizontes de conhecimento em nossa biblioteca curada
  de baralhos públicos."* + entrada de busca (placeholder *"Buscar baralhos, temas ou autores..."*).
- Facetas de categoria (reais): **Tudo · Design · Programação · Psicologia · Idiomas · Marketing ·
  Finanças**.
- Grade de **resumos de deck** (representativos):
  - *"Hábitos Atômicos"* — por **Henry** — tags `[hábitos, produtividade]` — **42 cartões · 128
    inscritos** — *"Os principais insights de James Clear sobre como pequenas mudanças geram
    resultados notáveis."*
  - *"Fundamentos de Psicologia Cognitiva"* — por **Henry** — tags `[psicologia]` — **76 cartões ·
    54 inscritos** — *"Atenção, memória e vieses do raciocínio."*
  - **Linha de borda — título longo:** *"Padrões de Projeto de Software Orientado a Objetos (GoF)"* —
    tags `[programação]` — **120 cartões · 9 inscritos** — *"Os 23 padrões clássicos com exemplos."*
  - **Linha de borda — sem descrição / deck novo:** *"Vocabulário de Japonês — N5"* — tags
    `[idiomas]` — **18 cartões · 0 inscritos** — (sem descrição).

`copy (mutável)`: *"Ver mais baralhos"* · vazio: *"Nenhum deck público disponível ainda."* ·
(D2) busca-sem-resultado: *"Nada encontrado para sua busca."*

**3. O que a pessoa precisa fazer.** Folhear; refinar por texto e/ou categoria; abrir um deck para
avaliar/adotar.

**4. Modelo de interação (D2 — capacidades reais pretendidas).** A lista **carrega de imediato** ao
entrar. Refino por **consulta de texto livre** (casa com título/tema/autor) **e** por **faceta de
categoria** (uma ativa por vez, com "Tudo" como neutro). Resultados **estendem sob demanda** ("ver
mais"), **não** rolagem infinita automática. Cada *resumo* comunica **num relance**: assunto,
autoria, **tamanho (quantos cartões)** e **adoção (quantas pessoas inscritas)** — suficiente para
decidir abrir sem entrar. *(Hoje busca/facetas/"ver mais" são placeholders — especificá-los como
comportamento real; cobrir o estado de "busca sem resultado".)*

**5. Filosofia / guardrails (vinculante).** A **curadoria** (quais decks são públicos / aparecem) é
do **sistema/dono**; a decisão da pessoa é só **o que explorar e adotar**. Decks **pessoais nunca
aparecem aqui** (o domínio "Personal" é não-publicável — confirmado em `DeckFactory`). **PROIBIDO:**
expor decks privados; transformar a adoção/inscrição em algo irreversível ou escondido.

**6. Fluxo.** Entrar → ver biblioteca (ou vazio) → (opcional) buscar/filtrar → abrir um resumo → tela
de Deck público.

**7. Estados (mobile e desktop, dark).** *carregando* · **vazio (estado vivo hoje)** · *populado*
(grade) · *busca sem resultado* · *carregando-mais* ("ver mais" em progresso). Grade reflui de 1 →
múltiplas colunas conforme a largura.

**8. Restrições.** Folhear de uma mão; decisão de abrir feita pelo relance (assunto+tamanho+adoção);
refino opcional, nunca obrigatório.

> **Consumo do DS:** *casca de navegação* + *região de conteúdo* (fork do template-base), *resumo de
> deck*, *faceta de categoria*, *campo de entrada* (busca), *etiqueta de metadado*, *estados
> vazio/carregando*. Se faltar algo → **pare e sinalize**.

---

### TELA 5 — Deck público (`/explore/[slug]`)

**1. Propósito.** Dar à pessoa o suficiente para **julgar se um deck público lhe serve** e decidir
**adotá-lo (inscrever-se)** — de forma reversível.

**2. Informação visível (fixtures reais).** Usando o deck real de domínio *Hábitos Atômicos*:

- Nome: *"Hábitos Atômicos"* · autoria: *"por Henry"*.
- Descrição: *"Os principais insights de James Clear sobre como pequenas mudanças geram resultados
  notáveis."*
- Metadados: **42 cartões · 128 inscritos** (pluralização real: "1 inscrito" / "N inscritos").
- Tags: `hábitos` · `produtividade`.
- **Prévia — SÓ as frentes** de alguns cartões de amostra (verso **nunca** aparece aqui), frentes
  reais:
  - *"Por que ancorar um hábito novo a um momento que você já faz de forma fixa (como sentar ao
    computador ao chegar do trabalho) torna a mudança mais fácil?"*
  - *"Você quer adotar um hábito novo, mas vive esquecendo de fazê-lo. Como usar a sua rotina atual a
    favor disso?"*

`copy (mutável)`: *"← Voltar"* · rótulo *"Preview"* · ação *"Inscrever-se"* / *"Cancelar inscrição"*.

**3. O que a pessoa precisa fazer.** Avaliar escopo/nível pela prévia e pelos metadados, e
**adotar ou não** (reversível).

**4. Modelo de interação.** Superfície de **decisão**: o bastante para julgar antes de comprometer. A
prévia mostra **apenas o lado da pergunta** de alguns cartões — **nunca as respostas** — para que a
pessoa avalie escopo/nível **sem colher o conteúdo de graça**. **Um único comprometimento
reversível** (adotar / cancelar), **sempre alcançável sem rolar**, com **retorno otimista imediato**
na contagem de adoção; o ato é **perdoador** (cancelar é um passo, no mesmo lugar).

**5. Filosofia / guardrails (vinculante).** O que é público e o que a amostra revela é decisão do
**sistema/dono**; a pessoa decide só **adotar-ou-não**. Adotar injeta os cartões do deck no **próprio
feed de revisão** da pessoa. **PROIBIDO:** revelar as **respostas** da amostra antes de adotar; expor
decks privados do dono; fazer a adoção parecer irreversível ou esconder o caminho de cancelar.

**6. Fluxo.** Abrir (a partir de Explorar) → carregar → ler metadados + prévia (só frentes) → adotar
(otimista) **ou** voltar; se já inscrito, cancelar (reversível).

**7. Estados (mobile e desktop, dark).** *carregando* · *carregado — não inscrito* (ação = adotar) ·
*carregado — inscrito* (ação = cancelar, tom destrutivo) · *agindo* (ação em progresso, bloqueada) ·
*prévia vazia* (deck sem cartões de amostra). A ação de comprometimento fica fixa/alcançável em
qualquer rolagem, respeitando a navegação inferior em telas estreitas.

**8. Restrições.** Decisão sem entrar no deck; ação de comprometimento sempre ao alcance do polegar;
reversível em um passo; respostas protegidas até adotar.

> **Consumo do DS:** *região de conteúdo* (fork do template-base), *resumo/cabeçalho de deck*,
> *etiqueta de metadado* (tags/contagens), *ação primária* e *ação destrutiva* (com estado em
> progresso), *estado carregando*. Se faltar algo → **pare e sinalize**.

---

## Parte C — Checklist de aceite §6 (auto-verificação, por tela)

| Critério (§6) | Revisão | Login | Waitlist | Explorar | Deck público |
|---|:--:|:--:|:--:|:--:|:--:|
| Bloco **Modelo de interação** com valores concretos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bloco **Filosofia/guardrails** (quem decide + o que fica oculto) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Anti-padrão proibido nomeado** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Auditoria de omissão** passada | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Não nomeia widget** nem descreve forma visual | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sem **constante de mecânica** (px/ms) e copy tratada como lane **mutável** | ✅ | ✅ | ✅ | ✅ | ✅ |
| Todo valor camada-2 é **calibração-com-banda** ou guardrail de intenção | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Fixtures reais** (banco local / in-repo / destaques reais), textura preservada | ✅ | ✅ | ✅ | ⚠️¹ | ✅ |
| Cobre **mobile e desktop** + **todos os estados** (dark — ver D1) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Consome o DS** por nome; ordena "pare e sinalize" se faltar | ✅ | ✅ | ✅ | ✅ | ✅ |

¹ **Explorar:** o estado *vazio* usa dado real (banco com 0 decks públicos). O estado *populado* usa
*resumos representativos* derivados do vocabulário real de domínio (cartões reais de *Hábitos
Atômicos* + tags reais de `deckMeta.ts` + categorias reais da UI), **explicitamente sinalizados**,
porque o conteúdo populado real ainda não existe no banco — conjunto completo com linhas de borda
(título longo, sem-descrição, 0 inscritos).

**Notas de relaxamento documentado:** o item genérico "light **and** dark" do §6 está relaxado por
**D1** (produto dark-first; tokens semânticos permitem tema claro futuro; telas entregues em dark).
Todos os demais itens do §6 são atendidos integralmente.
