#!/usr/bin/env node
/**
 * Validate `.atomic-skills/` state files (Plan + Initiative frontmatter)
 * against the JSON Schemas in meta/schemas/.
 *
 * Usage:
 *   node scripts/validate-state.js                       # validates ./.atomic-skills/
 *   node scripts/validate-state.js <dir>                 # validates nested projects/<project-id>/<plan-slug> plan + phase files; legacy flat plans/*.md + initiatives/*.md also accepted
 *   node scripts/validate-state.js <file.md> [<file>...] # validates specific file(s); kind inferred from path
 *
 * Exit codes:
 *   0 — all files valid
 *   1 — one or more validation errors
 *   2 — file/parse/setup error
 */
import {
  readFileSync,
  existsSync,
  statSync,
  lstatSync,
  realpathSync,
  readdirSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import { validateAppMap } from '../src/app-map/validate.js';
import { validatePlanDependencyGraph } from '../src/plan-dependencies.js';
import {
  collectStateIntegrityViolations,
  formatStateIntegrityViolation,
} from '../src/state-invariants.js';
import { reviewArtifactTip } from '../src/review-receipt.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, '..', 'meta', 'schemas');
const APP_MAP_FILENAME = 'app-map.json';
const APP_MAP_MAX_DEPTH = 12;
const APP_MAP_SKIP_DIRS = new Set(['.git', 'node_modules']);
const FULL_GIT_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const REVIEW_MODES = new Set(['local', 'codex', 'both']);
const terminalPhaseStatus = (status) => status === 'done' || status === 'archived';

const SCHEMA_FILES = {
  common: 'common.schema.json',
  plan: 'plan.schema.json',
  initiative: 'initiative.schema.json',
  routing: 'routing.schema.json',
  lesson: 'lesson.schema.json',
};

/**
 * Load the schemas and register them with a fresh Ajv instance.
 * The $ref strings inside the schemas use relative URIs (e.g.
 * "common.schema.json#/$defs/slug") that Ajv resolves against each schema's $id.
 *
 * `routing.schema.json` (R-XAGENT-10 / R-EXEC-41) is the 4th schema. It does NOT
 * describe a `.md` frontmatter document — it validates the single operator-supplied
 * `status/routing.json` config — so it is loaded here for `validateRouting` but is
 * never selected by `kindFromPath` / `validateFile`.
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
    validateRouting: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/routing.schema.json'),
    validateLesson: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/lesson.schema.json'),
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
    // Spec 2 / G1: a `lessons/` ancestor marks a per-initiative lessons file
    // (projects/<id>/<slug>/lessons/<initiative-slug>.md).
    if (parts[i] === 'lessons') return 'lesson';
  }
  return null;
}

function projectIdFromPath(filePath) {
  const parts = resolve(filePath).split('/');
  const idx = parts.lastIndexOf('projects');
  if (idx >= 0 && typeof parts[idx + 1] === 'string' && parts[idx + 1].length > 0) {
    return parts[idx + 1];
  }
  return '__legacy';
}

/**
 * Collect all *.md files to validate from a CLI argv list.
 * Each arg can be a file or a directory; directories are scanned for the
 * nested projects/<project-id>/<plan-slug> layout plus legacy flat
 * plans/*.md + initiatives/*.md.
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
            addMd(join(planPath, 'lessons')); // Spec 2 / G1: per-initiative lessons files
          }
        }
      }
    }
  }
  return targets;
}

/**
 * Collect durable app-map catalogs from CLI argv without changing state
 * markdown discovery. Direct file args must be named exactly `app-map.json`;
 * directory args are walked recursively with bounded depth.
 */
export function collectAppMaps(args) {
  const appMaps = [];
  const seen = new Set();
  const addAppMap = (filePath) => {
    if (seen.has(filePath)) return;
    appMaps.push(filePath);
    seen.add(filePath);
  };

  const walk = (dirPath, depth) => {
    if (depth > APP_MAP_MAX_DEPTH) return;
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (APP_MAP_SKIP_DIRS.has(entry.name)) continue;
        walk(join(dirPath, entry.name), depth + 1);
        continue;
      }
      if (entry.isFile() && entry.name === APP_MAP_FILENAME) {
        addAppMap(join(dirPath, entry.name));
      }
    }
  };

  for (const arg of args) {
    const absPath = resolve(arg);
    if (!existsSync(absPath)) {
      throw new Error(`path not found: ${arg}`);
    }
    const stat = statSync(absPath);
    if (stat.isFile()) {
      if (basename(absPath) === APP_MAP_FILENAME) {
        addAppMap(absPath);
      }
      continue;
    }
    if (stat.isDirectory()) {
      walk(absPath, 0);
    }
  }

  return appMaps;
}

