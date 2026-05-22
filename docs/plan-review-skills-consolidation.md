# Plan — Review Skills Consolidation (v2.0.0)

Sessão 2026-05-22. Reestrutura as 4 skills de review baseado na auditoria
feita nesta sessão. Net effect: **delete 2 skills** (review-plan-internal,
review-plan-vs-artifacts), **create 2 skills** (review-plan via merge +
review-code novo), **modify 1 skill** (review-plan-with-codex ganha
G-gates). Final count: 4 skills (mesma quantidade, surface diferente).
Bump major 1.8.1 → 2.0.0 pelas breaking renames.

Pre-requisito: este trabalho roda ANTES de
`docs/plan-skills-catalog-v0.2.md`. A v0.2 expande metadata; este plan
muda a superfície das skills. Ordem errada = rewriting catálogo duas
vezes.

## Decisões consolidadas (output da auditoria)

| Mudança | Decisão |
|---|---|
| `review-plan-internal` + `review-plan-vs-artifacts` | **DELETE** ambos |
| `review-plan` (novo, merge das duas acima) | **CREATE** com AskUserQuestion no Step 0 |
| `review-code` (Gap 1) | **CREATE** — same-model mirror de review-plan, mas SEM AskUserQuestion de cross-ref (código É o artefato) |
| `review-plan-with-codex` | **MANTER** + ganha G1+G2+G6 gates (hoje tem zero) |
| `review-code-with-codex` | **MANTER** sem mudança (já tem G1+G2+G3+G4+G7) |
| `package.json` version | **1.8.1 → 2.0.0** (breaking renames) |
| `CHANGELOG.md` | **CREATE** (não existe hoje) |

## Net effect na catalog

| Antes (4 skills) | Depois (4 skills) |
|---|---|
| review-plan-internal | review-plan (com AskUserQuestion) |
| review-plan-vs-artifacts | review-code (novo) |
| review-plan-with-codex | review-plan-with-codex (+ G-gates) |
| review-code-with-codex | review-code-with-codex (sem mudança) |

A simetria fica clara:

| | Same-model (default, grátis) | Cross-model (codex, pago) |
|---|---|---|
| **Plan** | `review-plan` | `review-plan-with-codex` |
| **Code** | `review-code` | `review-code-with-codex` |

## Fases (ordem obrigatória)

| # | Fase | Arquivos | Tempo |
|---|---|---|---|
| 0 | **Infra: adicionar `ASK_USER_QUESTION_TOOL` template var** | `src/render.js`, `CLAUDE.md`, `AGENTS.md`, `docs/kb/gemini-cli-compatibility.md`, `tests/render.test.js` | 30 min |
| 1 | Design + write `skills/en/core/review-plan.md` body (usa `{{ASK_USER_QUESTION_TOOL}}`, NÃO hardcode) | novo arquivo | 45 min |
| 2 | Design + write `skills/en/core/review-code.md` body (validação git ref tolerante a ranges) | novo arquivo | 30 min |
| 3 | Adicionar G1+G2+G6 gates em `skills/en/core/review-plan-with-codex.md` + corrigir `git rev-parse --verify` em `review-code-with-codex.md:25` | edits | 15 min |
| 3.5 | **Atualizar refs aos nomes antigos em outros skill bodies** | edits | 10 min |
| 4 | Atualizar `meta/skills.yaml` (delete 2, add 2, fix related/when_not_to_use) | edit existente | 15 min |
| 5 | Delete old skill body files | 2 files | 1 min |
| 6 | Atualizar `README.md` (skills table + per-skill sections — hand-written; será regenerado em catalog v0.2) | edit existente | 30 min |
| 7 | Atualizar `HelpView.tsx` (inline const — hand-written; será regenerado em catalog v0.2) | edit existente | 20 min |
| 8 | Bump version (`package.json` + regenerate `package-lock.json` via `npm install`) + criar `CHANGELOG.md` | edits | 15 min |
| 9 | Validation: `npm test`, `npm run validate-skills`, `npm run build:dashboard`, manual check do HelpView | scripts | 15 min |

**Total: ~3h30min** sequencial (subiu de 3h após codex review — Fase 0
+ 3.5 novas, Fase 3 e 8 mais trabalho).

---

## Fase 0 — Adicionar `ASK_USER_QUESTION_TOOL` template var

