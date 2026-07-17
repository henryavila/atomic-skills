/**
 * Pure writer-lease helpers for automate phase-writer exclusive windows (design D isolation).
 *
 * Lease record shape:
 *   { planSlug, phaseId, startedAt, hostId, worktreePath, writerBranch?, status }
 *
 * Path: <statusRoot>/writer-leases/<planSlug>.json
 * Active when status === 'active' and required fields are present.
 *
 * Owner token (CAS clear): planSlug + phaseId + hostId + startedAt — only the
 * acquirer (or an exact match of those fields) may clear.
 *
 * Acquire is exclusive create (`wx` / O_EXCL) — never overwrite an existing lease file.
 * Read is fail-closed on malformed JSON (missing ≠ malformed).
 *
 * Pure builders/parsers preferred; thin FS wrappers for acquire/clear/read.
 * No network.
 */

import { join } from 'node:path';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  openSync,
  closeSync,
  writeSync,
  constants,
} from 'node:fs';

/** @typedef {'active' | 'cleared' | string} WriterLeaseStatus */

/**
 * @typedef {{
 *   planSlug: string,
 *   phaseId: string,
 *   startedAt: string,
 *   hostId: string,
 *   worktreePath: string,
 *   writerBranch?: string | null,
 *   status: WriterLeaseStatus,
 * }} WriterLease
 *
 * @typedef {{
 *   planSlug: string,
 *   phaseId: string,
 *   hostId: string,
 *   startedAt: string,
 * }} LeaseOwnerToken
 *
 * @typedef {{
 *   status: 'missing' | 'active' | 'cleared' | 'malformed',
 *   lease?: WriterLease,
 *   error?: string,
 * }} LeaseReadResult
 */

/** Relative directory under statusRoot for lease files. */
export const WRITER_LEASES_DIR = 'writer-leases';

/**
 * Absolute path for a plan's writer lease file.
 * @param {string} statusRoot e.g. `.atomic-skills/status` or absolute status root
 * @param {string} planSlug
 * @returns {string}
 */
export function leasePath(statusRoot, planSlug) {
  if (statusRoot == null || String(statusRoot).trim() === '') {
    throw new Error('leasePath: statusRoot is required');
  }
  if (planSlug == null || String(planSlug).trim() === '') {
    throw new Error('leasePath: planSlug is required');
  }
  const slug = sanitizePlanSlug(String(planSlug).trim());
  return join(String(statusRoot), WRITER_LEASES_DIR, `${slug}.json`);
}

/**
 * Sanitize plan slug for a single path segment (no path traversal).
 * @param {string} planSlug
 * @returns {string}
 */
export function sanitizePlanSlug(planSlug) {
  const s = String(planSlug).trim();
  if (s === '' || s === '.' || s === '..' || s.includes('/') || s.includes('\\') || s.includes('\0')) {
    throw new Error(`leasePath: invalid planSlug: ${planSlug}`);
  }
  return s;
}

/**
 * Whether a lease record is active (HARD-GATE for resume / second spawn).
 * Requires status === 'active' and all required identity fields present non-empty.
 *
 * @param {WriterLease | null | undefined | Record<string, unknown>} lease
 * @returns {boolean}
 */
export function isLeaseActive(lease) {
  if (lease == null || typeof lease !== 'object') return false;
  if (lease.status !== 'active') return false;

  const required = ['planSlug', 'phaseId', 'startedAt', 'hostId', 'worktreePath'];
  for (const key of required) {
    const v = lease[key];
    if (v == null || String(v).trim() === '') return false;
  }
  return true;
}

/**
 * Build a new active lease record (pure — no I/O).
 *
 * @param {{
 *   planSlug: string,
 *   phaseId: string,
 *   hostId: string,
 *   worktreePath: string,
 *   writerBranch?: string | null,
 *   startedAt?: string,
 * }} input
 * @returns {WriterLease}
 */
