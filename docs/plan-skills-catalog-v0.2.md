# Plan — Skills Catalog v0.2 (canonical metadata + generated docs)

Sessão 2026-05-22. Expande `meta/skills.yaml` para ser **a fonte canônica** de
metadata estruturado de skills. README e dashboard `HelpView.tsx` passam a ser
**gerados** a partir do catalog (e do body, quando precisar de Iron Law /
narrativa). Validador cross-check garante que catalog ↔ body ↔ docs nunca
ficam defasados.

## Por que fazer isso

Estado atual: três fontes de verdade desincronizadas.

| Fonte | Conteúdo | Drift |
|---|---|---|
| `meta/skills.yaml` | name, title, description, purpose, when/whenNot, examples, related, tags, ide_compatibility, flags booleanas | canônico, mas raso — não tem subcomandos estruturados, one-liner, emoji, deps |
| `README.md` | tabela com emoji + one-liner + Iron Law + seções por skill com narrativa | **hand-written** — drift garantido vs catalog |
| `src/dashboard/components/help/HelpView.tsx` | const `SKILLS` hardcoded | **hardcoded** — comentário admite: "since aideck does not yet expose them over REST" |

Iron Law e "What it does" (prosa longa) ficam no body (`skills/en/.../X.md`) —
é o que o Claude lê em runtime. O catalog **não duplica** essas diretivas; os
geradores extraem do body quando precisam.

## Camadinha

| Camada | Vive aqui | Quem lê |
|---|---|---|
| `skills/en/<scope>/<name>.md` | Iron Law, narrativa completa, steps, gates, exemplos detalhados | **Claude** quando o usuário invoca o skill |
| `meta/skills.yaml` | índice estruturado: nome, título, when/whenNot, subcomandos, args, deps, output_artifacts, tags | **HelpView**, **validator**, **gerador de README** |
| `README.md` + `skills.generated.ts` (gerados) | tabela + seções legíveis + dados pro HelpView | leitor do GitHub/npm, dashboard do aideck |

## Fases (ordem obrigatória)

| # | Fase | Arquivos | Tempo |
|---|---|---|---|
| A | Schema v0.2 spec + validator | `docs/kb/skill-frontmatter-spec.md`, `scripts/validate-skills.js`, `tests/validate-skills.test.js` (novo) | 30 min |
| B | Skill piloto: project-status migrado pra v0.2 | `meta/skills.yaml` (só essa entry) | 15 min |
| **— Pause —** | **Aprovar piloto antes do bulk** | — | — |
| C | Normalizar 6 bodies sem `## Iron Law` + bulk rewrite dos 12 skills | `skills/en/core/*.md` (6 edits) + `meta/skills.yaml` | 2-3h |
| D | README generator + testes | `scripts/generate-readme.js`, `tests/generate-readme.test.js`, `README.md` (com markers) | 60 min |
| E | HelpView generator + testes | `scripts/generate-helpview-data.js`, `tests/generate-helpview-data.test.js`, `src/dashboard/data/skills.generated.ts`, `src/dashboard/components/help/HelpView.tsx` | 60 min |
| F | Enforcement (pre-commit + CI novo workflow) | `.husky/pre-commit`, `package.json`, `.github/workflows/test.yml` (novo) | 30 min |

**Total: ~5-6h** sequencial (subiu de 4-5h após review interno — Fase C
ganha trabalho de normalização e Fase D/E ganham testes).

---

## Fase A — Schema v0.2 + validator

### A.1 — Novos campos (3 obrigatórios + 4 opcionais em v0.2)

Schema v0.2 adiciona 7 campos: 3 são obrigatórios em entries v0.2
(`one_liner`, `emoji`, `version_added`) e 4 são opcionais (`subcommands`,
`args`, `output_artifacts`, `dependencies`). Nenhum substitui campo
existente — v0.2 é aditiva ao nível de campo. Mas o validator faz hard cut
em `schema_version` (vide A.2): após Fase C, entries `schema_version: '0.1'`
são rejeitadas.

