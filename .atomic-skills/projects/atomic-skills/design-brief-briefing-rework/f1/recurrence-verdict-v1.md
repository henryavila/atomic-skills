<!--
PROVENIÊNCIA (T-004 · F1 · design-brief-briefing-rework)
- Veredito de um CRÍTICO ADVERSARIAL FRESCO (subagente read-only, independente), alimentado com:
  f1/lekto-feedback.md (feedback real) + f1/recurrence-rubric.md (rubrica/frame) + f1/lekto-briefing-regenerated.md (briefing julgado).
- Transcrição fiel do retorno do crítico. A thread principal (implement) apenas persistiu; não editou o julgamento.
- scopeBoundary T-004: roda o crítico e persiste o veredito. NÃO corrige a skill (correção → follow-up em T-005).

RESULTADO: NÃO-LIMPO — 1 recaída (A4). O marcador de não-reincidência (o token que o gate F1-G1 procura)
foi DELIBERADAMENTE OMITIDO porque há recaída; logo F1-G1 falha até a recaída ser resolvida (T-005/D10).
-->

# Veredito do crítico adversarial — não-reincidência

> **Resultado:** NÃO-LIMPO. Um sobre-vínculo flagrado (**A4**). Dispara a cláusula D10.
> O marcador de não-reincidência (forma acentuada usada de propósito para não falsear o gate F1-G1) **não foi gravado**.

## A. Contaminantes

- **A1 (`SWIPE_THRESHOLD=80px`)** AUSENTE-ok — L225-227: *"que **perdoa um toque acidental** (abaixo de um limiar pequeno, o cartão volta ao lugar)"* — o limiar sobrevive só como comportamento qualitativo ("limiar pequeno"), sem valor em px; a mecânica morreu no filtro D3. Nenhum "80" aparece em nenhuma autoridade. Enquadramento = comportamento, não constante.
- **A2 (`AXIS_LOCK_DISTANCE=10px`)** AUSENTE-ok — L227-228: *"o mapeamento exato de eixo é **refinável** … Uma **direção de escape** (oposta à expressão parcial) **cancela** o gesto"* — não há trava-de-eixo prescrita nem distância em px; o redesign fica livre (eixo "refinável"). O bug de UX do app antigo não foi assado. Nenhum "axis-lock" nem "10" presente.
- **A3 (copy "Vai!")** AUSENTE-ok — L237: *"uma **contagem de preparação curta (~3–4s**, hoje 3→2→1→'Vai!')"* — "Vai!" aparece SÓ como descrição do estado atual ("hoje …"), dentro do bloco rotulado *calibração atual* (L217), e o copy é explicitamente lane mutável por D3 (L52-54, "o que vincula é o ato-de-fala, não a palavra"). É citação com banda, não copy vinculante. Enquadramento = textura mutável, não requisito.
- **A4 (onboarding "3 passos")** PRESENTE-recaída (limítrofe, mas não-isenta) — L237-238: *"Só na primeiríssima sessão, uma explicação de **3 passos** (ler→revelar→avaliar) aparece antes"* e L253/L258: *"(1ª vez: explicação de **3 passos** →)"* e *"primeira-vez (explicação de 3 passos)"*. O número 3 aparece três vezes no briefing **sem rótulo de calibração-mutável e sem banda** — não diz "hoje 3, ajustável" nem "uma explicação de primeira-vez (sem cravar a contagem)". A rubrica A4 exige exatamente: "há um onboarding de primeira-vez como comportamento, **sem cravar a contagem como teto**". Aqui a contagem está cravada e até enumerada (ler→revelar→avaliar), reproduzindo o artefato de código que o operador reverteu (pediu um 4º passo). O bloco 4 está sob o cabeçalho "calibração atual" (L217), mas o "~8s" e o tamanho de sessão receberam a banda explícita ("da ordem de segundos", "hoje 10, ajustável"); o "3 passos" **não** recebeu nenhuma — fica como número absoluto. Falha o teste D5 (sem banda) e D6 (sem credencial de camada-3 que justifique 3 como intenção de produto — não é intenção, é artefato).

## B. Padrões transversais

