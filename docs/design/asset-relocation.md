# Realocar `_assets/` para fora da árvore de comandos (skills-restructuring F0B)

> Status: **IMPLEMENTADO (2026-06-22) — via PLANO B, não o A**. O bloco abaixo é o blueprint
> histórico; a decisão final divergiu do "plano A (runtime)" que o usuário inclinava aqui.
>
> **O que shipou (plano B — irmão de `commands/`, manifest-trackado):** os assets passam de
> `<ide.dir>/atomic-skills/_assets` para o **irmão** `<dirname(ide.dir)>/atomic-skills/_assets`
> (ex.: `.claude/commands/atomic-skills/_assets` → `.claude/atomic-skills/_assets`), fora da
> árvore varrida pelo IDE. Helper único `getAssetsDir(ideId)` em `src/config.js`, consumido por
> `src/render.js` (ASSETS_PATH) e `src/providers/skills-file-set.js` (destBase) — write == read.
> Sem mexer em `install.js`/`uninstall.js`: os assets continuam manifest-trackados, então
> `reconcileFileSet`/`replayReverse` revertem de graça (round-trip 9/9 sem editar o teste) e o
> próximo install **reapa** o `_assets/` antigo sob `commands/` como órfão (P3).
>
> **Por que B e não A** (robustez/resíduo, validado): A (runtime refcountado) usaria `rmSync`
> cego em `removeRuntimeArtifacts` → violaria P3 (apagaria asset editado sem prova) + exigiria
> estender o reclaim ou deixaria resíduo `.atomic-skills/_assets/…`; e jogaria assets de
> install-de-projeto pro `$HOME`. B preserva a HARD RULE de paridade sem nenhum código novo de
> reversão. Suite 1322/1322, validate-skills 15/15, round-trip empírico (install→uninstall) =
> `$HOME` vazio.
>
> O resto deste doc é o blueprint original (inclui a change-list do plano A, NÃO seguida).

## Problema

Ao digitar `/project`, o palette mostra `atomic-skills:_assets:project-create-plan`, `…-transitions`,
etc. Os detail files lazy aparecem como slash-commands.

## Causa raiz (confirmada via doc do Claude Code)

Os `_assets/*.md` são instalados **dentro** de `~/.claude/commands/atomic-skills/_assets/`. O
Claude Code **varre `commands/` recursivamente** e registra **todo `.md`** como comando
namespaced (`atomic-skills:_assets:*`). Não pula dirs com `_`; só registra `.md` (os `.txt` do
mesmo dir não aparecem). Não há frontmatter que impeça o registro de forma limpa **a partir do
filesystem** — a flag `user-invocable:false` (que o namespace root já usa, `install.js:267`)
esconderia do menu, **mas** vários assets são **templates** (`plan.template.md`,
`initiative.template.md`, `*.template.md`) consumidos pra gerar estado → prefixar frontmatter
vazaria pro `plan.md` gerado e quebraria o schema (`additionalProperties:false`). Logo o hack de
frontmatter é **inseguro/parcial**. **Fix correto = tirar `_assets/` da árvore de comandos.**

## Decisão de produto

- Não mover à mão — **o installer move** e validamos **e2e** (testes de install + round-trip).
- Casa dos assets: **junto do runtime** (`~/.atomic-skills/_assets/`).
- Corrigir **todas** as falhas de teste de install no mesmo passo.

## Furo que o blueprint inicial subestimou (IMPORTANTE)

Os assets têm `{{BASH_TOOL}}`, `{{ASK_USER_QUESTION_TOOL}}` etc. — que renderizam **por-IDE**
(nome de ferramenta difere claude-code vs gemini). **Render único cravaria um IDE só** → quebra
multi-IDE. Logo: **subdir por IDE** → `~/.atomic-skills/_assets/<ide>/`.

## Decisão EM ABERTO (escolher antes de implementar)

Como assets são por-IDE de qualquer jeito, há duas casas:

- **A — junto do runtime** (escolha atual do usuário): `~/.atomic-skills/_assets/<ide>/`.
  Global/compartilhado, **refcounted** (artefato de runtime, fora do manifest). Combina com
  "junto do runtime". Custo: install de **projeto** manda assets pra `$HOME` (globais,
  last-install-wins) + ciclo refcount.
- **B — irmão do `commands/`** (não-varrido): ex. `~/.claude/atomic-skills-assets/<...>`.
  Continua **per-install, manifest-trackado** → sem complicação de escopo, sem refcount,
  uninstall/round-trip "de graça". Só não fica literalmente no runtime.

> **Por que o manifest não serve pro A:** install de projeto tem `basePath = repo`, e
> `~/.atomic-skills/` fica **fora** dele → `relative(repo, $HOME/...)` vira `../../…`, quebrando
> `join(basePath, relPath)` no uninstall e o snapshot do round-trip. Por isso, no plano A, assets
> seguem o **ciclo de runtime** (refcounted), não o manifest.

## Change-list (plano A — runtime, per-IDE subdir)

