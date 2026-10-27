# evaluationReport
planSlug: real-automate
phaseId: F0
verdict: pass
evaluatedAt: 2026-09-25T21:54:06Z
HEAD: aa90148d94c39f7cbf0d3b591f24587b34bfe120
scope: F0 after review-fix merge 3eea2170 (2db646fc, ec821c98, 5b8c0735)
verifier: node --test tests/automate-host-pen.test.js → tests 21 / pass 21 / fail 0 / exit 0
independentRun: node scripts/automate-run.js --host codex --plan <tmp fixture plan.md> --root <tmp> → exit 1

## findings
- severity: note
  area: other
  path: src/automate-host-pen.js:213-215
  summary: assessPenRegistration still throws TypeError on PreToolUse [null, …] (entry.hooks). Local review F8. automate-run main has no try/catch around that call. Null config is not a listed write allow; it is an uncaught throw instead of a blocker line.

- severity: note
  area: other
  path: src/automate-host-pen.js:175-197
  summary: resolvePenHookScript nested-default regex stops at the first `}`. Grok plugin command `bash "${GROK_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-$PWD}/.grok/plugins/atomic-skills}/_assets/hooks/automate-pen.sh"` expands to a non-existent path (`/tmp/wt/_assets/hooks/automate-pen.sh` without GROK_PLUGIN_ROOT; `/tmp/plugin/.grok/plugins/atomic-skills}/_assets/hooks/automate-pen.sh` with it). extractPenHookScriptToken still accepts the token, so registration can pass while runHostWriteProbe fail-closes. Codex/Claude setup command `${CLAUDE_PROJECT_DIR:-$PWD}/…/automate-pen.sh` expands. G-1 verifier is --host codex.

- severity: note
  area: exitGate
  path: scripts/automate-run.js:235-240
  summary: G-1 "escrita real do host ativo" is runHostWriteProbe. Child reads host hooks.json, resolvePenHookScript, spawnSync('bash', [scriptPath]) argv (not bash -c). assessHostWrite requires invokedHook and refused and no sentinel. echo automate-pen.sh; exit 2 is rejected. This is not a Claude Write, Codex apply_patch, or Grok write invoked by the host runner. F0 does not spawn those CLIs.

- severity: note
  area: other
  path: .atomic-skills/projects/atomic-skills/real-automate/plan.md:468
  summary: Ground-truth premise 15 still states find-unreviewed-plans.js has no --require-external and automate-run.js calls the detector without the flag. HEAD has the flag (scripts/find-unreviewed-plans.js:192) and startup passes it (scripts/automate-run.js:353). Stale plan text, not a product miss.

- severity: note
  area: scope
  path: tests/install.test.js:509-511
  summary: install.test.js hook allowlist is still session-start.sh|stop.sh|pre-write.sh|config.json. It does not name automate-pen.sh. Recursive hooks install still copies the file. Local review F10 item (4) remains test coverage, not a missing hook file.

## businessIntentCheck
value: pass
  note: node scripts/automate-run.js is the program. On a fixture plan.md without flow it exits 1 and prints the refusal list (pen registration, host-write proof, flow, external review, ground truth, missing architecture and UI detectors). It does not write product and does not spawn a writer.

workflow: pass
  note: parseArgs requires --host claude-code|codex|grok and --plan. runSyntheticProbe writes an isolated AUTOMATE_PROBE_LOCK under mkdtemp (not repo pen.lock), requires automate-pen.sh exit 2 then 0, deletes that probe. runHostWriteProbe requires a refused write with no sentinel. Detectors run as find-missing-flow.js --strict, find-unreviewed-plans.js --require-external, find-plans-missing-ground-truth.js, plus existence checks for find-missing-architecture.js and find-missing-ui.js. `--require-external` exits 1 on `- internal:` only, on exit≠0, and on verdict=needs_changes. Any failure prints the list and exits 1. Main never writes pen.lock. After gates, the process writes "writer spawn is not in this build" and exits 2; it does not call automate-phase-run.js.

