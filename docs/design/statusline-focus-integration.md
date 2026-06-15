# Integração `project` ↔ claudebar — indicador de foco na statusline

> Status: **spec** (não implementado). Feature cross-repo.
> Produtor: `atomic-skills` (skill `project`). Consumidor: `claudebar` (`~/claudebar`).
> Decisão de produto: **desktop-only** (layout `full`). Mobile/`compact` fora de escopo
> (sem espaço vertical; não compensa abrir terceira linha).

---

## 0. Objetivo e não-objetivos

**Objetivo.** Durante o trabalho (sobretudo `implement`), a skill `project` publica um
digest compacto do "onde estou" que o claudebar lê a cada render e mostra como um chip
glanceável no layout `full`: `◇ <plano> · <fase i/n> · <tasks done/total>`.

**Não-objetivos.**
- Mostrar no mobile/`compact`.
- Substituir o dashboard aiDeck (visão profunda). O chip é o complemento periférico "você está aqui".
- Fazer o claudebar entender o layout interno de `.atomic-skills/` (ele lê **um** arquivo plano).

**Princípio de frescor.** Não prometemos "sempre fresco" (é dado derivado de YAML; só seria
garantível regenerando ou checando a fonte na leitura, e regenerar no render estoura os 50ms
do claudebar). Prometemos o alcançável: **nunca exibir dado velho como se fosse fresco.**

---

## 1. O contrato: `.atomic-skills/focus.json`

Arquivo único, plano, machine-readable, na raiz do repo. É a **projeção denormalizada**
do foco atual. O claudebar nunca anda na árvore — só lê este arquivo.

### 1.1 Schema (`meta/schemas/focus.schema.json`, `additionalProperties:false`)

```jsonc
{
  "schemaVersion": "0.1",                 // string, obrigatório
  "generatedAt": "2026-06-15T16:29:10.000Z", // ISO8601 Z; quando o digest foi emitido
  "projectId": "atomic-skills",           // string | null

  "plan": {                               // object | null  (null = sem plano ativo)
    "slug": "skills-restructuring",
    "title": "Reestruturação das skills",
    "status": "active"                    // enum: active|paused|done|archived
  },

  "phase": {                              // object | null
    "id": "F0",
    "slug": "pente-fino-de-consistencia",
    "title": "Pente fino de consistência",
    "index": 1,                           // 1-based: posição de currentPhase em plan.phases[]
    "total": 3,                           // plan.phases.length
    "status": "active"                    // enum: pending|active|paused|done|archived
  },

  "tasks": { "done": 0, "total": 7, "blocked": 0 },  // rollups da fase corrente
  "gates": { "met": 0, "total": 1 },

  "nextAction": "Start T0.1: Corrigir contagem de stages", // string | null

  "flags": {
    "drift": false,                       // detect-completion.js encontrou deriva
    "multipleActivePlans": true           // há >1 plano active; foco escolhido por current:true
  },

  "sources": [                            // arquivos de que ESTE digest foi derivado.
    {                                     // base do oráculo de staleness (camada 4).
      "path": ".atomic-skills/projects/atomic-skills/skills-restructuring/plan.md",
      "lastUpdated": "2026-06-15T16:29:10Z"   // valor do frontmatter `lastUpdated` na hora da emissão
    },
    {
      "path": ".atomic-skills/projects/atomic-skills/skills-restructuring/phases/f0-pente-fino-de-consistencia.md",
      "lastUpdated": "2026-06-15T13:54:20.262Z"
    }
  ]
}
```

### 1.2 Decisões de contrato (e o porquê)

- **`sources[].lastUpdated` é o fingerprint de staleness, NÃO mtime.** mtime parece óbvio mas
  o `git checkout` reseta mtime de todos os arquivos para "agora" → comparação por mtime daria
  **falso-stale após todo checkout**. `lastUpdated` é *conteúdo* (viaja com o git, é commitado
  junto, é bumpado em toda mutação legítima). O consumidor relê a linha `lastUpdated:` do
  frontmatter de cada `source` e compara string-a-string. Custo: 1 `grep -m1` por source (~2 leituras).