1. **`src/render.js:64-77`** — `ASSETS_PATH` deixa de ser per-IDE-no-commands e vira
   `~/.atomic-skills/_assets/<ide-key>` (ainda per-IDE, mas no runtime; dropar o `scopePrefix`
   por-scope — assets passam a ser sempre `$HOME`).
2. **`src/install.js:70-132` `installRuntimeArtifacts`** — passar a `stage` os assets: anda em
   `skills/shared/*-assets` (filtrado a owners do catálogo, espelhando `installSkills:471-481`),
   renderiza **por IDE** (precisa da lista `ides`), escreve em
   `~/.atomic-skills/_assets/<ide>/...`, recursando 1 nível em `hooks/`. Wipe-and-recreate como o
   `dashboard/` (`:90-95`). Resolver `skillsDir`/`metaDir` via `PACKAGE_ROOT`.
3. **`src/install.js:466-524`** — **DELETAR** o loop per-IDE de assets do `installSkills`
   (assets não são mais manifest-trackados nem per-commands).
4. **`src/install.js:705-731`** — **DELETAR** o bloco de assets do `preRenderFiles` (assets saem
   do conflito/update detection). Bônus: aposenta a assimetria latente (Path 1 recursa `hooks/`,
   Path 2 não).
5. **`src/install.js:188-205` `removeRuntimeArtifacts`** — adicionar `join(root,'_assets')` ao
   loop de remoção (refcount-gated pelo `unregisterInstall()===0` já existente).
6. **`src/uninstall.js`** — sem mudança (itera manifest + reclama runtime por refcount).
7. **`CLAUDE.md`** — atualizar a tabela "install.js ↔ uninstall.js map": nova linha
   `Runtime ~/.atomic-skills/_assets (installRuntimeArtifacts, per-IDE) | removeRuntimeArtifacts (refcounted)`.

(No plano B: assets ficam em `<base>/<ide.dir>/../atomic-skills-assets/<ide>/`, manifest-trackados;
muda só o `destBase` nos 2 paths + `ASSETS_PATH`; sem mexer em runtime/refcount. Mais simples.)

## Testes — corrigir TODAS as falhas (8 pré-existentes + colaterais da realocação)

As 8 falhas atuais são **drift de contagem hardcoded** (F5 design-brief adicionou 4 assets; +1 core
skill). Fixar **junto** com a realocação, porque a realocação **muda as contagens de novo** (assets
saem do `result.files`):

- **`detect.test.js`** (3): `13 core` → **`14 core`** (linhas ~124, 129, 134). Independe da realocação.
- **`install.test.js`** contagens (pós-realocação, assets saem do footprint per-IDE):
  - core-only (`:50`): `53` → **`15`** (14 core + 1 auto-update hook).
  - memory (`:95`): `54` → **`16`**.
  - multi-IDE (`:164`): `105` → **`29`** (14×2 + 1 hook).
  - user-scope core-only (`:246`): `53` → **`15`**.
- **`install.test.js` "copies codex-bridge and project assets" (`:323-363`)** — lê
  `projectDir/.claude/commands/atomic-skills/_assets` (some na realocação): **reescrever** pra
  apontar `~/.atomic-skills/_assets/<ide>` (setar `process.env.HOME` temp, como o suite de
  `:367-394`).
- **Colaterais que a realocação torna vermelhos** (hoje passam): "copies shared module assets"
  (`:250-283`) e "review-{plan,code}… ASSETS_PATH" (`:285-321`) asseguram assets em
  `.claude/commands/.../_assets` e `content.includes('.claude/commands/atomic-skills/_assets')`
  (`:281`, `:317-318`) → trocar pro novo `ASSETS_PATH` (`~/.atomic-skills/_assets/<ide>`).
- **Round-trip** (`tests/install-uninstall-roundtrip.test.js`): **sem edição** — content-aware,
  location-agnostic. Fica verde **se** `removeRuntimeArtifacts` reclamar `_assets/` (passo 5);
  senão falha com `added: ['.atomic-skills/_assets/...']`.

## Sequenciamento no plano

- Inserir como fase **`F0B`** entre F0 e F1: `dependsOn: [F0]`; **F1 passa a `dependsOn F0B`**.
- Único phase done hoje é F5; a refatoração (F1–F3) é pending → F0B vem antes dela.
- Exit gate F0B: `npm test` (install + detect + round-trip) verde **e** palette sem `_assets`
  (após re-install).

## Caveat de timing

Qualquer fix só limpa o palette **após re-install** — as cópias já instaladas em
`~/.claude/commands/atomic-skills/_assets/` continuam poluindo até reinstalar.

## Estado do trabalho relacionado (multiplan-focus) — já durável

Commits nesta branch: `72c7f35` (focus.json), `0d2b788` (iniciativa multiplan + D6), `4f05a79`
(multipleActivePlans tree-relative), `4ca8cdc` (enforcer soft no project), `ac13468` (saneamento
+ bookkeeping). A iniciativa `multiplan-focus-resolution` (paused) carrega T-001..T-006 + um bloco
Decisões. Handoff do claudebar: `~/claudebar/docs/atomic-skills-focus-integration.md`.
