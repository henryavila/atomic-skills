<!--
PROVENIÊNCIA (T-001 · F1 · design-brief-briefing-rework)
- Origem: feedback original do agente de design sobre os prompts gerados pela skill design-brief para o redesign do app Lekto.
- O arquivo-fonte (PROMPT-FEEDBACK.md) era um download transitório, hoje ausente do disco (confirmado: 0 ocorrências no worktree, no git history --all e no stash). O operador re-forneceu o conteúdo nesta sessão F1; o operador sinalizou que esta versão inclui itens novos vs. a documentada.
- Persistido VERBATIM (scopeBoundary T-001: só persiste, não reinterpreta). Esta é a entrada durável que a rubrica (T-003) e o crítico (T-004) consomem.
- Os quatro contaminantes documentados aparecem abaixo: SWIPE_THRESHOLD=80(px), AXIS_LOCK_DISTANCE=10(px), a copy "Vai!", e onboarding em 3 passos.
-->

# Feedback dos prompts — Lekto

> **Propósito.** Avaliar criticamente os prompts que originaram este projeto
> (`uploads/2026-06-16-lekto-ds-prompt.md`, `…-screens-prompt.md`, `…-fixtures.md`)
> à luz das mudanças que o **operador** pediu durante o design. A pergunta-guia:
> *o prompt ajudou, ou prescreveu estrutura que acabou sendo removida/refeita —
> limitando o processo criativo?*
>
> **Como manter.** Uma entrada por tela/sessão, escrita **enquanto a memória está fresca**
> (o contexto é aparado entre sessões — não dá para reconstruir depois com fidelidade).
> No fim, a seção **Padrões transversais** sintetiza o que se repete entre telas.
> Veredito honesto, não diplomacia: o valor está em apontar onde o prompt errou.

---

## Tela 4 — Revisão (sessão 2026-06-16/17)

A tela de maior risco do briefing — e onde o prompt mais interferiu, para o bem e para o mal.

### O que o operador mudou (e por quê)
1. **Cores dos 3 sentidos** — "quase" (amber) se misturava com errei/lembrei; não criava memória *muscular*. Separamos a cor do "Quase".
2. **Seta dentro do card** — não distinguível a 0.3 de opacidade (cor virava cinza) → chips circulares tingidos. Depois: questionou se a seta no card precisa existir (compete com a atenção) → simplificada.
3. **Barra de tempo** — ao trocar de card devia começar **cheia instantaneamente**; bugs de sliver no topo; ~0.1s de atraso para mover.
4. **Sincronia revelação × barra** — resposta aparecia antes da barra esvaziar, sobretudo ao **trocar de dispositivo** (remontava a tela, reiniciava a barra mas não a contagem).
5. **Card-dentro-de-card** (verso arredondado dentro de card arredondado) — "estranho", refeito.
6. **Drag travado num eixo** (axis-lock) — começar lateral impedia ir para baixo; forçava soltar e recomeçar.
7. **Drag selecionava texto** da página/título ao arrastar muito.
8. **Painel de atalhos no desktop** — competia com o card, instrução redundante → reduzido/removido.

### Citações que comprovam: o prompt codificou o app antigo como requisito obrigatório
Verbatim dos prompts (a marcação "vinculante" e a "Origem:" no código são do próprio prompt):

- **Cabeçalho do prompt de telas:** *"Gerado por `atomic-skills:design-brief` em 2026-06-16, a partir do **código real** (`web/app/`)…"* → o prompt nasce de mineração do app antigo.
- **Preâmbulo:** *"**Prescrevemos** o **comportamento de interação** e **o que fica oculto** — são requisitos de produto e são **vinculantes**."*
- **Tela 4, título da seção:** *"**4. Modelo de interação (vinculante, com valores minerados do código).**"* → mistura explícita de "vinculante" + "minerado do código".
- **Ritual / "Vai!":** *"toda sessão abre com uma contagem curta de preparação **3 → 2 → 1 → 'Vai!'** (~1s por passo…). **(Origem: `ReviewCountdown.vue`, `STEP_MS=1000`, `GO_MS=800`.)**"* → copy + valores presos a arquivos do app.
- **Drag / axis-lock:** *"há um **limiar de deslocamento antes de valer** (~80px…); o sentido contrário ao esperado é cancelado. **(Origem: `ReviewCard.vue` `SWIPE_THRESHOLD=80`, `AXIS_LOCK_DISTANCE=10`, gesto para cima = cancelar.)**"*
- **Onboarding 3 passos:** *"**Primeira vez:** onboarding em **3 passos**… **(Origem: `ReviewOnboarding.vue`, `lekto_onboarding_done`.)**"*
- **Painel de atalhos (prompt do DS, §2):** *"**Painel auxiliar de equivalências de teclado** (superfície só-desktop)."* e *"**Ritual de início** (sequência de preparação 3→2→1→'Vai'…)."* → componentes nomeados, ambos vindos do app antigo.

> Conclusão: a estrutura do app antigo foi **literalmente transcrita como requisito vinculante**, com citação de arquivo/constante. Não havia código do app no projeto — só estas citações. Seguir o "vinculante" = replicar o app antigo, contra a intenção de repensar.

### Onde o prompt OVER-especificou (estrutura minerada do código → "vinculante")
O prompt foi minucioso ao extrair valores do app real (`review.vue`, `ReviewCard.vue`, etc.) e
converteu **detalhes de implementação em requisitos vinculantes**. Vários foram exatamente o que o operador reverteu:

