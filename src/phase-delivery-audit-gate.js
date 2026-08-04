/**
 * Pure phase delivery-audit gate (implement hard-gate on every phase-done).
 *
 * D11 / F2 T-017: every phase-done (Mode-1 prose + pure-maestro machine path)
 * requires a real `audit-delivery` run and a durable `deliveryAuditGate` stamp.
 *
 * **NEVER skippable** (unlike evaluationGate / reviewGate):
 *   - no `operatorSkip`
 *   - no `status: skipped` acceptance
 *   - no reason-only / chat-only "we audited"
 *   - missing gate, empty reportPath, OPEN verdict all fail closed
 *
 * Stamp shape (EN SSOT):
 *   { status: 'passed', reportPath, verdict: 'CLOSED'|'PARTIAL', verifiedAt }
 *   - OPEN never stamps `passed`
 *   - PARTIAL may stamp passed only under skill Accept Record rules (caller
 *     responsibility for report content; honesty checks verdict + reportPath)
 *
 * Plan-end lifecycle `intentVsDelivered` is **not** a substitute for this gate.
 *
 * Non-automate: `deliveryAuditAllowsClose` inactive (ok) — Mode-1 still has
 * implement.md HARD-GATE prose. Under durable automate / session automate,
 * honesty is required before phase-done.
 */

import { isDurableAutomateActive } from './plan-end-review.js';

/** Verdicts that may stamp status=passed (EN skill SSOT). */
export const DELIVERY_AUDIT_PASS_VERDICTS = Object.freeze(['CLOSED', 'PARTIAL']);

const PASS_VERDICT_SET = new Set(
  DELIVERY_AUDIT_PASS_VERDICTS.map((v) => v.toUpperCase()),
);

/**
 * Whether durable automate delivery-audit order applies (stamp-first).
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 * }} [input]
 * @returns {boolean}
 */
export function isDurableAutomateForDeliveryAudit(input = {}) {
  return isDurableAutomateActive(input);
}

/**
 * @typedef {{
 *   status?: string | null,
 *   reportPath?: string | null,
 *   verdict?: string | null,
 *   verifiedAt?: string | null,
 *   at?: string | null,
 *   operatorSkip?: boolean | null,
 *   reason?: string | null,
 * }} DeliveryAuditGate
 */

/**
 * Normalize skill verdict token (CLOSED|PARTIAL|OPEN).
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeVerdict(raw) {
  return raw != null ? String(raw).trim().toUpperCase() : '';
}

/**
 * Pure honesty check for a deliveryAuditGate object (no automate stamp).
 *
 * Shared by deliveryAuditAllowsClose / canRunPhaseDone / assert phase-done.
 *
 * Rejects (fail closed):
 *   - missing / non-object gate
 *   - status skipped | failed | anything other than passed
 *   - operatorSkip true (illegal on this gate)
 *   - reason-only without valid passed stamp
 *   - empty reportPath
 *   - verdict OPEN or missing / unknown
 *   - verdict not CLOSED|PARTIAL when status=passed
 *
 * @param {DeliveryAuditGate | null | undefined} gate
 * @returns {{ ok: boolean, reason?: string }}
 */
export function deliveryAuditGateHonesty(gate) {
  if (gate == null || typeof gate !== 'object') {
    return {
      ok: false,
      reason:
        'automate requires deliveryAuditGate before phase-done (run atomic-skills:audit-delivery, write report under .atomic-skills/reviews/, stamp phases[].deliveryAuditGate — skip is illegal)',
    };
  }

  const status =
    gate.status != null ? String(gate.status).trim().toLowerCase() : '';

  // Skip path does not exist for this gate (D11) — check skipped before other fields.
  if (status === 'skipped' || status === 'skip') {
    return {
      ok: false,
      reason:
        'deliveryAuditGate status=skipped is illegal — run audit-delivery and stamp status=passed with CLOSED|PARTIAL + reportPath',
    };
  }

  if (gate.operatorSkip === true) {
    return {
      ok: false,
      reason:
        'deliveryAuditGate forbids operatorSkip — audit-delivery is never skippable on phase-done',
    };
  }

  if (status !== 'passed') {
    if (status === '') {
      return {
        ok: false,
        reason:
          'deliveryAuditGate missing status — require status=passed + verdict CLOSED|PARTIAL + non-empty reportPath',
      };
    }
    return {
      ok: false,
      reason: `deliveryAuditGate status=${status} does not allow phase-done (only status=passed with CLOSED|PARTIAL)`,
    };
  }

  const reportPath =
    gate.reportPath != null ? String(gate.reportPath).trim() : '';
  if (reportPath === '') {
    return {
      ok: false,
      reason:
        'deliveryAuditGate status=passed requires non-empty reportPath (audit-delivery report under .atomic-skills/reviews/)',
    };
  }

  const verdict = normalizeVerdict(gate.verdict);
  if (verdict === 'OPEN') {
    return {
      ok: false,
      reason:
        'deliveryAuditGate verdict=OPEN never stamps passed / never allows phase-done — fix CRITICAL/load-bearing gaps or re-run audit-delivery to CLOSED|PARTIAL',
    };
  }
  if (!PASS_VERDICT_SET.has(verdict)) {
    return {
      ok: false,
      reason:
        'deliveryAuditGate status=passed requires verdict CLOSED|PARTIAL (EN SSOT) — OPEN and empty verdict fail closed',
    };
  }

  return { ok: true };
}

