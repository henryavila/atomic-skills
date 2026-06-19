import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', 'meta', 'schemas', 'links.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

/**
 * Sidecar reader/writer for the fork parent/child link.
 *
 * The link lives in a non-aiDeck-facing `links.json` inside the plan's own
 * directory, NOT in `plan.md` / phase frontmatter. This keeps the aiDeck-facing
 * state (validated by the published .strict() consumer at aiDeck 0.1.0) clean:
 * `spawnedFrom` would drop the card, `spawnedPlans` would be silently stripped.
 * The inline migration is deferred to F5 (gated on aiDeck >= 0.1.2).
 *
 * Shape of links.json:
 *   {
 *     "spawnedFrom":  { "plan": "<parent-slug>", "phaseId": "F2",
 *                       "taskId": "T-003"?, "mode": "pause" | "parallel" },
 *     "spawnedPlans": { "<phaseId>": ["<child-slug>", ...] }
 *   }
 * A plan may carry `spawnedFrom` (it is a child), `spawnedPlans` (it is a
 * parent), or both (it is a link in a chain).
 */

export const LINKS_FILE = 'links.json';

/**
 * @param {string} planDir - the plan's directory (…/projects/<id>/<slug>)
 * @returns {string} absolute/relative path to that plan's links.json
 */
export function linksPath(planDir) {
  return join(planDir, LINKS_FILE);
}

/**
 * Read the link sidecar for a plan.
 * @param {string} planDir
 * @returns {object} the parsed links.json object, or {} when the file is absent
 * @throws {Error} when the file is present but not valid JSON, or parses to a
 *   non-object (null / array / primitive). A corrupt or truncated sidecar
 *   surfaces with its path instead of an opaque SyntaxError, and a wrong-shaped
 *   file is rejected rather than handed to the setters, which would mutate a
 *   primitive (`5.spawnedFrom = …`) under ESM strict mode.
 */
export function readLinks(planDir) {
  const filePath = linksPath(planDir);
  if (!existsSync(filePath)) return {};
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`links sidecar at ${filePath} is not valid JSON: ${err.message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const got = Array.isArray(parsed) ? 'array' : parsed === null ? 'null' : typeof parsed;
    throw new Error(`links sidecar at ${filePath} must be a JSON object, got ${got}`);
  }
  return parsed;
}

/**
 * Validate a links object against meta/schemas/links.schema.json.
 * @param {object} data
 * @returns {{valid: boolean, errors: object[]}} Ajv-shaped errors ([] when valid)
 */
export function validateLinks(data) {
  const valid = validate(data);
  return { valid, errors: valid ? [] : [...(validate.errors ?? [])] };
}

/**
 * Throw when `data` is not a valid links object; return it otherwise.
 * @param {object} data
 * @returns {object} the same data
 */
export function assertValidLinks(data) {
  const { valid, errors } = validateLinks(data);
  if (!valid) {
    const detail = errors.map((e) => `- ${e.instancePath || '/'} ${e.message ?? 'failed validation'}`).join('\n');
    throw new Error(`links sidecar is invalid:\n${detail}`);
  }
  return data;
}

/**
 * Write the link sidecar for a plan (creates the dir if missing). The data is
 * schema-validated at this write boundary — an invalid link (e.g. a mode
 * outside the enum) throws and nothing is persisted.
 * @param {string} planDir
 * @param {object} data
 */
export function writeLinks(planDir, data) {
  assertValidLinks(data);
  if (!existsSync(planDir)) mkdirSync(planDir, { recursive: true });
  writeFileSync(linksPath(planDir), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Record the child→parent edge (`spawnedFrom`) in the child's sidecar.
 * `taskId` is optional and omitted from the stored object when undefined.
 * @param {string} childPlanDir
 * @param {{plan: string, phaseId: string, taskId?: string, mode: string}} link
 * @returns {object} the updated links object
 */
export function setSpawnedFrom(childPlanDir, link) {
  const { plan, phaseId, taskId, mode } = link;
  const edge = { plan, phaseId, mode };
  if (taskId !== undefined) edge.taskId = taskId;
  const data = readLinks(childPlanDir);
  data.spawnedFrom = edge;
  writeLinks(childPlanDir, data);
  return data;
}

/**
 * @param {string} planDir
 * @returns {object|null} the `spawnedFrom` edge, or null when absent
 */
export function getSpawnedFrom(planDir) {
  return readLinks(planDir).spawnedFrom ?? null;
}

/**
 * Record the parent→child edge (`spawnedPlans[phaseId]`) in the parent's
 * sidecar. Idempotent: a child slug already present for that phase is not
 * duplicated.
 * @param {string} parentPlanDir
 * @param {string} phaseId - the anchor phase the child was forked from
 * @param {string} childSlug
 * @returns {object} the updated links object
 */
export function addSpawnedPlan(parentPlanDir, phaseId, childSlug) {
  const data = readLinks(parentPlanDir);
  if (!data.spawnedPlans) data.spawnedPlans = {};
  const slugs = data.spawnedPlans[phaseId] ?? [];
  if (!slugs.includes(childSlug)) slugs.push(childSlug);
  data.spawnedPlans[phaseId] = slugs;
  writeLinks(parentPlanDir, data);
  return data;
}

/**
 * @param {string} planDir
 * @returns {object} the `spawnedPlans` map (phaseId → child slugs), or {}
 */
export function getSpawnedPlans(planDir) {
  return readLinks(planDir).spawnedPlans ?? {};
}
