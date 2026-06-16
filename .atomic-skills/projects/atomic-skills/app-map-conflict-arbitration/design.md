# app-map: descritor de conflito rico + canal de arbitragem

Evolui o descritor de conflito do catálogo `app-map` para representar **N testemunhas**
(≥2) sem descarte silencioso, honrando o princípio **P2 — nunca escolher no silêncio**.
Origem: review-code da F2 do plano `design-brief-source-of-truth` (findings #2/#3,
deferidos por exigirem decisão de design), idea #3 do inbox, lessons L-001/L-002. A
decisão de forma foi fechada por um debate de 4 vozes (`atomic-skills:debate`, 2026-06-16).

## Context

A skill `design-brief` reconstrói um catálogo `app-map.json` das páginas de um app-alvo,
justapondo evidência de **código** (rotas/arquivos) + **docs** (PRDs, ADRs…). Quando as
fontes discordam sobre um campo de uma página (`audience` = segmento; `accessTier` =
visibilidade/gate), é um **conflito** que o operador humano arbitra.

Hoje (schema `0.2`) um conflito é `{ field, artefactValue, codeValue, evidence, resolution }`
— **dois valores posicionais**. Com ≥3 testemunhas discordantes (ex: 3 docs dizendo
`admin`/`registered`/`guardian`), só dois cabem; o 3º+ é silenciosamente descartado dos
campos estruturados (sobra na string `evidence`). **Isso viola o P2, assado no formato
binário** (review F2 finding #2). O irmão #1 (atribuição code/artefato por posição) já foi
corrigido na F2 (`f265aff`): `codeValue` hoje deriva por proveniência real (a `source` casa
o path do `codeEvidence` da página), `null` sem testemunha de código.

**Nada está persistido ainda** — nenhum `app-map.json 0.2` existe em uso, nenhum consumidor
fora do repo (confirmado pelo operador, 2026-06-16). Logo a evolução pode remover os slots
**limpa**, sem migração de dados nem janela de retrocompat.

`verified_by: .atomic-skills/reviews/2026-06-16-1702-design-brief-source-of-truth-f2.md`
(findings #2/#3); `verified_by: meta/schemas/app-map.schema.json` (conflict `$def`, 0.2).

## Decisions

- **D1 — Conflito é um CONJUNTO de testemunhas, não dois lados.** Substituir
  `artefactValue`/`codeValue` por `witnesses: [{ value, source, kind }]` (abordagem C do
  debate). Cada testemunha carrega seu valor + proveniência (`source`) + a natureza da fonte
  (`kind: code | artefact`). N=2, N=3, N=7 cabem sem caso especial → o truncamento do finding
  #2 deixa de ser **representável**. `verified_by: src/app-map/diverge.js` (o motor já agrega
  todas as `sources` por campo — `fieldTuples`/`aggregateField`; o descarte era só na
  gravação, em `conflictForField`).

- **D2 — `kind` é DERIVADO-NA-ORIGEM, jamais afirmado independentemente.** O produtor computa
  `kind` com a MESMA regra que hoje deriva `codeValue` (a `source` casa `page.codeEvidence.path`
  → `code`; senão `artefact`). Não é uma segunda fonte de verdade concorrente (o pecado da
  abordagem B): é a derivação canônica **preservada no ponto onde o contexto da página existe**,
  para que a UI de arbitragem e o Step 2 nunca reimplementem string-matching de path frágil.
  Uma regra de integridade no validador garante que `kind` ∈ `{code, artefact}` e que a forma
  é consistente.

- **D3 — Remover os slots `artefactValue`/`codeValue` (sem espelho).** Justificado por D-context:
  nada persistido + sem consumidor externo → retrocompatibilidade não é uma restrição real;
  manter os slots seria a duplicidade que 3 das 4 vozes condenaram. A voz de Migração defendia
  o espelho retrocompat — esvaziada pela ausência de dados/consumidores.

- **D4 — `resolution.choice` referencia a testemunha vencedora por VALOR + SOURCE, não por
  índice posicional.** Sobrevive a reordenação/regeneração do catálogo (o catálogo é
  re-emitido a cada reconstrução). O `resolution` continua o objeto de decisão do operador do
  0.2 (`{ resolvedBy, resolvedAt, choice }`), só que `choice` aponta uma testemunha existente.

- **D5 — Bump `schemaVersion` `0.2` → `0.3`, aditivo por `if/then`-por-versão.** O schema já
  coexiste 0.1/0.2 via `allOf` condicional; o 0.3 entra como novo ramo. `0.1`/`0.2` seguem
  lendo válidos por disciplina de versionamento, mesmo sem dados. `verified_by:
  meta/schemas/app-map.schema.json` (o `allOf` com `if schemaVersion==0.2`).

- **D6 — Arbitragem é PROGRAMÁTICO-ONLY; corrigir a prosa do §2 (finding #3).** O operador
  arbitra DENTRO do agente `design-brief` (via `{{ASK_USER_QUESTION_TOOL}}`), que chama
  `persistReconstruction({pages})` com as páginas já resolvidas. O CLI `--persist` é para
  re-emissão não-interativa, NÃO para persistir arbitragem. A prosa do §2 do `design-brief`
  é corrigida para não prometer um fluxo `--persist`-persiste-decisão. Um canal CLI
  `--resolved <arquivo>` fica fora de escopo (Open question, só se a via programática se
  mostrar insuficiente).

## Chosen approach

**Abordagem C "derivada-na-origem"** (vencedora do debate de 4 vozes; A como fallback teórico
descartado por D-context). `witnesses: [{value, source, kind}]` substitui os 2 slots, `kind`
derivado pelo produtor, `resolution.choice` por valor+source, bump `0.2`→`0.3`, arbitragem
programático-only + prosa-fix. Duas fases:

1. **F0 — Contrato:** schema `0.3` com o descritor `witnesses[]` + a regra de integridade no
   validador (`validate.js`), validável emit-time. É o contrato que a F1 produz/consome.
2. **F1 — Produtor, consumidores e prosa:** `conflictForField` emite `witnesses[]` (kind
   derivado); `resolution` por valor+source; o mirror `.md` lista as N testemunhas; a prosa do
   §2 do `design-brief` corrigida (D6); testes (incl. o caso N≥3 admin/registered/guardian).

## Non-goals

- **Não adiciona canal CLI de arbitragem** (`--resolved`) — arbitragem é programático-only (D6).
- **Não muda o motor de divergência** (`diverge.js` já agrega todas as testemunhas; o bug era
  só na gravação).
- **Não reabre a Revisão 2** do plano `design-brief-source-of-truth` nem o §4 (R2) / a
  anti-contaminação.
- **Não migra dados** — não há catálogo `0.2` persistido.

## Blast radius

- **Schema** `meta/schemas/app-map.schema.json` — o `conflict` `$def` muda de forma no ramo
  `0.3`; `enum` de `schemaVersion` ganha `0.3`. Aditivo: o ramo `0.2` fica intacto (porta de
  direção única respeitada — `0.2` lê válido). **Médio.**
- **Validador** `src/app-map/validate.js` — nova regra de integridade pós-schema (`kind`
  enum + `resolution.choice` ∈ `witnesses`), no estilo do `duplicatePageIdErrors` existente.
  **Baixo.**
- **Produtor** `src/app-map/reconstruct.js` — `conflictForField`/`conflictsForPage`/`toPageFact`
  emitem `witnesses[]`; `resolution` por valor+source. **Médio.**
- **Mirror** `src/app-map/persist.js` — `mirrorMarkdown` lista as N testemunhas por conflito.
  **Baixo.**
- **Prosa** `skills/core/design-brief.md` §2 — corrigir a promessa de `--persist` (D6). **Baixo.**
- **Testes** `test/app-map/{schema,validate,reconstruct,persist}.test.js` — atualizar o
  contrato + cobrir N≥3. **Médio.**
- **Migração de dados:** **nenhuma** — zero catálogos persistidos.

## Open questions

- **(a) `kind` materializado vs re-derivado** — fechado em D2 (materializado-na-origem) por
  baixo arrependimento: a UI de arbitragem ainda não existe e o Step 2 ainda não consome
  `conflicts[]` estruturado, e `kind` derivado é trivial de pôr/tirar. Se um dia se provar
  que todo consumidor tem o `codeEvidence` da página à mão, pode-se simplificar para a
  abordagem A (sem `kind`) — não-bloqueante. *(PLAN/impl — não muda a forma de fora.)*
- **(b) Canal CLI `--resolved`** — fora de escopo (D6). Reabrir só se a arbitragem
  programático-only se mostrar insuficiente na prática. *(futuro.)*

## Rejected alternatives

- **A — `candidates: [{value, source}]` sem `kind`.** Honesta e mínima, mas empurra a
  re-derivação `source→isCode` para CADA consumidor via string-matching de path frágil — o
  Consumidor da Arbitragem mostrou que a regra deve morar no produtor (que já a executa). A
  vira o fallback teórico se a Open question (a) inverter; não é a escolha.
- **B — Híbrido (`artefactValue`/`codeValue` + `candidates[]`).** **Fonte-da-verdade dupla**
  que pode divergir; redundância na tela do operador = combustível de fadiga (D9). Rejeitada
  por 3 das 4 vozes (Modelagem, YAGNI, Consumidor). A trava de invariante AJV que a salvaria
  não compensa, dado que não há retrocompat a proteger.
- **D — Minimalista (candidatos só na string `evidence`).** Dado estruturado degradado a
  prosa não-arbitrável; o Step 2 teria que parsear texto livre; convite ao "yes-to-all". É o
  bug #2 com outro nome. Rejeitada **4×0**.

## Self-review against code-quality gates

- **G1 read-before-claim**: claims sobre o código existente (diverge agrega sources;
  codeValue deriva por proveniência; schema coexiste por versão) carregam `verified_by:` para
  o arquivo/função. As decisões de forma são deste doc, validadas pelo debate de 4 vozes.
- **G2 soft-language**: ban-list escaneada → 0 ocorrências (decisões em voz ativa, sem
  should/probably/may).
- **G6 reference-or-strike**: cada asserção sobre código carrega `verified_by:`; as Open
  questions estão marcadas como não-bloqueantes com a evidência que as fecharia.
