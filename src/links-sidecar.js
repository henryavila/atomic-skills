import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import { parseFrontmatter } from '../scripts/validate-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', 'meta', 'schemas', 'links.schema.json');
const commonSchemaPath = join(__dirname, '..', 'meta', 'schemas', 'common.schema.json');
const planSchemaPath = join(__dirname, '..', 'meta', 'schemas', 'plan.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const commonSchema = JSON.parse(readFileSync(commonSchemaPath, 'utf8'));
const planSchema = JSON.parse(readFileSync(planSchemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(commonSchema);
ajv.addSchema(planSchema);
const validate = ajv.compile(schema);
const validatePlanDependency = ajv.getSchema('https://atomic-skills.henryavila.com/schemas/plan.schema.json#/$defs/planDependency');

/**
 * Reader/writer for the fork parent/child link.
 *
 * As of F5/T-003 (fork-fields-inline) the durable link lives **INLINE** in the
 * plan's own `plan.md` frontmatter — `spawnedFrom` on the child plan (top-level),
 * `spawnedPlans` on the parent's anchor phase descriptor (`phases[].spawnedPlans`,
 * a string[] of child slugs, mirroring aideck's `PhaseDescriptor.spawnedPlans`).
 * The aiDeck consumer (>= the fork-fields release) declares both as optional,
 * additive fields, so inline no longer drops the card. The legacy `links.json`
 * sidecar is retired for the elo (`migrateSidecarToInline` moves any leftover).
 *
 * The `links.json` sidecar primitives (`readLinks`/`writeLinks`/`validateLinks`)
 * REMAIN for the transient parallel-state `pendingWriteback` recovery marker
 * (src/parallel-state.js) — that is internal recovery state, not the durable
 * aiDeck-facing elo, and is out of the inline migration's scope.
 */

export const LINKS_FILE = 'links.json';
const PLAN_FILE = 'plan.md';

/** @param {string} planDir @returns {string} path to the plan's plan.md */
function planMdPath(planDir) {
  return join(planDir, PLAN_FILE);
}

/**
 * Read a plan's plan.md frontmatter inline.
 * @param {string} planDir
 * @returns {{fm: object, body: string} | null} null when plan.md is absent or
 *   its frontmatter does not parse (the elo is optional metadata — an unreadable
 *   plan.md surfaces as "no elo" rather than throwing through the resolvers).
 */
function readPlanFm(planDir) {
  const fp = planMdPath(planDir);
  if (!existsSync(fp)) return null;
  const parsed = parseFrontmatter(readFileSync(fp, 'utf8'));
  if (parsed.error) return null;
  return { fm: parsed.frontmatter, body: parsed.body ?? '' };
}

/**
 * Write a plan's plan.md frontmatter back, preserving the body. Mirrors the
 * serializer in scripts/reconcile-focus.js + scripts/compute-rollups.js so the
 * passes never fight over formatting.
 * @param {string} planDir @param {object} fm @param {string} body
 */
function writePlanFm(planDir, fm, body) {
  const yamlBlock = stringifyYaml(fm).replace(/\n$/, '');
  const cleanBody = body && body.length ? body.replace(/^\n/, '') : '';
  const rebuilt = `---\n${yamlBlock}\n---\n${cleanBody ? `\n${cleanBody}` : ''}`;
  writeFileSync(planMdPath(planDir), rebuilt.endsWith('\n') ? rebuilt : `${rebuilt}\n`, 'utf8');
}

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

function assertValidPlanDependency(data) {
  const valid = validatePlanDependency(data);
  if (!valid) {
    const detail = (validatePlanDependency.errors ?? [])
      .map((e) => `- ${e.instancePath || '/'} ${e.message ?? 'failed validation'}`)
      .join('\n');
    throw new Error(`plan dependency is invalid:\n${detail}`);
  }
  return data;
}

function planDependencyKey(dep) {
  return JSON.stringify([
    dep.plan,
    dep.origin?.phaseId ?? '',
    dep.origin?.taskId ?? '',
    dep.createdBy,
  ]);
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
 * Record the child→parent edge (`spawnedFrom`) INLINE in the child's plan.md
 * frontmatter. `taskId` is optional and omitted when undefined.
 * @param {string} childPlanDir
 * @param {{plan: string, phaseId: string, taskId?: string, mode: string}} link
 * @returns {object} the updated frontmatter
 * @throws {Error} when the child has no readable plan.md (a fork child is a real
 *   plan; its plan.md must exist before the edge is written — F1 L-002: write the
 *   edge only after the dependent entity is materialized).
 */
export function setSpawnedFrom(childPlanDir, link) {
  const { plan, phaseId, taskId, mode } = link;
  const edge = { plan, phaseId, mode };
  // omit an absent OR empty taskId (a present '' would violate minLength:1).
  if (taskId !== undefined && taskId !== '') edge.taskId = taskId;
  // Validate the edge at the write boundary through the SAME Ajv schema the old
  // sidecar path used — the inline write must not let a wrong-typed/malformed edge
  // (`plan: {}`, `phaseId: 7`, bad mode) reach plan.md to fail only at validate-state.
  assertValidLinks({ spawnedFrom: edge });
  const p = readPlanFm(childPlanDir);
  if (!p) throw new Error(`cannot set spawnedFrom: no readable plan.md at ${planMdPath(childPlanDir)}`);
  p.fm.spawnedFrom = edge;
  writePlanFm(childPlanDir, p.fm, p.body);
  return p.fm;
}

/** Read a legacy sidecar tolerantly (a corrupt one reads as no-elo, never throws). */
function legacySidecar(planDir) {
  try {
    return readLinks(planDir);
  } catch {
    return {};
  }
}

/**
 * @param {string} planDir
 * @returns {object|null} the inline `spawnedFrom` edge; falls back to a legacy
 *   `links.json` sidecar when the inline field is absent (upgrade compat for a
 *   repo not yet migrated by `migrateSidecarToInline`); null when neither has it.
 */
export function getSpawnedFrom(planDir) {
  return readPlanFm(planDir)?.fm?.spawnedFrom ?? legacySidecar(planDir).spawnedFrom ?? null;
}

/**
 * Record the parent→child edge INLINE on the parent's anchor phase descriptor
 * (`phases[phaseId].spawnedPlans`). Idempotent: a child slug already present is
 * not duplicated.
 * @param {string} parentPlanDir
 * @param {string} phaseId - the anchor phase the child was forked from
 * @param {string} childSlug
 * @returns {object} the updated frontmatter
 * @throws {Error} when the parent has no readable plan.md, or the anchor phase
 *   is not in `phases[]` (act on the NAMED anchor, never guess — F1 L-003).
 */
export function addSpawnedPlan(parentPlanDir, phaseId, childSlug) {
  const p = readPlanFm(parentPlanDir);
  if (!p) throw new Error(`cannot add spawnedPlan: no readable plan.md at ${planMdPath(parentPlanDir)}`);
  const phases = Array.isArray(p.fm.phases) ? p.fm.phases : [];
  const phase = phases.find((ph) => ph && ph.id === phaseId);
  if (!phase) throw new Error(`cannot add spawnedPlan: anchor phase '${phaseId}' not found in ${planMdPath(parentPlanDir)}`);
  const slugs = Array.isArray(phase.spawnedPlans) ? phase.spawnedPlans : [];
  if (!slugs.includes(childSlug)) slugs.push(childSlug);
  // Validate the resulting slug array through the same Ajv boundary (rejects an
  // empty-string / non-string childSlug before it reaches plan.md).
  assertValidLinks({ spawnedPlans: { [phaseId]: slugs } });
  phase.spawnedPlans = slugs;
  writePlanFm(parentPlanDir, p.fm, p.body);
  return p.fm;
}

/**
 * @param {string} planDir
 * @returns {object} the parent→child map (phaseId → child slugs) aggregated from
 *   the inline `phases[].spawnedPlans`, or {} when none / no readable plan.md
 */
export function getSpawnedPlans(planDir) {
  const p = readPlanFm(planDir);
  const out = {};
  if (p && Array.isArray(p.fm.phases)) {
    for (const ph of p.fm.phases) {
      if (ph && ph.id && Array.isArray(ph.spawnedPlans) && ph.spawnedPlans.length) {
        out[ph.id] = [...ph.spawnedPlans];
      }
    }
  }
  if (Object.keys(out).length > 0) return out;
  // upgrade compat: fall back to a legacy sidecar spawnedPlans map when no inline
  // edge is present (a repo not yet migrated by migrateSidecarToInline).
  const legacy = legacySidecar(planDir).spawnedPlans;
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    for (const [pid, slugs] of Object.entries(legacy)) {
      if (Array.isArray(slugs) && slugs.length) out[pid] = [...slugs];
    }
  }
  return out;
}

/**
 * Record a dependent→prerequisite plan dependency INLINE on the dependent
 * plan's `plan.md` frontmatter (`dependsOnPlans[]`). Idempotent by operational
 * edge identity: `plan + origin.phaseId + origin.taskId + createdBy`.
 * @param {string} planDir
 * @param {{plan: string, createdBy: string, origin?: {phaseId?: string, taskId?: string, mode?: string}, release?: {archived?: string}}} dependency
 * @returns {object} the updated frontmatter
 * @throws {Error} when the dependency shape is schema-invalid, or the dependent
 *   plan has no readable plan.md.
 */
export function addPlanDependency(planDir, dependency) {
  assertValidPlanDependency(dependency);
  const p = readPlanFm(planDir);
  if (!p) throw new Error(`cannot add plan dependency: no readable plan.md at ${planMdPath(planDir)}`);
  const deps = Array.isArray(p.fm.dependsOnPlans) ? p.fm.dependsOnPlans : [];
  const key = planDependencyKey(dependency);
  if (!deps.some((dep) => dep && typeof dep === 'object' && planDependencyKey(dep) === key)) {
    deps.push(dependency);
  }
  p.fm.dependsOnPlans = deps;
  writePlanFm(planDir, p.fm, p.body);
  return p.fm;
}

/**
 * Migrate a legacy links.json elo (`spawnedFrom`/`spawnedPlans`) INTO the plan.md
 * frontmatter, then strip those keys from the sidecar — deleting the sidecar file
 * entirely when nothing else remains (a lone `pendingWriteback` is preserved). A
 * no-op when there is no sidecar or it carries no elo.
 * @param {string} planDir
 * @returns {{migrated: boolean, spawnedFrom: boolean, spawnedPlans: boolean, sidecarRemoved: boolean}}
 * @throws {Error} when the elo is present but plan.md is unreadable, or a
 *   `spawnedPlans` phaseId has no matching phase descriptor (fail loud — never
 *   silently drop a parent edge).
 */
export function migrateSidecarToInline(planDir) {
  const sidecar = linksPath(planDir);
  if (!existsSync(sidecar)) return { migrated: false, spawnedFrom: false, spawnedPlans: false, sidecarRemoved: false };
  const data = readLinks(planDir);
  // Validate the legacy sidecar BEFORE copying anything inline — a schema-invalid
  // shape (e.g. `spawnedPlans: { F0: "child" }`, a string) would otherwise be
  // spread into bogus per-char slugs `["c","h",…]`. Reject without mutating.
  assertValidLinks(data);
  const hasFrom = data.spawnedFrom != null;
  const hasPlans = data.spawnedPlans != null && Object.keys(data.spawnedPlans).length > 0;
  if (!hasFrom && !hasPlans) return { migrated: false, spawnedFrom: false, spawnedPlans: false, sidecarRemoved: false };

  const p = readPlanFm(planDir);
  if (!p) throw new Error(`cannot migrate elo to inline: no readable plan.md at ${planMdPath(planDir)}`);

  if (hasFrom) {
    p.fm.spawnedFrom = data.spawnedFrom;
    delete data.spawnedFrom;
  }
  if (hasPlans) {
    const phases = Array.isArray(p.fm.phases) ? p.fm.phases : [];
    for (const [phaseId, slugs] of Object.entries(data.spawnedPlans)) {
      const phase = phases.find((ph) => ph && ph.id === phaseId);
      if (!phase) throw new Error(`cannot migrate spawnedPlans: anchor phase '${phaseId}' not found in ${planMdPath(planDir)}`);
      phase.spawnedPlans = [...new Set([...(Array.isArray(phase.spawnedPlans) ? phase.spawnedPlans : []), ...slugs])];
    }
    delete data.spawnedPlans;
  }
  writePlanFm(planDir, p.fm, p.body);

  const sidecarRemoved = Object.keys(data).length === 0;
  if (sidecarRemoved) unlinkSync(sidecar);
  else writeLinks(planDir, data); // re-validates; preserves pendingWriteback
  return { migrated: true, spawnedFrom: hasFrom, spawnedPlans: hasPlans, sidecarRemoved };
}
