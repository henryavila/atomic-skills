# project — `migrate` / `re-bootstrap` (lazy detail)

Loaded by the router for `/atomic-skills:project migrate <slug>` and `/atomic-skills:project re-bootstrap <slug>`.

> **Invocation:** both are **top-level** verbs, not part of the `new` menu — they convert/repair existing files rather than creating one entity.

## `migrate <slug>`

Explicit migration trigger for a legacy initiative.

1. Load `.atomic-skills/initiatives/<slug>.md`. Parse frontmatter.
2. If `schemaVersion === '0.1'`, announce "Already migrated" and exit.
3. Ask the user (intrusive-actions rule):
   > "This file uses the legacy (pre-0.1) format. Migrate now?
   > Choices:
   >   (s) standalone — no parentPlan
   >   (p) under existing plan — pick from list
   >   (n) cancel"
4. On `(s)` or `(p)`: run `src/migrate.js`:`migrateLegacyInitiative(legacy, { parentPlan, phaseId })`. Write the result back.
5. Report: "Migrated `<slug>` to schemaVersion 0.1. Field mapping summary: ..." (show the diff at a high level).
6. If the migrated file has any item where `isMigratedPlaceholder(context)` is true, append: **"<N> parked/emerged items carry placeholder context. Run `re-bootstrap <slug>` to re-articulate them in batch, or `atomic-skills:project re-ratify <id>` per item."**
7. Optionally run `npm run validate-state -- .atomic-skills/initiatives/<slug>.md` to confirm.

## `re-bootstrap <slug>`

Re-articulates the `context` of every parked/emerged item still carrying a migration placeholder. Runs after `migrate <slug>` to replace the honest "(migrated from legacy schema) — re-ratify to articulate" stub with a real `solves` / `trigger` / `assumesStillValid` block per item, using evidence gathered from the current project state.

**When to run:** right after `migrate <slug>`, OR any time you want to convert remaining placeholder items into real articulations. Note that `scope-creep` does NOT surface fresh placeholders — its detector ages by `lastReviewedAt` and migration sets that to `now`. Placeholder items appear in `scope-creep` only after they age past `staleContextDays` (default 14). To find them earlier: grep the initiative file for `(migrated from legacy schema)` or check `isMigratedPlaceholder` on each parked/emerged context.

**When NOT to run:** if the initiative has no placeholder items (`isMigratedPlaceholder` returns false for every parked/emerged context), the command exits as a no-op. Re-running on a partially-ratified initiative only prompts the remaining placeholder items — fully idempotent.

### Pre-flight

1. {{READ_TOOL}} `.atomic-skills/initiatives/<slug>.md`. Parse YAML frontmatter.
2. If `schemaVersion !== '0.1'`: abort with "Initiative is legacy. Run `migrate <slug>` first."
3. **Load excludes config.** {{READ_TOOL}} `.atomic-skills/status/config.json` (treat absent file or missing key as empty). Build the effective excludes list:
   ```js
   excludes = ['node_modules', 'dist', '.git', '*.lock']
              .concat(config.reBootstrapExcludes ?? [])
   ```
   Hold `excludes` for use in the per-item evidence step. Dedupe.
4. Build the target list: every `parked[i]` and `emerged[i]` where `isMigratedPlaceholder(context)` (imported from `src/migrate.js`) returns true.
5. If target list empty: announce "No placeholder items to re-articulate." and exit.
6. Print cost preview:
   > "<N> items to re-articulate. Each runs ~3 greps + ~1 git log + ~2 reads + 1 LLM draft.
   > Estimated wall: <N × ~20s>. Estimated $: depends on context, typically <N × ~$0.05>.
   > Proceed? [(y)es / (n)o]"
7. On `(n)`: abort. On `(y)`: continue.

