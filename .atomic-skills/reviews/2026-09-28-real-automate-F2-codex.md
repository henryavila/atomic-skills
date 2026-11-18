# F2 cross-model review (Codex) — UI prototype detector

**Ref:** F2 UI detector (`scripts/find-missing-ui.js`, `scripts/automate-run.js`, `tests/find-missing-ui.test.js`, `tests/automate-host-pen.test.js`)
**Host:** OpenAI Codex (gpt-6-astra)
**Mode:** external adversarial review (read-only sandbox). No fixes applied.
**Contract:** `projects/atomic-skills/real-automate/source.md` F2 T-001..T-003; P5 / “Protótipo” in `.ai/memory/decisao-unattended-bloco.md` and `plan.md`.
**Verdict:** needs_changes

**Counts:** blocker 0, critical 0, major 4, minor 0, note 0

| # | Severity | Finding |
|---|----------|---------|
| F-001 | major | Missing prototypes pass the strict gate (`scripts/find-missing-ui.js:166`). Verification only runs when screen path exists; nonexistent path or directory path records no issue. |
| F-002 | major | Architecture references can bypass validation (`scripts/find-missing-ui.js:116`). Conflicting or unvalidated aliases pass without full check. |
| F-003 | major | Unverifiable architecture references are accepted (`scripts/find-missing-ui.js:124`). Missing architecture card skips comparison; malformed JSON is swallowed. |
| F-004 | major | Keyword matching does not reliably identify UI scope (`scripts/find-missing-ui.js:58`). Word boundary rejects camelCase components (`PdfViewer.tsx`, `RichTextEditor.tsx`) while out-of-scope negative mentions reject legitimate no-UI declarations. |

---

## Raw Codex Output

Found **4 major issues** after two passes. No fixes applied.

1. **Major — Missing prototypes pass the strict gate.**  
   `scripts/find-missing-ui.js:166`  
   Verification only runs when the screen path exists and is a regular file. Otherwise no issue is recorded. `{screens:[{path:"ui/missing.html",sha:"fake"}]}` passes, allowing automation without a prototype. Directory paths also pass.

2. **Major — Architecture references can bypass validation.**  
   `scripts/find-missing-ui.js:116`  
   Empty or non-string references are silently ignored. When both aliases exist, only `architectureSha` is checked: a matching `architectureSha` plus a mismatched `cardSha` passes. Every supplied reference must be validated, including conflicting aliases.

3. **Major — Unverifiable architecture references are accepted.**  
   `scripts/find-missing-ui.js:124`  
   A missing architecture card skips comparison; malformed JSON is silently swallowed. Both cases pass with `architectureSha:"wrong"`. The separate architecture detector protects the automate entry point, but invoking `find-missing-ui.js --strict` directly incorrectly reports success.

4. **Major — Keyword matching does not reliably identify UI scope.**  
   `scripts/find-missing-ui.js:58`  
   A plan saying `Implement PdfViewer.tsx and RichTextEditor.tsx` accepts `none:true`, because the keywords require word boundaries. Conversely, a backend plan explicitly listing `Vue, sheet, viewer, editor` as out of scope is rejected. This both permits missing prototypes and blocks legitimate no-UI declarations.

These behaviors were reproduced using the detector with in-memory filesystem fixtures. The filesystem is read-only; the disk-writing test suite was not run.
