/**
 * Pure classifier for external-reviewer CLI outputs that look like capacity /
 * session / rate-limit failures (not review findings).
 *
 * Claude Code dogfood (2026-08): session limit prints to stdout and often exits 0:
 *   "You've hit your session limit · resets 5:10pm (America/Sao_Paulo)"
 * Treating that as success poisons the envelope (validation retry burns more quota).
 *
 * No I/O. Call after each provider invoke (Pass 1 / Pass 2) before validation.
 */

/** @typedef {'session-limit' | 'rate-limit' | 'usage-limit' | 'auth' | 'overloaded'} LimitFailureKind */

/**
 * @typedef {object} ProviderLimitFailure
 * @property {LimitFailureKind} kind
 * @property {string} message - operator-facing one-liner
 * @property {string | null} [resetsAt] - free-form reset hint when parseable
 * @property {boolean} retryable - false for hard windows (session/usage); true only for transient overload
 * @property {boolean} doNotRetry - always true for limit windows (no corrective re-invoke)
 * @property {string} [rawMatch]
 */

const SESSION_LIMIT_RE =
  /you'?ve\s+hit\s+your\s+session\s+limit|session\s+limit\s*[·•\-–—]?\s*resets|hit\s+your\s+session\s+limit/i;

const RATE_LIMIT_RE =
  /\brate[\s_-]?limit(?:ed|s)?\b|\b429\b|too\s+many\s+requests/i;

const USAGE_LIMIT_RE =
  /\busage\s+limit\b|\bweekly\s+(?:usage\s+)?limit\b|\bhit\s+your\s+(?:usage|limit)\b/i;

const AUTH_RE =
  /not\s+logged\s+in|please\s+run\s+\/login|claude\s+auth\s+login|authentication_failed|invalid\s+api\s+key|not\s+signed\s+in/i;

const OVERLOADED_RE =
  /\boverloaded\b|\bcapacity\b.*\bunavailable\b|model\s+is\s+(?:currently\s+)?unavailable/i;

/** Capture "resets 5:10pm (America/Sao_Paulo)" / "resets at 17:10" style tails. */
const RESETS_AT_RE =
  /resets(?:\s+at)?\s+([^\n.]+?)(?:\s*$|\n|\.\s)/i;

/**
 * @param {string | null | undefined} text
 * @returns {string}
 */
function norm(text) {
  return String(text || '').replace(/\r\n/g, '\n');
}

/**
 * Prefer the first ~2KB when checking limit markers so a long legitimate review
 * that happens to mention "rate limit" in a finding is not false-positive.
 * Short outputs (typical limit banners) are scanned fully.
 *
 * @param {string} text
 * @returns {string}
 */
function headForLimitScan(text) {
  const t = norm(text).trim();
  if (t.length <= 2048) return t;
  return t.slice(0, 2048);
}

/**
 * @param {string} combined
 * @returns {string | null}
 */
function parseResetsAt(combined) {
  const m = combined.match(RESETS_AT_RE);
  if (!m) return null;
  return m[1].trim().replace(/\s+/g, ' ') || null;
}

/**
 * Classify stdout+stderr from a provider CLI invoke.
 *
 * @param {object} input
 * @param {string} [input.provider] - codex | grok | claude (informational)
 * @param {string | null} [input.stdout]
 * @param {string | null} [input.stderr]
 * @param {number | null} [input.exitCode] - Claude session limit often exits 0
 * @returns {ProviderLimitFailure | null}
 */
export function classifyProviderLimitFailure(input = {}) {
  const stdout = norm(input.stdout);
  const stderr = norm(input.stderr);
  const combinedFull = `${stdout}\n${stderr}`.trim();
  if (!combinedFull) return null;

  const scan = headForLimitScan(combinedFull);
  const resetsAt = parseResetsAt(combinedFull);

  // Auth first — same treatment as preflight abort (do not treat as review).
  if (AUTH_RE.test(scan)) {
    return {
      kind: 'auth',
      message:
        'Provider authentication failed. Re-auth the CLI (e.g. `claude auth login` / `codex login` / `grok login`) or set the API key, then retry.',
      resetsAt: null,
      retryable: false,
      doNotRetry: true,
      rawMatch: scan.match(AUTH_RE)?.[0],
    };
  }

  if (SESSION_LIMIT_RE.test(scan)) {
    const when = resetsAt ? ` Resets ${resetsAt}.` : '';
    return {
      kind: 'session-limit',
      message:
        `Claude session limit hit (CLI often exits 0 with a banner — not a review).${when} ` +
        `Do not retry this provider until the window resets. Use another family-different provider ` +
        `(e.g. --mode=codex) or wait and re-run.`,
      resetsAt,
      retryable: false,
      doNotRetry: true,
      rawMatch: scan.match(SESSION_LIMIT_RE)?.[0],
    };
  }

  if (USAGE_LIMIT_RE.test(scan)) {
    const when = resetsAt ? ` Resets ${resetsAt}.` : '';
    return {
      kind: 'usage-limit',
      message:
        `Provider usage limit hit.${when} Do not retry until reset. Switch provider or wait.`,
      resetsAt,
      retryable: false,
      doNotRetry: true,
      rawMatch: scan.match(USAGE_LIMIT_RE)?.[0],
    };
  }

  if (RATE_LIMIT_RE.test(scan)) {
    // Short banners only — long review prose mentioning "rate limit" as a finding
    // should not abort. If the head is mostly the banner (or exit non-zero), flag it.
    const short = scan.length < 400 || Number(input.exitCode) !== 0;
    if (short) {
      const when = resetsAt ? ` Resets ${resetsAt}.` : '';
      return {
        kind: 'rate-limit',
        message:
          `Provider rate limit hit.${when} Wait briefly or switch provider; do not burn a corrective retry.`,
        resetsAt,
        retryable: true,
        doNotRetry: true,
        rawMatch: scan.match(RATE_LIMIT_RE)?.[0],
      };
    }
  }

  if (OVERLOADED_RE.test(scan) && (scan.length < 400 || Number(input.exitCode) !== 0)) {
    return {
      kind: 'overloaded',
      message:
        'Provider model overloaded/unavailable. Try --fallback-model / another model id, or switch provider.',
      resetsAt: null,
      retryable: true,
      doNotRetry: true,
      rawMatch: scan.match(OVERLOADED_RE)?.[0],
    };
  }

  return null;
}

/**
 * Operator-facing abort / continue text after a limit failure.
 *
 * @param {ProviderLimitFailure} failure
 * @param {{ mode?: string, alternateModes?: string[] }} [opts]
 * @returns {string}
 */
export function formatProviderLimitFailureMessage(failure, opts = {}) {
  const alts = (opts.alternateModes && opts.alternateModes.length
    ? opts.alternateModes
    : ['codex', 'grok']
  )
    .map((m) => `--mode=${m}`)
    .join(' | ');
  const modeHint =
    opts.mode === 'external-both'
      ? 'external-both: record this leg as failed and continue other legs (do not abort the merge).'
      : `Single-provider mode: ABORT this external leg. Alternatives: ${alts}, or wait until reset.`;
  return `${failure.message}\n${modeHint}`;
}
