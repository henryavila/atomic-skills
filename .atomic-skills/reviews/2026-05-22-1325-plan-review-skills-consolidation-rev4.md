---
date: 2026-05-22T13:25:00-03:00
topic: plan-review-skills-consolidation
artifact: docs/plan-review-skills-consolidation.md
skill: review-plan-with-codex
reviewer: gpt-5-codex
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 4, minor: 1, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
framing_delta: {dropped: 1, maintained: 4, emerged: 1}
schema_version: "1.0"
revision: 4
prior_reviews:
  - .atomic-skills/reviews/2026-05-22-1019-plan-review-skills-consolidation.md
  - .atomic-skills/reviews/2026-05-22-1123-plan-review-skills-consolidation.md
  - .atomic-skills/reviews/2026-05-22-1221-plan-review-skills-consolidation-rev3.md
---

# Cross-Model Review — plan-review-skills-consolidation (rev4)

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has several execution gaps that can break installation metadata, make renamed internal workflows unexpectedly interactive, and leave required stale-reference cleanup incomplete. The main risk is not the consolidation itself, but that the migration plan does not fully specify the contracts needed by existing consumers and callers.

## Findings

### F-001 [major] dependency break — docs/plan-review-skills-consolidation.md:518-575

**Evidence:**
```md
**`src/install.js` nem `src/detect.js`.** Esses consomem
`name`/`description`/`modules` da yaml — adicionar/remover entries
não quebra esses scripts.
```

```md
  review-plan:
    name: review-plan
    title: 'Review Plan — Same-Model Adversarial'
...
    schema_version: '0.1'

  review-code:
    name: review-code
    title: 'Review Code — Same-Model Adversarial'
...
    schema_version: '0.1'
```

**Claim:** The new `meta/skills.yaml` entries omit `modules` even though the plan states existing consumers read `modules` from YAML.

**Impact:** Installing or detecting the new skills can fail, skip required module content, or behave differently from existing catalog entries; this would surface only after metadata edits are already made.

**Recommendation:** Add `modules` fields to both new YAML entries using the same shape as existing core review skills, or explicitly update the plan to prove `modules` is optional for these consumers.

**Confidence:** medium

---

### F-002 [major] ordering — docs/plan-review-skills-consolidation.md:147-173

**Evidence:**
```md
3. Use {{ASK_USER_QUESTION_TOOL}} to ask:

   **Question:** "How should this plan be reviewed?"
...
4. Based on answer, set `mode` = `internal` | `cross-ref`.
```

```md
- `project-plan.md:110`: mesmo replacement.
- `project-plan.md:116`: trocar `review-plan-internal` por `review-plan`.
```

**Claim:** Existing internal-only callers are renamed to `review-plan` but are not given a non-interactive way to select `internal` mode.

**Impact:** Workflows like `project-plan` that previously invoked an internal review loop can now block on a prompt every iteration or accidentally enter cross-reference mode.

**Recommendation:** Specify a caller contract: either `review-plan` accepts an explicit internal mode argument, or calls from `project-plan` / `project-status` must instruct the reviewer to select `Internal only` without prompting.

**Confidence:** high

---

### F-003 [major] ambiguity — docs/plan-review-skills-consolidation.md:263-292

**Evidence:**
```md
**SEM AskUserQuestion
de cross-ref** — código é o próprio artefato, cross-ref contra PRD raramente
ajuda.
```

```md
- SINGLE BRANCH: ask the user for an explicit base ref (default suggestion: `main` or the repo's configured default branch).
```

**Claim:** `review-code` still requires user input for branch base selection, but the plan does not define the interaction mechanism or argument contract.

**Impact:** Implementers can hardcode `main`, use `HEAD`, prompt inconsistently, or violate the new tool-abstraction rule, producing different diffs for the same branch input.

**Recommendation:** Add an explicit Step 0 branch-base flow using `{{ASK_USER_QUESTION_TOOL}}`, or require branch reviews to be passed as an explicit range such as `main..feature`.

