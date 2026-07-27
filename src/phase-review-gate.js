/**
 * Pure phase-done review gate under durable automate (cross-model both).
 *
 * Dogfood: pure-maestro stamped reviewGate.mode=local with narrative override
 * and skipped real --mode=both. Under automate, phase-done default is both;
 * local/skip only with explicit operator-owned reason (same pattern as
 * phaseReviewMode overrideReason).
 *
 * Authenticity floor (F4 medium — dual-leg, not full codex parse):
 *   - mode both requires dual receipt paths (local + codex/external)
 *   - each receipt: min size, non-binary (no null-byte), not a one-line stub
 *   - accepts dual non-stub with CLEAN or findings
 * Content checks use injected receiptContents or optional FS read — medium floor.
 *
 * Non-automate: inactive (allows close) — commitGuard still requires a complete
 * reviewGate when requireReview is true.
 */

import { isAbsolute, resolve } from 'node:path';
import { isDurableAutomateActive } from './plan-end-review.js';

/** Modes that satisfy automate phase-done cross-model default. */
export const AUTOMATE_PHASE_BOTH_MODES = Object.freeze([
  'both',
  'both-codex',
  'both-grok',
  'both-claude',
  'external-both', // stricter than both; also satisfies
]);

const BOTH_SET = new Set(AUTOMATE_PHASE_BOTH_MODES);

const GIT_SHA_RE = /^[0-9a-f]{7,40}$/i;

/**
 * Medium authenticity floor: min UTF-8 byte length for a dual-leg receipt.
 * Not a full transcript parser — rejects stubs, not incomplete reviews.
 */
export const PHASE_REVIEW_RECEIPT_MIN_BYTES = 64;

/**
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 * }} [input]
 * @returns {boolean}
 */
export function isDurableAutomateForPhaseReview(input = {}) {
  return isDurableAutomateActive(input);
}

/**
 * @typedef {{
 *   status?: string | null,
 *   mode?: string | null,
 *   at?: string | null,
 *   reviewFile?: string | null,
 *   localReceiptPath?: string | null,
 *   codexReceiptPath?: string | null,
 *   externalReceiptPath?: string | null,
 *   legs?: Array<{
 *     provider?: string | null,
 *     receiptPath?: string | null,
 *     path?: string | null,
 *     reviewFile?: string | null,
 *   }> | null,
 *   reason?: string | null,
 *   operatorSkip?: boolean | null,
 *   overrideReason?: string | null,
 *   verifiedAt?: string | null,
 * }} ReviewGate
 */

/**
 * Collect dual-leg receipt paths from a reviewGate (mode both authenticity).
 * Prefer legs[] with ≥2 path-bearing entries; else local + codex/external;
 * else reviewFile + external when distinct.
 *
 * @param {ReviewGate | null | undefined} gate
 * @returns {{ paths: string[], labels: string[] }}
 */
export function dualLegReceiptPaths(gate) {
  /** @type {string[]} */
  const paths = [];
  /** @type {string[]} */
  const labels = [];
  if (gate == null || typeof gate !== 'object') {
    return { paths, labels };
  }

  const seen = new Set();
  /**
   * @param {string | null | undefined} raw
   * @param {string} label
   */
  function push(raw, label) {
    if (raw == null) return;
    const p = String(raw).trim();
    if (p === '' || seen.has(p)) return;
    seen.add(p);
    paths.push(p);
    labels.push(label);
  }

  if (Array.isArray(gate.legs)) {
    for (let i = 0; i < gate.legs.length; i++) {
      const leg = gate.legs[i];
      if (leg == null || typeof leg !== 'object') continue;
      const raw = leg.receiptPath ?? leg.path ?? leg.reviewFile;
      const provider =
        leg.provider != null ? String(leg.provider).trim().toLowerCase() : `leg${i}`;
      push(raw, provider || `leg${i}`);
    }
  }

  push(gate.localReceiptPath, 'local');
  push(gate.codexReceiptPath, 'codex');
  push(gate.externalReceiptPath, 'external');
  // Combined reviewFile only when we still need a second path companion later.
  push(gate.reviewFile, 'reviewFile');

  return { paths, labels };
}