export function buildActiveLease(input) {
  if (input == null || typeof input !== 'object') {
    throw new Error('buildActiveLease: input is required');
  }
  const planSlug = String(input.planSlug ?? '').trim();
  const phaseId = String(input.phaseId ?? '').trim();
  const hostId = String(input.hostId ?? '').trim();
  const worktreePath = String(input.worktreePath ?? '').trim();
  if (!planSlug || !phaseId || !hostId || !worktreePath) {
    throw new Error(
      'buildActiveLease: planSlug, phaseId, hostId, and worktreePath are required',
    );
  }
  sanitizePlanSlug(planSlug);

  /** @type {WriterLease} */
  const lease = {
    planSlug,
    phaseId,
    startedAt:
      input.startedAt != null && String(input.startedAt).trim() !== ''
        ? String(input.startedAt)
        : new Date().toISOString(),
    hostId,
    worktreePath,
    status: 'active',
  };
  if (input.writerBranch != null && String(input.writerBranch).trim() !== '') {
    lease.writerBranch = String(input.writerBranch).trim();
  }
  return lease;
}

/**
 * Return a cleared copy of a lease (pure — does not mutate input).
 * @param {WriterLease | Record<string, unknown>} lease
 * @returns {WriterLease}
 */
export function buildClearedLease(lease) {
  if (lease == null || typeof lease !== 'object') {
    throw new Error('buildClearedLease: lease is required');
  }
  return {
    ...lease,
    planSlug: String(lease.planSlug ?? ''),
    phaseId: String(lease.phaseId ?? ''),
    startedAt: String(lease.startedAt ?? ''),
    hostId: String(lease.hostId ?? ''),
    worktreePath: String(lease.worktreePath ?? ''),
    status: 'cleared',
  };
}

/**
 * Extract the owner CAS token from a lease (or token-shaped object).
 * @param {WriterLease | LeaseOwnerToken | Record<string, unknown>} leaseOrToken
 * @returns {LeaseOwnerToken}
 */
export function leaseOwnerToken(leaseOrToken) {
  if (leaseOrToken == null || typeof leaseOrToken !== 'object') {
    throw new Error('leaseOwnerToken: lease or token is required');
  }
  const planSlug = String(leaseOrToken.planSlug ?? '').trim();
  const phaseId = String(leaseOrToken.phaseId ?? '').trim();
  const hostId = String(leaseOrToken.hostId ?? '').trim();
  const startedAt = String(leaseOrToken.startedAt ?? '').trim();
  if (!planSlug || !phaseId || !hostId || !startedAt) {
    throw new Error(
      'leaseOwnerToken: planSlug, phaseId, hostId, and startedAt are required',
    );
  }
  return { planSlug, phaseId, hostId, startedAt };
}

/**
 * Whether two owner tokens match (exact string equality on all four fields).
 * @param {WriterLease | LeaseOwnerToken | null | undefined} a
 * @param {WriterLease | LeaseOwnerToken | null | undefined} b
 * @returns {boolean}
 */
export function leaseTokenMatches(a, b) {
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  try {
    const ta = leaseOwnerToken(a);
    const tb = leaseOwnerToken(b);
    return (
      ta.planSlug === tb.planSlug &&
      ta.phaseId === tb.phaseId &&
      ta.hostId === tb.hostId &&
      ta.startedAt === tb.startedAt
    );
  } catch {
    return false;
  }
}

/**
 * Parse lease JSON text. Returns null on empty/invalid.
 * @param {string | null | undefined} text
 * @returns {WriterLease | null}
 */
export function parseLeaseJson(text) {
  if (text == null || String(text).trim() === '') return null;
  try {
    const obj = JSON.parse(String(text));
    if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return null;
    return /** @type {WriterLease} */ (obj);
  } catch {
    return null;
  }
}

