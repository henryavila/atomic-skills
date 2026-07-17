/**
 * external-both findings merge (plan §5 / design open-question resolution).
 *
 * Pure helpers — no I/O. Skill bodies run each external envelope on the same
 * cleaned artifact, then call `mergeExternalBothFindings` to produce a single
 * triage list. Auto-apply is a non-goal; humans still triage.
 *
 * Contract:
 * - Order: codex → grok → claude (caller responsibility for invocation).
 * - Merge key: `file:line` + normalized claim text.
 * - Severity conflict: keep the higher severity; provenance lists all.
 * - Per-provider status is explicit: `succeeded` | `failed` | `skipped`.
 *   Absent provider keys default to `skipped` (never "succeeded by omission").
 * - Partial failure: keep the successful provider's findings; surface the
 *   failed provider error; never drop the good half silently.
 * - Collect-then-merge: callers must finish all legs (or skip) before triage.
 */

/** @typedef {'blocker' | 'critical' | 'major' | 'minor' | 'nit'} Severity */

/** @typedef {'succeeded' | 'failed' | 'skipped'} ProviderStatus */

/** @type {readonly Severity[]} */
export const SEVERITY_ORDER = Object.freeze([
  'blocker',
  'critical',
  'major',
  'minor',
  'nit',
]);

const SEVERITY_RANK = Object.freeze(
  Object.fromEntries(SEVERITY_ORDER.map((s, i) => [s, SEVERITY_ORDER.length - i])),
);

/** @typedef {'codex' | 'grok' | 'claude'} ExternalProvider */

/** Fixed merge / invocation order. */
export const EXTERNAL_PROVIDER_ORDER = Object.freeze(
  /** @type {const} */ (['codex', 'grok', 'claude']),
);

/**
 * @typedef {object} FindingInput
 * @property {string} file
 * @property {number|string} line - start line (range end ignored for identity)
 * @property {string} claim
 * @property {string} [severity]
 * @property {string} [category]
 * @property {string} [id]
 * @property {string} [evidence]
 * @property {string} [impact]
 * @property {string} [recommendation]
 * @property {string} [confidence]
 */

/**
 * @typedef {object} ProviderSide
 * @property {ProviderStatus} [status] - explicit; inferred when omitted
 * @property {FindingInput[]} [findings]
 * @property {string|null} [error]
 * @property {string} [reason] - optional skip/fail reason (surfaced in errors when failed)
 */

/**
 * @typedef {object} MergedFinding
 * @property {string} file
 * @property {number|string} line
 * @property {string} claim
 * @property {Severity|string} severity
 * @property {string} [category]
 * @property {string} mergeKey
 * @property {ExternalProvider[]} providers - dual/triple provenance when sides agree
 * @property {ExternalProvider} primaryProvider - side that supplied the kept body
 * @property {Severity|string} [otherSeverity] - when severities differed
 * @property {string} [id]
 * @property {string} [evidence]
 * @property {string} [impact]
 * @property {string} [recommendation]
 * @property {string} [confidence]
 */

/**
 * Normalize claim text for identity: trim, collapse whitespace, lowercase,
 * strip trailing sentence punctuation.
 *
 * @param {unknown} claim
 * @returns {string}
 */
export function normalizeClaim(claim) {
  if (claim == null) return '';
  return String(claim)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[.!?]+$/g, '');
}

/**
 * @param {unknown} file
 * @param {unknown} line
 * @param {unknown} claim
 * @returns {string}
 */
export function mergeKey(file, line, claim) {
  const f = file == null ? '' : String(file).trim();
  const linePart = normalizeLine(line);
  const c = normalizeClaim(claim);
  return `${f}:${linePart}::${c}`;
}

/**
 * @param {unknown} line
 * @returns {string}
 */
function normalizeLine(line) {
  if (line == null || line === '') return '';
  const s = String(line).trim();
  const m = s.match(/^(\d+)/);
  return m ? m[1] : s;
}

/**
 * @param {unknown} severity
 * @returns {Severity|string}
 */
export function normalizeSeverity(severity) {
  if (severity == null || severity === '') return 'major';
  const s = String(severity).trim().toLowerCase();
  if (Object.hasOwn(SEVERITY_RANK, s)) return /** @type {Severity} */ (s);
  return s;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number} positive if a is higher severity than b
 */
export function compareSeverity(a, b) {
  const ra = SEVERITY_RANK[normalizeSeverity(a)] ?? 0;
  const rb = SEVERITY_RANK[normalizeSeverity(b)] ?? 0;
  return ra - rb;
}

/**
 * Resolve explicit or inferred per-provider status.
 *
 * @param {object} input
 * @param {ExternalProvider} provider
 * @returns {{ status: ProviderStatus, findings: FindingInput[], error: string|null }}
 */
export function resolveProviderSide(input, provider) {
  if (input == null || typeof input !== 'object' || !Object.hasOwn(input, provider)) {
    return { status: 'skipped', findings: [], error: null };
  }
  const side = input[provider];
  if (side == null || typeof side !== 'object') {
    return { status: 'skipped', findings: [], error: null };
  }

  const rawStatus = side.status == null ? '' : String(side.status).trim().toLowerCase();
  const findings = Array.isArray(side.findings) ? side.findings : [];
  const errorFromField = hasText(side.error)
    ? String(side.error)
    : hasText(side.reason) && rawStatus === 'failed'
      ? String(side.reason)
      : null;

  if (rawStatus === 'skipped' || rawStatus === 'failed' || rawStatus === 'succeeded') {
    /** @type {ProviderStatus} */
    const status = /** @type {ProviderStatus} */ (rawStatus);
    if (status === 'skipped') {
      return { status, findings: [], error: null };
    }
    if (status === 'failed') {
      return {
        status,
        findings,
        error: errorFromField ?? (hasText(side.reason) ? String(side.reason) : 'provider failed'),
      };
    }
    return { status, findings, error: null };
  }

  if (errorFromField) {
    return { status: 'failed', findings, error: errorFromField };
  }
  return { status: 'succeeded', findings, error: null };
}