/**
 * Pure content authenticity floor for one receipt (medium floor).
 * Rejects binary/null-byte, undersized, and one-line stubs.
 * Accepts multi-line CLEAN or findings-style bodies meeting min size.
 *
 * @param {string | Buffer | Uint8Array | null | undefined} content
 * @param {{ label?: string, minBytes?: number }} [opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function receiptContentAuthenticity(content, opts = {}) {
  const label = opts.label != null ? String(opts.label) : 'receipt';
  const minBytes =
    typeof opts.minBytes === 'number' && opts.minBytes > 0
      ? opts.minBytes
      : PHASE_REVIEW_RECEIPT_MIN_BYTES;

  if (content == null) {
    return {
      ok: false,
      reason: `dual-leg authenticity: ${label} content missing`,
    };
  }

  /** @type {Buffer} */
  let buf;
  if (Buffer.isBuffer(content)) {
    buf = content;
  } else if (content instanceof Uint8Array) {
    buf = Buffer.from(content);
  } else if (typeof content === 'string') {
    buf = Buffer.from(content, 'utf8');
  } else {
    return {
      ok: false,
      reason: `dual-leg authenticity: ${label} content must be string or bytes`,
    };
  }

  // Non-binary: null byte anywhere fails closed.
  if (buf.includes(0)) {
    return {
      ok: false,
      reason: `dual-leg authenticity: ${label} is binary/null-byte (non-binary floor)`,
    };
  }

  const text = buf.toString('utf8');
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes < minBytes) {
    return {
      ok: false,
      reason: `dual-leg authenticity: ${label} below min size (${bytes} < ${minBytes} bytes) — stub/corrupt reject`,
    };
  }

  const nonEmptyLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // One-line stub under mode both (e.g. lone "CLEAN" / "ok") — fail closed.
  if (nonEmptyLines.length <= 1) {
    return {
      ok: false,
      reason: `dual-leg authenticity: ${label} is a one-line stub (need multi-line CLEAN or findings)`,
    };
  }

  // Soft stub: only 2 short lines with no CLEAN/findings vocabulary.
  const joined = nonEmptyLines.join('\n').toLowerCase();
  const hasCleanOrFindings =
    /\bclean\b/.test(joined) ||
    /\bfindings?\b/.test(joined) ||
    /\bblocker\b/.test(joined) ||
    /\bcritical\b/.test(joined) ||
    /\bmajor\b/.test(joined) ||
    /\bminor\b/.test(joined) ||
    /\breview\b/.test(joined) ||
    /\bverdict\b/.test(joined);

  if (nonEmptyLines.length <= 2 && bytes < minBytes * 2 && !hasCleanOrFindings) {
    return {
      ok: false,
      reason: `dual-leg authenticity: ${label} thin stub (need CLEAN or findings body)`,
    };
  }

  return { ok: true };
}