### Per-item loop

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
     - {{GREP_TOOL}} recursive in the project root, applying the `excludes` list built in pre-flight step 3. Cap 3 hits per keyword. ({{GREP_TOOL}} takes the pattern as a structured tool arg — no shell interpolation, so any keyword is safe here.)
     - If any hit looks like a file path with extension: {{READ_TOOL}} the first ~80 lines for additional context (cap 2 reads total per item).
   - **Keyword sanitization for {{BASH_TOOL}}** (mandatory before the git log step below): for each keyword, verify it matches `^[A-Za-z0-9._/-]+$`. If it doesn't (contains a quote, `$`, backtick, semicolon, pipe, newline, space, etc.), DROP it from the git log step — adversarial parked/emerged titles could otherwise inject shell commands via the interpolated `--grep` argument.
   - If at least one sanitized keyword remains: {{BASH_TOOL}} `git log --oneline -10 --grep="<top-sanitized-keyword>"` (1 call) to surface commits referencing the topic. **Skip this call when no sanitized keyword remains** (otherwise `git log` with no pattern would dump unrelated commits).

3. **Draft proposal**:
   - Based on title + evidence + surfacedAt, draft:
     - `solves` — 1 sentence problem statement. If evidence is thin (< 2 grep hits and no commits), prepend `[low-confidence draft] ` and ask the user to verify.
     - `trigger` — what caused the item to surface. If surfacedAt is near commits found in `git log`, reference them ("Noticed during commit abc1234"). Otherwise: `[needs user input — agent could not infer trigger from title + project state]`.
     - `assumesStillValid` — at most 1 premise the agent is confident about. If unsure: emit a single stub `[premise stub — edit to record what would invalidate this item]`.

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
     - `skip`             keep placeholder; re-run `re-bootstrap` to handle later
     - `cancel-batch`     stop the loop; already-ratified items in this run are kept
   ```
   - HALT until input.
   - A generic `ok` / `sim` / `yes` / `do it` reply is NOT ratify. Treat as the user asking for more specificity — re-prompt.

5. **Apply**:
   - On `ratify`: write the drafted context to the item. Advance `ratifiedAt` and `lastReviewedAt` to now. `ratifiedBy: human`.
   - On `skip`: no write. Continue loop.
   - On `cancel-batch`: stop loop. Items ratified earlier in the run stay saved.
   - On **paste edits**: see the canonical format below.

### Pasted-edit canonical format

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

**Validation** (mirror `context` schema in `meta/schemas/common.schema.json#/$defs/context`):
- `solves.length >= 8`, otherwise parse failure.
- `trigger.length >= 8`, otherwise parse failure.
- Every item in `assumesStillValid`: `length >= 4`, otherwise parse failure.

**Parse failure behavior** (any of: YAML syntax error, missing required field, length violation, unknown key):
1. Print the specific error: e.g. `"parse failed: missing required field 'trigger'"`.
2. Re-print the canonical example block (above).
3. Re-prompt the user with the SAME four options (`ratify` / paste edits / `skip` / `cancel-batch`). The item is NOT skipped on parse failure.
4. Three consecutive parse failures on the same item: abort the loop with `"too many parse failures on <id>; cancel-batch invoked automatically"`.

### Post-loop

1. Print summary:
   ```
   re-bootstrap <slug> complete:
     ratified:     <R> items
     skipped:      <S> items (still placeholder; re-run to handle them)
     cancelled at: <item id, if any>
   ```
2. If S > 0: remind "Run `re-bootstrap <slug>` or `atomic-skills:project re-ratify <id>` to handle the remaining <S> items."
3. If R > 0: bump initiative `lastUpdated` to now. {{WRITE_TOOL}} the updated frontmatter back to `.atomic-skills/initiatives/<slug>.md`.

### Honest limits

- The agent CAN fabricate plausible-but-wrong `solves`. The ratify gate is the only guarantee against this — read every draft before approving.
- `assumesStillValid` is the field most likely to be wrong: it asks "what makes this moot?" and the agent rarely knows the user's mental model. Prefer pasting edits over `ratify` for non-trivial premises.
- The grep-based evidence is project-wide. Old archived branches, vendored code, or generated files can trigger false-positive hits. Defaults exclude `node_modules`, `dist`, `.git`, `*.lock`; extend per-repo via `.atomic-skills/status/config.json:reBootstrapExcludes`.