- **A palavra "Vai!"** — o prompt fixa o ritual como "3 → 2 → 1 → **'Vai!'**" (de `GO_MS=800`). Mas "Vai!" é **tradução literal de "Go"**, não natural em pt-BR — o operador trocou por "Comece". Um prompt de *comportamento* não deveria ter cravado uma **palavra de copy**.
- **Ritual que "antecipa os 3 sentidos"** — o requisito empurrou para encher 3 segundos de informação (montei um painel "Como responder" no ritual). O operador cortou tudo: "muita info para 3 s de visualização". **O prompt confundiu um *marca-ritmo* (beat comportamental) com uma *superfície instrucional*** — em 3 s elas brigam. O ritual virou só anel + linha de setas.
- **"Onboarding em 3 passos"** — o prompt crava 3 (de `ReviewOnboarding.vue`) e até lista os 3. O operador pediu um **4º passo ("Como escolher")**. O número era um artefato do código atual, tratado como requisito.
- **Axis-lock (`AXIS_LOCK_DISTANCE=10`) e swipe (`SWIPE_THRESHOLD=80`)** — implementei fiel; o operador bateu **exatamente** no problema que o axis-lock causa. Minerar a constante do app **antigo** e marcá-la "vinculante" **assou no design o bug de UX do app antigo**. O redesign existia em parte para *consertar* a interação — o prompt a congelou como verdade.
- **Barra lateral de atalhos só-desktop** — a barra à direita da Revisão no desktop **veio do prompt**: componente nomeado no prompt do DS (*"Painel auxiliar de equivalências de teclado (superfície só-desktop)"*) e exigida no de telas (*"auxílio de equivalências visível"*), vinda de `ReviewShortcutsPanel.vue`. Acabou sendo clutter que compete com o card e foi reduzida/removida.

### Onde o prompt foi OMISSO (defendeu a falha anterior, não achou a próxima)
- **O que é "Quase"?** O problema de UX mais difícil da sessão. O operador teve de me **ensinar** no meio do caminho: "Quase = lembrei a ideia mas não consegui explicar." O prompt sacraliza o **vocabulário** (Errei · Quase · Lembrei) mas **nunca define o que significam** nem exige que o design *ensine* a distinção. Protegeu contra a falha errada (mostrar dias de agenda) e deixou a real (compreensão dos graus) intocada. **O modelo de risco do prompt estava mal calibrado** — investiu nos anti-padrões que já conhecia e ignorou os problemas de compreensão que não conhecia.
- **Cor como canal de memória muscular** — o prompt diz "não dependa só de cor" (bom), mas trata cor como o canal a *evitar*, não como o canal **primário** que precisa de separação máxima entre 3 sentidos direcionais. O trio herdado red/amber/green do DS é justamente o que falhou. (Já corrigido via `DS-change--ReviewGrades-3-sentidos.md`.)
- **Contrato de sincronia timer ↔ revelação** — o prompt fixa "~8 s" (de `timer_seconds || 8`) como se "o timer está especificado". O difícil não era o valor: era a **sincronia** entre a barra visível e o auto-reveal (e a remontagem ao trocar device). Minerar o valor deu falsa sensação de cobertura.

### Onde o prompt ACERTOU (e deve ser preservado)
- **Deixar a forma visual aberta** ("a forma é sua") — onde ele disse isso, tive liberdade e o operador só criticou minha *execução*, nunca o prompt. Card-dentro-de-card foi escolha minha, não imposição.
- **Densidade do verso** (239–349 ch, "NÃO one-liners", "dimensione para o verso mais longo") — preveniu uma falha real de layout. Valor concreto e útil.
- **Invariantes** — "nenhum número no caminho de responder", offline enfileira/nunca descarta, "Fácil" é inferido (não 4º botão). Seguraram bem.
- **Fixtures reais** com textura medida — excelentes.

### Lição para o próximo prompt desta tela
Separe **três camadas** que este prompt fundiu numa só ("comportamento vinculante"):
(a) **invariantes de produto** (sem número na resposta; offline nunca perde) → vinculante;
(b) **comportamento do app atual** (axis-lock, 3 passos, painel de atalhos, "Vai!") → *contexto, não requisito* — o redesign pode melhorar;
(c) **copy** (palavras exatas) → nunca no prompt de comportamento.
E adicione o requisito que faltou: **o design tem de ensinar a diferença entre os 3 sentidos** (o que é "Quase").

---

## Tela 2 — Login (sessão 2026-06-17)

### O que o operador mudou (e por quê)
Diagnóstico dele: a tela estava **"muito pobre"**. Pediu para repensar "com base no que melhoramos nas últimas telas". Refiz: o painel da marca virou um **sistema de órbita vivo** (o mark do Lekto animado — anel esmeralda + nós citron orbitando + spark central pulsando), que é a metáfora central do produto (*o que você reteve volta em ciclos*); no mobile, um mark vivo compacto substituiu o wordmark solto; copy e composição refinadas. Mantive os mecanismos do form (revelar senha, estados, erro que não vaza campo).

