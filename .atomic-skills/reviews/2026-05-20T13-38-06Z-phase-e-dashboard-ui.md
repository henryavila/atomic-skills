---
date: 2026-05-20T13:38:06Z
topic: phase-e-dashboard-ui
artifact: 46e0cdc^..HEAD (Phase E, 8 commits)
skill: review-code-with-codex
reviewer: GPT-5 (Codex)
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 1, major: 3, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 3, minor: 1, nit: 0}
framing_delta: {dropped: 2, maintained: 3, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — phase-e-dashboard-ui

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 3, minor: 1, nit: 0}
reviewer: GPT-5
pass: blind
schema_version: "1.0"
---

## Summary
Phase E has several correctness and reliability issues around the new `serve` command and dashboard routing. The largest risk is that `serve` writes a live dashboard env file before it knows aiDeck actually started, then does not handle spawn failures, leaving stale SessionStart state behind.

The dashboard also has hard-coded runtime assumptions that break normal `--port` usage and real project slugs. Test coverage exists, but important paths are either skipped in common environments or test only exported helpers that production does not call.

## Findings

### F-001 [critical] error handling — src/serve.js:149-173

**Evidence:**
```js
  writeEnvFile(url)
  console.error(`atomic-skills serve: dashboard at ${url}`)

  const child = spawnAideck({ bundleDir, port, aideckBin: opts.aideckBin })

  const cleanup = () => {
    removeEnvFile()
    if (!child.killed) child.kill('SIGINT')
  }
  process.once('SIGINT', cleanup)
  process.once('SIGTERM', cleanup)

  await new Promise((resolveP) => {
    child.on('exit', (code, signal) => {
      removeEnvFile()
      if (signal === 'SIGINT' || signal === 'SIGTERM') process.exit(0)
      process.exit(code ?? 0)
      resolveP(undefined)
    })
  })
```

**Claim:** If `aideck` cannot be spawned, the process can crash or hang after writing `~/.atomic-skills/env`, because only `exit` is handled and child `error` is ignored.

**Impact:** A normal first-run case with no `aideck` on PATH, a bad `--aideck-bin`, or an inaccessible binary leaves SessionStart advertising a dashboard URL that is not running; subsequent AI sessions receive stale operational context.

**Recommendation:** Attach an `error` listener immediately after spawn, remove the env file in `finally`, and write the env file only after the backend is known to be listening or has at least spawned successfully.

**Confidence:** high

---

### F-002 [major] correctness — bin/cli.js:93-99, src/serve.js:164-165

**Evidence:**
```js
  await serve({
    port: values.port,
    forceBuild: values['force-build'],
    aideckBin: values['aideck-bin'],
  });
```

```js
  const port = opts.port ?? '7777'
  const url = `http://127.0.0.1:${port}`
```

**Claim:** The advertised port validation is not used by production code, so `atomic-skills serve --port abc` or `--port 99999` writes an invalid dashboard URL and passes invalid input to aiDeck.

**Impact:** Users can get a broken env file and misleading SessionStart dashboard hint from a simple CLI typo; the test suite’s `parsePort` coverage gives false confidence because `serve()` never calls it.

**Recommendation:** Validate and normalize `values.port` in `bin/cli.js` or at the start of `serve()` before writing the env file or spawning aiDeck.

**Confidence:** high

---

### F-003 [major] correctness — src/dashboard/components/layout/LayoutShell.tsx:22-30

**Evidence:**
```tsx
          <NavLink to="/plans/v3-redesign" className={navClass}>
            plans
          </NavLink>
```

**Claim:** The top navigation always links to `/plans/v3-redesign`, regardless of the plans actually returned by `/api/state/project-status`.

**Impact:** In any project whose plan slug is not `v3-redesign`, the primary “plans” navigation sends users to a failing plan page even when valid plans exist.

**Recommendation:** Link “plans” to `/` or compute the active/first plan slug from project state instead of hard-coding a repository-specific slug.

**Confidence:** high

---

### F-004 [major] race condition — src/serve.js:105-124, src/serve.js:149-173

**Evidence:**
```js
const ENV_FILE_PATH = join(homedir(), '.atomic-skills', 'env')
```

```js
function removeEnvFile() {
  try {
    unlinkSync(ENV_FILE_PATH)
  } catch {
    /* swallow */
  }
}
```

```js
  writeEnvFile(url)
