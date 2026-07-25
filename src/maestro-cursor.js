/**
 * Thin maestro step cursor for implement --mode=automate (F3 / R2).
 *
 * Durable status file under `.atomic-skills/status/automate/<planSlug>.json`
 * records pure-maestro position so Layer-2 assert can refuse illegal jumps
 * (e.g. spawn when step is B, phase-done when step is C, C→G advance).
 *
 * Not Layer 4: no spawn adapters, no multi-host supervisor, no product
 * file contents. Skill prose remains the maestro; this is Layer 2.5 status.
 *
 * Cursor shape:
 *   { step, phaseId, redispatchCount, claimReportPath?, leasePath?, updatedAt,
 *     lastAssert?: { gate, ok, at, reason? } }
 *
 * Steps: A | B | C | D | D.5 | E | F | G | H | I | awaiting-operator-advance
 *
 * lastAssert: written by assert-automate-gate on exit 0 so pure-maestro cannot
 * mutate done/phase-done state without a fresh successful assert for that gate.
 *
 * Pure builders/parsers preferred; thin FS wrappers for read/write/ensure.
 * No network.
 */

import { join } from 'node:path';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';

/** Relative directory under statusRoot for maestro cursor files. */
export const MAESTRO_CURSOR_DIR = 'automate';

/** Ordered pure-maestro spine steps (excluding pause). */
export const MAESTRO_STEPS = Object.freeze([
  'A',
  'B',
  'C',
  'D',
  'D.5',
  'E',
  'F',
  'G',
  'H',
  'I',
]);

/** Post phase-done pause until operator continue (F3 records; F4 hardens). */
export const AWAITING_OPERATOR_ADVANCE = 'awaiting-operator-advance';

/**
 * Explicit continue token for {@link clearContinue}.
 * Generic "ok" / phase-done y-accept is **not** enough under project ratify rules —
 * operator must pass this token (or `operatorContinue: true`) so spawn/Step A unpause.
 */
export const OPERATOR_CONTINUE_TOKEN = 'operator-continue';

/** All legal cursor.step values. */
export const ALL_CURSOR_STEPS = Object.freeze([
  ...MAESTRO_STEPS,
  AWAITING_OPERATOR_ADVANCE,
]);

/** Max re-dispatch rounds before mandatory operator stop (design D / pure maestro). */
export const MAX_REDISPATCH = 2;

/**
 * @typedef {'A'|'B'|'C'|'D'|'D.5'|'E'|'F'|'G'|'H'|'I'|'awaiting-operator-advance'} MaestroStep
 *
 * @typedef {{
 *   gate: string,
 *   ok: boolean,
 *   at: string,
 *   reason?: string | null,
 * }} LastAssert
 *
 * @typedef {{
 *   step: MaestroStep | string,
 *   phaseId: string,
 *   redispatchCount: number,
 *   claimReportPath?: string | null,
 *   leasePath?: string | null,
 *   updatedAt: string,
 *   lastAssert?: LastAssert | null,
 * }} MaestroCursor
 *
 * @typedef {{
 *   status: 'missing' | 'ok' | 'malformed',
 *   cursor?: MaestroCursor,
 *   error?: string,
 * }} CursorReadResult
 *
 * @typedef {{
 *   ok: boolean,
 *   reason?: string,
 *   cursor?: MaestroCursor,
 * }} CursorAdvanceResult
 *
 * @typedef {{
 *   ok: boolean,
 *   reason?: string,
 * }} CursorGateResult
 */

/**
 * Sanitize plan slug for a single path segment (no path traversal).
 * @param {string} planSlug
 * @returns {string}
 */
export function sanitizePlanSlug(planSlug) {
  const s = String(planSlug ?? '').trim();
  if (
    s === '' ||
    s === '.' ||
    s === '..' ||
    s.includes('/') ||
    s.includes('\\') ||
    s.includes('\0')
  ) {
    throw new Error(`maestro-cursor: invalid planSlug: ${planSlug}`);
  }
  return s;
}