/**
 * Serialize a lease record to JSON text (stable 2-space).
 * @param {WriterLease} lease
 * @returns {string}
 */
export function serializeLease(lease) {
  return `${JSON.stringify(lease, null, 2)}\n`;
}

// --- Optional thin FS wrappers (for orchestrator runtime; pure core above) ---

/**
 * Atomically acquire an active writer lease via exclusive create (`wx` / O_EXCL).
 * Fails if any lease file already exists for the plan (active, cleared residue, or garbage).
 * Never overwrites.
 *
 * @param {string} statusRoot
 * @param {WriterLease} lease must be active with required fields
 * @returns {string} path written
 */
export function acquireLeaseFile(statusRoot, lease) {
  if (lease == null || typeof lease !== 'object') {
    throw new Error('acquireLeaseFile: lease is required');
  }
  if (!isLeaseActive(lease)) {
    throw new Error('acquireLeaseFile: lease must be active with required fields');
  }
  const path = leasePath(statusRoot, lease.planSlug);
  mkdirSync(join(String(statusRoot), WRITER_LEASES_DIR), { recursive: true });

  const payload = serializeLease(/** @type {WriterLease} */ (lease));
  let fd;
  try {
    fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o644);
  } catch (err) {
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'EEXIST') {
      const e = new Error(
        `acquireLeaseFile: lease already exists for ${lease.planSlug} (exclusive acquire refused)`,
      );
      /** @type {any} */ (e).code = 'LEASE_EXISTS';
      /** @type {any} */ (e).cause = err;
      throw e;
    }
    throw err;
  }
  try {
    writeSync(fd, payload);
  } finally {
    closeSync(fd);
  }
  return path;
}

/**
 * Write an active lease file with exclusive create (same fence as acquireLeaseFile).
 * Does **not** overwrite an existing lease file — use clearLeaseFile (with owner token)
 * then acquire again. Prefer acquireLeaseFile for new code.
 *
 * @param {string} statusRoot
 * @param {WriterLease} lease
 * @returns {string} path written
 */
export function writeLeaseFile(statusRoot, lease) {
  if (lease == null || typeof lease !== 'object') {
    throw new Error('writeLeaseFile: lease is required');
  }
  // Active acquire path: exclusive create only
  if (isLeaseActive(lease) || lease.status === 'active') {
    return acquireLeaseFile(statusRoot, lease);
  }
  // Cleared / audit records must still not clobber an existing file (fence integrity)
  const path = leasePath(statusRoot, lease.planSlug);
  mkdirSync(join(String(statusRoot), WRITER_LEASES_DIR), { recursive: true });
  let fd;
  try {
    fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o644);
  } catch (err) {
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'EEXIST') {
      const e = new Error(
        `writeLeaseFile: lease already exists for ${lease.planSlug} (exclusive create refused)`,
      );
      /** @type {any} */ (e).code = 'LEASE_EXISTS';
      throw e;
    }
    throw err;
  }
  try {
    writeSync(fd, serializeLease(/** @type {WriterLease} */ (lease)));
  } finally {
    closeSync(fd);
  }
  return path;
}

/**
 * Read lease file with explicit status (missing | active | cleared | malformed).
 * Fail-closed: unparseable / incomplete active shape → `malformed`, never `missing`.
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {LeaseReadResult}
 */
export function readLeaseResult(statusRoot, planSlug) {
  const path = leasePath(statusRoot, planSlug);
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

  if (text == null || String(text).trim() === '') {
    return { status: 'malformed', error: 'empty lease file' };
  }

  const lease = parseLeaseJson(text);
  if (lease == null) {
    return { status: 'malformed', error: 'unparseable lease JSON' };
  }

  if (lease.status === 'active') {
    if (isLeaseActive(lease)) {
      return { status: 'active', lease };
    }
    return {
      status: 'malformed',
      lease,
      error: 'active lease missing required identity fields',
    };
  }

  if (lease.status === 'cleared') {
    return { status: 'cleared', lease };
  }

  // Unknown status: if it still looks fully active, treat as active; else malformed
  if (isLeaseActive({ ...lease, status: 'active' }) && lease.status == null) {
    return { status: 'active', lease: { ...lease, status: 'active' } };
  }

  return {
    status: 'malformed',
    lease,
    error: `unexpected lease status: ${String(lease.status)}`,
  };
}

