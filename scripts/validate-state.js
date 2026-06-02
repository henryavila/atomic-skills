#!/usr/bin/env node
/**
 * Validate `.atomic-skills/` state files (Plan + Initiative frontmatter)
 * against the JSON Schemas in meta/schemas/.
 *
 * Usage:
 *   node scripts/validate-state.js                       # validates ./.atomic-skills/
 *   node scripts/validate-state.js <dir>                 # validates <dir>/plans/*.md + <dir>/initiatives/*.md
 *   node scripts/validate-state.js <file.md> [<file>...] # validates specific file(s); kind inferred from path
 *
 * Exit codes:
 *   0 — all files valid
 *   1 — one or more validation errors
 *   2 — file/parse/setup error
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv/dist/2020.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, '..', 'meta', 'schemas');

const SCHEMA_FILES = {
  common: 'common.schema.json',
  plan: 'plan.schema.json',
  initiative: 'initiative.schema.json',
};

/**
 * Load the three schemas and register them with a fresh Ajv instance.
 * The $ref strings inside the schemas use relative URIs (e.g.
 * "common.schema.json#/$defs/slug") that Ajv resolves against each schema's $id.
 */
function buildAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of Object.values(SCHEMA_FILES)) {
    const schemaPath = join(SCHEMA_DIR, name);
    if (!existsSync(schemaPath)) {
      throw new Error(`Schema not found: ${schemaPath}`);
    }
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    ajv.addSchema(schema);
  }
  return {
    validatePlan: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/plan.schema.json'),
    validateInitiative: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/initiative.schema.json'),
  };
}

/**
 * Extract YAML frontmatter and markdown body from a `.md` file.
 * Returns { frontmatter, body, error? }.
 *
 * Expects the file to start with `---\n`, contain a second `---\n`, and
 * have a (possibly empty) body after.
 */
export function parseFrontmatter(raw) {
  if (typeof raw !== 'string') {
    return { error: 'content is not a string' };
  }
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) {
    return { error: 'file does not start with `---` fence' };
  }
  // Find the closing fence on its own line. Be tolerant of trailing whitespace.
  const lines = raw.split(/\r?\n/);
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trimEnd() === '---') {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    return { error: 'no closing `---` fence found' };
  }
  const yamlBlock = lines.slice(1, closeIdx).join('\n');
  const body = lines.slice(closeIdx + 1).join('\n');
  let frontmatter;
  try {
    frontmatter = parseYaml(yamlBlock);
  } catch (err) {
    return { error: `YAML parse error: ${err.message}` };
  }
  if (frontmatter == null || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    return { error: 'frontmatter is not a YAML object' };
  }
  return { frontmatter, body };
}

/**
 * Infer schema kind ('plan' | 'initiative') from a file path.
 * Returns null if the path is not under a recognised directory.
 *
 * Two layouts are recognised (R-XAGENT-08 / F-B3):
 *  - FLAT (legacy, live during the dogfood window):
 *      <root>/plans/<slug>.md            → 'plan'
 *      <root>/initiatives/<slug>.md      → 'initiative'
 *  - NESTED (projects/<id>/<slug>/, the migration target):
 *      <root>/projects/<id>/<slug>/plan.md           → 'plan'
 *      <root>/projects/<id>/<slug>/phases/f<N>-*.md  → 'initiative'
 *      (a phase initiative *is* an initiative — Decision #9; no 4th schema)
 *
 * The flat checks run FIRST and the loop returns at the segment closest to the
 * file, so adding the nested checks cannot change any flat-tree result.
 */