/**
 * Dual-leg authenticity floor for mode both (paths + content).
 *
 * @param {ReviewGate | null | undefined} gate
 * @param {{
 *   receiptContents?: Record<string, string | Buffer | Uint8Array> | null,
 *   readFile?: ((path: string) => string | Buffer) | null,
 *   cwd?: string | null,
 *   minBytes?: number,
 * }} [opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function phaseReviewAuthenticity(gate, opts = {}) {
  if (gate == null || typeof gate !== 'object') {
    return {
      ok: false,
      reason: 'dual-leg authenticity requires reviewGate object',
    };
  }

  const status =
    gate.status != null ? String(gate.status).trim().toLowerCase() : '';
  if (status !== 'passed') {
    return { ok: true };
  }

  const mode = gate.mode != null ? String(gate.mode).trim().toLowerCase() : '';
  if (!BOTH_SET.has(mode)) {
    // Local override / non-both: single reviewFile content check when provided.
    if (mode === 'local' && opts.receiptContents != null) {
      const rf = gate.reviewFile != null ? String(gate.reviewFile).trim() : '';
      if (rf !== '') {
        const content = resolveReceiptContent(rf, opts);
        if (content == null) {
          return {
            ok: false,
            reason: `dual-leg authenticity: missing content for local receipt ${rf}`,
          };
        }
        return receiptContentAuthenticity(content, {
          label: 'local',
          minBytes: opts.minBytes,
        });
      }
    }
    return { ok: true };
  }

  const dual = dualLegReceiptPaths(gate);
  // Need two distinct dual-leg paths under mode both (not single reviewFile alone).
  // Prefer local+codex without counting reviewFile double; require ≥2 paths that
  // are not only the combined reviewFile.
  const legPaths = dual.paths.filter((_, i) => dual.labels[i] !== 'reviewFile');
  let paths = legPaths;
  let labels = dual.labels.filter((l) => l !== 'reviewFile');
  if (paths.length < 2) {
    // Allow reviewFile + one external/local companion
    paths = dual.paths;
    labels = dual.labels;
  }
  if (paths.length < 2) {
    return {
      ok: false,
      reason:
        'dual-leg authenticity: mode both requires dual receipt paths (localReceiptPath + codexReceiptPath, or legs[] with ≥2 paths) — single reviewFile alone is not enough',
    };
  }

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const label = labels[i] || `leg${i}`;
    const content = resolveReceiptContent(path, opts);
    if (content == null) {
      return {
        ok: false,
        reason: `dual-leg authenticity: missing content for ${label} path ${path} (inject receiptContents or readFile)`,
      };
    }
    const floor = receiptContentAuthenticity(content, {
      label,
      minBytes: opts.minBytes,
    });
    if (!floor.ok) return floor;
  }

  return { ok: true };
}

/**
 * @param {string} path
 * @param {{
 *   receiptContents?: Record<string, string | Buffer | Uint8Array> | null,
 *   readFile?: ((path: string) => string | Buffer) | null,
 *   cwd?: string | null,
 * }} opts
 * @returns {string | Buffer | Uint8Array | null}
 */