| Campo | Tipo | Obrigatório em v0.2 | Descrição |
|---|---|---|---|
| `one_liner` | string (10-80 chars) | **sim** | tagline curta pra tabela do README + card do HelpView. Distinto de `description` (que vai pra IDE frontmatter via `render.js`). |
| `emoji` | string (1-4 chars) | **sim** | ícone na tabela do README. Aceita grapheme cluster (emoji composto). |
| `version_added` | string (regex `^\d+\.\d+\.\d+$`) | **sim** | versão `package.json` em que o skill apareceu. README usa para tag "new in X.Y.Z". |
| `subcommands` | object[] (vide A.1.1) | opcional | índice estruturado de subcomandos. Skills sem subcomandos omitem. |
| `args` | object[] (vide A.1.2) | opcional | flags + posicionais do skill TOP-level (não subcomandos). |
| `output_artifacts` | string[] | opcional | paths/patterns que o skill escreve (`.atomic-skills/reviews/<date>-<slug>.md`). |
| `dependencies` | string[] | opcional | tools externos requeridos (`codex`, `git`, `gh`). |

#### A.1.1 — Shape de `subcommands[]`

```yaml
subcommands:
  - name: new           # kebab-case, único dentro do skill
    signature: '<slug>' # CLI-style: <required> [<optional>] --flag
    description: 'Create a new Initiative (standalone or under active plan)'
    example: '/atomic-skills:project-status new my-feature'
  - name: pop
    signature: '[--resolve|--park|--emerge]'
    description: 'Pop the top stack frame with a destination'
    example: '/atomic-skills:project-status pop --park'
```

Validação:
- `name` kebab-case, `^[a-z][a-z0-9-]*$`
- `signature` string, qualquer conteúdo (livre — só humanos leem)
- `description` string non-empty
- `example` string non-empty começando com `/atomic-skills:<skill-name>`

#### A.1.2 — Shape de `args[]`

```yaml
args:
  - name: symptom
    kind: positional
    required: false
    description: 'The observed bug or unexpected behavior. If omitted, skill prompts interactively.'
  - name: '--target'
    kind: option
    required: false
    description: 'Phase id to target. Defaults to active phase.'
    default: 'active phase'
  - name: '--allow-dirty'
    kind: flag
    required: false
    description: 'Skip the dirty-tree pre-flight check.'
```

Validação:
- `name` string non-empty
- `kind` enum: `positional` | `flag` | `option`
- `required` boolean
- `description` string non-empty
- `default` opcional, string — interpretado como **descrição em prosa do
  default** (ex: `'active phase'`, `'current working directory'`), NÃO
  literal. UI renderiza como "defaults to <description>" entre parênteses.
  Não há campo separado pra "literal default value" porque skills com
  defaults literais em geral usam um placeholder semântico no body.

### A.2 — Validator update (`scripts/validate-skills.js`)

Comportamento durante migração (Fase B → C):
- Substituir constante `SCHEMA_VERSION = '0.1'` (atual, linha 22 do
  validator) por `const ACCEPTED_SCHEMA_VERSIONS = new Set(['0.1', '0.2'])`.
- Check de versão (linhas 64-66 do validator): muda de `entry.schema_version
  !== SCHEMA_VERSION` para `!ACCEPTED_SCHEMA_VERSIONS.has(entry.schema_version)`.
- Branch v0.1 entries: valida só os campos v0.1 (status quo).
- Branch v0.2 entries: valida v0.1 + os 7 campos novos (3 required + 4
  optional shape-checked quando presentes).
- Após Fase C completa: revert pra `const ACCEPTED_SCHEMA_VERSIONS = new
  Set(['0.2'])` (hard cut de v0.1).

**Verificado nesta sessão:** apenas `scripts/validate-skills.js` consome o
validador; `tests/install.test.js:242` escreve fixture yaml mas chama
`installSkills`, não o validator. Adicionar cross-checks não quebra
install.test.js.

Cross-checks novos (rodam pra **todos** entries, independente da versão):

1. **Skill body existe.** Pra cada entry no catalog, o `.md` correspondente
   tem que existir:
   - `core.<name>` → `skills/en/core/<name>.md`
   - `modules.<mod>.<name>` → `skills/en/modules/<mod>/<name>.md`
2. **Skill body tem entry no catalog.** Faz o inverso: walk em
   `skills/en/{core,modules/*}/` e verifica que cada `.md` tem entry.
