# Plan — `re-bootstrap <slug>` (batch re-articulation of migrated context)

Sessão 2026-05-21. Adiciona à skill `atomic-skills:project-status` um comando
que, depois de `migrate <slug>` aplicar o renome estrutural, percorre cada
parked/emerged com `context` placeholder, lê evidence do projeto, propõe um
draft de `solves`/`trigger`/`assumesStillValid`, e gate de ratify por item.

Pré-requisito: `migrate.js` já gera placeholder honesto (linha 98-109).
Esta proposta encaixa em cima — não muda o que migrate faz, só consome
o resultado.

## Por que separado de `migrate`

- `migrate` é estrutural (rename + ISO + placeholder). <1s, idempotente, sem prompts.
- `re-bootstrap` é semântico (lê o projeto, propõe, ratify gate por item). Interativo, $$ real (LLM thinking).
- Separar deixa `migrate` chamável em CI/scripts; `re-bootstrap` fica como follow-up explícito.

## Fases (ordem obrigatória)

| # | Fase | Arquivos | Tempo |
|---|---|---|---|
| 1 | Helper de detecção em `migrate.js` + export | `src/migrate.js` | 5 min |
| 2 | Testes do helper + idempotência | `tests/migrate.test.js` | 10 min |
| 3 | Skill body EN — nova seção + ref no migrate | `skills/en/core/project-status.md` | 20 min |
| 4 | Skill body PT — tradução paralela | `skills/pt/core/project-status.md` | 15 min |
| 5 | Validação: `npm run validate-skills` + `npm test` | (script) | 2 min |

**Total: ~50 min.** Sem mudança em aideck, sem novas deps, sem bump de schema.

---

## Fase 1 — helper de detecção em `src/migrate.js`

### 1a. Adicionar constante e função, antes de `migrationContext` (l. 93):

```js
// Marker prefix used by migrationContext().solves. Detect-and-replace by
// re-bootstrap; do NOT shorten without updating MIGRATION_PLACEHOLDER_PREFIX.
const MIGRATION_PLACEHOLDER_PREFIX = '(migrated from legacy schema)';

/**
 * True iff `context.solves` was synthesized by migrationContext() and has
 * not yet been replaced by a real re-ratify / re-bootstrap.
 *
 * Pure: no I/O. Idempotency-safe — re-bootstrap iterates only over items
 * where this returns true, so already-ratified items are never re-prompted.
 */
export function isMigratedPlaceholder(context) {
  if (context == null || typeof context !== 'object') return false;
  if (typeof context.solves !== 'string') return false;
  return context.solves.startsWith(MIGRATION_PLACEHOLDER_PREFIX);
}
```

### 1b. Atualizar `migrationContext` (l. 98) para usar a constante (cosmético — garante que o detector e o gerador continuam sincronizados):

```js
function migrationContext(nowIso, kind, title) {
  return {
    solves: `${MIGRATION_PLACEHOLDER_PREFIX} Original ${kind} entry — re-ratify to articulate the real problem this addresses.`,
    trigger: `Schema upgrade to 0.1 found this ${kind} item with no context block; preserved verbatim by the migrate script.`,
    assumesStillValid: [
      `The title "${title}" still describes a real concern at re-ratify time.`,
    ],
    ratifiedAt: nowIso,
    ratifiedBy: 'human',
    lastReviewedAt: nowIso,
  };
}
```

**Por que `startsWith` e não regex full-match:** se uma versão futura de
`migrationContext` apendar info ao final do `solves` (ex: timestamp), a
detecção continua funcionando. O prefixo é o contrato.

---

## Fase 2 — testes em `tests/migrate.test.js`

### 2a. Estender o import existente

O arquivo já tem na linha 9: `import { migrateLegacyInitiative } from '../src/migrate.js';`. Edite essa linha para incluir `isMigratedPlaceholder`:

```js
// linha 9 — substituir:
import { migrateLegacyInitiative, isMigratedPlaceholder } from '../src/migrate.js';
```

**Não adicione um segundo bloco de import** — duplicar `migrateLegacyInitiative` quebra o módulo com erro de declaração léxica antes dos testes rodarem.

### 2b. Append dos novos testes no fim do arquivo