```

**Claim:** All `atomic-skills serve` instances share one global env file, and any instance exiting unconditionally deletes it even if another dashboard is still running.

**Impact:** Running two dashboards for different repositories or ports causes stale or missing SessionStart URL hints; the first process to exit can erase the second process’s active URL.

**Recommendation:** Include an instance token or PID in the env file and only remove the file if it still belongs to the exiting process, or make the env path project-specific.

**Confidence:** high

---

### F-005 [minor] test coverage — tests/aideck-contract.test.js:30-33, tests/e2e-smoke.test.js:36-45

**Evidence:**
```js
const HAS_AIDECK = existsSync(AIDECK_DIST)
const SKIP_REASON = HAS_AIDECK ? null : `sibling aideck dist not at ${AIDECK_DIST}`
```

```js
const SKIP_REASON =
  !HAS_AIDECK
    ? `sibling aideck dist not at ${AIDECK_CLI}`
    : !HAS_DASHBOARD
      ? `dashboard bundle not at ${DASHBOARD_DIR}/index.html — run npm run build:dashboard`
      : false
```

**Claim:** The new cross-repo contract and end-to-end tests silently skip in common CI/fresh-clone environments when the sibling repo or built bundle is absent.

**Impact:** The main compatibility guarantees for Phase E can be absent from regular `npm test`, allowing schema drift, SPA fallback regressions, and aiDeck integration failures to merge undetected.

**Recommendation:** Add a required CI job that checks out/builds aiDeck and builds the dashboard before running these tests, or make the default test command fail when Phase E integration prerequisites are missing in CI.

**Confidence:** medium

---

## Questions (non-findings)

- src/dashboard/lib/api.ts:66 — Is `getInbox()` intentionally unused in v0.1, or should inbox rendering be part of this phase?
- package.json:51 — Should React, React Query, React Router, and Vite remain `devDependencies` only for published installs that may use `--force-build`?

## Out of scope

- Deleted `src/mcp-mode.js` and `tests/mcp-mode.test.js` content.
- `docs/design/claude-design-handoff/`.
- `tokens.css`.
- aiDeck-side implementation under `/Volumes/External/code/aideck/`.

## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 3, minor: 0, nit: 0}
reviewer: GPT-5
pass: informed
schema_version: "1.0"
---

## Summary
Phase E still has correctness issues in the production path for `atomic-skills serve`: invalid or failed aiDeck startup can leave a generated dashboard URL behind, and CLI port validation exists only in tests. Those are normal-use failure modes, not just defensive hardening.

The dashboard also ships with a project-specific top-nav link that is confirmed to be a placeholder and dead outside the demo project. The cross-repo and e2e tests are allowed to skip without CI per the stated constraints, so that blind-pass finding is dropped.

## Findings

### F-001 [critical] error handling — src/serve.js:149

**Evidence:**
```js
  writeEnvFile(url)
  console.error(`atomic-skills serve: dashboard at ${url}`)

  const child = spawnAideck({ bundleDir, port, aideckBin: opts.aideckBin })

  const cleanup = () => {
    removeEnvFile()
    if (!child.killed) child.kill('SIGINT')
  }
```

**Claim:** If `aideck` cannot be spawned, `serve()` writes `~/.atomic-skills/env` before any child `error` handling or listen confirmation.

**Impact:** A first run with no `aideck` on PATH, a bad `--aideck-bin`, or a non-executable binary can leave SessionStart advertising a dashboard URL that is not running.

**Recommendation:** Attach an `error` listener immediately after spawn, remove the env file in a `finally` path, and only write the env file after spawn succeeds or the backend responds on `/api/health`.

**Confidence:** high

---

### F-002 [major] correctness — src/serve.js:145

**Evidence:**
```js
  const port = opts.port ?? '7777'
  const url = `http://127.0.0.1:${port}`
```

**Claim:** Production `serve()` never calls the tested `parsePort()` helper, so invalid `--port` values are accepted.

**Impact:** `atomic-skills serve --port abc` or `--port 99999` writes an invalid dashboard URL and forwards bad input to aiDeck, producing misleading hook context from a simple CLI typo.

**Recommendation:** Validate and normalize `opts.port` at the start of `serve()` before writing the env file or spawning aiDeck.

**Confidence:** high

---

### F-003 [major] correctness — src/dashboard/components/layout/LayoutShell.tsx:22

**Evidence:**
```tsx
          <NavLink to="/plans/v3-redesign" className={navClass}>
            plans
          </NavLink>