/**
 * Locate `status/routing.json` config files under the given args (R-XAGENT-10).
 * A routing config lives at `<stateRoot>/status/routing.json`. Each directory arg
 * is treated as a candidate state root; file args are ignored (a routing config is
 * never a validation target file). Returns absolute paths to configs that EXIST —
 * an ABSENT config is not an error (it means Mode-1-only defaults, R-EXEC-41), so
 * it simply does not appear in the result.
 */
export function collectRoutingConfigs(args) {
  const configs = [];
  const seen = new Set();
  for (const arg of args) {
    const absPath = resolve(arg);
    if (!existsSync(absPath) || !statSync(absPath).isDirectory()) continue;
    const routingPath = join(absPath, 'status', 'routing.json');
    if (existsSync(routingPath) && statSync(routingPath).isFile() && !seen.has(routingPath)) {
      configs.push(routingPath);
      seen.add(routingPath);
    }
  }
  return configs;
}

/**
 * Validate a single `status/routing.json` against routing.schema.json.
 * Returns { ok, errors }. Malformed JSON is a hard error (a present-but-broken
 * config must never silently fall back to Mode-1 defaults — that would mask an
 * operator typo that disables the feature they think they enabled).
 */
export function validateRouting(routingPath, validators) {
  let raw;
  try {
    raw = readFileSync(routingPath, 'utf8');
  } catch (err) {
    return { ok: false, errors: [`cannot read routing.json: ${err.message}`] };
  }
  let config;
  try {
    config = JSON.parse(raw);
  } catch (err) {
    return { ok: false, errors: [`JSON parse error: ${err.message}`] };
  }
  const ok = validators.validateRouting(config);
  if (!ok) {
    const errors = (validators.validateRouting.errors || []).map((e) => {
      const where = e.instancePath || '(root)';
      return `${where}: ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}`;
    });
    return { ok: false, errors };
  }
  return { ok: true, errors: [] };
}

/**
 * Validate a single durable app-map catalog with the shared app-map validator.
 */
