import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(HERE, '..', 'meta', 'schemas', 'completion-event.schema.json');

let validator;

function completionEventValidator() {
  if (!validator) {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    validator = new Ajv({ strict: false, allErrors: false }).compile(schema);
  }
  return validator;
}

export function validateCompletionEvent(record) {
  const validate = completionEventValidator();
  const ok = validate(record);
  return {
    ok,
    errors: ok ? [] : (validate.errors ?? []).map((error) => ({
      instancePath: error.instancePath || '(root)',
      message: error.message,
      keyword: error.keyword,
      params: error.params,
    })),
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
