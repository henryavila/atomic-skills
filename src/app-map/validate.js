import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', '..', 'meta', 'schemas', 'app-map.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

function formatValidationError(error) {
  const location = error.instancePath || '/';
  const detail = error.message ?? 'failed validation';
  return `${location} ${detail}`;
}

function formatValidationErrors(errors) {
  return errors.map((error) => `- ${formatValidationError(error)}`).join('\n');
}

export function validateAppMap(catalog) {
  const valid = validate(catalog);
  return {
    valid,
    errors: valid ? [] : [...(validate.errors ?? [])],
  };
}

export function assertValidAppMap(catalog) {
  const result = validateAppMap(catalog);
  if (!result.valid) {
    throw new Error(`app-map catalog is invalid:\n${formatValidationErrors(result.errors)}`);
  }
  return catalog;
}
