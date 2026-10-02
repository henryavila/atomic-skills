# evaluationReport
planSlug: real-automate
phaseId: F4
verdict: fail
evaluatedAt: 2026-10-02T17:07:41Z
HEAD: 17af758411ac69cefe8b2c5931acb6e874781440
scope: F4 Review e o flow no audit after merge b2b50754 (3974ee76 T-001, 3df2f38f T-002, 8aa3017a T-003) and checkpoint 17af7584
verifier: node --test tests/phase-review-gate.test.js → tests 44 / pass 44 / fail 0 / exit 0
alsoRan: node --test tests/phase-delivery-audit-gate.test.js → tests 44 / pass 44 / fail 0 / exit 0
alsoRan: node --test tests/automate-product-fence.test.js → tests 12 / pass 12 / fail 0 / exit 0
keepGreen: node --test tests/automate-run-writer.test.js → tests 22 / pass 22 / fail 0 / exit 0
keepGreen: node --test tests/automate-host-pen.test.js → tests 34 / pass 34 / fail 0 / exit 0
independentRun: schema reviewExternalCli enum claude|codex|grok; overrideReason without stderr fails; `- internal:` receipt fails; xor D1 missing report line fails; mix finding enterLoop=false; PHASE_REVIEW_CAP=3; phaseCloseFenceOk requires claim + fence
remainingBlockerCriticalMajor: 1 major (deliveryAuditAllowsClose / canRunPhaseDone do not load flow/flow.json)
orchestratorPaste: |
  node --test tests/phase-review-gate.test.js
  ℹ tests 44 ℹ pass 44 ℹ fail 0  EXIT 0
  node --test tests/phase-delivery-audit-gate.test.js
  ℹ tests 44 ℹ pass 44 ℹ fail 0  EXIT 0
  node --test tests/automate-product-fence.test.js
  ℹ tests 12 ℹ pass 12 ℹ fail 0  EXIT 0
  node --test tests/automate-run-writer.test.js
  ℹ tests 22 ℹ pass 22 ℹ fail 0  EXIT 0
  node --test tests/automate-host-pen.test.js
  ℹ tests 34 ℹ pass 34 ℹ fail 0  EXIT 0

## findings
- severity: major
  area: businessIntent
  path: src/phase-delivery-audit-gate.js:661-686
  gateId: G-1
  summary: `deliveryAuditAllowsClose` runs `deliveryAuditGraphCoverage` only when the caller already passed `flowDoc`, `flowPath`, or `ratifiedGraphSha` (`hasGraphInput`). `canRunPhaseDone` (`src/automate-orchestrator-gates.js:482-486`) and `assert-automate-gate` (`scripts/assert-automate-gate.js:1096-1111`) and `checkPhaseDoneDeliveryAudit` (`scripts/lifecycle-order-guard.js:554-558`) pass the stamp/gate only. Independent 2026-10-02T17:07:41Z: `deliveryAuditGraphCoverage` with XOR_FLOW and a report that has `machine request: faz` and no `xor D1` returns ok=false. The same honest CLOSED stamp without those graph fields still allows close. F4 goal extends the gate that closes the phase so it reads `flow/flow.json` at `ratifiedGraphSha`; the helper exists (`:547-632`) and the fixture test passes; the production close path does not load the cited graph.

- severity: note
  area: workflow
  path: scripts/automate-run.js:673,770-807
  summary: After a successful writer merge, `main` writes `implement --automate: merged; stopping` (`:673`) then `process.exit(code)` (`:807`). `runPhaseReviewBoth` runs only when `AUTOMATE_REVIEW_SPAWN === '1'` (`:773`). `continuePhaseAfterReview` runs only when `AUTOMATE_REVIEW_FINDINGS` is set (`:783-805`). `validatePhaseClose` (`:575-576`) is exported and is not called from `main`. Keep-green `tests/automate-run-writer.test.js` still asserts no phase-done and no second phase. Loop/close predicates live in `src/phase-review-gate.js` and `src/automate-product-fence.js` and pass their suites.