### Onde o prompt OVER-especificou / foi de BAIXA ambição
- **"Coluna única, centrado, em mobile e desktop"** — o prompt prescreve explicitamente o layout mais pobre possível para **os dois** dispositivos. Essa instrução *é* a "pobreza" que o operador rejeitou. Um split desktop com narrativa de marca (que já existia antes desta sessão) **contraria** a letra do prompt — e foi o caminho certo.
- **Informação visível reduzida ao funcional** — o prompt lista só "identidade do produto; dois campos; link da lista de espera; erro". Trata o login como formulário, não como **primeira impressão de marca**.

### Onde o prompt foi OMISSO
- **Zero ambição de marca no ponto de entrada.** A metáfora órbita+spark é descrita no guia do DS como o coração da identidade, mas o prompt de Login não pede nada disso. Login é a primeira tela que a pessoa vê — o prompt não tinha nenhuma intenção de expressá-la.

### Onde o prompt ACERTOU (preservar)
- **Invariantes funcionais sólidos:** erro **não vaza qual campo falhou**; revelar/ocultar senha; envio instantâneo com progresso; sucesso navega; estados (inicial/enviando/erro/sucesso). Mantive todos.

### Lição para o próximo prompt desta tela
Para um produto de consumo, o prompt da tela de entrada não pode especificar só a mecânica do form. Peça também **como a tela carrega a marca** (aqui: a órbita viva). "Coluna única centrada" é um *default de baixa ambição* — gerou exatamente o resultado "pobre". Separe **mecânica** (vinculante: segurança, estados) de **forma/ambição de marca** (aberta, mas *pedida*).

---

## Tela 1 — Lista de espera / waitlist (sessão 2026-06-17)

### O que foi feito
Criada como **tela irmã do Login**: mesma identidade (órbita viva, faixa-herói esmeralda no mobile, "lekto" em texto, harness de estados). Conteúdo: promessa central + uma **vitrine de amplitude** (pills com ícones: Datas · Idiomas · Estudos · Números · Livros · Momentos — Lekto retém *qualquer* conhecimento, não só leitura), campo único de e-mail, CTA **"Garantir acesso"**, prova FSRS, e os estados ✅ "Pronto! Você está na lista." / ❌ "Esse e-mail já está na lista." Link de/para o Login conectado nos dois sentidos.

> **Correção (mesma sessão):** a 1ª versão usava o laço "Ler → Selecionar → Revisar → Reter" (minerado do guia do DS) — o operador apontou que isso enquadra o Lekto como **só leitura**, quando o produto é memória para **qualquer conhecimento** (datas, números/documentos, acontecimentos da vida, estudo). Isto é exatamente o que o **guia do DS já avisa** ("a deck is *general*, not always a book") — mas o *laço* ler→…→reter, citado no próprio guia como "central loop", me induziu ao erro. Lição: o "central loop" do guia é uma das jornadas, **não** a definição do produto; mostrar amplitude (categorias variadas) comunica melhor o valor que mostrar o processo de leitura.

### Conflito não reconciliado pelo prompt (importante)
- O **prompt de telas (Tela 1)** descreve uma **landing de marketing** em `/` com "rolagem livre de conteúdo de marketing" e "navegação horizontal no desktop / colapsada no mobile".
- O **guia do DS** diz o oposto: *"No public marketing site this phase. The domain root goes straight to login."*
- Os dois **se contradizem** e o prompt não resolveu isso. O pedido real do operador foi pontual: *"tela de cadastro na lista de reserva"* — uma tela de **captura de e-mail focada**, alcançável a partir do link do Login. Segui o pedido real (form focado, família do Login), não a "landing de marketing" do prompt.

### Onde o prompt ACERTOU
- **Fixtures diretamente usáveis:** CTA "Garantir acesso" e as cópias de sucesso/erro vieram prontas e boas.
- Invariantes simples e corretos: campo único, validação inline, sem recarregar, paridade mobile/desktop.

### Lição para o próximo prompt desta tela
Reconcilie a contradição **antes** de escrever: se "a raiz vai direto para o login" (guia do DS), então a waitlist é uma **tela de captura focada acessível pelo login** — não uma landing de marketing rolável. O prompt deveria ter escolhido um dos dois e dito qual. Quando prompt e guia do DS divergem, **sinalizar e decidir** em vez de descrever os dois mundos.

### Refinamentos da seção informativa (mesma sessão — aprovado)
A "parte chamativa" da waitlist passou por 3 rodadas até aprovar; cada uma virou regra:
1. **Leitura → amplitude.** Laço ler→…→reter (enquadrava como só-leitura) trocado por vitrine de categorias. *(ver Correção acima)*
2. **Lista fechada → coringa aberto.** 6 categorias fixas leram como "você só lembra isso". Resolvido com um pill final **"o que você escolher"** que reenquadra os demais como exemplos e amarra com a missão. → *Ao mostrar amplitude, sinalize abertura explicitamente; nunca deixe um conjunto finito parecer a lista completa.*
3. **Rótulo seco → tom de marketing.** "Números" (e o framing utilitário) era pouco atraente. Trocado por categorias relatáveis/aspiracionais — ex. **"Nomes"** (esquecer nome é dor universal). → *Categorias de valor vendem o desejo; escolha pela ressonância emocional, não pela taxonomia do produto.*
4. **Acento competindo com o CTA.** O pill coringa em esmeralda **sólida** imitava o botão primário e roubava atenção. Suavizado para esmeralda-soft + borda tracejada. → *Reserve o preenchimento primário sólido para a única ação primária; destaques secundários usam tratamento soft/outline.*
5. **Slogan sem duplicar.** Slogan *"Nunca esqueça o que você escolheu aprender."* entrou na legenda do form, mas **condicional ao device** (mobile mostra o slogan; desktop usa linha prática, pois o slogan já é o título do painel). → *Não repita a mesma frase-herói duas vezes na mesma tela; troque por device/contexto.*