rules: pass
  note: AUTOMATE_HOSTS is only claude-code, codex, grok. decidePen without lockHeld does not deny. With lock, unknown tools and reads deny (fail-closed; no read allowlist). NotebookEdit is a listed Claude write tool: no path → deny; out-of-tree → deny; in-tree path → allow. Shells Bash/shell/run_terminal_command deny including case variants. pathInsideWorktree rejects `..`, filesystem root `/`, and sibling prefix `/tmp/wt-evil`. Missing AUTOMATE_PEN_LOCK file falls through to on-disk pen.lock / probe.lock; real pen.lock + AUTOMATE_PEN_LOCK=/no/such/file → hook exit 2. automate-pen.sh has no SKIP / SKIP-EMERGENT branch. pre-write.sh remains registered beside the pen. stop.sh was not edited.

outOfScope: pass
  note: scripts/find-missing-architecture.js and scripts/find-missing-ui.js are absent. No architecture/decisions.json detector, no ui/ui.json detector, no writer spawn, no merge, no review-both loop, no flow audit, no F5 page. F1–F5 remain descriptor-only `.source.json` sidecars. git log d62083df^..HEAD does not touch pre-write.sh, stop.sh, or skills/core/implement.md. pre-write.sh matcher in skills-file-set.js:211 and project-setup.md:79 remains Edit|Write|MultiEdit|search_replace|write (byte-identical to d62083df^).

doneWhen: pass
  note: node --test tests/automate-host-pen.test.js exits 0 (21/21). Hook without lock exits 0; isolated probe.lock makes a write payload exit 2 and does not create pen.lock. Host-shaped write with registered pen is refused and leaves no host-write-sentinel. Independent run 2026-09-25T21:54:06Z: node scripts/automate-run.js --host codex --plan <tmp fixture> --root <tmp> exit 1; stderr contains automate-pen.sh and find-missing-architecture.js; no leftover pen.lock or probe.lock.

## exitGates
- id: G-1
  status: pass
  note: Verifier green (21 pass, 0 fail). Isolated probe.lock → hook exit 2 on apply_patch payload; missing lock → exit 0. assessHostWrite ok only when invokedHook and refused are true and sentinelCreated is false. Fixture startup exit 1 cites automate-pen.sh (.codex/hooks.json missing) and missing detector scripts/find-missing-architecture.js. Review-fix confirmations on HEAD aa90148d: pathInsideWorktree rejects `..` and `/`; decidePen fail-closed on unknown tools; NotebookEdit denied without path; missing AUTOMATE_PEN_LOCK falls through and does not disable pen.lock; --require-external rejects exit≠0 and non-pass verdicts; host probe spawnSync('bash', [scriptPath]) argv not bash -c; parseApplyPatchPaths reads *** Update/Add/Delete/Move to and mixed out-of-tree hunks deny; F1–F5 product files not added; pre-write matcher unchanged.

## reviewFixConfirmations
- tests/automate-host-pen.test.js: 21 pass / 0 fail
- pathInsideWorktree('/tmp/wt/../secret.js', '/tmp/wt') === false; pathInsideWorktree('/etc/passwd', '/') === false
- decidePen({ lockHeld: true, toolName: 'read_file'|'Read'|'grep'|'FooWrite'|'' }).deny === true
- decidePen({ lockHeld: true, toolName: 'NotebookEdit' }).deny === true; in-tree NotebookEdit with filePath is listed-write allow
- AUTOMATE_PEN_LOCK=/no/such/file with on-disk pen.lock → automate-pen.sh exit 2
- isExternalCliReceiptLine rejects exit=127 and verdict=needs_changes; CLEAN/PASSED/ok with exit=0 pass
- extractPenHookScriptToken('bash -c "echo automate-pen.sh; exit 2"') === null; runHostWriteProbe on that command is not ok
- parseApplyPatchPaths + decidePen deny /etc/passwd and mixed in-tree+/etc hunks
- automate-run fixture exit 1 cites automate-pen.sh and find-missing-architecture.js
- F1–F5 not implemented; pre-write matcher unchanged
