/**
 * Pure decision package builder (F1 present-before-PASS).
 *
 * Builds a host-renderable package from listDecisions-like entries so the
 * operator can read decisions before PASS/FAIL. Does not stamp
 * decisionReview PASS. No network I/O.
 */

/** Explicit banner when the phase decision log has zero entries. */
export const NO_DECISIONS_BANNER =
  'No decisions recorded for this phase — empty decision log (explicit no-decisions package).';

/**
 * @typedef {{
 *   category: string,
 *   decision: string,
 *   why: string,
 *   impact: string,
 *   evidencePath: string,
 *   id?: string,
 *   at?: string,
 * }} DecisionPackageEntry
 */

/**
 * @typedef {{
 *   phaseId: string,
 *   path: string,
 *   entries: DecisionPackageEntry[],
 *   empty: boolean,
 *   summaryMarkdown: string,
 * }} DecisionPackage
 */

/**
 * Normalize one listDecisions-like row into package entry fields.
 *
 * @param {unknown} raw
 * @returns {DecisionPackageEntry | null}
 */
function normalizePackageEntry(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
  const category =
    o.category != null && String(o.category).trim()
      ? String(o.category).trim()
      : '';
  const decision =
    o.decision != null && String(o.decision).trim()
      ? String(o.decision).trim()
      : '';
  const why =
    o.why != null && String(o.why).trim() ? String(o.why).trim() : '';
  const impact =
    o.impact != null && String(o.impact).trim()
      ? String(o.impact).trim()
      : '';
  if (!category && !decision && !why && !impact) {
    return null;
  }
  let evidencePath = 'none';
  if (Object.prototype.hasOwnProperty.call(o, 'evidencePath')) {
    if (o.evidencePath != null && String(o.evidencePath).trim()) {
      evidencePath = String(o.evidencePath).trim();
    }
  }
  /** @type {DecisionPackageEntry} */
  const entry = {
    category: category || '(uncategorized)',
    decision: decision || '(no decision text)',
    why: why || '(no rationale)',
    impact: impact || '(no impact)',
    evidencePath,
  };
  if (o.id != null && String(o.id).trim()) {
    entry.id = String(o.id).trim();
  }
  if (o.at != null && String(o.at).trim()) {
    entry.at = String(o.at).trim();
  }
  return entry;
}

/**
 * Render markdown summary for host present-before-PASS (read-before-PASS).
 *
 * @param {{
 *   phaseId: string,
 *   path: string,
 *   entries: DecisionPackageEntry[],
 *   empty: boolean,
 * }} input
 * @returns {string}
 */
function buildSummaryMarkdown(input) {
  const lines = [
    `# Decision package — phase ${input.phaseId}`,
    '',
    `**Log path:** \`${input.path || '(none)'}\``,
    '',
  ];
  if (input.empty) {
    lines.push(`> **${NO_DECISIONS_BANNER}**`, '');
    lines.push(
      'Operator may still PASS or FAIL after acknowledging the empty package.',
      '',
    );
    return lines.join('\n');
  }
  lines.push(`**Entries:** ${input.entries.length}`, '');
  lines.push('| # | category | decision | why | impact | evidencePath |');
  lines.push('|---|----------|----------|-----|--------|--------------|');
  input.entries.forEach((e, i) => {
    const cell = (s) =>
      String(s ?? '')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ');
    lines.push(
      `| ${i + 1} | ${cell(e.category)} | ${cell(e.decision)} | ${cell(e.why)} | ${cell(e.impact)} | ${cell(e.evidencePath)} |`,
    );
  });
  lines.push('');
  return lines.join('\n');
}

/**
 * Build a decision package for host presentation before operator PASS/FAIL.
 *
 * Pure: accepts listDecisions-like `entries` (or empty/missing → empty package).
 * Never stamps decisionReview. Never writes files.
 *
 * @param {{
 *   phaseId?: string | null,
 *   path?: string | null,
 *   entries?: unknown[] | null,
 * }} [input]
 * @returns {DecisionPackage}
 */
export function buildDecisionPackage(input = {}) {
  const phaseId =
    input.phaseId != null && String(input.phaseId).trim()
      ? String(input.phaseId).trim()
      : '';
  const path =
    input.path != null && String(input.path).trim()
      ? String(input.path).trim()
      : '';
  const rawList = Array.isArray(input.entries) ? input.entries : [];
  /** @type {DecisionPackageEntry[]} */
  const entries = [];
  for (const raw of rawList) {
    const n = normalizePackageEntry(raw);
    if (n) entries.push(n);
  }
  const empty = entries.length === 0;
  const summaryMarkdown = buildSummaryMarkdown({
    phaseId: phaseId || '(unknown)',
    path,
    entries,
    empty,
  });
  return {
    phaseId: phaseId || '(unknown)',
    path,
    entries,
    empty,
    summaryMarkdown,
  };
}