/**
 * Read lease file if present and well-formed.
 * - missing → null
 * - malformed → throws (code LEASE_MALFORMED) — fail-closed, never silent absent
 * - active / cleared → lease record
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {WriterLease | null}
 */
export function readLeaseFile(statusRoot, planSlug) {
  const result = readLeaseResult(statusRoot, planSlug);
  if (result.status === 'missing') return null;
  if (result.status === 'malformed') {
    const e = new Error(
      `readLeaseFile: malformed lease for ${planSlug}: ${result.error || 'invalid'}`,
    );
    /** @type {any} */ (e).code = 'LEASE_MALFORMED';
    throw e;
  }
  return result.lease ?? null;
}

/**
 * True when resume/spawn must refuse for this plan: active lease **or** malformed file.
 * Fail-closed: malformed is never treated as absent.
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {boolean}
 */
export function isLeaseBlocking(statusRoot, planSlug) {
  const result = readLeaseResult(statusRoot, planSlug);
  return result.status === 'active' || result.status === 'malformed';
}

/**
 * True when an active lease exists, **or** a malformed lease blocks the gate (fail-closed).
 * Prefer isLeaseBlocking for explicit gate semantics; this keeps resume prose working.
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {boolean}
 */
export function hasActiveLease(statusRoot, planSlug) {
  return isLeaseBlocking(statusRoot, planSlug);
}

/**
 * Clear lease only when owner token matches (CAS):
 * planSlug + phaseId + hostId + startedAt must equal the on-disk lease.
 * Only then write status cleared and unlink. Wrong token refuses (throws).
 * Prefer call only after sync-wait + claim collect + merge settle.
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @param {LeaseOwnerToken | WriterLease} ownerToken
 * @returns {boolean} true if a file was removed
 */
export function clearLeaseFile(statusRoot, planSlug, ownerToken) {
  if (ownerToken == null || typeof ownerToken !== 'object') {
    throw new Error(
      'clearLeaseFile: owner token required (planSlug, phaseId, hostId, startedAt)',
    );
  }
  let token;
  try {
    token = leaseOwnerToken(ownerToken);
  } catch {
    throw new Error(
      'clearLeaseFile: owner token required (planSlug, phaseId, hostId, startedAt)',
    );
  }
  if (String(token.planSlug) !== String(planSlug).trim()) {
    throw new Error(
      `clearLeaseFile: owner token planSlug mismatch (token=${token.planSlug}, path=${planSlug})`,
    );
  }

  const path = leasePath(statusRoot, planSlug);
  if (!existsSync(path)) return false;

  const result = readLeaseResult(statusRoot, planSlug);
  if (result.status === 'missing') return false;

  if (result.status === 'malformed') {
    const e = new Error(
      `clearLeaseFile: malformed lease for ${planSlug} — refuse clear without recoverable owner token (${result.error || 'invalid'})`,
    );
    /** @type {any} */ (e).code = 'LEASE_MALFORMED';
    throw e;
  }

  const existing = result.lease;
  if (!leaseTokenMatches(existing, token)) {
    const e = new Error(
      `clearLeaseFile: owner token mismatch for ${planSlug} (refuse clear of non-owned lease)`,
    );
    /** @type {any} */ (e).code = 'LEASE_TOKEN_MISMATCH';
    throw e;
  }

  try {
    writeFileSync(path, serializeLease(buildClearedLease(existing)), 'utf8');
  } catch {
    // still attempt unlink when token matched
  }
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}