- severity: note
  area: workflow
  path: scripts/automate-run.js:514-548,764-768
  summary: `prepareReviewExternalCli` in `main` is called with `{ planPath, host, env }` and no `ask`. Missing plan field and missing `AUTOMATE_REVIEW_EXTERNAL_CLI` returns `ok: false` with `reviewExternalCli missing; ask once before the first phase` (`src/phase-review-gate.js:189-194`) and does not `process.exit`. Writer still starts. Tests inject `ask` and env (`tests/phase-review-gate.test.js:320-364,481-515`).

- severity: note
  area: other
  path: src/phase-review-gate.js:126-133
  summary: Comment on `readPlanReviewExternalCli` says size-capped. The function regex-matches the full `planText` with no byte cap. `parseGraphCoverageLines` (`src/phase-delivery-audit-gate.js:505-512`) does cap at 256_000 and states it is not a CommonMark parser (L-F2-2). `scripts/automate-run.js` is 825 lines; `src/phase-review-gate.js` 1040; `src/phase-delivery-audit-gate.js` 765.

- severity: note
  area: other
  path: src/phase-delivery-audit-gate.js:548-558
  summary: L-F2-1 missing cited `flow/flow.json` fails when `exists` is injected and returns false (suite `refuses a missing cited flow/flow.json path`). Empty `flowDoc` without `readFile` fails closed (`:573-577`). Path-escape of `flowPath` is not checked.

- severity: note
  area: scope
  path: scripts/automate-run.js:1-11,594-689
  summary: Program remains `node scripts/automate-run.js`. Source has zero `automate-phase-run` matches. F3 writer/merge/`pen.lock` path is unchanged (keep-green 22/22 and 34/34). F5 initiative is still `f5-pagina-final.source.json` (no `f5-pagina-final.md`). `automate-run.js` has no `userValidatedAt`, no `serve-flow --up`, no PR open, no archive.

## businessIntentCheck
value: pass
  note: Receipt fields command/exit/stderr/verdict are formatted and parsed (`src/phase-review-gate.js:259-265,282-335`). `reviewExternalCli` enum is on the plan schema (`meta/schemas/plan.schema.json:87-94`). Loop cap is 3 (`PHASE_REVIEW_CAP` `:409`); mix stops with `enterLoop: false` (`:496-503`); remaining non-critical/major findings park at `.atomic-skills/status/automate/<slug>.json` (`:467-472,521-528`); phase close predicate is claim + fence (`src/automate-product-fence.js:165-182`, `scripts/automate-run.js:575-576`). Graph helper lists machines and xor (`src/phase-delivery-audit-gate.js:459-498`) with `faz|pela metade|não faz` (`:446-450`). Independent suites 44/44, 44/44, 12/12.

workflow: fail
  note: `prepareReviewExternalCli` / `runPhaseReviewBoth` / `continuePhaseAfterReview` / `validatePhaseClose` exist on `scripts/automate-run.js:514-576,579-592`. `src/phase-review-gate.js` refuses `overrideReason` without process stderr (`:354-376`, wired in `phaseReviewHonesty` `:894-899`) and refuses a session `- internal:` line (`:294-305`). Isolated-fix dispatch is `nextPhaseReviewAction` `dispatch: 'isolated-fix'` (`:514-518`). `deliveryAuditGraphCoverage` reads the graph when given a doc/path/sha (`src/phase-delivery-audit-gate.js:547-632`); `skills/core/audit-delivery.md:90` states the HARD graph rule. Fail: the close callers of `deliveryAuditAllowsClose` do not pass `flow/flow.json` / `ratifiedGraphSha`, so the gate that closes the phase still skips graph coverage unless the caller already injected it (`:661-686`).