- **P1 (mineração vira camisa-de-força)** AUSENTE-ok — L80, L170-172: as três autoridades são separadas e a camada 2 é rotulada *"calibração atual … o valor exato é o que o app faz hoje (~8s), melhorável"*; nomes de componente viraram papéis semânticos (L107-135). Nenhuma constante carimbada "vinculante". (A exceção pontual é o "3 passos" — flagrada em A4, não generalizada.)
- **P2 (copy em prompt de comportamento)** AUSENTE-ok — L210, L278, L318, L385, L439: toda copy está em linhas rotuladas `copy (mutável)` e roteada ao lane mutável (D8); o preâmbulo (L171) afirma "o valor exato … melhorável" e D3 (L54) "vincula o ato-de-fala, não a palavra".
- **P3 (risco mal calibrado / não ensina compreensão)** AUSENTE-ok — L228, L251: exige *"as três devem ser igualmente rápidas e **mutuamente inconfundíveis**, com **reforço redundante além da cor**"* e crava como guardrail *"a expressão intermediária ('quase') é o diferencial do produto e **deve existir**"*. O briefing exige que o design distinga/ensine os 3 sentidos — a omissão original foi corrigida.
- **P4 (forma prescrita)** AUSENTE-ok — L85-88, L35: "a forma é sua", camada-1 em silêncio; tokens por papel sem valor literal (L90-94). Nenhuma cor/raio/tipografia pixel prescrita.
- **P5 (defaults de baixa ambição)** AUSENTE-ok — L309-356: Login e Waitlist NÃO recebem "coluna única centrada"; ao contrário, pedem identidade de marca, lema, acento serifado de marca (L356), superfícies de vidro. Nenhum layout mínimo carimbado.
- **P6 (mecanismo sem valor de marca)** AUSENTE-ok — L17, L321-327: declara o lema/promessa e a amplitude ("transforma destaques, notas de áudio e cartões manuais"; claims reais). Não enquadra o Lekto como "só leitura" — Waitlist comunica proposta ampla.
- **P7 (telas-ilha sem casca)** AUSENTE-ok — L58-71 (ledger de rotas com coluna "Layout: shell vs fullscreen"), L117-118 (casca de navegação como componente do DS com destinos nomeados e regra de promoção), e cada tela declara seu consumo da casca (L414). Há contrato de shell explícito.
- **P8 (polimento fino fingido)** AUSENTE-ok — não há prescrição de herança-de-cor/papéis-de-autoria/ícone/espaçamento como regra de forma; acabamento fica para a camada-1. Restrições (L262-263, L302) são comportamentais, não de forma.
- **P9 (responsividade "o mesmo, menor")** AUSENTE-ok — L174-175, L411, L461: "mobile e desktop obrigatórios em cada tela"; grade "reflui de 1 → múltiplas colunas"; referência de mapeamento visível em desktop, oculta em mobile — tratados como layouts distintos, não escala.
- **P10 (arquitetura de componentes como requisito)** AUSENTE-ok — nenhum `height:100%`, `opacity:0`, props de mount ou mecânica de extração no briefing; mecânica de impl. morreu em D3.
- **P11 (harness/seletor de telas como falsa-nav)** AUSENTE-ok — o briefing modela rotas reais (L58-68) e estados naturais por tela (L257-260); não há seletor de telas nem falsa-navegação carimbada. Estados representativos de Explorar são sinalizados como dado (L364-368), não como pular-para-tela.
- **P12 (harness legado como exemplo)** AUSENTE-ok — não há control-bar/frame/casca-por-arquivo tratados como exemplo; o DS define a casca uma vez (L117, L137-142, template-base único). Nenhuma replicação de molde legado.

## C. Invariantes que devem sobreviver

- **"julga memória, não agenda" (sem dia/data no responder)** PRESENTE-ok — L243-245: *"A pessoa julga **apenas a própria memória**"* + PROIBIDO *"mostrar '+N dias' / próximo intervalo"* e *"qualquer número no caminho de responder"*.
- **"o intervalo (quando volta) nunca aparece"** PRESENTE-ok — L243-244: *"o **próximo intervalo** … não aparecem"*; reforçado em L248.
- **"~3 níveis de sentido" (banda de granularidade)** PRESENTE-ok — L225-228: *"**3 expressões humanas**"* + *"reduzir a avaliação a binário … 'quase' … **deve existir**"* (L251) — a banda de 3 níveis sobrevive como guardrail, sem prescrever paleta.
- **offline enfileira / nunca descarta** PRESENTE-ok — L239-240: *"durável offline — capturada localmente e reconciliada … A pessoa **nunca é bloqueada**"*; estado *offline (avaliações em fila)* (L259).
- **"Fácil" é inferido, não 4º botão** PRESENTE-ok — L229-232: *"A 4ª saída de agendamento ('facilidade') é **INFERIDA**, não escolhida … **Nunca** vira uma 4ª opção"* + PROIBIDO *"expor a 'facilidade' inferida como escolha separada"* (L249).

## Afirmação explícita sobre os 4 contaminantes

Dos quatro contaminantes documentados: **SWIPE_THRESHOLD=80px (A1), AXIS_LOCK_DISTANCE=10px (A2) e copy "Vai!" (A3) NÃO reaparecem como requisito** — A1/A2 morreram no filtro (sem px, sem trava-de-eixo, eixo "refinável"); A3 reaparece como string, mas SÓ como textura atual mutável rotulada "hoje", no lane explícito de copy mutável. **O onboarding "3 passos" (A4) reaparece como número cravado** — três menções, enumerado (ler→revelar→avaliar), sem banda ("hoje 3, ajustável") e sem credencial de camada-3, dentro de um bloco onde os vizinhos (~8s, 10 cartões) receberam banda e ele não. Isso é o artefato de código tratado como teto — exatamente o que o operador reverteu ao pedir um 4º passo.

## Veredito final

Não está limpo. Um sobre-vínculo flagrado:

- **A4 — onboarding "3 passos"**: contagem cravada (L237-238, L253, L258) sem band-pin (D5) nem credencial de camada-3 (D6); reproduz o artefato de `ReviewOnboarding.vue` como requisito, contra a reversão do operador (4º passo).

DISPARA D10

## Recomendação para T-005 (resolução de D10)

O modelo leve D3-D8 **basta** para fechar esta única recaída sem escalar à tag R10: A4 é um band-pin faltante isolado, idêntico em forma ao tratamento já correto do "~8s"/"10 cartões". A correção é local — reescrever a linha do ritual para *"uma explicação de primeira-vez (hoje 3 passos, ajustável; o operador já pediu um 4º) — sem cravar a contagem"*, aplicando o mesmo rótulo calibração-com-banda dos vizinhos. Só escale à tag explícita por valor (R10) se um segundo passe encontrar mais de um valor sem banda; com um único item, a tag seria peso desproporcional.
