/**
 * Pure writer-lease helpers for automate phase-writer exclusive windows (design D isolation).
 *
 * Lease record shape (on disk — public fields only):
 *   { planSlug, phaseId, startedAt, hostId, worktreePath, writerBranch?,
 *     status, tokenHash }
 *
 * Path: <statusRoot>/writer-leases/<planSlug>.json
 * File mode: 0o600 when the platform supports it.
 *
 * **Owner secret (F2):** acquire generates a high-entropy secret
 * (`crypto.randomBytes(32).toString('hex')`) returned only to the acquirer.
 * On disk we store `tokenHash = sha256(secret)` — never the plaintext secret.
 * `clearLeaseFile(statusRoot, planSlug, secret)` verifies the hash; forged
 * public-field clears fail. Identity fields (phaseId/hostId) remain optional
 * CAS extras; the secret is required.
 *
 * Acquire is exclusive create (`wx` / O_EXCL) — never overwrite an existing lease file.
 * Clear unlinks when secret matches (no intermediate non-blocking cleared state).
 * Read is fail-closed on malformed JSON (missing ≠ malformed).
 *
 * **isLeaseBlocking (F5/F12):** true for ANY non-missing lease file status
 * (`active`, `cleared`, `malformed`) — residue blocks resume/spawn/leave-automate.
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
  fchmodSync,
  constants,
} from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';

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
 *   tokenHash?: string,
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
 *
 * @typedef {{
 *   path: string,
 *   secret: string,
 *   lease: WriterLease,
 * }} AcquireLeaseResult
 */

/** Relative directory under statusRoot for lease files. */
export const WRITER_LEASES_DIR = 'writer-leases';

/**
 * SHA-256 hex digest of a lease secret (never store the secret itself).
 * @param {string} secret
 * @returns {string}
 */
export function hashLeaseSecret(secret) {
  return createHash('sha256').update(String(secret), 'utf8').digest('hex');
}

/**
 * Generate a high-entropy lease secret (64 hex chars).
 * @returns {string}
 */
export function generateLeaseSecret() {
  return randomBytes(32).toString('hex');
}

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
 * Build a new active lease record (pure — no I/O). Does not include tokenHash;
 * acquireLeaseFile stamps tokenHash from a generated secret.
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
 * Prefer clearLeaseFile which unlinks; this is for audit/tests only.
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
 * Extract the public identity token from a lease (or token-shaped object).
 * Note: identity alone is NOT sufficient to clear — use the acquire secret.
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
 * Whether two owner identity tokens match (exact string equality on all four fields).
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
 * Never include a plaintext `secret` field even if present on the object.
 * @param {WriterLease | Record<string, unknown>} lease
 * @returns {string}
 */
export function serializeLease(lease) {
  const { secret: _secret, ...safe } = /** @type {any} */ (lease);
  return `${JSON.stringify(safe, null, 2)}\n`;
}

// --- Optional thin FS wrappers (for orchestrator runtime; pure core above) ---

/**
 * Atomically acquire an active writer lease via exclusive create (`wx` / O_EXCL).
 * Fails if any lease file already exists for the plan (active, cleared residue, or garbage).
 * Never overwrites.
 *
 * Generates a high-entropy secret, stores only `tokenHash` on disk (mode 0o600),
 * and returns `{ path, secret, lease }` — the secret is NOT written to disk.
 *
 * @param {string} statusRoot
 * @param {WriterLease} lease must be active with required fields
 * @returns {AcquireLeaseResult}
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

  const secret = generateLeaseSecret();
  const tokenHash = hashLeaseSecret(secret);
  /** @type {WriterLease} */
  const onDisk = {
    ...lease,
    status: 'active',
    tokenHash,
  };
  // Ensure no secret leaks into the serialized form
  delete /** @type {any} */ (onDisk).secret;

  const payload = serializeLease(onDisk);
  let fd;
  try {
    fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
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
    try {
      fchmodSync(fd, 0o600);
    } catch {
      // best-effort on platforms that ignore mode
    }
  } finally {
    closeSync(fd);
  }
  return { path, secret, lease: onDisk };
}

/**
 * Write an active lease file with exclusive create (same fence as acquireLeaseFile).
 * Does **not** overwrite an existing lease file — use clearLeaseFile (with secret)
 * then acquire again. Prefer acquireLeaseFile for new code.
 *
 * @param {string} statusRoot
 * @param {WriterLease} lease
 * @returns {AcquireLeaseResult | string} acquire result for active; path for cleared-shaped writes
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
    fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
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
    try {
      fchmodSync(fd, 0o600);
    } catch {
      // best-effort
    }
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
 * True when resume/spawn/leave-automate must refuse for this plan:
 * **any** non-missing lease file (active, cleared residue, or malformed).
 * Fail-closed: residue is never treated as absent (F5/F12).
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {boolean}
 */
export function isLeaseBlocking(statusRoot, planSlug) {
  const result = readLeaseResult(statusRoot, planSlug);
  return result.status !== 'missing';
}

/**
 * True when an active lease exists, **or** any residual/malformed lease blocks
 * the gate (fail-closed). Prefer isLeaseBlocking for explicit gate semantics.
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {boolean}
 */
export function hasActiveLease(statusRoot, planSlug) {
  return isLeaseBlocking(statusRoot, planSlug);
}