/**
 * Absolute path for a plan's maestro cursor file.
 * Path: <statusRoot>/automate/<planSlug>.json
 *
 * @param {string} statusRoot e.g. `.atomic-skills/status`
 * @param {string} planSlug
 * @returns {string}
 */
export function cursorPath(statusRoot, planSlug) {
  if (statusRoot == null || String(statusRoot).trim() === '') {
    throw new Error('cursorPath: statusRoot is required');
  }
  if (planSlug == null || String(planSlug).trim() === '') {
    throw new Error('cursorPath: planSlug is required');
  }
  const slug = sanitizePlanSlug(String(planSlug).trim());
  return join(String(statusRoot), MAESTRO_CURSOR_DIR, `${slug}.json`);
}

/**
 * Whether a value is a known maestro step (including pause).
 * @param {unknown} step
 * @returns {boolean}
 */
export function isKnownStep(step) {
  if (step == null) return false;
  return ALL_CURSOR_STEPS.includes(/** @type {string} */ (String(step).trim()));
}

/**
 * Normalize step string (trim). Returns '' if empty.
 * @param {unknown} step
 * @returns {string}
 */
function normStep(step) {
  return step == null ? '' : String(step).trim();
}

/**
 * Legal transition table — pure, no I/O.
 *
 * Forward spine: A→B→C→D→D.5→E→F→G→H→I
 * Pause: G → awaiting-operator-advance → H
 * Redispatch: E|F → C when redispatchCount < MAX_REDISPATCH
 * Last-phase shortcuts: G→I, H→I
 * Next-phase: H→A (phaseId may change via advanceCursor opts)
 *
 * @param {string} from
 * @param {string} to
 * @param {{ redispatchCount?: number }} [ctx]
 * @returns {boolean}
 */
export function isLegalTransition(from, to, ctx = {}) {
  const f = normStep(from);
  const t = normStep(to);
  if (!isKnownStep(f) || !isKnownStep(t)) return false;
  if (f === t) return false; // no no-op advance

  /** @type {Record<string, string[]>} */
  const allowed = {
    A: ['B'],
    B: ['C'],
    C: ['D'],
    D: ['D.5'],
    'D.5': ['E'],
    E: ['F'],
    F: ['G'],
    G: [AWAITING_OPERATOR_ADVANCE, 'I'],
    [AWAITING_OPERATOR_ADVANCE]: ['H'],
    H: ['A', 'I'],
    I: [],
  };

  if (allowed[f] && allowed[f].includes(t)) return true;

  // Redispatch back to C from E or F (verifier/review fail path)
  if ((f === 'E' || f === 'F') && t === 'C') {
    const count =
      ctx.redispatchCount != null && Number.isFinite(Number(ctx.redispatchCount))
        ? Number(ctx.redispatchCount)
        : 0;
    return count < MAX_REDISPATCH;
  }

  return false;
}

