---
date: 2026-05-22T12:21:00-03:00
topic: plan-review-skills-consolidation
artifact: docs/plan-review-skills-consolidation.md
skill: review-plan-with-codex
reviewer: gpt-5-codex
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 0}
schema_version: "1.0"
revision: 3
prior_reviews:
  - .atomic-skills/reviews/2026-05-22-1019-plan-review-skills-consolidation.md
  - .atomic-skills/reviews/2026-05-22-1123-plan-review-skills-consolidation.md
---

# Cross-Model Review — plan-review-skills-consolidation (rev3)

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has several execution-level gaps: its own handoff instructions skip a required phase, the new `review-code` diff semantics are underspecified and fail common branch-review cases, metadata promises an input type the skill rejects, and validation does not add automated coverage for the new render variable. These are not style issues; following the plan as written can ship broken rendered prompts or a review skill that reviews the wrong diff or no diff.

## Findings

### F-001 [major] ordering — docs/plan-review-skills-consolidation.md:47-49

**Evidence:**
```md
| 0 | **Infra: adicionar `ASK_USER_QUESTION_TOOL` template var** | `src/render.js`, `CLAUDE.md`, `AGENTS.md`, `docs/kb/gemini-cli-compatibility.md` | 20 min |
| 1 | Design + write `skills/en/core/review-plan.md` body (usa `{{ASK_USER_QUESTION_TOOL}}`, NÃO hardcode) | novo arquivo | 45 min |
| 2 | Design + write `skills/en/core/review-code.md` body (validação git ref tolerante a ranges) | novo arquivo | 30 min |
```

**Claim:** The final invocation instructions tell the next session to execute phases 1-9, which skips the required Phase 0 that creates the template variable used by Phase 1.

**Impact:** An implementer following the handoff can create `skills/en/core/review-plan.md` with `{{ASK_USER_QUESTION_TOOL}}` before `src/render.js` knows how to render it, leaving literal template text in installed skills or forcing an unplanned mid-implementation fix.

**Recommendation:** Change the handoff commands to execute phases `0-9`, and for the split-session variant make Session 1 execute `0-3` instead of `1-3`.

**Confidence:** high

---

### F-002 [major] ambiguity — docs/plan-review-skills-consolidation.md:323-335

**Evidence:**
```md
1. {{ARG_VAR}} must be a git ref (branch, single commit, or commit range like `main..HEAD` / `main...HEAD`).
2. **Detect ref shape (test in order, triple-dot FIRST):**
   - If {{ARG_VAR}} contains `...` (triple-dot): RANGE; separator = `...`.
   - Else if {{ARG_VAR}} contains `..` (double-dot): RANGE; separator = `..`.
   - Else: SINGLE ref.
3. **Validate:**
   - SINGLE: {{BASH_TOOL}}: `git rev-parse --verify {{ARG_VAR}}` exits 0.
   - RANGE: split on the detected separator (do NOT split on `..` when separator was `...` — would yield wrong tokens like `['main', '.HEAD']`). Validate each non-empty endpoint with `git rev-parse --verify <endpoint>`. Empty endpoint (e.g. `..HEAD`) is shorthand for `HEAD` — valid.
4. **Pick the right diff command per shape (`git diff <ref>` is NOT uniform):**
   - SINGLE COMMIT: `git show --format= --patch {{ARG_VAR}}` (equivalent: `git diff {{ARG_VAR}}^!`) — patch of THAT commit alone.
   - SINGLE BRANCH: `git diff $(git merge-base {{ARG_VAR}} HEAD)..{{ARG_VAR}}` — changes the branch introduces against the merge-base with HEAD. If `git merge-base` returns nothing (disjoint history), abort and ask the user for an explicit base.
```

**Claim:** The plan classifies all non-range inputs as `SINGLE ref` but never defines how to distinguish a single commit from a single branch before choosing mutually incompatible diff commands.

**Impact:** Two implementers can validly implement different behavior for the same input; worse, a branch can be reviewed as one commit or a commit-like ref can be reviewed as a branch, producing incomplete or unrelated findings.

**Recommendation:** Add a deterministic sub-step after `SINGLE` validation that resolves object type and branch identity, for example using `git cat-file -t`, `git rev-parse --verify <ref>^{commit}`, and `git show-ref --verify refs/heads/<ref>`, with an explicit ambiguity rule.

**Confidence:** high

---

### F-003 [major] viability — docs/plan-review-skills-consolidation.md:331-337

