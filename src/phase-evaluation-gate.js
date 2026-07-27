/**
 * Pure phase evaluation gate (automate Step F → G HARD order).
 *
 * Under durable automate, phase-done must not run until the evaluation agent
 * has produced status=passed and verdict=pass. Skip / accept residual are
 * forbidden while the stamp holds (clear executionMode to leave automate).
 *
 * Authenticity (R3 / F1 + F4 content floor):
 *   - status=passed requires verdict=pass AND non-empty reportPath
 *     (path to evaluationReport under .atomic-skills/reviews/ or documented path)
 *   - status=skipped requires operatorSkip===true AND non-empty reason
 *     (legacy retroactive skips are expressible ONLY via this pair — never
 *     silent skip-by-reason alone)
 *   - F4 content floor (when report content is checked): report file must meet
 *     min bytes **or** carry structured keys (verdict/findings/businessIntent/
 *     exitGates). Thin 2-line verdict-only fails under automate.
 *
 * Non-automate: gate inactive (allows close).
 * Pointer honesty is pure; content floor uses injected reportContents or
 * optional readFile (medium floor — not full BI re-eval).
 */

import { isAbsolute, resolve } from 'node:path';
import { isDurableAutomateActive } from './plan-end-review.js';

/**
 * Minimum UTF-8 byte length for evaluationReport content floor (F4).
 * Thin 2-line verdict-only reports fail this floor.
 */
export const EVALUATION_REPORT_MIN_BYTES = 120;

/** Structured keys that satisfy the content floor without relying on size alone. */
export const EVALUATION_REPORT_CONTENT_KEYS = Object.freeze([
  'verdict',
  'findings',
  'businessIntent',
  'businessIntentCheck',
  'exitGates',
  'exitGate',
]);

/**
 * Whether durable automate evaluation order applies (stamp-first).
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 * }} [input]
 * @returns {boolean}
 */
export function isDurableAutomateForEvaluation(input = {}) {
  return isDurableAutomateActive(input);
}

/**
 * @typedef {{
 *   status: 'passed' | 'skipped' | 'failed-dispositioned',
 *   verdict?: 'pass' | 'fail' | null,
 *   reason?: string | null,
 *   disposition?: 'accept' | 'defer' | 'fix' | null,
 *   reportPath?: string | null,
 *   operatorSkip?: boolean | null,
 *   verifiedAt?: string | null,
 *   at?: string | null,
 * }} EvaluationGate
 */

/**
 * Evaluation report content floor (F4 medium authenticity).
 * Accepts content meeting min bytes OR carrying structured content keys.
 * Thin 2-line verdict-only fails.
 *
 * @param {string | Buffer | Uint8Array | null | undefined} content
 * @param {{ minBytes?: number, label?: string }} [opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function evaluationReportContentFloor(content, opts = {}) {
  const label = opts.label != null ? String(opts.label) : 'evaluationReport';
  const minBytes =
    typeof opts.minBytes === 'number' && opts.minBytes > 0
      ? opts.minBytes
      : EVALUATION_REPORT_MIN_BYTES;

  if (content == null) {
    return {
      ok: false,
      reason: `evaluationGate report content floor: ${label} missing`,
    };
  }

  /** @type {string} */
  let text;
  if (Buffer.isBuffer(content) || content instanceof Uint8Array) {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (buf.includes(0)) {
      return {
        ok: false,
        reason: `evaluationGate report content floor: ${label} is binary/null-byte`,
      };
    }
    text = buf.toString('utf8');
  } else if (typeof content === 'string') {
    text = content;
  } else {
    return {
      ok: false,
      reason: `evaluationGate report content floor: ${label} must be string or bytes`,
    };
  }

  const bytes = Buffer.byteLength(text, 'utf8');
  const nonEmptyLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Thin 2-line verdict-only fails the floor under automate.
  if (nonEmptyLines.length <= 2 && bytes < minBytes) {
    return {
      ok: false,
      reason:
        'evaluationGate report content floor: thin 2-line verdict-only report fails min content (need structured keys or min bytes)',
    };
  }

  const lower = text.toLowerCase();
  let keyHits = 0;
  for (const key of EVALUATION_REPORT_CONTENT_KEYS) {
    if (lower.includes(key.toLowerCase())) keyHits += 1;
  }
  // Structured accept: ≥2 content keys (e.g. verdict + findings) even if shorter
  // than min when still multi-line; or full min-bytes body.
  const structuredOk = keyHits >= 2 && nonEmptyLines.length >= 4;
  const sizeOk = bytes >= minBytes && nonEmptyLines.length >= 3;

  if (!structuredOk && !sizeOk) {
    return {
      ok: false,
      reason: `evaluationGate report content floor: ${label} fails min keys/bytes (${bytes} bytes, ${keyHits} keys, ${nonEmptyLines.length} lines)`,
    };
  }

  return { ok: true };
}

