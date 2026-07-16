#!/usr/bin/env node
/**
 * dispatch-log.js — append-only NDJSON writer/reader/validator for the Mode-2
 * dispatch telemetry sidecar at `<root>/.atomic-skills/status/dispatch-log.json`.
 *
 * Format contract (R-EXEC-42 / mode2-codex-lane §9):
 *   - ONE compact JSON object per line (NDJSON), never a pretty-printed array
 *   - Append-only: concurrent writers / merge=union stay lossless only while
 *     each append is a single self-contained line
 *   - Fail-closed on read/validate: a malformed line throws with its 1-based
 *     line number — never silently skip corruption
 *
 * F4/T-007: unifies the writer path and the actuals consumer
 * (`append-completion.js` `readDispatchActuals`) on this single parser.
 *
 * CLI:
 *   node scripts/dispatch-log.js [<root>] append --json '<object>'
 *   node scripts/dispatch-log.js [<root>] read
 *   node scripts/dispatch-log.js [<root>] validate
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DISPATCH_LOG_SEGMENTS = Object.freeze(['.atomic-skills', 'status', 'dispatch-log.json']);

/**
 * Absolute path of the dispatch-log sidecar under `root`.
 * @param {string} root
 * @returns {string}
 */
export function dispatchLogPath(root) {
  return join(resolve(root), ...DISPATCH_LOG_SEGMENTS);
}

/**
 * True when `value` is a plain object (not null, not Array).
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate one dispatch record before append. Requires a plain object; does not
 * enforce the full Mode-2 field set (agents may record Mode-1 fallbacks too).
 * @param {unknown} record
 * @returns {object}
 */
export function validateDispatchRecord(record) {
  if (!isPlainObject(record)) {
    throw new TypeError('dispatch-log: record must be a plain JSON object');
  }
  return record;
}

/**
 * Parse NDJSON text into an array of objects. Blank lines are skipped.
 * Fail-closed: any non-empty line that is not a single JSON object throws
 * with the 1-based line number.
 *
 * @param {string} text
 * @returns {object[]}
 */
export function parseDispatchNdjson(text) {
  if (typeof text !== 'string') {
    throw new TypeError('dispatch-log: expected string content');
  }
  if (!text.trim()) return [];
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new SyntaxError(`dispatch-log: invalid JSON at line ${i + 1}: ${reason}`);
    }
    if (!isPlainObject(parsed)) {
      throw new TypeError(
        `dispatch-log: line ${i + 1} must be a JSON object (got ${Array.isArray(parsed) ? 'array' : typeof parsed})`,
      );
    }
    out.push(parsed);
  }
  return out;
}

/**
 * Read the dispatch-log sidecar as an array of records.
 * Absent or empty file → `[]`. Malformed content throws with line number.
 *
 * @param {string} root
 * @returns {object[]}
 */
export function readDispatchLog(root) {
  const path = dispatchLogPath(root);
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  return parseDispatchNdjson(raw);
}

/**
 * Validate the on-disk dispatch-log (or an empty/absent file). Returns the
 * parsed records; throws on the first corrupt line with its line number.
 *
 * @param {string} root
 * @returns {object[]}
 */
export function validateDispatchLog(root) {
  return readDispatchLog(root);
}

/**
 * Append one compact JSON object + trailing newline. Never rewrites prior lines.
 * Creates the status/ directory idempotently.
 *
 * @param {string} root
 * @param {object} record
 * @returns {object} the validated record that was written
 */
export function appendDispatchLog(root, record) {
  const valid = validateDispatchRecord(record);
  const path = dispatchLogPath(root);
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // Compact single-line JSON only — multi-line pretty-print breaks merge=union.
  appendFileSync(path, `${JSON.stringify(valid)}\n`);
  return valid;
}

// CLI (guard argv[1]: node -e leaves it undefined and pathToFileURL throws)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const positionals = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
  // First non-flag token may be root; last non-flag token is the subcommand when two are present.
  let root = process.cwd();
  let cmd = 'validate';
  if (positionals.length === 1) {
    if (['append', 'read', 'validate'].includes(positionals[0])) cmd = positionals[0];
    else root = positionals[0];
  } else if (positionals.length >= 2) {
    root = positionals[0];
    cmd = positionals[1];
  }

  try {
    if (cmd === 'append') {
      const rawJson = flag('json');
      if (rawJson == null || rawJson === '') {
        throw new TypeError('dispatch-log append: --json <object> is required');
      }
      let record;
      try {
        record = JSON.parse(rawJson);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new SyntaxError(`dispatch-log append: --json is not valid JSON: ${reason}`);
      }
      const written = appendDispatchLog(root, record);
      console.log(`dispatch-log: appended taskId=${written.taskId ?? '?'} plan=${written.plan ?? '?'} phase=${written.phase ?? '?'}`);
    } else if (cmd === 'read') {
      const records = readDispatchLog(root);
      process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
    } else if (cmd === 'validate') {
      const records = validateDispatchLog(root);
      console.log(`dispatch-log: valid (${records.length} record${records.length === 1 ? '' : 's'})`);
    } else {
      throw new RangeError(`dispatch-log: unknown command ${JSON.stringify(cmd)} (use append|read|validate)`);
    }
  } catch (err) {
    console.error(`dispatch-log: ${err.message}`);
    process.exit(1);
  }
}