- **Caminhos em `sources` são relativos à raiz do repo** (portável entre máquinas/worktrees).
  O consumidor resolve contra o git-root.
- **Sem foco ⇒ digest com `plan: null` e `sources: []`** (não apagar o arquivo). Assim o
  consumidor distingue "sem plano ativo" (renderiza nada) de "produtor nunca rodou"
  (arquivo ausente → renderiza nada também, mas é estado diferente para debug).
- **`multipleActivePlans`**: o repo já permite >1 plano `active`. O foco exibido é sempre a fase
  marcada `current: true` por `reconcile-focus.js`. O flag só serve para o consumidor poder
  (opcionalmente) sinalizar ambiguidade.
- **`phase.index`/`total`** são pré-computados na emissão (índice de `currentPhase` em
  `plan.phases[]`, 1-based). Consumidor nunca calcula.
- **Versão**: `schemaVersion: "0.1"`. Mudança incompatível ⇒ bump + o consumidor degrada
  graciosamente (vê versão desconhecida → renderiza nada, nunca quebra).

---

## 2. Produtor (atomic-skills)

### 2.1 Chokepoint único: `scripts/refresh-state.js`

Um único ponto idempotente e *pure-read da fonte* que faz, em ordem:

1. `compute-rollups.js`  — recomputa `tasksDone/tasksTotal/blocked`, `gatesMet/gatesTotal` no frontmatter das fases.
2. `reconcile-focus.js`  — recomputa `planActive`, `current`, `planTitle`.
3. `emit-focus.js`       — serializa o digest e grava `.atomic-skills/focus.json` **atomicamente**.

Tudo que muta estado chama **só** isto. Rodar "demais" é inofensivo (idempotente).

### 2.2 `scripts/emit-focus.js` (novo)

```
1. Resolve foco:
   - varre projects/*/ ; acha plano(s) com status:active
   - acha a fase com current:true  (já pré-computada por reconcile-focus)
   - se nenhum  -> emite { plan:null, sources:[] }
   - se múltiplos active -> usa o que tem current:true ; seta flags.multipleActivePlans
2. phase.index/total <- posição de plan.currentPhase em plan.phases[]
3. tasks/gates <- rollups do frontmatter da fase corrente
4. nextAction  <- frontmatter da fase corrente
5. flags.drift <- node scripts/detect-completion.js --json  (já existe, pure-read)
6. sources[]   <- [plan.md, phase.md] com path (repo-rel) + lastUpdated (frontmatter)
7. write atômico: grava .atomic-skills/focus.json.tmp ; rename -> focus.json
8. exit 0 sempre (mesmo sem foco)
```

Requisitos: **escrita atômica** (`tmp` + `rename`) — senão o claudebar pode ler JSON pela
metade. **Pure-read** das fontes — nunca infere/escreve estado novo.

### 2.3 As 4 camadas de frescor (mapeadas)

| # | Mecanismo | Onde | Cobre | Resíduo que NÃO cobre |
|---|-----------|------|-------|------------------------|
| 1 | **Write-through** | `compute-rollups` + `reconcile-focus` terminam chamando `emit-focus` (via `refresh-state`) | toda mutação de task/fase/plano feita pelo fluxo normal | mutação que não passa pelos scripts |
| 2 | **PostToolUse hook** | `hooks/post-write-focus.sh`, matcher `Write\|Edit` sob `.atomic-skills/**` (exceto `focus.json`) | edição crua de phase/plan files dentro do Claude Code, mesmo sem rodar comando | mutação fora do Claude Code |
| 3 | **SessionStart hook** | estende `hooks/session-start.sh` p/ chamar `refresh-state` 1× | deriva **entre** sessões (git checkout/merge/rebase com `.atomic-skills/` versionado) | git-op **no meio** da sessão |
| 4 | **Oráculo de staleness** | no claudebar (§3.3) | git-op mid-sessão, editor externo, outro processo | — (transforma resíduo em "exibido como stale", nunca em número errado silencioso) |

