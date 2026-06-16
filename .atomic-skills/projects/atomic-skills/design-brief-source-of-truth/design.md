# design-brief — reconstrução da fonte-de-verdade (superfície de páginas), pronta para extração

Adiciona ao `design-brief` uma **fase de reconstrução da superfície de páginas** que coleta candidatos
de **código + artefatos** (sempre ambos), **nunca escolhe vencedor no silêncio**, e emite um
**catálogo de arquitetura-de-informação (IA) design-agnóstico** — *memória durável das arbitragens do
operador* — que o próprio `design-brief` consome. Desenhada como passo isolado + formato de artefato
standalone, para que a promoção a uma futura skill `app-map` seja extração quase mecânica — sem pagar
o custo de skill pública agora. Decisão ratificada pelo operador após painel `brainstorm` (3 vozes +
contrária) e **revisada após um debate de 4 vozes que encontrou um defeito de design** (ver Revisão 2).

## Revisão 2 (2026-06-16) — defeito de design corrigido por debate

A v1 deste design dizia "cruzar fontes-artefato contra código e **reconciliar**". Um debate de 4 vozes
independentes (`atomic-skills:debate`) encontrou um **defeito de design**: *reconciliar automaticamente*
colapsa incerteza em fato no momento da persistência — **é** a auto-violação do princípio **P2**
("nunca escolher no silêncio") — e troca a falha original (fail-stop: catálogo vazio óbvio) por uma
falha pior (**fail-silent-que-propaga**: catálogo confiantemente errado três camadas abaixo, no brief →
no agente de design → nas telas). Três premissas da v1 foram **falsificadas**:

- (1) **Fontes não são um conjunto fixo atomic-skills-cêntrico.** O app-alvo pode usar BMAD,
  superpowers, docs nativos (README/ADR/RFC) ou nenhuma convenção. A descoberta é **open-world**.
- (2) **Precedência por tipo de doc é inverificável em runtime e mascara erro** (carimba de autoridade
  um falso-positivo). O operador fixou o princípio inverso — *artefato de decisão humana (brainstorm) >
  artefato materializado por IA (design/plan/spec), que acumula erro não-revisado* — mas num app
  arbitrário muitas vezes nem dá para identificar "qual é o brainstorm" a partir do arquivo.
- (3) **Obsolescência/supersession** de docs não tem sinal confiável (mtime é fraco; marcadores de
  status existem só em algumas convenções); auditar docs sem ciclo-de-vida injeta intenção morta como
  viva.

**Invariantes decididos pelo operador:** o operador **está sempre presente** no momento da reconstrução
(loop interativo; nunca batch/CI sem humano). **Re-execução iterativa sobre o mesmo app é essencial**
(rodo → refino o brief → rodo de novo).

