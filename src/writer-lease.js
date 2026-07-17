/**
 * Pure writer-lease helpers for automate phase-writer exclusive windows (design D isolation).
 *
 * Lease record shape:
 *   { planSlug, phaseId, startedAt, hostId, worktreePath, writerBranch?, status }
 *
 * Path: <statusRoot>/writer-leases/<planSlug>.json
 * Active when status === 'active' and required fields are present.
 *
 * Pure builders/parsers preferred; optional thin FS wrappers for create/clear/read.
 * No network.
 */

import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

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
 * Write an active lease file (creates writer-leases dir). Overwrites existing.
 * @param {string} statusRoot
 * @param {WriterLease} lease
 * @returns {string} path written
 */
export function writeLeaseFile(statusRoot, lease) {
  if (!isLeaseActive(lease) && lease?.status !== 'cleared') {
    // Allow writing cleared records for audit; require shape fields for active.
  }
  if (lease == null || typeof lease !== 'object') {
    throw new Error('writeLeaseFile: lease is required');
  }
  const path = leasePath(statusRoot, lease.planSlug);
  mkdirSync(join(String(statusRoot), WRITER_LEASES_DIR), { recursive: true });
  writeFileSync(path, serializeLease(/** @type {WriterLease} */ (lease)), 'utf8');
  return path;
}

/**
 * Read lease file if present; null if missing or unparseable.
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {WriterLease | null}
 */
export function readLeaseFile(statusRoot, planSlug) {
  const path = leasePath(statusRoot, planSlug);
  if (!existsSync(path)) return null;
  try {
    return parseLeaseJson(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * True when an active lease exists on disk for planSlug.
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {boolean}
 */
export function hasActiveLease(statusRoot, planSlug) {
  return isLeaseActive(readLeaseFile(statusRoot, planSlug));
}

/**
 * Clear lease: write status cleared then unlink the file (exclusive window released).
 * No-op if file absent. Prefer call only after sync-wait + claim collect + merge settle.
 * @param {string} statusRoot
 * @param {string} planSlug
 * @returns {boolean} true if a file was removed
 */
export function clearLeaseFile(statusRoot, planSlug) {
  const path = leasePath(statusRoot, planSlug);
  if (!existsSync(path)) return false;
  try {
    const existing = parseLeaseJson(readFileSync(path, 'utf8'));
    if (existing) {
      writeFileSync(path, serializeLease(buildClearedLease(existing)), 'utf8');
    }
  } catch {
    // still attempt unlink
  }
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}
