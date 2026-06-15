# design-brief — reconstrução da fonte-de-verdade (superfície de páginas), pronta para extração

Adiciona ao `design-brief` uma **fase de reconstrução da superfície de páginas** que cruza
**artefatos + código** (sempre ambos), trata inconsistências sem escolher vencedor no silêncio,
e emite um **catálogo de arquitetura-de-informação (IA) design-agnóstico** que o próprio
`design-brief` consome. Desenhada como passo isolado + formato de artefato standalone, para que
a promoção a uma futura skill `app-map` seja extração quase mecânica — sem pagar o custo de skill
pública agora. Decisão ratificada pelo operador após painel `brainstorm` (3 vozes + contrária).

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

- **D2 — Fonte = artefatos + código, SEMPRE ambos; reconciliar, nunca escolher no silêncio.**
  Greenfield (página sem código próprio) → o artefato é a fonte única. Brownfield (página com código)
  → cruza as duas fontes e
  **trata a divergência como produto**: mostra os dois lados com **proveniência** e devolve a
  decisão ao operador via {{ASK_USER_QUESTION_TOOL}}. Resolver no silêncio (pegar o código "porque
  roda" ou o brainstorm "porque é a intenção") terceiriza um palpite — o anti-padrão que o
  `design-brief` já combate (`verified_by: docs/design/design-brief-three-layer-briefing.md:51-59`).

- **D3 — Reconciliação em DOIS eixos ortogonais (não um enum plano de 4 estados).** Uma linha de
  página carrega: (a) **existência** `{confirmed | artefact-only | code-only | possible-alias}`;
  (b) **`conflicts[]`** por-campo, cada um com `{field, artefactValue, codeValue, evidence,
  resolution: pending|resolved}`; (c) **`status`** de ciclo `{built | planned | drifted |
  abandoned}`. O caso load-bearing que o enum plano não representa: a página existe **nas duas**
  fontes (existência `confirmed`) mas elas **discordam no público** (brainstorm diz "visitante",
  código a põe atrás de auth) — isso é `conflict` **de campo**, não de existência. Proveniência é
  **campo** em toda linha, não um estado.

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

- **D5 — Persistir o catálogo + reconstrução é pré-condição obrigatória do Step 2** (F-002 do review
  codex). Formato canônico (F-003/b, decidido agora, **não** Open question): **`app-map.json`**
  (consumo por máquina) + espelho `.md` regenerado (legível, nunca editado à mão). **Ordem
  obrigatória:** quando o catálogo está **ausente OU defasado**, o `design-brief` **roda a
  reconstrução primeiro** e só então o Step 2 consome — a reconstrução nunca é pulada. O route-Glob
  ao vivo **deixa de ser o fallback automático** e passa a ser **modo legado explicitamente opt-in**;
  em greenfield ele volta vazio (a falha de hoje), então **nunca** é o caminho default. A
  persistência é o que dá valor cross-execução e barateia a extração futura. **Staleness (F-002,
  contrato):** o catálogo grava um `inputsHash` = hash de conteúdo do conjunto de fontes da
  reconstrução; o Step 2 recomputa e força reconstrução quando difere de `inputsHash`. Inputs exatos
  + normalização do hash → **PLAN**.

- **D6 — Regime por-página, derivado de evidência de código da própria página** (F-001 do review
  codex — **não** do conjunto global de rotas do app). Um app em dev é misto (`/login` built,
  `/dashboard` artefato-only). Por linha do catálogo: `greenfield ⟺ a página **não** tem
  rota/arquivo de código próprio` (`codeEvidence` ausente); `brownfield ⟺ a página tem código
  próprio`. Nunca usar `routes == []` global como critério de uma página individual. Esse campo
  comuta o **R2** do `design-brief`
  (que minera valores concretos do código — `verified_by: skills/core/design-brief.md:53-66`):
  brownfield → **minera** do código; greenfield → **pergunta** ao operador, **semeado pelos
  artefatos**; **nunca silencia** o parâmetro. O bloco "Modelo de interação" continua saindo com
  valores concretos — só a *fonte* muda de código para operador.

- **D7 — A fase é read-only sobre os artefatos humanos.** Resolver um conflito grava a escolha
  **no catálogo**, não de volta no brainstorm/plano. Mutar artefatos autorais a partir de um passo
  de leitura é scope creep e exigiria o ratify gate do `project` — fora de escopo. (Mecanismo exato
  de supressão de conflito já respondido → Open questions.)

- **D8 — Contrato de fontes da reconstrução (F-001).** Conjunto de fontes = brainstorms, design
  docs, o plano/iniciativas do `project`, e a **memória** (elegível). Granularidade de proveniência
  = **por campo extraído** (qual fonte fixou cada campo da página — alimenta o `provenance` requerido
  do contrato). Roots de discovery, ordem de precedência entre fontes e patterns include/exclude →
  **PLAN**. Sem esse conjunto fixo, dois geradores produziriam catálogos diferentes para o mesmo app.

## Chosen approach

Abordagens pesadas no painel:

1. **Skill `app-map` standalone agora** (Integration realist, Lifecycle architect) — emite um
   arquivo que `design-brief` e futuros consumidores leem. Rejeitada **por timing**: 2º consumidor
   é hipotético hoje; custo público enforced; extração-depois é barata.
2. **Prove-in-place, pronto para extrair** *(escolhida)* — corrige o bug greenfield, adiciona as
   colunas de IA, **persiste** o catálogo e isola o passo + o formato, de modo que promover a
   `app-map` seja quase mecânico.
3. **Mínimo: só consertar greenfield no Step 2** — rejeitada na ratificação: conserta a falha mas
   joga fora a persistência (o que dá valor e barateia a extração).

**Como (#2):** o passo novo vive como uma fase explícita do `design-brief` (Step 0 / Step 2
enriquecido), produzindo o catálogo **na árvore do app-alvo** (F-004 — o `design-brief` roda contra
um app externo, então o catálogo é **desse** app): path canônico
`<app-alvo>/.atomic-skills/app-map/app-map.json` + espelho `.md`, com `<project-id>` = identificador
do app-alvo (basename do repo, ou fornecido pelo operador). A árvore
`.atomic-skills/projects/<project-id>/` **deste** repo só recebe o catálogo no dogfooding do próprio
atomic-skills (`verified_by: CLAUDE.md` install-parity — árvore versionada). **Contrato estável
(F-003 — campos REQUERIDOS, não advisory, porque o Step 2 os consome):** `id`, `label`, `purpose`,
`audience`, `accessTier`, `status`, `regime`, `existence`, `provenance` (por linha) e os
`conflicts[]` **não-resolvidos** — o Step 2 usa `existence`+`conflicts[]` pra decidir
perguntar/mesclar/classificar; **só `aliases` é advisory**. O **JSON Schema completo**
(tipos, `required`, nullability, enums) aterrissa no **PLAN** em
`meta/schemas/app-map.schema.json`. `audience`/`accessTier` em `null` (conflito não resolvido) é o
gatilho de "parar e perguntar" que a §1 do `design-brief` já manda
(`verified_by: skills/core/design-brief.md:31-37`). A **costura de extração**: passo isolado +
formato standalone + contrato de campos versionado por `schemaVersion` — promover a skill é mover
o passo e registrar o consumidor, sem reescrever semântica.

## Non-goals

- Não redesenha o coração anti-contaminação; toca o `design-brief` só no Step 2 (ler catálogo) e no
  R2 (switch mine→ask). As camadas 2/3 ficam como estão.
- Não cria a skill `app-map` agora (só a deixa extraível).
- Não muta artefatos humanos (brainstorms/plano) — read-only (D7).
- O catálogo não descreve interação nem forma visual (D4).

## Blast radius

- **Expensive-to-reverse (porta de mão única) — o FORMATO do catálogo** (`app-map.json`, decidido em
  D5). `design-brief` depende dele e a futura `app-map` o herda. Contenção: versionar via
  `schemaVersion`; congelar os **campos do contrato estável** (lista em Chosen approach); tratar o
  resto como advisory. **Validação (F-005 — emit-time é o gate universal):** o `design-brief` valida
  o catálogo contra `meta/schemas/app-map.schema.json` **na emissão**, antes de gravar — malformado
  ⇒ a emissão **aborta** (funciona para app externo, fora do alcance do `validate-state` deste repo).
  Quando o catálogo cai numa árvore atomic-skills-tracked, é **também** registrado no `validate-state`.
  Fiação exata de discovery no `validate-state` + fixture que prova catálogo inválido falhando →
  **PLAN** (`verified_by: scripts/validate-state.js` + `meta/schemas/`).
- **Médio — mudar o Step 2** (de Glob-only para ler-catálogo + reconstrução-primeiro). Toca um
  caminho existente do `design-brief`. Contenção: quando o catálogo está ausente/stale a reconstrução
  roda primeiro (D5); o route-Glob ao vivo só sobrevive como **modo legado opt-in**, nunca o default.
- **Baixo — aditivos:** colunas de IA, regime por-página, e a costura de extração não alteram
  caminhos existentes.

## Open questions

> **Nota (pós-review codex):** as questões abaixo são **mecanismos de PLAN** — não bloqueiam o
> contrato nem o formato (decididos em D5). A porta-de-mão-única é o formato, e está fechada.
- (a) Mecanismo do **fingerprint de resolução**: o que compõe a evidência que, inalterada, suprime
  um conflito já respondido na próxima regeneração. *(PLAN)*
- (b) **Persistência:** ~~JSON vs `.md` único~~ — **RESOLVIDO em D5** (formato canônico
  `app-map.json` + espelho `.md` regenerado).
- (c) **Sinal de staleness:** ~~mtime/commit-count vs hash~~ — **sinal decidido em D5**
  (`inputsHash` = hash de conteúdo das fontes); restam ao PLAN os **inputs exatos + normalização** do
  hash. *(PLAN — só impl)*
- (d) **Alias / rotas dinâmicas:** limiar de fuzzy-merge (logical-page como chave de join, não a
  URL) e como apresentar `possible-alias` ao operador.
- (e) **plan-slug** — o doc já vive em `design-brief-source-of-truth/` (slug comprometido pela
  localização); confirmar se mantém ou renomeia antes do handoff pro PLAN.

## Rejected alternatives

- **A — Skill `app-map` standalone agora.** Dissidência preservada verbatim:
  > *Integration realist:* "one skill, one contract, two consumers… a standalone skill that emits a
  > file lets design-brief (and a future a11y/SEO/routing audit) consume the same artefact."
  > *Lifecycle architect:* folding "means the contamination firewall now has to also police a second,
  > differently-shaped artefact… One skill, one Iron Law."
  Rejeitada por timing (D1), não por mérito do end-state.
- **C — Subcomando do `project` (`project map`).** Rejeitada: `project` é gramática git-style sobre
  **estado mutável** de trabalho, e `new` expõe só file-entities (plan|initiative); um scan read-only
  de IA inverte a direção de dados e não cabe (`verified_by: skills/core/project.md` grammar §).
- **Enum plano de 4 estados.** Rejeitado: confunde dois eixos ortogonais; não representa "existe nas
  duas fontes, discorda no campo X" (ver D3).

## Self-review against code-quality gates

- **G1 read-before-claim:** applied — toda afirmação sobre código existente cita file:line e cola a
  linha quando load-bearing (design-brief.md:39-44, :53-66, :31-37, :11; anti-contamination.md:10-14;
  three-layer-briefing.md:51-59; brainstorm.md:28; project.md grammar; CLAUDE.md parity;
  meta/catalog.yaml + scripts/new-skill.js + os dois testes para o custo de skill). A ausência de
  persistência do ledger está marcada `unverified` (claim de ausência).
- **G2 soft-language:** applied — scaneado o ban list (should/probably/may/typically/usually/I
  think/it seems/in theory/tends to): **0 ocorrências** (doc em pt-BR); hedges pt-BR
  (deveria/talvez/provavelmente/geralmente) evitados.
- **G6 reference-or-strike:** applied — afirmações sobre código existente carregam `verified_by`;
  decisões de design net-new estão marcadas como decisões (não como claims sobre código), e a única
  claim de ausência leva `unverified: <por quê>`. O critério de **≥2 consumidores** é decisão deste
  design (não citação) — `verified_by: CLAUDE.md` cobre só o framing "atomic skills" e a parity HARD
  RULE (corrigido após F-001 do crítico).