### Lição para o próximo prompt desta tela
Além de reconciliar landing×login, o prompt deveria ter **proibido enquadrar o Lekto como só-leitura** e exigido que a prova de valor mostre **amplitude aberta** (qualquer conhecimento). O prompt herdou do guia do DS o "central loop" de leitura e não avisou que isso é *uma* jornada, não a definição. Falta recorrente: o prompt descreve o *mecanismo* (ler→revisar) e esquece o *valor de marca* (lembrar qualquer coisa que importa).

---

## Tela 9 — Deck público (sessão 2026-06-17)

### O que o operador mudou (e por quê) — observação estrutural grave
O operador apontou que **eu vinha desenhando cada tela como ilha**: a versão anterior do Deck Público era full-bleed, com um botão "voltar" flutuando sobre o cover, **fora de qualquer casca de app**. A correção dele foi conceitual: *"repense não só a tela, mas o universo em que ela existe"* — o Lekto é um app (mobile + desktop) com **navegação persistente** (sidebar/tab bar entre Início · Revisar · Progresso · Explorar · Perfil). Reconstruí o Deck Público **dentro da casca** (canônica do `Início.dc.html`), com **Explorar** ativo e um breadcrumb "← Explorar".

### Onde o prompt foi OMISSO (a falha central desta tela)
- **O prompt descreve telas, não o app.** Cada tela do prompt tem "modelo de interação", "estados", "filosofia" — mas **nenhuma menção à casca de navegação compartilhada** no corpo das telas. A "Casca de navegação persistente" existe só no **prompt do DS** (inventário de componentes), e o prompt de telas **nunca diz** "monte cada tela dentro dela". Resultado: dá pra ler o prompt de telas e produzir 10 ilhas — foi o que aconteceu.
- Faltou um **contrato de shell**: quais telas são autenticadas (com sidebar/tab bar) × públicas (sem), qual item fica ativo em cada uma, e como sub-páginas (detalhe) voltam à seção. O prompt trata Deck Público como rota isolada e não diz que ela é uma **sub-página de Explorar**.
- **Contradição herdada:** Explorar é "em breve" (guia do DS) mas o Deck Público é alcançado por Explorar. O prompt não reconcilia (resolvido: Explorar destacado quando é a seção ativa; selo "em breve" só quando inativo).

### Onde o prompt ACERTOU
- Conteúdo e fixtures da tela em si: nome/autor/“N cards · M inscritos”/tags/descrição/amostra de cards/inscrever-cancelar — tudo claro e usável.
- Guardrail **owner × subscriber** correto e importante: subscriber **não** grava áudio nem gera cards (mantido na nota da tela).

### Lição para o próximo prompt
O prompt de telas precisa de uma **seção de casca de app no topo** (antes das telas): a navegação persistente, quais telas a usam, item ativo por tela, padrão de sub-página/voltar, e o que muda entre mobile (tab bar, Revisar central elevado) e desktop (sidebar 248px). Sem isso, telas viram ilhas. *(Convenção agora fixada em `DESIGN-CONVENTIONS.md › App shell`.)*

### Refinamentos por comentário (mesma sessão — todos aprovados)
Depois da reconstrução, a tela passou por uma rodada longa de polimento via marcação direta. Cada um virou regra:
1. **Card-dentro-de-card → capa de livro.** O cover arredondado dentro do rail soava estranho; virou um **card-capa vertical** (3/4 no desktop, altura automática no mobile) que preenche o rail e parece um livro.
2. **"Cancelar inscrição" enterrado.** Estava no fim da lista de perguntas — UX ruim. Movido para **junto da ação** (rail esquerdo, ao lado de "Inscrito"), depois agrupado numa linha centralizada com separador (em vez de `space-between`, que jogava os dois itens para pontas opostas). → *Ações destrutivas/secundárias ficam adjacentes à ação que modificam, nunca no rodapé do conteúdo.*
3. **Autor confuso.** "por Henry · James Clear" lia como se Henry fosse autor do livro. Separado: **James Clear** = autor (subtítulo da capa); **Deck de Henry** = curador (linha própria com avatar). → *Distinga papéis (autor da obra × curador do deck) visual e textualmente; nunca os funda numa lista com "·".*
4. **Título herdando cor escura.** O `h1` na capa esmeralda vinha preto (CSS base do DS). → *Em superfícies de marca coloridas, **declare `color` explícito** nos textos — não confie na herança do reset do DS.*
5. **Ícones fora do padrão (regra forte).** `help-circle` ("?") nas amostras → **número tabular 01–05**; `compass` (Explorar) → **`telescope`**. Motivo unificado: o operador rejeita ícones "círculo com detalhe denso dentro"; todos devem ser silhuetas Lucide simples e abertas (house/chart-line/user-round são a referência). → *Um único padrão de ícone em todo o app; auditar cada glifo contra a família aprovada.*
6. **Sidebar: marca fraca + Perfil redundante.** O `wordmark.svg` reduzido ficava ruim → **lockup inline** (orbe+spark 32px + "lekto" Manrope 800). E havia item "Perfil" na nav **e** card de usuário no rodapé → removido o item; o **card do rodapé é o acesso ao Perfil** (botão + chevron), padrão Linear/Notion. → *No desktop, o card de conta no rodapé É o Perfil; não duplicar na nav.*
7. **Harmonia vertical do cover (mobile).** `margin-top:auto` (pensado pro cover alto do desktop) + padding 26px esticavam o conteúdo no mobile. Espaçamento virou **condicional ao device**. → *Padding e âncoras de um cover de proporção fixa (desktop) não servem ao mesmo cover em altura automática (mobile); torne-os responsivos.*