Camadas 2–4 são **mecânicas** (não dependem de eu lembrar de algo).

#### Nota anti-recursão (importante)

O hook da camada 2 dispara um `node refresh-state.js` que **escreve** em `phases/*.md` e em
`focus.json` — ambos sob `.atomic-skills/`. Isso **não** causa loop: o `PostToolUse` do Claude
Code dispara em *tool calls do Claude* (Write/Edit/Bash), **não** em writes de filesystem feitos
por um subprocesso que o hook spawnou. Escrita por processo filho ≠ tool call ⇒ sem re-trigger.
(Só haveria recursão se fosse um watcher inotify, que não é o caso.) Ainda assim, o matcher
exclui `focus.json` por higiene.

### 2.4 Validação e contrato

- `meta/schemas/focus.schema.json` (novo, strict).
- `npm run validate-state` passa a validar `focus.json` quando presente.
- `tests/focus-digest.test.js`: gera estado fixture → roda `emit-focus` → assert no shape do digest,
  no `sources`, no caso `plan:null`, e no caso `multipleActivePlans`.

### 2.5 Parity install/uninstall

`focus.json` é **runtime/estado**, não artefato instalado — não entra no manifesto do `install.js`,
logo não precisa de reversal no `uninstall.js` (mesma categoria de `.atomic-skills/projects/...`).
Os **scripts** novos (`emit-focus.js`, `refresh-state.js`) e o **hook** novo
(`post-write-focus.sh`) SÃO artefatos da skill ⇒ entram no manifesto + reversal, e o
round-trip test cobre. O hook entra no merge de `settings.json` (PostToolUse) com reversal
cirúrgico igual ao `removeAutoUpdateHook`.

---

## 3. Consumidor (claudebar)

### 3.1 Segmento `project_chip()` em `assets/statusline.sh`

Espelha `update_chip()` (já lê `.update-available`). **Só** é chamado de `identity_row()`
(layout `full`). **Nunca** de `compact_row*` — decisão desktop-only.

```bash
project_chip() {                       # arg: $1 = repo root (git-root, fallback CWD)
    (( CHIP_PROJECT )) || return 0
    local root=$1
    local f="$root/.atomic-skills/focus.json"
    [[ -f "$f" ]] || return 0

    # 1 jq: extrai campos de render + serializa sources p/ o check de staleness
    local data
    data=$(jq -r '
      if .plan == null then "NOPLAN"
      else
        [ .plan.slug, (.phase.id // ""), (.phase.index|tostring), (.phase.total|tostring),
          (.tasks.done|tostring), (.tasks.total|tostring), (.tasks.blocked|tostring),
          (.flags.drift|tostring),
          ( [ .sources[] | .path + "" + .lastUpdated ] | join("") )
        ] | join(" ")
      end' "$f" 2>/dev/null) || return 0
    [[ "$data" == "NOPLAN" || -z "$data" ]] && return 0

    IFS=$'\0' read -r slug pid pidx ptot tdone ttot tblk drift srcblob <<<"$data"

    # ── camada 4: staleness via lastUpdated do frontmatter de cada source ──
    local stale=0 src path recorded current
    while IFS=$'\1' read -r path recorded; do
        [[ -z "$path" ]] && continue
        local sf="$root/$path"
        if [[ ! -f "$sf" ]]; then stale=1; break; fi
        current=$(grep -m1 '^lastUpdated:' "$sf" | sed 's/^lastUpdated:[[:space:]]*//; s/["'\'' ]//g')
        [[ "$current" != "$recorded" ]] && { stale=1; break; }
    done < <(printf '%s' "$srcblob" | tr $'\2' '\n')

    # ── render (desktop) ──
    local slug_disp=${slug:0:18}; [[ ${#slug} -gt 18 ]] && slug_disp+="…"
    local body="${GLYPH_PROJECT} ${slug_disp} · ${pid} ${pidx}/${ptot} · ${tdone}/${ttot}"
    (( tblk > 0 )) && body+=" ⚠${tblk}"
    [[ "$drift" == "true" ]] && body+=" ${GLYPH_DRIFT}"

    local color=$C_PROJECT
    (( tblk > 0 )) && color=$C_PROJECT_BLOCKED
    if (( stale )); then color=$C_PROJECT_STALE; body+=" ~"; fi

    fg "$color" "$body"
}
```

