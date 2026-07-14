---
date: 2026-07-14T11:40:00-03:00
topic: integrity-remediation-f0-phase-a37e88c-r8
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..a37e88c95178172fb23e8e33d6f292274ec95dd8
skill: review-code
reviewer: gpt-5-codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 2, minor: 2, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
framing_delta: {dropped: 4, maintained: 0, emerged: 4}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F0 phase a37e88c r8

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..a37e88c95178172fb23e8e33d6f292274ec95dd8
- Captured diff: 5,088,427 bytes / 112,121 lines / 73 files
- SHA-256: 8acc36713f1665d22a1043fff4f6ad241023bd5045c5a0168301a285910654c7
- Patch id: 189cf261d192882222d42c37f4f7e4ffc6a1d681
- Mode: codex; model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id, four findings and mandatory fields validated.
- Pass 2: frontmatter, verdict, counts, reconciliation headers and four final findings validated.
- Reconciliation: four dropped, zero maintained, four emerged.

## Operator scope triage

- F-001 final major and F-003 final minor — dismissed for this phase. The cited renderer branch and its tests predate the captured base; host-specific tool profiles are explicitly owned by F2-G1.
- F-002 final major — not caused by the phase: the cited browser fallback and package-root installer contract both predate the captured base. The operational gap was nevertheless adopted as in-scope F0 runtime hardening and fixed at 160c9b2 together with the provisioner path.
- F-004 final minor — validated against the test hunk changed in F0. The shell-source scanner gap received a focused RED and was fixed at 160c9b2.
- Remaining substantive count after triage/remediation: zero blocker, zero critical, zero major, zero minor. The raw verdict remains historical; a fresh clean-checkpoint review is still required for phase approval.

## Remediation evidence

- RED: the focused shell-source test collected one test and failed with an empty offender list instead of the three fallback paths.
- GREEN: the focused test passed; the full skill-script-resolution file passed 64/64.
- Runtime regression: consumer-runtime-resolution, runtime-closure and project suites passed 82/82.
- Catalog validation: all 15 skills valid.

## Pass 1 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The diff still leaves four substantive regressions in the new runtime and state-management paths. The new consumer-path helper does not actually constrain paths to the consumer repository, task completion now hard-fails on any malformed dispatch-log line even when the bad line is unrelated to the task being closed, the PROJECT-STATUS writer still has a silent last-writer-wins window after its conflict check, and the aiDeck smoke verifier now exits successfully on partial refresh failures.

These are correctness issues, not style issues. They can mutate files outside the target repo, block or suppress completion telemetry for unrelated work, lose concurrent PROJECT-STATUS updates, and let automation report a green aiDeck contract check while serving stale derived state.

## Findings

### F-001 [major] path-traversal — src/runtime-paths.js:14-19

**Evidence:**
```js
/** Resolve a user-supplied path relative to the consuming repository. */
export function resolveConsumerPath(input, cwd = process.cwd()) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('consumer path must be a non-empty string')
  }
  return resolve(cwd, input)
}
```

**Claim:** `resolveConsumerPath` claims repo-relative resolution but accepts `../` escapes and absolute paths, and the new public entrypoints use it directly for file reads/writes.

**Impact:** `scripts/plan-dependencies.js` can write to any reachable `plan.md`, and `scripts/decompose-plan.js` / `scripts/bootstrap-project.js` can read arbitrary files outside the consuming repo, so a mistaken or malicious invocation is no longer confined to the project tree.

**Recommendation:** Reject absolute paths and any resolved path whose `relative(cwd, resolved)` escapes the consumer root, or split this into an explicitly unsafe helper plus a contained helper and use the contained variant in the installed entrypoints.

**Confidence:** high

---

### F-002 [major] error-handling — scripts/append-completion.js:251-258

**Evidence:**
```js
export function readDispatchActuals(root, { planSlug, phaseId, taskId } = {}) {
  if (!hasText(taskId)) return undefined;
  const path = join(resolve(root), '.atomic-skills', 'status', 'dispatch-log.json');
  if (!existsSync(path)) return undefined;
  const log = parseDispatchLog(readFileSync(path, 'utf8'), { source: path });
  const matching = log.filter((r) => (
    r.plan === planSlug && r.phase === phaseId && r.taskId === taskId
  ));
```

```js
if (entry && entry.event === 'task-done' && entry.actuals == null) {
  const derived = readDispatchActuals(root, {
    planSlug: entry.planSlug, phaseId: entry.phaseId, taskId: entry.taskId,
  });
  if (derived !== undefined) effectiveEntry = { ...entry, actuals: derived };
}
```

**Claim:** Every `task-done` append now reparses the entire dispatch log before filtering, so one malformed historical line for any task makes unrelated task completions throw.

**Impact:** A single corrupt `dispatch-log.json` entry can block future `appendCompletion` calls for all tasks, which can abort `done`/`phase-done` flows or leave telemetry missing for otherwise valid work.

**Recommendation:** Fail open at the `appendCompletion` call site by catching dispatch-log parse errors and omitting derived actuals with a warning, or restructure the reader so unrelated malformed records do not block completion for other tasks.

**Confidence:** high

---

### F-003 [major] race-condition — scripts/refresh-state.js:159-164

**Evidence:**
```js
// Optimistic conflict check for updates made since the snapshot read. This
// is intentionally not a complete cross-writer CAS: F-001 defers authority
// over the final check→rename window to the shared-writer work in F4.
if (readFileSync(indexPath, 'utf8') !== expected) return false;

renameSync(temporaryPath, indexPath);
published = true;
```

**Claim:** The new PROJECT-STATUS refresh still has an unchecked check→rename window, so another writer can modify the file after the equality check and still get overwritten silently.

**Impact:** Concurrent hook/serve/manual refresh activity can lose a freshly written PROJECT-STATUS update without surfacing `PROJECT_INDEX_CONFLICT`, leaving stale or reverted initiative rows in the project index.