Padrão da sessão: **a reconstrução estrutural (casca) foi acertada de primeira, mas o polimento fino exigiu ~10 rodadas de marcação** — herança de cor, papéis de autoria, consistência de ícone e ritmo de espaçamento são coisas que nenhum prompt anteviu e que só aparecem no olho do operador. Isso reforça o valor do ciclo de comentário direto sobre o de prompt.

---

## Sessão — Conversão para app navegável (2026-06-17)

### O que o operador pediu
Depois de validar Login, Lista de espera, Revisão e Deck público como arquivos isolados: *"converta para um app com componentes reutilizáveis, layout em container dedicado, sem duplicar código de layout, e navegável."* Decisões dele: **todas** as telas entram; harness global mantido (precisa transitar estados/tema/device para validar); **originais preservados para referência**, conteúdo vira reutilizável; fluxo login→(waitlist|home), app com menu, Revisar volta para home.

### Como foi resolvido
`Lekto.dc.html` = container dedicado (estado global + harness + frame + shell único + roteamento). Cada tela ganhou **modo embedded** (props `embedded`/`device`/`theme`/`appState`/`onNav`): colapsa harness/frame/shell próprios para `display:contents` e entrega só o conteúdo no scroll do Lekto. Standalone segue idêntico. Detalhe em `DESIGN-CONVENTIONS.md › App navegável`.

### Onde o prompt foi OMISSO (confirma e fecha o padrão transversal #7)
- Esta é exatamente a falha #7 (telas-ilha) levada à conclusão: **o prompt nunca definiu que isso é um app**, nem o contrato de shell/rotas/transições. A conversão foi 100% iniciativa do operador, tardia — depois de 9 telas já desenhadas isoladas. Se o prompt tivesse aberto com "isto é UM app navegável; toda tela monta dentro de um container `App` com harness+shell+rota; eis o grafo de navegação", as telas teriam nascido embedded e a conversão seria desnecessária.
- O prompt também não previu o **harness como ferramenta de validação** (transitar tema/device/estado). Isso emergiu do uso, virou requisito do operador, e teve de ser centralizado retroativamente.

### Onde o prompt ACERTOU
- Os **estados por tela** que o prompt exigiu viraram diretamente as pílulas de "Estados" do harness — o inventário de estados foi reaproveitado sem atrito.
- Telas focadas (Revisão) × com-shell já estavam implicitamente certas no prompt (Revisão é imersiva); o contrato de "quais telas têm shell" caiu naturalmente.

### Lição para o próximo prompt
**Abrir o prompt de telas declarando o app, não as telas.** Primeiro: o container/shell, o grafo de navegação (quem leva a quem), quais rotas são pré-login/focadas/com-shell, e que cada tela é um componente-conteúdo montado no container. Só depois, as telas. Inverter essa ordem (telas primeiro, app nunca) custou uma sessão inteira de refactor.

---

## Sessão — Pós-app: Esqueci a senha, fix Explorar, polish Revisão (2026-06-17)

Três pedidos curtos depois do app montado, todos reveladores de **dívida que a conversão deixou** + **lacunas do prompt**:

1. **Esqueci a senha** (nova tela, link no Login). O prompt **nunca a previu** — login sem recuperação de senha é um buraco óbvio de produto que só apareceu no uso. Construída copiando o Login (split de marca + form → "Verifique seu e-mail"), já embedded. → *Lição: o prompt de auth precisa do trio completo (entrar / recuperar / criar-acesso), não só "Login".*
2. **Explorar não abria o deck.** Causa real: na conversão eu marquei "Explorar→Deck público" como feito mas **só embeddei o DeckPublico, não o Explorar** — ele renderizava chrome-dentro-de-chrome no app e o card não navegava. → *Lição minha (não do prompt): "embedar a tela X" e "ligar a navegação de X para Y" são tarefas distintas; um checklist de conversão por tela evita pular a própria tela.*
3. **Revisão ficou ruim no app** (3 itens): (a) bg não preenchia — o **host do `dc-import` não estica** e `flex:1` no mount não aplica; resolvido com `height:100%` no mount (agora documentado); (b) **empilhamento de cards fixo** mesmo no último — virou proporcional aos restantes; (c) **tela de conclusão** com 2 botões → refinada para **um** ("Voltar ao início"). → *Lição: telas focadas/imersivas têm requisitos de layout (preencher viewport, pilha proporcional, ação única no fim) que nenhum prompt de conteúdo capturou — emergem só ao rodar dentro do app real.*

**Padrão que se confirma:** a maior parte do trabalho fino pós-estrutura é **dívida invisível ao prompt** — recuperação de senha esquecida, uma tela que escapou da conversão, e detalhes de layout de tela imersiva. Reforça o transversal #8 (polimento invisível) e #7 (sem contrato de app, telas e fluxos viram dívida). Um bom prompt de app abriria com o **inventário completo de telas E de transições** (incluindo auth completo e estados de cada tela imersiva), não a lista parcial que tínhamos.