/** Min report body size for assert-side content floor (medium). */
export const DELIVERY_AUDIT_REPORT_MIN_BYTES = 200;

/** Greppable content markers for a real audit-delivery report. */
export const DELIVERY_AUDIT_REPORT_CONTENT_KEYS = Object.freeze([
  'verdict',
  'intent',
  'residual',
  'matrix',
  'findings',
]);

/**
 * Pure content floor for an audit-delivery report body (no FS).
 * Accepts multi-line bodies with min bytes and/or structured keys.
 * Thin one/two-line stubs fail.
 *
 * @param {string | Buffer | Uint8Array | null | undefined} content
 * @param {{ minBytes?: number, label?: string }} [opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function deliveryAuditReportContentFloor(content, opts = {}) {
  const label = opts.label != null ? String(opts.label) : 'audit-delivery report';
  const minBytes =
    typeof opts.minBytes === 'number' && opts.minBytes > 0
      ? opts.minBytes
      : DELIVERY_AUDIT_REPORT_MIN_BYTES;

  if (content == null) {
    return {
      ok: false,
      reason: `deliveryAuditGate report content floor: ${label} missing`,
    };
  }

  /** @type {string} */
  let text;
  if (Buffer.isBuffer(content) || content instanceof Uint8Array) {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (buf.includes(0)) {
      return {
        ok: false,
        reason: `deliveryAuditGate report content floor: ${label} is binary/null-byte`,
      };
    }
    text = buf.toString('utf8');
  } else if (typeof content === 'string') {
    text = content;
  } else {
    return {
      ok: false,
      reason: `deliveryAuditGate report content floor: ${label} must be string or bytes`,
    };
  }

  const bytes = Buffer.byteLength(text, 'utf8');
  const nonEmptyLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (nonEmptyLines.length <= 1) {
    return {
      ok: false,
      reason: `deliveryAuditGate report content floor: ${label} is a one-line stub`,
    };
  }

  const lower = text.toLowerCase();
  let keyHits = 0;
  for (const key of DELIVERY_AUDIT_REPORT_CONTENT_KEYS) {
    if (lower.includes(key.toLowerCase())) keyHits += 1;
  }
  const structuredOk = keyHits >= 2 && nonEmptyLines.length >= 4;
  const sizeOk = bytes >= minBytes && nonEmptyLines.length >= 3;

  if (!structuredOk && !sizeOk) {
    return {
      ok: false,
      reason: `deliveryAuditGate report content floor: ${label} fails min keys/bytes (${bytes} bytes, ${keyHits} keys, ${nonEmptyLines.length} lines)`,
    };
  }

  return { ok: true };
}

/**
 * Extract EN verdict token from report body (**Verdict:** / Verdict: lines).
 * @param {string} text
 * @returns {string} uppercase CLOSED|PARTIAL|OPEN or ''
 */
export function parseDeliveryAuditReportVerdict(text) {
  if (typeof text !== 'string' || !text.trim()) return '';
  const m = text.match(
    /\*{0,2}verdict\*{0,2}\s*:\s*\*{0,2}\s*(CLOSED|PARTIAL|OPEN)\b/i,
  );
  return m ? m[1].toUpperCase() : '';
}