**Evidence:**
```md
4. **Pick the right diff command per shape (`git diff <ref>` is NOT uniform):**
   - SINGLE COMMIT: `git show --format= --patch {{ARG_VAR}}` (equivalent: `git diff {{ARG_VAR}}^!`) — patch of THAT commit alone.
   - SINGLE BRANCH: `git diff $(git merge-base {{ARG_VAR}} HEAD)..{{ARG_VAR}}` — changes the branch introduces against the merge-base with HEAD. If `git merge-base` returns nothing (disjoint history), abort and ask the user for an explicit base.
   - RANGE: `git diff {{ARG_VAR}}` — already correct.
   - NEVER use `git diff <single-ref>` raw: it diffs the WORKTREE against the ref, leaking unrelated local edits into the review.
5. {{BASH_TOOL}}: `git diff --name-only` using the same shape-specific command as step 4 → list modified files. If empty: abort with "No changes in ref".
6. {{BASH_TOOL}}: pipe the shape-specific diff to `wc -c`. If > 50000 bytes: warn user (large diff, cost). Ask: continue / abort.
```

**Claim:** The `SINGLE BRANCH` diff command uses `HEAD` as the comparison side, so reviewing the currently checked-out branch produces an empty diff.

**Impact:** The documented branch-review path can falsely abort with “No changes in ref” for the common case where the user is on the feature branch they want reviewed.

**Recommendation:** Require an explicit base for branch review, or define branch review as `git diff <default-base>...<branch>` after resolving the default base; do not use `merge-base <branch> HEAD` when `HEAD` may be the branch itself.

**Confidence:** high

---

### F-004 [major] contradiction — docs/plan-review-skills-consolidation.md:543-550

**Evidence:**
```md
  review-code:
    name: review-code
    title: 'Review Code — Same-Model Adversarial'
    description: 'Adversarial self-loop review of code changes (git ref or diff). Same-model checklist for bugs, race conditions, error handling, and test coverage. Free alternative to review-code-with-codex.'
    purpose: >
      Review a git ref or diff adversarially looking for logic bugs, race
      conditions, error handling gaps, schema/migration inconsistencies,
```

**Claim:** The catalog entry promises `git ref or diff`, but the skill design requires `{{ARG_VAR}}` to be a git ref and defines no diff-file, stdin, or raw-patch path.

**Impact:** Users can invoke `/atomic-skills:review-code <diff>` based on the catalog and hit validation failure, or an implementer can invent unsupported diff handling outside the plan.

**Recommendation:** Either add a complete diff-input mode to Phase 2, including validation and file extraction, or remove “or diff” from the metadata, README, HelpView, and closing text.

**Confidence:** high

---

### F-005 [major] test coverage — docs/plan-review-skills-consolidation.md:144-181

**Evidence:**
```md
### 0.5 — Validação (post-Fase 1)

Skill bodies que usam `{{ASK_USER_QUESTION_TOOL}}` só existem após Fase 1.
Portanto a validação manual roda DEPOIS de Fase 1 estar completa:
```

```md
Em Fase 0 propriamente (antes de Fase 1), validação automatizada é
impossível porque ninguém usa o var ainda. Apenas conferir visualmente
que `src/render.js` parse-checa após o edit (`node --check src/render.js`).
```

**Claim:** The plan adds a new render variable but relies on manual validation and parse-checking instead of adding automated render tests.

**Impact:** `npm test` can pass while `{{ASK_USER_QUESTION_TOOL}}` remains unrendered for one or more IDEs, causing installed `review-plan` prompts to leak raw template syntax.

**Recommendation:** Add automated tests in Phase 0 or Phase 9 that assert `renderTemplate` renders `ASK_USER_QUESTION_TOOL` for `claude-code`, `gemini`, and at least one non-Gemini non-Claude IDE, plus an install/render leak check for the new `review-plan` body.

**Confidence:** high

## Questions (non-findings)

- docs/plan-review-skills-consolidation.md:857 — Should the render behavior for `codex`, `opencode`, `github-copilot`, and `generic` be explicitly validated, or is `cursor` intended as the only representative non-native-tool IDE?

## Out of scope

- Catalog `schema_version` staying at `'0.1'`.
- `src/install.js` and `src/detect.js` remaining unchanged.
- `README.pt-BR.md` intentionally staying stale.
- Deprecated aliases for removed skills.
- The unchanged Codex invocation flow inside `*-with-codex` skills.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The plan still has execution-level gaps that can ship broken skill rendering or incorrect code-review behavior. The external constraints confirm that `ASK_USER_QUESTION_TOOL` is not currently supported, so skipping Phase 0 is a real dependency break. The `review-code` design also remains underspecified for common git inputs and contradicts its own metadata by advertising diff input without defining it.

