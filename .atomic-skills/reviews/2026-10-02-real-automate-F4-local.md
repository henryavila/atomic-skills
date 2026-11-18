# Local adversarial review — real-automate F4

Scope: modified product files in the F4 captured range. Substance only. No reviewGate stamp.

---

## Findings

### 1. critical — `src/phase-delivery-audit-gate.js:605-654`

**WHAT:** `deliveryAuditGraphCoverage` treats a divergent `ratifiedGraphSha` as equal whenever hashing fails or is skipped, then allows close when the parsed document has zero machines and zero xor nodes.

**WHY:** After load, `actual` is set as follows (`:602-613`): injected `actualSha` wins; else if the doc was read from disk, `flowDocumentSha(flowDoc)` runs inside `try/catch` and on throw `actual = expected`; else (injected `flowDoc`) `actual = expected`. `flowDocumentSha` → `normalizeFlow` → `assertValidFlow`, which throws on schema-invalid JSON. The comparison at `:614` then sees equal strings. Coverage (`:621-654`) iterates `graphCoverageSubjects`; an empty subject list yields `missing.length === 0` and `{ ok: true }`.

**IMPACT:** Production `assert-automate-gate --gate phase-done` (`scripts/assert-automate-gate.js:1059-1135`) passes `planPath` + `readFile` and does **not** pass `actualSha`. A parseable but schema-invalid `flow/flow.json` such as `{ "ratifiedGraphSha": "<anything>", "graph": { "nodes": {} }, "machines": [] }` hashes-throw, SHA-matches by construction, has no subjects, and allows phase-done under automate with an honest CLOSED stamp. That replaces the ratified graph. Contrast `scripts/find-missing-flow.js:183-188`, which records `L1 document sha failed` on the same throw. Tests do not catch this: `tests/phase-delivery-audit-gate.test.js:427-436` injects `actualSha`; allow fixtures (`tests/lifecycle-order-guard.test.js:442-448`, `tests/fixtures/implement-phase-agents/phase-done-allowed.json:55-56`) also inject matching `actualSha`.

**RECOMMENDATION:** Fail closed when `flowDocumentSha` throws. When `flowDoc` is present and `actualSha` is omitted, still hash the document (or require a caller-supplied expected sha from the ratification stamp, not from the file under test). Treat `subjects.length === 0` as missing coverage unless the hashed document is schema-valid and the schema permits a machine-less/xor-less graph.

---

### 2. critical — `src/phase-review-gate.js:467-472` and `scripts/automate-run.js:792-800`

**WHAT:** Parking residual findings overwrites the automate cursor file `.atomic-skills/status/automate/<slug>.json` with `{ remainingFindings }` only.

**WHY:** `parkResidualFindings` (`:467-472`) returns that path. `runPhaseReviewLoop` (`:547-550`) calls `writeStatus(decision.parkPath, { remainingFindings })`. `main` (`scripts/automate-run.js:796-800`) implements `writeStatus` as `writeFileSync` of that JSON with no read-merge. The same path is the durable cursor (`step`, `phaseId`, `redispatchCount`, `operatorOverrides`, `claimReportPath`).

**IMPACT:** When `AUTOMATE_REVIEW_FINDINGS` is set (the F4 loop hook), any non-stop decision — including minors → `close-and-advance` — destroys orchestrator state. Subsequent maestro steps see a cursor that is only a findings dump. Combined with finding 4, invalid JSON also takes this path.

**RECOMMENDATION:** Park to a distinct file (e.g. `<slug>-residuals.json`) or merge into the existing cursor under a dedicated key. Never replace the cursor document.

---

### 3. major — `scripts/automate-run.js:773-781`, `447-459`, `579-591`

**WHAT:** The production external-review spawn does not pass the ratified graph or architecture sketch, uses writer argv when review argv is unset, and ignores CLI exit/verdict.

**WHY:** `main` calls `runPhaseReviewBoth({ cli, argv: hostArgv({ hostArgs: process.env.AUTOMATE_REVIEW_ARGS }, process.env) })` with no `flowGraph` / `architectureSketch` / `complexTasks`. `buildPhaseReviewBrief` (`src/phase-review-gate.js:390-406`) then stringifies `{}`. `hostArgv` (`:447-448`) falls back to `AUTOMATE_HOST_ARGS` (writer args). An empty array is still an array, so `runPhaseReviewBoth` (`:585`) does not apply the default `['review']`. After spawn, `main` writes `ran.receipt` if present and does not inspect `ran.exit` or `ran.verdict`.

**IMPACT:** `AUTOMATE_REVIEW_SPAWN=1` launches the family-different CLI with an empty brief (no graph, no sketch, no complex tasks), possibly with writer flags or with zero argv, and a failed or empty-verdict process still continues to merge-success `process.exit(code)`.

**RECOMMENDATION:** Load the cited `flow/flow.json` and architecture card into the brief. Default review argv independently of `AUTOMATE_HOST_ARGS`. Fail the process (or refuse the receipt) when exit ≠ 0 or verdict is missing.

---

### 4. major — `scripts/automate-run.js:783-807` and `src/phase-review-gate.js:505-518`