**Confidence:** high

---

### F-004 [major] viability — docs/plan-review-skills-consolidation.md:151-218

**Evidence:**
```md
2. Scan for sections matching `^##? (Source Documents|References|Artifacts|Inputs|Originated From)` (regex case-insensitive). Extract the file paths/links listed under each.
```

```md
When cross-ref mode is active: line numbers from BOTH plan AND artifact.
```

**Claim:** Cross-reference mode accepts “links” as artifacts but still requires artifact line-number evidence without defining how links are fetched, normalized, or cited.

**Impact:** A detected URL artifact cannot be reliably read with `{{READ_TOOL}}` or cited by line number, so the skill may either stall, skip coverage, or fabricate weak evidence.

**Recommendation:** Restrict detected artifacts to local readable paths unless a URL-fetch workflow is explicitly added; for links, require the user to provide local copies before cross-reference mode proceeds.

**Confidence:** high

---

### F-005 [major] coverage gap — docs/plan-review-skills-consolidation.md:456-836

**Evidence:**
```md
grep -rn 'review-plan-internal\|review-plan-vs-artifacts' skills/ src/
```

```md
Nenhuma **invocação** dos nomes antigos ... sobrou em: `skills/`, `meta/`, `src/`, `tests/`.
```

**Claim:** The concrete stale-reference cleanup only greps `skills/ src/`, but the Definition of Done also requires `tests/` to be clean.

**Impact:** Deleted skill IDs can remain in tests, fixtures, or snapshots; `npm test` may fail late, or worse, stale test coverage may keep asserting removed commands.

**Recommendation:** Add an explicit cleanup step before validation: run `rg 'review-plan-internal|review-plan-vs-artifacts' skills meta src tests README.md CHANGELOG.md` and update tests/fixtures before deletion is considered complete.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- `schema_version` remaining at `'0.1'`.
- `src/install.js` and `src/detect.js` not being modified, except where their existing YAML contract is contradicted.
- `README.pt-BR.md` remaining stale.
- Lack of deprecated aliases for removed skill names.
- Unchanged Codex invocation flow inside `*-with-codex` skills.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The plan still has migration risks around the new interactive `review-plan` contract, ambiguous review-code branch diff selection, URL artifacts that cannot satisfy the evidence rule, and incomplete concrete stale-reference cleanup. The informed pass drops the prior metadata/modules objection because the external constraints establish that `modules` is root-level metadata, not a per-skill field.

One additional issue emerges from the constraints: the validation target says 13 skills, but the current catalog has 12 entries and the plan deletes two while adding two. That makes the expected validation output wrong.

## Findings

### F-001 [major] ordering — docs/plan-review-skills-consolidation.md:246-257

**Evidence:**
```md
3. Use {{ASK_USER_QUESTION_TOOL}} to ask:

   **Question:** "How should this plan be reviewed?"
...
4. Based on answer, set `mode` = `internal` | `cross-ref`.

5. On `cross-ref`: list artifacts to user for final confirmation. User can add/remove. Then proceed.
```

```md
- `project-status.md:639`: trocar `atomic-skills:review-plan-internal` por
  `atomic-skills:review-plan`. Contexto operacional não muda — o new
  `review-plan` cobre o caso `mode=internal` automaticamente.
