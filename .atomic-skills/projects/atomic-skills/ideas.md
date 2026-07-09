# 💡 Ideas — atomic-skills

> Inbox de ideias cruas. Capture com `/atomic-skills:project idea`; promova com `idea promote <n>`. Não edite os ids.

## #1 · Mode 2 — tier de executor Anthropic (Sonnet/Haiku)
`2026-06-09 · branch:main · status:pending · scope:skills/shared/mode2-codex-lane.md + implement/parallel-dispatch; sem mudança de schema · context:Só vale construir quando houver regime justificador: billing por token no Claude, OU decisão de adicionar hint de model-tier por task ao parallel-dispatch`

Adicionar o tier de subagent Anthropic (Sonnet/Haiku) ao Mode 2, por cima da lane Codex v1 — Opus nunca executa, tier barato nunca se auto-certifica (verify-on-done), lane atrás do condicional Claude-Code-only (investigator do Gemini é read-only). Plano original arquivado em .atomic-skills/projects/atomic-skills/mode2-anthropic-subagent-tier/ (3 tasks esboçadas: confirmar regime, decidir parallel-dispatch-hint vs lane própria, construir). Migrado de plano para ideia em 2026-06-09: era um tracker de deferimento sem trabalho iniciado.

## #2 · Reavaliar porting BMAD (party-mode / doc-architect)
`2026-06-09 · branch:main · status:pending · context:Premissas: debate cobre party-mode parcialmente; refactor-doc-architect segue pausado — se ambos morrerem, esta ideia volta a crescer`

Pesquisa de viabilidade/design/custo de portar party-mode e absorver conceitos do doc-architect como skills atômicos. Plano original arquivado em .atomic-skills/projects/atomic-skills/bmad-porting-research/ (gates: design doc do party-mode skill; mapeamento doc-architect → review-code/hunt/review-plan). Migrado de plano para ideia em 2026-06-09: 0/2 tasks após 2 semanas, e o escopo foi parcialmente superseded — o skill atomic-skills:debate já cobre o conceito party-mode (multi-persona com subagents reais) e refactor-doc-architect é um plano dedicado. Resta avaliar se sobra algo do BMAD que ainda valha portar.

## #3 · app-map: descritor de conflito rico (N candidatos) + canal de arbitragem no CLI
`2026-06-16 · branch:plan/design-brief · status:triaged→app-map-conflict-arbitration · scope:src/app-map/reconstruct.js (conflictForField, persistReconstruction) + scripts/app-map-reconstruct.js (CLI) + meta/schemas/app-map.schema.json (conflict $def, hoje frozen em 0.2) + skills/core/design-brief.md §2 (prosa) · context:Dois findings do review-code da F2 (phase-done, 2026-06-16) DEFERIDOS por exigirem DECISÃO DE DESIGN, não conserto mecânico — diferente do #1, já corrigido em f265aff. A ideia NÃO nasceu do operador: veio do reviewer adversarial de contexto-limpo. Fonte: .atomic-skills/reviews/2026-06-16-1702-design-brief-source-of-truth-f2.md (findings #2/#3); aprendizado em lessons/design-brief-source-of-truth-f2-*.md (L-001/L-002).`

Contexto pra reconstruir depois (a ideia surgiu do review, não de mim): a skill `design-brief` reconstrói o catálogo de páginas do app-alvo (`app-map.json`) justapondo código + artefatos. Quando código e docs (ou docs entre si) discordam num campo (`audience`/`accessTier`), isso vira um "conflito" que o operador deve arbitrar — princípio **P2 do plano: nunca escolher no silêncio**. O review da F2 achou DOIS jeitos pelos quais o conflito ainda escolhe/esconde no silêncio, e os dois precisam de uma decisão de design antes do conserto:

