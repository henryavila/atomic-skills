# PROPOSTA — re-escopo F2/F3 package-first (DRAFT para crítica)

> **STATUS: RASCUNHO. Nada aqui está travado.** Este documento NÃO muta o
> `plan.md` (frontmatter de F2/F3 segue como estava). É a "semente de pergunta"
> para o re-escopo que deve ser feito COM o usuário. As decisões abaixo estão
> marcadas **[PROPOSTO]** (ponto de partida meu, sujeito a veto) ou
> **[DECIDIR]** (genuinamente aberto — preciso da sua escolha antes de virar
> plano). Quando você validar, isto vira o novo `plan.md` (frontmatter F2/F3
> reescrito) e aí `implement` ganha tarefas executáveis.

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

> **[DECIDIR #1] — SkillsProvider: pacote ou consumidor?** D1 dizia "bundled".
> Eu proponho **mover para o consumidor** (coerente com "NÃO específico de
> skills"). Alternativa: o pacote ganha um sub-export opcional
> `@henryavila/tooling-installer/skills` (bundled mas separável). Sua escolha
> muda onde ficam os testes de provider em F2.

> **[DECIDIR #2] — `render` (templates multi-IDE + COMMUNICATION_LANGUAGE):
> pacote ou consumidor?** Tensão real: **D7** diz que COMM_LANG é feature do
> core (opt-out); o nome travado diz "NÃO é template engine".
> - (a) **render no consumidor:** o pacote recebe conteúdo de arquivo já
>   renderizado; o Provider do consumidor renderiza. Mantém o pacote "não é
>   template engine". *(meu palpite de preferência sua, dado o nome.)*
> - (b) **render como utilitário core fino no pacote** (honra D7 literalmente).
> Precisa da sua decisão — afeta a fronteira da API pública.

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

> **[DECIDIR #3] — O pacote expõe um binário CLI próprio, ou só biblioteca?**
> O nome inclui "installer". Opções: (a) só lib — o consumidor tem seu próprio
> `bin/cli.js` chamando o Driver (atomic-skills já tem `bin/cli.js`); (b) o
> pacote publica um CLI genérico parametrizado por config. **[PROPOSTO]** (a) —
> mantém o pacote como motor, CLI é política do consumidor.

## 4. F3 [PROPOSTO] — atomic-skills consome via link + paridade

**Goal (reescrito):** atomic-skills passa a depender de
`@henryavila/tooling-installer` (link local), **remove a cópia in-repo**
`src/kernel/`, move SkillsProvider+runtime layers para cima do Driver do pacote,
e prova a paridade com o round-trip atravessando a dependência (não a cópia
local).

Tarefas candidatas:
- **T-F3-1 — Dependência por link.** `@henryavila/tooling-installer` via
  `file:`/`npm link` no `package.json` do atomic-skills; imports trocam de
  `./src/kernel/...` para o pacote. **[DECIDIR #4]** mecânica do link:
  `file:../tooling-installer` (determinístico, versionável no lockfile) vs
  `npm link` (global, mais frágil em CI). **[PROPOSTO]** `file:`.
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

## 6. O que falta para isto virar plano executável

1. Você responde **[DECIDIR #1–#4]** (e veta o que discordar nos **[PROPOSTO]**).
2. Validar o pacote (`cd ~/tooling-installer && npm test` → 38/38; revisar
   `src/index.js` + README + a decisão `MANIFEST_DIR`).
3. Rodar o fluxo de plano (`review-plan`/`project`) para reescrever o frontmatter
   F2/F3 do `plan.md` com estes goals/tarefas/exit-gates (verifiers apontando
   para os paths corretos: pacote vs consumidor).
4. Só então `implement` retoma com tarefas reais.