/**
 * Content authenticity for evaluationGate.reportPath when content is available.
 *
 * @param {EvaluationGate | null | undefined} gate
 * @param {{
 *   reportContents?: Record<string, string | Buffer | Uint8Array> | null,
 *   reportContent?: string | Buffer | Uint8Array | null,
 *   readFile?: ((path: string) => string | Buffer) | null,
 *   cwd?: string | null,
 *   minBytes?: number,
 * }} [opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function evaluationGateAuthenticity(gate, opts = {}) {
  if (gate == null || typeof gate !== 'object') {
    return {
      ok: false,
      reason: 'evaluationGate authenticity requires gate object',
    };
  }
  const status =
    gate.status != null ? String(gate.status).trim().toLowerCase() : '';
  if (status !== 'passed') {
    return { ok: true };
  }
  const reportPath =
    gate.reportPath != null ? String(gate.reportPath).trim() : '';
  if (reportPath === '') {
    return {
      ok: false,
      reason: 'evaluationGate authenticity requires non-empty reportPath',
    };
  }

  let content = opts.reportContent != null ? opts.reportContent : null;
  if (content == null && opts.reportContents != null) {
    const map = opts.reportContents;
    if (Object.prototype.hasOwnProperty.call(map, reportPath)) {
      content = map[reportPath];
    } else {
      const base = reportPath.split(/[/\\]/).pop();
      if (base && Object.prototype.hasOwnProperty.call(map, base)) {
        content = map[base];
      }
    }
  }
  if (content == null && typeof opts.readFile === 'function') {
    try {
      const abs =
        isAbsolute(reportPath) || !opts.cwd
          ? reportPath
          : resolve(String(opts.cwd), reportPath);
      content = opts.readFile(abs);
    } catch {
      content = null;
    }
  }
  if (content == null) {
    return {
      ok: false,
      reason: `evaluationGate report content floor: missing content for reportPath ${reportPath}`,
    };
  }
  return evaluationReportContentFloor(content, {
    minBytes: opts.minBytes,
    label: reportPath,
  });
}

/**
 * Pure honesty check for an evaluationGate object (no automate stamp).
 *
 * Shared by phaseEvaluationAllowsClose and GATE-R4 / checkEvaluationGate —
 * one definition; no divergent prose rules. *
 * Required-when (documented + enforced here):
 *   - passed → verdict === 'pass' AND non-empty reportPath
 *   - skipped → operatorSkip === true AND non-empty reason
 *     (migration: legacy silent skips become operatorSkip+reason only)
 *   - failed-dispositioned → disposition in accept|defer|fix AND non-empty reason
 *
 * @param {EvaluationGate | null | undefined} gate
 * @returns {{ ok: boolean, reason?: string }}
 */
export function evaluationGateHonesty(gate) {
  if (gate == null || typeof gate !== 'object') {
    return {
      ok: false,
      reason:
        'automate requires evaluationGate before phase-done (run evaluation agent — skip is forbidden under durable automate)',
    };
  }

  const status =
    gate.status != null ? String(gate.status).trim().toLowerCase() : '';

  if (status === 'passed') {
    const verdict =
      gate.verdict != null ? String(gate.verdict).trim().toLowerCase() : '';
    if (verdict !== 'pass') {
      return {
        ok: false,
        reason: 'evaluationGate status=passed requires verdict=pass',
      };
    }
    const reportPath =
      gate.reportPath != null ? String(gate.reportPath).trim() : '';
    if (reportPath === '') {
      return {
        ok: false,
        reason:
          'evaluationGate status=passed requires non-empty reportPath (evaluationReport pointer)',
      };
    }
    return { ok: true };
  }

  if (status === 'skipped') {
    // Legacy retroactive skips: ONLY expressible via operatorSkip:true + non-empty
    // reason. reason alone is forge-able and rejected under honesty (R3).
    const reason = gate.reason != null ? String(gate.reason).trim() : '';
    const operatorSkip = gate.operatorSkip === true;
    if (!operatorSkip) {
      return {
        ok: false,
        reason:
          'evaluationGate status=skipped requires operatorSkip=true (operator-owned; no silent/forged skip)',
      };
    }
    if (reason === '') {
      return {
        ok: false,
        reason:
          'evaluationGate status=skipped requires non-empty reason with operatorSkip=true',
      };
    }
    return { ok: true };  }

  if (status === 'failed-dispositioned') {
    return {
      ok: false,
      reason:
        'automate forbids phase-done on failed-dispositioned evaluation — re-dispatch fix until evaluationGate status=passed verdict=pass (accept/defer residual requires clearing the automate stamp)',
    };
  }

  return {
    ok: false,
    reason: `unknown or missing evaluationGate.status: ${status || '(empty)'}`,
  };
}

