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

/**
 * Post-schema check: canonical page ids must be unique. JSON Schema draft
 * 2020-12 cannot express sub-field uniqueness across array items, so this is
 * enforced here in the single shared validator. Returns Ajv-shaped error
 * objects so both consumers (assertValidAppMap, validateAppMapFile) format them.
 */
function duplicatePageIdErrors(catalog) {
  const pages = catalog?.pages;
  if (!Array.isArray(pages)) return [];
  const firstSeenAt = new Map();
  const errors = [];
  pages.forEach((page, i) => {
    const id = page?.id;
    if (typeof id !== 'string') return;
    if (firstSeenAt.has(id)) {
      errors.push({
        instancePath: `/pages/${i}/id`,
        schemaPath: '#/duplicatePageId',
        keyword: 'duplicatePageId',
        params: { duplicateId: id, firstIndex: firstSeenAt.get(id) },
        message: `duplicate page id '${id}' (first declared at /pages/${firstSeenAt.get(id)}/id)`,
      });
    } else {
      firstSeenAt.set(id, i);
    }
  });
  return errors;
}

export function validateAppMap(catalog) {
  const schemaValid = validate(catalog);
  const errors = schemaValid ? [] : [...(validate.errors ?? [])];
  errors.push(...duplicatePageIdErrors(catalog));
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertValidAppMap(catalog) {
  const result = validateAppMap(catalog);
  if (!result.valid) {
    throw new Error(`app-map catalog is invalid:\n${formatValidationErrors(result.errors)}`);
  }
  return catalog;
}
