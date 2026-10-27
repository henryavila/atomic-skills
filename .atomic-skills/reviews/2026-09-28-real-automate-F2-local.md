# F2 local adversarial review — UI prototype detector

**Ref:** F2 UI detector (`scripts/find-missing-ui.js`, `scripts/automate-run.js`, `tests/find-missing-ui.test.js`, `tests/automate-host-pen.test.js`)
**Mode:** local, adversarial. No fixes applied.
**Contract:** `projects/atomic-skills/real-automate/source.md` F2 T-001..T-003; P5 / “Protótipo” in `.ai/memory/decisao-unattended-bloco.md` and `plan.md`.
**Verdict:** needs_changes

**Counts:** blocker 0, critical 1, major 3, minor 3, note 1

| # | Severity | Finding |
|---|----------|---------|
| F-001 | critical | Missing screen prototype file is silently ignored; exit 0 with ok: true on nonexistent screen file. |
| F-002 | major | Architecture card SHA citation is optional in `ui/ui.json` and silently unverified when missing or when card is absent. |
| F-003 | major | Keyword detector only reads `plan.md` root, ignoring phase initiatives (`phases/*.md`) where tasks reside. |
| F-004 | major | UI surface keyword detector misses plural/inflected forms (`sheets`, `editors`, `viewers`, `spreadsheets`). |
| F-005 | minor | Path traversal allowed in `screens[].path` (no directory containment verification). |
| F-006 | minor | `--strict` flag is a no-op (`void opts;`). |
| F-007 | minor | Scanning a directory with zero plans reports "missing ui/ui.json" with exit 1 instead of appropriate empty report. |
| N-001 | note | `screens` path resolution does not protect against unhandled `statSync` errors on broken symlinks. |

---

## F-001 [critical] missing screen prototype file is silently ignored

- **File:** `scripts/find-missing-ui.js:164-177`

In `checkPlanUi()`, when validating each entry in `screens`:
```javascript
if (p) {
  const resolvedScreen = resolve(paths.planDir, p);
  if (existsSync(resolvedScreen) && statSync(resolvedScreen).isFile()) {
    try {
      const content = readFileSync(resolvedScreen, 'utf8');
      const actualSha = hashContent(content);
      if (s && s !== actualSha) {
        issues.push(`screen sha mismatch for ${p}: ${s} ≠ ${actualSha}`);
      }
    } catch (err) {
      issues.push(`cannot read screen file ${p}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
```

If `resolvedScreen` does NOT exist, `existsSync(resolvedScreen)` is `false`. The entire block is skipped without appending any issue to `issues`.
A plan specifying `{ screens: [{ path: "ui/nonexistent.html", sha: "dummy" }] }` returns `{ ok: true, issues: [] }` and exits 0. The detector completely fails to verify that the claimed prototype exists on disk.

---

## F-002 [major] architecture card SHA citation is optional and unverified when omitted

- **File:** `scripts/find-missing-ui.js:116-138`

The F2 goal specifies:
> "O carimbo da tela cita o sha do cartão."

And businessIntent rules state:
> "scripts/find-missing-ui.js lê esse arquivo, valida a ausência de toque em UI quando none: true, confere consistência com o sha do cartão (architecture/decisions.json) e sai 0 apenas com carimbo íntegro."

However, `find-missing-ui.js` only checks the architecture card if `architectureSha` (or `cardSha`) is present in `uiData`:
```javascript
const archSha = typeof uiData.architectureSha === 'string'
  ? uiData.architectureSha.trim()
  : typeof uiData.cardSha === 'string'
    ? uiData.cardSha.trim()
    : null;

if (archSha) { ... }
```
If omitted entirely from `ui/ui.json`, `archSha` is `null`, and no error is recorded. Furthermore, if `archSha` is provided but `architecture/decisions.json` does not exist, `if (existsSync(archPaths.card))` evaluates to `false`, silently skipping verification without error.

---

## F-003 [major] keyword detector only scans `plan.md` root, ignoring phase initiatives

- **File:** `scripts/find-missing-ui.js:78, 146`

The F2 requirement states:
> "“Sem tela” com task que toca Vue, sheet, viewer ou editor é recusado."

In Atomic Skills plans, individual tasks and their descriptions are materialized into phase initiatives (e.g. `phases/f2-prototipo.md`), while `plan.md` often only carries high-level phase goals and descriptors. `checkPlanUi` only reads `paths.planPath` (`plan.md`). A task touching Vue or an editor in an active phase initiative file will not be detected, allowing `none: true` to improperly pass.

---

## F-004 [major] UI surface keyword detector misses plural/inflected forms

- **File:** `scripts/find-missing-ui.js:33-35, 54-64`

The regex uses exact word boundaries on the singular tokens:
```javascript
export const UI_SURFACE_KEYWORDS = ['vue', 'sheet', 'viewer', 'editor'];
const UI_SURFACE_RE = /\b(vue|sheet|viewer|editor)\b/i;
```
Tasks specifying "bottom sheets", "markdown editors", "image viewers", or "spreadsheets" do not match `\bsheet\b` or `\beditor\b` because the trailing `s` is a word character. Thus `detectUiKeywords("implement sheets table")` returns `[]`, bypassing the UI touch gate.

---

## F-005 [minor] path traversal allowed in `screens[].path`

- **File:** `scripts/find-missing-ui.js:165`

`resolve(paths.planDir, p)` does not verify that the resolved path is contained within `paths.planDir` or a designated `ui/` directory. An entry with `path: "/etc/passwd"` or `path: "../../../package.json"` is accepted if the sha matches.

---

## F-006 [minor] `--strict` flag is a no-op

- **File:** `scripts/find-missing-ui.js:183`

`checkPlanUi(planMdPath, opts = {})` contains `void opts;`. The `--strict` flag passed by `automate-run.js` does not alter detector behavior or severity thresholds.

---

## F-007 [minor] empty directory check misreports "missing ui/ui.json"

- **File:** `scripts/find-missing-ui.js:258`

When scanning a directory containing no plans, `main()` prints `find-missing-ui.js: missing ui/ui.json` and exits 1, misrepresenting an empty directory as a missing UI stamp on a plan.

---

## N-001 [note] broken symlinks cause unhandled exceptions

- **File:** `scripts/find-missing-ui.js:166`

`statSync(resolvedScreen)` throws if `resolvedScreen` is a dangling symlink (without `throwIfNoEntry: false`), leading to process crashes instead of clean issue reporting.