/**
 * Validate cursor object shape (pure). Does not require optional paths.
 *
 * @param {unknown} cursor
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateCursorShape(cursor) {
  /** @type {string[]} */
  const errors = [];
  if (cursor == null || typeof cursor !== 'object' || Array.isArray(cursor)) {
    return { ok: false, errors: ['cursor must be a non-null object'] };
  }
  const c = /** @type {Record<string, unknown>} */ (cursor);

  const step = normStep(c.step);
  if (!step) errors.push('step is required');
  else if (!isKnownStep(step)) errors.push(`unknown step: ${step}`);

  const phaseId =
    c.phaseId != null ? String(c.phaseId).trim() : '';
  if (!phaseId) errors.push('phaseId is required');

  if (c.redispatchCount == null || c.redispatchCount === '') {
    errors.push('redispatchCount is required');
  } else {
    const n = Number(c.redispatchCount);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      errors.push('redispatchCount must be a non-negative integer');
    }
  }

  if (c.updatedAt != null && String(c.updatedAt).trim() !== '') {
    const d = Date.parse(String(c.updatedAt));
    if (Number.isNaN(d)) errors.push('updatedAt must be ISO date string when present');
  }

  if (c.claimReportPath != null && typeof c.claimReportPath !== 'string') {
    errors.push('claimReportPath must be a string or null when present');
  }
  if (c.leasePath != null && typeof c.leasePath !== 'string') {
    errors.push('leasePath must be a string or null when present');
  }
  if (c.lastAssert != null) {
    if (typeof c.lastAssert !== 'object' || Array.isArray(c.lastAssert)) {
      errors.push('lastAssert must be an object when present');
    } else {
      const la = /** @type {Record<string, unknown>} */ (c.lastAssert);
      if (la.gate == null || String(la.gate).trim() === '') {
        errors.push('lastAssert.gate is required when lastAssert present');
      }
      if (typeof la.ok !== 'boolean') {
        errors.push('lastAssert.ok must be a boolean when lastAssert present');
      }
      if (la.at != null && String(la.at).trim() !== '') {
        const d = Date.parse(String(la.at));
        if (Number.isNaN(d)) errors.push('lastAssert.at must be ISO when present');
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Build a fresh cursor at first automate entry (pure — no I/O).
 * Default step is A; callers may pass B when handoff/work-order already ready.
 *
 * @param {{
 *   phaseId: string,
 *   step?: MaestroStep | string,
 *   redispatchCount?: number,
 *   claimReportPath?: string | null,
 *   leasePath?: string | null,
 *   updatedAt?: string,
 * }} input
 * @returns {MaestroCursor}
 */
export function buildInitialCursor(input) {
  if (input == null || typeof input !== 'object') {
    throw new Error('buildInitialCursor: input is required');
  }
  const phaseId = String(input.phaseId ?? '').trim();
  if (!phaseId) {
    throw new Error('buildInitialCursor: phaseId is required');
  }
  const step = normStep(input.step ?? 'A') || 'A';
  if (!isKnownStep(step)) {
    throw new Error(`buildInitialCursor: unknown step: ${step}`);
  }
  const redispatchCount =
    input.redispatchCount != null ? Number(input.redispatchCount) : 0;
  if (!Number.isInteger(redispatchCount) || redispatchCount < 0) {
    throw new Error('buildInitialCursor: redispatchCount must be a non-negative integer');
  }

  /** @type {MaestroCursor} */
  const cursor = {
    step,
    phaseId,
    redispatchCount,
    updatedAt:
      input.updatedAt != null && String(input.updatedAt).trim() !== ''
        ? String(input.updatedAt)
        : new Date().toISOString(),
  };
  if (input.claimReportPath != null && String(input.claimReportPath).trim() !== '') {
    cursor.claimReportPath = String(input.claimReportPath);
  }
  if (input.leasePath != null && String(input.leasePath).trim() !== '') {
    cursor.leasePath = String(input.leasePath);
  }
  return cursor;
}

/**
 * Parse cursor JSON text or object. Returns null on empty/invalid JSON.
 * Does not fully validate shape — use {@link validateCursorShape}.
 *
 * @param {unknown} raw
 * @returns {MaestroCursor | null}
 */
export function parseCursor(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    try {
      return parseCursor(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  return /** @type {MaestroCursor} */ (raw);
}

/**
 * Serialize cursor to stable 2-space JSON text.
 * @param {MaestroCursor | Record<string, unknown>} cursor
 * @returns {string}
 */
export function serializeCursor(cursor) {
  return `${JSON.stringify(cursor, null, 2)}\n`;
}

/**
 * Pure advance: legal transition table + optional field updates.
 * Rejects illegal jumps (C→G, done-as-step when not on spine, etc.).
 * Redispatch E|F→C increments redispatchCount.
 *
 * @param {MaestroCursor | Record<string, unknown>} cursor
 * @param {string} nextStep
 * @param {{
 *   phaseId?: string,
 *   claimReportPath?: string | null,
 *   leasePath?: string | null,
 *   updatedAt?: string,
 *   now?: string,
 * }} [opts]
 * @returns {CursorAdvanceResult}
 */
export function advanceCursor(cursor, nextStep, opts = {}) {
  const shape = validateCursorShape(cursor);
  if (!shape.ok) {
    return {
      ok: false,
      reason: `invalid cursor: ${shape.errors.join('; ')}`,
    };
  }
  const c = /** @type {MaestroCursor} */ (cursor);
  const from = normStep(c.step);
  const to = normStep(nextStep);
  if (!to) {
    return { ok: false, reason: 'next step is required' };
  }
  if (!isKnownStep(to)) {
    return { ok: false, reason: `unknown next step: ${to}` };
  }

  const redispatchCount = Number(c.redispatchCount) || 0;
  if (!isLegalTransition(from, to, { redispatchCount })) {
    return {
      ok: false,
      reason: `illegal transition ${from} → ${to}` +
        (from === 'E' || from === 'F'
          ? to === 'C' && redispatchCount >= MAX_REDISPATCH
            ? ` (redispatchCount ${redispatchCount} >= max ${MAX_REDISPATCH})`
            : ''
          : ''),
    };
  }

  let nextCount = redispatchCount;
  if ((from === 'E' || from === 'F') && to === 'C') {
    nextCount = redispatchCount + 1;
  }

  /** @type {MaestroCursor} */
  const next = {
    step: to,
    phaseId:
      opts.phaseId != null && String(opts.phaseId).trim() !== ''
        ? String(opts.phaseId).trim()
        : String(c.phaseId),
    redispatchCount: nextCount,
    updatedAt:
      opts.updatedAt != null && String(opts.updatedAt).trim() !== ''
        ? String(opts.updatedAt)
        : opts.now != null && String(opts.now).trim() !== ''
          ? String(opts.now)
          : new Date().toISOString(),
  };

  // Optional paths: explicit null clears; undefined keeps prior; string sets
  if (opts.claimReportPath !== undefined) {
    if (opts.claimReportPath != null && String(opts.claimReportPath).trim() !== '') {
      next.claimReportPath = String(opts.claimReportPath);
    }
  } else if (c.claimReportPath != null && String(c.claimReportPath).trim() !== '') {
    next.claimReportPath = String(c.claimReportPath);
  }

  if (opts.leasePath !== undefined) {
    if (opts.leasePath != null && String(opts.leasePath).trim() !== '') {
      next.leasePath = String(opts.leasePath);
    }
  } else if (c.leasePath != null && String(c.leasePath).trim() !== '') {
    next.leasePath = String(c.leasePath);
  }

  return { ok: true, cursor: next };
}

/**
 * Whether the cursor step allows a Layer-2 assert gate action.
 *
 * Mapping (fail closed):
 *   spawn      → step C
 *   claims     → step D | D.5 | E
 *   done       → step E
 *   phase-done → step G
 *   finalize   → step I
 *
 * Pause `awaiting-operator-advance` blocks spawn/done/phase-done (not finalize).
 * Missing/invalid cursor → not ok.
 *
 * @param {MaestroCursor | null | undefined | Record<string, unknown>} cursor
 * @param {string} gate  spawn | claims | done | phase-done | finalize
 * @returns {CursorGateResult}
 */
export function cursorAllowsGate(cursor, gate) {
  if (cursor == null || typeof cursor !== 'object') {
    return { ok: false, reason: 'missing maestro cursor' };
  }
  const shape = validateCursorShape(cursor);
  if (!shape.ok) {
    return {
      ok: false,
      reason: `invalid maestro cursor: ${shape.errors.join('; ')}`,
    };
  }
  const step = normStep(/** @type {MaestroCursor} */ (cursor).step);
  const g = String(gate ?? '')
    .trim()
    .toLowerCase();

  if (step === AWAITING_OPERATOR_ADVANCE) {
    if (g === 'finalize') {
      // Finalize is plan-end (I); pause is phase-boundary — still block until continue to H/I
      return {
        ok: false,
        reason:
          'maestro cursor is awaiting-operator-advance — refuse gate until operator continue advances cursor',
      };
    }
    return {
      ok: false,
      reason: `maestro cursor is awaiting-operator-advance — refuse ${g || 'gate'} until operator continue`,
    };
  }

  /** @type {Record<string, string[]>} */
  const need = {
    spawn: ['C'],
    claims: ['D', 'D.5', 'E'],
    done: ['E'],
    'phase-done': ['G'],
    finalize: ['I'],
  };

  if (!need[g]) {
    return { ok: false, reason: `unknown gate for cursor check: ${gate}` };
  }
  if (!need[g].includes(step)) {
    return {
      ok: false,
      reason: `maestro cursor step ${step} forbids gate ${g} (need ${need[g].join('|')})`,
    };
  }
  return { ok: true };
}

/**
 * Whether cursor is in the post phase-done pause (pure).
 * @param {MaestroCursor | null | undefined | Record<string, unknown>} cursor
 * @returns {boolean}
 */
export function isAwaitingOperatorAdvance(cursor) {
  if (cursor == null || typeof cursor !== 'object') return false;
  return normStep(/** @type {MaestroCursor} */ (cursor).step) === AWAITING_OPERATOR_ADVANCE;
}

/**
 * Implement pure-maestro Step A (load phase / next-phase re-entry) under stamp.
 * Fail-closed while `awaiting-operator-advance` until {@link clearContinue}.
 * Missing/invalid cursor → not ok (same fail-closed as gates).
 *
 * @param {MaestroCursor | null | undefined | Record<string, unknown>} cursor
 * @returns {CursorGateResult}
 */
/**
 * Pure: attach lastAssert after assert-automate-gate exit 0 (or failure record).
 * Does not mutate input.
 *
 * @param {MaestroCursor | Record<string, unknown>} cursor
 * @param {{
 *   gate: string,
 *   ok: boolean,
 *   reason?: string | null,
 *   at?: string | null,
 * }} fields
 * @returns {CursorAdvanceResult}
 */
export function recordLastAssert(cursor, fields) {
  const shape = validateCursorShape(cursor);
  if (!shape.ok) {
    return {
      ok: false,
      reason: `invalid cursor: ${shape.errors.join('; ')}`,
    };
  }
  if (fields == null || typeof fields !== 'object') {
    return { ok: false, reason: 'recordLastAssert: fields required' };
  }
  const gate = fields.gate != null ? String(fields.gate).trim().toLowerCase() : '';
  if (!gate) {
    return { ok: false, reason: 'recordLastAssert: gate is required' };
  }
  if (typeof fields.ok !== 'boolean') {
    return { ok: false, reason: 'recordLastAssert: ok must be boolean' };
  }
  const c = /** @type {MaestroCursor} */ (cursor);
  /** @type {LastAssert} */
  const lastAssert = {
    gate,
    ok: fields.ok,
    at:
      fields.at != null && String(fields.at).trim() !== ''
        ? String(fields.at).trim()
        : new Date().toISOString(),
  };
  if (fields.reason != null && String(fields.reason).trim() !== '') {
    lastAssert.reason = String(fields.reason).trim();
  }
  /** @type {MaestroCursor} */
  const next = {
    ...c,
    lastAssert,
    updatedAt: lastAssert.at,
  };
  const nextShape = validateCursorShape(next);
  if (!nextShape.ok) {
    return {
      ok: false,
      reason: `invalid cursor after lastAssert: ${nextShape.errors.join('; ')}`,
    };
  }
  return { ok: true, cursor: next };
}

/**
 * Pure: whether lastAssert authorizes a mutation for this gate (done / phase-done).
 * Requires lastAssert.ok === true and matching gate. Missing lastAssert → fail closed
 * under pure-maestro (must run assert-automate-gate first).
 *
 * @param {MaestroCursor | null | undefined | Record<string, unknown>} cursor
 * @param {string} gate
 * @returns {CursorGateResult}
 */
export function lastAssertAllows(cursor, gate) {
  if (cursor == null || typeof cursor !== 'object') {
    return { ok: false, reason: 'missing maestro cursor (need lastAssert after assert-automate-gate)' };
  }
  const shape = validateCursorShape(cursor);
  if (!shape.ok) {
    return {
      ok: false,
      reason: `invalid maestro cursor: ${shape.errors.join('; ')}`,
    };
  }
  const want = String(gate ?? '').trim().toLowerCase();
  if (!want) {
    return { ok: false, reason: 'lastAssertAllows: gate is required' };
  }
  const la = /** @type {MaestroCursor} */ (cursor).lastAssert;
  if (la == null || typeof la !== 'object') {
    return {
      ok: false,
      reason: `missing lastAssert for gate ${want} — run assert-automate-gate --gate ${want} first (exit 0)`,
    };
  }
  const got = la.gate != null ? String(la.gate).trim().toLowerCase() : '';
  if (got !== want) {
    return {
      ok: false,
      reason: `lastAssert.gate is ${got || '(empty)'} (need ${want}) — re-run assert-automate-gate --gate ${want}`,
    };
  }
  if (la.ok !== true) {
    return {
      ok: false,
      reason: `lastAssert.ok is false for gate ${want}${la.reason ? `: ${la.reason}` : ''}`,
    };
  }
  return { ok: true };
}

/**
 * FS: write lastAssert onto on-disk cursor (create via ensureCursor if missing).
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @param {{
 *   gate: string,
 *   ok: boolean,
 *   reason?: string | null,
 *   at?: string | null,
 *   phaseId?: string,
 * }} fields
 * @returns {{ path: string, cursor: MaestroCursor }}
 */
export function recordLastAssertFile(statusRoot, planSlug, fields) {
  let read = readCursorResult(statusRoot, planSlug);
  let cursor = read.cursor;
  if (read.status === 'missing' || cursor == null) {
    const phaseId =
      fields.phaseId != null && String(fields.phaseId).trim() !== ''
        ? String(fields.phaseId).trim()
        : 'F0';
    const ensured = ensureCursor(statusRoot, planSlug, { phaseId });
    cursor = ensured.cursor;
  }
  if (read.status === 'malformed') {
    throw new Error(
      `recordLastAssertFile: malformed cursor for ${planSlug}: ${read.error || 'invalid'}`,
    );
  }
  const result = recordLastAssert(cursor, fields);
  if (!result.ok || result.cursor == null) {
    throw new Error(result.reason || 'recordLastAssertFile failed');
  }
  const path = writeCursorFile(statusRoot, planSlug, result.cursor);
  return { path, cursor: result.cursor };
}

export function cursorAllowsStepA(cursor) {
  if (cursor == null || typeof cursor !== 'object') {
    return { ok: false, reason: 'missing maestro cursor' };
  }
  const shape = validateCursorShape(cursor);
  if (!shape.ok) {
    return {
      ok: false,
      reason: `invalid maestro cursor: ${shape.errors.join('; ')}`,
    };
  }
  if (isAwaitingOperatorAdvance(cursor)) {
    return {
      ok: false,
      reason:
        'maestro cursor is awaiting-operator-advance — refuse Step A until clearContinue (operator-continue token)',
    };
  }
  return { ok: true };
}

/**
 * After successful phase-done under durable automate: advance G → awaiting-operator-advance.
 * Idempotent when already paused. Does **not** auto-materialize or finalize.
 * Non-automate phase-done must not call this (non-automate unchanged).
 *
 * @param {MaestroCursor | Record<string, unknown>} cursor
 * @param {{
 *   phaseId?: string,
 *   claimReportPath?: string | null,
 *   leasePath?: string | null,
 *   updatedAt?: string,
 *   now?: string,
 * }} [opts]
 * @returns {CursorAdvanceResult & { alreadyPaused?: boolean }}
 */
export function recordPhaseDonePause(cursor, opts = {}) {
  const shape = validateCursorShape(cursor);
  if (!shape.ok) {
    return {
      ok: false,
      reason: `invalid cursor: ${shape.errors.join('; ')}`,
    };
  }
  const c = /** @type {MaestroCursor} */ (cursor);
  const step = normStep(c.step);
  if (step === AWAITING_OPERATOR_ADVANCE) {
    return { ok: true, cursor: c, alreadyPaused: true };
  }
  if (step !== 'G') {
    return {
      ok: false,
      reason: `recordPhaseDonePause requires step G after phase-done (have ${step}) — refuse auto-chain`,
    };
  }
  const advanced = advanceCursor(c, AWAITING_OPERATOR_ADVANCE, opts);
  if (!advanced.ok) return advanced;
  return { ...advanced, alreadyPaused: false };
}

/**
 * Operator continue path: clear post phase-done pause (awaiting → H).
 *
 * Requires an **explicit** continue token — generic ok / phase-done y alone is not enough:
 * - `continueToken: 'operator-continue'` ({@link OPERATOR_CONTINUE_TOKEN}), or
 * - `operatorContinue: true` (same semantics; skill documents either form).
 *
 * After clear, next-phase prep is **H** (materialize if descriptor-only; then A).
 * Does not auto-materialize, does not auto-finalize, does not jump to C/spawn.
 *
 * @param {MaestroCursor | Record<string, unknown>} cursor
 * @param {{
 *   continueToken?: string,
 *   operatorContinue?: boolean,
 *   phaseId?: string,
 *   claimReportPath?: string | null,
 *   leasePath?: string | null,
 *   updatedAt?: string,
 *   now?: string,
 * }} [opts]
 * @returns {CursorAdvanceResult}
 */
export function clearContinue(cursor, opts = {}) {
  const tokenOk =
    opts.operatorContinue === true ||
    (opts.continueToken != null &&
      String(opts.continueToken).trim() === OPERATOR_CONTINUE_TOKEN);
  if (!tokenOk) {
    return {
      ok: false,
      reason:
        `clearContinue requires continueToken: '${OPERATOR_CONTINUE_TOKEN}' or operatorContinue: true ` +
        '(generic ok is not a continue token under automate pause)',
    };
  }
  const shape = validateCursorShape(cursor);
  if (!shape.ok) {
    return {
      ok: false,
      reason: `invalid cursor: ${shape.errors.join('; ')}`,
    };
  }
  const step = normStep(/** @type {MaestroCursor} */ (cursor).step);
  if (step !== AWAITING_OPERATOR_ADVANCE) {
    return {
      ok: false,
      reason: `clearContinue only from awaiting-operator-advance (have ${step})`,
    };
  }
  return advanceCursor(/** @type {MaestroCursor} */ (cursor), 'H', opts);
}

// --- Thin FS wrappers ---

/**
 * Read cursor file with explicit status (missing | ok | malformed).
 * Fail-closed: unparseable / invalid shape → malformed, never missing.
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {CursorReadResult}
 */
export function readCursorResult(statusRoot, planSlug) {
  let path;
  try {
    path = cursorPath(statusRoot, planSlug);
  } catch (err) {
    return {
      status: 'malformed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
  if (!existsSync(path)) {
    return { status: 'missing' };
  }
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    return {
      status: 'malformed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const parsed = parseCursor(text);
  if (parsed == null) {
    return { status: 'malformed', error: 'unparseable cursor JSON' };
  }
  const shape = validateCursorShape(parsed);
  if (!shape.ok) {
    return {
      status: 'malformed',
      error: shape.errors.join('; '),
      cursor: parsed,
    };
  }
  return { status: 'ok', cursor: parsed };
}

/**
 * Write cursor file (creates automate/ dir). Overwrites — skill owns advance
 * discipline; assert only reads. Not exclusive-create (unlike writer lease).
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @param {MaestroCursor} cursor
 * @returns {string} path written
 */
export function writeCursorFile(statusRoot, planSlug, cursor) {
  const shape = validateCursorShape(cursor);
  if (!shape.ok) {
    throw new Error(
      `writeCursorFile: invalid cursor: ${shape.errors.join('; ')}`,
    );
  }
  const path = cursorPath(statusRoot, planSlug);
  mkdirSync(join(String(statusRoot), MAESTRO_CURSOR_DIR), { recursive: true });
  writeFileSync(path, serializeCursor(cursor), 'utf8');
  return path;
}

/**
 * Ensure a cursor exists for first automate entry.
 * Missing → initialize at step A (or opts.step) without throw.
 * Malformed → does not overwrite; returns malformed result (caller repairs).
 * Existing ok → returns as-is.
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @param {{ phaseId: string, step?: string, updatedAt?: string }} opts
 * @returns {CursorReadResult & { initialized?: boolean, path?: string }}
 */
export function ensureCursor(statusRoot, planSlug, opts) {
  if (opts == null || typeof opts !== 'object') {
    throw new Error('ensureCursor: opts with phaseId is required');
  }
  const phaseId = String(opts.phaseId ?? '').trim();
  if (!phaseId) {
    throw new Error('ensureCursor: phaseId is required');
  }

  const existing = readCursorResult(statusRoot, planSlug);
  if (existing.status === 'ok') {
    return { ...existing, initialized: false, path: cursorPath(statusRoot, planSlug) };
  }
  if (existing.status === 'malformed') {
    return { ...existing, initialized: false };
  }

  // missing — init at A (or B) without throw
  const step = normStep(opts.step ?? 'A') || 'A';
  const cursor = buildInitialCursor({
    phaseId,
    step: isKnownStep(step) ? step : 'A',
    updatedAt: opts.updatedAt,
  });
  const path = writeCursorFile(statusRoot, planSlug, cursor);
  return { status: 'ok', cursor, initialized: true, path };
}

/**
 * Durable write after successful automate phase-done: set step awaiting-operator-advance.
 * Reads existing cursor; must be at G (or already paused). Malformed/missing → not ok.
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @param {{
 *   phaseId?: string,
 *   updatedAt?: string,
 *   now?: string,
 * }} [opts]
 * @returns {CursorAdvanceResult & { path?: string, alreadyPaused?: boolean }}
 */
export function recordPhaseDonePauseFile(statusRoot, planSlug, opts = {}) {
  const read = readCursorResult(statusRoot, planSlug);
  if (read.status === 'missing') {
    return {
      ok: false,
      reason:
        'maestro cursor missing — cannot record phase-done pause; ensureCursor/advance to G before phase-done',
    };
  }
  if (read.status === 'malformed' || !read.cursor) {
    return {
      ok: false,
      reason: `maestro cursor malformed: ${read.error || 'invalid'} — repair; do not delete to force progress`,
    };
  }
  const result = recordPhaseDonePause(read.cursor, opts);
  if (!result.ok || !result.cursor) return result;
  const path = writeCursorFile(statusRoot, planSlug, result.cursor);
  return { ...result, path };
}

/**
 * Durable operator continue: clear awaiting-operator-advance → H when token valid.
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @param {{
 *   continueToken?: string,
 *   operatorContinue?: boolean,
 *   phaseId?: string,
 *   updatedAt?: string,
 *   now?: string,
 * }} [opts]
 * @returns {CursorAdvanceResult & { path?: string }}
 */
export function clearContinueFile(statusRoot, planSlug, opts = {}) {
  const read = readCursorResult(statusRoot, planSlug);
  if (read.status === 'missing') {
    return {
      ok: false,
      reason: 'maestro cursor missing — nothing to clearContinue',
    };
  }
  if (read.status === 'malformed' || !read.cursor) {
    return {
      ok: false,
      reason: `maestro cursor malformed: ${read.error || 'invalid'} — repair; do not delete to force progress`,
    };
  }
  const result = clearContinue(read.cursor, opts);
  if (!result.ok || !result.cursor) return result;
  const path = writeCursorFile(statusRoot, planSlug, result.cursor);
  return { ...result, path };
}