/**
 * HARD-GATE before clear-execution-mode / Mode-1 when stamp is automate (F10).
 * Throws if any lease file residue blocks the plan.
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {void}
 * @throws {Error} code LEASE_BLOCKS when status is not missing
 */
export function assertLeaseAbsent(statusRoot, planSlug) {
  const result = readLeaseResult(statusRoot, planSlug);
  if (result.status === 'missing') return;
  const e = new Error(
    `assertLeaseAbsent: writer lease blocks leave-automate / Mode-1 for ${planSlug} (status=${result.status}) — clear with acquire secret after merge settle, or remove residue only when ownership is proven`,
  );
  /** @type {any} */ (e).code = 'LEASE_BLOCKS';
  /** @type {any} */ (e).status = result.status;
  throw e;
}

/**
 * Clear lease only when the acquire secret matches on-disk `tokenHash`.
 * Public identity fields alone never clear (forged clear fails).
 * Unlinks the file when secret matches — no intermediate non-blocking cleared state.
 * Prefer call only after sync-wait + claim collect + merge settle.
 *
 * Optional identity CAS: pass `identity: { phaseId?, hostId?, startedAt? }` to
 * also require those public fields match (secret is still required).
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @param {string | { secret: string, phaseId?: string, hostId?: string, startedAt?: string }} secretOrOpts
 * @returns {boolean} true if a file was removed
 */
export function clearLeaseFile(statusRoot, planSlug, secretOrOpts) {
  if (secretOrOpts == null) {
    throw new Error(
      'clearLeaseFile: secret required (acquire secret; public identity alone is not enough)',
    );
  }

  /** @type {string} */
  let secret;
  /** @type {{ phaseId?: string, hostId?: string, startedAt?: string } | null} */
  let identity = null;

  if (typeof secretOrOpts === 'string') {
    secret = secretOrOpts;
  } else if (typeof secretOrOpts === 'object') {
    // Accept { secret } or legacy-shaped objects that still require a secret field
    if (
      secretOrOpts.secret == null ||
      String(/** @type {any} */ (secretOrOpts).secret).trim() === ''
    ) {
      // Legacy owner-token-only clear (no secret) — refuse (F2)
      throw new Error(
        'clearLeaseFile: secret required (acquire secret; public identity alone is not enough)',
      );
    }
    secret = String(/** @type {any} */ (secretOrOpts).secret);
    identity = secretOrOpts;
  } else {
    throw new Error(
      'clearLeaseFile: secret required (acquire secret; public identity alone is not enough)',
    );
  }

  if (String(secret).trim() === '') {
    throw new Error(
      'clearLeaseFile: secret required (acquire secret; public identity alone is not enough)',
    );
  }

  const path = leasePath(statusRoot, planSlug);
  if (!existsSync(path)) return false;

  const result = readLeaseResult(statusRoot, planSlug);
  if (result.status === 'missing') return false;

  if (result.status === 'malformed') {
    const e = new Error(
      `clearLeaseFile: malformed lease for ${planSlug} — refuse clear without recoverable tokenHash (${result.error || 'invalid'})`,
    );
    /** @type {any} */ (e).code = 'LEASE_MALFORMED';
    throw e;
  }

  const existing = result.lease;
  if (existing == null) {
    const e = new Error(
      `clearLeaseFile: malformed lease for ${planSlug} — missing lease body`,
    );
    /** @type {any} */ (e).code = 'LEASE_MALFORMED';
    throw e;
  }

  const expectedHash =
    existing.tokenHash != null ? String(existing.tokenHash).trim() : '';
  if (expectedHash === '') {
    const e = new Error(
      `clearLeaseFile: lease for ${planSlug} has no tokenHash — refuse clear (re-acquire after manual residue removal if orphaned)`,
    );
    /** @type {any} */ (e).code = 'LEASE_SECRET_MISMATCH';
    throw e;
  }

  if (hashLeaseSecret(secret) !== expectedHash) {
    const e = new Error(
      `clearLeaseFile: secret mismatch for ${planSlug} (refuse clear of non-owned lease)`,
    );
    /** @type {any} */ (e).code = 'LEASE_SECRET_MISMATCH';
    throw e;
  }

  // Optional identity CAS (secret already verified)
  if (identity != null) {
    if (
      identity.phaseId != null &&
      String(identity.phaseId).trim() !== '' &&
      String(identity.phaseId).trim() !== String(existing.phaseId ?? '')
    ) {
      const e = new Error(
        `clearLeaseFile: identity phaseId mismatch for ${planSlug}`,
      );
      /** @type {any} */ (e).code = 'LEASE_TOKEN_MISMATCH';
      throw e;
    }
    if (
      identity.hostId != null &&
      String(identity.hostId).trim() !== '' &&
      String(identity.hostId).trim() !== String(existing.hostId ?? '')
    ) {
      const e = new Error(
        `clearLeaseFile: identity hostId mismatch for ${planSlug}`,
      );
      /** @type {any} */ (e).code = 'LEASE_TOKEN_MISMATCH';
      throw e;
    }
    if (
      identity.startedAt != null &&
      String(identity.startedAt).trim() !== '' &&
      String(identity.startedAt).trim() !== String(existing.startedAt ?? '')
    ) {
      const e = new Error(
        `clearLeaseFile: identity startedAt mismatch for ${planSlug}`,
      );
      /** @type {any} */ (e).code = 'LEASE_TOKEN_MISMATCH';
      throw e;
    }
  }

  // Unlink only — no intermediate non-blocking cleared state (F2/F5)
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}