export function validateAppMapFile(appMapPath) {
  let raw;
  try {
    raw = readFileSync(appMapPath, 'utf8');
  } catch (err) {
    return { ok: false, errors: [`cannot read app-map.json: ${err.message}`] };
  }
  let catalog;
  try {
    catalog = JSON.parse(raw);
  } catch (err) {
    return { ok: false, errors: [`JSON parse error: ${err.message}`] };
  }
  const result = validateAppMap(catalog);
  if (!result.valid) {
    const errors = result.errors.map((e) => {
      const where = e.instancePath || '(root)';
      return `${where}: ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}`;
    });
    return { ok: false, errors };
  }
  return { ok: true, errors: [] };
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
 * closedAt forward-only hard-gate (F4/T-003).
 *
 * GATE-R2 proves "passed"; this proves "captured the close instant". When a plan
 * opts in via `closedAtHardening` (set ONCE by `scripts/harden-closedat.js`), every
 * `done` task in that plan's initiatives must carry a `closedAt` — UNLESS its id is
 * in the persisted `grandfatheredTaskIds` cut. That cut (the done-without-closedAt
 * tasks captured at flip time) is what makes the rule forward-only: pre-existing
 * legacy is exempt, new closes are enforced, and no retroactive closedAt is ever
 * invented (P3). A plan with no `closedAtHardening` is NOT gated here (soft — the
 * pre-T-003 behavior). Pure: no I/O.
 *
 * This lives OUTSIDE checkMetInvariant because the opt-in (`closedAtHardening`)
 * lives on the PLAN while the `done` tasks live on the INITIATIVE — the two only
 * meet in `crossValidate`, which is where this is invoked. Returns [] when the
 * invariant holds.
 *
 * @param {object} frontmatter - a parsed initiative frontmatter (carries tasks[])
 * @param {Set<string>|string[]} grandfatheredTaskIds - the plan's exempt-id cut
 * @returns {string[]} violation messages (empty = invariant holds)
 */
export function checkClosedAtHardening(frontmatter, grandfatheredTaskIds) {
  const violations = [];
  if (frontmatter == null || typeof frontmatter !== 'object') return violations;
  const grandfathered = grandfatheredTaskIds instanceof Set
    ? grandfatheredTaskIds
    : new Set(Array.isArray(grandfatheredTaskIds) ? grandfatheredTaskIds : []);
  const hasText = (v) => typeof v === 'string' && v.length > 0;
  // PHASE-SCOPED exemption key (`<phaseId>/<taskId>`) — taskIds are phase-local
  // (T-001 recurs every phase), so a bare-id grandfather would exempt a later
  // same-id task in another phase. Mirrors `grandfatherKey` in harden-closedat.js.
  const scope = hasText(frontmatter.phaseId)
    ? frontmatter.phaseId
    : (hasText(frontmatter.slug) ? frontmatter.slug : '?');
  for (const task of (Array.isArray(frontmatter.tasks) ? frontmatter.tasks : [])) {
    if (task?.status !== 'done') continue;
    if (grandfathered.has(`${scope}/${task.id}`)) continue;
    if (!hasText(task.closedAt)) {
      violations.push(`task ${task.id ?? '?'}: done under closedAt-hardening but has no closedAt — forward-only: new done tasks must record closedAt; only grandfathered (phase-scoped) ids are exempt.`);
    }
  }
  return violations;
}

/**
 * GATE-R3 — the machine-checked review-gate invariant (G2).
 *
 * The review-code phase gate is a hard precondition for closing a phase. A
 * markdown self-review block can CLAIM "review ran" without it having; the
 * `reviewGate` block on a plan phase makes that claim machine-checkable. This
 * pure predicate enforces, for a plan phase with status:'done' that CARRIES a
 * reviewGate block, that the claim is HONEST:
 *   - status:'passed' must carry an `at` sha (the commit the review concluded
 *     against) — a passed claim with no anchor is not evidence, it is a boast,
 *   - status:'skipped' must carry a `reason` (mirrors --skip-review's recorded
 *     reason; a silent skip is forbidden).
 * An ABSENT reviewGate on a 'done' phase is NOT gated here — consistent with
 * GATE-R2's verifier-absent tolerance, and required for backward-compat with
 * the live 0.1/0.2 phases written before this field existed (`verify` check #8
 * surfaces the absence as a WARN instead, read-only). Non-done phases are never
 * gated. Like GATE-R2 this conditional lives in JS, not the schema: Ajv 2020
 * cannot express the status⟹sibling-required conditional without forcing the
 * aiDeck TS mirror to change, so the schema keeps `reviewGate` additive-optional
 * and the honesty rule lives here. Pure: no I/O. Returns [] when it holds.
 *
 * @param {object} frontmatter - a parsed plan frontmatter (initiatives have no phases → no-op)
 * @returns {string[]} violation messages (empty = invariant holds)
 */
export function checkReviewGate(frontmatter) {
  const violations = [];
  if (frontmatter == null || typeof frontmatter !== 'object') return violations;
  const hasText = (v) => typeof v === 'string' && v.trim().length > 0;
  const phases = Array.isArray(frontmatter.phases) ? frontmatter.phases : [];
  const hardened = typeof frontmatter?.stateIntegrityHardening?.enforcedFrom === 'string';
  for (const phase of phases) {
    if (!terminalPhaseStatus(phase?.status)) continue;
    const rg = phase.reviewGate;
    const label = `phase ${phase.id ?? '?'}`;
    if (rg == null || typeof rg !== 'object') {
      if (hardened) violations.push(`${label}: hardened phase close requires a passed reviewGate.`);
      continue;
    }
    if (rg.status === 'passed') {
      if (!hasText(rg.at)) {
        violations.push(`${label}: reviewGate.status is 'passed' but has no \`at\` sha — a passed review claim must record the commit it concluded against, not just assert it ran.`);
      }
      if (hardened && !FULL_GIT_OID.test(rg.at ?? '')) {
        violations.push(`${label}: reviewGate.at must be a full 40- or 64-character lowercase git object id under stateIntegrityHardening.`);
      }
      if (hardened && !REVIEW_MODES.has(rg.mode)) {
        violations.push(`${label}: hardened passed reviewGate requires mode local, codex, or both.`);
      }
      if (hardened && (!hasText(rg.reviewFile)
        || !rg.reviewFile.startsWith('.atomic-skills/reviews/')
        || rg.reviewFile.split('/').includes('..'))) {
        violations.push(`${label}: hardened passed reviewGate requires a repository-local reviewFile under .atomic-skills/reviews/.`);
      }
    } else if (rg.status === 'skipped') {
      if (hardened) {
        violations.push(`${label}: hardened phase close cannot skip review.`);
        continue;
      }
      if (!hasText(rg.reason)) {
        violations.push(`${label}: reviewGate.status is 'skipped' but carries no \`reason\` — a silent review skip is forbidden (record why, mirroring --skip-review).`);
      }
    } else {
      violations.push(`${label}: reviewGate.status must be 'passed' or 'skipped' (got ${JSON.stringify(rg.status)}).`);
    }
  }
  return violations;
}

export function gitCommitExists(sha, repositoryRoot = process.cwd()) {
  if (!FULL_GIT_OID.test(sha ?? '')) return false;
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], {
      cwd: repositoryRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export function persistedReviewMatches(reviewFile, sha, repositoryRoot = process.cwd(), mode) {
  if (typeof reviewFile !== 'string' || !reviewFile.startsWith('.atomic-skills/reviews/')) return false;
  const root = resolve(repositoryRoot, '.atomic-skills', 'reviews');
  const candidate = resolve(repositoryRoot, reviewFile);
  if (!candidate.startsWith(`${root}${sep}`) || !existsSync(candidate)) return false;
  try {
    let cursor = resolve(repositoryRoot);
    for (const part of reviewFile.split('/')) {
      if (!part || part === '.' || part === '..') return false;
      cursor = join(cursor, part);
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink()) return false;
    }
    const candidateStat = lstatSync(candidate);
    if (!candidateStat.isFile()) return false;
    const realRoot = realpathSync(root);
    const realCandidate = realpathSync(candidate);
    if (!realCandidate.startsWith(`${realRoot}${sep}`)) return false;
    const parsed = parseFrontmatter(readFileSync(candidate, 'utf8'));
    if (parsed.error) return false;
    const receipt = parsed.frontmatter;
    const artifactTip = reviewArtifactTip(receipt.artifact);
    return (receipt.final_verdict === 'approve' || receipt.final_verdict === 'approve_with_nits')
      && receipt.skill === 'review-code'
      && typeof receipt.reviewer === 'string'
      && receipt.reviewer.length > 0
      && receipt.mode === mode
      && artifactTip === sha
      && (receipt.reviewed_commit === undefined || receipt.reviewed_commit === sha);
  } catch {
    return false;
  }
}

/**
 * Forward-only close provenance for plans opted into stateIntegrityHardening.
 * The plan review receipt and every mirrored met gate must point at the same
 * real commit. Resolver injection keeps the invariant deterministic in tests.
 */
export function checkAnchoredCloseEvidence(plan, initiative, {
  commitExists = () => true,
  reviewFileMatches = () => true,
  repositoryRoot = plan?.__repoRoot ?? initiative?.__repoRoot ?? process.cwd(),
} = {}) {
  const violations = [];
  if (typeof plan?.stateIntegrityHardening?.enforcedFrom !== 'string') return violations;
  const phases = (Array.isArray(plan?.phases) ? plan.phases : []).filter((phase) => (
    terminalPhaseStatus(phase?.status)
    && (!initiative || phase.id === initiative.phaseId || phase.slug === initiative.slug)
  ));
  for (const phase of phases) {
    const label = `phase ${phase.id ?? '?'}`;
    const reviewGate = phase.reviewGate ?? {};
    const reviewedHead = reviewGate.at;
    if (FULL_GIT_OID.test(reviewedHead ?? '') && !commitExists(reviewedHead, repositoryRoot)) {
      violations.push(`${label}: reviewGate.at ${reviewedHead} does not resolve to a commit.`);
    }
    if (typeof reviewGate.reviewFile === 'string'
      && FULL_GIT_OID.test(reviewedHead ?? '')
      && !reviewFileMatches(reviewGate.reviewFile, reviewedHead, repositoryRoot, reviewGate.mode)) {
      violations.push(`${label}: reviewFile does not exist under .atomic-skills/reviews/ or does not contain the reviewed SHA ${reviewedHead}.`);
    }
    const initiativeGates = new Map(
      (Array.isArray(initiative?.exitGates) ? initiative.exitGates : []).map((gate) => [gate?.id, gate]),
    );
    for (const criterion of (Array.isArray(phase.exitGate?.criteria) ? phase.exitGate.criteria : [])) {
      if (criterion?.status !== 'met') continue;
      if (criterion?.evidence?.verifiedCommit !== reviewedHead) {
        violations.push(`${label} criterion ${criterion.id ?? '?'}: evidence.verifiedCommit must equal reviewed HEAD ${reviewedHead}.`);
      }
      const mirror = initiativeGates.get(criterion?.id);
      if (mirror && mirror.status === 'met' && mirror?.evidence?.verifiedCommit !== reviewedHead) {
        violations.push(`${label} initiative criterion ${criterion.id ?? '?'}: evidence.verifiedCommit must equal reviewed HEAD ${reviewedHead}.`);
      }
    }
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
  const validate = kind === 'plan'
    ? validators.validatePlan
    : kind === 'lesson'
      ? validators.validateLesson
      : validators.validateInitiative;
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
  const invariantViolations = [
    ...checkMetInvariant(parsed.frontmatter),
    ...checkReviewGate(parsed.frontmatter), // GATE-R3 (G2): done phase's review claim must be honest
  ];
  if (invariantViolations.length > 0) {
    return { ok: false, kind, errors: invariantViolations };
  }
  return { ok: true, kind, errors: [] };
}

/**
 * Cross-validate plan↔initiative consistency for done phases.
 * Returns array of { planSlug, phaseId, initiativeSlug, errors: string[] }.
 */
export function crossValidate(planFrontmatters, initiativeFrontmatters, {
  completeGraph = true,
  commitExists = gitCommitExists,
  reviewFileMatches = persistedReviewMatches,
} = {}) {
  const errors = [];
  const initBySlug = new Map();
  const projectScopeId = (fm) => (typeof fm?.__projectId === 'string' && fm.__projectId.length > 0)
    ? fm.__projectId
    : '__legacy';
  for (const [slug, fm] of initiativeFrontmatters) {
    initBySlug.set(slug, fm);
  }

  for (const [, plan] of planFrontmatters) {
    if (!plan.phases) continue;
    const projectId = typeof plan.__projectId === 'string' && plan.__projectId.length > 0
      ? plan.__projectId
      : null;
    for (const phase of plan.phases) {
      if (!terminalPhaseStatus(phase.status)) continue;
      if (!phase.slug) continue;

      const init = (projectId ? initBySlug.get(`${projectId}/${phase.slug}`) : null)
        ?? initBySlug.get(phase.slug);
      if (!init) continue;

      const phaseErrors = [];
      const repositoryRoot = plan.__repoRoot ?? process.cwd();
      if (plan.__repoRoot && init.__repoRoot && plan.__repoRoot !== init.__repoRoot) {
        phaseErrors.push(
          `[cross-repository-join] plan repository ${plan.__repoRoot} differs from initiative repository ${init.__repoRoot}`,
        );
      }

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
        if (!initCrit) continue;
        if (initCrit.status !== 'met') {
          phaseErrors.push(
            `plan criterion ${planCrit.id} is 'met' but initiative exitGate is '${initCrit.status}'`
          );
          continue; // status already divergent — evidence cross-check is moot
        }

        // C2#2 — GATE-R2 must not be splittable across the plan↔initiative
        // mirror. checkMetInvariant gates evidence per-FILE, but phase-done
        // step 8b writes the exit gate on BOTH the plan criterion and the
        // initiative exitGate. An operator validating one file at a time can be
        // fooled when a met, deterministically-verified criterion carries its
        // evidence on only ONE surface, or carries contradicting evidence on
        // each. Co-validate the evidence here, where both files are in hand.
        const kind = planCrit.verifier?.kind ?? initCrit.verifier?.kind;
        if (DETERMINISTIC_VERIFIER_KINDS.has(kind)) {
          const pe = planCrit.evidence;
          const ie = initCrit.evidence;
          const pHas = pe != null && typeof pe === 'object';
          const iHas = ie != null && typeof ie === 'object';
          if (pHas !== iHas) {
            phaseErrors.push(
              `criterion ${planCrit.id}: evidence block present on only one surface (plan:${pHas ? 'present' : 'absent'}, initiative:${iHas ? 'present' : 'absent'}) — a met ${kind} criterion mirrored across plan and initiative must carry evidence on BOTH (GATE-R2 must not split across files).`
            );
          } else if (pHas && iHas && !isDeepStrictEqual(pe, ie)) {
            phaseErrors.push(
              `criterion ${planCrit.id}: full evidence disagrees across surfaces — the deterministic met-invariant must be identical on the plan and the initiative.`
            );
          }
        }
      }

      phaseErrors.push(...checkAnchoredCloseEvidence(
        { ...plan, phases: [phase] },
        init,
        { commitExists, reviewFileMatches, repositoryRoot },
      ));

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

  const hardenedPlans = new Map(
    [...planFrontmatters].filter(([, plan]) => (
      plan?.stateIntegrityHardening
      && typeof plan.stateIntegrityHardening.enforcedFrom === 'string'
    )),
  );
  const hardenedScopes = [...hardenedPlans.values()].map((plan) => ({
    projectId: projectScopeId(plan),
    planSlug: plan.slug,
    phaseSlugs: new Set((Array.isArray(plan.phases) ? plan.phases : []).map((phase) => phase?.slug)),
  }));
  const hardenedInitiatives = new Map(
    [...initiativeFrontmatters].filter(([, initiative]) => hardenedScopes.some((scope) => (
      projectScopeId(initiative) === scope.projectId
      && (initiative?.parentPlan === scope.planSlug || scope.phaseSlugs.has(initiative?.slug))
    ))),
  );
  for (const item of collectStateIntegrityViolations(hardenedPlans, hardenedInitiatives)) {
    if (!completeGraph && item.code === 'missing-initiative') continue;
    const planSlug = item.planSlug ?? '?';
    const phaseId = item.phaseId ?? '?';
    const initiativeSlug = item.initiativeSlug ?? '?';
    let group = errors.find((entry) => (
      entry.planSlug === planSlug
      && entry.phaseId === phaseId
      && entry.initiativeSlug === initiativeSlug
    ));
    if (!group) {
      group = { planSlug, phaseId, initiativeSlug, errors: [] };
      errors.push(group);
    }
    group.errors.push(formatStateIntegrityViolation(item));
  }

  // closedAt forward-only hard-gate (F4/T-003): when a plan opts in via
  // `closedAtHardening`, every done task across ITS initiatives (matched by
  // parentPlan) that is not grandfathered must carry closedAt. Scans all of the
  // plan's initiatives — active phases too, not just done ones — so a new close
  // in the live phase is gated immediately.
  for (const [, plan] of planFrontmatters) {
    const planProjectId = projectScopeId(plan);
    const hardening = plan?.closedAtHardening;
    if (!hardening || typeof hardening.enforcedFrom !== 'string' || hardening.enforcedFrom.length === 0) continue;
    // A slug-less (malformed) plan owns no initiatives — without this guard a
    // `parentPlan`-less standalone initiative would match plan.slug via
    // `undefined !== undefined` (false) and be gated against the wrong plan.
    if (typeof plan.slug !== 'string' || plan.slug.length === 0) continue;
    const grandfathered = new Set(Array.isArray(hardening.grandfatheredTaskIds) ? hardening.grandfatheredTaskIds : []);
    for (const [slug, init] of initiativeFrontmatters) {
      if (init?.parentPlan !== plan.slug) continue;
      if (projectScopeId(init) !== planProjectId) continue;
      const closedAtErrors = checkClosedAtHardening(init, grandfathered);
      if (closedAtErrors.length > 0) {
        errors.push({
          planSlug: plan.slug,
          phaseId: init.phaseId ?? '?',
          initiativeSlug: slug,
          errors: closedAtErrors,
        });
      }
    }
  }

  errors.push(...collectPlanDependencyErrors(planFrontmatters));

  return errors;
}

function repositoryRootFromStatePath(file) {
  const absolute = resolve(file);
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: dirname(absolute),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    const marker = `${sep}.atomic-skills${sep}`;
    const index = absolute.indexOf(marker);
    if (index >= 0) return absolute.slice(0, index);

    // Non-git migration fixtures have no `.atomic-skills/` anchor. Infer the
    // state root from the nearest supported layout directory so legacy
    // `plans/` and `initiatives/` files join against the same repository, and
    // nested `projects/<id>/<slug>/` files resolve to that same root.
    const layoutDirectories = new Set(['plans', 'initiatives', 'projects']);
    let cursor = dirname(absolute);
    while (dirname(cursor) !== cursor) {
      if (layoutDirectories.has(basename(cursor))) return dirname(cursor);
      cursor = dirname(cursor);
    }
    return dirname(absolute);
  }
}

export function collectStateFrontmatters(targets) {
  const planFrontmatters = new Map();
  const initiativeFrontmatters = new Map();
  const collectionErrors = [];
  for (const target of targets) {
    const kind = kindFromPath(target);
    if (kind !== 'plan' && kind !== 'initiative') continue;
    let raw;
    try { raw = readFileSync(target, 'utf8'); } catch { continue; }
    const parsed = parseFrontmatter(raw);
    if (!parsed.frontmatter || !parsed.frontmatter.slug) continue;
    const projectId = projectIdFromPath(target);
    const key = `${projectId}/${parsed.frontmatter.slug}`;
    const map = kind === 'plan' ? planFrontmatters : initiativeFrontmatters;
    const sourcePath = resolve(target);
    if (map.has(key)) {
      const priorPath = map.get(key).__sourcePath;
      collectionErrors.push({
        planSlug: parsed.frontmatter.parentPlan ?? parsed.frontmatter.slug,
        phaseId: parsed.frontmatter.phaseId ?? '?',
        initiativeSlug: parsed.frontmatter.slug,
        errors: [`[duplicate-${kind}-identity] ${key} is declared by both ${priorPath} and ${sourcePath}`],
      });
      continue;
    }
    map.set(key, {
      ...parsed.frontmatter,
      __projectId: projectId,
      __repoRoot: repositoryRootFromStatePath(sourcePath),
      __sourcePath: sourcePath,
    });
  }
  return { planFrontmatters, initiativeFrontmatters, collectionErrors };
}

function formatPlanDependencyError(error) {
  return `[${error.code}] ${error.message}`;
}

export function collectPlanDependencyErrors(planFrontmatters) {
  const plans = [...planFrontmatters.values()]
    .filter((plan) => plan && typeof plan.slug === 'string' && plan.slug.length > 0);
  const projectsBySlug = new Map();
  const plansByProject = new Map();

  for (const plan of plans) {
    const projectId = typeof plan.__projectId === 'string' && plan.__projectId.length > 0
      ? plan.__projectId
      : '__legacy';
    if (!plansByProject.has(projectId)) plansByProject.set(projectId, []);
    plansByProject.get(projectId).push(plan);
    if (!projectsBySlug.has(plan.slug)) projectsBySlug.set(plan.slug, new Set());
    projectsBySlug.get(plan.slug).add(projectId);
  }

  const errors = [];
  for (const [projectId, projectPlans] of plansByProject) {
    const sameProjectSlugs = new Set(projectPlans.map((plan) => plan.slug));
    const crossProjectMessages = [];

    for (const plan of projectPlans) {
      for (const dep of Array.isArray(plan.dependsOnPlans) ? plan.dependsOnPlans : []) {
        if (!dep || typeof dep.plan !== 'string') continue;
        if (sameProjectSlugs.has(dep.plan)) continue;
        const otherProjects = [...(projectsBySlug.get(dep.plan) ?? [])].filter((id) => id !== projectId);
        if (otherProjects.length === 0) continue;
        crossProjectMessages.push(
          `[cross-project-dependency] plan ${plan.slug} in project ${projectId} depends on ${dep.plan}, which exists only in project(s): ${otherProjects.join(', ')}`
        );
      }
    }

    const graphErrors = validatePlanDependencyGraph(projectPlans).filter((error) => {
      if (error.code !== 'unknown-prerequisite') return true;
      const otherProjects = [...(projectsBySlug.get(error.prerequisite) ?? [])].filter((id) => id !== projectId);
      return otherProjects.length === 0;
    });

    const messages = [
      ...crossProjectMessages,
      ...graphErrors.map(formatPlanDependencyError),
    ];
    if (messages.length > 0) {
      errors.push({
        planSlug: projectId,
        phaseId: 'dependsOnPlans',
        initiativeSlug: 'plan-dependencies',
        errors: messages,
      });
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
  let appMaps;
  try {
    targets = collectTargets(args);
    appMaps = collectAppMaps(args);
    targets = targets.filter((target) => basename(target) !== APP_MAP_FILENAME);
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(2);
  }

  if (targets.length === 0 && appMaps.length === 0) {
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

  let appMapFailed = 0;
  for (const appMapPath of appMaps) {
    const rel = appMapPath.replace(`${process.cwd()}/`, '');
    const result = validateAppMapFile(appMapPath);
    if (result.ok) {
      console.log(`✓ ${rel}  [app-map]`);
    } else {
      appMapFailed += 1;
      console.error(`\n✖ ${rel}  [app-map]`);
      for (const err of result.errors) {
        console.error(`    - ${err}`);
      }
    }
  }

  const {
    planFrontmatters,
    initiativeFrontmatters,
    collectionErrors,
  } = collectStateFrontmatters(targets);

  const completeGraph = args.some((arg) => {
    try { return statSync(resolve(arg)).isDirectory(); } catch { return false; }
  });
  const crossErrors = [
    ...collectionErrors,
    ...crossValidate(planFrontmatters, initiativeFrontmatters, { completeGraph }),
  ];
  for (const ce of crossErrors) {
    console.error(`\n✖ cross-validation: plan '${ce.planSlug}' phase ${ce.phaseId} ↔ initiative '${ce.initiativeSlug}'`);
    for (const err of ce.errors) {
      console.error(`    - ${err}`);
    }
  }

  // Mode 2 routing config (R-XAGENT-10). Absent ⇒ Mode-1 defaults, nothing to
  // check. Present ⇒ must validate; a broken config is a hard failure.
  let routingFailed = 0;
  const routingConfigs = collectRoutingConfigs(args);
  for (const routingPath of routingConfigs) {
    const rel = routingPath.replace(`${process.cwd()}/`, '');
    const result = validateRouting(routingPath, validators);
    if (result.ok) {
      console.log(`✓ ${rel}  [routing]`);
    } else {
      routingFailed += 1;
      console.error(`\n✖ ${rel}  [routing]`);
      for (const err of result.errors) {
        console.error(`    - ${err}`);
      }
    }
  }

  if (failed === 0 && crossErrors.length === 0 && routingFailed === 0 && appMapFailed === 0) {
    const routingNote = routingConfigs.length ? `, ${routingConfigs.length} routing config(s) valid` : '';
    const appMapNote = appMaps.length ? `, ${appMaps.length} app-map catalog(s) valid` : '';
    console.log(`\n✓ All ${targets.length} file(s) valid, ${planFrontmatters.size} plan(s) cross-validated${routingNote}${appMapNote} (schemaVersion 0.1/0.2)`);
    process.exit(0);
  }
  if (failed > 0) {
    console.error(`\n✖ ${failed} of ${targets.length} file(s) failed schema validation`);
  }
  if (crossErrors.length > 0) {
    console.error(`✖ ${crossErrors.length} cross-validation error(s)`);
  }
  if (routingFailed > 0) {
    console.error(`✖ ${routingFailed} routing config(s) failed validation`);
  }
  if (appMapFailed > 0) {
    console.error(`✖ ${appMapFailed} app-map catalog(s) failed validation`);
  }
  process.exit(1);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main();
}