A direção corrigida (D2', D3', D5', D6', D8', D9 abaixo) substitui "reconciliar" por **justapor +
confirmação-por-divergência**, com **persistência como memória-de-decisão** (justificada pela
re-execução). Divergência preservada do debate em *Rejected alternatives*.

## Context

Gatilho real: ao usar `design-brief` num app externo que passou por muitos pivôs, o operador não
tinha um mapa claro de quais páginas existem nem para quem servem. A causa está no escopo da fonte
atual da skill. O Step 2 do `design-brief` reconstrói a superfície **só do código**:

> ### 2. Screen inventory + coverage ledger (§7 — no screen left out)
> Use {{GLOB_TOOL}}/{{GREP_TOOL}} to enumerate the app's routes/views/screens and build a
> **coverage ledger** (each screen → classified / pending).
— `verified_by: skills/core/design-brief.md:39-44`

Num app **em desenvolvimento** ainda não há rotas, então esse scan retorna vazio e o coverage
ledger nasce vazio — falha **silenciosa**. A verdade, nesse estágio, está espalhada nos artefatos
(brainstorms, design docs, plano do `project`, memória), não no código. O `design-brief` já declara
artefatos+intenção como entrada (`verified_by: skills/core/design-brief.md:31-37`), mas o passo de
inventário não os usa, e não persiste o ledger — ele é um passo de build transitório que desaparece
no fim da execução (`unverified: ausência — não há passo de escrita do ledger em design-brief.md`).
**A doença não é "código vazio" — é "código tratado como verdade"** (Revisão 2): um app de código
rico que **afirma telas que o código não tem** (doc-driven, feature-flags, rotas planejadas)
reproduz a mesma classe de falha.

## Decisions

- **D1 — Não criar a skill `app-map` agora; enriquecer o `design-brief` in-place, desenhado para
  extração.** Há **1** consumidor real em disco (o próprio `design-brief`). Critério que **este
  design adota** (decisão, não regra citada): promover a skill standalone só com **≥2 consumidores
  reais, não hipotéticos** — coerente com o framing "atomic skills" e com a parity HARD RULE como
  custo *enforced* (`verified_by: CLAUDE.md` cobre só esses dois, não a régua numérica). O custo de
  skill nova é real e *enforced*: entrada em `meta/catalog.yaml`,
  scaffolding `scripts/new-skill.js`, doc gerado, `validate-skills`, paridade testada em
  `tests/install-uninstall-roundtrip.test.js` e `tests/new-skill.test.js`
  (`verified_by: meta/catalog.yaml, scripts/new-skill.js, tests/new-skill.test.js,
  tests/install-uninstall-roundtrip.test.js`). **Gatilho de promoção** para skill standalone:
  quando um **2º consumidor real** ler o catálogo — `brainstorm` B0 carregando-o em vez de
  re-varrer (`verified_by: skills/core/brainstorm.md:28`), ou uma auditoria de acesso
  público/privado/menor.

- **D2' (substitui D2) — Coletar candidatos de código + artefatos (sempre ambos), JUSTAPOR, nunca
  reconciliar no silêncio.** O motor **não** produz UM valor de verdade resolvendo o conflito (isso
  seria precedência inventada = escolha no silêncio). Ele produz, por página, o conjunto de
  candidatos com **proveniência tri-fonte** (`observado-no-código | afirmado-por-doc | inferido`).
  Onde código e docs **concordam** → auto-aceito (duas testemunhas independentes; o silêncio é
  seguro). Onde **divergem** (um afirma o que o outro não mostra, ou discordam num campo) → o
  **operador arbitra** o **delta**, via {{ASK_USER_QUESTION_TOOL}}. Resolver no silêncio (pegar o
  código "porque roda" ou o brainstorm "porque é a intenção") terceiriza um palpite — o anti-padrão
  que o `design-brief` já combate (`verified_by: docs/design/design-brief-three-layer-briefing.md:51-59`).

- **D3' (substitui D3) — Persiste-se o RESULTADO (fato arbitrado + proveniência + evidência), NÃO a
  ontologia de confiança transitória.** O que **não** é gravado é a *ontologia de 4 estados de
  confiança* (`code-only | unconfirmed | conflicted | confirmed`) proposta no debate — esses estados
  de confiança duram segundos (operador sempre presente; nascem no delta, morrem na mesma sessão). O
  que **é** gravado, como memória-de-decisão, e cujos campos-base o schema F0 (`schemaVersion 0.1`) já
  exige como `required` em `$defs/page` de `meta/schemas/app-map.schema.json`: (i) `existence`
  `{confirmed | artefact-only | code-only | possible-alias}` — a **classe de evidência factual** da
  página, que o Step 2 consome; (ii) `conflicts[]` por-campo — em `0.1` com
  `{field, artefactValue, codeValue, evidence, resolution}`, `resolution` como enum `pending|resolved`;
  o **bump `0.2`** (D5') reforma `resolution` para o objeto `{resolvedBy, resolvedAt, choice}` e
  adiciona o `evidenceHash` por-página que suprime a re-pergunta — gravando o conflito como
  **arbitragem já resolvida** do operador; (iii) o fato resultante + `provenance` por campo. A invariante D9 garante que nenhuma página
  termina com `resolution: pending` **não-perguntada**; um `pending` só persiste se o operador adiou
  explicitamente, e aí o Step 2 trata `audience`/`accessTier` `null` como parar-e-perguntar. O que
  persiste de um conflito é a **arbitragem**, não o estado vivo. O caso load-bearing continua: página
  existe nas duas fontes mas **discordam no público** — divergência **de campo**, arbitrada pelo
  operador, nunca auto-escolhida.

- **D4 — Catálogo no eixo de IA puro; NUNCA interação nem forma.** Cada página tem campos em **dois
  eixos separados** (F-005 do review codex): `accessTier` carrega **visibilidade/gate**
  (`public | auth | auth:<role>`) e `audience` carrega **segmento de usuário** (`visitor | registered
  | minor | guardian | …`, vocabulário aberto). Campos por página: `id` · `label` · `audience` ·
  `accessTier` · `purpose` (uma linha) · `status` · `provenance`. `minor` é **segmento**, não um valor
  de visibilidade — uma página `public` para `minor` é representável sem conflito artificial.
  Nomear widget, descrever cor/espaçamento (camada 1) ou ditar ritmo/gesto (camada 2)
  é proibido — é a Iron Law anti-contaminação projetada uma camada **acima** das três
  (`verified_by: skills/core/design-brief.md:11`; tabela de 3 camadas
  `verified_by: skills/shared/design-brief-assets/anti-contamination.md:10-14`).

- **D5' (substitui D5) — Persistir o catálogo é NÚCLEO porque a re-execução iterativa é essencial; ele
  é memória das arbitragens do operador, não cache de verdade computada.** O `app-map.json` (consumo
  por máquina) + espelho `.md` regenerado (legível, nunca editado à mão) é pré-condição do Step 2.
  **Por que persiste, agora:** com operador sempre presente, o estado intra-sessão é transitório — mas
  a **arbitragem humana** é o recurso caro e não-reproduzível; re-perguntar N páginas a cada re-run
  **é** a fadiga de confirmação (o risco do próprio reframe — D9). A persistência guarda, por página,
  o **fato confirmado + proveniência + um `evidenceHash`** (hash de conteúdo da evidência — código+doc
  — que fundou aquele fato). **Na re-execução:** recomputa scan, compara `evidenceHash` por página, e
  **pergunta SÓ o delta** (páginas cuja evidência mudou + novas + as que sumiram). Isto **unifica** o
  antigo `inputsHash` de staleness (Open q (c)) com o **fingerprint de supressão** de conflito-já-
  respondido (Open q (a)): são o mesmo hash-da-evidência, por página. A reconstrução roda quando o
  catálogo está **ausente OU** quando o `evidenceHash` de uma página **diverge**. A troca de
  granularidade — de `inputsHash` único top-level (como no schema F0 `0.1`) para `evidenceHash`
  **por-página** — exige **bump de `schemaVersion` `0.1`→`0.2`** no PLAN; `0.1` não é o contrato
  final. Inputs exatos + normalização do hash → **PLAN**.

- **D6' (substitui D6) — Regime por-página derivado da evidência de código da própria página;
  greenfield é o CASO-LIMITE da máquina de divergência, não um branch especial** (F-001 do review
  codex — **não** do conjunto global de rotas do app). Por linha: `greenfield ⟺ a página **não** tem
  rota/arquivo de código próprio` (`codeEvidence` ausente); `brownfield ⟺ tem`. Greenfield = "delta é
  o inventário inteiro" (100% afirmado-por-doc, 0% observado) → o operador semeia; o bug original
  morre como caso-limite, não como `if` especial. O caso **código-rico-que-afirma-telas-ausentes**
  (doc-driven/feature-flags/rotas planejadas) cai no mesmo motor: essas telas são `artefact-only` no
  delta. O regime comuta o **R2** do `design-brief`
  (que minera valores concretos do código — `verified_by: skills/core/design-brief.md:53-66`):
  brownfield → **minera** do código; greenfield → **pergunta** ao operador, **semeado pelos
  artefatos**; **nunca silencia** o parâmetro. O bloco "Modelo de interação" continua saindo com
  valores concretos — só a *fonte* muda de código para operador.

- **D7 — A fase é read-only sobre os artefatos humanos.** Resolver uma divergência grava a escolha
  **no catálogo**, não de volta no brainstorm/plano. Mutar artefatos autorais a partir de um passo
  de leitura é scope creep e exigiria o ratify gate do `project` — fora de escopo.

- **D8' (substitui D8) — Fontes são OPEN-WORLD heterogêneas; descoberta é problema de RECALL, não de
  classificação; precedência automática CORTADA.** O conjunto de fontes não é fixo nem atomic-skills-
  cêntrico: o app-alvo pode usar BMAD, superpowers, docs nativos (README/ADR/RFC), ou nenhuma
  convenção. Como **doc nunca é autoridade — é semente de pergunta ao operador** (a verdade vem da
  confirmação humana), a descoberta **não** precisa CLASSIFICAR corretamente a convenção (BMAD vs
  README vs ADR); precisa só **encontrar texto que afirma páginas/público/acesso** — errar a taxonomia
  da fonte é inofensivo quando a fonte não tem autoridade. **Precedência entre fontes está CORTADA
  como resolvedor** (inverificável em runtime, mascara erro): no máximo vira **ordem de apresentação**
  ao operador. O princípio do operador — *decisão humana > materializado por IA* — informa essa
  ordenação, nunca uma escolha automática. Proveniência é **por campo extraído** (qual fonte afirmou
  cada campo). Roots/heurística de recall/patterns include-exclude → **PLAN**.

- **D9 (novo) — Anti-fadiga de confirmação é requisito de primeira classe.** O reframe transfere
  trabalho ao operador; o novo modo de falha é **confirmação por reflexo** ("Yes-to-all"), que
  reintroduz o catálogo errado **com assinatura humana** — pior, porque destrói a proveniência
  "não-verificado". Mitigações **obrigatórias**, não opcionais: (a) **pergunta SÓ o delta** (nunca o
  que código+doc concordam) — D2'; (b) **orçamento de perguntas escalado por risco** (acesso/
  autorização/público-vs-privado → confirmação cara e explícita; view de baixo impacto → default
  aceito em lote); (c) **o silêncio do operador é seguro** — não-confirmado nunca vira verdade por
  timeout/inércia; a invariante de saída é *nenhuma página termina não-confirmada-e-não-perguntada*;
  (d) **a confirmação registra o que foi visto**, não só o clique (senão "confirmado" e "skipado"
  colapsam no mesmo estado).

## Chosen approach

Abordagens pesadas no painel `brainstorm` original:

1. **Skill `app-map` standalone agora** — rejeitada por timing (D1).
2. **Prove-in-place, pronto para extrair** *(escolhida)* — corrige o bug, adiciona as colunas de IA,
   **persiste** o catálogo e isola o passo + o formato, de modo que promover a `app-map` seja quase
   mecânico.
3. **Mínimo: só consertar greenfield no Step 2** — rejeitada: conserta a falha mas joga fora a
   persistência (o que dá valor e barateia a extração).

**Como (#2), pós-Revisão 2:** o passo novo vive como fase explícita do `design-brief` (Step 0 / Step 2
enriquecido). O motor **coleta** candidatos de código (scan) + artefatos (recall open-world),
**justapõe** com proveniência tri-fonte (D2'), e roda **confirmação-por-divergência** — o operador,
sempre presente, arbitra só o **delta** (D9). O resultado persiste **na árvore do app-alvo** (F-004 —
o `design-brief` roda contra um app externo): path canônico
`<app-alvo>/.atomic-skills/app-map/app-map.json` + espelho `.md`, com `<project-id>` = identificador
do app-alvo (basename do repo, ou fornecido pelo operador). Cada página persistida carrega o **fato
confirmado + proveniência + `evidenceHash`** (D5'); a re-execução pergunta só onde o `evidenceHash`
diverge. **Contrato estável (F-003 — campos REQUERIDOS, porque o Step 2 os consome):** `id`, `label`,
`purpose`, `audience`, `accessTier`, `status`, `regime`, `existence`, `provenance` (por linha) e os
candidatos/divergências **não-resolvidos** — o Step 2 usa `existence` + divergências pra decidir
perguntar/mesclar/classificar; **só `aliases` é advisory**. O **JSON Schema** entregue na F0
(`meta/schemas/app-map.schema.json`, `schemaVersion 0.1`) é a **base, não o contrato congelado
final**: a Revisão 2 exige um **bump `0.1`→`0.2`** no PLAN para a granularidade `evidenceHash`
por-página (substituindo o `inputsHash` único top-level de `0.1`). O *congelamento* da
porta-de-mão-única aplica-se a partir de `0.2`. `audience`/`accessTier` em `null`
(divergência não resolvida) é o gatilho de "parar e perguntar" que a §1 do `design-brief` já manda
(`verified_by: skills/core/design-brief.md:31-37`).

**Critérios de aceitação (verificáveis) — herdados do debate, inegociáveis:**

1. **Greenfield puro** (app só-código zero-artefatos OU artefatos-sem-código): **não** emite catálogo
   vazio silencioso; emite estado explícito "requer operador" e o delta = inventário inteiro.
2. **Envenenado** (doc stale que contradiz o código — diz "página X é admin-only", código a põe
   `public`): **nunca** emite a linha errada como fato; apresenta a divergência ao operador. Escolher
   QUALQUER lado no silêncio (doc OU código) = **falha P2**. É o único teste que separa "P2-safe" de
   "P2-safe no PowerPoint".
3. **Multi-convenção contraditório** (BMAD + README nativo + memória discordando do público da mesma
   página): **nenhuma** precedência hardcoded vence; todos os candidatos chegam ao operador com
   proveniência.
4. **Governança (gate, não unit test):** instrumentar a **taxa de confirmação cega** (confirmações em
   < N s / em lote sem expandir). Subida da taxa = o reframe mentindo via fadiga, mesmo com testes
   verdes (D9).

A **costura de extração**: passo isolado + formato standalone + contrato de campos versionado por
`schemaVersion` — promover a skill é mover o passo e registrar o consumidor, sem reescrever semântica.

## Non-goals

- Não redesenha o coração anti-contaminação; toca o `design-brief` só no Step 2 (ler catálogo) e no
  R2 (switch mine→ask). As camadas 2/3 ficam como estão.
- Não cria a skill `app-map` agora (só a deixa extraível).
- Não muta artefatos humanos (brainstorms/plano) — read-only (D7).
- O catálogo não descreve interação nem forma visual (D4).
- **Não reconcilia/escolhe entre fontes automaticamente** (Revisão 2 — D2'/D8'); não classifica a
  convenção de framework das fontes; não tenta detectar obsolescência de doc com precisão (todo
  candidato é possivelmente-stale até confirmação).

## Blast radius

- **Expensive-to-reverse (porta de mão única) — o FORMATO do catálogo** (`app-map.json`). `design-brief`
  depende dele e a futura `app-map` o herda. Contenção: versionar via `schemaVersion`; congelar os
  **campos do contrato estável**; tratar o resto como advisory. **Validação (F-005 — emit-time é o gate
  universal):** o `design-brief` valida o catálogo contra `meta/schemas/app-map.schema.json` **na
  emissão**, antes de gravar — malformado ⇒ a emissão **aborta** (funciona para app externo, fora do
  alcance do `validate-state` deste repo). Quando o catálogo cai numa árvore atomic-skills-tracked, é
  **também** registrado no `validate-state`. (`verified_by: scripts/validate-state.js` +
  `meta/schemas/app-map.schema.json` — schema + validador entregues na F0.) A migração
  `inputsHash`(top-level, `0.1`) → `evidenceHash`(por-página) é um **bump `0.1`→`0.2`**, não uma
  mutação in-place de `0.1`; o congelamento vale a partir de `0.2` (pós-Revisão-2).
- **Médio — mudar o Step 2** (de Glob-only para coletar+justapor+confirmar-divergência). Toca um
  caminho existente do `design-brief`. Contenção: a reconstrução roda primeiro quando ausente/stale
  (D5'); o route-Glob ao vivo só sobrevive como **modo legado opt-in**, nunca o default.
- **Médio (novo, Revisão 2) — UX de confirmação-por-divergência.** A fadiga de confirmação (D9) é um
  risco real; o orçamento-por-risco e a invariante-de-saída são contenção, e a taxa-de-confirmação-
  cega é a métrica de governança que detecta a regressão.
- **Baixo — aditivos:** colunas de IA, regime por-página, e a costura de extração não alteram
  caminhos existentes.

## Open questions

> **Nota:** as questões abaixo são **mecanismos de PLAN** — não bloqueiam o contrato nem o formato.
> A porta-de-mão-única é o formato, e está fechada.
- (a) **Fingerprint de supressão** — **UNIFICADO em D5'**: é o `evidenceHash` por-página. Resta ao
  PLAN o que exatamente compõe a evidência e a normalização. *(PLAN)*
- (b) **Persistência:** ~~JSON vs `.md` único~~ — **RESOLVIDO em D5'** (formato `app-map.json` +
  espelho `.md`).
- (c) **Sinal de staleness:** ~~mtime/commit-count vs hash~~ — **UNIFICADO em D5'** com (a): mesmo
  `evidenceHash` por-página. Resta ao PLAN os inputs exatos. *(PLAN — só impl)*
- (d) **Alias / rotas dinâmicas:** **match conservador, sem fuzzy-precedência** (Revisão 2): chave
  normalizada exata = `confirmed`; near-miss → `possible-alias` apresentado ao operador, **nunca**
  auto-unido. A chave-de-join (logical-page) + normalização → **PLAN**.
- (e) **plan-slug** — o doc vive em `design-brief-source-of-truth/`; confirmar se mantém ou renomeia
  antes do handoff pro PLAN.
- (f) **(novo) Mecanismo de discovery de código** robusto entre frameworks (enumerar "páginas" de
  código de forma framework-agnóstica), incluindo o caso código-rico-afirma-telas-ausentes. *(PLAN)*
- (g) **(novo) Heurística de recall de fontes** open-world (encontrar texto que afirma páginas/público/
  acesso em docs heterogêneos) + roots + patterns include/exclude. *(PLAN)*

## Rejected alternatives

- **A — Skill `app-map` standalone agora.** Dissidência preservada verbatim:
  > *Integration realist:* "one skill, one contract, two consumers… a standalone skill that emits a
  > file lets design-brief (and a future a11y/SEO/routing audit) consume the same artefact."
  > *Lifecycle architect:* folding "means the contamination firewall now has to also police a second,
  > differently-shaped artefact… One skill, one Iron Law."
  Rejeitada por timing (D1), não por mérito do end-state.
- **C — Subcomando do `project` (`project map`).** Rejeitada: `project` é gramática git-style sobre
  **estado mutável** de trabalho; um scan read-only de IA inverte a direção de dados e não cabe
  (`verified_by: skills/core/project.md` grammar §).
- **Reconciliação / precedência automática (a v1 deste design — D2/D8 originais).** Rejeitada no
  debate de 4 vozes (Revisão 2): "reconciliar" colapsa incerteza em fato = auto-violação do P2;
  precedência por tipo é inverificável em runtime e *mascara* erro (multiplicador de falso-positivo
  com carimbo de autoridade). Substituída por justaposição + confirmação-por-divergência (D2'/D8').
- **Ontologia epistêmica de 4 estados persistida** (`code-only|unconfirmed|conflicted|confirmed`,
  proposta no debate). Rejeitada: com operador sempre presente, 3 dos 4 estados só existem por causa
  da própria persistência que tentavam justificar — circular. Persiste-se o fato confirmado +
  `evidenceHash` (D3'/D5'), não a máquina de estados.
- **Classificação de framework das fontes (parser open-world por convenção).** Rejeitada: doc não tem
  autoridade (é semente de pergunta), então a descoberta é problema de **recall**, não de classificação
  (D8').
- **Só guard-clause de greenfield (cura mínima de uma tarde).** Rejeitada: trata só o caso degenerado
  (código zero); um app de código rico que afirma telas ausentes reproduz o bug. Greenfield é
  caso-limite da máquina de divergência (D6'), não a cura inteira.
- **Enum plano de 4 estados de existência.** Rejeitado: confunde dois eixos ortogonais; não representa
  "existe nas duas fontes, discorda no campo X" (ver D3').

## Self-review against code-quality gates

- **G1 read-before-claim:** applied — afirmações sobre código existente citam file:line e colam a
  linha quando load-bearing (design-brief.md:39-44, :53-66, :31-37, :11; anti-contamination.md:10-14;
  three-layer-briefing.md:51-59; brainstorm.md:28; project.md grammar; CLAUDE.md parity;
  meta/catalog.yaml + scripts/new-skill.js + os dois testes; F0: app-map.schema.json + validate-state).
  As afirmações da Revisão 2 são sobre **as próprias decisões deste doc** (não sobre código externo) e
  têm o debate de 4 vozes como driver. A ausência de persistência do ledger segue `unverified`.
- **G2 soft-language:** applied — ban list (should/probably/may/typically/usually + hedges pt-BR
  deveria/talvez/provavelmente/geralmente/parece/acho) scaneado: **0 ocorrências**.
- **G6 reference-or-strike:** applied — afirmações sobre código carregam `verified_by`; decisões
  net-new estão marcadas como decisões; a única claim de ausência leva `unverified`. O critério de
  **≥2 consumidores** e o princípio de **precedência humana** são decisões do operador (não citações).
