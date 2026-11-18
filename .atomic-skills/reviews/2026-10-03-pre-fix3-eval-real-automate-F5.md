# Phase evaluation — real-automate F5

planSlug: real-automate
phaseId: F5
verdict: fail
reviewedHead: 0ca408865b661f4b0a3556688319e70b163dd641
productRepairCommit: 7b7205f4d8cfab6029b28d93b74633878cbd823d
assessmentDate: 2026-10-03
reportPath: .atomic-skills/reviews/eval-real-automate-F5.md

## Assessment authority and evidence

Independent evaluation under `skills/shared/implement-phase-evaluator.md`. Read the actual merged tree, F5 initiative, parent F5 descriptor and complete businessIntent, final merged claim report, ratified graph, and prior F4 accepted residuals. At initial evaluation all three task statuses were `done`, with merged-tree verifier evidence. The root subsequently announced reopening T-002/T-003 for the two independently reproduced findings below. This report does not mutate task state or stamp gates.

The phase cannot receive evaluation pass while these material regressions remain unresolved. Passing tests and actual PR existence do not remove them. F4 H1–H9 are outside F5 scope and remain their original accepted residuals; they were not reopened or given new dispositions here.

## Findings

| ID | Severity | Area | Path | Summary and reproduction |
|---|---|---|---|---|
| E-F5-001 | major | businessIntent | scripts/lib/serve-flow.js:127 | A missing admitted UI screen makes the controlled stop inaccessible. The `/final` route calls `validationSnapshot` before rendering pendingStop; the missing screen throws at `src/plan-end-review.js:464`. Independent temp fixture with `ui/ui.json` referencing `ui/not-created.html`: `runPlanEndWorkflow` returns reason `não avanço` and `/final?stop=...` on the same HTTP origin, but GET that exact URL returns 409 with ENOENT. No stop-confirm form is available. This violates the stop/confirmation/resume workflow. The existing test at `tests/automate-run-stops.test.js:214` fetches the flow preview URL instead of the returned stop URL, so its pass does not prove the stop page. |
| E-F5-002 | major | goal | src/plan-end-review.js:544 | `productSnapshot` enumerates every `git ls-files` path and reads each as a file without handling gitlink mode 160000. An initialized tracked submodule is a directory; independent git fixture with a valid gitlink and materialized directory reproduces `EISDIR: illegal operation on a directory, read`. Consequently normal review/validation identity cannot be computed for this supported repository shape, so publication/validation stop before completion. Evidence was reproduced through actual git update-index and the exported productSnapshot, without product edits. |
| E-F5-N1 | note | scope | .atomic-skills/reviews/audit-delivery-real-automate-F4.md | Whole-graph coverage remains partial because F4 automatic phase review/close/advance and its original H1–H9 acceptance are outside F5. No claim of a complete autonomous phase driver is made. |
| E-F5-N2 | note | other | /tmp/real-automate-F5-settled-full-suite.log | The full suite is not green: 28 failures. Exact failing-name comparison with `/tmp/real-automate-baseline-tests.log` found the identical 28 names, no added failures and no resolved failures. They are recorded as existing baseline failures, not hidden passes. |

Major findings require repair or an explicit recorded disposition before phase-done. The root selected repair and is dispatching the isolated writer. No evaluator pass is authorized by this report.

## businessIntentCheck

| Field | Status | Assessment |
|---|---|---|
| value | fail | The final HTTP page, said/saw, stamped architecture, delivered screen references and out-of-scope findings are implemented and tested. The gitlink directory error prevents delivery/validation identity on initialized submodule repositories; a missing prototype asset prevents even opening the error stop page. |
| workflow | fail | Normal HTTP stop confirmation and resume, flow preview preservation, authenticated timestamp rejection, and whole-plan then audit loops pass tests. E-F5-001 prevents the promised confirmation/resume path exactly when missing presentation evidence triggers a controlled stop. |
| rules | pass | Session ISO/chat ok cannot mint authenticated validation. Button requires every phase audit passed and current reviewed inputs. Publication code has no merge/archive action. Ratified graph remains the audit source of truth. No real operator validation is fabricated. |
| outOfScope | pass | PR merge, archive during PR command, multi-host queue and automate-phase-run substitution were not introduced. F3 milestone tests explicitly select the historical stop-after-merge behavior. F4 accepted findings were retained rather than reopened. |
| doneWhen | pass for explicit G-1 evidence; insufficient for phase evaluation pass | HTTP verifier is green, actual PR exists OPEN/unmerged, and the publication command does not archive. Broader goal/workflow regressions still require repair. |

## exitGates

| ID | Status | Evidence |
|---|---|---|
| G-1 | pass | `node --test tests/final-page-http.test.js` is included in the independently executed 70-test batch and passes all its cases. Actual PR evidence `/tmp/real-automate-pr-evidence.json`, read by evaluator: https://github.com/henryavila/atomic-skills/pull/50, number 50, state OPEN, isDraft true, mergedAt null, head `plan/real-automate`, base `develop`. Independent executable integration passes and checks PR command log has no merge/archive operation and published commit equals HEAD. Actual whole-plan archive was not performed; the plan remains active. Gate metadata remains orchestrator-owned. |

PR existence is based on actual repository evidence, separate from the fake-CLI tests. The root created the real PR; the evaluator did not publish it. The writer claim report correctly states the writer itself did not publish or validate.

## Verifications run by evaluator

1. `node --test tests/final-page-reader.test.js tests/final-page-http.test.js tests/automate-run-stops.test.js` — exit 0; 70 tests, 70 pass, 0 fail. This is genuine merged-tree verification, but E-F5-001 demonstrates a missing assertion in a green stop fixture.
2. `node --test --test-name-pattern='production plan-end command' tests/automate-run-writer.test.js` — exit 0; 1 test, 1 pass, 0 fail. Uses actual executable, real subprocess fake CLIs, temporary bare remote, same-origin page, resumed invocation, retained phase findings, source freshness and unmerged PR command behavior. It does not substitute for actual PR readback.
3. Flow subject/hash check — seven subjects (`corrida`, `gates`, `review_fase`, `mais_fases`, `review_plano`, `review_audit`, `validacao`); `flowDocumentSha` matches ratifiedGraphSha `8210bfc367f08e285b279b7dc69716d91df665281ffc2af1eebc1be619761285`.
4. Independent temporary fixture reproducer — missing UI screen: returned stop URL GET 409 ENOENT; initialized gitlink: productSnapshot throws EISDIR. Temporary fixture removed after execution.
5. Exact baseline/current failing-test-name comparison — baseline 28, current 28, new [], resolved []. Settled focused evidence supplied by root: 350 pass/0 fail. Full suite: 3686 tests, 3648 pass, 28 fail; baseline 3612 tests, 3573 pass, 28 fail. No full-suite success claim.
6. `git diff 8b843c25 HEAD -- scripts src tests skills` — empty at reviewed HEAD; the root's latest checkpoint changed operational metadata only.

## Delivery and remaining closure work

The associated `.atomic-skills/reviews/audit-delivery-real-automate-F5.md` reports whole-graph PARTIAL coverage and records the original accepted F4 residuals. Its coverage does not convert either new F5 finding into a pass. Re-run the affected verifiers and independent evaluation after the isolated repair is merged. Only the orchestrator may stamp evaluationGate, close the phase or process dispositions. Plan-end external review and genuine operator HTTP validation remain subsequent requirements; this report does not validate, finalize or archive.