function resolveReceiptContent(path, opts) {
  const map = opts.receiptContents;
  if (map != null && typeof map === 'object') {
    if (Object.prototype.hasOwnProperty.call(map, path)) {
      return map[path];
    }
    // basename key fallback for tests
    const base = path.split(/[/\\]/).pop();
    if (base && Object.prototype.hasOwnProperty.call(map, base)) {
      return map[base];
    }
  }
  if (typeof opts.readFile === 'function') {
    try {
      const abs =
        isAbsolute(path) || !opts.cwd
          ? path
          : resolve(String(opts.cwd), path);
      return opts.readFile(abs);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Pure honesty for a phase reviewGate under automate (no stamp check).
 * Includes dual-leg path shape for mode both (medium authenticity floor).
 *
 * @param {ReviewGate | null | undefined} gate
 * @returns {{ ok: boolean, reason?: string }}
 */
export function phaseReviewHonesty(gate) {
  if (gate == null || typeof gate !== 'object') {
    return {
      ok: false,
      reason:
        'automate requires reviewGate before phase-done (run review-code --mode=both, or operator skip with reason)',
    };
  }

  const status =
    gate.status != null ? String(gate.status).trim().toLowerCase() : '';

  if (status === 'passed') {
    const mode = gate.mode != null ? String(gate.mode).trim().toLowerCase() : '';
    if (!BOTH_SET.has(mode)) {
      // local without operator override reason is the dogfood skip
      if (mode === 'local') {
        // Require explicit overrideReason only — plain `reason` was the dogfood
        // fig leaf for skipped-both (`status:passed, mode:local, reason:...`).
        // Full skip uses status:skipped + operatorSkip + reason separately.
        const override =
          gate.overrideReason != null
            ? String(gate.overrideReason).trim()
            : '';
        if (override === '') {
          return {
            ok: false,
            reason:
              'automate phase-done default is review mode both; local requires non-empty overrideReason (operator-owned downgrade) — plain reason alone is not enough',
          };
        }
        // Allow explicit local downgrade with reason (operator-owned)
        const at = gate.at != null ? String(gate.at).trim() : '';
        if (!GIT_SHA_RE.test(at)) {
          return {
            ok: false,
            reason:
              'reviewGate status=passed requires real git SHA at (even for local override)',
          };
        }
        const reviewFile =
          gate.reviewFile != null ? String(gate.reviewFile).trim() : '';
        if (reviewFile === '') {
          return {
            ok: false,
            reason:
              'reviewGate status=passed requires non-empty reviewFile under automate',
          };
        }
        return { ok: true };
      }
      return {
        ok: false,
        reason: `automate phase-done requires reviewGate.mode both (or both-*/external-both); got ${mode || 'missing'}`,
      };
    }
    const at = gate.at != null ? String(gate.at).trim() : '';
    if (!GIT_SHA_RE.test(at)) {
      return {
        ok: false,
        reason: 'reviewGate status=passed requires real git SHA at',
      };
    }
    const reviewFile =
      gate.reviewFile != null ? String(gate.reviewFile).trim() : '';
    if (reviewFile === '') {
      return {
        ok: false,
        reason:
          'reviewGate status=passed requires non-empty reviewFile under automate (durable receipt)',
      };
    }
    // Dual-leg path shape (authenticity floor — medium): mode both needs ≥2
    // distinct receipt paths. Single reviewFile alone is the dogfood stub shape.
    const dual = dualLegReceiptPaths(gate);
    if (dual.paths.length < 2) {
      return {
        ok: false,
        reason:
          'dual-leg authenticity: mode both requires dual receipt paths (localReceiptPath + codexReceiptPath, or legs[] with ≥2 paths) — single reviewFile alone is not enough',
      };
    }
    return { ok: true };
  }

  if (status === 'skipped') {
    const reason = gate.reason != null ? String(gate.reason).trim() : '';
    // Prefer operatorSkip true; also accept non-empty reason alone for skip
    // (GATE-R3), but under automate require operatorSkip === true to match
    // evaluation skip authenticity.
    if (gate.operatorSkip !== true) {
      return {
        ok: false,
        reason:
          'reviewGate status=skipped under automate requires operatorSkip=true + non-empty reason',
      };
    }
    if (reason === '') {
      return {
        ok: false,
        reason:
          'reviewGate status=skipped requires non-empty reason under automate',
      };
    }
    return { ok: true };
  }

  return {
    ok: false,
    reason: `unknown or missing reviewGate.status: ${status || '(empty)'}`,
  };
}

/**
 * Whether phase-done may proceed under automate review policy.
 * Non-automate → ok (inactive).
 * Under automate: honesty + dual-leg authenticity content floor when
 * receiptContents / readFile / checkAuthenticity is set (fail closed for
 * stubs when content is checked).
 *
 * @param {{
 *   automateActive?: boolean | null,
 *   planExecutionMode?: string | null,
 *   reviewGate?: ReviewGate | null,
 *   phase?: { reviewGate?: ReviewGate | null } | null,
 *   receiptContents?: Record<string, string | Buffer | Uint8Array> | null,
 *   readFile?: ((path: string) => string | Buffer) | null,
 *   cwd?: string | null,
 *   checkAuthenticity?: boolean | null,
 * }} [input]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function phaseReviewAllowsClose(input = {}) {
  if (!isDurableAutomateForPhaseReview(input)) {
    return { ok: true };
  }
  const gate =
    input.reviewGate != null
      ? input.reviewGate
      : input.phase != null && typeof input.phase === 'object'
        ? input.phase.reviewGate
        : null;
  const honesty = phaseReviewHonesty(gate);
  if (!honesty.ok) return honesty;

  const mode =
    gate != null && gate.mode != null
      ? String(gate.mode).trim().toLowerCase()
      : '';
  const status =
    gate != null && gate.status != null
      ? String(gate.status).trim().toLowerCase()
      : '';
  const shouldCheckContent =
    input.checkAuthenticity === true ||
    input.receiptContents != null ||
    typeof input.readFile === 'function';

  if (
    shouldCheckContent &&
    status === 'passed' &&
    (BOTH_SET.has(mode) || mode === 'local')
  ) {
    return phaseReviewAuthenticity(gate, {
      receiptContents: input.receiptContents,
      readFile: input.readFile,
      cwd: input.cwd,
    });
  }

  return honesty;
}