**WHAT:** The 3-review loop on the production path does not dispatch isolated-fix, does not run the claim/product fence, and treats invalid findings JSON as “no findings → close”.

**WHY:** `continuePhaseAfterReview` is `runPhaseReviewLoop` with only `writeStatus` injected — no `spawnFixAgent`, `closePhase`, or `openNext`. Critical/major with `round < 3` returns `action: 'fix-and-review'` (`:514-518`); `main` only `process.exit`s on `action === 'stop'`, so fix-and-review falls through to `process.exit(code)` (`:807`) with the writer merge code (0). `validatePhaseClose` (`scripts/automate-run.js:575-576`) is exported and never called from `main`. `JSON.parse` of `AUTOMATE_REVIEW_FINDINGS` (`:786-790`) on throw sets `findings = []`, which is `close-and-advance`.

**IMPACT:** Critical/major on rounds 1–2 exit 0 with no fix agent. Garbage env JSON parks empty residuals (finding 2) and exits 0 without claim validation or product fence. The loop cap and fence exist only as library tests.

**RECOMMENDATION:** On `fix-and-review`, spawn the isolated-fix agent or exit non-zero if spawn is unavailable. On `close-and-advance`, call `validatePhaseClose` before any park/advance. Invalid findings JSON must fail closed, not become `[]`.

---

### 5. major — `scripts/automate-run.js:514-548,764-768`

**WHAT:** `main` never asks for `reviewExternalCli` and does not refuse the run when it is missing.

**WHY:** `prepareReviewExternalCli` is invoked with `{ planPath, host, env }` and no `ask`. `resolveReviewExternalCli` (`src/phase-review-gate.js:189-194`) then returns `ok: false` / `reviewExternalCli missing; ask once before the first phase` unless the plan already has the field or `AUTOMATE_REVIEW_EXTERNAL_CLI` is set. `main` ignores `prepared.ok` and always starts `runWriterSession`.

**IMPACT:** The “ask once before the first phase and store on the plan” contract is not on the program entry. A plan without the field proceeds through writer/merge; external review never runs unless an env var was pre-set.

**RECOMMENDATION:** If the field is missing, ask once (or refuse with that reason) before spawn. Do not start the writer while `prepared.ok` is false.

---

### 6. major — `src/phase-review-gate.js:234-245`

**WHAT:** `extractVerdictToken` accepts a bare `PASS` / `CLEAN` / `PASSED` anywhere in CLI stdout/stderr.

**WHY:** After a `verdict:` line miss, `:242` runs `/\b(CLEAN|PASSED|PASS)\b/` on the entire buffer. `runExternalReviewCli` (`:574`) stores that token on the receipt via `formatExternalReviewReceipt`.

**IMPACT:** A failed CLI whose logs contain “PASS” or “CLEAN” (unrelated prose) is recorded as `verdict=PASSED`. `parseExternalReviewReceipt` then treats the receipt as ok. Combined with finding 3 (exit ignored), a broken external review counts as a real receipt.

**RECOMMENDATION:** Only accept an explicit `verdict:` assignment (or the formatted receipt fields). Do not scan the whole stream for those tokens.

---

### 7. major — `src/phase-review-gate.js:431-435`

**WHAT:** `isArchitectureMixFinding` interpolates `architectureCard.chosen` into `new RegExp` with no escaping.

**WHY:** `:433` is `` new RegExp(`\\bmix\\b.*${String(chosen)}`, 'i') ``. A chosen id with `(`, `*`, `[`, or similar throws `SyntaxError` (uncaught in `nextPhaseReviewAction` / `runPhaseReviewLoop`) or changes match meaning (`.*`).

**IMPACT:** A mix check on a sketch whose `chosen` is not a safe token crashes the review loop, or marks unrelated findings as mix and stops (`enterLoop: false`) without isolated-fix.

**RECOMMENDATION:** `RegExp.escape` (or a literal string includes-check) on `chosen`. Do not throw from the mix predicate.

---

### 8. major — `src/phase-review-gate.js:130-134`

**WHAT:** `readPlanReviewExternalCli` matches `reviewExternalCli:` on any line of the plan text, not the frontmatter, and is not size-capped.

**WHY:** `:132` is `/^reviewExternalCli:\s*["']?([A-Za-z0-9_-]+)/m` over the full string. The comment at `:126` says size-capped; there is no byte cap (unlike `parseGraphCoverageLines` at `src/phase-delivery-audit-gate.js:496-497`). `resolveReviewExternalCli` (`:175-178`) treats that hit as stored and does not ask. `upsertPlanReviewExternalCli` (`:145`) then no-ops if the same token already appears anywhere, so a body line is never promoted into YAML.

**IMPACT:** A session-written body line `- reviewExternalCli: grok` (or a fenced example) selects the external CLI and suppresses the once-ask. The schema field on the plan can remain absent.

**RECOMMENDATION:** Parse only the opening `---` frontmatter block, cap bytes, and require the schema field (not a body match) as the stored value.

---

## Counts

| severity | count |
|----------|------:|
| blocker  | 0 |
| critical | 2 |
| major    | 6 |
| minor    | 0 |

**total: 8**

No reviewGate stamp. No product source edits.