3. **`related` refs apontam pra skill existente** (já é checado, mantém).
4. **`subcommands[].name` é único dentro do skill** (não pode ter
   duplicate).
5. **`example` em subcommands começa com `/atomic-skills:<skill-name>`**
   (sanity check de copy-paste).

**Cross-check deferido pra Fase C: `## Iron Law` section em todo body.**
Verificado nesta sessão (2026-05-22): apenas 7 de 13 bodies têm a seção
canônica. Adicionar essa gate em Fase A quebraria a própria DoD (`npm run
validate-skills verde`). Mover pra Fase C garante que a normalização dos 6
bodies faltantes acontece ANTES do gate ser ligado.

Bodies sem `## Iron Law` (precisam ser normalizados em Fase C):
- `skills/en/core/fix.md`
- `skills/en/core/hunt.md`
- `skills/en/core/review-plan-internal.md`
- `skills/en/core/review-plan-vs-artifacts.md`
- `skills/en/core/save-and-push.md`
- `skills/en/modules/memory/init-memory.md`

Bodies com duplicidade (extrair só a primeira, ou normalizar):
- `skills/en/core/prompt.md` (2 ocorrências de `^## Iron Law`)

### A.3 — Novos testes (`tests/validate-skills.test.js`)

Arquivo novo (não existe ainda — validator hoje só roda como CLI).
Cobre:

- v0.1 entry válida passa
- v0.2 entry válida passa
- v0.2 entry sem `one_liner` falha com mensagem clara
- v0.2 entry com `version_added` malformado falha
- v0.2 subcommand sem `name` falha
- v0.2 subcommand `example` que não começa com `/atomic-skills:<name>` falha
- Cross-check: catalog tem entry sem `.md` correspondente → falha
- Cross-check: `.md` existe sem catalog entry → falha
- Cross-check: skill body sem `## Iron Law` → falha
- Validator não muta nada (puro: roda em fixture, conta issues)

### A.4 — Atualização do spec doc

`docs/kb/skill-frontmatter-spec.md` ganha:
- Bump pra v0.2 no cabeçalho
- Seção "Schema (v0.2)" mostrando YAML com os 7 campos novos
- Tabela "Field reference" expandida
- Seção "Migration v0.1 → v0.2" descrevendo o gate de transição
- Move o exemplo de `project-status` pra v0.2 completo (pós-pilot)

---

## Fase B — Skill piloto: `project-status`

Escolha justificada: `project-status` é o skill com mais surface area
(`new-plan`, `new`, `push`, `pop`, `park`, `emerge`, `promote`, `done`,
`phase-done`, `phase-reopen`, `archive`, `switch`, `migrate`, `re-ratify`,
`re-bootstrap`, `scope-creep`, `detect-scope`) — se v0.2 cobre esse, cobre
qualquer outro.

### B.1 — Entry v0.2 esperada (target shape)