**Recommendation:** Serialize writers with a per-project lock around read→render→publish, or use a real compare-and-swap protocol that prevents rename after any post-check mutation.

**Confidence:** high

---

### F-004 [major] release-gating — scripts/verify-aideck-consumer.mjs:148-150

**Evidence:**
```js
if (refreshErrors.length > 0) {
  warnings++;
  console.log(c.warn(`  ⚠ refresh-state had a partial failure: ${refreshErrors.join('; ')}`));
}
```

```js
if (blocking === 0) {
  console.log(c.warn(`RESULT: PASS with ${warnings} warning(s)`) + ' — see ⚠ above.');
  process.exit(0);
}
```

**Claim:** The smoke verifier now converts `refresh-state` partial failures into warnings and still exits `0`.

**Impact:** CI or release checks can report a passing aiDeck consumer contract while derived state is known stale or incomplete, which is a false green for the dashboard path this script is supposed to gate.

**Recommendation:** Treat any `refreshErrors` as blocking in `--smoke` mode, or add an explicit opt-in flag for non-fatal partial refresh and keep the default exit status non-zero.

**Confidence:** high

---

## Questions (non-findings)

## Out of scope

- Archived review transcript narratives except where they pointed back to current changed files.

## Pass 2 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 2, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The four blind-pass findings do not survive the supplied constraints: permissive consumer-path resolution is intentional for these operator-invoked entrypoints, dispatch telemetry is specified to fail closed even on unrelated malformed lines, the final refresh-state check→rename race is explicitly deferred to F4, and aiDeck smoke mode is defined to exit zero on partial refresh failures with warnings.

Two different regressions remain. First, the new centralized renderer now emits Claude-specific tool labels for every non-Gemini host, so installed Codex/Cursor/OpenCode/GitHub Copilot skills carry invalid tool instructions. Second, the browser `STATE_ERROR` repair flow still resolves `normalize.js` through repo/global/Home fallbacks instead of the verified `package-root` runtime, but install no longer stages `normalize.js` in those locations. The changed tests also miss both regressions.

## Findings

### F-001 [major] compatibility — src/render.js:45-69

**Evidence:**
```js
const isGemini = ideId === 'gemini' || ideId === 'gemini-commands';
const isClaudeCode = ideId === 'claude-code';
const noNativeAskTool =
  'ask the user via a multiple-choice prompt (no native tool — render the question + options in plain text)';
if (isGemini) {
  allVars.BASH_TOOL = 'run_shell_command';
  allVars.READ_TOOL = 'read_file';
  allVars.WRITE_TOOL = 'write_file';
  allVars.REPLACE_TOOL = 'replace';
  allVars.GREP_TOOL = 'grep_search';
  allVars.GLOB_TOOL = 'glob';
  allVars.INVESTIGATOR_TOOL = 'codebase_investigator';
  allVars.ARG_VAR = '$ARGUMENTS';
  allVars.ASK_USER_QUESTION_TOOL = noNativeAskTool;
} else {
  // Default to Claude Code style tool names
  allVars.BASH_TOOL = 'Bash';
  allVars.READ_TOOL = 'Read tool';
  allVars.WRITE_TOOL = 'Write tool';
  allVars.REPLACE_TOOL = 'Edit tool';
  allVars.GREP_TOOL = 'Grep';
  allVars.GLOB_TOOL = 'Glob';
  allVars.INVESTIGATOR_TOOL = 'Agent';
  allVars.ARG_VAR = '$ARGUMENTS';
  allVars.ASK_USER_QUESTION_TOOL = isClaudeCode ? 'AskUserQuestion tool' : noNativeAskTool;
}
```

**Claim:** Every non-Gemini host now falls through to Claude-specific tool labels, so installed skills for public hosts like `codex`, `cursor`, `opencode`, and `github-copilot` render `Bash`/`Read tool`/`Agent` instead of host-correct or neutral instructions.

**Impact:** Installed skills on those hosts are operationally wrong at runtime: core flows such as `project` and `implement` instruct the model to call nonexistent Claude-only tools, which breaks the very cross-IDE portability this phase is supposed to establish.

**Recommendation:** Replace the Claude default with explicit per-host mappings, or use tool-agnostic phrasing for hosts without stable native tool names. Add per-host assertions for all tool placeholders, not just `ASK_USER_QUESTION_TOOL`.

**Confidence:** high

---

### F-002 [major] runtime-contract — skills/shared/project-assets/project-view.md:233-238

**Evidence:**
```md
NORM=""
for c in "$PWD/src/normalize.js" \
         "$(npm root -g 2>/dev/null)/@henryavila/atomic-skills/src/normalize.js" \
         "$HOME/.atomic-skills/src/normalize.js"; do
  [ -f "$c" ] && NORM="$c" && break
done
[ -n "$NORM" ] && node "$NORM" "$PWD/.atomic-skills"
```

**Claim:** The browser `STATE_ERROR` repair flow still resolves `normalize.js` via repo/global/Home `src/` fallbacks instead of the verified `~/.atomic-skills/package-root` runtime path, even though install now stages only `package-root` and `src/provision-consumer.js` under `~/.atomic-skills/`.

**Impact:** In the supported packed-consumer setup (`npm install` into the consuming repo plus `atomic-skills install`), `status --browser` can fail to find the normalizer and silently skip repair, leaving aiDeck stuck on the terminal fallback even though the installed runtime does include a usable `src/normalize.js` under the recorded package root.

**Recommendation:** Resolve the normalizer through `$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/src/normalize.js`, matching the rest of the installed-runtime contract, and add an installed-consumer browser-flow regression test.

**Confidence:** high

---

### F-003 [minor] test-coverage — tests/render.test.js:35-45

