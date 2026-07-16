/**
 * external-both findings merge (plan §5 / design open-question resolution).
 *
 * Pure helpers — no I/O. Skill bodies run Codex envelope then Grok envelope on
 * the same cleaned artifact, then call `mergeExternalBothFindings` to produce
 * a single triage list. Auto-apply is a non-goal; humans still triage.
 *
 * Contract:
 * - Order: Codex first, then Grok (caller responsibility for invocation).
 * - Merge key: `file:line` + normalized claim text.
 * - Severity conflict: keep the higher severity; provenance lists both.
 * - Per-provider status is explicit: `succeeded` | `failed` | `skipped`.
 *   Absent provider keys default to `skipped` (never "succeeded by omission").
 * - Partial failure: keep the successful provider's findings; surface the
 *   failed provider error; never drop the good half silently.
 * - Collect-then-merge: callers must finish both legs (or skip) before triage.
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

/** @typedef {'codex' | 'grok'} ExternalProvider */

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
 * @property {ExternalProvider[]} providers - dual provenance when both sides agree
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
  // Accept "12", 12, "12-20" → start line only for identity.
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
 * Rules:
 * - Missing key / null side → `skipped` (never treat absence as success).
 * - Explicit `status` ∈ {succeeded, failed, skipped} wins.
 * - Else `error` text → `failed`.
 * - Else key present → `succeeded` (findings may be empty).
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
    // succeeded — keep optional error surface empty; findings as given
    return { status, findings, error: null };
  }

  // Infer when status omitted.
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
 * Merge two provider finding lists. Codex is the left/first provider; Grok is
 * the right/second. Identity is `file:line` + normalized claim. On conflict,
 * higher severity wins and `providers` lists both. Unknown severities rank
 * below known ones; equal rank keeps the Codex body as primary.
 *
 * Provider participation uses explicit status (`succeeded` | `failed` |
 * `skipped`). An omitted provider key is `skipped`, not succeeded. Findings
 * from skipped providers are ignored. Failed providers still contribute any
 * findings they produced (best-effort) while remaining in `providersFailed`.
 *
 * @param {object} input
 * @param {ProviderSide} [input.codex]
 * @param {ProviderSide} [input.grok]
 * @returns {{
 *   findings: MergedFinding[],
 *   errors: { codex?: string, grok?: string },
 *   partial: boolean,
 *   providerStatus: { codex: ProviderStatus, grok: ProviderStatus },
 *   providersSucceeded: ExternalProvider[],
 *   providersFailed: ExternalProvider[],
 *   providersSkipped: ExternalProvider[],
 * }}
 */
export function mergeExternalBothFindings(input = {}) {
  const codexSide = resolveProviderSide(input, 'codex');
  const grokSide = resolveProviderSide(input, 'grok');

  /** @type {Map<string, MergedFinding>} */
  const byKey = new Map();

  // Only merge findings from non-skipped legs (failed may still have partial output).
  if (codexSide.status !== 'skipped') {
    for (const f of codexSide.findings) {
      if (!f || typeof f !== 'object') continue;
      const merged = toMerged(/** @type {FindingInput} */ (f), 'codex');
      if (!merged.mergeKey || merged.mergeKey === ':::') continue;
      byKey.set(merged.mergeKey, merged);
    }
  }

  if (grokSide.status !== 'skipped') {
    for (const f of grokSide.findings) {
      if (!f || typeof f !== 'object') continue;
      const incoming = toMerged(/** @type {FindingInput} */ (f), 'grok');
      if (!incoming.mergeKey || incoming.mergeKey === ':::') continue;
      const existing = byKey.get(incoming.mergeKey);
      if (!existing) {
        byKey.set(incoming.mergeKey, incoming);
        continue;
      }
      // Same identity — dual provenance; higher severity wins body.
      const cmp = compareSeverity(incoming.severity, existing.severity);
      if (cmp > 0) {
        // Grok higher — take Grok body, remember Codex severity if different.
        const otherSeverity = existing.severity;
        const next = {
          ...incoming,
          providers: uniqueProviders([...existing.providers, 'grok']),
          primaryProvider: /** @type {ExternalProvider} */ ('grok'),
        };
        if (normalizeSeverity(otherSeverity) !== normalizeSeverity(incoming.severity)) {
          next.otherSeverity = otherSeverity;
        }
        byKey.set(incoming.mergeKey, next);
      } else {
        // Codex wins body (higher or equal). Still dual provenance.
        const next = {
          ...existing,
          providers: uniqueProviders([...existing.providers, 'grok']),
        };
        if (cmp < 0 && normalizeSeverity(incoming.severity) !== normalizeSeverity(existing.severity)) {
          next.otherSeverity = incoming.severity;
        }
        byKey.set(incoming.mergeKey, next);
      }
    }
  }

  // Stable order: severity desc, then mergeKey asc for determinism.
  const findings = [...byKey.values()].sort((a, b) => {
    const c = compareSeverity(b.severity, a.severity);
    if (c !== 0) return c;
    return a.mergeKey.localeCompare(b.mergeKey);
  });

  /** @type {{ codex?: string, grok?: string }} */
  const errors = {};
  if (codexSide.error) errors.codex = codexSide.error;
  if (grokSide.error) errors.grok = grokSide.error;

  /** @type {{ codex: ProviderStatus, grok: ProviderStatus }} */
  const providerStatus = {
    codex: codexSide.status,
    grok: grokSide.status,
  };

  /** @type {ExternalProvider[]} */
  const providersSucceeded = [];
  /** @type {ExternalProvider[]} */
  const providersFailed = [];
  /** @type {ExternalProvider[]} */
  const providersSkipped = [];

  for (const p of /** @type {const} */ (['codex', 'grok'])) {
    const st = providerStatus[p];
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
