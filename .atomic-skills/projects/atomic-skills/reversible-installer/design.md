# Reversible Installer — motor de instalação reversível e reutilizável

Extrair o instalador do atomic-skills (`src/install.js`, ~1333 linhas, + `src/uninstall.js` + `render/manifest/config/detect/hash`) num **kernel genérico de sincronização reversível de arquivos templados**, consumível por qualquer projeto via dependência + config, sem reescrever lógica de install/uninstall. O uninstall é propriedade estrutural do motor — não código que cada consumidor escreve.

## Context

O instalador atual já contém um motor genérico de valor real, hoje fundido com política específica do atomic-skills:

- **Reconciliação declarativa de arquivos já existe e funciona.** Detecção de conflito por 3 hashes (instalado × disco × novo) e remoção de órfão que só apaga o não-modificado. `verified_by: src/install.js:1049-1083` (bloco "3-hash conflict detection", `localUnchanged`/`packageUnchanged`) e `verified_by: src/install.js:896-918` (remoção de órfão auto: `if (currentHash === manifestEntry.installed_hash) unlinkSync`).
- **Manifesto hash-aware** como ledger do que foi instalado. `verified_by: src/manifest.js:7-21`.
- **Matriz de IDEs** (dir/format/filePattern por IDE) com um único acoplamento de nome. `verified_by: src/config.js:5-55` (`IDE_CONFIG`, `SKILL_NAMESPACE`).
- **Render de templates** multi-IDE com variáveis, condicionais `{{#if}}`, nomes de ferramenta por IDE e diretivo de idioma. `verified_by: src/render.js:36-97`.

O acoplamento específico do atomic-skills está concentrado em ~5 pontos: `SKILL_NAMESPACE`; o staging de runtime do aiDeck/dashboard `verified_by: src/install.js:70-132`; os hooks project-status; o auto-update hook; e as variáveis de tool-name + `COMMUNICATION_LANGUAGE` no render.

O contrato de paridade install↔uninstall hoje é garantido por um teste de round-trip (instala em HOME tmp, desinstala, exige retorno byte-a-byte). `verified_by: CLAUDE.md "Install / Uninstall parity (HARD RULE)" + tests/install-uninstall-roundtrip.test.js`. Este design eleva essa paridade de "garantida por teste" para "propriedade da arquitetura, verificada por teste".

## Decisions

Decisões tomadas (ratificadas pelo usuário; as marcadas [painel] passaram pelo painel de design gate-mode com Aria/arquiteto, Tariq/risco e Flynn/contrarian):

