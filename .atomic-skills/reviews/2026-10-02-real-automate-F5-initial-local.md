# Initial independent review — real-automate F5

Range: `7d79ea82..49fc332` (immutable). Reviewer: isolated local agent.
Verdict: needs_changes. Findings: 3 major, 3 minor. No gate stamp.

## Findings

1. **Major — preview upgrade returns the wrong origin.** `scripts/serve-flow.js:150`: `findReusable` checks `planPath`, but `waitForLock` only matches `htmlPath`. Starting a flow-only preview followed by `--up --plan` can return the first server, whose `/final` is 404. The immutable-source VM probe confirmed the old URL was returned while the requested child had a different PID. Match requested plan/new child and settle replacement ownership.
2. **Major — stale page validates unseen delivery.** `scripts/lib/serve-flow.js:111,88`; `src/plan-end-review.js:440`: a token contains no presented snapshot. GET page A, change plan/audit to B, then POST A's token returns 200 and authenticates B. The reviewer reproduced this with HTTP and an in-memory filesystem. Bind tokens to displayed evidence and reject stale submissions with reload guidance.
3. **Major — prototype comparison embeds the wrong artifact.** `scripts/lib/serve-flow.js:165`: `ui/ui.json` identifies `screens[].path`, but the iframe always embeds `/flow.html`. Bare sandbox also disables scripts used by generated-flow inspection. Serve actual confined screen assets and preserve required preview interaction.
4. **Minor — successful validation displays raw JSON.** `scripts/lib/serve-flow.js:88,164`: native form navigation removes review context. Redirect to a completed state with timestamp and next action.
5. **Minor — disabled validation has no actionable explanation.** `scripts/lib/serve-flow.js:165`: JSON gate fields do not explain which phases block validation. Show outstanding phases near the button.
6. **Minor — gate allow tests assert the obsolete contract.** `tests/plan-end-review.test.js:519`: `node --test tests/plan-end-review.test.js tests/final-page-reader.test.js` yielded 47 pass / 7 fail. Replace bare-timestamp allows with authenticated HTTP-button evidence.

Confidence: high for all findings. Probes made no disk writes or state stamps.

## Independent UI evidence

Assessment B independently ran the Impeccable detector once: 0 findings on
`scripts/lib/serve-flow.js`. Actual ephemeral HTTP GETs for `/final` and
`/flow.html` returned 200. Buttons reflected audit and stop status. Native
POST forms and visible labels exist; responsive columns stack below 650px.
Missing main landmark limits screen-reader navigation. PR URL was plain text.

Browser rendering, keyboard interaction, and overflow were unavailable:
no browser tool, Playwright/Puppeteer packages, or Chromium/Chrome executable.
Temporary server and fixtures were closed/removed. No dependencies installed.

Questions skipped: the operator explicitly requested fully automatic implementation.

## Baseline verification before F5 changes

`npm test`: 3612 tests; 3573 passed, 28 failed, 11 skipped (155 seconds).
The existing failures span spawn fixtures, skill documentation/compatibility,
catalog/install counts and closure, materialization, schema drift, byte budgets,
transition prose, and worktree routing. Raw log: `/tmp/real-automate-baseline-tests.log`.
`validate-skills`: all 16 skills valid. Hook suite: existing pre-commit temporary
checkout tests lack the yaml dependency (2 failures). Scoped `validate-state`
for the real-automate directory: all 9 files valid and plan cross-validated.