function kindFromPath(filePath) {
  const parts = resolve(filePath).split('/');
  // NESTED layout plan FIRST: `plan.md` directly under a projects/<id>/<slug>/
  // tree. Checked before the segment scan so a slug literally named `phases`,
  // `plans`, or `initiatives` (the slug regex permits them) cannot shadow a real
  // plan.md — e.g. projects/<id>/phases/plan.md is a plan, not an initiative.
  if (basename(parts[parts.length - 1]) === 'plan.md' && parts.includes('projects')) {
    return 'plan';
  }
  // Walk from the end: the immediate parent dir tells us the kind.
  // tests/fixtures/state/plans/<slug>.md → 'plan'
  // .atomic-skills/initiatives/<slug>.md → 'initiative'
  for (let i = parts.length - 2; i >= 0; i--) {
    if (parts[i] === 'plans') return 'plan';
    if (parts[i] === 'initiatives') return 'initiative';
    // NESTED layout: a `phases/` ancestor marks a phase initiative. Checked
    // LAST in the loop body so a flat path with a `plans`/`initiatives`
    // segment is unaffected (it short-circuits above).
    if (parts[i] === 'phases') return 'initiative';
  }
  return null;
}

/**
 * Collect all *.md files to validate from a CLI argv list.
 * Each arg can be a file or a directory; directories are scanned for
 * plans/*.md + initiatives/*.md non-recursively.
 */
export function collectTargets(args) {
  const targets = [];
  const seen = new Set();
  for (const arg of args) {
    const absPath = resolve(arg);
    if (!existsSync(absPath)) {
      throw new Error(`path not found: ${arg}`);
    }
    const stat = statSync(absPath);
    if (stat.isFile()) {
      if (!seen.has(absPath)) {
        targets.push(absPath);
        seen.add(absPath);
      }
      continue;
    }
    if (stat.isDirectory()) {
      const addMd = (mdDir) => {
        if (!existsSync(mdDir) || !statSync(mdDir).isDirectory()) return;
        for (const entry of readdirSync(mdDir)) {
          if (!entry.endsWith('.md')) continue;
          const filePath = join(mdDir, entry);
          if (seen.has(filePath)) continue;
          targets.push(filePath);
          seen.add(filePath);
        }
      };
      // Flat layout (legacy; live during the migration coexistence window).
      for (const sub of ['plans', 'initiatives']) {
        addMd(join(absPath, sub));
        if (sub === 'initiatives') addMd(join(absPath, sub, 'archive'));
      }
      // Nested layout: projects/<id>/<slug>/{plan.md, phases/*.md, phases/archive/*.md}.
      const projectsDir = join(absPath, 'projects');
      if (existsSync(projectsDir) && statSync(projectsDir).isDirectory()) {
        for (const projId of readdirSync(projectsDir)) {
          const projPath = join(projectsDir, projId);
          if (!statSync(projPath).isDirectory()) continue;
          for (const planSlug of readdirSync(projPath)) {
            const planPath = join(projPath, planSlug);
            if (!statSync(planPath).isDirectory()) continue;
            const planMd = join(planPath, 'plan.md');
            if (existsSync(planMd) && statSync(planMd).isFile() && !seen.has(planMd)) {
              targets.push(planMd);
              seen.add(planMd);
            }
            addMd(join(planPath, 'phases'));
            addMd(join(planPath, 'phases', 'archive'));
          }
        }
      }
    }
  }
  return targets;
}

const DETERMINISTIC_VERIFIER_KINDS = new Set(['shell', 'test', 'query']);

/**
 * GATE-R2 — the machine-checked met-invariant (F-B2 / Inc1 linchpin).
 *
 * A markdown verifier procedure can be spoofed (timestamps, transcripts); the
 * one place a "passed" claim becomes non-self-graded is the validator. This
 * pure predicate enforces, for BOTH plan phase exit-criteria (status:'met') and
 * initiative tasks (status:'done') that carry a DETERMINISTIC verifier
 * (shell|test|query): the item may only be closed with an evidence block from a
 * REAL run —
 *   - evidence is present (absent evidence = runner-not-found / never-ran ≠ met),
 *   - evidence.passed === true,
 *   - kind:test additionally requires a parsed evidence.testsCollected > 0
 *     (a pattern that matched 0 tests must NOT be 'met' — R-XAGENT-07),
 *   - kind:query additionally requires a numeric evidence.rowCount
 *     (query is deferred-by-design; never 'met' without a real rowCount — F-B1).
 * manual verifiers and verifier-absent items are intentionally NOT gated here
 * (the manual-acceptance gate and user-overrides live elsewhere).
 *
 * Ajv 2020 cannot express this met⟹passed cross-field conditional cleanly, and
 * adding it to the schema would force the aiDeck TS mirror to change — so it
 * stays JS, here. Pure: no I/O. Returns [] when the invariant holds.
 *
 * @param {object} frontmatter - a parsed plan or initiative frontmatter
 * @returns {string[]} violation messages (empty = invariant holds)
 */