/**
 * Whether phase-done may proceed under the evaluation order (design D10/D13).
 *
 * When durable automate is off → true.
 * When on → evaluationGateHonesty(gate) (default-on authenticity for automate).
 * Content floor (F4) applies when reportContents / reportContent / readFile /
 * checkAuthenticity is set — thin 2-line verdict-only fails.
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   evaluationGate?: EvaluationGate | null,
 *   reportContents?: Record<string, string | Buffer | Uint8Array> | null,
 *   reportContent?: string | Buffer | Uint8Array | null,
 *   readFile?: ((path: string) => string | Buffer) | null,
 *   cwd?: string | null,
 *   checkAuthenticity?: boolean | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function phaseEvaluationAllowsClose(input = {}) {
  if (!isDurableAutomateForEvaluation(input)) {
    return { ok: true };
  }
  const honesty = evaluationGateHonesty(input.evaluationGate);
  if (!honesty.ok) return honesty;

  const shouldCheckContent =
    input.checkAuthenticity === true ||
    input.reportContents != null ||
    input.reportContent != null ||
    typeof input.readFile === 'function';

  if (shouldCheckContent) {
    return evaluationGateAuthenticity(input.evaluationGate, {
      reportContents: input.reportContents,
      reportContent: input.reportContent,
      readFile: input.readFile,
      cwd: input.cwd,
    });
  }
  return honesty;
}

/**
 * Immutable stamp helper for orchestrator after evaluation agent returns.
 * Does not mutate input.
 *
 * Records reportPath / operatorSkip when provided (authenticity fields).
 * For status=passed, non-empty reportPath is required (forge-resistant stamp).
 * For status=skipped, operatorSkip must be true and reason non-empty.
 *
 * @param {Partial<EvaluationGate> & { status: EvaluationGate['status'] }} fields
 * @returns {EvaluationGate}
 */
export function buildEvaluationGate(fields) {
  if (fields == null || typeof fields !== 'object') {
    throw new Error('buildEvaluationGate: fields required');
  }
  const status = String(fields.status || '').trim().toLowerCase();
  if (
    status !== 'passed' &&
    status !== 'skipped' &&
    status !== 'failed-dispositioned'
  ) {
    throw new Error(
      `buildEvaluationGate: invalid status "${fields.status}" (passed|skipped|failed-dispositioned)`,
    );
  }
  /** @type {EvaluationGate} */
  const out = { status: /** @type {EvaluationGate['status']} */ (status) };
  if (fields.verdict != null) {
    out.verdict = /** @type {EvaluationGate['verdict']} */ (
      String(fields.verdict).trim().toLowerCase()
    );
  }
  if (fields.reason != null) out.reason = String(fields.reason);
  if (fields.disposition != null) {
    out.disposition = /** @type {EvaluationGate['disposition']} */ (
      String(fields.disposition).trim().toLowerCase()
    );
  }
  if (fields.reportPath != null) {
    out.reportPath = String(fields.reportPath).trim();
  }
  if (fields.operatorSkip != null) {
    out.operatorSkip = fields.operatorSkip === true;
  }
  if (fields.verifiedAt != null) out.verifiedAt = String(fields.verifiedAt);
  if (fields.at != null) out.at = String(fields.at);

  // Stamp-time authenticity: refuse forge-friendly partial stamps
  if (status === 'passed') {
    const rp = out.reportPath != null ? String(out.reportPath).trim() : '';
    if (rp === '') {
      throw new Error(
        'buildEvaluationGate: status=passed requires non-empty reportPath',
      );
    }
    out.reportPath = rp;
    // Default verdict so callers stamping only reportPath do not persist a
    // partial gate that later fails evaluationGateHonesty / GATE-R4.
    if (out.verdict == null || String(out.verdict).trim() === '') {
      out.verdict = 'pass';
    }
  }
  if (status === 'skipped') {
    if (out.operatorSkip !== true) {
      throw new Error(
        'buildEvaluationGate: status=skipped requires operatorSkip=true',
      );
    }
    const reason = out.reason != null ? String(out.reason).trim() : '';
    if (reason === '') {
      throw new Error(
        'buildEvaluationGate: status=skipped requires non-empty reason',
      );
    }
  }

  return out;
}