---

## Prompt do DS (bônus — não escrito pelo operador)

Estruturalmente o melhor dos três: tokens por papel, estados obrigatórios, **1 template base**, WCAG como restrição mensurável, disciplina "não prescreva forma". Ressalvas:

- **Origem da over-especificação.** "Vai", o "Painel auxiliar de equivalências de teclado" e o "Ritual 3→2→1→Vai" aparecem aqui **como componentes nomeados**. Ou seja, parte da estrutura que o operador reverteu na tela nasceu no prompt do DS, não no de telas.
- **Os 3 sentidos mereciam paleta dedicada.** Pediu "estados semânticos distintos e não-só-cor", mas não exigiu que os **3 sentidos da revisão** (o gesto central do produto) fossem uma paleta própria com **separação máxima** entre si, distinta dos estados genéricos. Resultado: herdaram red/amber/green e o "Quase" amber colou nos vizinhos.
- **Faltou o contrato de sincronia** timer-visível ↔ auto-reveal entre os tokens de duração do "ritual".

O resto (emerald/citron/Manrope, raios, sombras, 1 template base) está sólido — o `DS-change` confirma que só a **estrutura** do `ReviewGrades` precisou mudar, não os tokens.

---

## Tela 8 — Explorar / catálogo (sessão 2026-06-17, redesenho completo)

Pedido do operador: **repensar a tela inteira**, lembrando que "a tendência é ela crescer e ter diversos cards, sobre livros e outros assuntos (conhecimentos gerais, história, etc), pra vários usuários".

### O que o operador mudou (e por quê)
- A Explorar anterior era **minúscula** (uma busca preview + chips + um único card "Hábitos Atômicos") e ainda **sem a casca de app** (versão antiga, anterior à conversão). Foi refeita como **catálogo escalável**: hero "Em destaque" + grade de **8 decks da comunidade** de assuntos e autores variados (História/Sapiens, Idiomas/Inglês e Espanhol, Geografia/Capitais, Ciências/Corpo humano, Filosofia, Finanças, História do Brasil). Casca de app adicionada (sidebar/tab bar, Explorar ativo).
- O **estado real** (1 deck, 0 inscritos) fica coberto pelo **vazio**; o populado é **representativo da escala futura** — mesma lógica já aprovada no Início ("grade com vários decks é estado representativo").

### Onde o prompt OVER-especificou
- Nada de código-legado aqui para reverter — o prompt da Tela 8 é curto e **honesto sobre o que é preview** (busca/filtros não funcionam). Mantido fielmente: busca + chips de categoria marcados "em breve", com nota de que ainda não filtram.

### Onde o prompt foi OMISSO (a lacuna real desta tela)
- O prompt fixou o **estado atual** ("catálogo real: 1 deck público") e nunca pediu o que o operador queria de fato: **desenhar para o crescimento** — muitos decks, muitos assuntos, muitos autores. Um briefing que só descreve o fixture de hoje produz uma tela que **não comunica a visão** do produto. A própria nota do CLAUDE.md ("trate vinculantes minerados como contexto") se aplica: o "1 deck" é estado-de-hoje, não teto de design.
- Não previu o **vocabulário de card de catálogo** (capa por assunto, autoria de terceiros, contadores sociais) nem como diferenciar **deck-livro de deck-assunto** (o produto não é só livros — datas, idiomas, capitais). Resolvido com **tinte suave por categoria + ícone-assunto** como motivo, em vez de capa-de-livro para tudo.

### Onde o prompt ACERTOU
- O **inventário de estados** (carregando/populado/vazio + preview sinalizado) caiu direto nas pílulas do harness, sem atrito.
- O guardrail de **não vazar dado privado** no catálogo é invariante real e foi respeitado (cards só mostram dado público: título, autor, cards, inscritos).

### Lição para o próximo prompt
**Telas de catálogo/descoberta precisam ser briefadas pela escala-alvo, não pelo fixture de hoje.** Diga "esta tela vai crescer para N assuntos × M autores; desenhe o sistema de card e a hierarquia (destaque × grade) para isso", e forneça o vocabulário de card (capa, autoria de terceiros, métricas sociais). O fixture real entra como **estado vazio/seed**, não como o teto do design.

---

## Tela 8 — Explorar v2 / modelo de FACETAS (sessão 2026-06-17, 2ª passada)

Pedido do operador: a v1 "ficou linda mas virou bagunça do ponto de vista de categorias". Ele trouxe um **novo conceito de categorização** (briefing salvo em `CATALOG-TAXONOMY.md`) e pediu para repensar a organização. Depois: "salve essa informação no projeto" + "já implemente a busca/filtro". Por fim: **"Pessoal & vida não pode ser compartilhado"** → removido do catálogo público.

### O que o operador mudou (e por quê)
- **De lista achatada → modelo de facetas.** A v1 jogava domínio, formato e tags numa só fileira de chips ("Psicologia, História, Idiomas…"). Confuso porque **são eixos perpendiculares**: Domínio (sobre o quê), Formato (livro/revisão/vocab/prova/referência), Nível, Idioma, Tags (cauda livre). v2 separa: **navegar por Domínio** (tiles agrupados em Estudos/Trabalho/Vida) + **refinar por faceta** (chips que se cruzam) + **tags clicáveis** que viram busca.
- **Busca e filtros agora FUNCIONAM** (não mais "em breve"): busca textual, single-select por eixo combinando, tag→busca, tile de domínio→resultados, estados de vazio por filtro/área.
- **`Pessoal & vida` saiu do catálogo** — é privado por natureza (assuntos do indivíduo). Vira domínio privado do produto; catch-all público = Geral.