**(#2, major) O descritor de conflito persistido só tem 2 slots e descarta o 3º+ valor.** O schema `app-map.schema.json` (conflict `$def`) modela um conflito como `{field, artefactValue, codeValue, evidence, resolution}` — DOIS valores posicionais. Mas um campo pode ter ≥3 testemunhas discordantes (ex: 3 docs dizendo audience = admin / registered / guardian). Ao montar o descritor, o `conflictForField` (em `reconstruct.js`) só grava 2; o 3º+ some dos campos estruturados (sobra só na string `evidence` agregada). É uma violação do P2 **assada no formato binário do schema**, não um bug pontual. **Decisão pendente:** evoluir o descritor pra carregar um CONJUNTO de candidatos (ex: `candidates: [{value, source}]`) em vez de 2 slots — exige **bump de schema `0.2`→`0.3`** (`0.2` está congelado desde a Revisão 2). Ver lesson L-002.

**(#3, minor) O CLI `--persist` não tem canal pra receber a arbitragem do operador.** A prosa do §2 do `design-brief` diz: rode `--delta`, pergunte ao operador item a item, depois `--persist`. Mas o CLI `scripts/app-map-reconstruct.js --persist` **recomputa as páginas cruas do zero** e grava todo conflito como `resolution: 'pending'` — não recebe as páginas já-resolvidas. O caminho que aceita páginas resolvidas (o branch pass-through do `toPageFact`, que exercita o `resolution` como OBJETO de decisão do schema 0.2) só é alcançável PROGRAMATICAMENTE (o agente chamando `persistReconstruction({pages})` direto), nunca via CLI. Então, seguindo a prosa documentada, a arbitragem do operador nunca é persistida. **Decisão pendente:** (a) adicionar um canal no CLI (ex: `--resolved <arquivo.json>` alimentando `persistReconstruction`), ou (b) decidir que a persistência de arbitragem é programático-only e **corrigir a prosa do §2** pra não prometer um `--persist` que não persiste decisão. Hoje prosa e CLI discordam.

Nota: o finding #1 irmão (atribuição code/artefact por posição alfabética, fabricando testemunha de código falsa) JÁ foi corrigido na F2 (commit f265aff): `conflictForField` agora deriva por proveniência real e põe `codeValue: null` sem testemunha de código. #2/#3 são o que sobrou, e ambos tocam o mesmo descritor/fluxo — provavelmente valem ser feitos juntos numa iniciativa futura.

## #3 · Documentação em HTML no GitHub Pages (README vira vitrine)
`2026-06-16 · branch:plan/fix-aideck-dashboard · status:pending`

Refazer a documentação do atomic-skills em HTML e publicar numa GitHub Page. O README passa a conter apenas os principais benefícios do atomic-skills, com link para a documentação completa.

## #4 · Reescrever fluxo ad-hoc do project
`2026-07-08 · branch:develop · status:pending`

O fluxo ad-hoc/new initiative ficou defasado em relacao ao modelo atual de planos: cria uma frente ativa com businessIntent, mas nao passa por DESIGN, source/decompose nem cria tasks em lote. Precisamos redesenhar o ad-hoc para a realidade atual do project, deixando claro quando usar triagem simples, quando promover para plano completo e como evitar initiatives vazias que parecem prontas para implement.

## #5 · Ajustar semantica do mapa do project help
`2026-07-09 · branch:develop · status:pending`

O comando project help mostra a espinha IDEIA > DESIGN > PLANO > DECOMPOSE > MATERIALIZE > IMPLEMENT como se os estagios anteriores estivessem comprovadamente concluidos. A auditoria mostrou que o helper apenas calcula spineStage=IMPLEMENT por haver tasks abertas na F0; MATERIALIZE e verdadeiro so para a fase ativa F0, enquanto F1-F3 continuam descriptor-only com sidecars source.json. Corrigir o render/copy para explicitar posicao operacional no fluxo, por exemplo MATERIALIZE(F0), e nao sugerir que todo o plano ja foi materializado.
