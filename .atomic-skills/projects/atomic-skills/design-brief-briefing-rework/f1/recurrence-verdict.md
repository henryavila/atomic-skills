<!--
PROVENIÊNCIA (T-004 re-run / v2 · F1 · design-brief-briefing-rework)
- Veredito de um CRÍTICO ADVERSARIAL FRESCO (subagente read-only, independente), alimentado com:
  f1/lekto-feedback.md + f1/recurrence-rubric.md + f1/lekto-briefing-regenerated.md (v2, regen CEGO VÁLIDO
  da cópia limpa /home/henry/lekto-blind-regen, gerado from-code, após o fix T-006).
- Transcrição fiel do retorno do crítico. A thread principal (implement) apenas persistiu; não editou o julgamento.
- v1 (NÃO-LIMPO, recaída A4) preservado em f1/recurrence-verdict-v1.md.

RESULTADO: LIMPO — marcador NAO-REINCIDENTE gravado (abaixo). O gate F1-G1 passa.
-->

# Veredito do crítico adversarial — não-reincidência (v2)

## A. Contaminantes

- **A1 (`SWIPE_THRESHOLD=80px`)** AUSENTE-ok — L154: *"um movimento curto e claro o confirma; um movimento pequeno é ignorado e o card volta ao lugar"*. O limiar sobrevive só como **comportamento** ("há um movimento mínimo antes de valer"), sem nenhum valor em px. Nenhuma string "80" aparece no documento. Morreu no filtro D3 — enquadramento correto.
- **A2 (`AXIS_LOCK_DISTANCE=10px`)** AUSENTE-ok — L154: *"um movimento na direção 'errada'/para cima cancela sem avaliar"*. O cancelamento de direção contrária sobrevive como gesto, mas **não há trava-de-eixo prescrita** nem distância em px; o redesign fica livre para não travar eixo. O bug de UX do app antigo não foi assado. Nenhuma string "10px"/"axis-lock"/"trava de eixo".
- **A3 (copy `"Vai!"`)** AUSENTE-ok — aparece em DOIS lugares, ambos no enquadramento correto: (1) L149 como **calibração band-pinned** *"(calibração: três contagens de ~1 s e um 'vai!' de ~0,8 s)"* sob a banda *"um aquecimento curto, de poucos batimentos"*; (2) L664 no **lane de copy mutável** *"countdown 'Prepare-se' → 3 / 2 / 1 / 'Vai!'"* com o cabeçalho L650-651 *"O agente PODE reescrever as palavras… O que vincula é o ato de fala, não a string."* Em nenhum ponto "Vai!" é prescrito como copy vinculante no prompt de comportamento — ao contrário, R4 (L164-166) explicita *"As palavras exatas dos rótulos são copy mutável"*. D8 satisfeito.
- **A4 (onboarding "3 passos")** AUSENTE-ok — L161-162 enquadra como banda + calibração: *"um explicador de poucos passos (calibração: 3)"* — a banda vinculante é "poucos passos", o "3" é calibração-atual-melhorável, não teto. Os 3 passos literais (L666) estão no lane de copy mutável. O número não é carimbado como requisito; o 4º passo que o operador quis cabe na banda.

## B. Padrões transversais