```

**Claim:** The production top navigation hard-codes the demo plan slug instead of using the current project state.

**Impact:** In any project without a `v3-redesign` plan, the primary “plans” nav sends users to a failing detail page even when valid plans exist.

**Recommendation:** Link “plans” to `/`, add a real plans index route, or derive the active/first plan slug from `/api/state/project-status`.

**Confidence:** high

---

### F-004 [major] rollback safety — src/serve.js:184

**Evidence:**
```js
export const __testing = {
  ensureBundle,
  resolveAideckBin,
  writeEnvFile,
  removeEnvFile,
  ENV_FILE_PATH,
  DEFAULT_BUNDLE_DIR,
```

**Claim:** Test-only exports expose helpers that can build the dashboard, write/remove the user’s real env file, and resolve local binaries from the published runtime module.

**Impact:** Because `src/` is included in the npm package, downstream consumers can import `src/serve.js` and accidentally or maliciously call `__testing.removeEnvFile()` or `__testing.writeEnvFile()`, mutating `~/.atomic-skills/env` outside the CLI lifecycle.

**Recommendation:** Move test seams behind dependency injection or export them from a test-only module excluded from the package.

**Confidence:** medium

---

## Questions (non-findings)

- src/serve.js:104 — Should the env file content include enough metadata, such as PID or cwd, to help future multi-instance cleanup without changing the hook contract later?

## Out of scope

- Deleted `src/mcp-mode.js` and `tests/mcp-mode.test.js` content.
- `docs/design/claude-design-handoff/`.
- `tokens.css`.
- aiDeck-side implementation under `/Volumes/External/code/aideck/`.
- React/Vite dependency placement and prebuilt `dist/dashboard/`, per external constraints.
- Missing CI for cross-repo tests, per external constraints.

## Pass 2 reconciliation

### Dropped from blind pass

- F-004-blind [major] race condition — DROPPED: single-user, single-instance localhost is the v0.1 threat model; multi-instance conflicting env files are explicitly deferred to v0.2.
- F-005-blind [minor] test coverage — DROPPED: no CI exists and skip-when-missing for sibling aiDeck/dashboard artifacts is the stated Phase E trade-off.

### Maintained

- F-001-blind → F-001-final [critical] — same.
- F-002-blind → F-002-final [major] — same.
- F-003-blind → F-003-final [major] — same; the external constraint confirms this is a hardcoded placeholder, not dynamic behavior.

### Emerged

- F-004-final [major] rollback safety — emerged: the constraints confirm `src/` ships in the npm package while `__testing` exposes filesystem-mutating helpers from the production module.

## Fixes applied in this session

- **F-001 (critical) — APPLIED**. `src/serve.js` now polls `GET /api/health` after spawn; only writes `~/.atomic-skills/env` when aideck responds OK within 5s. Added `child.on('error', …)` handler with stderr write + cleanup + exit 1. SIGINT/SIGTERM cleanup tracks `envWritten` flag and only unlinks the env file if it was actually written.
- **F-002 (major) — APPLIED**. `serve()` calls `parsePort(opts.port ?? '7777')` at the start, before any spawn or side effect. Invalid `--port abc` / `--port 99999` now throws cleanly before writing anything.
- **F-003 (major) — APPLIED**. `LayoutShell.tsx` consumes `useProjectState()` and derives the "plans" nav target from `state.plans[0]?.slug`, falling back to `/` when no plans are loaded yet or none exist. The link is rendered disabled (text-fg-faint + pointer-events-none) when there's no target.
- **F-004 (major, emerged) — APPLIED**. Removed `writeEnvFile` and `removeEnvFile` from the `__testing` export of `src/serve.js`. The export is now frozen and contains only pure helpers + constants (`parsePort`, `resolveAideckBin`, `ENV_FILE_PATH`, `DEFAULT_BUNDLE_DIR`). Coverage for the FS-mutating helpers shifts to the e2e smoke test (which exercises them via the public `serve()` entry). New test `__testing surface (Codex F-004)` asserts exactly that set and that the object is frozen — drift fails CI.

Verification: `npm test` → 337 passed. `npm run test:hooks` → 51 passed. `node --test tests/e2e-smoke.test.js` → 6 passed.
