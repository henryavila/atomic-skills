<!--
PROVENIÊNCIA (T-003 · F1 · design-brief-briefing-rework)
- Destilada de f1/lekto-feedback.md (T-001, seção "Padrões transversais" #1–#12 + os 4 contaminantes citados).
- Ancorada no modelo de autoridade reescrito na F0: modelo de TRÊS CAMADAS + filtro D3 + band-pin D5 +
  credencial D6/D7, e nos 4 critérios de aceitação canônicos (design.md:147-156) + cláusula D10.
- Função: âncora REPRODUZÍVEL do crítico adversarial (T-004). O crítico classifica CADA item abaixo como
  AUSENTE (ok) ou PRESENTE (recaída) no briefing regenerado (f1/lekto-briefing-regenerated.md), e dispara
  D10 (escalar para a tag) se houver QUALQUER sobre-vínculo flagrado.
- scopeBoundary T-003: converte padrões → itens verificáveis. NÃO roda a skill nem o crítico.
-->

# Rubrica de não-reincidência — briefing Lekto (D9)

## Frame de adjudicação (como ler cada anti-sinal)

O modelo de três camadas (design.md:15-17):

- **Camada 1 — forma visual** → a skill é **SILENCIOSA**. Anti-sinal de camada-1 = qualquer prescrição de
  forma (cor exata, raio, tipografia, layout pixel).
- **Camada 2 — modelo de interação** → **CALIBRAÇÃO ATUAL do produto**, especificada com banda vinculante +
  valor-atual-melhorável (band-pin, D5). A banda comportamental vincula (ex.: "cadência da ordem de
  *segundos*"); o valor é mostrado como **hoje, melhorável**.
- **Camada 3 — filosofia / quem-decide / o-que-fica-oculto** → **guardrail VINCULANTE**.

**A regra que separa reincidência de layering correto** (D3/D5/D6):

| Veredito | Condição |
|---|---|
| ✅ **AUSENTE (ok)** | O valor (a) morreu no filtro D3 (mecânica de implementação — px, axis-lock, debounce-ms, nunca minerada); OU (b) virou essência/filosofia (camada 3); OU (c) aparece como **calibração-com-banda** (D5): banda vinculante + valor rotulado *atual/melhorável*; OU (d) é invariante legítimo que **rastreia** uma intenção de produto (credencial D6/D7). |
| ❌ **PRESENTE (recaída)** | O valor é prescrito como **requisito/vinculante** SEM banda (D5) E SEM credencial de camada-3 rastreável (D6) — i.e. "o app faz X hoje" foi carimbado como "o redesign deve fazer X". **Mecânica de implementação** (px, axis-lock, ms) presente em QUALQUER autoridade = recaída automática (devia morrer em D3). |

> **Nuance load-bearing (não simplificar):** a mera *menção textual* de um contaminante NÃO é recaída. O
> briefing PODE citar o estado atual ("hoje 3→2→1→…") **se** estiver rotulado como calibração mutável /
> contexto, não como requisito. A recaída é o **vínculo** (carimbar como "vinculante/requisito" sem banda
> nem credencial), não a citação. O crítico julga o ENQUADRAMENTO, não a presença da string.

---

## A. Os quatro contaminantes documentados (anti-sinais explícitos)

Critério de aceitação canônico #1 (design.md:149-150): nenhum reaparece **como valor/requisito** — todos
devem ter morrido no filtro D3 ou virado essência.

| # | Contaminante | Origem (app antigo) | Anti-sinal de recaída (PRESENTE) | Veredito ok (AUSENTE) |
|---|---|---|---|---|
| A1 | **`SWIPE_THRESHOLD=80px`** | `ReviewCard.vue` | Qualquer **limiar de swipe em px** (80px ou outro) aparece em qualquer camada. Mecânica de implementação ⇒ deve morrer em D3. | Ausente; ou só "há um limiar de deslocamento antes de valer" como comportamento, **sem valor px**. |
| A2 | **`AXIS_LOCK_DISTANCE=10px`** | `ReviewCard.vue` | **Axis-lock** (trava de eixo) ou distância em px prescrito como comportamento. Era um **bug de UX do app antigo**; congelá-lo = assar o bug. | Ausente; o redesign é livre para não travar eixo. |
| A3 | **copy `"Vai!"`** | `ReviewCountdown.vue` `GO_MS=800` | A palavra **"Vai!"** (ou qualquer palavra de copy exata da contagem) prescrita como **copy vinculante** do ritual. Copy nunca pertence a prompt de comportamento (layer c / D8 → textura mutável). | Ausente; ou citada só como textura atual mutável ("hoje exibe 'Vai!'") explicitamente melhorável, nunca como requisito. |
| A4 | **onboarding "3 passos"** | `ReviewOnboarding.vue` | O **número 3** (ou os 3 passos listados) fixado como **requisito** do onboarding. O número era artefato do código (o operador quis um 4º passo). | Ausente; ou "há um onboarding de primeira-vez" como comportamento, **sem cravar a contagem** como teto. |

---

## B. Padrões transversais do feedback (#1–#12 → anti-sinais)

Critérios canônicos #2–#4 (design.md:151-156). Cada padrão vira um item que o crítico marca AUSENTE/PRESENTE.

| # | Padrão transversal (feedback) | Anti-sinal de recaída no briefing regenerado |
|---|---|---|
| P1 | **Mineração de código vira camisa-de-força** | Algum valor/nome-de-componente/constante do app atual aparece carimbado **"vinculante"/"requisito"** em vez de calibração-com-banda (D5) ou contexto. Falta a credencial de camada-3 (D6). |
| P2 | **Copy não pertence a prompt de comportamento** | Qualquer **palavra de copy exata** ("Vai!", rótulos, microcopy) prescrita como vinculante no modelo de interação, em vez de roteada ao canal de textura mutável (D8). |
| P3 | **Risco mal calibrado** | O briefing investe nos anti-padrões já conhecidos (ex.: "sem número FSRS no caminho de responder") mas **não exige que o design ensine a compreensão** (ex.: o que é "Quase" / a distinção entre os 3 sentidos). Omissão = recaída de cobertura. |
| P4 | **Valor onde solta** (forma aberta) | A camada 1 (forma visual) é **prescrita** em vez de silenciada (cor/raio/tipografia/layout pixel). Viola o silêncio de forma. |
| P5 | **Defaults de baixa ambição** | Telas de marca/entrada (Login, Waitlist) recebem layout mínimo prescrito ("coluna única centrada") em vez de **pedir ambição de marca**. Mecânica de baixa ambição carimbada como requisito. |
| P6 | **Mecanismo sem valor de marca** | O briefing fixa *como* funciona (ler→revisar, 3 sentidos) e **omite a promessa/amplitude de marca** (lembrar qualquer conhecimento, não só leitura). Enquadrar o Lekto como "só leitura" = recaída. |
| P7 | **Telas viram ilhas sem contrato de casca** | As telas são descritas isoladas, **sem uma seção de "casca de app" no topo** (nav persistente, quais telas a usam, item ativo, sub-página/voltar, mobile×desktop). Ausência do contrato de shell = recaída. |
| P8 | **Polimento fino invisível ao prompt** | O briefing **finge cobrir acabamento** (herança de cor, papéis de autoria, consistência de ícone, ritmo de espaçamento) cravando regras de forma — em vez de deixar à forma (camada 1) e reservar ciclos de comentário. Prescrição de acabamento = recaída de camada-1. |
| P9 | **Responsividade não é "o mesmo, menor"** | Âncoras/padding/aspecto de um device prescritos como universais (forma) — em vez de tratar mobile/desktop como **layouts distintos** do mesmo conteúdo. Prescrição de forma responsiva = recaída. |
| P10 | **Componentizar é refator de momento certo** | O briefing prescreve **arquitetura de componentes / mecânica de extração** (height:100%, opacity:0+both, props) como requisito de design — isso é implementação, não briefing. Mecânica de impl. = morre em D3. |
| P11 | **Harness de "setar estado na mão" vira confusão** | O briefing modela o app como **seletor de telas / falsa-navegação** em vez de "navegação real + tweaks para o inatingível". Falsa-navegação carimbada = recaída. |
| P12 | **Tela nova = componente de conteúdo, não harness legado** | O briefing trata o molde legado (control-bar/frame/casca por arquivo) como exemplo a seguir, em vez de dívida a remover. Replicar o harness legado = recaída. |

---

## C. Invariantes legítimos que DEVEM sobreviver (critério #3 — sub-especificação também é falha)

O modelo leve **não pode** sub-especificar de volta para o silêncio. O crítico marca FALTANTE se algum sumir:

- "julga **memória, não agenda**" (nenhum dia/data no caminho de responder).
- "o **intervalo** (quando volta) **nunca aparece** para a pessoa".
- "~**3 níveis** de sentido" (a banda de granularidade do julgamento) — banda, não a paleta de cor.
- offline **enfileira / nunca descarta**.
- "Fácil" é **inferido**, não um 4º botão no caminho de responder.

---

## D. Protocolo de veredito (entrada de T-004)

O crítico adversarial (T-004), alimentado com `f1/lekto-feedback.md` + esta rubrica + o briefing regenerado:

1. Para **cada** item de A (A1–A4), B (P1–P12) e C → classifica **AUSENTE (ok)** ou **PRESENTE (recaída)**,
   citando a evidência (linha do briefing) e aplicando o **frame de adjudicação** (citação ≠ recaída;
   julga-se o enquadramento).
2. Afirma **explicitamente** se algum dos quatro contaminantes (A1–A4) reaparece **como requisito**.
3. Grava o marcador **`NAO-REINCIDENTE`** em `f1/recurrence-verdict.md` **se e somente se** nenhum item de A
   é PRESENTE-como-requisito, nenhum padrão de B recai, e nenhum invariante de C falta.
4. Se **qualquer** sobre-vínculo for flagrado → **dispara D10** (escalar para a tag explícita por valor, R10),
   registrado como recomendação em T-005. (design.md:156, D10:103-110)