rules: pass
  note: Stored `reviewExternalCli` does not re-ask (`resolveReviewExternalCli` `:175-187`; suite asks stay at 1). `- internal:` is not a receipt (`parseExternalReviewReceipt` `:301-305`). Missing verdict does not count (`:331-332`). Non-zero exit stores real stderr (`runExternalReviewCli` `:569-582`; suite stderr `provider exploded: quota`). Brief includes ratified graph and chosen sketch (`buildPhaseReviewBrief` `:390-406`). Complex tasks enter the same brief (`:397-403`). Mix of the stamped block stops immediately (`isArchitectureMixFinding` `:419-437`, `nextPhaseReviewAction` `:496-503`; `runPhaseReviewLoop` does not call `spawnFixAgent`). Graph wins vs BI disagreement (`deliveryAuditGraphCoverage` `:621-628` appends `where businessIntent disagrees with the graph, the graph wins`). Final page does not substitute (`:616-620`).

outOfScope: pass
  note: No F5 page, `userValidatedAt` button, PR, or archive in `scripts/automate-run.js`. F5 remains descriptor-only `.atomic-skills/projects/atomic-skills/real-automate/phases/f5-pagina-final.source.json`. F3 writer/merge not replaced; keep-green writer 22/22 and pen 34/34. Zero `automate-phase-run` references in `scripts/automate-run.js`. No queue / multi-host spawn adapter (P9).

doneWhen: pass
  note: Independent `node --test tests/phase-review-gate.test.js` 44/44 exit 0 at HEAD `17af758411ac69cefe8b2c5931acb6e874781440`. Named tests: `overrideReason without stderr of that external CLI process fails`; `a receipt written by the session / - internal: line fails`; `on the third review, critical or major stops`; `a mix finding of the stamped block stops immediately and does not enter the loop`; `without critical or major, remaining findings go to status/automate/<slug>.json, the phase closes, and the next opens`. Independent `node --test tests/phase-delivery-audit-gate.test.js` 44/44: `a flow.json fixture with one xor and a report missing that line fails`. Independent `node --test tests/automate-product-fence.test.js` 12/12: `phase close validates the claim and passes the product fence`.

## exitGates
- id: G-1
  status: pass
  note: `node --test tests/phase-review-gate.test.js` verde (44 pass, 0 fail) at HEAD `17af758411ac69cefe8b2c5931acb6e874781440`. Covers schema enum (`tests/phase-review-gate.test.js:299-305`); ask-once (`:320-364`); receipt command/exit/stderr/verdict (`:368-382`); session `- internal:` (`:384-396`); no verdict (`:398-404`); non-zero stderr (`:406-423`); overrideReason without stderr (`:425-457`); spawn+wait (`:459-477`); automate-run wiring (`:480-535`); loop cap 3 (`:544-560`); park+close+advance (`:562-577`); third-review travei (`:579-588`); mix stop (`:590-606`); claim via `validatePhaseClose` (`:608-636`); brief graph+sketch+complex (`:680-700`). Independent audit suite 44/44 including xor-without-line and L-F2-1 missing `flow/flow.json`. Independent fence 12/12. Keep-green writer 22/22 and pen 34/34. G-1 command itself is green; the major finding is the production close path of T-002 not loading the graph, not this verifier command.