```yaml
core:
  project-status:
    # v0.1 fields (preservados)
    name: project-status
    title: 'Project Status — Initiative Tracking'
    # description preservada literalmente do v0.1 (additive — v0.2 não reescreve)
    description: "Canonical per-initiative status tracking. Maintains .atomic-skills/ tree with stack + tasks + parked + emerged per initiative. Terminal compact view + browser via mdprobe. Auto-installs CLAUDE.md HARD-GATE + AGENTS.md redirect + Claude Code hooks (SessionStart injection, Stop predicate in dry-run). Use whenever starting, resuming, pushing/popping stack frames, parking lateral findings, or viewing status across sessions and worktrees."
    purpose: >
      Track work via Plan/Initiative/Task hierarchy with stack, parked,
      emerged, and verifiable exit gates. Bird's-eye + zoom mental model.
    when_to_use:
      - 'Starting a new piece of work'
      - 'Resuming after a break'
      - 'Pushing or popping a stack frame'
      - 'Parking lateral findings or emerging new initiatives'
      - 'Viewing status across sessions or worktrees'
    when_not_to_use:
      - 'One-shot questions'
      - 'Work that fits entirely in the current session'
      - 'Creating a multi-phase plan (use project-plan instead)'
    examples:
      - command: '/atomic-skills:project-status'
        description: 'View current state'
      - command: '/atomic-skills:project-status new my-feature'
        description: 'Start a new standalone initiative'
    related: [fix, save-and-push, project-plan]
    tags: [tracking, anchoring, planning, core]
    ide_compatibility: [claude-code, gemini, cursor]
    requires_args: false
    mutates_repo: true
    network_required: false

    # v0.2 fields (novos)
    one_liner: 'Canonical per-initiative status tree with stack + parked + emerged; enforces via hooks'
    emoji: '📊'
    version_added: '1.5.0'
    subcommands:
      - name: new-plan
        signature: '<slug>'
        description: 'Bootstrap a new Plan via the project-plan skill'
        example: '/atomic-skills:project-status new-plan v3-redesign'
      - name: new
        signature: '<slug>'
        description: 'Create a new Initiative (standalone or under active plan)'
        example: '/atomic-skills:project-status new my-feature'
      - name: push
        signature: '<description>'
        description: 'Push a new stack frame (lateral expansion)'
        example: '/atomic-skills:project-status push "investigating slow query"'
      - name: pop
        signature: '[--resolve|--park|--emerge]'
        description: 'Pop top frame with destination'
        example: '/atomic-skills:project-status pop --park'
      - name: park
        signature: '<description>'
        description: 'Add a parked item (note for later, no decision yet)'
        example: '/atomic-skills:project-status park "consider caching layer"'
      - name: emerge
        signature: '<description>'
        description: 'Add an emerged finding (real follow-up worth promoting)'
        example: '/atomic-skills:project-status emerge "auth refactor needed"'
      - name: promote
        signature: '<title-or-idx>'
        description: 'Promote a parked item to a real task'
        example: '/atomic-skills:project-status promote 2'
      - name: done
        signature: '<task-id>'
        description: 'Mark task done; triggers phase-completion check if last'
        example: '/atomic-skills:project-status done T-005'
      - name: phase-done
        signature: ''
        description: 'Verify exit gates, advance to next phase (prompts codex review)'
        example: '/atomic-skills:project-status phase-done'
      - name: phase-reopen
        signature: '[<phase-id>]'
        description: 'Reverse of phase-done — clears metAt on exit criteria'
        example: '/atomic-skills:project-status phase-reopen F2'
      - name: archive
        signature: '[<slug>]'
        description: 'Move plan/initiative to archive/ (cascades from plan to children)'
        example: '/atomic-skills:project-status archive v3-redesign'
      - name: switch
        signature: '<slug>'
        description: 'Pause current active plan/initiative, set target as active'
        example: '/atomic-skills:project-status switch my-feature'
      - name: migrate
        signature: '<slug>'
        description: 'Migrate a legacy file to schema 0.1'
        example: '/atomic-skills:project-status migrate sample-legacy'
      - name: re-ratify
        signature: '<id>'
        description: 'Re-articulate context of an existing item (stale lastReviewedAt)'
        example: '/atomic-skills:project-status re-ratify P-3'
      - name: re-bootstrap
        signature: '<slug>'
        description: 'Batch re-articulate placeholder context after migrate'
        example: '/atomic-skills:project-status re-bootstrap sample-legacy'
      - name: scope-creep
        signature: ''
        description: 'On-demand drift report (read-only, surfaces stale items)'
        example: '/atomic-skills:project-status scope-creep'
      - name: detect-scope
        signature: ''
        description: 'Suggest scope.paths value based on recent git activity'
        example: '/atomic-skills:project-status detect-scope'
    args:
      - name: '--list'
        kind: flag
        required: false
        description: 'List all initiatives across all plans'
      - name: '--plan'
        kind: option
        required: false
        description: 'Filter view to a specific plan slug'
      - name: '--phase'
        kind: option
        required: false
        description: 'Filter view to a specific phase id'
      - name: '--stack'
        kind: flag
        required: false
        description: 'Show only the active stack (compact view)'
      - name: '--archived'
        kind: flag
        required: false
        description: 'Show archived items'
    output_artifacts:
      - '.atomic-skills/PROJECT-STATUS.md'
      - '.atomic-skills/plans/<slug>.md'
      - '.atomic-skills/initiatives/<slug>.md'
      - '.atomic-skills/status/config.json'
      - '.atomic-skills/dispatches/<slug>.md (when promote-to-dispatch)'
    dependencies: [git]

    schema_version: '0.2'
```