- **P1 (mineração vira camisa-de-força)** AUSENTE-ok — L112-115: o preâmbulo separa explicitamente as três autoridades e diz que comportamento de interação é *"a calibração atual do app… o valor exato é o que o app faz hoje (~8s), melhorável"*. Nenhum nome de componente/constante carimbado "vinculante"; tudo da camada 2 vem band-pinned (D5).
- **P2 (copy em prompt de comportamento)** AUSENTE-ok — L166: *"o que vincula é o ato de fala… não a string"*; toda copy literal roteada ao lane de textura (L649-678). Enquadramento D8 correto.
- **P3 (risco mal calibrado — ensinar a compreensão)** AUSENTE-ok — o briefing exige ensinar a distinção dos 3 sentidos: L155 nomeia *"três expressões humanas — negativa, parcial e positiva ('errei / quase / lembrei')"* e L96 / L34 obrigam segundo canal além da cor para esses três papéis, com a banda "~3 níveis" explícita em C. Não só investe no anti-padrão FSRS conhecido — cobre a compreensão. Cobertura presente.
- **P4 (valor onde solta / forma aberta)** AUSENTE-ok — L13 *"a forma é sua escolha"*, L113 *"Forma visual… é sua para decidir"*, L164 proíbe nomear widget/cor/borda. Camada 1 silenciada, não prescrita.
- **P5 (defaults de baixa ambição)** AUSENTE-ok — Login (Tela 2) e Landing (Tela 1) **não** recebem "coluna única centrada" nem layout mínimo carimbado; L199-204 pedem mensagem-âncora, diferenciais e demonstração de filosofia. Nenhum default de baixa ambição prescrito.
- **P6 (mecanismo sem valor de marca)** AUSENTE-ok — L202-204 / L654 expressam a amplitude (retenção + diferenciais de marca); o produto não é enquadrado como "só leitura" — a Landing pede a promessa de marca, não só o fluxo.
- **P7 (telas viram ilhas sem casca)** AUSENTE-ok — a casca é contrato de primeira classe: DS L51 *"Casca de aplicação com navegação principal persistente"* + cobertura de 5 destinos desktop / 4 mobile, e cada tela declara item ativo / sub-página / volta (ex. L364, L460).
- **P8 (polimento fino fingido)** AUSENTE-ok — o briefing **não** crava regras de acabamento como forma; mantém WCAG como restrição mensurável (L91-96) e deixa a forma à camada 1.
- **P9 (responsividade ≠ "o mesmo, menor")** AUSENTE-ok — trata mobile/desktop como layouts distintos: L286-287 *"Densidade divergente por porte de tela"*, L442-443 heatmap "~20 semanas no desktop, ~4 no mobile".
- **P10 (mecânica de extração como requisito)** AUSENTE-ok — nenhum `height:100%`, `opacity:0+both`, ou prop de implementação aparece; tudo morreu em D3. Apenas comportamento/estados.
- **P11 (harness = seletor de telas)** AUSENTE-ok — app modelado por navegação real (L296, L364); estados não-naturais vêm das fixtures como estados de primeira classe (L455, L612-619), não falsa-navegação.
- **P12 (tela nova = harness legado)** AUSENTE-ok — nenhuma referência ao molde legado como exemplo; o DS define a casca única herdada (L51, L84-88, um template-base).

## C. Invariantes que devem sobreviver

- **"julga memória, não agenda / nenhum dia-data no caminho de responder"** PRESENTE-ok — L168-169: *"A pessoa julga a própria memória, nunca o cronograma"*; L176 *"Nenhum número no caminho de resposta."*
- **"o intervalo nunca aparece"** PRESENTE-ok — L169-170: *"O intervalo, a data da próxima revisão… não aparecem"*; L174-175 proíbe "+N dias"/"revisar em X".
- **"~3 níveis de sentido (banda de granularidade)"** PRESENTE-ok — L155 *"três expressões humanas"*; L176 proíbe reduzir a dois (binário) ou oferecer um quarto.
- **offline enfileira / nunca descarta** PRESENTE-ok — L186-187: *"a avaliação é registrada e sincronizada depois; a revisão não trava por falta de rede"*.
- **"Fácil" é inferido, não 4º botão** PRESENTE-ok — L171-173: *"Que isso valha Good ou Easy é inferido pelo sistema… não é uma 4ª opção a ponderar"*; L175 proíbe quarto nível.

Nenhum invariante de C está FALTANTE.

## Afirmação explícita sobre os 4 contaminantes

Os quatro contaminantes documentados **reaparecem textualmente, mas NENHUM como requisito/copy vinculante no prompt de comportamento**:
- **SWIPE_THRESHOLD=80px** — AUSENTE como valor; sobrevive só como comportamento sem px (morto em D3).
- **AXIS_LOCK_DISTANCE=10px** — AUSENTE como valor; o cancel-de-direção sobrevive como gesto, sem trava-de-eixo nem px (morto em D3).
- **"Vai!"** — reaparece como (a) calibração **band-pinned** (L149) e (b) **textura mutável** (L664), explicitamente reescrevível; nunca como copy vinculante.
- **onboarding "3 passos"** — reaparece como **calibração com banda** ("poucos passos", L161-162) e textura mutável (L666); o "3" não é teto.

Nenhuma mecânica de implementação (px, axis-lock, ms de debounce) aparece em qualquer autoridade vinculante. O único valor numérico fino — o timer `clamp(4 + palavras×0.6, 5, 15)` (L532) — está expresso em **segundos** sob a banda explícita *"da ordem de segundos é o que vincula"*, ou seja band-pin D5 (camada 2), não a classe de mecânica-de-implementação que morre em D3.

## Veredito final

NAO-REINCIDENTE

## Recomendação para T-005 (resolução de D10)

D10 **não dispara** — não há sobre-vínculo a resolver, então T-005 não precisa escalar para a tag R10. O modelo leve D3-D8 bastou e se sustentou de ponta a ponta: o filtro D3 matou as duas mecânicas em px, o band-pin D5 absorveu cadência/aquecimento/passos, e o lane de textura D8 absorveu toda a copy literal — exatamente o que o redesign do briefing pretendia. Registrar este resultado como evidência positiva de que o modelo de três camadas é suficiente sem a tag explícita-por-valor.