```js
test('isMigratedPlaceholder detects placeholder from migrationContext', () => {
  const legacy = {
    initiative_id: 'demo',
    started: '2026-05-01',
    last_updated: '2026-05-01',
    stack: [{id:1, title:'work', type:'task', opened_at:'2026-05-01T00:00:00Z'}],
    parked: [{title:'sample', surfaced_at:'2026-05-01T00:00:00Z', from_frame:1}],
    emerged: [],
  };
  const result = migrateLegacyInitiative(legacy);
  assert.equal(isMigratedPlaceholder(result.frontmatter.parked[0].context), true);
});

test('isMigratedPlaceholder rejects ratified context', () => {
  assert.equal(
    isMigratedPlaceholder({
      solves: 'Real problem articulated by user.',
      trigger: 'Real trigger.',
      ratifiedAt: '2026-05-21T08:00:00Z',
    }),
    false
  );
});

test('isMigratedPlaceholder rejects malformed input', () => {
  assert.equal(isMigratedPlaceholder(null), false);
  assert.equal(isMigratedPlaceholder({}), false);
  assert.equal(isMigratedPlaceholder({solves: null}), false);
  assert.equal(isMigratedPlaceholder({solves: 'not a placeholder'}), false);
});

test('re-bootstrap idempotence: detector skips items already replaced', () => {
  // Simulates the post-re-bootstrap state: 1 item ratified, 1 still placeholder.
  const initiative = {
    parked: [
      {title: 'item A', context: {solves: '(migrated from legacy schema) ...', trigger: '...', ratifiedAt: '2026-05-21T08:00:00Z'}},
      {title: 'item B', context: {solves: 'Real articulation by user', trigger: 'Real trigger', ratifiedAt: '2026-05-21T09:00:00Z'}},
    ],
  };
  const targets = initiative.parked.filter((p) => isMigratedPlaceholder(p.context));
  assert.equal(targets.length, 1);
  assert.equal(targets[0].title, 'item A');
});
```

---

## Fase 3 — skill body EN: nova seção

**Arquivo:** `skills/en/core/project-status.md`

### 3a. Append nova seção depois de `re-ratify <id>` (após linha 708, antes de `### scope-creep` na linha 710):

````markdown
### `re-bootstrap <slug>` (mutation command — batch re-articulation)

Re-articulates the `context` of every parked/emerged item still carrying a
migration placeholder. Runs after `migrate <slug>` to replace the honest
"(migrated from legacy schema) — re-ratify to articulate" stub with a real
`solves` / `trigger` / `assumesStillValid` block per item, using evidence
gathered from the current project state.

**When to run:** right after `migrate <slug>`, OR any time you want to convert remaining placeholder items into real articulations. Note that `scope-creep` does NOT surface fresh placeholders — its detector ages by `lastReviewedAt` and migration sets that to `now`. Placeholder items appear in `scope-creep` only after they age past `staleContextDays` (default 14). To find them earlier: grep the initiative file for `(migrated from legacy schema)` or check `isMigratedPlaceholder` on each parked/emerged context.

**When NOT to run:** if the initiative has no placeholder items
(`isMigratedPlaceholder` returns false for every parked/emerged context),
the command exits as a no-op. Re-running on a partially-ratified initiative
only prompts the remaining placeholder items — fully idempotent.

#### Pre-flight

1. `{{READ_TOOL}}` `.atomic-skills/initiatives/<slug>.md`. Parse YAML frontmatter.
2. If `schemaVersion !== '0.1'`: abort with "Initiative is legacy. Run `migrate <slug>` first."
3. **Load excludes config.** `{{READ_TOOL}}` `.atomic-skills/status/config.json` (treat absent file or missing key as empty). Build the effective excludes list:
   ```js
   excludes = ['node_modules', 'dist', '.git', '*.lock']
              .concat(config.reBootstrapExcludes ?? [])
   ```
   Hold `excludes` for use in the per-item evidence step. Dedupe.
4. Build the target list: every `parked[i]` and `emerged[i]` where
   `isMigratedPlaceholder(context)` (imported from `src/migrate.js`) returns true.