### Onde o prompt (de telas) foi OMISSO — a lacuna estrutural
- O prompt da Tela 8 **nunca modelou a taxonomia**: tratava "categoria" como uma dimensão única e plana. Não distinguia **eixo de navegação** (poucos, estáveis) de **eixo de refino** (facetas que cruzam) de **cauda** (tags infinitas). Resultado: a v1 cumpriu o prompt e mesmo assim "embaralhou" — porque **o prompt não tinha um modelo de informação**, só uma lista de exemplos.
- Não previu **privacidade como recorte de catálogo**: "Pessoal & vida" é simultaneamente o diferencial do produto **e** algo que **não pode ser público**. Um briefing de descoberta precisa dizer, por domínio, **o que é compartilhável**. Faltou.
- Não nomeou os **sinais de confiança** próprios de marketplace (avaliação, "X estudando" como prova social) — emergiram só no redesign.

### Onde acertou (preservar)
- O guardrail **"só dado público no card"** continua válido e agora tem consequência estrutural (domínio privado inteiro fora do catálogo).
- Inventário de estados seguiu útil (browse/resultados/vazio-de-filtro/vazio-geral mapeiam direto no harness).

### Lição para o próximo prompt
**Briefe descoberta com um MODELO DE INFORMAÇÃO, não uma lista de categorias.** Declare os eixos e seus papéis ("Domínio = navegação, lista fechada de ~10; Formato/Nível/Idioma = facetas que cruzam; Tags = cauda livre"), **marque o que é público vs. privado por domínio**, e nomeie os sinais de confiança. Sem isso, a tela pode cumprir o prompt e ainda parecer bagunçada — o problema é o modelo ausente, não o layout. (Ver `CATALOG-TAXONOMY.md`, agora a fonte canônica.)

---

## Tela 3.b — Biblioteca pessoal / "Ver todos" (sessão 2026-06-19)

Não existe "Tela Biblioteca" no prompt: a biblioteca pessoal vive **só** como "meus decks" + "Lendo agora" **dentro** da Home (Tela 3), sem destino de "ver todos". A Início já tinha o link `goBiblioteca` apontando para uma rota inexistente — esta sessão criou a tela e roteou.

### O que o operador mudou (e por quê)
- **Erro grave meu, cortado na hora:** entreguei a Biblioteca com o **molde legado** (harness escuro de Estados + moldura de aparelho + casca própria no arquivo). O operador: *"estamos construindo tudo dentro do app Lekto; cada página e item são componentes; não criamos mais páginas avulsas."* Reescrevi como **componente de conteúdo puro** (sem control-bar, sem frame, sem shell), lendo `device`/`theme`/`appState`/`onNav` das props; moldura+tema+casca vêm do `Lekto`. Estados loading/empty viraram **tweak `libState`** no `Lekto` (espelha `catalogState`).

### Onde o prompt foi OMISSO (a lacuna real)
- **Nenhuma tela de biblioteca pessoal.** O prompt assume que "meus decks" cabem num bloco da Home e nunca prevê o que acontece quando a coleção cresce (o mesmo erro da Explorar: briefar pelo fixture de hoje, 1 deck, não pela escala). Faltou a superfície "ver todos".
- **Não distinguiu card de catálogo × linha de biblioteca.** São coisas diferentes: o catálogo público mostra **prova social** (autor, ★, estudando); a biblioteca pessoal mostra **MEU estado** (a-revisar / lendo pág X / em dia / reflexão virando card). O prompt só tinha o vocabulário público.
- **Não nomeou o status bidimensional por deck** (revisão + leitura no mesmo item) — veio do modelo de produto (CLAUDE.md/convenções), não do prompt.

### Onde o prompt/modelo ACERTOU (preservar)
- O **modelo de produto** (biblioteca única, livro = deck com camada de leitura, desempenho bidimensional) — que está nas **convenções**, não no prompt de telas — guiou a tela inteira. É a fonte certa; o prompt de telas é que está atrás dele.
- Inventário de estados (carregando/populado/vazio + vazio-de-filtro) caiu direto, agora via tweak.

### Lição para o próximo prompt
**Toda coleção do usuário precisa de uma superfície "ver todos" briefada pela escala, com vocabulário de card PRÓPRIO (meu estado), distinto do catálogo público (prova social).** E o meta: **tela nova nasce componente de conteúdo** — o prompt/processo deve dizer isso no topo, senão o reflexo é recriar o harness legado.

---

## Padrões transversais (atualizar conforme repetem entre telas)

1. **Mineração de código vira camisa-de-força.** O prompt de telas trata "o que o app atual faz" como "comportamento vinculante". Isso baixa bugs de UX do app antigo para dentro do redesign (axis-lock, painel de atalhos, contagem de passos). → *Distinga invariante de produto de comportamento-legado.*
   - **Constatação-chave (2026-06-17):** **não existe código do app antigo no projeto** — eu nunca o vi. Tudo que pareceu "seguir o design anterior" veio **inteiro do prompt**, que minerou o app real e embutiu nomes de componente, constantes (`AXIS_LOCK_DISTANCE=10`, `SWIPE_THRESHOLD=80`) e copy ("Vai!") como *"vinculante"*. A intenção do operador era **repensar tudo**; o prompt — e a minha **deferência aos rótulos "vinculante"** — puxou para replicar. Falha dupla: do prompt (codificar o legado como requisito) e minha (não sinalizar "isto é o app antigo, vale repensar?" no início).