## Findings

### F-001 [major] ordering — docs/plan-review-skills-consolidation.md:933-937

**Evidence:**
```md
> "Leia `docs/plan-review-skills-consolidation.md` e execute as fases 1-9."

Pra rodar em duas sessões (mais seguro):

> Sessão 1: "Execute fases 1-3 do plan-review-skills-consolidation.md (bodies novos)"
```

**Claim:** The handoff instructions skip Phase 0 even though Phase 1 depends on the `ASK_USER_QUESTION_TOOL` template variable created in Phase 0.

**Impact:** An implementer following the handoff can create `skills/en/core/review-plan.md` with `{{ASK_USER_QUESTION_TOOL}}` before `src/render.js` supports it, causing installed prompts to leak raw template syntax.

**Recommendation:** Change the handoff to execute phases `0-9`, and change the split-session variant to Session 1 = `0-3`.

**Confidence:** high

---

### F-002 [major] ambiguity — docs/plan-review-skills-consolidation.md:323-333

**Evidence:**
```md
1. {{ARG_VAR}} must be a git ref (branch, single commit, or commit range like `main..HEAD` / `main...HEAD`).
2. **Detect ref shape (test in order, triple-dot FIRST):**
   - If {{ARG_VAR}} contains `...` (triple-dot): RANGE; separator = `...`.
   - Else if {{ARG_VAR}} contains `..` (double-dot): RANGE; separator = `..`.
   - Else: SINGLE ref.
3. **Validate:**
   - SINGLE: {{BASH_TOOL}}: `git rev-parse --verify {{ARG_VAR}}` exits 0.
   - RANGE: split on the detected separator (do NOT split on `..` when separator was `...` — would yield wrong tokens like `['main', '.HEAD']`). Validate each non-empty endpoint with `git rev-parse --verify <endpoint>`. Empty endpoint (e.g. `..HEAD`) is shorthand for `HEAD` — valid.
4. **Pick the right diff command per shape (`git diff <ref>` is NOT uniform):**
   - SINGLE COMMIT: `git show --format= --patch {{ARG_VAR}}` (equivalent: `git diff {{ARG_VAR}}^!`) — patch of THAT commit alone.
   - SINGLE BRANCH: `git diff $(git merge-base {{ARG_VAR}} HEAD)..{{ARG_VAR}}` — changes the branch introduces against the merge-base with HEAD.
```

**Claim:** The plan classifies non-range inputs as `SINGLE ref` but never defines how to distinguish a single commit from a single branch.

**Impact:** The same input can be implemented with incompatible review scopes, producing either one-commit review or branch review depending on the implementer.

**Recommendation:** Add a deterministic branch-vs-commit resolution step using git object/ref checks, and define the behavior for ambiguous names.

**Confidence:** high

---

### F-003 [major] viability — docs/plan-review-skills-consolidation.md:333-337

**Evidence:**
```md
   - SINGLE BRANCH: `git diff $(git merge-base {{ARG_VAR}} HEAD)..{{ARG_VAR}}` — changes the branch introduces against the merge-base with HEAD. If `git merge-base` returns nothing (disjoint history), abort and ask the user for an explicit base.
   - RANGE: `git diff {{ARG_VAR}}` — already correct.
   - NEVER use `git diff <single-ref>` raw: it diffs the WORKTREE against the ref, leaking unrelated local edits into the review.
5. {{BASH_TOOL}}: `git diff --name-only` using the same shape-specific command as step 4 → list modified files. If empty: abort with "No changes in ref".
6. {{BASH_TOOL}}: pipe the shape-specific diff to `wc -c`. If > 50000 bytes: warn user (large diff, cost). Ask: continue / abort.
```

**Claim:** The `SINGLE BRANCH` command uses `HEAD` as the comparison side, so reviewing the currently checked-out branch yields an empty diff.

**Impact:** The common workflow `/atomic-skills:review-code feature-branch` while on `feature-branch` can falsely abort with “No changes in ref.”

**Recommendation:** Require an explicit base for branch review, or define branch review as `git diff <base>...<branch>` after resolving a default base that is not the branch itself.

**Confidence:** high

---

### F-004 [major] contradiction — docs/plan-review-skills-consolidation.md:543-550