Codex review F-002 (critical): hardcodar `AskUserQuestion` no body viola o
contrato de abstração de tools documentado em `CLAUDE.md` ("NUNCA use
nomes de ferramentas fixos como Bash ou Read tool... Use as variáveis
globais"). Verificado nesta sessão: `src/render.js` define
`BASH_TOOL`, `READ_TOOL`, `WRITE_TOOL`, `REPLACE_TOOL`, `GREP_TOOL`,
`GLOB_TOOL`, `INVESTIGATOR_TOOL`, `ARG_VAR` — mas não `ASK_USER_QUESTION_TOOL`.

### 0.1 — Editar `src/render.js`

Verificado nesta sessão: `src/render.js` tem APENAS dois branches:
`isGemini` (line 35) vs ELSE (line 45). Todos os IDEs não-Gemini
(Claude Code, Cursor, Codex CLI, Opencode, GitHub Copilot, generic)
caem no ELSE. Apenas Claude Code tem o tool literal `AskUserQuestion`
(via SDK do Claude Code); os outros não.

**Solução: nova checagem específica para `claude-code` ANTES do ELSE
genérico.** Edit em `src/render.js` na seção que define template vars
(linhas 34-54). Adicionar:

```js
const isGemini = ideId === 'gemini' || ideId === 'gemini-commands';
const isClaudeCode = ideId === 'claude-code';
if (isGemini) {
  // ... existing Gemini assignments ...
  allVars.ASK_USER_QUESTION_TOOL = 'ask the user via a multiple-choice prompt (no native tool — render the question + options in plain text)';
} else {
  // ... existing Claude-Code-style assignments ...
  allVars.ASK_USER_QUESTION_TOOL = isClaudeCode
    ? 'AskUserQuestion tool'
    : 'ask the user via a multiple-choice prompt (no native tool — render the question + options in plain text)';
}
```

Por que essa branching:
- Gemini CLI: nenhum tool literal — agente deve produzir prompt em texto.
- Claude Code: tem `AskUserQuestion` no SDK — agente usa o tool.
- Cursor / Codex CLI / Opencode / GitHub Copilot / generic: nenhum tool
  nativo — comportamento idêntico a Gemini (texto plain).

Default conservador: quando em dúvida sobre o IDE, agir como "no tool" e
fazer texto. Falso negativo (não usar tool quando podia) é menos pior que
falso positivo (chamar tool inexistente).

### 0.2 — Documentar em `docs/kb/gemini-cli-compatibility.md`

Verificado nesta sessão: o arquivo existe. Adicionar entrada para
`{{ASK_USER_QUESTION_TOOL}}` na tabela de template vars (se a tabela já
existe). Se a tabela não existe ainda, criar uma sub-seção minimal
listando os 8 template vars existentes + o novo.

### 0.3 — Atualizar `CLAUDE.md`

Verificado nesta sessão: `CLAUDE.md:16` enumera os tool vars permitidos
hoje (`{{BASH_TOOL}}, {{READ_TOOL}}, {{WRITE_TOOL}}, {{REPLACE_TOOL}},
{{GREP_TOOL}}, {{GLOB_TOOL}}, {{INVESTIGATOR_TOOL}}`) e NÃO inclui
`{{ASK_USER_QUESTION_TOOL}}`. Sem este edit, instruções repo-level
ficam stale e agentes futuros tratam o novo var como inválido (codex
review F-004, rev2).

Editar `CLAUDE.md:16`. Append `{{ASK_USER_QUESTION_TOOL}}` ao final da
lista (mesma linha):

```diff
-   - `{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{WRITE_TOOL}}`, `{{REPLACE_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`, `{{INVESTIGATOR_TOOL}}`.
+   - `{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{WRITE_TOOL}}`, `{{REPLACE_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`, `{{INVESTIGATOR_TOOL}}`, `{{ASK_USER_QUESTION_TOOL}}`.
```

### 0.4 — Atualizar `AGENTS.md`

Verificado nesta sessão: `AGENTS.md:17` repete a mesma lista de tool
vars em inglês ("Cross-Agent Standards · Tool Abstraction"). Mesmo
edit que 0.3:

```diff
-- `{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{WRITE_TOOL}}`, `{{REPLACE_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`, `{{INVESTIGATOR_TOOL}}`.
+- `{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{WRITE_TOOL}}`, `{{REPLACE_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`, `{{INVESTIGATOR_TOOL}}`, `{{ASK_USER_QUESTION_TOOL}}`.
```

### 0.5 — Teste automatizado em `tests/render.test.js`

Verificado nesta sessão: `tests/render.test.js` existe. Adicionar
suite de testes que afirma `renderTemplate` resolve
`{{ASK_USER_QUESTION_TOOL}}` corretamente para cada branch da Fase 0.1.
Sem este teste, `npm test` passa mesmo quando uma das branches deixa
o var sem resolver — installed skill prompts vazam syntax literal pro
usuário. Verificado via codex review F-005 (rev3).

Estrutura mínima a adicionar (não copy-paste verbatim — adaptar ao
shape de `import`/test runner já em uso no arquivo):

```js
describe('ASK_USER_QUESTION_TOOL substitution', () => {
  const sample = 'Use {{ASK_USER_QUESTION_TOOL}} to ask the user.';

  test('claude-code → AskUserQuestion tool (native)', () => {
    const out = renderTemplate(sample, {}, {}, 'claude-code');
    expect(out).toBe('Use AskUserQuestion tool to ask the user.');
  });

  test('gemini → multiple-choice prompt string (no native tool)', () => {
    const out = renderTemplate(sample, {}, {}, 'gemini');
    expect(out).toContain('ask the user via a multiple-choice prompt');
    expect(out).not.toContain('{{ASK_USER_QUESTION_TOOL}}');
  });

  test('cursor → same descriptive string as Gemini (no native tool)', () => {
    const out = renderTemplate(sample, {}, {}, 'cursor');
    expect(out).toContain('ask the user via a multiple-choice prompt');
    expect(out).not.toContain('{{ASK_USER_QUESTION_TOOL}}');
  });

  test.each(['codex', 'opencode', 'github-copilot', 'generic'])(
    '%s → no-native-tool string (covers ELSE branch)',
    (ide) => {
      const out = renderTemplate(sample, {}, {}, ide);
      expect(out).not.toContain('{{ASK_USER_QUESTION_TOOL}}');
    },
  );
});
```

Adicionar à Definition of Done (Fase 0): "tests/render.test.js cobre
substituição de ASK_USER_QUESTION_TOOL para claude-code + gemini +
cursor + ao menos um IDE no ELSE branch (codex / opencode / github-copilot / generic)".

### 0.6 — Validação manual (post-Fase 1)

Skill bodies que usam `{{ASK_USER_QUESTION_TOOL}}` só existem após Fase 1.
Portanto a validação manual roda DEPOIS de Fase 1 estar completa:

- Renderizar `skills/en/core/review-plan.md` pra Claude Code:
  `{{ASK_USER_QUESTION_TOOL}}` → `AskUserQuestion tool`
- Renderizar pra Gemini: → `ask the user via a multiple-choice prompt...`
- Renderizar pra Cursor: → mesma string descritiva (sem tool nativo)

Comando útil (verificado nesta sessão: `src/render.js` exporta
`renderTemplate(content, vars, modules, ideId)` como ES module):

```bash
node -e "
import('./src/render.js').then(({renderTemplate}) => {
  const sample = 'Use {{ASK_USER_QUESTION_TOOL}} to ask the user.';
  for (const ide of ['claude-code', 'gemini', 'cursor']) {
    console.log('[' + ide + ']', renderTemplate(sample, {}, {}, ide));
  }
});
"
```

Saída esperada:
- `[claude-code] Use AskUserQuestion tool to ask the user.`
- `[gemini] Use ask the user via a multiple-choice prompt... to ask the user.`
- `[cursor] Use ask the user via a multiple-choice prompt... to ask the user.`

**Nota:** o snippet anterior usava `npx ... install --skip-modules
--dry-run`, mas `bin/cli.js:44-54` documenta `install` aceitando apenas
`[--yes] [--project] [--ide <ids>|detected] [--all-detected] [--lang
<code>]`. Os dois flags não existem. Verificado via codex review F-005
(rev2).

Em Fase 0 propriamente (antes de Fase 1), validação automatizada é
impossível porque ninguém usa o var ainda. Apenas conferir visualmente
que `src/render.js` parse-checa após o edit (`node --check src/render.js`).

---

## Fase 1 — `skills/en/core/review-plan.md` (novo body)

### 1.1 — Estrutura

Body novo combina o que `review-plan-internal` e `review-plan-vs-artifacts`
fazem hoje, com **modo cross-ref opcional**. Step 0 detecta + pergunta.

### 1.2 — Step 0: detecção + scope confirmation via template var

```markdown
## Step 0 — Detect and confirm scope

1. {{READ_TOOL}} the plan file at {{ARG_VAR}}.
2. Scan for sections matching `^##? (Source Documents|References|Artifacts|Inputs|Originated From)` (regex case-insensitive). Extract the file paths/links listed under each.
3. Use {{ASK_USER_QUESTION_TOOL}} to ask:

   **Question:** "How should this plan be reviewed?"

   **Options:**
   - **Internal only** — adversarial review of internal consistency (contradictions, deps, ordering, ambiguity, schema, file existence, test coverage). Cheap, fast. Use when the plan was written from scratch or you don't have source artifacts to cross-check.
   - **Cross-reference with detected artifacts** (only shown when step 2 found ≥1 artifact) — applies internal review PLUS coverage check against `<detected list>`. Add HARD-GATE: plan corrected, artifacts never edited.
   - **Cross-reference with custom artifact list** — user provides paths manually. Same checks as option 2.

4. Based on answer, set `mode` = `internal` | `cross-ref`.

5. On `cross-ref`: list artifacts to user for final confirmation. User can add/remove. Then proceed.
```

**Por que ask user no Step 0:** o skill antigo `review-plan-vs-artifacts`
inferia da seção "Source Documents" — frágil porque (a) nem todo plan tem
esse heading e (b) o usuário pode querer cross-ref contra arquivos NÃO
listados no plan. Pergunta explícita deixa a decisão auditável.

**Tool var:** `{{ASK_USER_QUESTION_TOOL}}` é definido em Fase 0 (vide
`src/render.js`). Em **Claude Code** = `AskUserQuestion tool` (native).
Em **Gemini / Cursor / Codex CLI / Opencode / GitHub Copilot / generic**
= string descritiva "ask the user via a multiple-choice prompt..." (sem
tool nativo — agente faz texto plain).

### 1.3 — Checklist (condicional)

Sempre rodar os 7 checks internos (`review-plan-internal` body line 25-31):

1. **Contradictions:** does one task say X while another says Y?
2. **Broken dependencies:** does a task reference a file/model that no task creates?
3. **Ordering:** does any task depend on something not yet done?
4. **Ambiguity:** is any task too vague to implement without guessing?
5. **Schema:** are migrations within the plan consistent with each other?
6. **File lists:** do listed files/commands/scripts actually exist? Run {{GLOB_TOOL}} or {{GREP_TOOL}} to confirm.
7. **Test coverage:** tasks with new code but no mention of tests?

Quando `mode == cross-ref`: ADICIONAR os 6 checks externos
(`review-plan-vs-artifacts` body line 31-36):

8. **Coverage:** does every FR, NFR, and Story from the artifacts have a task in the plan?
9. **Acceptance criteria:** are tasks oversummarized vs the epics' ACs?
10. **Phase gates:** does each gate criterion from the PRD have a concrete step in the plan?
11. **Dependencies:** does the plan's phase graph match the epics' graph?
12. **Schema/API:** do migrations and endpoints match the architecture doc?
13. **UX:** do components, states, tokens, and responsive match the UX spec?

E ativar o HARD-GATE:

```markdown
<HARD-GATE>
This skill corrects the PLAN, NEVER the source artifacts.
If you find an error in the artifact: record it as "artifact divergence"
and ask the user how to resolve it. DO NOT edit artifacts.
</HARD-GATE>
```

### 1.4 — Iron Law

```markdown
## Iron Law

NO APPROVAL WITHOUT EVIDENCE.
Each checklist item marked as "ok" MUST have line numbers as proof.
When cross-ref mode is active: line numbers from BOTH plan AND artifact.
```

Combina os Iron Laws atuais (`NO APPROVAL WITHOUT EVIDENCE` do internal +
`NO APPROVAL WITHOUT CROSS-REFERENCE` do vs-artifacts — o segundo vira
parametrização do primeiro).

### 1.5 — Loop, mindset, red flags

Reaproveitar literalmente as seções `## Mindset`, `## Process / VERIFICATION
LOOP`, `## Red Flags`, `## Rationalization` de `review-plan-internal.md`
(line 10-100). Adicionar 2 itens nos red flags vindos de
`review-plan-vs-artifacts`:

```markdown
- "I'll edit the artifact to make it consistent with the plan" (cross-ref mode only)
- "This artifact isn't relevant" (cross-ref mode only)
```

### 1.6 — Code-quality gates

Manter G1+G2+G6 (já existente em `review-plan-internal.md` line 58-78).

### 1.7 — Closing format

Adaptar pra ambos os modos:

```markdown
### Analysis Summary

**Mode:** internal | cross-ref
**Artifacts analyzed:** [list, only on cross-ref mode]
**Iterations performed:** [N]
**{{READ_TOOL}} calls executed:** [N] (plan: X, artifacts: Y)
**Total findings:** [N] (critical: X, significant: Y, minor: Z)

| # | Finding | Plan:line | Artifact:line | Correction | Severity |
|---|---------|-----------|---------------|------------|----------|
| 1 | [summary] | plan.md:108 | prd.md:42 (or —) | [fix] | critical |

**Alignment notes added:** [N, on cross-ref mode]
**Final status:** [Plan approved / Plan with caveats / Escalated to user]
```

---

## Fase 2 — `skills/en/core/review-code.md` (novo body)

### 2.1 — Estrutura

Mirror estrutural de `review-plan.md` adaptado pra git ref. **SEM AskUserQuestion
de cross-ref** — código é o próprio artefato, cross-ref contra PRD raramente
ajuda. Quem quer essa lente especial usa `review-code-with-codex` que tem
o Codex envelope de qualquer jeito.

### 2.2 — Step 0: validar input

```markdown
## Step 0 — Validate input

1. {{ARG_VAR}} must be a git ref (branch, single commit, or commit range like `main..HEAD` / `main...HEAD`).
2. **Detect ref shape (test in order, triple-dot FIRST):**
   - If {{ARG_VAR}} contains `...` (triple-dot): RANGE; separator = `...`.
   - Else if {{ARG_VAR}} contains `..` (double-dot): RANGE; separator = `..`.
   - Else: SINGLE ref.
3. **Validate:**
   - SINGLE: {{BASH_TOOL}}: `git rev-parse --verify {{ARG_VAR}}` exits 0.
   - RANGE: split on the detected separator (do NOT split on `..` when separator was `...` — would yield wrong tokens like `['main', '.HEAD']`). Validate each non-empty endpoint with `git rev-parse --verify <endpoint>`. Empty endpoint (e.g. `..HEAD`) is shorthand for `HEAD` — valid.
3.5. **For SINGLE, distinguish COMMIT vs BRANCH (deterministic):**
   - If `git show-ref --verify --quiet refs/heads/{{ARG_VAR}}` exits 0 → SINGLE BRANCH (it is a local branch name).
   - Else if `git show-ref --verify --quiet refs/remotes/{{ARG_VAR}}` exits 0 → SINGLE BRANCH (treat remote-tracking branch as branch input).
   - Else if `git cat-file -t {{ARG_VAR}}` outputs `commit` → SINGLE COMMIT.
   - Else if `git cat-file -t {{ARG_VAR}}` outputs `tag` → resolve via `git rev-parse {{ARG_VAR}}^{commit}` and treat as SINGLE COMMIT.
   - Else abort: "Cannot classify `{{ARG_VAR}}` as branch or commit; refusing to guess."
   - **Ambiguity rule:** if `{{ARG_VAR}}` matches BOTH a local branch and a commit SHA (rare — a branch literally named like a hex SHA), prefer BRANCH and warn the user. Document this in the ask-the-user-for-base prompt of step 4.
4. **Pick the right diff command per shape (`git diff <ref>` is NOT uniform):**
   - SINGLE COMMIT: `git show --format= --patch {{ARG_VAR}}` (equivalent: `git diff {{ARG_VAR}}^!`) — patch of THAT commit alone.
   - SINGLE BRANCH: ask the user for an explicit base ref (default suggestion: `main` or the repo's configured default branch). Run `git diff $(git merge-base <base> {{ARG_VAR}})..{{ARG_VAR}}` — changes the branch introduces vs the chosen base. DO NOT use `HEAD` as one side: when the user is currently checked out on the branch they want reviewed (`HEAD` resolves to the branch tip), `merge-base <branch> HEAD == <branch>` and the diff is empty. If `git merge-base` returns nothing for the chosen base (disjoint history), abort and re-ask.
   - RANGE: `git diff {{ARG_VAR}}` — already correct.
   - NEVER use `git diff <single-ref>` raw: it diffs the WORKTREE against the ref, leaking unrelated local edits into the review.
5. {{BASH_TOOL}}: `git diff --name-only` using the same shape-specific command as step 4 → list modified files. If empty: abort with "No changes in ref".
6. {{BASH_TOOL}}: pipe the shape-specific diff to `wc -c`. If > 50000 bytes: warn user (large diff, cost). Ask: continue / abort.
```

**Por que detectar triple-dot ANTES:** se você testar `..` primeiro e usar
ele como split separator, o input `'main...HEAD'.split('..')` retorna
`['main', '.HEAD']` (com ponto-restante). Ordem de teste importa.

**Por que validação condicional do verify:** `git rev-parse --verify`
rejeita revision-range syntax — passar `main..HEAD` falha mesmo quando
ambos endpoints existem. Verificado nesta sessão via codex review F-003.

**Por que diff command condicional ao shape:** `git diff <commit>` mostra
worktree-vs-commit, não o patch do commit. `git diff <branch>` mostra
worktree-vs-branch-tip, não os commits da branch. Apenas `git diff <range>`
funciona como esperado. Verificado nesta sessão via codex review F-002 (rev2).

**Por que classificar commit vs branch deterministicamente:** sem o
passo 3.5, "SINGLE ref" engloba ambos e dois implementadores podem
gerar comportamentos incompatíveis (one-commit review vs branch
review) pro mesmo input. `git show-ref --verify` é a probe canônica
pra branch existence; `git cat-file -t` resolve commit vs tag. Em
caso de colisão hex-vs-branch-name, "prefer branch + warn" é a
política menos surprising — um usuário que digita um nome legível
quase certamente quer a branch. Verificado nesta sessão via codex
review F-002 (rev3).

### 2.3 — Gather artifacts

```markdown
## Step 1 — Gather artifacts

- {{BASH_TOOL}}: gather the DIFF using the shape-specific command chosen in Step 0 (NOT raw `git diff {{ARG_VAR}}` — see Step 0.4).
- For each modified file: {{READ_TOOL}} full content
- For each modified PUBLIC symbol (exported function, exported class): {{GREP_TOOL}} recursive for callers (limit 5 per symbol)
```

### 2.4 — Iron Law

```markdown
## Iron Law

NO APPROVAL WITHOUT EVIDENCE.
Each finding MUST cite file:line. Bug claims without file:line = rejected.
```

### 2.5 — Checklist (7 itens adaptados pra código)

1. **Logic bugs:** off-by-one, null/undefined, type confusion, unreachable branches
2. **Race conditions:** shared state, async ordering, missing locks
3. **Error handling:** silently swallowed failures, generic catches without rethrow
4. **Schema/migrations:** new migrations consistent with each other + reversible
5. **API contracts:** public signatures changed without doc/callers updated
6. **File/function references:** does each `import` / `require` resolve? (run {{GREP_TOOL}})
7. **Test coverage:** new code paths without tests?

### 2.6 — Verification loop, gates, red flags

Mirror de `review-plan.md`. Loop até 3 iterações. G-gates: **G1+G2+G3+G4+G7**
(superset — código merece os 5 gates).

### 2.7 — Closing format

```markdown
### Analysis Summary

**Ref:** {{ARG_VAR}}
**Files reviewed:** [N]
**Iterations performed:** [N]
**Total findings:** [N] (critical: X, significant: Y, minor: Z)

| # | Finding | File:line | Correction | Severity |
|---|---------|-----------|------------|----------|
| 1 | [summary] | src/foo.ts:42 | [fix] | critical |

**Final status:** [Code approved / Code with caveats / Escalated to user]
**Suggestion:** run `npm test` if fixes were applied.
```

---

## Fase 3 — Adicionar G1+G2+G6 em `review-plan-with-codex.md`

Body atual (line 1-145) NÃO menciona `docs/kb/code-quality-gates.md`.
Aplicar a mesma seção que `review-plan-internal.md` linha 58-78 já tem,
adaptada pro contexto Codex:

```markdown
## Code-quality gates (audit lens)

You orchestrate Codex on a plan. Beyond Codex's adversarial review, audit
the plan you're sending against `docs/kb/code-quality-gates.md`:

- **G1 read-before-claim** — does the plan reference existing code? Each
  reference should cite line numbers, not just a filename. Plan claims
  "the matcher joins on tenant_id" without showing the JOIN clause = G1
  finding to surface.
- **G2 soft-language ban** — grep the plan for `should|probably|may|typically|usually`.
  Each occurrence that is NOT marked `unverified:` is a G2 finding.
- **G6 reference-or-strike** — every assertion in the plan body should
  carry `verified_by:` or `unverified:`. Bare assertions = G6 findings.

If you find any G1/G2/G6 violations BEFORE sending to Codex, add them to
the briefing as "constraints" so Codex can corroborate. After Codex
responds, cross-check that Codex caught the same issues.

Self-review block at end (same format as `review-plan` body):

\`\`\`
- G1 read-before-claim: found N (lines …) / 0
- G2 soft-language: found M (lines …) / 0
- G6 reference-or-strike: K total, J verified, L unverified, R bare (lines …)
\`\`\`
```

Inserir entre `## Severity → Action` (line 110-113) e `## Red Flags`
(line 115).

`review-code-with-codex.md` ganha **uma** correção pontual: o
`git rev-parse --verify <ref>` na linha 25 sofre do mesmo bug F-003.
Substituir por mesma lógica condicional documentada em Fase 2.2 (detect
range via `..` ou `...`, validar endpoints separadamente).

`review-code-with-codex.md` NÃO ganha G-gates novos (já tem
G1+G2+G3+G4+G7 em line 82-104).

---

## Fase 3.5 — Atualizar refs aos nomes antigos em outros skill bodies

Codex review F-005 (major): outros bodies do `skills/en/core/` invocam
`atomic-skills:review-plan-internal` como passo obrigatório. Pós-merge,
esses calls apontam pra comando deletado. Verificado nesta sessão via
`grep -rn 'review-plan-internal' skills/`:

| Arquivo | Linha | Conteúdo atual |
|---|---|---|
| `skills/en/core/project-status.md` | 639 | "run `atomic-skills:review-plan-internal` against the updated plan" |
| `skills/en/core/project-plan.md` | 110 | "Invoke `atomic-skills:review-plan-internal` with arg = the plan file path" |
| `skills/en/core/project-plan.md` | 116 | "Re-run review-plan-internal until it returns zero findings of severity major or higher" |

### 3.5.1 — Updates concretos

- `project-status.md:639`: trocar `atomic-skills:review-plan-internal` por
  `atomic-skills:review-plan`. Contexto operacional não muda — o new
  `review-plan` cobre o caso `mode=internal` automaticamente.
- `project-plan.md:110`: mesmo replacement.
- `project-plan.md:116`: trocar `review-plan-internal` por `review-plan`.

### 3.5.2 — Grep wide pra catch any miss

Antes de avançar pra Fase 4, rodar:

```bash
grep -rn 'review-plan-internal\|review-plan-vs-artifacts' skills/ src/
```

Esperar zero matches além dos próprios arquivos a deletar
(`skills/en/core/review-plan-internal.md` + `review-plan-vs-artifacts.md`).
Se houver outras matches, atualizar.

---

## Fase 4 — Atualizar `meta/skills.yaml`

**Ordem obrigatória dentro da Fase 4:** 4.2 (ADD) → 4.3 (UPDATE cross-refs)
→ 4.1 (DELETE). Em qualquer outra ordem, se `npm run validate-skills`
rodar entre os passos, o validator falha com refs danglando. Idealmente,
aplicar os 3 sub-passos em um único `Edit` (exact-string match) na yaml
pra atomicidade.

### 4.1 — Delete entries (rodar POR ÚLTIMO dentro da Fase 4)

```yaml
# REMOVE: core.review-plan-internal (lines 56-81)
# REMOVE: core.review-plan-vs-artifacts (lines 83-107)
```

### 4.2 — Add entries (rodar PRIMEIRO dentro da Fase 4)

Inserir 2 entries novas, no formato v0.1 atual (catalog v0.2 vem depois).

**Onde inserir:** sob a chave root `core:` JÁ EXISTENTE em `meta/skills.yaml`
(linha 1), na mesma indentação dos outros itens core (2 espaços). NÃO
recriar a chave `core:` — o snippet abaixo começa direto em `review-plan:`
exatamente por esse motivo. Pasting-verbatim com `core:` por cima cria
`core.core.review-plan`, e `npm run validate-skills` falha. Verificado nesta
sessão via codex review F-003 (rev2).

```yaml
  review-plan:
    name: review-plan
    title: 'Review Plan — Same-Model Adversarial'
    description: 'Adversarial self-loop review of an implementation plan. Step 0 asks whether to cross-reference against external artifacts (PRD, specs, designs); answer determines checklist scope.'
    purpose: >
      Read a plan adversarially looking for contradictions, broken
      dependencies, ordering errors, ambiguities, and missing tests.
      Optionally cross-references against source artifacts when present.
      Iterates up to 3 passes until clean.
    when_to_use:
      - 'You finished writing a plan'
      - 'Structural sanity check before execution'
      - 'Plan was derived from a PRD/spec and you want coverage verification'
    when_not_to_use:
      - 'Plan is still brainstorming (not structured yet)'
      - 'You want a cross-model review (use review-plan-with-codex)'
    examples:
      - command: '/atomic-skills:review-plan docs/plans/migration.md'
        description: 'Adversarially review a plan, with optional artifact cross-ref'
    related: [review-plan-with-codex, review-code]
    tags: [review, planning, adversarial]
    ide_compatibility: [claude-code, gemini, cursor]
    requires_args: true
    mutates_repo: true
    network_required: false
    schema_version: '0.1'

  review-code:
    name: review-code
    title: 'Review Code — Same-Model Adversarial'
    description: 'Adversarial self-loop review of code changes given a git ref (branch, commit, or range). Same-model checklist for bugs, race conditions, error handling, and test coverage. Free alternative to review-code-with-codex.'
    purpose: >
      Review a git ref (branch, commit, or range) adversarially looking
      for logic bugs, race conditions, error handling gaps,
      schema/migration inconsistencies, and test coverage gaps. Self-loop
      up to 3 iterations. Free alternative to review-code-with-codex.
    when_to_use:
      - 'You finished a coherent code change'
      - 'Cheap pre-merge sanity check'
      - 'Codex CLI not installed or you don''t want to spend on it'
    when_not_to_use:
      - 'Critical change (auth, payments, data integrity) — use review-code-with-codex'
      - 'No git ref to review (and you don''t want to commit/stash first)'
    examples:
      - command: '/atomic-skills:review-code main..HEAD'
        description: 'Review the current branch vs main'
      - command: '/atomic-skills:review-code feat/new-feature'
        description: 'Review a specific branch'
    related: [review-code-with-codex, review-plan, fix, hunt]
    tags: [review, code, adversarial]
    ide_compatibility: [claude-code, gemini, cursor]
    requires_args: true
    mutates_repo: false
    network_required: false
    schema_version: '0.1'
```

### 4.3 — Atualizar todas refs aos nomes antigos no yaml

Verificado nesta sessão (grep `review-plan-internal|review-plan-vs-artifacts` em `meta/skills.yaml`):

**`related:` updates:**

- `fix.related` (line ~22): trocar `[hunt, review-code-with-codex]` por
  `[hunt, review-code, review-code-with-codex]`.
- `hunt.related` (line ~223): trocar `[fix, review-code-with-codex]` por
  `[fix, review-code, review-code-with-codex]`.
- `project-plan.related` (line 166): trocar
  `[project-status, review-plan-internal]` por
  `[project-status, review-plan]`.
- `review-plan-with-codex.related` (line 299): trocar
  `[review-plan-internal, review-plan-vs-artifacts, review-code-with-codex]`
  por `[review-plan, review-code-with-codex]`.
- `review-code-with-codex.related` (line ~326): trocar
  `[review-plan-with-codex, fix, hunt]` por
  `[review-code, review-plan-with-codex, fix, hunt]`.

**`when_not_to_use:` strings que mencionam nomes antigos:**

- `review-plan-with-codex.when_not_to_use` (line 295): trocar
  `'You only need internal review (use review-plan-internal)'` por
  `'You only need same-model review without codex (use review-plan)'`.

Validar com `npm run validate-skills` — cross-refs precisam apontar pra
skills existentes.

---

## Fase 5 — Delete old skill body files

```bash
rm skills/en/core/review-plan-internal.md
rm skills/en/core/review-plan-vs-artifacts.md
```

(via {{BASH_TOOL}} no momento da execução.)

---

## Fase 6 — Atualizar `README.md`

Verificado nesta sessão: README.md é hand-written. O catalog v0.2 (próxima
iniciativa) vai gerar isso automaticamente. **Por ora, manter
hand-written.**

Mudanças:

### 6.1 — Tabela "Overview" (linha 69-82)

Trocar as 2 linhas de internal/vs-artifacts por 2 linhas: uma de
`review-plan` + uma de `review-code` (mantém conta da tabela em ~12 skills):

```diff
- | 🔍 | [`review-plan-internal`](#...) | Find contradictions, broken deps, and gaps in a plan | `NO APPROVAL WITHOUT EVIDENCE` |
- | 📋 | [`review-plan-vs-artifacts`](#...) | Cross-reference plan against PRD/specs for missing requirements | `NO APPROVAL WITHOUT CROSS-REFERENCE` |
+ | 🔍 | [`review-plan`](#atomic-skillsreview-plan--same-model-adversarial-plan-review) | Adversarial self-loop review of a plan; optional cross-ref against PRD/specs | `NO APPROVAL WITHOUT EVIDENCE` |
+ | 🔬 | [`review-code`](#atomic-skillsreview-code--same-model-adversarial-code-review-new-in-200) | Adversarial self-loop review of a git ref/diff; same-model checklist for bugs and coverage | `NO APPROVAL WITHOUT EVIDENCE` |
```

### 6.2 — Seções detalhadas

Verificado nesta sessão (grep `^### \`?atomic-skills:review-plan` no README): a
seção `review-plan-internal` começa em **linha 188**; a seção
`review-plan-vs-artifacts` começa em **linha 206**; a seção
`review-plan-with-codex` começa em **linha 224**.

Portanto:
- DELETE `### atomic-skills:review-plan-internal — Adversarial Plan Review` (linha **188-205**)
- DELETE `### atomic-skills:review-plan-vs-artifacts — Plan vs. Artifacts` (linha **206-223**)
- INSERT `### atomic-skills:review-plan — Same-Model Adversarial Plan Review` (no espaço deixado)
- INSERT `### atomic-skills:review-code — Same-Model Adversarial Code Review (new in 2.0.0)` (depois)

**Ordem segura de execução de 6.2:** primeiro CAPTURE o conteúdo das 2
seções antigas (linhas 188-223) pra referência (ou consulte git history
depois). Depois INSERT as 2 novas seções. Depois DELETE as antigas.
Inserir-antes-deletar evita risco de perda de conteúdo de referência se
algo der errado. **Prefira Edit tool com exact-string matching ao invés
de line-number-based ranges** — line numbers shiftam após cada edit.

Conteúdo das novas seções: derivar do body novo (Fases 1 + 2). Aproximadamente
mirror do que `review-plan-internal` e `review-code-with-codex` têm hoje no
README, mas com a parametrização do AskUserQuestion documentada.

### 6.3 — Observação no topo da seção Skills

Adicionar nota sobre breaking change:

```markdown
> **Note (v2.0.0):** `review-plan-internal` and `review-plan-vs-artifacts`
> were merged into a single `review-plan` skill with an optional
> cross-reference mode. See [CHANGELOG.md](CHANGELOG.md) for migration.
```

---

## Fase 7 — Atualizar `HelpView.tsx`

`src/dashboard/components/help/HelpView.tsx` tem const `SKILLS` hardcoded
(linha 20-142). O catalog v0.2 vai gerar isso. **Por ora, edit manual.**

### 7.1 — Remover entry `review-plan-internal`

Verificado nesta sessão: HelpView.tsx contém APENAS UMA entry pra deletar
— `review-plan-internal` em linha 74 (corpo ocupa ~lines 73-81). A skill
`review-plan-vs-artifacts` NÃO tem entry em HelpView.tsx hoje
(inconsistência pré-existente entre catalog e HelpView; out of scope
corrigir aqui, mas anotar).

NÃO confundir com linha 83 que é `review-plan-with-codex` (KEEP).

### 7.2 — Adicionar entries `review-plan` e `review-code`

Seguir o shape existente (id, title, summary, active, when, whenNot,
examples, related). Note que `review-plan` é novo TAMBÉM no HelpView
(o anterior `review-plan-vs-artifacts` nunca esteve aqui), então o
ganho de UX é positivo — o dashboard passa a documentar uma skill que
não documentava antes.

### 7.3 — Atualizar `related` em outras entries que apontem pros nomes antigos

Verificado nesta sessão (grep `related:` em HelpView.tsx):

- `project-status.related` (linha 42): `['project-plan', 'fix', 'review-plan-internal']` → trocar `review-plan-internal` por `review-plan`.
- `review-plan-internal.related` (linha 80): será deletado junto com a entry.
- `review-plan-with-codex.related` (linha 90): `['review-plan-internal', 'review-code-with-codex']` → trocar `review-plan-internal` por `review-plan`.
- `fix.related` (linha 62): `['hunt']` — não referencia, OK.
- `hunt.related` (linha 71): `['fix']` — OK.
- `review-code-with-codex.related` (linha 100): `['review-plan-with-codex']` — OK. Mas considerar adicionar `review-code` à lista pra simetria.

---

## Fase 8 — Bump version + criar `CHANGELOG.md`

### 8.1 — `package.json` + `package-lock.json`

```diff
# package.json
- "version": "1.8.1",
+ "version": "2.0.0",
```

Codex review F-004 (major): `package-lock.json` também tem `version`
fields que precisam bump. Verificado nesta sessão: linhas 3 (root) e 9
(`packages[""]`) contêm `"version": "1.8.1"`.

**Approach recomendado:** rodar `npm install --package-lock-only` (ou
simplesmente `npm install`) APÓS editar `package.json:version`. Isso
regenera `package-lock.json` consistentemente, sem edit manual.

Validação após o bump:
```bash
grep '"version"' package.json package-lock.json | head -3
# Esperado: ambos os arquivos mostram 2.0.0 no root + packages[""]
```

### 8.2 — Criar `CHANGELOG.md`

Novo arquivo. Formato baseado em Keep a Changelog.

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-05-22

### Breaking changes

- **Removed `review-plan-internal`** — merged into `review-plan` (new). The new
  skill auto-detects whether to run an internal review or a cross-reference
  review based on a Step 0 confirmation. Migration: replace
  `/atomic-skills:review-plan-internal <path>` with `/atomic-skills:review-plan <path>`;
  when prompted, choose "Internal only".
- **Removed `review-plan-vs-artifacts`** — merged into `review-plan` (new).
  Migration: replace `/atomic-skills:review-plan-vs-artifacts <path>` with
  `/atomic-skills:review-plan <path>`; when prompted, choose
  "Cross-reference with detected artifacts" (or supply a custom list).

### Added

- **`review-plan`** — merged same-model plan review (internal + optional
  cross-reference) with AskUserQuestion at Step 0.
- **`review-code`** — same-model adversarial review of a git ref/diff.
  Free alternative to `review-code-with-codex` for cheap pre-merge
  sanity checks.
- **G1+G2+G6 code-quality gates** added to `review-plan-with-codex`
  (previously had none).

### Notes

- All catalog metadata uses `schema_version: '0.1'` still — the v0.2
  expansion (one_liner, emoji, subcommands, etc.) ships in a
  follow-up release. See `docs/plan-skills-catalog-v0.2.md`.
```

---

## Fase 9 — Validation

```bash
npm test                       # 375 tests still pass (no test depends on the deleted skills)
npm run validate-skills        # 12 skills valid → 12 skills valid (delete 2, add 2, net 0)
npm run build:dashboard        # HelpView changes compile
```

Manual:
- Abrir HelpView no browser, confirmar que `review-plan` e `review-code` aparecem.
- Confirmar que `review-plan-internal` e `review-plan-vs-artifacts` NÃO aparecem.
- Click em `review-plan` → detail panel mostra summary atualizado.

---

## Design — AskUserQuestion no Step 0 do `review-plan`

Esta é a parte mais delicada — a decisão entre internal e cross-ref
acontece aqui. **Esse pseudocódigo abaixo é spec DESIGN-TIME (referência
pro implementador da Fase 1)**; o skill body em si vai expressar a mesma
lógica em linguagem natural ("Use the AskUserQuestion tool to ask: ...
Based on the answer, run checklist X or X+Y"). Skills em atomic-skills
são prompts naturais, não código executável.

```js
// Pseudocode of the Step 0 flow (DESIGN spec, NOT skill body content)
const planContent = readFile(args.path);
const detectedArtifacts = extractSourceArtifacts(planContent);
// extractSourceArtifacts: scan for ^##? (Source Documents|References|Artifacts|Inputs|Originated From)
// regex case-insensitive; extract bullet/link list under each heading

const options = [
  {
    label: "Internal only",
    description: "Adversarial review of internal consistency. Use when " +
      "the plan was written from scratch or has no source artifacts to " +
      "cross-check.",
  },
];

if (detectedArtifacts.length > 0) {
  options.push({
    label: "Cross-reference with detected artifacts",
    description: `Detected: ${detectedArtifacts.join(', ')}. Includes ` +
      "internal checks PLUS coverage check against these. HARD-GATE " +
      "applies: plan corrected, artifacts never edited.",
  });
}

options.push({
  label: "Cross-reference with custom artifact list",
  description: "You provide paths. Same checks as detected mode.",
});

const answer = await AskUserQuestion({
  question: "How should this plan be reviewed?",
  options,
});

if (answer === "Cross-reference with detected artifacts") {
  artifactPaths = detectedArtifacts;
} else if (answer === "Cross-reference with custom artifact list") {
  // Prompt user for paths via follow-up question or free-text
  artifactPaths = await promptUserForPaths();
} else {
  artifactPaths = [];
}

mode = artifactPaths.length > 0 ? 'cross-ref' : 'internal';
```

A "follow-up question" pra custom list: AskUserQuestion não suporta
free-text bem. Alternativa: o skill body INSTRUI o agente a coletar paths
em uma conversa subsequente, validar com `ls` antes de avançar.

---

## Definition of done

### Por fase

- [ ] **Fase 0:** `src/render.js` define `ASK_USER_QUESTION_TOOL` template var (Claude/Gemini branches); `CLAUDE.md:16` e `AGENTS.md:17` listam `{{ASK_USER_QUESTION_TOOL}}` junto com os outros 7 tool vars; `docs/kb/gemini-cli-compatibility.md` tem entrada para o novo var; `tests/render.test.js` cobre substituição de `ASK_USER_QUESTION_TOOL` para `claude-code` + `gemini` + `cursor` + ao menos um IDE no ELSE branch
- [ ] **Fase 1:** `skills/en/core/review-plan.md` existe, contém Step 0 usando `{{ASK_USER_QUESTION_TOOL}}` (não hardcode), 7 internal checks + 6 cross-ref condicionais, Iron Law unificado, G1+G2+G6 gates, closing format adaptado a ambos os modos
- [ ] **Fase 2:** `skills/en/core/review-code.md` existe, contém Step 0 com validação git ref **tolerante a ranges** (detecta `..`/`...`, valida endpoints), 7 code-specific checks, Iron Law, G1+G2+G3+G4+G7 gates, closing format
- [ ] **Fase 3:** `skills/en/core/review-plan-with-codex.md` ganha seção `## Code-quality gates` com G1+G2+G6 + self-review block; `review-code-with-codex.md:25` corrigido pra range-aware validation
- [ ] **Fase 3.5:** refs a `review-plan-internal` em `project-status.md:639` e `project-plan.md:110,116` atualizadas pra `review-plan`. Grep wide confirma zero refs antigas em `skills/` + `src/`.
- [ ] **Fase 4:** `meta/skills.yaml` tem entries `review-plan` e `review-code`, NÃO tem `review-plan-internal` ou `review-plan-vs-artifacts`, `related` refs cross-validadas, `when_not_to_use` strings atualizadas
- [ ] **Fase 5:** `skills/en/core/review-plan-internal.md` e `review-plan-vs-artifacts.md` deletados
- [ ] **Fase 6:** README.md tabela + seções detalhadas atualizadas; nota de breaking change no topo da seção Skills
- [ ] **Fase 7:** HelpView.tsx const `SKILLS` atualizado; `related` refs cross-validadas
- [ ] **Fase 8:** `package.json:version == "2.0.0"`; `package-lock.json` regenerado com mesma versão; `CHANGELOG.md` criado com release notes do 2.0.0
- [ ] **Fase 9:** `npm test` verde (375 tests); `npm run validate-skills` verde (12 skills — delete 2, add 2, net 0 vs hoje); `npm run build:dashboard` sem erros; HelpView no browser mostra os 2 novos e não mostra os 2 deletados

### Cross-cutting

- [ ] Nenhuma **invocação** dos nomes antigos (e.g. `atomic-skills:review-plan-internal <arg>`, `related: [...review-plan-vs-artifacts...]`, `id: 'review-plan-internal'`) sobrou em: `skills/`, `meta/`, `src/`, `tests/`. Em `README.md` e `CHANGELOG.md`, as únicas menções permitidas são na seção de breaking changes/migration (texto narrativo descrevendo o rename); qualquer comando, link de âncora, ou ref de catálogo que ainda use os nomes antigos NESSES dois arquivos = falha. `.atomic-skills/reviews/INDEX.md` não deve referenciar os nomes antigos em rows novas (reviews antigas em `.atomic-skills/reviews/*.md` ficam intocadas — histórico imutável). **README.pt-BR.md** está fora do escopo (vide Não-mudanças deliberadas) — fica defasado intencionalmente.
- [ ] Validador `scripts/validate-skills.js` aceita catalog atualizado sem mudança (esse plan não muda schema)

---

## Não-mudanças deliberadas

- **Não muda `schema_version` no validator.** Continua em `'0.1'`. A
  expansão v0.2 (one_liner, emoji, subcommands, etc.) é a próxima
  iniciativa (`docs/plan-skills-catalog-v0.2.md`). Esse plan só
  reestrutura SURFACE das skills, não METADATA shape.
- **Não toca `src/install.js` nem `src/detect.js`.** Esses consomem
  `name`/`description`/`modules` da yaml — adicionar/remover entries
  não quebra esses scripts.
- **Toca `src/render.js` na Fase 0** — adiciona o template var
  `ASK_USER_QUESTION_TOOL` (necessário por codex review F-002). Toda a
  lógica existente de substituição fica intacta; mudança é puramente
  aditiva.
- **Não toca `README.pt-BR.md`.** Consistente com decisão EN-only de
  2026-05-22 (memória `decisao-skills-en-only`). README PT vai
  divergindo até decisão futura de deletar.
- **Não normaliza `## Iron Law` em outros bodies** (fix, hunt, save-and-push,
  init-memory etc.). Esse trabalho fica pra Fase C do catalog v0.2 plan
  — não há gate dependendo de Iron Law presence nesse spec.
- **Não cria alias deprecado.** User escolheu hard break com bump 2.0.0
  + CHANGELOG. Quem upgrades lê o changelog.
- **Não muda Codex envelope flow.** Os 2 skills cross-model (`-with-codex`)
  ficam idênticos a hoje exceto pelos G-gates adicionados em
  `review-plan-with-codex`.

---

## Riscos / armadilhas

1. **AskUserQuestion design no Step 0 pode ficar prolixo** — se a
   detecção de "Source Documents" é frágil, o usuário tem que digitar
   paths à mão toda vez. Mitigação: usar regex permissivo (5+ headings
   candidatos: Source Documents, References, Artifacts, Inputs,
   Originated From, Based On). Falhar GRACEFULLY pra opção "Internal
   only" quando nada detectado.
2. **HelpView.tsx hand-edit em Fase 7 pode introduzir drift** vs catalog.
   Mitigação: catalog v0.2 (próxima iniciativa) tem `scripts/generate-helpview-data.js`
   que regenera. Aceitar drift temporária por 1 iniciativa.
3. **CHANGELOG.md formato — primeiro arquivo do projeto.** Não há
   convenção estabelecida. Mitigação: usar Keep a Changelog (padrão
   amplamente adotado). Documentar em CLAUDE.md ou KB depois.
4. **Bump 2.0.0 sinaliza mais do que renomes** — usuários podem assumir
   reescrita ampla. Mitigação: CHANGELOG seção "Breaking changes" lista
   exatamente os 2 renames + 1 addition. Tom factual, sem hype.
5. **Quem upgrade automático (renovate/dependabot) pode quebrar.**
   Scripts/CI que invocam `/atomic-skills:review-plan-internal` quebram.
   Mitigação: bump major é a sinalização correta — semver protege quem
   pinned em `^1.x`.
6. **`review-code` pode parecer redundante com `hunt`/`fix`.** Mitigação:
   when_not_to_use deixa claro — fix é pra bug conhecido com TDD; hunt
   é pra escrever testes adversariais; review-code é pra revisar um
   diff/branch como tarefa de review pré-merge. Domínios distintos.

---

## Como invocar a próxima sessão

> "Leia `docs/plan-review-skills-consolidation.md` e execute as fases 0-9."

Pra rodar em duas sessões (mais seguro):

> Sessão 1: "Execute fases 0-3 do plan-review-skills-consolidation.md (infra + bodies novos)"
> Sessão 2: "Execute fases 4-9 do plan-review-skills-consolidation.md (catalog + README + HelpView + version)"

**Por que Fase 0 não pode ser pulada:** Fase 1 usa `{{ASK_USER_QUESTION_TOOL}}` no body do `review-plan`, e esse template var só existe depois que Fase 0 edita `src/render.js`. Pular Fase 0 = skills renderizadas vazam syntax `{{ASK_USER_QUESTION_TOOL}}` literal pro usuário. Verificado via codex review F-001 (rev3).