export function checkMetInvariant(frontmatter) {
  const violations = [];
  if (frontmatter == null || typeof frontmatter !== 'object') return violations;
  const arr = (x) => (Array.isArray(x) ? x : []);

  const checkClaim = (label, verifier, evidence) => {
    const kind = verifier?.kind;
    if (!DETERMINISTIC_VERIFIER_KINDS.has(kind)) return; // manual / no verifier → not gated
    if (evidence == null || typeof evidence !== 'object') {
      violations.push(`${label}: closed with a ${kind} verifier but has NO evidence block — a verifier result must come from a real run, not an assertion.`);
      return;
    }
    if (evidence.passed !== true) {
      violations.push(`${label}: closed with a ${kind} verifier but evidence.passed is not true (got ${JSON.stringify(evidence.passed)}).`);
    }
    if (kind === 'test' && !(typeof evidence.testsCollected === 'number' && evidence.testsCollected > 0)) {
      violations.push(`${label}: kind:test closed without evidence.testsCollected > 0 — a verifier pattern that matched 0 tests must not be 'met'.`);
    }
    if (kind === 'query' && typeof evidence.rowCount !== 'number') {
      violations.push(`${label}: kind:query closed without a numeric evidence.rowCount — query is deferred-by-design and never 'met' without a real rowCount.`);
    }
  };

  // Plan: phases[].exitGate.criteria[] with status 'met'.
  for (const phase of arr(frontmatter.phases)) {
    for (const crit of arr(phase?.exitGate?.criteria)) {
      if (crit?.status === 'met') checkClaim(`phase ${phase.id ?? '?'} criterion ${crit.id ?? '?'}`, crit.verifier, crit.evidence);
    }
  }
  // Initiative: exitGates[] with status 'met'.
  for (const crit of arr(frontmatter.exitGates)) {
    if (crit?.status === 'met') checkClaim(`exitGate ${crit.id ?? '?'}`, crit.verifier, crit.evidence);
  }
  // Initiative: tasks[] with status 'done' carrying a per-task verifier (F-B4).
  for (const task of arr(frontmatter.tasks)) {
    if (task?.status === 'done') checkClaim(`task ${task.id ?? '?'}`, task.verifier, task.evidence);
  }

  return violations;
}

/**
 * Validate a single file. Returns { ok, kind, errors[] }.
 */
export function validateFile(filePath, validators) {
  const kind = kindFromPath(filePath);
  if (!kind) {
    return {
      ok: false,
      kind: null,
      errors: [`cannot infer kind from path (must be under plans/, initiatives/, or projects/<id>/<slug>/{plan.md,phases/})`],
    };
  }
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    return { ok: false, kind, errors: [`read failed: ${err.message}`] };
  }
  const parsed = parseFrontmatter(raw);
  if (parsed.error) {
    return { ok: false, kind, errors: [parsed.error] };
  }
  const validate = kind === 'plan' ? validators.validatePlan : validators.validateInitiative;
  const ok = validate(parsed.frontmatter);
  if (!ok) {
    const errors = (validate.errors || []).map((e) => {
      const where = e.instancePath || '(root)';
      return `${where}: ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}`;
    });
    return { ok: false, kind, errors };
  }
  // Schema passed. Enforce the cross-field met-invariant (GATE-R2) that
  // JSON-Schema cannot express: a met/done item with a deterministic verifier
  // must carry real evidence. This is the stop-the-line that makes verify-on-done
  // non-self-graded — its failure is a hard validation error, not a warning.
  const invariantViolations = checkMetInvariant(parsed.frontmatter);
  if (invariantViolations.length > 0) {
    return { ok: false, kind, errors: invariantViolations };
  }
  return { ok: true, kind, errors: [] };
}

/**
 * Cross-validate plan↔initiative consistency for done phases.
 * Returns array of { planSlug, phaseId, initiativeSlug, errors: string[] }.
 */