**Evidence:**
```js
it('substitutes default tool names for claude-code', () => {
  const input = 'Use {{BASH_TOOL}} and {{READ_TOOL}}';
  const result = renderTemplate(input, {}, {}, 'claude-code');
  assert.strictEqual(result, 'Use Bash and Read tool\n');
});

it('substitutes gemini-specific tool names', () => {
  const input = 'Use {{BASH_TOOL}} and {{READ_TOOL}}';
  const result = renderTemplate(input, {}, {}, 'gemini');
  assert.strictEqual(result, 'Use run_shell_command and read_file\n');
});
```

**Claim:** The render unit tests assert `{{BASH_TOOL}}`/`{{READ_TOOL}}` mappings only for `claude-code` and `gemini`, so the public-host mappings for `codex`, `cursor`, `opencode`, and `github-copilot` are untested.

**Impact:** The current `src/render.js` regression ships with a green test suite, so future host-specific tool-name breakage will continue to bypass CI.

**Recommendation:** Add tool-placeholder assertions for every public IDE, or at minimum for the non-Claude hosts that currently share the fallback branch.

**Confidence:** high

---

### F-004 [minor] test-coverage — tests/skill-script-resolution.test.js:40-76

**Evidence:**
```js
const BARE_NODE_SCRIPTS = /\bnode\s+scripts\//
const BARE_NPM_RUN = new RegExp(`\\bnpm\\s+run\\s+(?:${LOCAL_NPM_SCRIPTS.join('|')})(?![\\w-])`)
const MODULE_REFERENCE = /(?:import\s*\(\s*|require\s*\(\s*|import\s+[^'"\n]+?\s+from\s+)(['"])([^'"]+)\1/g

function findOffenders(lines) {
  const offenders = []
  lines.forEach((line, i) => {
    if (BARE_NODE_SCRIPTS.test(line)) offenders.push(`${i + 1}: ${line.trim()}`)
    if (BARE_NPM_RUN.test(line)) offenders.push(`${i + 1}: ${line.trim()}`)

    for (const match of line.matchAll(MODULE_REFERENCE)) {
      const specifier = match[2]
      if (/^(?:\.\.?\/)+src\//.test(specifier)) {
        offenders.push(`${i + 1}: cwd-bound module '${specifier}'`)
        continue
      }
```

**Claim:** The script-resolution guard never inspects shell paths such as `$PWD/src/normalize.js`, `$(npm root -g)/@henryavila/atomic-skills/src/normalize.js`, or `$HOME/.atomic-skills/src/normalize.js`, so runtime-path regressions in skill shell snippets are currently invisible to the test meant to prevent them.

**Impact:** Broken installed-runtime resolution paths like the one in `project-view.md` pass the guardrail and can regress again without CI catching them.

**Recommendation:** Extend `findOffenders` to flag shell references to package-owned `src/*.js` and non-`package-root` fallbacks, then add a regression fixture covering the `project-view.md` normalizer snippet.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- Archived review transcript narratives except where they pointed back to current changed files.

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [major] path-traversal — DROPPED: the verified constraint explicitly says these three CLI entrypoints intentionally accept explicit absolute source/plan paths and declare no repository-confinement contract.
- F-002-blind [major] error-handling — DROPPED: the verified constraint requires malformed dispatch telemetry to fail closed with its physical line, including malformed unrelated records and missing routing identity.
- F-003-blind [major] race-condition — DROPPED: the verified constraint says F0 intentionally does not generalize shared-writer authority and defers the final check→rename race hardening to F4.
- F-004-blind [major] release-gating — DROPPED: the verified constraint defines aiDeck smoke verification to treat refresh partial failures as warnings and to exit non-zero only for blocking mismatches.

### Maintained

- _(none)_

### Emerged

- F-001-final [major] compatibility — emerged: once the verified public-host install surface was treated as binding, `renderTemplate`’s Claude-only fallback became a real cross-IDE runtime contract break.
- F-002-final [major] runtime-contract — emerged: the verified `package-root` runtime contract exposed that `project-view.md` still resolves `normalize.js` through locations the current installer does not stage.
- F-003-final [minor] test-coverage — emerged: the public-host render contract exposed that `tests/render.test.js` never checks tool-placeholder mappings outside Claude/Gemini.
- F-004-final [minor] test-coverage — emerged: the verified package-root resolution contract exposed that `tests/skill-script-resolution.test.js` does not scan shell-path fallbacks to `src/*.js`.

## Briefings used

<details>
<summary>Pass 1 briefing</summary>

~~~text
# Briefing — Pass 1 Code Review (Blind, Factual Minimal)

You are a senior security and correctness reviewer performing adversarial
review of code changes. Find bugs, vulnerabilities, and regressions; approval
is not your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the frozen phase diff and its modified files adversarially. Focus on
correctness, security, races, error handling, rollback, compatibility,
performance, observability, and missing behavioral tests. Ignore style and
naming unless they hide a substantive bug.

## Non-goals (factual, no rationale)

- Style, naming, formatting, and praise
- External repositories absent from the frozen diff
- Findings against quoted historical snippets inside archived review transcripts;
  cite the current changed source, test, state, or skill file instead

## Artifacts to review

### Frozen diff

- Ref: `b2a845a5d7e832c88622cb21c89aff6ee33927e1..a37e88c95178172fb23e8e33d6f292274ec95dd8`
- Exact captured bytes: `/tmp/integrity-remediation-f0-a37e88c.diff`
- SHA-256: `8acc36713f1665d22a1043fff4f6ad241023bd5045c5a0168301a285910654c7`
- Size: 5088427 bytes, 112121 lines

Use read-only shell tools to inspect `/tmp/integrity-remediation-f0-a37e88c.diff`; it is the immutable
CAPTURED_DIFF. Do not run `git diff` or substitute another range. Archived
review files contain duplicated snippets; inspect them as audit artifacts and
inspect every current executable hunk in the frozen diff exactly once.

### Modified files (73)