- **D1 — Altitude: kernel genérico + Skills como provider.** O motor é um sincronizador reversível de arquivos templados; a matriz de IDEs e o catálogo de skills são um *provider bundled*, não o core. Reuso aberto a qualquer projeto, não só instalação de skills.
- **D2 — Config two-tier.** Dados declarativos para o caso comum (namespace, IDEs, variáveis, idioma, catálogo) + escape-hatch em código para *runtime layers*.
- **D3 — Migração big-bang.** Extrair tudo e religar de uma vez, tendo o teste de round-trip como rede de segurança obrigatória. `unverified: risco aceito explicitamente pelo usuário; mitigação na seção Blast radius`.
- **D4 — Uninstall out-of-the-box (requisito, não fork).** Nenhum consumidor escreve lógica de reversão. A reversão vive no kernel.
- **D5 [painel] — Mecanismo de reversão: híbrido.** Reconciliação declarativa para o conjunto de arquivos (o que já funciona) + *efeito-com-before-state* para as mutações não-arquivo. Justificativa load-bearing: a reversibilidade depende de a mutação ser função pura da config; arquivos satisfazem isso, as 3 mutações não-arquivo não — cada uma viola por um motivo distinto (delta de merge, estado compartilhado, resíduo legado).
- **D6 [painel] — Protocolo de efeito extensível.** O kernel define um contrato fechado `apply()` / `revert(beforeState)` por *tipo* de efeito, traz 3 tipos built-in (`json-merge`, `refcount`, `legacy-prune`) e permite que runtime layers registrem novos tipos reversíveis. Isso é o que mantém o uninstall estrutural sob D1+D2: um consumidor com mutação não-arquivo nova a reverte declarando o tipo, sem escrever uninstall.
- **D7 — `COMMUNICATION_LANGUAGE` é feature do core, opt-out.** Setável na config; desativável. Não vira plugin. `verified_by: src/render.js:86-97`.
- **D8 [painel/spike] — refcount por marcadores por-dono, validado contra manifestos.** Derivação pura (zero-registro) é impossível: os basePaths de project-scope são raízes de repo espalhadas pelo FS, não enumeráveis de um local fixo. `verified_by: src/install.js:135-173 (installsRegistryPath + register/unregisterInstall, installs.json em path fixo) + src/install.js:777 (basePath = homedir | raiz do repo) + src/install.js:918,1125 (call sites de registerInstall(basePath)) + src/manifest.js:8 (manifesto em <basePath>/.atomic-skills/manifest.json)`. Em vez do array mutável `installs.json` (read-modify-write → race + decremento perdido em crash), o efeito `refcount` usa um diretório de marcadores independentes por dono (`owners/<hash(basePath)>`) e, na decisão de reclamar, valida cada marcador contra o manifesto do dono, podando órfãos. Crash-safe e self-healing. Quando o último marcador sai, o diretório `owners/` é removido — preservando o baseline byte-a-byte do round-trip, paridade com o `unregisterInstall` que hoje apaga `installs.json` em count 0 (`verified_by: src/install.js:167-169`).
- **D9 — Gate = round-trip + matriz adversária.** O round-trip de HOME-limpo é caminho-feliz e passa em qualquer mecanismo. O gate só conta como verde com 3 estados-de-partida adversariais (ver Chosen approach → Verificação).

## Chosen approach

Abordagem escolhida: **híbrido em 5 camadas (D5/D6)**, com reconciliação para arquivos e catálogo de efeitos extensível para o resto.

Abordagens pesadas e a vencedora:
1. **Journal de efeitos imperativo puro (A)** — toda mutação, inclusive arquivos, vira efeito num diário; uninstall = replay reverso. **Rejeitada** (ver Rejected alternatives): degrada o reconciler de arquivos que já funciona e introduz 2ª fonte de verdade que dessincroniza em crash.
2. **Reconciliador declarativo puro (B)** — converge para estado desejado; uninstall = convergir para vazio. **Rejeitada como solução completa**: cobre arquivos, mas não as 3 mutações não-arquivo, cujo before-state o disco sozinho não revela.
3. **Híbrido (C) — VENCEDORA.** B para arquivos (idempotente, já testado) + efeito-com-before-state só para não-arquivo, sob um protocolo de catálogo extensível.

Camadas (do mais baixo ao mais alto):

- **Effect Kernel** — conjunto de *tipos de efeito*, cada um com `apply()` + `revert(beforeState)` implementados uma vez. Built-in: `writeFile`/`reconcileFileSet` (declarativo, o reconciler atual), `json-merge`, `refcount`, `legacy-prune`. O contrato é registrável: um runtime layer adiciona um tipo com seu par apply/revert + suas fixtures.
- **Journal / Manifesto** — estende o manifesto atual (`src/manifest.js`) para gravar, por efeito não-arquivo aplicado, o before-state mínimo necessário ao revert. Para arquivos, o estado continua sendo hash-no-manifesto + disco (sem diário separado).
- **Reconciler** — diff(desejado, manifesto, disco) para o file set; é a lógica 3-hash atual generalizada. `verified_by: src/install.js:1049-1083 (3-hash) + src/install.js:896-918 (remoção de órfão unmodified-only)`.
- **Providers** — planejadores puros que *emitem* efeitos. `SkillsProvider` (bundled) encapsula IDE matrix + catálogo + render. Runtime layers (aiDeck, hooks, auto-update) são providers acoplados via config (D2).
- **Driver/CLI** — install/uninstall/update/detect/status, idênticos para todo consumidor. Uninstall = reverter os efeitos não-arquivo (por tipo, com before-state) + reconciliar o file set para vazio.

