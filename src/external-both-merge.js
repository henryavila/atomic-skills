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
 * - Partial failure: keep the successful provider's findings; surface the
 *   failed provider error; never drop the good half silently.
 */

/** @typedef {'blocker' | 'critical' | 'major' | 'minor' | 'nit'} Severity */

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
 * @param {object} input
 * @param {{ findings?: FindingInput[], error?: string|null }} [input.codex]
 * @param {{ findings?: FindingInput[], error?: string|null }} [input.grok]
 * @returns {{
 *   findings: MergedFinding[],
 *   errors: { codex?: string, grok?: string },
 *   partial: boolean,
 *   providersSucceeded: ExternalProvider[],
 *   providersFailed: ExternalProvider[],
 * }}
 */
export function mergeExternalBothFindings(input = {}) {
  const codex = input.codex ?? {};
  const grok = input.grok ?? {};
  const codexFindings = Array.isArray(codex.findings) ? codex.findings : [];
  const grokFindings = Array.isArray(grok.findings) ? grok.findings : [];
  const codexError = hasText(codex.error) ? String(codex.error) : null;
  const grokError = hasText(grok.error) ? String(grok.error) : null;

  /** @type {Map<string, MergedFinding>} */
  const byKey = new Map();

  for (const f of codexFindings) {
    if (!f || typeof f !== 'object') continue;
    const merged = toMerged(/** @type {FindingInput} */ (f), 'codex');
    if (!merged.mergeKey || merged.mergeKey === ':::') continue;
    byKey.set(merged.mergeKey, merged);
  }

  for (const f of grokFindings) {
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

  // Stable order: severity desc, then mergeKey asc for determinism.
  const findings = [...byKey.values()].sort((a, b) => {
    const c = compareSeverity(b.severity, a.severity);
    if (c !== 0) return c;
    return a.mergeKey.localeCompare(b.mergeKey);
  });

  /** @type {{ codex?: string, grok?: string }} */
  const errors = {};
  if (codexError) errors.codex = codexError;
  if (grokError) errors.grok = grokError;

  /** @type {ExternalProvider[]} */
  const providersFailed = [];
  /** @type {ExternalProvider[]} */
  const providersSucceeded = [];
  if (codexError) providersFailed.push('codex');
  else providersSucceeded.push('codex');
  if (grokError) providersFailed.push('grok');
  else providersSucceeded.push('grok');

  const partial = providersFailed.length > 0 && providersSucceeded.length > 0;

  return {
    findings,
    errors,
    partial,
    providersSucceeded,
    providersFailed,
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