### B.2 — Aprovação do piloto

Após Fase B, pausa pra revisão:
- Você lê o shape final
- Confirma se subcommands estão completos (esse skill tem ~17 deles)
- Confirma se a granularidade está certa (ex: vale ter `args` separado de `subcommands` ou colapsa?)
- Sinaliza ajustes ao schema antes do bulk em 12 outros skills

---

## Fase C — Normalização de bodies + bulk rewrite (12 skills restantes)

### C.1 — Normalizar bodies sem `## Iron Law` (~30 min)

Antes do bulk metadata rewrite, garantir que todo body tem a seção
canônica. Pra cada um, ler o body + entry do README pra recuperar o Iron
Law que já estava documentado lá:

1. `skills/en/core/fix.md` — README documenta `NO FIX WITHOUT ROOT CAUSE`
2. `skills/en/core/hunt.md` — README documenta `NO HUNT WITHOUT BOUNDED SCOPE`
3. `skills/en/core/review-plan-internal.md` — README documenta `NO APPROVAL WITHOUT EVIDENCE`
4. `skills/en/core/review-plan-vs-artifacts.md` — README documenta `NO APPROVAL WITHOUT CROSS-REFERENCE`
5. `skills/en/core/save-and-push.md` — README documenta `NO PUSH WITHOUT FRESH VERIFICATION`
6. `skills/en/modules/memory/init-memory.md` — README documenta `NO DELETION WITHOUT CONFIRMED BACKUP`

Pra `prompt.md`: decidir se mantém as 2 ocorrências (a canônica em linha 6
+ a nested em 46) ou colapsa. Regex do gerador pega a primeira (D.2), então
manter os dois funciona — mas dois `## Iron Law` no mesmo doc é confuso
pra humanos. **Recomendação:** renomear a segunda pra `## Iron Law (rule N)`
ou `### Iron Law` (H3, não H2) pra desambiguar.

