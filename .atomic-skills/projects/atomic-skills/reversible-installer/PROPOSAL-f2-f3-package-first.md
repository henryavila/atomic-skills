# PROPOSTA — re-escopo F2/F3 package-first (DRAFT para crítica)

> **STATUS: DECISÕES TOMADAS pelo usuário (2026-06-19).** As quatro escolhas
> abertas estão resolvidas (ver **[DECIDIDO]** abaixo) e **já aplicadas ao
> frontmatter F2/F3 do `plan.md`** (goals/exit-gates/verifiers reescritos
> package-first). Este doc agora é o registro da fronteira pacote×consumidor.
> Pendente: validação do pacote pelo usuário; depois `implement` retoma em
> **F2** (no repo do pacote) e **F3** (no atomic-skills).

Criado: 2026-06-17 (sessão YOLO). Contexto: `plan.md` §PIVOT + `design.md` §PIVOT.

---

## 1. O que já está travado (não re-litigar)

- **Nome/essência:** `@henryavila/tooling-installer` — instalador reversível,
  userland, de ferramentas de CLI + skills de IA (arquivos + merge de config),
  remoção limpa byte-a-byte. **NÃO** é package manager, **NÃO** tem integração
  com SO, **NÃO** é template engine, **NÃO** é específico de skills.
- **Local:** repo git separado `~/tooling-installer` (`22bfa99`, 38/38 verde).
- **Consumo no dev:** link local primeiro; publicar quando a API estabilizar.
- **Arquitetura da engine (D1–D9):** permanece válida. O PIVOT muda o
  **empacotamento e a fronteira**, não o mecanismo híbrido.
- **Já no pacote:** effect kernel + journal + reconciler 3-hash + os 3 efeitos
  (`json-merge`/`refcount`/`legacy-prune`) + `hash` + `manifest`
  (`MANIFEST_DIR` genérico). API pública em `src/index.js` (14 exports).

## 2. A fronteira proposta — pacote genérico × consumidor atomic-skills

O nome travado ("NÃO é específico de skills") força uma releitura de **D1**, que
dizia "Skills como **provider bundled**". Sob package-first + nome genérico,
proponho que o pacote **não** carregue nada específico de skills:

| Camada | **[PROPOSTO]** Onde mora | Porquê |
|---|---|---|
| Effect Kernel + journal + reconciler + 3 efeitos | **pacote** ✅ já lá | núcleo genérico |
| Contrato de **Provider** (planejador puro `plan(config) → Effect[]`) | **pacote** | é a API de extensão |
| **Driver** (install/uninstall/update/detect/status) | **pacote** | uninstall estrutural (D4) é do motor |
| Schema da **config two-tier** (D2) | **pacote** define a forma; consumidor preenche | escape-hatch p/ runtime layers |
| **SkillsProvider** (IDE matrix + catálogo + render) | **consumidor (atomic-skills)** | é específico de skills → fora do pacote genérico |
| **Runtime layers** (aiDeck, hooks project-status, auto-update) | **consumidor**, registrados via API do pacote | acoplamento atomic-skills |