5. If target list empty: announce "No placeholder items to re-articulate." and exit.
6. Print cost preview:
   > "<N> items to re-articulate. Each runs ~3 greps + ~1 git log + ~2 reads + 1 LLM draft.
   > Estimated wall: <N × ~20s>. Estimated $: depends on context, typically <N × ~$0.05>.
   > Proceed? [(y)es / (n)o]"
7. On `(n)`: abort. On `(y)`: continue.

#### Per-item loop

For each target item (P-1, P-2, ..., E-1, E-2, ...):

1. **Print header** for the item: `--- P-3 (parked, surfacedAt 2026-05-19) ---` + the full title.

2. **Evidence gathering** (read-only, scoped):
   - Extract keywords from the title using these rules, in priority order:
     - Identifiers in parens (e.g. `(T-005)`, `(F0.G1)`, `(cp4-f-007)`).
     - File paths (regex `[a-zA-Z0-9_/.-]+\.(ts|js|md|sh|yaml|yml|json|tsx)`).
     - CamelCase / kebab-case symbols longer than 4 chars (e.g. `parseInitiativeFile`, `matcher-key`).
     - Stop at 5 keywords max — order by specificity (paths > identifiers > symbols).
   - **Zero-keyword fallback** (when the rules above yield 0 matches):
     - Take the 3 longest non-stopword tokens (≥6 chars) from the title. EN+PT stopwords list: `the, a, an, and, or, but, of, in, on, with, that, this, for, from, after, before, into, onto, over, under, com, para, sem, entre, sobre, antes, depois, ainda, mesmo`.
     - If STILL 0 (title is purely short stopwords, e.g. `'fix bug'`): skip the entire evidence step. Mark every draft field with `[no evidence — title too generic; needs user input]` and proceed directly to step 3.
   - For each keyword (cap 3):
     - `{{GREP_TOOL}}` recursive in the project root, applying the `excludes` list built in pre-flight step 3. Cap 3 hits per keyword.
     - If any hit looks like a file path with extension: `{{READ_TOOL}}` the first ~80 lines for additional context (cap 2 reads total per item).
   - If keywords list is non-empty: `{{BASH_TOOL}}` `git log --oneline -10 --grep="<top-keyword>"` (1 call) to surface commits referencing the topic. **Skip this call when keywords list is empty** (otherwise `git log` with no pattern would dump unrelated commits).

3. **Draft proposal**:
   - Based on title + evidence + surfacedAt, draft:
     - `solves` — 1 sentence problem statement. If evidence is thin (< 2 grep hits and no commits), prepend `[low-confidence draft] ` and ask the user to verify.
     - `trigger` — what caused the item to surface. If surfacedAt is near commits found in `git log`, reference them ("Noticed during commit abc1234"). Otherwise: `[needs user input — agent could not infer trigger from title + project state]`.
     - `assumesStillValid` — at most 1 premise the agent is confident about (e.g. "The matcher-key issue still affects the F0 audit path"). If unsure: emit a single stub `[premise stub — edit to record what would invalidate this item]`.

4. **Ratify gate** (HARD halt — never auto-advance, never accept generic "ok"):
   ```
   Proposed re-articulation for P-3 ("4 pre-existing test failures..."):

   solves:           <draft>
   trigger:          <draft>
   assumesStillValid:
     - <draft premise>

   Evidence found (3 hits, 1 commit):
     - tests/zsh-completion-doc-preview.test.sh:42 — "mesh topic completion"
     - tests/menu.test.sh:87 — "BREW_BIN/BREW_PREFIX after 00-core"
     - 7a2f9b1 — "menu test prereq refresh"

   Type ONE OF:
     - `ratify`           apply this draft verbatim
     - <paste edits>      paste a full corrected block; lastReviewedAt advances to now
     - `skip`             keep placeholder; this item stays in scope-creep until handled
     - `cancel-batch`     stop the loop; already-ratified items in this run are kept
   ```
   - HALT until input.
   - A generic `ok` / `sim` / `yes` / `do it` reply is NOT ratify. Treat as the user asking for more specificity — re-prompt.

5. **Apply**:
   - On `ratify`: write the drafted context to the item. Advance `ratifiedAt` and `lastReviewedAt` to now. `ratifiedBy: human`.
   - On `skip`: no write. Continue loop.
   - On `cancel-batch`: stop loop. Items ratified earlier in the run stay saved.
   - On **paste edits**: see the canonical format below.