Após esses 7 edits: ligar o gate `## Iron Law` no validator (cross-check
#6 da A.2 que estava deferido).

### C.2 — Bulk rewrite de 12 entries no `meta/skills.yaml` (~1.5-2h)

Ordem (do simples pro complexo, pra catch issues cedo):

1. `init-memory` (mais simples — 0 subcomandos)
2. `prompt`
3. `save-and-push`
4. `fix`
5. `hunt` (tem modo triage pra diretório — testa `args`)
6. `review-plan-internal`
7. `review-plan-vs-artifacts`
8. `review-plan-with-codex`
9. `review-code-with-codex` (testa `dependencies: [codex, git]`)
10. `parallel-dispatch-audit`
11. `parallel-dispatch` (HARD-GATEs — testa narrativa rica)
12. `project-plan` (testa subcomando `adopt`)

Por skill: ~5-10 min. Total ~1.5-2h.

Pra cada skill: ler body `.md` + entry atual no yaml + seção do README →
preencher os 7 campos novos → rodar `validate-skills`.

### C.3 — Hard cut de v0.1

Após o último skill migrado: trocar
`ACCEPTED_SCHEMA_VERSIONS = new Set(['0.1', '0.2'])` pra
`new Set(['0.2'])` em `scripts/validate-skills.js`. Validator passa a
rejeitar `schema_version: '0.1'`.

---

## Fase D — README generator (`scripts/generate-readme.js`)

### D.1 — Markers em `README.md`

Inserir no README:

```markdown
## Skills

### Overview

<!-- SKILLS_TABLE_START -->
(generated — do not edit by hand; run `npm run generate-docs`)
| | Skill | One-liner | Iron Law |
|---|---|---|---|
...
<!-- SKILLS_TABLE_END -->

<!-- SKILL_DETAILS_START -->
(generated)

### `atomic-skills:fix` — Root Cause Diagnosis + TDD Fix

**Iron Law:** NO FIX WITHOUT ROOT CAUSE

**One-liner:** Diagnose root cause → write test → fix → verify

**What it does:** [extracted from skill body's "## What it does" section]

**When to use:** [from when_to_use]
**When NOT to use:** [from when_not_to_use]

**Subcommands:** [from subcommands[]]
| Command | Description |
|---|---|
| `<example>` | <description> |

**Examples:**
[from examples]

**Output artifacts:** [from output_artifacts]
**Dependencies:** [from dependencies]
**Version added:** [from version_added]

---

(repeat for each skill)
<!-- SKILL_DETAILS_END -->
```

Todo conteúdo HAND-WRITTEN do README (header, "Why Atomic?", "Multi-Agent
Optimization", "Techniques", "Development & QA", footer) fica FORA dos
markers e nunca é tocado pelo generator.

### D.2 — Lógica do generator

```js
// scripts/generate-readme.js (pseudocode)
const args = parseArgs(process.argv);  // supports --check
1. Load meta/skills.yaml
2. For each skill body file: extract "## Iron Law" content (regex: first match only — prompt.md has 2 occurrences)
3. For each skill body file: extract "## What it does" or "## Why this matters" (regex)
4. Render SKILLS_TABLE: emoji + skill (link) + one_liner + iron_law
5. Render SKILL_DETAILS: per-skill section using all v0.2 fields + extracted body sections
6. Read current README.md
7. Compute new README by replacing content between markers
8. If --check:
     - Compute unified diff between current and new
     - If empty: exit 0 (silent)
     - If non-empty: print diff to stderr + exit 1
9. Else:
     - If new !== current: write README.md back
     - Print "✓ README synchronized" + exit 0
```

**Iron Law regex contract:** `^## Iron Law\n+(.+?)(?=\n## |\n---|\Z)` (first
match only, multiline, captures content up to next H2 or `---`). prompt.md
has 2 `## Iron Law` lines — the regex MUST take the first one (line 6),
which is the canonical skill-level law; the second (line 46) is a nested
section.

### D.3 — Testes (`tests/generate-readme.test.js`, novo)

CI drift-check só pega DIVERGÊNCIA, não bugs de lógica que produzem
output errado-mas-estável. Testes unitários do generator:

- Fixture: yaml mínimo com 2 skills + 2 body files (`Iron Law` + `What it
  does` sections).
- Caso 1: tabela renderizada bate com golden file.
- Caso 2: detail sections batem com golden file.
- Caso 3: README com conteúdo hand-written fora dos markers — generator
  preserva tudo fora dos markers (regressão pro risco #1).
- Caso 4: README sem markers — generator falha com mensagem clara.
- Caso 5: body sem `## Iron Law` — generator falha (cruza com Fase C
  validator).

### D.4 — CI check

`npm run check-readme` roda o generator em dry-run e diffa contra
`README.md` checked-in. Exit 1 se diff. Conecta na CI + pre-commit hook.

---

## Fase E — HelpView generator (`scripts/generate-helpview-data.js`)

### E.1 — Output file

```ts
// src/dashboard/data/skills.generated.ts
// GENERATED — do not edit. Source: meta/skills.yaml. Run `npm run generate-docs`.

export interface Skill {
  id: string
  title: string
  oneLiner: string
  emoji: string
  versionAdded: string
  summary: string             // = description
  when: string[]
  whenNot: string[]
  examples: { command: string; description: string }[]
  subcommands?: { name: string; signature: string; description: string; example: string }[]
  args?: { name: string; kind: 'positional' | 'flag' | 'option'; required: boolean; description: string; default?: string }[]
  outputArtifacts?: string[]
  dependencies?: string[]
  related?: string[]
  tags?: string[]
  active?: boolean            // sempre true por enquanto (todos os 13 são in-repo)
}

export const SKILLS: Skill[] = [
  // ... uma entry por skill, montada do yaml ...
]
```

### E.2 — Mudança em `HelpView.tsx`

```diff
- const SKILLS: Skill[] = [ ...inline... ]
+ import { SKILLS, type Skill } from '../../data/skills.generated'
```

A interface `Skill` no HelpView é substituída pela importada (mesma shape +
campos novos opcionais). Render passa a mostrar subcommands quando
disponíveis (nova seção no detail panel).

### E.3 — Testes (`tests/generate-helpview-data.test.js`, novo)

- Fixture: yaml mínimo com 2 skills.
- Caso 1: TypeScript gerado parseia (run `tsc --noEmit` no output).
- Caso 2: shape do `SKILLS` const bate com a interface `Skill` declarada
  no mesmo arquivo.
- Caso 3: campos opcionais (subcommands, args, etc.) ficam `undefined`
  quando ausentes no yaml — não emitem `[]` por engano.
- Caso 4: emoji/one_liner não escapados — verificar que caracteres
  unicode não viram `\uXXXX`.

### E.4 — CI check

`npm run check-helpview-data` — diff entre o generator output e o arquivo
checked-in. Exit 1 se drift.

---

## Fase F — Enforcement (pre-commit + CI)

### F.1 — `package.json` novos scripts

```json
{
  "scripts": {
    "validate-skills": "node scripts/validate-skills.js",
    "generate-docs": "node scripts/generate-readme.js && node scripts/generate-helpview-data.js",
    "check-docs": "node scripts/generate-readme.js --check && node scripts/generate-helpview-data.js --check",
    "validate-catalog": "npm run validate-skills && npm run check-docs"
  }
}
```

`--check` mode: generator não escreve, só diffa.

### F.2 — Pre-commit hook (Husky)

Instalar husky:
```bash
npm install --save-dev husky
npx husky init
```

`.husky/pre-commit`:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Only validate when skill catalog or skill bodies changed
if git diff --cached --name-only | grep -qE '^(meta/skills\.yaml|skills/en/|scripts/(validate-skills|generate-).*\.js)'; then
  npm run validate-catalog
fi
```

Skip via `git commit --no-verify` se necessário (mas o flag aparece no
log do commit).

### F.3 — CI step

Verificado nesta sessão (2026-05-22): `.github/workflows/` contém apenas
`publish.yml`. **Não existe workflow de test no repo.** Fase F deve:

1. **Criar `.github/workflows/test.yml`** (workflow novo, não amend) com job
   que roda em pushes a `main` + PRs:
   ```yaml
   name: test
   on:
     push:
       branches: [main]
     pull_request:
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '20' }
         - run: npm ci
         - run: npm test
         - run: npm run validate-catalog
   ```
2. **Não tocar `publish.yml`** — separação de responsabilidades (test ≠
   publish).

Falha o PR se README ou HelpView ficaram defasados vs `meta/skills.yaml`.

---

## Definition of done

### Fase A
- [ ] `docs/kb/skill-frontmatter-spec.md` documenta os 7 campos v0.2
- [ ] `scripts/validate-skills.js` usa `ACCEPTED_SCHEMA_VERSIONS = {'0.1', '0.2'}` (paralelo)
- [ ] Validator faz os 5 cross-checks da seção A.2 (Iron Law check fica deferido pra Fase C)
- [ ] `tests/validate-skills.test.js` cobre os casos felizes + falhas
- [ ] `npm run validate-skills` verde com catalog atual (v0.1 só)
- [ ] `npm test` verde

### Fase B
- [ ] `project-status` migrado pra v0.2 em `meta/skills.yaml`
- [ ] Validator passa com 1 entry v0.2 + 12 entries v0.1
- [ ] **PAUSA — user aprova shape antes de Fase C**

### Fase C
- [ ] Normalizar 6 bodies sem `## Iron Law` (fix, hunt, review-plan-internal, review-plan-vs-artifacts, save-and-push, init-memory)
- [ ] Normalizar `prompt.md` (escolher se mantém duplicidade ou colapsa pra 1)
- [ ] Ligar gate `## Iron Law` no validator (cross-check #6, agora obrigatório)
- [ ] 12 skills restantes migrados pra v0.2
- [ ] `ACCEPTED_SCHEMA_VERSIONS = {'0.2'}` (hard cut de v0.1)
- [ ] `npm run validate-skills` verde

### Fase D
- [ ] `scripts/generate-readme.js` extrai Iron Law (primeira ocorrência) + "What it does" do body
- [ ] `--check` mode: exit 0 se sync, exit 1 + print diff stderr se drift
- [ ] README com markers `<!-- SKILLS_TABLE_START -->` e `<!-- SKILL_DETAILS_START -->`
- [ ] `tests/generate-readme.test.js` cobre os 5 casos da seção D.3
- [ ] `npm run generate-docs` reescreve seções marcadas
- [ ] `npm run check-docs` falha quando README está defasado
- [ ] Conteúdo hand-written fora dos markers fica intocado

### Fase E
- [ ] `scripts/generate-helpview-data.js` gera `src/dashboard/data/skills.generated.ts`
- [ ] `--check` mode (mesma semântica do D)
- [ ] `tests/generate-helpview-data.test.js` cobre os 4 casos da seção E.3
- [ ] `HelpView.tsx` importa do arquivo gerado
- [ ] Detail panel mostra subcomandos quando presentes
- [ ] `npm run check-helpview-data` falha em drift

### Fase F
- [ ] `husky` instalado como devDependency
- [ ] `.husky/pre-commit` roda `validate-catalog` quando catalog/bodies/scripts mudam
- [ ] `.github/workflows/test.yml` criado (novo arquivo — não existe)
- [ ] CI workflow chama `npm test` + `npm run validate-catalog`
- [ ] `package.json` tem os 4 scripts novos (`validate-skills`, `generate-docs`, `check-docs`, `validate-catalog`)

---

## Não-mudanças deliberadas

- **Não muda estrutura `core: / modules:`** em `meta/skills.yaml`. Tree
  continua igual.
- **Não toca skill body content na maior parte** — Fase C.1 adiciona seção
  `## Iron Law` em 6 bodies que não têm (sub-tarefa explícita, não exceção
  ad-hoc). Nenhum outro conteúdo do body é editado.
- **Não bumpa `package.json` version** — feature aditiva (catalog ganha
  campos opcionais; geradores são scripts novos).
- **Não altera `src/render.js`** — o renderer IDE-frontmatter continua
  consumindo só `name + description`. Catalog v0.2 não muda o que o IDE
  vê.
- **Não muda `install.js` nem `detect.js`** — eles leem catalog mas só
  pra `name`/`description`/`modules`. v0.2 é aditiva, não quebra esses.
- **Não cria PT version do README** — verificado nesta sessão que
  `README.pt-BR.md` existe. Decisão: gerador só atualiza `README.md` (EN).
  `README.pt-BR.md` permanece hand-written; vai gradualmente ficando
  desatualizado em relação ao EN. Fica fora do escopo desta iniciativa
  (consistente com decisão EN-only de 2026-05-22, ver
  `.ai/memory/decisao-skills-en-only.md`). Sub-tarefa futura possível:
  deletar `README.pt-BR.md` ou substituir por um stub "see README.md".

---

## Riscos / armadilhas

1. **Generator mangling content fora dos markers** — risco moderado.
   Mitigação: markers únicos com `_START`/`_END` distintos; generator usa
   regex multiline com lookbehind/lookahead e SÓ substitui o que está
   entre markers. Teste: gerar uma vez, rodar com README modificado fora
   dos markers, verificar que conteúdo fora não muda.
2. **Iron Law extraction frágil** — body pode ter `## Iron Law` formatado
   diferente (ex: `## Iron Law:` ou `## The Iron Law`). Mitigação:
   validator obriga formato canônico `^## Iron Law\n` (depois do espaço,
   linha vazia, depois o conteúdo). Se algum skill atual não bate,
   normalizar em Fase C.
3. **Pre-commit hook lento** — validate-catalog roda generators que leem
   yaml + 13 `.md` files. Estimativa: <500ms. Mitigação: hook só roda
   quando catalog/bodies/scripts mudaram (filtro com `git diff --cached
   --name-only | grep`).
4. **HelpView.tsx perde features** se generator não cobrir tudo.
   Mitigação: ler HelpView ANTES de definir shape do gerado; garantir
   que toda field renderizada hoje vem do generator.
5. **Bulk rewrite tedioso** — 12 skills × 5-10 min é cansativo. Mitigação:
   ordem do simples pro complexo, aprovar piloto antes pra ter shape
   estável.
6. **`version_added` desconhecido** — pra skills antigos, não sei a versão
   exata. Mitigação: aceitar `'1.0.0'` como padrão pra skills sem
   record, e pra skills com `(new in X.Y.Z)` no README usar exatamente
   isso.

---

## Como invocar a próxima sessão

> "Leia `docs/plan-skills-catalog-v0.2.md` e execute Fase A + Fase B.
> Pause antes da Fase C pra eu aprovar o shape do piloto."

Ou, pra rodar tudo direto (não recomendado sem aprovação do piloto):

> "Execute todas as fases A-F do plan-skills-catalog-v0.2.md."