Como cada mutação não-arquivo é revertida sem hack:

- **(a) `json-merge` (settings.json / settings.local.json).** O before-state é o *delta exato* que o efeito inseriu (conjunto de chaves/paths) + `fileCreated`. Revert subtrai só o delta; se `fileCreated` e o objeto ficou vazio, apaga o arquivo. Hooks de terceiros nunca constam no delta → nunca são tocados. Generaliza o `settingsCreated`/`removeAutoUpdateHook` de bespoke para tipo de efeito. `verified_by: src/install.js:219-262 (removeAutoUpdateHook cirúrgico, delete só se settingsCreated + esvaziou) + src/install.js:584-637 (installAutoUpdateHook: merge aditivo de SessionStart + settingsCreated = !settingsPreexisted)`. Regra: reverter por subtração do delta, nunca por restauração de snapshot (snapshot causaria clobber de mudança concorrente do usuário).
- **(b) `refcount` (artefatos compartilhados em ~/.atomic-skills/).** Diretório de marcadores por-dono validado contra manifestos (D8). Reclama o artefato só quando o set fica vazio.
- **(c) `legacy-prune`.** Apaga só o que casa com a safelist de frontmatter — assinatura de origem do consumidor. **Invariante de segurança: ausência de prova de propriedade ⇒ NÃO apaga.** `verified_by: src/install.js:280-290 (HISTORICAL_ATOMIC_SKILLS_NAMES safelist) + src/install.js:298-314 (isAtomicSkillsArtifact) + src/install.js:327-351 (findLegacyOrphans)`.

Verificação (D9) — o round-trip ganha 3 fixtures adversárias, e nenhum tipo de efeito novo entra no catálogo sem sua tripla:
1. `settings.json` com hook de terceiro pré-existente → install → uninstall → o hook de terceiro sobrevive.
2. `refcount` com DOIS installs → uninstall de um → artefato compartilhado permanece; uninstall do segundo → some. Inclui teste de crash entre decrementar e remover.
3. arquivo do usuário colidindo com path legado, FORA do safelist → uninstall → arquivo do usuário sobrevive.

## Blast radius

Três decisões são one-way doors (caras de reverter):

- **D5 (mecanismo de reversão) e D6 (protocolo de efeito)** — são a fronteira da API pública do kernel. Mudar o contrato `apply`/`revert` ou a forma do journal depois que consumidores externos dependerem dele quebra todos eles. Containment: começar com os 3 tipos built-in derivados de casos reais e versionar o schema do journal desde o primeiro release; o protocolo de registro é aditivo (novos tipos não mudam os existentes).
- **D8 (refcount)** e o **risco central de segurança de dados**: o uninstall remover entrada/arquivo que o usuário possui. Maior risco residual ranqueado pelo painel: (1) refcount — único estado mutável compartilhado, falha silenciosa e não-local; mitigado por marcadores independentes + validação por manifesto + fixture de crash; (2) legacy-prune — segurança depende de allowlist que pode apodrecer; mitigado pelo invariante "sem prova ⇒ não apaga"; (3) json-merge — menor, before-state é defesa concreta.
- **D3 (big-bang)** — reescrever o miolo de uma vez. Containment: o teste de round-trip + a matriz adversária (D9) são pré-condição de merge; a paridade é re-verificada a cada efeito. `unverified: a cobertura do round-trip estendido é a única rede; sem a matriz adversária as 3 opções de reversão passam triviais e nenhuma fica provada (objeção do painel, Tariq)`.