- `project-plan.md:110`: mesmo replacement.
- `project-plan.md:116`: trocar `review-plan-internal` por `review-plan`.
```

**Claim:** Existing internal-only callers are renamed to `review-plan` but are not given a non-interactive way to force `internal` mode.

**Impact:** `project-plan` and `project-status` workflows that currently run mandatory internal review loops can start blocking on Step 0 prompts, and repeated loops may require repeated human selection.

**Recommendation:** Add an explicit invocation contract for internal mode, either by supporting a mode argument such as `--mode internal` or by changing the caller instructions to mandate selecting `Internal only` without re-prompting during looped reviews.

**Confidence:** high

---

### F-002 [major] ambiguity — docs/plan-review-skills-consolidation.md:385-391

**Evidence:**
```md
4. **Pick the right diff command per shape (`git diff <ref>` is NOT uniform):**
   - SINGLE COMMIT: `git show --format= --patch {{ARG_VAR}}` (equivalent: `git diff {{ARG_VAR}}^!`) — patch of THAT commit alone.
   - SINGLE BRANCH: ask the user for an explicit base ref (default suggestion: `main` or the repo's configured default branch). Run `git diff $(git merge-base <base> {{ARG_VAR}})..{{ARG_VAR}}` — changes the branch introduces vs the chosen base. DO NOT use `HEAD` as one side: when the user is currently checked out on the branch they want reviewed (`HEAD` resolves to the branch tip), `merge-base <branch> HEAD == <branch>` and the diff is empty. If `git merge-base` returns nothing for the chosen base (disjoint history), abort and re-ask.
   - RANGE: `git diff {{ARG_VAR}}` — already correct.
   - NEVER use `git diff <single-ref>` raw: it diffs the WORKTREE against the ref, leaking unrelated local edits into the review.
5. {{BASH_TOOL}}: `git diff --name-only` using the same shape-specific command as step 4 → list modified files. If empty: abort with "No changes in ref".
6. {{BASH_TOOL}}: pipe the shape-specific diff to `wc -c`. If > 50000 bytes: warn user (large diff, cost). Ask: continue / abort.
```

**Claim:** `review-code` requires user input for branch base and large-diff continuation, but the plan does not define the interaction mechanism or argument contract.

**Impact:** Implementers can hardcode `main`, silently infer a base, use inconsistent plain-text prompts, or violate tool abstraction, causing different reviewed diffs for the same branch input.

**Recommendation:** Specify the exact prompt mechanism for `review-code` user decisions using `{{ASK_USER_QUESTION_TOOL}}`, or require branch reviews and large-diff continuation to be expressed through explicit arguments.

**Confidence:** high

---

### F-003 [major] viability — docs/plan-review-skills-consolidation.md:244-245

**Evidence:**
```md
1. {{READ_TOOL}} the plan file at {{ARG_VAR}}.
2. Scan for sections matching `^##? (Source Documents|References|Artifacts|Inputs|Originated From)` (regex case-insensitive). Extract the file paths/links listed under each.
```

```md
NO APPROVAL WITHOUT EVIDENCE.
Each checklist item marked as "ok" MUST have line numbers as proof.
When cross-ref mode is active: line numbers from BOTH plan AND artifact.
```

**Claim:** Cross-reference mode accepts links as artifacts while requiring artifact line-number evidence, without defining how links are fetched, normalized, or cited.

**Impact:** A detected URL cannot be reliably read with `{{READ_TOOL}}` or cited by line number, so cross-reference review can stall, skip artifact coverage, or produce unevidenced approval.

**Recommendation:** Restrict detected artifacts to local readable paths, and require users to provide local copies for links before cross-reference mode proceeds.

**Confidence:** high

---

### F-004 [major] coverage gap — docs/plan-review-skills-consolidation.md:539-549

**Evidence:**
```md
### 3.5.2 — Grep wide pra catch any miss

Antes de avançar pra Fase 4, rodar:

```bash
grep -rn 'review-plan-internal\|review-plan-vs-artifacts' skills/ src/
```

Esperar zero matches além dos próprios arquivos a deletar
(`skills/en/core/review-plan-internal.md` + `review-plan-vs-artifacts.md`).
Se houver outras matches, atualizar.
```

```md
- [ ] Nenhuma **invocação** dos nomes antigos (e.g. `atomic-skills:review-plan-internal <arg>`, `related: [...review-plan-vs-artifacts...]`, `id: 'review-plan-internal'`) sobrou em: `skills/`, `meta/`, `src/`, `tests/`.
```

**Claim:** The concrete stale-reference cleanup only greps `skills/` and `src/`, but the Definition of Done also requires `tests/` and `meta/` to be clean.

**Impact:** Deleted skill IDs can remain in tests, fixtures, or catalog metadata; this can break `npm test` or leave assertions and references targeting removed commands.

**Recommendation:** Add an explicit cleanup command before validation: `rg 'review-plan-internal|review-plan-vs-artifacts' skills meta src tests README.md CHANGELOG.md`, then update any non-migration references found.

**Confidence:** high

---

### F-005 [minor] contradiction — docs/plan-review-skills-consolidation.md:842-845

**Evidence:**
```md
npm test                       # 375 tests still pass (no test depends on the deleted skills)
npm run validate-skills        # 13 skills valid → 13 skills valid (still)
npm run build:dashboard        # HelpView changes compile
```

```md
- [ ] **Fase 9:** `npm test` verde (375 tests); `npm run validate-skills` verde (13 skills); `npm run build:dashboard` sem erros; HelpView no browser mostra os 2 novos e não mostra os 2 deletados
```

**Claim:** The validation expectation says 13 skills, but the current catalog has 12 entries and the plan deletes two skills while adding two.

**Impact:** A correct implementation can produce 12 valid skills and still appear to fail the plan’s stated acceptance criteria, causing unnecessary catalog edits or false validation failure.

**Recommendation:** Change the validation expectation and Definition of Done from `13 skills` to `12 skills`, unless the plan adds another catalog entry explicitly.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- `schema_version` remaining at `'0.1'`.
- `src/install.js` and `src/detect.js` not being modified.
- `README.pt-BR.md` remaining stale.
- Lack of deprecated aliases for removed skill names.
- Unchanged Codex invocation flow inside `*-with-codex` skills.

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [major] dependency break — DROPPED: external constraint 5 establishes that no current `core.*` skill has an entry-level `modules:` field and `modules` is root-level metadata consumed through `meta.modules`.

### Maintained

- F-002-blind → F-001-final [major] — same.
- F-003-blind → F-002-final [major] — same.
- F-004-blind → F-003-final [major] — same.
- F-005-blind → F-004-final [major] — same.

### Emerged

- F-005-final [minor] contradiction — emerged: external constraint 5 states the catalog has 12 entries total, contradicting the plan’s `13 skills` validation expectation.
## Fixes applied in this session

<!-- None yet -->

### Follow-up (post-rev4 microcommits)

- 2026-05-22T13:45 — F-005 [minor] APPLIED via microcommit 65cf3d4. `13 skills` → `12 skills (delete 2, add 2, net 0 vs hoje)` in §9 validation block and Fase 9 DoD line.
- 2026-05-22T13:48 — F-004 [major] APPLIED via microcommit 6861d80. §3.5.2 grep extended from `skills/ src/` to full DoD scope (`skills/ meta/ src/ tests/ README.md CHANGELOG.md`) with allowlist for migration narrative.
- 2026-05-22T13:52 — F-003 [major] APPLIED via microcommit 5e17020. §1.2 Step 0 step 2 now classifies each Source-Documents token as LOCAL PATH / URL / AMBIGUOUS; URLs go to `links_seen` and are NOT auto-fetched.
- 2026-05-22T13:55 — F-002 [major] APPLIED via microcommit 7a1d1f7. Branch-base prompt + large-diff continuation prompt in §2.2 now route through `{{ASK_USER_QUESTION_TOOL}}`. Base options derived from `git symbolic-ref refs/remotes/origin/HEAD` + main/master fallback.
- 2026-05-22T13:58 — F-001 [major] APPLIED via microcommit 085d503. §1.2 Step 0 step 3 adds `--mode=internal` / `--mode=cross-ref --artifacts=...` short-circuit. §3.5.1 caller updates pass `--mode=internal`. DoD Fase 1 + Fase 3.5 extended.

**Post-fix status:** all 5 findings from rev4 addressed in-tree. Trajectory: rev1 1B/2C/2M → rev2 1B/0C/4M → rev3 0B/0C/5M → rev4 0B/0C/4M/1m. First emerged-from-constraint finding (rev4 F-005, the 13→12) successfully caught + fixed.
