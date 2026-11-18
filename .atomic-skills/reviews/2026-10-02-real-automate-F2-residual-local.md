# F2 residual local review
**Verdict:** needs_changes
**Counts:** blocker 0, critical 0, major 1, minor 2, note 3

| # | Severity | Finding |
|---|----------|---------|
| F-001 | major | Unclosed or nested fences drop the rest of the plan from the `none: true` keyword scan |
| F-002 | minor | Keyword matcher misses Vue camelCase and acronym compounds (`PDFViewer`) |
| F-003 | minor | Phase UI scan fails open on IO errors |
| F-004 | note | Architecture citation trusts `card.sha` and does not recompute `architectureCardSha` |
| F-005 | note | `screenPathIssue` is lexical; a symlink target can sit outside the plan directory |
| F-006 | note | New scan/citation paths have no tests |

## F-001 [major] Unclosed or nested fences drop the rest of the plan from the `none: true` keyword scan
- **File:** scripts/find-missing-ui.js:104
- `scanTextFromMarkdown` toggles `inFence` on any line that starts with 3+ backticks or tildes and then `continue`s. It does not track fence length, info strings, or closure. After an odd toggle, every later line hits `if (inFence) continue` at scripts/find-missing-ui.js:108 and is dropped from the scan corpus.
- Heading handling at scripts/find-missing-ui.js:109-118 is skipped while `inFence` is true, so `skipUntil` never clears. An unclosed fence that starts under `## Out of scope` / `## Fora de escopo` therefore swallows in-scope `## Tasks` (and any later `Vue` / `viewer` / `editor` / `sheet` lines). Nested 4-tick/3-tick fences desync the same flag: the inner closer turns `inFence` off, the outer closer turns it back on, and the remainder of the plan is treated as code.
- `collectUiKeywords` at scripts/find-missing-ui.js:151-154 feeds this filtered text into `detectUiKeywords`. `none: true` at scripts/find-missing-ui.js:303-314 then succeeds. tests/find-missing-ui.test.js:537-564 only covers a closed ` ```js ` fence; unclosed and nested fences are untested.

## F-002 [minor] Keyword matcher misses Vue camelCase and acronym compounds (`PDFViewer`)
- **File:** scripts/find-missing-ui.js:42
- `CAMEL_RES` has `sheet` / `viewer` / `editor` and no `vue`. `detectUiKeywords` at scripts/find-missing-ui.js:70-73 only applies camel when `CAMEL_RES[kw]` is set. `WORD_RES.vue` at scripts/find-missing-ui.js:37 requires a non-letter before `vues?` and a `\b` after it, so `VueComponent`, `vueRouter`, and `useVue` do not match.
- Camel patterns require a lowercase letter then `Viewer`/`Editor`/`Sheet`, or `[A-Z][a-z]+` then the suffix. `PDFViewer`, `CSVViewer`, and `JSONViewer` match neither `CAMEL_RES` nor `WORD_RES` (`F`/`V` are both letters, so there is no `[^A-Za-z]` / `\b` before `Viewer`). All-lowercase compounds (`pdfviewer`, `bottomsheet`) miss both tables.
- tests/find-missing-ui.test.js:519-527 covers `pdfViewer` / `RichTextEditor` / `sheets` only. `VueComponent` and `PDFViewer` are untested false negatives on the `none: true` refusal path.

## F-003 [minor] Phase UI scan fails open on IO errors
- **File:** scripts/find-missing-ui.js:136
- `phaseMarkdownFiles` catches `statSync` failures per entry and skips them. `collectUiKeywords` at scripts/find-missing-ui.js:157-159 catches `readFileSync` failures on phase markdown and skips them. A `phases/*.md` file that contains UI keywords and is unreadable (EACCES, EISDIR race, dangling fd) is omitted from the set. `none: true` at scripts/find-missing-ui.js:303-314 then passes.
- `statSync(phasesDir)` at scripts/find-missing-ui.js:130 is outside that try: `existsSync` true then `EACCES`/`ENOTDIR` throws out of `checkPlanUi` instead of becoming an issue. Same directory walk, two failure modes, both leave UI keywords unchecked or crash the process.

## F-004 [note] Architecture citation trusts `card.sha` and does not recompute `architectureCardSha`
- **File:** scripts/find-missing-ui.js:217
- `checkArchitectureCitation` uses `card.sha.trim()` when that field is a non-empty string and only calls `architectureCardSha(card)` when it is not. A `ui/ui.json` that copies a stale or arbitrary `card.sha` passes this detector. `find-missing-architecture.js` recomputes the drawing hash; this file does not on the populated-`sha` path. tests/find-missing-ui.test.js:301-315 and :469-475 only compare against `writeCard`'s stamped `sha`, never a drawing/`sha` split.

## F-005 [note] `screenPathIssue` is lexical; a symlink target can sit outside the plan directory
- **File:** scripts/find-missing-ui.js:234
- Absolute paths and `..` segments are rejected at scripts/find-missing-ui.js:235-241. `existsSync` / `statSync` / later `readFileSync` at scripts/find-missing-ui.js:243-247 and :334 follow symlinks. `ui/screen.html` → a file outside `planDir` satisfies the relative check, is hashed, and can satisfy `screens[].sha`. tests/find-missing-ui.test.js:441-456 cover `/tmp/...` and `../outside.html` only.

## F-006 [note] New scan/citation paths have no tests
- **File:** tests/find-missing-ui.test.js:376
- No case for: unclosed / nested fences (scripts/find-missing-ui.js:104); `cardSha`-only matching citation (scripts/find-missing-ui.js:188-189); `VueComponent` / `PDFViewer` (scripts/find-missing-ui.js:42-73); `none: true` plus a `screens` array (scripts/find-missing-ui.js:303 vs :315); YAML frontmatter parse failure (scripts/find-missing-ui.js:96-98). `detectUiKeywords` is exported at scripts/find-missing-ui.js:66 and is never called from tests (only `checkPlanUi` / `uiPathsForPlan`).
