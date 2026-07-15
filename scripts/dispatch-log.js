/**
 * Canonical reader/writer for the Mode-2 dispatch telemetry ledger.
 *
 * New records are always one compact JSON object per line. The reader keeps the
 * legacy array/hybrid migration surface so old repositories can be consumed and
 * rewritten without losing records, but no writer can emit that legacy shape.
 */
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { confinedRepositoryFile } from '../src/confined-path.js';
import { durableAppendFile } from '../src/durable-file.js';
import {
  scopeTransactionLockPath,
  withScopeTransactionLockSync,
} from './transaction-lock.js';

export const DISPATCH_LOG_RELATIVE_PATH = Object.freeze([
  '.atomic-skills',
  'status',
  'dispatch-log.json',
]);
const DISPATCH_DIRECTORY = DISPATCH_LOG_RELATIVE_PATH.slice(0, -1);
const DISPATCH_LOG_FILE = DISPATCH_LOG_RELATIVE_PATH.at(-1);
const DISPATCH_LOCK_SCOPE = Object.freeze(['global']);

export function dispatchLogPath(root = process.cwd()) {
  return confinedRepositoryFile(root, DISPATCH_DIRECTORY, DISPATCH_LOG_FILE);
}

function withDispatchLedgerLock(root, operation, { faultAt } = {}) {
  const lockPath = scopeTransactionLockPath(root, 'dispatch-ledger', DISPATCH_LOCK_SCOPE);
  return withScopeTransactionLockSync(root, 'dispatch-ledger', DISPATCH_LOCK_SCOPE, () => {
    faultAt?.({ point: 'after-lock-acquired', lockPath });
    return operation();
  });
}

export function validateDispatchRecord(record, {
  source = 'dispatch-log.json',
  line = 1,
} = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError(`${source}:${line}: dispatch record must be a JSON object`);
  }
  if (![record.taskId, record.plan, record.phase]
    .every((field) => typeof field === 'string' && field.trim() !== '')) {
    throw new TypeError(
      `${source}:${line}: dispatch record requires non-empty taskId, plan, and phase`,
    );
  }
  return record;
}

function parseJsonAt(text, source, firstLine) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const relativeLine = Number(error.message.match(/\bline\s+(\d+)\b/i)?.[1] || 1);
    const line = firstLine + relativeLine - 1;
    throw new SyntaxError(`${source}:${line}: invalid JSON: ${error.message}`);
  }
}

function appendParsedRecords(records, value, source, line) {
  const values = Array.isArray(value) ? value : [value];
  for (const record of values) {
    records.push(validateDispatchRecord(record, { source, line }));
  }
}

/**
 * Parse dispatch telemetry with physical-line diagnostics. Canonical input is
 * NDJSON; a root JSON array is accepted only as a read-time migration format.
 */
export function parseDispatchLog(raw, { source = 'dispatch-log.json' } = {}) {
  if (typeof raw !== 'string') throw new TypeError('parseDispatchLog: raw must be a string');
  const lines = raw.split(/\r?\n/);
  const records = [];

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].trim();
    if (!text) continue;
    const line = index + 1;

    if (text === '[') {
      let end = -1;
      let arrayDepth = 0;
      let inString = false;
      let escaped = false;
      for (let cursor = index; cursor < lines.length && end < 0; cursor += 1) {
        for (const char of lines[cursor]) {
          if (inString) {
            if (escaped) {
              escaped = false;
            } else if (char === '\\') {
              escaped = true;
            } else if (char === '"') {
              inString = false;
            }
            continue;
          }
          if (char === '"') {
            inString = true;
          } else if (char === '[') {
            arrayDepth += 1;
          } else if (char === ']') {
            arrayDepth -= 1;
            if (arrayDepth === 0) {
              end = cursor;
              break;
            }
          }
        }
      }
      if (end < 0) {
        throw new SyntaxError(`${source}:${line}: invalid JSON: unterminated legacy array`);
      }
      const value = parseJsonAt(lines.slice(index, end + 1).join('\n'), source, line);
      if (!Array.isArray(value)) {
        throw new TypeError(`${source}:${line}: legacy dispatch log must be a JSON array`);
      }
      appendParsedRecords(records, value, source, line);
      index = end;
      continue;
    }

    appendParsedRecords(records, parseJsonAt(text, source, line), source, line);
  }

  return records;
}

export function readDispatchLog(root = process.cwd()) {
  return withDispatchLedgerLock(root, () => {
    const path = dispatchLogPath(root);
    if (!existsSync(path)) return [];
    return parseDispatchLog(readFileSync(path, 'utf8'), { source: path });
  });
}

/** Append one validated record in the only canonical persisted shape. */
export function appendDispatchRecord(root, record, options = {}) {
  validateDispatchRecord(record, { source: 'dispatch-log.json', line: 1 });
  let line;
  try {
    line = `${JSON.stringify(record)}\n`;
  } catch (error) {
    throw new TypeError(`dispatch-log.json:1: dispatch record is not JSON serializable: ${error.message}`);
  }
  return withDispatchLedgerLock(root, () => {
    const path = confinedRepositoryFile(
      root,
      DISPATCH_DIRECTORY,
      DISPATCH_LOG_FILE,
      { createParents: true },
    );
    const raw = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (raw !== '') parseDispatchLog(raw, { source: path });
    const separator = raw !== '' && !raw.endsWith('\n') ? '\n' : '';
    durableAppendFile(path, `${separator}${line}`, {
      faultAt: options.appendFaultAt,
      beforeFileSync: options.beforeFileSync,
    });
    return record;
  }, { faultAt: options.faultAt });
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`option ${name} requires a value`);
  return value;
}

export function runDispatchLog(args, io = console) {
  const root = option(args, '--root') ?? process.cwd();
  const appendFile = option(args, '--append-file');
  const check = args.includes('--check');
  if ((appendFile ? 1 : 0) + (check ? 1 : 0) !== 1) {
    throw new Error('choose exactly one of --append-file <path> or --check');
  }
  if (appendFile) {
    let record;
    try {
      record = JSON.parse(readFileSync(resolve(root, appendFile), 'utf8'));
    } catch (error) {
      throw new Error(`cannot read append record: ${error.message}`);
    }
    appendDispatchRecord(root, record);
    io.log(JSON.stringify({ appended: true, taskId: record.taskId }));
    return record;
  }
  const records = readDispatchLog(root);
  io.log(JSON.stringify({ ok: true, records: records.length }));
  return records;
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    runDispatchLog(process.argv.slice(2));
  } catch (error) {
    console.error(`dispatch-log: ${error.message}`);
    process.exitCode = 1;
  }
}