Render exemplos:
- fresco: `◇ skills-restructur… · F0 1/3 · 0/7`
- com bloqueio: `◇ … · F0 1/3 · 2/7 ⚠1`
- com drift: `◇ … · F0 1/3 · 3/7 ⌁`
- **stale**: `◇ … · F0 1/3 · 0/7 ~`  (cor dim/amarela)

### 3.2 Chamada e placement

Em `identity_row()`, após o chip de effort/agent e antes de `tmux_chip` (info de sessão/foco
ganha proeminência cedo). Segue a regra de ownership de separador do claudebar: o chip dona
o separador que o precede. Passar o git-root já computado por `identity_row` (ou `$CWD` como fallback).

### 3.3 Custo (orçamento 50ms)

`[[ -f ]]` + 1 `jq` (sobre arquivo) + até 2× (`grep -m1` 1 linha). ~2 leituras baratas + 1 jq.
Bem dentro do orçamento. Quando o arquivo **não existe** (caso comum p/ usuários do claudebar
sem atomic-skills): 1 `stat` falho ⇒ custo ~0. Por isso o default pode ser **on**.

### 3.4 Config (TOML → bash)

- `src/toml-parser.js`: adicionar `project` em `VALID_KEYS.chips`; `project`/`project_stale`/`project_blocked` em colors; `project`/`drift` em glyphs.
- `assets/default-config.toml`:
  ```toml
  [chips]
  project = true            # no-op quando .atomic-skills/focus.json ausente
  [colors]
  project = 39
  project_stale = 244
  project_blocked = 220
  [glyphs]
  project = "◇"
  drift = "⌁"
  ```
- `assets/statusline.sh`: `readonly CHIP_PROJECT=${CHIP_PROJECT:-1}` + defaults de `C_PROJECT*`/`GLYPH_PROJECT`/`GLYPH_DRIFT`.

### 3.5 Testes

Fixtures `test/fixtures/focus-*.json` (fresco / stale / blocked / drift / null-plan / ausente)
+ asserts no output de `project_chip` e no perf test (<50ms) com o chip ligado.

---

## 4. Ordem de rollout (cada etapa testável isolada)

1. **Produtor — contrato**: `focus.schema.json` + `emit-focus.js` + `refresh-state.js` + write-through nos scripts existentes + `focus-digest.test.js`. (claudebar ainda nem sabe que existe.)
2. **Produtor — hooks**: `post-write-focus.sh` (PostToolUse) + `session-start.sh` estendido + parity/manifest + round-trip test.
3. **Consumidor — chip base**: `project_chip()` (sem staleness) + config + placement + fixtures fresco/null/ausente.
4. **Consumidor — oráculo de staleness** (camada 4): bloco `sources` + render `~`/cores + fixtures stale.
5. **Doc**: página de skill + nota no README do claudebar (chip opcional, desktop-only).

Etapas 1–2 entregam frescor "real" (write-through + hooks); 3 já mostra algo; 4 fecha a honestidade.

---

## 5. Decisões em aberto (defaults propostos, sobrescrevíveis)

| # | Questão | Default proposto |
|---|---------|------------------|
| D1 | Nome/caminho do digest | `.atomic-skills/focus.json` |
| D2 | Placement do chip | após effort, antes de tmux |
| D3 | Default do chip no claudebar | `on` (no-op quando ausente) |
| D4 | Largura máx do slug | 18 chars + `…` |
| D5 | Mostrar `nextAction` no chip | **não** (longo demais; fica só no dashboard/no-arg `project`) |
| D6 | Sinalizar `multipleActivePlans` visualmente | **não** no v1 (só no digest) |
