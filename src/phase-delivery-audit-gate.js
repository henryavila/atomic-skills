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

/**
 * Whether phase-done may proceed under the delivery-audit order.
 *
 * When durable automate is off → true (Mode-1 uses implement HARD-GATE prose).
 * When on → deliveryAuditGateHonesty on gate from input or phase.deliveryAuditGate.
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   deliveryAuditGate?: DeliveryAuditGate | null,
 *   phase?: { deliveryAuditGate?: DeliveryAuditGate | null } | null,
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

  return deliveryAuditGateHonesty(gate);
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