export function crossValidate(planFrontmatters, initiativeFrontmatters) {
  const errors = [];
  const initBySlug = new Map();
  for (const [slug, fm] of initiativeFrontmatters) {
    initBySlug.set(slug, fm);
  }

  for (const [, plan] of planFrontmatters) {
    if (!plan.phases) continue;
    for (const phase of plan.phases) {
      if (phase.status !== 'done') continue;
      if (!phase.slug) continue;

      const init = initBySlug.get(phase.slug);
      if (!init) continue;

      const phaseErrors = [];

      if (init.status !== 'done' && init.status !== 'archived') {
        phaseErrors.push(
          `initiative status is '${init.status}' but plan phase ${phase.id} is 'done'`
        );
      }

      const pendingTasks = (init.tasks || []).filter((t) => t.status !== 'done');
      if (pendingTasks.length > 0) {
        phaseErrors.push(
          `${pendingTasks.length} initiative task(s) not done: ${pendingTasks.map((t) => t.id).join(', ')}`
        );
      }

      for (const planCrit of (phase.exitGate?.criteria || [])) {
        if (planCrit.status !== 'met') continue;
        const initCrit = (init.exitGates || []).find((c) => c.id === planCrit.id);
        if (initCrit && initCrit.status !== 'met') {
          phaseErrors.push(
            `plan criterion ${planCrit.id} is 'met' but initiative exitGate is '${initCrit.status}'`
          );
        }
      }

      if (phaseErrors.length > 0) {
        errors.push({
          planSlug: plan.slug,
          phaseId: phase.id,
          initiativeSlug: phase.slug,
          errors: phaseErrors,
        });
      }
    }
  }
  return errors;
}

function main() {
  let args = process.argv.slice(2);
  if (args.length === 0) {
    args = ['.atomic-skills'];
  }

  let validators;
  try {
    validators = buildAjv();
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(2);
  }

  let targets;
  try {
    targets = collectTargets(args);
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(2);
  }

  if (targets.length === 0) {
    console.error('ERROR: no plans/*.md or initiatives/*.md found in given path(s)');
    process.exit(2);
  }

  let failed = 0;
  for (const target of targets) {
    const rel = target.replace(`${process.cwd()}/`, '');
    const result = validateFile(target, validators);
    if (result.ok) {
      console.log(`✓ ${rel}  [${result.kind}]`);
    } else {
      failed += 1;
      console.error(`\n✖ ${rel}  [${result.kind ?? 'unknown'}]`);
      for (const err of result.errors) {
        console.error(`    - ${err}`);
      }
    }
  }

  const planFrontmatters = new Map();
  const initiativeFrontmatters = new Map();
  for (const target of targets) {
    const kind = kindFromPath(target);
    let raw;
    try { raw = readFileSync(target, 'utf8'); } catch { continue; }
    const parsed = parseFrontmatter(raw);
    if (!parsed.frontmatter || !parsed.frontmatter.slug) continue;
    if (kind === 'plan') planFrontmatters.set(parsed.frontmatter.slug, parsed.frontmatter);
    if (kind === 'initiative') initiativeFrontmatters.set(parsed.frontmatter.slug, parsed.frontmatter);
  }

  const crossErrors = crossValidate(planFrontmatters, initiativeFrontmatters);
  for (const ce of crossErrors) {
    console.error(`\n✖ cross-validation: plan '${ce.planSlug}' phase ${ce.phaseId} ↔ initiative '${ce.initiativeSlug}'`);
    for (const err of ce.errors) {
      console.error(`    - ${err}`);
    }
  }

  if (failed === 0 && crossErrors.length === 0) {
    console.log(`\n✓ All ${targets.length} file(s) valid, ${planFrontmatters.size} plan(s) cross-validated (schemaVersion 0.1/0.2)`);
    process.exit(0);
  }
  if (failed > 0) {
    console.error(`\n✖ ${failed} of ${targets.length} file(s) failed schema validation`);
  }
  if (crossErrors.length > 0) {
    console.error(`✖ ${crossErrors.length} cross-validation error(s)`);
  }
  process.exit(1);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main();
}