**Evidence:**
```md
  review-code:
    name: review-code
    title: 'Review Code — Same-Model Adversarial'
    description: 'Adversarial self-loop review of code changes (git ref or diff). Same-model checklist for bugs, race conditions, error handling, and test coverage. Free alternative to review-code-with-codex.'
    purpose: >
      Review a git ref or diff adversarially looking for logic bugs, race
      conditions, error handling gaps, schema/migration inconsistencies,
      and test coverage gaps. Self-loop up to 3 iterations. Free
```

**Claim:** The catalog promises `git ref or diff`, but the skill design only validates git refs and ranges.

**Impact:** Users can invoke the skill with a diff based on metadata and hit validation failure, or implementers can invent unsupported diff handling outside the plan.

**Recommendation:** Either add a complete diff-input mode to Phase 2, or remove “or diff” from metadata, README, HelpView, and the closing format.

**Confidence:** high

---

### F-005 [major] test coverage — docs/plan-review-skills-consolidation.md:144-181

**Evidence:**
```md
### 0.5 — Validação (post-Fase 1)

Skill bodies que usam `{{ASK_USER_QUESTION_TOOL}}` só existem após Fase 1.
Portanto a validação manual roda DEPOIS de Fase 1 estar completa:
```

```md
Em Fase 0 propriamente (antes de Fase 1), validação automatizada é
impossível porque ninguém usa o var ainda. Apenas conferir visualmente
que `src/render.js` parse-checa após o edit (`node --check src/render.js`).
```

**Claim:** The plan adds a new render variable but relies on manual checks and parse-checking instead of automated tests.

**Impact:** `npm test` can pass while one or more IDE render paths leave `{{ASK_USER_QUESTION_TOOL}}` unresolved in installed skill prompts.

**Recommendation:** Add automated tests asserting `renderTemplate` resolves `ASK_USER_QUESTION_TOOL` for `claude-code`, `gemini`, and one non-Gemini non-Claude IDE, plus a rendered `review-plan` leak check.

**Confidence:** high

## Questions (non-findings)

- docs/plan-review-skills-consolidation.md:150-163 — Is `cursor` intended as the only representative non-native-tool IDE, or should `codex`, `opencode`, `github-copilot`, and `generic` also be validated?

## Out of scope

- Catalog `schema_version` staying at `'0.1'`.
- `src/install.js` and `src/detect.js` remaining unchanged.
- `README.pt-BR.md` intentionally staying stale.
- Deprecated aliases for removed skills.
- The unchanged Codex invocation flow inside `*-with-codex` skills.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-004-final [major] — same
- F-005-blind → F-005-final [major] — same

### Emerged

- _(none)_
## Fixes applied in this session

<!-- None applied — all 5 findings are major (severity rules don't auto-propose). User to decide. -->

### Follow-up (post-rev3 microcommits)

- 2026-05-22T12:32 — F-001 [major] APPLIED via microcommit a8b5002. Handoff in §"Como invocar a próxima sessão" now reads `fases 0-9` and Sessão 1 = `0-3`, with a "Por que Fase 0 não pode ser pulada" paragraph.
- 2026-05-22T12:35 — F-004 [major] APPLIED via microcommit b6cca3b. `review-code` catalog description + purpose narrowed to "git ref (branch, commit, or range)" — "or diff" dropped from both. `when_not_to_use` reworded.
- 2026-05-22T12:38 — F-005 [major] APPLIED via microcommit 1fae763. New §0.5 adds automated test in `tests/render.test.js` covering `ASK_USER_QUESTION_TOOL` for claude-code + gemini + cursor + `test.each` over codex/opencode/github-copilot/generic. Old §0.5 renumbered to §0.6. Phases-table file list + time + Fase 0 DoD extended.
- 2026-05-22T12:42 — F-003 [major] APPLIED via microcommit 9bc2227. SINGLE BRANCH diff command now asks user for explicit base, runs `git merge-base <base> <branch>` (no HEAD self-comparison), and refuses disjoint-history with re-ask.
- 2026-05-22T12:46 — F-002 [major] APPLIED via microcommit 61b9968. New §2.2 step 3.5 distinguishes COMMIT vs BRANCH via `git show-ref --verify refs/heads/` (+ refs/remotes) → `git cat-file -t` (commit vs tag). Ambiguity rule: hex-SHA-vs-branch-name collision → prefer branch + warn. Added "Por que classificar..." rationale paragraph.

**Post-fix status:** all 5 findings from the rev3 review are addressed in-tree. A 4th-round codex review would be the canonical way to confirm nothing regressed, but the working tree is now committed and re-runnable.
