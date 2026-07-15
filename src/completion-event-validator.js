import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(HERE, '..', 'meta', 'schemas', 'completion-event.schema.json');

let validator;

const EXPLICIT_OFFSET_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/;

function leapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function validCompletionTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = EXPLICIT_OFFSET_TIMESTAMP.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[7] === 'Z' ? 0 : Number(match[9]);
  const offsetMinute = match[7] === 'Z' ? 0 : Number(match[10]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59
      || offsetHour > 23 || offsetMinute > 59) return false;
  const daysInMonth = [31, leapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function completionEventValidator() {
  if (!validator) {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    validator = new Ajv({ strict: false, allErrors: false }).compile(schema);
  }
  return validator;
}

export function validateCompletionEvent(record) {
  const validate = completionEventValidator();
  const schemaOk = validate(record);
  const timestampOk = schemaOk && validCompletionTimestamp(record?.ts);
  const ok = schemaOk && timestampOk;
  return {
    ok,
    errors: ok ? [] : (schemaOk
      ? [{
        instancePath: '/ts',
        message: 'must be a semantically valid ISO timestamp with an explicit offset',
        keyword: 'format',
        params: { format: 'explicit-offset-date-time' },
      }]
      : (validate.errors ?? []).map((error) => ({
        instancePath: error.instancePath || '(root)',
        message: error.message,
        keyword: error.keyword,
        params: error.params,
      }))),
  };
}

export function parseCompletionEventLogEntries(raw, { source = 'completions.jsonl' } = {}) {
  if (typeof raw !== 'string') throw new TypeError('completion log bytes must be a string');
  const records = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    if (line.trim() === '') continue;
    const lineNumber = index + 1;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new SyntaxError(
        `${source}: completion line ${lineNumber} has invalid JSON: ${error.message}`,
      );
    }
    const validation = validateCompletionEvent(record);
    if (!validation.ok) {
      const first = validation.errors[0];
      throw new TypeError(
        `${source}: completion line ${lineNumber} is schema-invalid: ${first?.instancePath ?? '(root)'} ${first?.message ?? 'unknown error'}`,
      );
    }
    records.push({ line: lineNumber, value: record });
  }
  return records;
}

export function parseCompletionEventLog(raw, options = {}) {
  return parseCompletionEventLogEntries(raw, options).map(({ value }) => value);
}

export function readCompletionEventLog(path) {
  return parseCompletionEventLog(readFileSync(path, 'utf8'), { source: path });
}