## independentConfirmations
- `node --test tests/phase-review-gate.test.js`: tests 44 / pass 44 / fail 0 / exit 0
- `node --test tests/phase-delivery-audit-gate.test.js`: tests 44 / pass 44 / fail 0 / exit 0
- `node --test tests/automate-product-fence.test.js`: tests 12 / pass 12 / fail 0 / exit 0
- `node --test tests/automate-run-writer.test.js`: tests 22 / pass 22 / fail 0 / exit 0
- `node --test tests/automate-host-pen.test.js`: tests 34 / pass 34 / fail 0 / exit 0
- `meta/schemas/plan.schema.json:87-94`: `reviewExternalCli` type string enum `claude|codex|grok`
- `src/phase-review-gate.js:77`: `REVIEW_EXTERNAL_CLIS = ['claude','codex','grok']`; same-family refused (`:116-120`, host `claude-code` maps to `claude` `:81-86`)
- `resolveReviewExternalCli` (`:174-209`): stored field returns `asked: false`; missing field without `ask` fails; with `ask` writes via `upsertPlanReviewExternalCli` (`:142-156`)
- `parseExternalReviewReceipt` (`:282-335`): skips `internal` / `ground-truth` / `cross-model`; only `- internal:` → reason `session-written - internal: line is not an external CLI receipt`; missing `verdict=` → `output without a verdict does not count`
- `externalReviewReceiptHonesty` (`:354-376`): non-empty `overrideReason` with empty `externalStderr`/`stderr` fails with `overrideReason without stderr of that external CLI process fails`; `phaseReviewHonesty` local path calls it (`:894-899`)
- `runExternalReviewCli` (`:566-589`): `spawn(cli, argv)` then stores `exit`, raw `stderr`, `verdict` from stdout/stderr, `receipt` via `formatExternalReviewReceipt` (`:259-265`)
- `buildPhaseReviewBrief` (`:390-406`): sections `Ratified flow graph`, `Chosen architecture sketch`, optional `Complex tasks (same review before phase close)`
- `PHASE_REVIEW_CAP` (`:409`) is 3; round >= 3 + critical/major → `action: 'stop'`, `reason: 'travei'`, `openNext: false` (`:506-512`)
- mix: `stampedBlockMix` / `kind|axis === 'mix'` / text `mistura do bloco|mix of the stamped block` → `action: 'stop'`, `enterLoop: false` (`:419-437,496-503`); `runPhaseReviewLoop` does not call `spawnFixAgent`
- `parkResidualFindings` (`:467-472`) path `.atomic-skills/status/automate/${slug}.json`; `close-and-advance` writes that file when `writeStatus` is injected (`:546-554`)
- `scripts/automate-run.js:579-592`: `runPhaseReviewBoth` builds the brief and default-spawns with `input: brief`; `continuePhaseAfterReview` (`:567-568`) is `runPhaseReviewLoop`
- `phaseCloseFenceOk` (`src/automate-product-fence.js:165-182`): invalid claim → ok false; uncovered product path → ok false; covered claim path → ok true
- `graphCoverageSubjects` (`src/phase-delivery-audit-gate.js:459-498`): one subject per `machines[].id` and per `graph.nodes` / subgraphs with `type === 'xor'`
- `parseGraphCoverageLines` (`:505-526`): size-capped 256_000; regex `machine|xor <id>: faz|pela metade|não faz`
- `deliveryAuditGraphCoverage` (`:547-632`): missing cited path with `exists===false` fails (L-F2-1); divergent sha fails (`:591-595`); missing xor line fails (`:615-629`); BI disagreement appends graph-wins (`:621-624`); `finalPage` / `userValidatedAt` appends final-page does not substitute (`:616-620`)
- `skills/core/audit-delivery.md:90`: HARD paragraph to read `flow/flow.json` at `ratifiedGraphSha`, one line per machine and xor, graph wins, missing line fails, final page does not substitute, missing cited path is an issue
- `scripts/automate-run.js`: `automate-phase-run` absent; `userValidatedAt` absent; F3 `runWriterSession` still present (`:594-689`)
- repo phases: `f4-review-e-o-flow-no-audit.md` present; `f5-pagina-final.md` absent; `f5-pagina-final.source.json` descriptor-only
- L-F2-2 size: `parseGraphCoverageLines` capped; F4 merge `b2b50754` +1538/-4 across 9 files, not a 2k-line CommonMark parser
- claims file `.atomic-skills/status/automate/real-automate-claims.json`: T-001 `3974ee76`, T-002 `3df2f38f`, T-003 `8aa3017a`; those SHAs are ancestors of merge `b2b50754` and HEAD `17af7584`