/**
 * @param {FindingInput} finding
 * @param {ExternalProvider} provider
 * @returns {MergedFinding}
 */
function toMerged(finding, provider) {
  const file = finding.file == null ? '' : String(finding.file).trim();
  const line = normalizeLine(finding.line);
  const claim = finding.claim == null ? '' : String(finding.claim).trim();
  const severity = normalizeSeverity(finding.severity);
  const key = mergeKey(file, line, claim);
  /** @type {MergedFinding} */
  const out = {
    file,
    line: line === '' ? finding.line : Number.isFinite(Number(line)) ? Number(line) : line,
    claim,
    severity,
    mergeKey: key,
    providers: [provider],
    primaryProvider: provider,
  };
  if (finding.category != null) out.category = String(finding.category);
  if (finding.id != null) out.id = String(finding.id);
  if (finding.evidence != null) out.evidence = String(finding.evidence);
  if (finding.impact != null) out.impact = String(finding.impact);
  if (finding.recommendation != null) out.recommendation = String(finding.recommendation);
  if (finding.confidence != null) out.confidence = String(finding.confidence);
  return out;
}

/**
 * Merge provider finding lists in EXTERNAL_PROVIDER_ORDER.
 * Identity is `file:line` + normalized claim. On conflict, higher severity wins
 * and `providers` lists all. Equal rank keeps the earlier provider body.
 *
 * @param {object} input
 * @param {ProviderSide} [input.codex]
 * @param {ProviderSide} [input.grok]
 * @param {ProviderSide} [input.claude]
 * @returns {{
 *   findings: MergedFinding[],
 *   errors: Partial<Record<ExternalProvider, string>>,
 *   partial: boolean,
 *   providerStatus: Record<ExternalProvider, ProviderStatus>,
 *   providersSucceeded: ExternalProvider[],
 *   providersFailed: ExternalProvider[],
 *   providersSkipped: ExternalProvider[],
 * }}
 */
export function mergeExternalBothFindings(input = {}) {
  /** @type {Map<ExternalProvider, ReturnType<typeof resolveProviderSide>>} */
  const sides = new Map();
  for (const p of EXTERNAL_PROVIDER_ORDER) {
    sides.set(p, resolveProviderSide(input, p));
  }

  /** @type {Map<string, MergedFinding>} */
  const byKey = new Map();

  for (const p of EXTERNAL_PROVIDER_ORDER) {
    const side = sides.get(p);
    if (!side || side.status === 'skipped') continue;
    for (const f of side.findings) {
      if (!f || typeof f !== 'object') continue;
      const incoming = toMerged(/** @type {FindingInput} */ (f), p);
      if (!incoming.mergeKey || incoming.mergeKey === ':::') continue;
      const existing = byKey.get(incoming.mergeKey);
      if (!existing) {
        byKey.set(incoming.mergeKey, incoming);
        continue;
      }
      const cmp = compareSeverity(incoming.severity, existing.severity);
      if (cmp > 0) {
        const otherSeverity = existing.severity;
        const next = {
          ...incoming,
          providers: uniqueProviders([...existing.providers, p]),
          primaryProvider: p,
        };
        if (normalizeSeverity(otherSeverity) !== normalizeSeverity(incoming.severity)) {
          next.otherSeverity = otherSeverity;
        }
        byKey.set(incoming.mergeKey, next);
      } else {
        const next = {
          ...existing,
          providers: uniqueProviders([...existing.providers, p]),
        };
        if (cmp < 0 && normalizeSeverity(incoming.severity) !== normalizeSeverity(existing.severity)) {
          next.otherSeverity = incoming.severity;
        }
        byKey.set(incoming.mergeKey, next);
      }
    }
  }

  const findings = [...byKey.values()].sort((a, b) => {
    const c = compareSeverity(b.severity, a.severity);
    if (c !== 0) return c;
    return a.mergeKey.localeCompare(b.mergeKey);
  });

  /** @type {Partial<Record<ExternalProvider, string>>} */
  const errors = {};
  /** @type {Record<ExternalProvider, ProviderStatus>} */
  const providerStatus = /** @type {Record<ExternalProvider, ProviderStatus>} */ ({});
  /** @type {ExternalProvider[]} */
  const providersSucceeded = [];
  /** @type {ExternalProvider[]} */
  const providersFailed = [];
  /** @type {ExternalProvider[]} */
  const providersSkipped = [];

  for (const p of EXTERNAL_PROVIDER_ORDER) {
    const side = sides.get(p);
    const st = side?.status ?? 'skipped';
    providerStatus[p] = st;
    if (side?.error) errors[p] = side.error;
    if (st === 'succeeded') providersSucceeded.push(p);
    else if (st === 'failed') providersFailed.push(p);
    else providersSkipped.push(p);
  }

  const partial = providersFailed.length > 0 && providersSucceeded.length > 0;

  return {
    findings,
    errors,
    partial,
    providerStatus,
    providersSucceeded,
    providersFailed,
    providersSkipped,
  };
}

/**
 * @param {ExternalProvider[]} list
 * @returns {ExternalProvider[]}
 */
function uniqueProviders(list) {
  const out = [];
  for (const p of list) {
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function hasText(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