#### Pasted-edit canonical format

The user pastes a YAML-shaped block. Exactly these keys, in any order:

```yaml
solves: <string, ≥8 chars>
trigger: <string, ≥8 chars>
assumesStillValid:
  - <string, ≥4 chars>
  - <string, ≥4 chars>   # 0..N items, omit the key entirely for empty list
```

**Required fields:** `solves`, `trigger`.
**Optional:** `assumesStillValid` (defaults to `[]` when omitted; matches the contextSchema default).
**Forbidden:** any key other than the three above. `ratifiedAt`, `ratifiedBy`, `lastReviewedAt` are NEVER pasted — the command always advances them to now.

**Validation** (mirror `contextSchema` in `aideck/src/schemas/validators/project-status.ts`):
- `solves.length >= 8`, otherwise parse failure.
- `trigger.length >= 8`, otherwise parse failure.
- Every item in `assumesStillValid`: `length >= 4`, otherwise parse failure.

**Parse failure behavior** (any of: YAML syntax error, missing required field, length violation, unknown key):
1. Print the specific error: e.g. `"parse failed: missing required field 'trigger'"` or `"parse failed: solves length 5 < 8"` or `"parse failed: unknown key 'ratifiedBy' — timestamps advance automatically, do not paste them"`.
2. Re-print the canonical example block (above).
3. Re-prompt the user with the SAME four options (`ratify` / paste edits / `skip` / `cancel-batch`). The item is NOT skipped on parse failure — the user has to make an explicit choice.
4. Three consecutive parse failures on the same item: abort the loop with `"too many parse failures on <id>; cancel-batch invoked automatically"`. Items ratified earlier stay saved.

#### Post-loop

1. Print summary:
   ```
   re-bootstrap <slug> complete:
     ratified:     <R> items
     skipped:      <S> items (still placeholder; re-run to handle them)
     cancelled at: <item id, if any>
   ```
2. If S > 0: remind "Run `re-bootstrap <slug>` or `re-ratify <id>` to handle the remaining <S> items. Note that `scope-creep` will only flag them after `staleContextDays` (default 14)."
3. If R > 0: bump initiative `lastUpdated` to now. `{{WRITE_TOOL}}` the updated frontmatter back to `.atomic-skills/initiatives/<slug>.md`.

#### Honest limits

- The agent CAN fabricate plausible-but-wrong `solves`. The ratify gate is the only guarantee against this — read every draft before approving.
- `assumesStillValid` is the field most likely to be wrong: it asks "what makes this moot?" and the agent rarely knows the user's mental model. Prefer pasting edits over `ratify` for non-trivial premises.
- The grep-based evidence is project-wide. Old archived branches, vendored code, or generated files can trigger false-positive hits. Defaults exclude `node_modules`, `dist`, `.git`, `*.lock`; extend per-repo via `.atomic-skills/status/config.json:reBootstrapExcludes` (loaded in pre-flight step 3, applied in evidence step).
````

### 3b. Atualizar a seção `migrate <slug>` (linha 475-484) — adicionar nudge no relatório:

```markdown
### `migrate <slug>`

Explicit migration trigger for a legacy initiative the user wants to migrate ahead of a mutation.

1. Load `.atomic-skills/initiatives/<slug>.md`. Parse frontmatter.
2. If `schemaVersion === '0.1'`, announce "Already migrated" and exit.
3. Apply the **pre-mutation migration check** flow described above (standalone vs in-plan choice).
4. Run `src/migrate.js`:`migrateLegacyInitiative(legacy, { parentPlan, phaseId })`. Write the result back.
5. Report: "Migrated `<slug>` to schemaVersion 0.1. Field mapping summary: ..." (show the diff at a high level).
6. If the migrated file has any item where `isMigratedPlaceholder(context)` is true, append: **"<N> parked/emerged items carry placeholder context. Run `re-bootstrap <slug>` to re-articulate them in batch, or `re-ratify <id>` per item."**
7. Optionally run `npm run validate-state -- .atomic-skills/initiatives/<slug>.md` to confirm.
```

(diff = passos 6 e 7 — 7 era 6 antes; novo passo 6 é o nudge.)

---

## Fase 4 — skill body PT

**Arquivo:** `skills/pt/core/project-status.md`