/**
 * Detect open CRITICAL residual rows that would forbid CLOSED.
 * Heuristic: residual/ledger section lines mentioning CRITICAL without
 * RESOLVED/Accept/N/A closure markers.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function reportHasOpenCriticalResidual(text) {
  if (typeof text !== 'string' || !text.trim()) return false;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!/\bcritical\b/i.test(line)) continue;
    // Skip headings / prose that are not open findings
    if (/^#{1,6}\s/.test(line.trim())) continue;
    if (/\b(never|forbids?|illegal|zero\s+critical|no\s+critical)\b/i.test(line)) {
      continue;
    }
    // Closed / accepted residual is OK
    if (
      /\b(resolved|accept\s*record|accepted|n\/a|none)\b/i.test(line) &&
      !/\b(unresolved|still\s+open|open\s+critical)\b/i.test(line)
    ) {
      continue;
    }
    // Open residual language
    if (
      /\b(open|unresolved|remaining|still|residual)\b/i.test(line) ||
      /^\s*[-*|]\s*.*\bcritical\b/i.test(line)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Content authenticity for deliveryAuditGate.reportPath when content/I/O available.
 * Pure when content is injected; optional readFile for assert CLI.
 *
 * @param {DeliveryAuditGate | null | undefined} gate
 * @param {{
 *   reportContents?: Record<string, string | Buffer | Uint8Array> | null,
 *   reportContent?: string | Buffer | Uint8Array | null,
 *   readFile?: ((path: string) => string | Buffer) | null,
 *   exists?: ((path: string) => boolean) | null,
 *   cwd?: string | null,
 *   minBytes?: number,
 *   checkAuthenticity?: boolean,
 * }} [opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function deliveryAuditGateAuthenticity(gate, opts = {}) {
  if (opts.checkAuthenticity === false) {
    return { ok: true };
  }
  if (gate == null || typeof gate !== 'object') {
    return {
      ok: false,
      reason: 'deliveryAuditGate authenticity requires gate object',
    };
  }
  const status =
    gate.status != null ? String(gate.status).trim().toLowerCase() : '';
  if (status !== 'passed') {
    // Non-passed shapes handled by honesty (fail closed elsewhere).
    return { ok: true };
  }

  const reportPath =
    gate.reportPath != null ? String(gate.reportPath).trim() : '';
  if (reportPath === '') {
    return {
      ok: false,
      reason:
        'deliveryAuditGate authenticity requires non-empty reportPath when status=passed',
    };
  }

  /** @type {string | Buffer | Uint8Array | null | undefined} */
  let content = opts.reportContent;
  if (content == null && opts.reportContents != null) {
    content =
      opts.reportContents[reportPath] ??
      opts.reportContents[reportPath.replace(/^\.\//, '')];
  }

  const cwd =
    opts.cwd != null && String(opts.cwd).trim() !== ''
      ? String(opts.cwd).trim()
      : null;

  if (content == null && typeof opts.exists === 'function') {
    const abs = cwd
      ? // eslint-disable-next-line n/no-unsupported-features/node-builtins
        `${cwd.replace(/\/$/, '')}/${reportPath.replace(/^\.\//, '')}`
      : reportPath;
    if (!opts.exists(abs) && !opts.exists(reportPath)) {
      return {
        ok: false,
        reason: `deliveryAuditGate reportPath does not exist: ${reportPath}`,
      };
    }
  }

  if (content == null && typeof opts.readFile === 'function') {
    try {
      const abs = cwd
        ? `${cwd.replace(/\/$/, '')}/${reportPath.replace(/^\.\//, '')}`
        : reportPath;
      try {
        content = opts.readFile(abs);
      } catch {
        content = opts.readFile(reportPath);
      }
    } catch (err) {
      return {
        ok: false,
        reason: `deliveryAuditGate reportPath unreadable: ${reportPath} (${err instanceof Error ? err.message : String(err)})`,
      };
    }
  }

  // Without content and without FS hooks, authenticity is a no-op (pure callers).
  if (content == null) {
    if (typeof opts.readFile === 'function' || typeof opts.exists === 'function') {
      return {
        ok: false,
        reason: `deliveryAuditGate report content unavailable for authenticity: ${reportPath}`,
      };
    }
    return { ok: true };
  }

  const floor = deliveryAuditReportContentFloor(content, {
    minBytes: opts.minBytes,
    label: reportPath,
  });
  if (!floor.ok) return floor;

  const text =
    typeof content === 'string'
      ? content
      : Buffer.isBuffer(content)
        ? content.toString('utf8')
        : Buffer.from(content).toString('utf8');

  const stampVerdict = normalizeVerdict(gate.verdict);
  const bodyVerdict = parseDeliveryAuditReportVerdict(text);
  if (bodyVerdict && stampVerdict && bodyVerdict !== stampVerdict) {
    return {
      ok: false,
      reason: `deliveryAuditGate stamp verdict=${stampVerdict} does not match report body Verdict=${bodyVerdict}`,
    };
  }

  if (stampVerdict === 'CLOSED' && reportHasOpenCriticalResidual(text)) {
    return {
      ok: false,
      reason:
        'deliveryAuditGate verdict=CLOSED forbidden while report still lists open CRITICAL residual',
    };
  }

  return { ok: true };
}

/**
 * Whether phase-done may proceed under the delivery-audit order.
 *
 * When durable automate is off → true (Mode-1 uses implement HARD-GATE prose).
 * When on → deliveryAuditGateHonesty on gate from input or phase.deliveryAuditGate.
 * When authenticity opts supply content/FS hooks, also run content authenticity.
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   deliveryAuditGate?: DeliveryAuditGate | null,
 *   phase?: { deliveryAuditGate?: DeliveryAuditGate | null } | null,
 *   reportContent?: string | Buffer | null,
 *   reportContents?: Record<string, string | Buffer> | null,
 *   readFile?: ((path: string) => string | Buffer) | null,
 *   exists?: ((path: string) => boolean) | null,
 *   cwd?: string | null,
 *   checkAuthenticity?: boolean,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function deliveryAuditAllowsClose(input = {}) {
  if (!isDurableAutomateForDeliveryAudit(input)) {
    return { ok: true };
  }

  const phase =
    input.phase != null && typeof input.phase === 'object' ? input.phase : {};
  const gate =
    input.deliveryAuditGate != null
      ? input.deliveryAuditGate
      : phase.deliveryAuditGate != null
        ? phase.deliveryAuditGate
        : null;

  const honesty = deliveryAuditGateHonesty(gate);
  if (!honesty.ok) return honesty;

  return deliveryAuditGateAuthenticity(gate, {
    reportContent: input.reportContent,
    reportContents: input.reportContents,
    readFile: input.readFile,
    exists: input.exists,
    cwd: input.cwd,
    checkAuthenticity: input.checkAuthenticity,
  });
}

/**
 * Immutable stamp helper after a real audit-delivery run.
 * Does not mutate input. Throws on forge-friendly / illegal skip shapes.
 *
 * @param {{
 *   status?: string | null,
 *   reportPath: string,
 *   verdict: 'CLOSED' | 'PARTIAL' | string,
 *   verifiedAt?: string | null,
 *   at?: string | null,
 * }} fields
 * @returns {DeliveryAuditGate}
 */
export function buildDeliveryAuditGate(fields) {
  if (fields == null || typeof fields !== 'object') {
    throw new Error('buildDeliveryAuditGate: fields required');
  }

  if (fields.operatorSkip === true) {
    throw new Error(
      'buildDeliveryAuditGate: operatorSkip is illegal — delivery audit is never skippable',
    );
  }

  const statusRaw =
    fields.status != null ? String(fields.status).trim().toLowerCase() : 'passed';
  if (statusRaw === 'skipped' || statusRaw === 'skip') {
    throw new Error(
      'buildDeliveryAuditGate: status=skipped is illegal — only status=passed with CLOSED|PARTIAL',
    );
  }
  if (statusRaw !== 'passed') {
    throw new Error(
      `buildDeliveryAuditGate: invalid status "${fields.status}" (only passed; skip path does not exist)`,
    );
  }

  const reportPath =
    fields.reportPath != null ? String(fields.reportPath).trim() : '';
  if (reportPath === '') {
    throw new Error(
      'buildDeliveryAuditGate: status=passed requires non-empty reportPath',
    );
  }

  const verdict = normalizeVerdict(fields.verdict);
  if (verdict === 'OPEN') {
    throw new Error(
      'buildDeliveryAuditGate: verdict=OPEN never stamps passed',
    );
  }
  if (!PASS_VERDICT_SET.has(verdict)) {
    throw new Error(
      'buildDeliveryAuditGate: verdict must be CLOSED|PARTIAL (EN SSOT)',
    );
  }

  /** @type {DeliveryAuditGate} */
  const out = {
    status: 'passed',
    reportPath,
    verdict,
  };

  if (fields.verifiedAt != null && String(fields.verifiedAt).trim() !== '') {
    out.verifiedAt = String(fields.verifiedAt).trim();
  }
  if (fields.at != null && String(fields.at).trim() !== '') {
    out.at = String(fields.at).trim();
  }

  const honesty = deliveryAuditGateHonesty(out);
  if (!honesty.ok) {
    throw new Error(`buildDeliveryAuditGate: ${honesty.reason}`);
  }
  return out;
}