- `.ai/memory/MEMORY.md`
- `.ai/memory/padroes-testing.md`
- `.atomic-skills/analytics/completions.jsonl`
- `.atomic-skills/projects/atomic-skills/PROJECT-STATUS.md`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/lessons/integrity-remediation-f0-runtime-autocontido-e-setup-confiavel.md`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f0-runtime-autocontido-e-setup-confiavel.md`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f1-installer-v2-e-protecao-de-dados.source.json`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f2-contratos-de-host-runtime-e-observabil.source.json`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f3-caminho-spec-para-implement-e-isolamen.source.json`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f4-autoridade-de-estado-e-transicoes-recu.source.json`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f5-gemini-portabilidade-e-identidade-de-d.source.json`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f6-qualificacao-de-release-e-fechamento-d.source.json`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/plan.md`
- `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md`
- `.atomic-skills/reviews/2026-07-12-1120-integrity-remediation-f0-code-review.md`
- `.atomic-skills/reviews/2026-07-13-0844-integrity-remediation-f0-a3089a4.md`
- `.atomic-skills/reviews/2026-07-14-0930-integrity-remediation-f0-364ce8b-r2.md`
- `.atomic-skills/reviews/2026-07-14-0950-integrity-remediation-f0-555088b-r3.md`
- `.atomic-skills/reviews/2026-07-14-1003-integrity-remediation-f0-1f1ca51-r4.md`
- `.atomic-skills/reviews/2026-07-14-1028-integrity-remediation-f0-phase-adb21de-r5.md`
- `.atomic-skills/reviews/2026-07-14-1052-integrity-remediation-f0-phase-66c9ef1-r6.md`
- `.atomic-skills/reviews/2026-07-14-1111-integrity-remediation-f0-phase-e51cf68-r7.md`
- `.atomic-skills/reviews/INDEX.md`
- `.atomic-skills/status/creation-gates/atomic-skills-integrity-remediation.json`
- `.atomic-skills/status/dispatch-log.json`
- `package.json`
- `scripts/append-completion.js`
- `scripts/bootstrap-project.js`
- `scripts/decompose-plan.js`
- `scripts/lifecycle-order-guard.js`
- `scripts/materialize-state.js`
- `scripts/plan-dependencies.js`
- `scripts/refresh-state.js`
- `scripts/validate-runtime-closure.js`
- `scripts/verify-aideck-consumer.mjs`
- `skills/core/implement.md`
- `skills/core/project.md`
- `skills/shared/project-assets/project-create-initiative.md`
- `skills/shared/project-assets/project-create-plan.md`
- `skills/shared/project-assets/project-dependencies.md`
- `skills/shared/project-assets/project-discover.md`
- `skills/shared/project-assets/project-materialize.md`
- `skills/shared/project-assets/project-setup.md`
- `skills/shared/project-assets/project-transitions.md`
- `skills/shared/project-assets/project-verify.md`
- `skills/shared/project-assets/project-view.md`
- `src/decompose.js`
- `src/providers/skills-file-set.js`
- `src/render.js`
- `src/runtime-paths.js`
- `src/serve.js`
- `tests/append-completion-dispatchlog.test.js`
- `tests/consumer-install-e2e.test.js`
- `tests/consumer-runtime-resolution.test.js`
- `tests/decompose.test.js`
- `tests/dispatch-log-merge-union.test.js`
- `tests/fixtures/consumer-runtime/package.json`
- `tests/fixtures/consumer-runtime/src/normalize.js`
- `tests/implement-ready-contract.test.js`
- `tests/install-uninstall-roundtrip.test.js`
- `tests/install.test.js`
- `tests/lifecycle-order-guard.test.js`
- `tests/phase-materialization/e2e-lifecycle.test.js`
- `tests/phase-materialization/implement-backstop.test.js`
- `tests/phase-materialization/materialize-bootstrap.test.js`
- `tests/phase-materialization/materialize-verb.test.js`
- `tests/project.test.js`
- `tests/refresh-state.test.js`
- `tests/runtime-closure.test.js`
- `tests/serve-refresh-partial.test.js`
- `tests/serve.test.js`
- `tests/skill-script-resolution.test.js`
- `tests/verify-aideck-refresh-partial.test.js`

### Executable/runtime/test surface (48)

- `package.json`
- `scripts/append-completion.js`
- `scripts/bootstrap-project.js`
- `scripts/decompose-plan.js`
- `scripts/lifecycle-order-guard.js`
- `scripts/materialize-state.js`
- `scripts/plan-dependencies.js`
- `scripts/refresh-state.js`
- `scripts/validate-runtime-closure.js`
- `scripts/verify-aideck-consumer.mjs`
- `skills/core/implement.md`
- `skills/core/project.md`
- `skills/shared/project-assets/project-create-initiative.md`
- `skills/shared/project-assets/project-create-plan.md`
- `skills/shared/project-assets/project-dependencies.md`
- `skills/shared/project-assets/project-discover.md`
- `skills/shared/project-assets/project-materialize.md`
- `skills/shared/project-assets/project-setup.md`
- `skills/shared/project-assets/project-transitions.md`
- `skills/shared/project-assets/project-verify.md`
- `skills/shared/project-assets/project-view.md`
- `src/decompose.js`
- `src/providers/skills-file-set.js`
- `src/render.js`
- `src/runtime-paths.js`
- `src/serve.js`
- `tests/append-completion-dispatchlog.test.js`
- `tests/consumer-install-e2e.test.js`
- `tests/consumer-runtime-resolution.test.js`
- `tests/decompose.test.js`
- `tests/dispatch-log-merge-union.test.js`
- `tests/fixtures/consumer-runtime/package.json`
- `tests/fixtures/consumer-runtime/src/normalize.js`
- `tests/implement-ready-contract.test.js`
- `tests/install-uninstall-roundtrip.test.js`
- `tests/install.test.js`
- `tests/lifecycle-order-guard.test.js`
- `tests/phase-materialization/e2e-lifecycle.test.js`
- `tests/phase-materialization/implement-backstop.test.js`
- `tests/phase-materialization/materialize-bootstrap.test.js`
- `tests/phase-materialization/materialize-verb.test.js`
- `tests/project.test.js`
- `tests/refresh-state.test.js`
- `tests/runtime-closure.test.js`
- `tests/serve-refresh-partial.test.js`
- `tests/serve.test.js`
- `tests/skill-script-resolution.test.js`
- `tests/verify-aideck-refresh-partial.test.js`

### Archived review transcript paths (10)

- `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md`
- `.atomic-skills/reviews/2026-07-12-1120-integrity-remediation-f0-code-review.md`
- `.atomic-skills/reviews/2026-07-13-0844-integrity-remediation-f0-a3089a4.md`
- `.atomic-skills/reviews/2026-07-14-0930-integrity-remediation-f0-364ce8b-r2.md`
- `.atomic-skills/reviews/2026-07-14-0950-integrity-remediation-f0-555088b-r3.md`
- `.atomic-skills/reviews/2026-07-14-1003-integrity-remediation-f0-1f1ca51-r4.md`
- `.atomic-skills/reviews/2026-07-14-1028-integrity-remediation-f0-phase-adb21de-r5.md`
- `.atomic-skills/reviews/2026-07-14-1052-integrity-remediation-f0-phase-66c9ef1-r6.md`
- `.atomic-skills/reviews/2026-07-14-1111-integrity-remediation-f0-phase-e51cf68-r7.md`
- `.atomic-skills/reviews/INDEX.md`

Read current file content from the workspace when a hunk needs context. Use
read-only `rg` for direct callers, limited to five representative sites per
changed public symbol. Findings must anchor to CAPTURED_FILES or a direct
regression caused by their changed contract.

## Finding bar

Every finding must state WHAT fails, WHY, concrete IMPACT, a specific
RECOMMENDATION, CONFIDENCE, an exact current `file:line`, and literal evidence.
Drop claims that miss any field. Maximum five blocker+critical findings.

## Output format

# Required Output Format — Pass 1 (Blind)

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

## Format rules

- `<lang>` in Evidence fence: use the language of the file (`js`, `ts`, `py`, `md`, `yaml`). If unknown, leave blank.
- IDs must match regex `F-\d{3}` (e.g. `F-001`, not `F-1`, not `F-001-blind`). The `-blind` suffix is added by Pass 2 reconciliation if needed.
- Severity enum: `blocker | critical | major | minor | nit`. No other values.
- Confidence enum: `high | medium | low`. No other values.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space (no items).

## Forbidden

- Markdown other than the template above.
- Bullet lists summarizing findings outside the per-finding structure.
- "What works well" sections.
- Praise or hedging ("the author probably intends...").
- Multiple verdicts.
- Multiple frontmatter blocks.

Begin review now.
~~~

</details>

<details>
<summary>Pass 2 briefing</summary>

~~~text
# Briefing — Pass 1 Code Review (Blind, Factual Minimal)

You are a senior security and correctness reviewer performing adversarial
review of code changes. Find bugs, vulnerabilities, and regressions; approval
is not your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the frozen phase diff and its modified files adversarially. Focus on
correctness, security, races, error handling, rollback, compatibility,
performance, observability, and missing behavioral tests. Ignore style and
naming unless they hide a substantive bug.

## Non-goals (factual, no rationale)

- Style, naming, formatting, and praise
- External repositories absent from the frozen diff
- Findings against quoted historical snippets inside archived review transcripts;
  cite the current changed source, test, state, or skill file instead

## Artifacts to review

### Frozen diff

- Ref: `b2a845a5d7e832c88622cb21c89aff6ee33927e1..a37e88c95178172fb23e8e33d6f292274ec95dd8`
- Exact captured bytes: `/tmp/integrity-remediation-f0-a37e88c.diff`
- SHA-256: `8acc36713f1665d22a1043fff4f6ad241023bd5045c5a0168301a285910654c7`
- Size: 5088427 bytes, 112121 lines

Use read-only shell tools to inspect `/tmp/integrity-remediation-f0-a37e88c.diff`; it is the immutable
CAPTURED_DIFF. Do not run `git diff` or substitute another range. Archived
review files contain duplicated snippets; inspect them as audit artifacts and
inspect every current executable hunk in the frozen diff exactly once.

### Modified files (73)

- `.ai/memory/MEMORY.md`
- `.ai/memory/padroes-testing.md`
- `.atomic-skills/analytics/completions.jsonl`
- `.atomic-skills/projects/atomic-skills/PROJECT-STATUS.md`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/lessons/integrity-remediation-f0-runtime-autocontido-e-setup-confiavel.md`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f0-runtime-autocontido-e-setup-confiavel.md`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f1-installer-v2-e-protecao-de-dados.source.json`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f2-contratos-de-host-runtime-e-observabil.source.json`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f3-caminho-spec-para-implement-e-isolamen.source.json`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f4-autoridade-de-estado-e-transicoes-recu.source.json`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f5-gemini-portabilidade-e-identidade-de-d.source.json`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f6-qualificacao-de-release-e-fechamento-d.source.json`
- `.atomic-skills/projects/atomic-skills/integrity-remediation/plan.md`
- `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md`
- `.atomic-skills/reviews/2026-07-12-1120-integrity-remediation-f0-code-review.md`
- `.atomic-skills/reviews/2026-07-13-0844-integrity-remediation-f0-a3089a4.md`
- `.atomic-skills/reviews/2026-07-14-0930-integrity-remediation-f0-364ce8b-r2.md`
- `.atomic-skills/reviews/2026-07-14-0950-integrity-remediation-f0-555088b-r3.md`
- `.atomic-skills/reviews/2026-07-14-1003-integrity-remediation-f0-1f1ca51-r4.md`
- `.atomic-skills/reviews/2026-07-14-1028-integrity-remediation-f0-phase-adb21de-r5.md`
- `.atomic-skills/reviews/2026-07-14-1052-integrity-remediation-f0-phase-66c9ef1-r6.md`
- `.atomic-skills/reviews/2026-07-14-1111-integrity-remediation-f0-phase-e51cf68-r7.md`
- `.atomic-skills/reviews/INDEX.md`
- `.atomic-skills/status/creation-gates/atomic-skills-integrity-remediation.json`
- `.atomic-skills/status/dispatch-log.json`
- `package.json`
- `scripts/append-completion.js`
- `scripts/bootstrap-project.js`
- `scripts/decompose-plan.js`
- `scripts/lifecycle-order-guard.js`
- `scripts/materialize-state.js`
- `scripts/plan-dependencies.js`
- `scripts/refresh-state.js`
- `scripts/validate-runtime-closure.js`
- `scripts/verify-aideck-consumer.mjs`
- `skills/core/implement.md`
- `skills/core/project.md`
- `skills/shared/project-assets/project-create-initiative.md`
- `skills/shared/project-assets/project-create-plan.md`
- `skills/shared/project-assets/project-dependencies.md`
- `skills/shared/project-assets/project-discover.md`
- `skills/shared/project-assets/project-materialize.md`
- `skills/shared/project-assets/project-setup.md`
- `skills/shared/project-assets/project-transitions.md`
- `skills/shared/project-assets/project-verify.md`
- `skills/shared/project-assets/project-view.md`
- `src/decompose.js`
- `src/providers/skills-file-set.js`
- `src/render.js`
- `src/runtime-paths.js`
- `src/serve.js`
- `tests/append-completion-dispatchlog.test.js`
- `tests/consumer-install-e2e.test.js`
- `tests/consumer-runtime-resolution.test.js`
- `tests/decompose.test.js`
- `tests/dispatch-log-merge-union.test.js`
- `tests/fixtures/consumer-runtime/package.json`
- `tests/fixtures/consumer-runtime/src/normalize.js`
- `tests/implement-ready-contract.test.js`
- `tests/install-uninstall-roundtrip.test.js`
- `tests/install.test.js`
- `tests/lifecycle-order-guard.test.js`
- `tests/phase-materialization/e2e-lifecycle.test.js`
- `tests/phase-materialization/implement-backstop.test.js`
- `tests/phase-materialization/materialize-bootstrap.test.js`
- `tests/phase-materialization/materialize-verb.test.js`
- `tests/project.test.js`
- `tests/refresh-state.test.js`
- `tests/runtime-closure.test.js`
- `tests/serve-refresh-partial.test.js`
- `tests/serve.test.js`
- `tests/skill-script-resolution.test.js`
- `tests/verify-aideck-refresh-partial.test.js`

### Executable/runtime/test surface (48)

- `package.json`
- `scripts/append-completion.js`
- `scripts/bootstrap-project.js`
- `scripts/decompose-plan.js`
- `scripts/lifecycle-order-guard.js`
- `scripts/materialize-state.js`
- `scripts/plan-dependencies.js`
- `scripts/refresh-state.js`
- `scripts/validate-runtime-closure.js`
- `scripts/verify-aideck-consumer.mjs`
- `skills/core/implement.md`
- `skills/core/project.md`
- `skills/shared/project-assets/project-create-initiative.md`
- `skills/shared/project-assets/project-create-plan.md`
- `skills/shared/project-assets/project-dependencies.md`
- `skills/shared/project-assets/project-discover.md`
- `skills/shared/project-assets/project-materialize.md`
- `skills/shared/project-assets/project-setup.md`
- `skills/shared/project-assets/project-transitions.md`
- `skills/shared/project-assets/project-verify.md`
- `skills/shared/project-assets/project-view.md`
- `src/decompose.js`
- `src/providers/skills-file-set.js`
- `src/render.js`
- `src/runtime-paths.js`
- `src/serve.js`
- `tests/append-completion-dispatchlog.test.js`
- `tests/consumer-install-e2e.test.js`
- `tests/consumer-runtime-resolution.test.js`
- `tests/decompose.test.js`
- `tests/dispatch-log-merge-union.test.js`
- `tests/fixtures/consumer-runtime/package.json`
- `tests/fixtures/consumer-runtime/src/normalize.js`
- `tests/implement-ready-contract.test.js`
- `tests/install-uninstall-roundtrip.test.js`
- `tests/install.test.js`
- `tests/lifecycle-order-guard.test.js`
- `tests/phase-materialization/e2e-lifecycle.test.js`
- `tests/phase-materialization/implement-backstop.test.js`
- `tests/phase-materialization/materialize-bootstrap.test.js`
- `tests/phase-materialization/materialize-verb.test.js`
- `tests/project.test.js`
- `tests/refresh-state.test.js`
- `tests/runtime-closure.test.js`
- `tests/serve-refresh-partial.test.js`
- `tests/serve.test.js`
- `tests/skill-script-resolution.test.js`
- `tests/verify-aideck-refresh-partial.test.js`

### Archived review transcript paths (10)

- `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md`
- `.atomic-skills/reviews/2026-07-12-1120-integrity-remediation-f0-code-review.md`
- `.atomic-skills/reviews/2026-07-13-0844-integrity-remediation-f0-a3089a4.md`
- `.atomic-skills/reviews/2026-07-14-0930-integrity-remediation-f0-364ce8b-r2.md`
- `.atomic-skills/reviews/2026-07-14-0950-integrity-remediation-f0-555088b-r3.md`
- `.atomic-skills/reviews/2026-07-14-1003-integrity-remediation-f0-1f1ca51-r4.md`
- `.atomic-skills/reviews/2026-07-14-1028-integrity-remediation-f0-phase-adb21de-r5.md`
- `.atomic-skills/reviews/2026-07-14-1052-integrity-remediation-f0-phase-66c9ef1-r6.md`
- `.atomic-skills/reviews/2026-07-14-1111-integrity-remediation-f0-phase-e51cf68-r7.md`
- `.atomic-skills/reviews/INDEX.md`

Read current file content from the workspace when a hunk needs context. Use
read-only `rg` for direct callers, limited to five representative sites per
changed public symbol. Findings must anchor to CAPTURED_FILES or a direct
regression caused by their changed contract.

## Finding bar

Every finding must state WHAT fails, WHY, concrete IMPACT, a specific
RECOMMENDATION, CONFIDENCE, an exact current `file:line`, and literal evidence.
Drop claims that miss any field. Maximum five blocker+critical findings.

## Output format

# Required Output Format — Pass 1 (Blind)

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

## Format rules

- `<lang>` in Evidence fence: use the language of the file (`js`, `ts`, `py`, `md`, `yaml`). If unknown, leave blank.
- IDs must match regex `F-\d{3}` (e.g. `F-001`, not `F-1`, not `F-001-blind`). The `-blind` suffix is added by Pass 2 reconciliation if needed.
- Severity enum: `blocker | critical | major | minor | nit`. No other values.
- Confidence enum: `high | medium | low`. No other values.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space (no items).

## Forbidden

- Markdown other than the template above.
- Bullet lists summarizing findings outside the per-finding structure.
- "What works well" sections.
- Praise or hedging ("the author probably intends...").
- Multiple verdicts.
- Multiple frontmatter blocks.

## External constraints (verifiable)

Check each cited local source, then treat the verified constraint as ground truth.

- The package is ESM and supports Node `^22.18.0 || >=24.11.0`. Verify `package.json`.
- `resolveConsumerPath` is a path-resolution helper used only by three operator-invoked CLI entrypoints; those commands intentionally accept explicit absolute source/plan paths and no repository-confinement contract is declared. Verify `src/runtime-paths.js:14-20`, `scripts/{decompose-plan,bootstrap-project,plan-dependencies}.js`, and `tests/consumer-{runtime-resolution,install-e2e}.test.js`.
- The `depend add` skill resolves and passes the dependent plan directory explicitly; it can target another checkout by design. Verify `skills/shared/project-assets/project-dependencies.md:65-76`.
- Malformed dispatch telemetry is required to fail closed with its physical line, including malformed unrelated records and records missing routing identity. Completion events are the immutable earned-value source and the documented transition emits the event before saving the authoritative task state. Verify `scripts/append-completion.js:177-259,340-365`, `tests/append-completion-dispatchlog.test.js:261-330`, and `skills/shared/project-assets/project-transitions.md:127-145`.
- F0 owns only the minimum descriptor-only→initiative transaction and explicitly does not generalize shared-writer authority. F4 owns the single shared writer/reconciler and final check→rename race hardening. Verify `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f0-runtime-autocontido-e-setup-confiavel.md:295-326,348-381`, `.atomic-skills/projects/atomic-skills/integrity-remediation/phases/f4-autoridade-de-estado-e-transicoes-recu.source.json:258-274`, and `scripts/refresh-state.js:144-164`.
- The aiDeck verifier defines blocking mismatches separately from advisory warnings and exits non-zero on blocking mismatches. A refresh partial failure preserves the prior derived index/continues remaining outputs, is surfaced as a warning rather than a clean refresh pass, and intentionally yields `PASS with N warning(s)`. Verify `scripts/verify-aideck-consumer.mjs:3-25,140-154,276-288`, `tests/verify-aideck-refresh-partial.test.js:45-102`, and `tests/refresh-state.test.js:286-343,446-502`.
- Descriptor-only activation intentionally has a stricter pre-publication contract than the backward-compatible general schema. Verify `meta/schemas/initiative.schema.json:17-64,202-260`, `skills/shared/project-assets/project-materialize.md:121-162`, and `tests/phase-materialization/materialize-bootstrap.test.js:750-788`.
- Directory fsync is unsupported on win32; `materialize-state.js` now skips only directory fsync there and retains durable file writes. Verify `scripts/materialize-state.js:105-142` and `tests/phase-materialization/materialize-bootstrap.test.js:169-198`.
- `listProjects` lists only projects containing at least one `<slug>/plan.md`; the browser resolver applies the same predicate. Verify `src/serve.js:264-296`, `tests/serve.test.js:139-211`, and `skills/shared/project-assets/project-view.md:68-101`.
- Skill markdown must use repository template variables, and persistent install mutations require uninstall parity. Verify `AGENTS.md` and `tests/install-uninstall-roundtrip.test.js`.

## Pass 1 (blind) findings

---BEGIN PASS 1 OUTPUT---
---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The diff still leaves four substantive regressions in the new runtime and state-management paths. The new consumer-path helper does not actually constrain paths to the consumer repository, task completion now hard-fails on any malformed dispatch-log line even when the bad line is unrelated to the task being closed, the PROJECT-STATUS writer still has a silent last-writer-wins window after its conflict check, and the aiDeck smoke verifier now exits successfully on partial refresh failures.

These are correctness issues, not style issues. They can mutate files outside the target repo, block or suppress completion telemetry for unrelated work, lose concurrent PROJECT-STATUS updates, and let automation report a green aiDeck contract check while serving stale derived state.

## Findings

### F-001 [major] path-traversal — src/runtime-paths.js:14-19

**Evidence:**
```js
/** Resolve a user-supplied path relative to the consuming repository. */
export function resolveConsumerPath(input, cwd = process.cwd()) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('consumer path must be a non-empty string')
  }
  return resolve(cwd, input)
}
```

**Claim:** `resolveConsumerPath` claims repo-relative resolution but accepts `../` escapes and absolute paths, and the new public entrypoints use it directly for file reads/writes.

**Impact:** `scripts/plan-dependencies.js` can write to any reachable `plan.md`, and `scripts/decompose-plan.js` / `scripts/bootstrap-project.js` can read arbitrary files outside the consuming repo, so a mistaken or malicious invocation is no longer confined to the project tree.

**Recommendation:** Reject absolute paths and any resolved path whose `relative(cwd, resolved)` escapes the consumer root, or split this into an explicitly unsafe helper plus a contained helper and use the contained variant in the installed entrypoints.

**Confidence:** high

---

### F-002 [major] error-handling — scripts/append-completion.js:251-258

**Evidence:**
```js
export function readDispatchActuals(root, { planSlug, phaseId, taskId } = {}) {
  if (!hasText(taskId)) return undefined;
  const path = join(resolve(root), '.atomic-skills', 'status', 'dispatch-log.json');
  if (!existsSync(path)) return undefined;
  const log = parseDispatchLog(readFileSync(path, 'utf8'), { source: path });
  const matching = log.filter((r) => (
    r.plan === planSlug && r.phase === phaseId && r.taskId === taskId
  ));
```

```js
if (entry && entry.event === 'task-done' && entry.actuals == null) {
  const derived = readDispatchActuals(root, {
    planSlug: entry.planSlug, phaseId: entry.phaseId, taskId: entry.taskId,
  });
  if (derived !== undefined) effectiveEntry = { ...entry, actuals: derived };
}
```

**Claim:** Every `task-done` append now reparses the entire dispatch log before filtering, so one malformed historical line for any task makes unrelated task completions throw.

**Impact:** A single corrupt `dispatch-log.json` entry can block future `appendCompletion` calls for all tasks, which can abort `done`/`phase-done` flows or leave telemetry missing for otherwise valid work.

**Recommendation:** Fail open at the `appendCompletion` call site by catching dispatch-log parse errors and omitting derived actuals with a warning, or restructure the reader so unrelated malformed records do not block completion for other tasks.

**Confidence:** high

---

### F-003 [major] race-condition — scripts/refresh-state.js:159-164

**Evidence:**
```js
// Optimistic conflict check for updates made since the snapshot read. This
// is intentionally not a complete cross-writer CAS: F-001 defers authority
// over the final check→rename window to the shared-writer work in F4.
if (readFileSync(indexPath, 'utf8') !== expected) return false;

renameSync(temporaryPath, indexPath);
published = true;
```

**Claim:** The new PROJECT-STATUS refresh still has an unchecked check→rename window, so another writer can modify the file after the equality check and still get overwritten silently.

**Impact:** Concurrent hook/serve/manual refresh activity can lose a freshly written PROJECT-STATUS update without surfacing `PROJECT_INDEX_CONFLICT`, leaving stale or reverted initiative rows in the project index.

**Recommendation:** Serialize writers with a per-project lock around read→render→publish, or use a real compare-and-swap protocol that prevents rename after any post-check mutation.

**Confidence:** high

---

### F-004 [major] release-gating — scripts/verify-aideck-consumer.mjs:148-150

**Evidence:**
```js
if (refreshErrors.length > 0) {
  warnings++;
  console.log(c.warn(`  ⚠ refresh-state had a partial failure: ${refreshErrors.join('; ')}`));
}
```

```js
if (blocking === 0) {
  console.log(c.warn(`RESULT: PASS with ${warnings} warning(s)`) + ' — see ⚠ above.');
  process.exit(0);
}
```

**Claim:** The smoke verifier now converts `refresh-state` partial failures into warnings and still exits `0`.

**Impact:** CI or release checks can report a passing aiDeck consumer contract while derived state is known stale or incomplete, which is a false green for the dashboard path this script is supposed to gate.

**Recommendation:** Treat any `refreshErrors` as blocking in `--smoke` mode, or add an explicit opt-in flag for non-fatal partial refresh and keep the default exit status non-zero.

**Confidence:** high

---

## Questions (non-findings)

## Out of scope

- Archived review transcript narratives except where they pointed back to current changed files.
---END PASS 1 OUTPUT---

## Your task in this pass

Re-evaluate every blind finding as dropped, maintained, or refined; add only
findings that emerge from the verified constraints; then emit the full final
findings and reconciliation.

## Output format

# Required Output Format — Pass 2 (Informed)

Same template as Pass 1 PLUS an obligatory `## Pass 2 reconciliation` block.
You MUST respond in this exact structure.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id>
pass: informed
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words>

## Findings

### F-001 [<severity>] <category> — <file>:<line>

**Evidence:** <...>
**Claim:** <...>
**Impact:** <...>
**Recommendation:** <...>
**Confidence:** <...>

---

### F-002 ... (final IDs — these are the post-constraints findings)

## Questions (non-findings)

- <file>:<line> — <question>

## Out of scope

- <item>

## Pass 2 reconciliation

### Dropped from blind pass

<For each Pass 1 finding you are dropping, write one line:>

- F-001-blind [<severity>] <category> — DROPPED: <one-sentence reason citing
  which constraint or non-goal makes it invalid>

<If no drops: write `- _(none)_`>

### Maintained

<For each Pass 1 finding kept (with or without severity change):>

- F-002-blind → F-001-final [<severity>] — <same | severity changed: was X, now Y>

<If no maintained: write `- _(none)_`>

### Emerged

<For each NEW finding that surfaced only because constraints were revealed:>

- F-XXX-final [<severity>] <category> — emerged: <one-sentence reason citing
  the constraint that triggered the finding>

<If no emerged: write `- _(none)_`>
````

## Rules specific to Pass 2

- Final findings use sequential IDs `F-001, F-002, ...` (no `-final` suffix in the `## Findings` section — only in reconciliation references).
- In reconciliation, refer to blind findings with `-blind` suffix and maintained mappings with `→ F-XXX-final`.
- `counts` is the COUNT OF FINAL findings (post-reconciliation), not blind.
- `pass: informed` (literal).
- All universal rules from `output-template-pass1.md` apply.

Begin reconciliation now.
~~~

</details>

## Self-review against code-quality gates

- G1 read-before-claim: blame and frozen-range diffs proved which findings were pre-existing and which test hunk changed in F0.
- G2 soft-language: each disposition is tied to an exact base comparison, phase owner, or executed verifier.
- G7 anti-premature-abstraction: only shell runtime resolution was hardened; host profiles remain assigned to F2.