Mesma estrutura, tradução paralela. Use o seguinte mapeamento de termos canônicos (consistente com o resto do arquivo PT):

| EN | PT |
|---|---|
| placeholder | placeholder (estrangeirismo aceito) |
| ratify | ratify (mesmo comando, não traduzir) |
| evidence gathering | coleta de evidência |
| ratify gate | gate de ratify (HARD halt — nunca auto-advance) |
| low-confidence draft | draft com baixa confiança |
| premise stub | premissa-stub |
| skip / cancel-batch | manter em inglês (são tokens do comando) |

Os tokens de comando (`ratify`, `skip`, `cancel-batch`, `re-bootstrap`) NÃO traduzem — o usuário tipa exatamente isso, igual o restante da skill.

---

## Fase 5 — validação

```bash
npm run validate-skills       # verifica YAML frontmatter de todos os skills
npm test                      # roda os 369 testes existentes + 4 novos do migrate.test.js
```

---

## Definition of done

- [ ] `isMigratedPlaceholder` exportada de `src/migrate.js`
- [ ] `MIGRATION_PLACEHOLDER_PREFIX` constante extraída e referenciada por `migrationContext`
- [ ] Import na linha 9 de `tests/migrate.test.js` estendido (NÃO duplicado) para incluir `isMigratedPlaceholder`
- [ ] 4 testes novos passam em `npm test`
- [ ] Seção `### re-bootstrap <slug>` presente em ambos os skill bodies EN + PT, usando `{{READ_TOOL}}`/`{{WRITE_TOOL}}`/`{{GREP_TOOL}}`/`{{BASH_TOOL}}` nos passos operacionais
- [ ] Pre-flight da nova seção carrega `.atomic-skills/status/config.json:reBootstrapExcludes` e aplica no grep step
- [ ] Zero-keyword fallback documentado: stopwords list + skip-evidence quando lista fica vazia
- [ ] Pasted-edit canonical format documentado (campos required + validação + parse-failure behavior)
- [ ] Nenhuma claim de que `scope-creep` flagga placeholders frescos (só após `staleContextDays`)
- [ ] `### migrate <slug>` aponta para `re-bootstrap` no relatório (passo 6)
- [ ] `npm run validate-skills` verde
- [ ] `npm test` verde

---

## Não-mudanças deliberadas

- **Não muda `migrateLegacyInitiative`** — só extrai a constante do prefixo. O comportamento de migrate continua idêntico (placeholder honesto inserido).
- **Não mexe em aideck** — o helper é puro JS local da skill, não toca no schema runtime.
- **Não muda o JSON Schema** — `context` ainda required em parked/emerged, com a forma que já está.
- **Não cria comando "migrate --rearticulate"** — duas operações, dois comandos. Você roda `migrate` em CI/script; `re-bootstrap` é interativo separado.
- **Não bumpa versão** — feature aditiva, não-breaking.

---

## Riscos / armadilhas

1. **Custo $$** — re-bootstrap em initiative com 20+ itens ≈ 100+ tool calls + LLM thinking. Mitigação: cost preview no pre-flight (passo 5) com confirmação explícita.
2. **Fabricação plausível** — agente pode propor `solves` convincente mas inventado. Mitigação: ratify gate HARD + marcador `[low-confidence draft]` quando evidence < 2 hits.
3. **Evidence pollution** — projeto com `node_modules`/`dist` enorme floods grep com hits irrelevantes. Mitigação: excludes default + `reBootstrapExcludes` em config.
4. **Skill body cresce** — +95 linhas em EN. Aceitável (skill já tem ~1014). Manter tom seco (sem prosa explicativa, sem "is recommended that..."  — usar imperativo).
5. **Tradução PT divergente** — fácil esquecer um passo na tradução paralela. Mitigação: copy-paste estrutura, então traduzir prosa e VERIFICAR que todos os tokens de comando (`re-bootstrap`, `skip`, etc) e snippets de código permanecem idênticos.

---

## Como invocar a próxima sessão

> "Leia `docs/plan-re-bootstrap.md` e execute as fases 1-5."

Ou, se quiser testar ANTES de mergear:

> "Implemente as fases 1+2 (helper + testes). Quero rodar os testes antes de tocar nos skill bodies."