## Non-goals

- **Não** virar gerenciador de pacotes genérico (sem resolução de dependências/versões entre consumidores).
- **Não** suportar rollback parcial transacional multi-máquina; o escopo é uma instalação local reversível.
- **Não** extrair para repo/pacote npm separado nesta fase (D3 é big-bang dentro do repo; o split é decisão posterior, quando a API estabilizar).
- **Não** mexer no aiDeck nem no formato do dashboard — eles viram um runtime layer consumidor do protocolo, sem mudança no seu próprio contrato.

## Open questions

- **Schema do journal para before-state de efeitos não-arquivo** — formato exato (chaves do delta de json-merge, marcador de refcount, critério de match de legacy-prune) fica para a fase de decompose. Evidência que resolve: o protótipo do kernel com os 3 tipos built-in + suas fixtures passando.
- **Registro de tipos de efeito por runtime layers** — a superfície exata da API de registro (como um runtime layer declara um tipo + apply/revert + fixtures) precisa de um exemplo concreto além dos 3 built-in. Evidência: portar o aiDeck runtime layer como primeiro consumidor não-trivial do protocolo.
- **Migração do `installs.json` existente** para o diretório de marcadores por-dono em instalações já no campo. Evidência: um passo de migração idempotente que lê o array antigo e materializa marcadores.

## Rejected alternatives

- **A — Journal de efeitos imperativo puro.** Defendido como uniforme, rejeitado: (1) joga fora o reconciler 3-hash que já distingue "instalei e ninguém tocou" de "usuário modificou" — um journal ingênuo deletaria trabalho do usuário no revert; (2) 2ª fonte de verdade (journal + manifesto) que dessincroniza em crash/replay parcial; (3) custo de big-bang num motor que já é verde. Dissidência preservada: nenhuma voz defendeu A-puro.
- **B — Reconciliador declarativo puro.** Rejeitado como solução completa: cobre arquivos, mas as 3 mutações não-arquivo precisam de before-state que o estado do disco não revela (qual chave do JSON é minha; quantos donos o artefato tem; o que é legado meu vs adotado pelo usuário). Forçá-las a fingir-se de arquivo causaria clobber ou ficaria de fora.
- **Catálogo fixo de 3 efeitos (YAGNI, Flynn — contrarian).** Promover só os 3 casos atuais a reversões tipadas, sem protocolo extensível. Dissidência preservada verbatim: Flynn argumentou que um catálogo aberto reintroduz "uninstall por catálogo" e 2ª fonte de verdade. **Rejeitada porque colide com D1+D2 já decididos**: um kernel genérico com runtime layers acopláveis precisa que um consumidor reverta sua mutação não-arquivo nova out-of-the-box; um conjunto fixo kernel-owned negaria isso. A objeção do Flynn é correta para o atomic-skills-como-consumidor, mas o goal genérico exige o protocolo.
- **Refcount-como-derivação pura (zero-registro).** Experimento do Tariq. Rejeitado pelo spike: basePaths de project-scope não são enumeráveis de um local fixo (D8). Adotada a versão mitigada: marcadores por-dono validados contra manifestos.

## Self-review against code-quality gates

- **G1 read-before-claim**: aplicado — toda afirmação sobre o código atual carrega `verified_by:` com file:line lido nesta sessão (install.js, uninstall.js, config.js, render.js, manifest.js). Sem inferência por nome de arquivo.
- **G2 soft-language**: aplicado — varri o corpo pela ban-list (should/probably/may/typically/talvez/provavelmente/deveria); 0 ocorrências não-marcadas. Incertezas reais estão como `unverified:` explícito (D3, Blast radius, matriz adversária).
- **G6 reference-or-strike**: aplicado — cada asserção sobre estado existente carrega `verified_by:`; as projeções de risco não-verificáveis a priori carregam `unverified: <motivo>`.
