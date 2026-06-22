/**
 * review-ledger.js — pure surface-review ledger helpers.
 *
 * This module never reads or writes files. It only parses and extends injected
 * ledger content, failing closed to "no surface reviewed" on any doubt.
 */

function ownValue(value, key) {
  if (value == null || typeof value !== 'object') return undefined;
  if (!Object.hasOwn(value, key)) return undefined;
  return value[key];
}

function isPlainRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

// A record only counts as POSITIVE review proof when it carries the full dedup
// shape: a mode + BOTH fingerprint fields. A partial/corrupt line (e.g. a pointer
// with `lastReviewedCommit` but no `mode`, or a record missing `patchId`) is never
// trusted as proof — fail-safe → re-review.
function isValidRecord(value) {
  return (
    isPlainRecord(value)
    && nonEmptyString(ownValue(value, 'mode'))
    && nonEmptyString(ownValue(value, 'commitSha'))
    && nonEmptyString(ownValue(value, 'patchId'))
  );
}

function parseSingleObject(content) {
  try {
    const parsed = JSON.parse(content);
    return isPlainRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isLegacyPointer(content) {
  if (typeof content !== 'string') return false;
  const trimmed = content.trim();
  if (trimmed === '') return false;
  const parsed = parseSingleObject(trimmed);
  // A legacy pointer is a single whole-object with `lastReviewedCommit` that is NOT
  // itself a complete NDJSON record — so a valid one-line record that happens to carry
  // a `lastReviewedCommit` field is read as a record, not misclassified as a pointer.
  return parsed != null && Object.hasOwn(parsed, 'lastReviewedCommit') && !isValidRecord(parsed);
}

function parseLedger(content) {
  if (typeof content !== 'string') return { records: [], valid: false, legacy: false };
  if (content.trim() === '') return { records: [], valid: false, legacy: false };
  if (isLegacyPointer(content)) return { records: [], valid: false, legacy: true };

  const records = [];
  for (const line of content.split(/\r?\n/)) {
    if (line.trim() === '') continue;

    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      return { records: [], valid: false, legacy: false };
    }

    if (!isPlainRecord(parsed)) return { records: [], valid: false, legacy: false };
    records.push(parsed);
  }

  if (records.length === 0) return { records: [], valid: false, legacy: false };
  return { records, valid: true, legacy: false };
}

function safeRecordLine(record) {
  try {
    // input is always a plain object → JSON.stringify yields a string (or throws on a
    // circular ref, caught below); no unreachable non-string branch.
    return `${JSON.stringify(isPlainRecord(record) ? record : {})}\n`;
  } catch {
    return '{}\n';
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value !== '';
}

/**
 * readLedger — parse the ledger file CONTENT into review records. Pure; never throws.
 * Fail-safe: a legacy pointer object (has own `lastReviewedCommit`), an
 * absent/empty/whitespace string, null/undefined, or ANY malformed content → [] ("no
 * surface reviewed"). Valid NDJSON → one record object per non-empty line.
 * @param {string|null|undefined} content
 * @returns {Array<object>} the review records (possibly empty); a NEW array.
 */
export function readLedger(content) {
  return [...parseLedger(content).records];
}

/**
 * recordReview — return the NEW ledger CONTENT (an NDJSON string) with `record`
 * appended. Append-only and union-preserving.
 * @param {string|null|undefined} content
 * @param {object} record
 * @returns {string} the new NDJSON content (ends with a single '\n').
 */
export function recordReview(content, record) {
  const parsed = parseLedger(content);
  const nextLine = safeRecordLine(record);
  if (!parsed.valid || parsed.legacy || typeof content !== 'string') return nextLine;

  // Byte-preserve the existing valid NDJSON (do NOT trim its bytes — that would alter a
  // last line carrying trailing whitespace) so two concurrent appends keep prior lines
  // identical → git union-merge stays lossless. Add a separating newline only when the
  // content does not already end with one.
  const separator = content.endsWith('\n') ? '' : '\n';
  return `${content}${separator}${nextLine}`;
}

/**
 * alreadyReviewed — true ONLY with POSITIVE proof that `range` was reviewed in `mode`.
 * @param {string|null|undefined} content
 * @param {{commitSha?:string, patchId?:string}} range
 * @param {string} mode
 * @returns {boolean}
 */
export function alreadyReviewed(content, range, mode) {
  try {
    if (!nonEmptyString(mode)) return false;

    const commitSha = nonEmptyString(ownValue(range, 'commitSha')) ? ownValue(range, 'commitSha') : undefined;
    const patchId = nonEmptyString(ownValue(range, 'patchId')) ? ownValue(range, 'patchId') : undefined;
    if (commitSha === undefined && patchId === undefined) return false;

    for (const record of readLedger(content)) {
      // Only a COMPLETE record (mode + both fingerprint fields) is positive proof; a
      // partial/corrupt line never skips a review (fail-safe).
      if (!isValidRecord(record)) continue;
      if (ownValue(record, 'mode') !== mode) continue;
      if (commitSha !== undefined && ownValue(record, 'commitSha') === commitSha) return true;
      if (patchId !== undefined && ownValue(record, 'patchId') === patchId) return true;
    }
    return false;
  } catch {
    // never-throws contract: any unexpected throw (e.g. a throwing getter on `range`) is
    // fail-safe → re-review.
    return false;
  }
}