> **[DECIDIDO #1] — SkillsProvider mora no CONSUMIDOR (atomic-skills).**
> (Usuário 2026-06-19: "skillProvider por consumer".) O pacote fica genérico,
> sem nada específico de skills. D1 ("bundled") é reinterpretado: o
> provider-de-skills é do consumidor, não do pacote. Os testes de SkillsProvider
> vão para **F3**, no atomic-skills.

> **[DECIDIDO #2] — `render` no CONSUMIDOR; idioma é só uma flag de config.**
> (Usuário 2026-06-19: "a ideia é passar a config de qual idioma o usuário
> escolher; como será usado depende do consumer; é mais uma flag que o installer
> pede ao usuário para confirmar.") Concretamente:
> - O **idioma** (ex-`COMMUNICATION_LANGUAGE`) é um **campo declarativo da config
>   two-tier** — valor opaco que o pacote carrega, não interpreta.
> - **Coletar/confirmar** a flag no install é do **installer do consumidor** (o
>   pacote é lib-only — [DECIDIDO #3] — sem TTY/CLI próprio para perguntar).
> - **Renderizar** com o idioma (templates multi-IDE) é do **Provider do
>   consumidor**. O pacote **não é template engine**: recebe conteúdo já
>   renderizado.
> - **Reframe de D7:** COMM_LANG deixa de ser "feature de render do core" e passa
>   a ser "flag de config opt-out, renderizada pelo consumidor" (anotado no
>   `design.md` §PIVOT).

## 3. F2 [PROPOSTO] — Provider API + Driver/CLI no pacote

**Goal (reescrito):** expor no `@henryavila/tooling-installer` o contrato de
Provider (planejador puro que emite efeitos), o Driver (install/uninstall/
update/detect/status sobre kernel+journal+reconciler), e o schema da config
two-tier — provando que um Provider de exemplo instala/desinstala via o Driver
com paridade round-trip, e que um runtime layer registra um tipo de efeito novo
sem reabrir o kernel.

Tarefas candidatas (a confirmar no decompose):
- **T-F2-1 — Contrato de Provider.** Interface `plan(config) → Effect[]` + um
  `FileSetProvider` de referência genérico (não-skills) sobre `reconcileFileSet`.
  Verifier: `test/providers/file-set-provider.test.js` (**no pacote**).
- **T-F2-2 — Driver.** `install/uninstall/update/detect/status` orquestrando
  providers → journal → revert reverso + reconcile-para-vazio. Verifier:
  `test/driver/roundtrip.test.js` (**no pacote**) — apply→revert volta ao
  baseline para um Provider de exemplo.
- **T-F2-3 — Config two-tier (D2).** Schema declarativo (namespace, manifestDir,
  variáveis, idioma, catálogo) + escape-hatch de runtime layer. `MANIFEST_DIR`
  é o 1º caso (já generalizado). Verifier: `test/config/two-tier.test.js`.
- **T-F2-4 — API de registro de runtime layer.** Um runtime layer registra
  `{ type, apply, revert }` + fixtures, sem editar o kernel. Verifier:
  `test/kernel/runtime-layer.test.js` (**no pacote**, era in-repo no plano velho).

**Exit gate F2 [PROPOSTO]:** (G-1) um Provider de exemplo instala+desinstala via
Driver com round-trip byte-a-byte; (G-2) runtime layer registra+reverte tipo
novo sem reabrir o kernel. Ambos verificados **no pacote** (`cd ~/tooling-installer
&& npm test`).

> **[DECIDIDO #3] — Só biblioteca (lib-only).** (Usuário 2026-06-19: "lib".) O
> pacote não publica binário CLI. O consumidor usa seu próprio `bin/cli.js`
> (atomic-skills já tem) chamando o Driver. CLI/prompt é política do consumidor.

## 4. F3 [PROPOSTO] — atomic-skills consome via link + paridade

**Goal (reescrito):** atomic-skills passa a depender de
`@henryavila/tooling-installer` (link local), **remove a cópia in-repo**
`src/kernel/`, move SkillsProvider+runtime layers para cima do Driver do pacote,
e prova a paridade com o round-trip atravessando a dependência (não a cópia
local).

Tarefas candidatas:
- **T-F3-1 — Dependência por link.** `@henryavila/tooling-installer` via
  **`file:`** no `package.json` do atomic-skills ([DECIDIDO #4], usuário
  2026-06-19: "file" — determinístico, versionável no lockfile, não `npm link`);
  imports trocam de `./src/kernel/...` para o pacote.
- **T-F3-2 — SkillsProvider sobre o Driver.** Porta IDE matrix + catálogo +
  render (conforme [DECIDIR #2]) para um Provider que emite efeitos. Verifier:
  `tests/providers/skills-provider.test.js` (**no atomic-skills**).
- **T-F3-3 — Runtime layers.** aiDeck/hooks/auto-update viram runtime layers
  registrando seus tipos via API do pacote (auto-update = `json-merge` em
  settings.json; aiDeck = staging refcount; etc.).
- **T-F3-4 — Big-bang rewire + remoção do legado.** `install.js`/`uninstall.js`
  ficam finos (montam config → chamam Driver); remove `src/kernel/` in-repo.
- **T-F3-5 — Paridade.** Round-trip + matriz adversária verdes **atravessando a
  dependência**; suíte completa verde.

**Exit gate F3 [PROPOSTO]:** (G-1) `node --test tests/install-uninstall-roundtrip.test.js`
verde com a engine vindo do pacote (não da cópia in-repo); (G-2) `npm test`
verde com `src/kernel/` removido e install/uninstall legados substituídos pelo
Driver; (G-3) inventário: cada mutação de cada runtime layer mapeada a efeito
registrado / fixture / allowlist (F3-G-3 herdado, ainda válido).

## 5. Perguntas abertas herdadas do design (ainda valem)

Do `design.md` §"Open questions", agora no contexto do pacote:
- **Schema do journal** para before-state — resolvido na prática pelos 3 efeitos
  já verdes; falta versionar o schema no 1º release do pacote (one-way door, D6).
- **Registro de tipos por runtime layer** — a superfície exata da API
  (T-F2-4) precisa do aiDeck como 1º consumidor não-trivial (T-F3-3) para validar.
- **Migração do `installs.json`** existente → marcadores por-dono, para
  instalações já no campo (passo idempotente em F3).

## 6. Estado / o que falta

1. ✅ **[DECIDIDO #1–#4]** respondidos pelo usuário (2026-06-19) e **aplicados ao
   frontmatter F2/F3 do `plan.md`** (goals/exit-gates/verifiers reescritos
   package-first; F2 verifica no repo do pacote, F3 no atomic-skills).
2. ⏳ **Validar o pacote** (`cd ~/tooling-installer && npm test` → 38/38; revisar
   `src/index.js` + README + a decisão `MANIFEST_DIR`) — usuário.
3. ⏳ **Decisão de estrutura ainda aberta (não bloqueante):** F2 é trabalho que
   roda no repo do pacote `~/tooling-installer`, não no atomic-skills. Por ora F2
   segue como fase deste plano com verifiers apontando para o pacote; opção
   futura = dar ao pacote seu próprio plano e este plano reter só F3. Confirmar
   ao iniciar F2.
4. Depois disso `implement` retoma: **F2 no pacote, F3 no atomic-skills.**