2. **Copy não pertence a um prompt de comportamento.** "Vai!" e "onboarding em 3 passos" são decisões de conteúdo/estrutura que o prompt cravou e o operador reverteu.
3. **Risco mal calibrado.** Muita energia nos anti-padrões já conhecidos (números FSRS), pouca nos problemas de compreensão reais (o que é "Quase"?). → *Pergunte o que o usuário precisa entender, não só o que não pode ver.*
4. **Valor onde solta.** As partes mais bem-sucedidas foram onde o prompt disse "a forma é sua". As fricções foram onde prescreveu estrutura.
5. **Defaults de baixa ambição.** Onde o prompt deu um layout mínimo ("coluna única centrada" no Login), o resultado foi "pobre". Telas de marca/entrada precisam que o prompt **peça ambição visual**, não só liste campos. → *Distinga mecânica (vinculante) de ambição de marca (aberta, mas explicitamente pedida).*
6. **O prompt descreve o mecanismo e esquece o valor de marca.** Recorrente: o prompt fixa *como* o produto funciona (ler→revisar, 3 sentidos) e nunca *por que importa* para a pessoa (lembrar qualquer coisa que ela escolher). Isso me levou a enquadrar o Lekto como "só leitura" na waitlist. → *Todo prompt de tela com superfície de valor deve declarar a promessa de marca e sua amplitude, não só o fluxo.*
7. **Telas viram ilhas sem um contrato de casca.** O prompt descreve cada tela isoladamente e nunca exige montá-la dentro da navegação persistente do app (a casca está só no inventário do prompt do DS). Produzi telas soltas até o operador apontar. → *O prompt de telas precisa de uma seção de "casca de app" no topo: nav persistente, quais telas a usam, item ativo por tela, padrão de sub-página/voltar, diferenças mobile×desktop. Fixado em `DESIGN-CONVENTIONS.md`.*
8. **Polimento fino é invisível ao prompt — só o olho do operador pega.** Herança de cor em superfícies de marca, papéis de autoria fundidos, consistência de ícone ("círculo denso" destoa), ritmo de espaçamento de um cover responsivo: nenhum prompt anteviu, todos exigiram marcação direta. → *Não espere que o prompt cubra acabamento; reserve ciclos de comentário para isso e capture cada correção como convenção para não repetir na próxima tela.*
9. **Responsividade não é "o mesmo componente, menor".** Âncoras/padding de um cover de proporção fixa (desktop 3/4) quebram o mesmo cover em altura automática (mobile). Vários ajustes foram tornar espaçamento/aspecto **condicionais ao device**. → *Trate mobile e desktop como layouts distintos do mesmo conteúdo, não escala um do outro.*
10. **Componentizar é refator de momento certo — e a extração tem regressões previsíveis.** O arco da Explorar (v1 isolada → v2 facetas → DeckCard + AppShell + navegação) confirmou: (a) **antecipe só a casca**, componentize conteúdo (card) quando o padrão se repete ~2–3× e foi aprovado; (b) ao extrair a casca, o **mount do componente precisa repassar `height:100%`** ou a casca colapsa (tab bar sobe, vão embaixo, full-bleed não preenche); (c) animação de entrada **nunca** com `opacity:0`+`both` (congela invisível em aba de fundo) — só `transform`; (d) ao parametrizar um componente por dados (deck), **todo conteúdo rico precisa vir nos dados** (desc, samples, bookAuthor) senão o fallback fica magro; (e) **separe papéis de pessoa** no modelo (autor da obra × dono do deck) desde o dado. → *Detalhes em `DESIGN-CONVENTIONS.md` (Arquitetura de componentes + STATUS).*
11. **Harness de "setar estado/tela na mão" vira a própria confusão.** Um app-shell que deixa pular para qualquer tela e forçar qualquer estado **borra o que é alcançável de verdade**. Solução que o operador validou: **app é só navegação real** (telas não alcançáveis somem → sinal de "ainda isolada"); o que é meta/dev (device, theme, estados que o uso natural não produz como catálogo vazio/nº de decks) vira **tweak (data-props)**, nunca falsa-navegação. E **o controle real do app tem que funcionar** — o tweak é atalho, não substituto (o switch de tema do Perfil precisa chamar `setTheme` do app, não só estado local). → *Briefe o app com "navegação real + tweaks para o inatingível", não com um seletor de telas.*
12. **Tela nova = componente de conteúdo, não cópia do harness legado.** Mesmo com a regra 11 escrita, ao criar a Biblioteca recriei a barra de Estados + moldura + casca dentro do arquivo (porque os arquivos antigos ainda carregam esse molde legado). O operador cortou: *"cada página e item são componentes; não criamos páginas avulsas."* → *Toda tela nova nasce só-conteúdo (lê device/theme/appState/onNav das props; moldura/tema/casca vêm do `Lekto`); estado não-natural vira tweak no `Lekto`. O harness das telas antigas é dívida a remover, não exemplo. Conferir isto ANTES de escrever a primeira linha de uma tela nova.*
