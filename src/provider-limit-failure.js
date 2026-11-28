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
 * @param {object} input
 * @param {string | null} [input.stdout]
 * @param {string | null} [input.stderr]
 * @param {number | null} [input.exitCode]
 * @returns {{ combinedFull: string, scan: string, resetsAt: string | null, exitCode: number }}
 */
function limitScanContext(input) {
  const combinedFull = `${norm(input.stdout)}\n${norm(input.stderr)}`.trim();
  return {
    combinedFull,
    scan: headForLimitScan(combinedFull),
    resetsAt: parseResetsAt(combinedFull),
    exitCode: Number(input.exitCode),
  };
}

/**
 * Short banners only — long review prose mentioning "rate limit" is a finding,
 * not an abort. A non-zero exit also makes a banner-like match actionable.
 *
 * @param {string} scan
 * @param {number} exitCode
 * @returns {boolean}
 */
function isBannerOrFailure(scan, exitCode) {
  return scan.length < 400 || exitCode !== 0;
}

/**
 * @param {string | null} resetsAt
 * @returns {string}
 */
function resetsHint(resetsAt) {
  return resetsAt ? ` Resets ${resetsAt}.` : '';
}

/**
 * @param {string} scan
 * @returns {ProviderLimitFailure}
 */
function authFailure(scan) {
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

/**
 * @param {string} scan
 * @param {string | null} resetsAt
 * @returns {ProviderLimitFailure}
 */
function sessionLimitFailure(scan, resetsAt) {
  return {
    kind: 'session-limit',
    message:
      `Claude session limit hit (CLI often exits 0 with a banner — not a review).${resetsHint(resetsAt)} ` +
      `Do not retry this provider until the window resets. Use another family-different provider ` +
      `(e.g. --mode=codex) or wait and re-run.`,
    resetsAt,
    retryable: false,
    doNotRetry: true,
    rawMatch: scan.match(SESSION_LIMIT_RE)?.[0],
  };
}

/**
 * @param {string} scan
 * @param {string | null} resetsAt
 * @returns {ProviderLimitFailure}
 */
function usageLimitFailure(scan, resetsAt) {
  return {
    kind: 'usage-limit',
    message:
      `Provider usage limit hit.${resetsHint(resetsAt)} Do not retry until reset. Switch provider or wait.`,
    resetsAt,
    retryable: false,
    doNotRetry: true,
    rawMatch: scan.match(USAGE_LIMIT_RE)?.[0],
  };
}

/**
 * @param {string} scan
 * @param {string | null} resetsAt
 * @returns {ProviderLimitFailure}
 */
function rateLimitFailure(scan, resetsAt) {
  return {
    kind: 'rate-limit',
    message:
      `Provider rate limit hit.${resetsHint(resetsAt)} Wait briefly or switch provider; do not burn a corrective retry.`,
    resetsAt,
    retryable: true,
    doNotRetry: true,
    rawMatch: scan.match(RATE_LIMIT_RE)?.[0],
  };
}

/**
 * @param {string} scan
 * @returns {ProviderLimitFailure}
 */
function overloadedFailure(scan) {
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
  const { combinedFull, scan, resetsAt, exitCode } = limitScanContext(input);
  if (!combinedFull) return null;

  // Auth first — same treatment as preflight abort (do not treat as review).
  if (AUTH_RE.test(scan)) return authFailure(scan);
  if (SESSION_LIMIT_RE.test(scan)) return sessionLimitFailure(scan, resetsAt);
  if (USAGE_LIMIT_RE.test(scan)) return usageLimitFailure(scan, resetsAt);
  if (RATE_LIMIT_RE.test(scan) && isBannerOrFailure(scan, exitCode)) {
    return rateLimitFailure(scan, resetsAt);
  }
  if (OVERLOADED_RE.test(scan) && isBannerOrFailure(scan, exitCode)) {
    return overloadedFailure(scan);
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
