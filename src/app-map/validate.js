import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
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

/**
 * Post-schema integrity check for the 0.3 conflict descriptor (P1/D4): once an
 * operator resolves a conflict, `resolution.choice` must name one of the
 * conflict's witnesses by value+source — not a positional index, and never a
 * value the witness set never carried. JSON Schema cannot express "a property
 * must equal one of a sibling array's items", so it is enforced here. Fires only
 * on the 0.3 shape (a conflict with `witnesses` + an object `resolution` that
 * carries `choice`); 0.1/0.2 conflicts (no witnesses) and still-pending string
 * resolutions are untouched. Returns Ajv-shaped errors so both consumers format
 * them identically to duplicatePageIdErrors.
 */
function resolutionChoiceErrors(catalog) {
  const pages = catalog?.pages;
  if (!Array.isArray(pages)) return [];
  const errors = [];
  pages.forEach((page, pageIndex) => {
    const conflicts = page?.conflicts;
    if (!Array.isArray(conflicts)) return;
    conflicts.forEach((conflict, conflictIndex) => {
      const witnesses = conflict?.witnesses;
      const resolution = conflict?.resolution;
      // Only the 0.3 arbitration shape: witnesses present + an object resolution
      // carrying a choice. Pending (string) resolutions and legacy conflicts skip.
      if (!Array.isArray(witnesses)) return;
      if (resolution == null || typeof resolution !== 'object') return;
      if (!('choice' in resolution)) return;
      const { choice } = resolution;
      const matches = witnesses.some(
        (witness) => isDeepStrictEqual(witness?.value, choice?.value) && isDeepStrictEqual(witness?.source, choice?.source),
      );
      if (matches) return;
      errors.push({
        instancePath: `/pages/${pageIndex}/conflicts/${conflictIndex}/resolution/choice`,
        schemaPath: '#/resolutionChoiceWitness',
        keyword: 'resolutionChoiceWitness',
        params: { field: conflict?.field, choice },
        message: `resolution.choice for field '${conflict?.field}' matches no witness by value+source`,
      });
    });
  });
  return errors;
}

export function validateAppMap(catalog) {
  const schemaValid = validate(catalog);
  const errors = schemaValid ? [] : [...(validate.errors ?? [])];
  errors.push(...duplicatePageIdErrors(catalog));
  errors.push(...resolutionChoiceErrors(catalog));
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
