# Phase writer brief — real-automate F2 review-fix

You are a **code-only phase writer** in an isolated sibling worktree.
This sealed brief is self-contained. **No host chat history is included or authorized.**

## Code-only fence (HARD)

You MAY:
- Edit product/source paths listed below.
- Run pre-close self-check verifiers.
- Create **implementation** microcommits with explicit paths only (`rtk git add <paths>` — never `git add .` / `-A`).
- Return a structured **claim report**.

You **MUST NOT**:
- Invoke `done`, `phase-done`, finalize, archive, or any project-skill state transition.
- Mutate durable `.atomic-skills/` project state (plan.md, phase initiatives, rollups, lessons, review receipts, handoff, maestro cursor, leases).
- Mark tasks `status: done` in initiative YAML.
- Self-certify: a claim is confidence, not closure.
- Nest a phase worktree under the plan worktree.
- Depend on host chat history.
- Commit writer-lease secrets.

## Phase work-order

- **planSlug:** real-automate
- **phaseId:** F2
- **kind:** review-fix (tasks T-001/T-002/T-003 already closed; this is a code-only fix for phase-review findings)
- **initiativePath (read-only):** `/home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/phases/f2-prototipo.md`
- **worktreePath (cwd):** `/home/henry/atomic-skills/.worktrees/real-automate-F2-fix1`
- **writerBranch:** `impl/real-automate-F2-fix1`
- **baseRef:** `8e33c818`
- **decisionLogPath (informational — do not write):** `.atomic-skills/projects/atomic-skills/real-automate/decisions/F2.jsonl`

### Admitted paths (ONLY these)

- `scripts/find-missing-ui.js`
- `tests/find-missing-ui.test.js`

Do **not** edit `scripts/automate-run.js`, `scripts/find-missing-architecture.js`, `tests/automate-host-pen.test.js`, or anything under `.atomic-skills/`.

### scopeBoundary (DO-NOT)

- Do **not** build a CommonMark / HTML-block / NLP parser. No Type 6/7 HTML blocks, no Setext trivia, no 80-pass `extractCandidateText`, no 2000-line detector.
- Target size: `scripts/find-missing-ui.js` stays **under 500 lines**. Tests for this fix stay **under ~250 added lines** (keep the original 17 tests; add one `describe('review fixes')` suite).
- Do **not** implement F3 writer/merge, F4 review loop, or F5 page.
- Do **not** treat `exitGateType: ui-gate` as the stamp.
- Do **not** change the architecture detector.

### Verifier

```
node --test tests/find-missing-ui.test.js
```

Expect exit 0. Also keep-green: `node --test tests/find-missing-architecture.test.js` (do not edit it).

## What to implement (TDD)

Write failing tests first, then the minimum detector change.

Reviews to satisfy (verbatim findings):

1. **F-001 critical / Codex F-001 major — missing prototype must fail.**  
   If `screens[].path` does not exist, or is a directory, record an issue and exit 1. Current code skips the block when `existsSync` is false.

2. **F-002 / Codex F-002+F-003 — architecture sha.**  
   - Validate **every** supplied `architectureSha` and `cardSha` (empty/non-string → fail; conflicting aliases → fail).  
   - If a reference is supplied and the architecture card is missing or JSON is malformed → fail (do not swallow).  
   - If `architecture/decisions.json` **exists** and `ui/ui.json` omits both `architectureSha` and `cardSha` → fail (the stamp must cite the card).  
   - If the card does **not** exist and no sha is cited, do not invent a failure (the architecture detector owns missing cards).  
   - Existing fixture tests that never write a card must still pass.

3. **F-003 major — scan phase initiatives.**  
   When `none: true`, scan `plan.md` **and** `phases/*.md` (skip `phases/archive/`). A Vue/sheet/viewer/editor touch in a phase file must refuse `none: true`.

4. **F-004 / Codex F-004 — keyword forms.**  
   Detect plurals (`sheets`, `viewers`, `editors`) and camelCase/PascalCase component names (`PdfViewer`, `RichTextEditor`, `pdfViewer`).  
   Do **not** match `reviewer`, `creditor`, `CodeReviewer`.  
   `spreadsheet(s)` may match as a sheet surface.

5. **F-005 minor — path containment.**  
   `screens[].path` must be relative to the plan directory. Absolute paths and `..` traversal fail.

6. **Out-of-scope mentions (Codex F-004 converse).**  
   A **simple** skip, not a markdown engine:  
   - YAML frontmatter key `outOfScope` (and markdown headings that are exactly `Out of scope` / `Fora de escopo`) are excluded from keyword scan.  
   - You MAY use the existing `yaml` dependency for frontmatter.  
   - You may skip fenced code blocks with a 10-line state machine.  
   - That is the entire exclusion model.

7. **Empty screen file** — reject empty prototype files.

## Starting code

HEAD `scripts/find-missing-ui.js` is 281 lines. Keep its CLI, `uiPathsForPlan`, `checkAll`, `findPlanMarkdownFiles`, and `exitGateType: ui-gate` behaviour. Extend `detectUiKeywords` and `checkPlanUi` only.

A previous agent ballooned this file to 2059 lines and 4900 test lines. That work was **stashed and is forbidden to revive**. If you find yourself adding pass-numbered tests for HTML comments, list fences, or contrast conjunctions: STOP. You are out of scope.

## Claim report (required)

Write JSON to `/tmp/real-automate-F2-fix1-claims.json` (not under `.atomic-skills/`) and also print it as your final message.

```json
{
  "planSlug": "real-automate",
  "phaseId": "F2",
  "worktreePath": "/home/henry/atomic-skills/.worktrees/real-automate-F2-fix1",
  "writerBranch": "impl/real-automate-F2-fix1",
  "finishedAt": "<ISO>",
  "tasks": [
    {
      "taskId": "T-002",
      "status": "claimed-pass",
      "commitShas": ["<sha>"],
      "base": "8e33c818",
      "head": "<head sha>",
      "paths": ["scripts/find-missing-ui.js", "tests/find-missing-ui.test.js"],
      "verifierCommand": "node --test tests/find-missing-ui.test.js",
      "exitCode": 0,
      "transcript": "<verbatim test summary>"
    }
  ]
}
```

Use `claimed-fail` with the failing transcript if the verifier does not pass. Do not mark claimed-pass unless `exitCode === 0` on a real run in this worktree.

## Git

- Working tree starts clean at `8e33c818` on `impl/real-automate-F2-fix1`.
- One or more explicit-path microcommits, e.g. `fix(T-002): refuse missing UI prototype and cite architecture sha`.
- Never `git add .` / `-A`.
- Do not push.
