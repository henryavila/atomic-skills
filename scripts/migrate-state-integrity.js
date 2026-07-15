#!/usr/bin/env node
import {
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { stringify as stringifyYaml } from 'yaml';
import { randomUUID } from 'node:crypto';

import { collectTargets, parseFrontmatter } from './validate-state.js';
import { collectStateIntegrityViolations } from '../src/state-invariants.js';

const text = (value) => (typeof value === 'string' && value.length > 0 ? value : null);
const projectIdOf = (value) => text(value?.__projectId) ?? '__legacy';
const DETERMINISTIC_VERIFIER_KINDS = new Set(['shell', 'test', 'query']);

function migrationError(code, message, context = {}) {
  return { code, message, ...context };
}

export function planStateIntegrityMigration(planFrontmatters, initiativeFrontmatters) {
  const duplicateErrors = collectStateIntegrityViolations(planFrontmatters, initiativeFrontmatters)
    .filter((item) => item.code.startsWith('duplicate-'));
  if (duplicateErrors.length > 0) return { changes: [], errors: duplicateErrors };
  const plans = [...planFrontmatters.values()].filter(Boolean);
  const changes = [];
  const errors = [];

  for (const [key, initiative] of initiativeFrontmatters) {
    const missingParent = !text(initiative?.parentPlan);
    const missingPhase = !text(initiative?.phaseId);
    const candidates = [];
    for (const plan of plans) {
      if (projectIdOf(plan) !== projectIdOf(initiative)) continue;
      if (text(initiative.parentPlan) && text(initiative.parentPlan) !== text(plan.slug)) continue;
      for (const phase of Array.isArray(plan.phases) ? plan.phases : []) {
        if (text(initiative.phaseId) && text(initiative.phaseId) !== text(phase?.id)) continue;
        if (text(initiative.slug) !== text(phase?.slug)) continue;
        candidates.push({ plan, phase });
      }
    }
    if ((missingParent || missingPhase) && candidates.length !== 1) {
      errors.push(migrationError(
        candidates.length === 0 ? 'unresolved-initiative-identity' : 'ambiguous-initiative-identity',
        `initiative ${initiative?.slug ?? key} has ${candidates.length} identity candidate(s)`,
        { key, projectId: projectIdOf(initiative), initiativeSlug: initiative?.slug ?? null },
      ));
      continue;
    }
    if (candidates.length !== 1) continue;

    const [{ plan, phase }] = candidates;
    const patch = {
      ...(missingParent ? { parentPlan: plan.slug } : {}),
      ...(missingPhase ? { phaseId: phase.id } : {}),
    };
    let evidenceChanged = false;
    const exitGates = (initiative.exitGates || []).map((gate) => {
      const criterion = (phase.exitGate?.criteria || []).find((candidate) => candidate.id === gate.id);
      const verifierKind = criterion?.verifier?.kind ?? gate?.verifier?.kind;
      if (
        criterion?.status !== 'met'
        || gate?.status !== 'met'
        || !DETERMINISTIC_VERIFIER_KINDS.has(verifierKind)
        || criterion.evidence == null
        || typeof criterion.evidence !== 'object'
        || isDeepStrictEqual(criterion.evidence, gate.evidence)
      ) {
        return gate;
      }
      evidenceChanged = true;
      return { ...gate, evidence: structuredClone(criterion.evidence) };
    });
    if (evidenceChanged) patch.exitGates = exitGates;
    if (Object.keys(patch).length === 0) continue;

    changes.push({
      key,
      initiative,
      patch,
    });
  }
  return { changes, errors };
}

function pathParts(filePath) {
  return resolve(filePath).replaceAll('\\', '/').split('/').filter(Boolean);
}

export function projectIdFromPath(filePath) {
  const parts = pathParts(filePath);
  const index = parts.lastIndexOf('projects');
  return index >= 0 && parts[index + 1] ? parts[index + 1] : '__legacy';
}

export function kindFromFile(filePath) {
  const parts = pathParts(filePath);
  if (parts.at(-1) === 'plan.md' && parts.includes('projects')) return 'plan';
  if (parts.includes('plans')) return 'plan';
  if (parts.includes('phases') || parts.includes('initiatives')) return 'initiative';
  return null;
}

function nextBackupPath(filePath) {
  let suffix = 0;
  while (true) {
    const candidate = `${filePath}.bak${suffix === 0 ? '' : `.${suffix}`}`;
    if (!existsSync(candidate)) return candidate;
    suffix += 1;
  }
}

function render(frontmatter, body) {
  return `---\n${stringifyYaml(frontmatter)}---\n${body ? `\n${body}` : ''}`;
}

function fsyncDirectory(path) {
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function writeExclusiveDurable(path, content) {
  const fd = openSync(path, 'wx', 0o600);
  try {
    writeFileSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function migrationManifestPath(transactionRoot) {
  return join(resolve(transactionRoot), '.state-integrity-migration-transaction.json');
}

function pathWithinRoot(root, input, label) {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error(`${label} must be a non-empty path`);
  }
  const absolute = resolve(input);
  const rel = relative(root, absolute);
  if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
      || isAbsolute(rel)) {
    throw new Error(`${label} escapes the migration transaction root`);
  }
  return absolute;
}

function validatedManifestOperations(root, operations) {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error('migration transaction manifest has no operations');
  }
  return operations.map((operation, index) => {
    const filePath = pathWithinRoot(root, operation?.filePath, `operations[${index}].filePath`);
    const backupPath = pathWithinRoot(root, operation?.backupPath, `operations[${index}].backupPath`);
    const tempPath = pathWithinRoot(root, operation?.tempPath, `operations[${index}].tempPath`);
    if (dirname(backupPath) !== dirname(filePath) || !backupPath.startsWith(`${filePath}.bak`)
        || dirname(tempPath) !== dirname(filePath) || !tempPath.startsWith(`${filePath}.`)) {
      throw new Error(`migration transaction operation ${index} has non-sibling recovery paths`);
    }
    return { filePath, backupPath, tempPath };
  });
}

function restoreFromBackup(operation) {
  const restore = `${operation.filePath}.${process.pid}.${randomUUID()}.restore`;
  copyFileSync(operation.backupPath, restore, constants.COPYFILE_EXCL);
  const fd = openSync(restore, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(restore, operation.filePath);
  fsyncDirectory(dirname(operation.filePath));
}

export function recoverMigrationTransaction(transactionRoot) {
  const root = resolve(transactionRoot);
  const manifestPath = migrationManifestPath(root);
  if (!existsSync(manifestPath)) return false;
  const manifestStat = lstatSync(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
    throw new Error(`migration transaction manifest is not a real file: ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest?.version !== 1 || !Array.isArray(manifest.operations)) {
    throw new Error(`invalid state-integrity migration transaction manifest: ${manifestPath}`);
  }
  const operations = validatedManifestOperations(root, manifest.operations);
  for (const operation of operations) {
    if (!existsSync(operation.backupPath)) {
      throw new Error(`migration recovery backup is missing: ${operation.backupPath}`);
    }
    const backupStat = lstatSync(operation.backupPath);
    if (!backupStat.isFile() || backupStat.isSymbolicLink()) {
      throw new Error(`migration recovery backup is not a real file: ${operation.backupPath}`);
    }
  }
  for (const operation of operations) restoreFromBackup(operation);
  for (const operation of operations) rmSync(operation.tempPath, { force: true });
  unlinkSync(manifestPath);
  fsyncDirectory(dirname(manifestPath));
  return true;
}

export function applyMigrationAtomically(operations, { transactionRoot, faultAt } = {}) {
  if (!Array.isArray(operations) || operations.length === 0) return { applied: 0, backups: [] };
  const normalized = operations.map((operation) => ({
    filePath: resolve(operation.filePath),
    content: operation.content,
  }));
  if (new Set(normalized.map((operation) => operation.filePath)).size !== normalized.length) {
    throw new Error('migration operations contain duplicate source paths');
  }
  for (const operation of normalized) {
    if (typeof operation.content !== 'string' && !Buffer.isBuffer(operation.content)) {
      throw new TypeError('migration operation content must be a string or Buffer');
    }
  }
  const root = resolve(transactionRoot ?? dirname(normalized[0].filePath));
  mkdirSync(root, { recursive: true });
  for (const [index, operation] of normalized.entries()) {
    operation.filePath = pathWithinRoot(root, operation.filePath, `operations[${index}].filePath`);
    const sourceStat = lstatSync(operation.filePath);
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
      throw new Error(`migration source is not a real file: ${operation.filePath}`);
    }
  }
  recoverMigrationTransaction(root);
  const manifestPath = migrationManifestPath(root);
  const prepared = [];
  try {
    for (const operation of normalized) {
      const backupPath = nextBackupPath(operation.filePath);
      copyFileSync(operation.filePath, backupPath, constants.COPYFILE_EXCL);
      const tempPath = `${operation.filePath}.${process.pid}.${randomUUID()}.migration-tmp`;
      writeExclusiveDurable(tempPath, operation.content);
      prepared.push({ ...operation, backupPath, tempPath });
    }
    const manifest = {
      version: 1,
      operations: prepared.map(({ filePath, backupPath, tempPath }) => ({
        filePath, backupPath, tempPath,
      })),
    };
    const manifestTemp = `${manifestPath}.${process.pid}.${randomUUID()}.tmp`;
    writeExclusiveDurable(manifestTemp, `${JSON.stringify(manifest, null, 2)}\n`);
    renameSync(manifestTemp, manifestPath);
    fsyncDirectory(dirname(manifestPath));
    for (const [index, operation] of prepared.entries()) {
      renameSync(operation.tempPath, operation.filePath);
      fsyncDirectory(dirname(operation.filePath));
      faultAt?.({ point: 'after-publish', index, operation: structuredClone(operation) });
    }
    unlinkSync(manifestPath);
    fsyncDirectory(dirname(manifestPath));
    return { applied: prepared.length, backups: prepared.map((item) => item.backupPath) };
  } catch (error) {
    for (const operation of prepared) {
      if (existsSync(operation.backupPath)) restoreFromBackup(operation);
      rmSync(operation.tempPath, { force: true });
    }
    rmSync(manifestPath, { force: true });
    fsyncDirectory(dirname(manifestPath));
    throw error;
  }
}

function runCli(argv) {
  const apply = argv.includes('--apply');
  const root = argv.find((arg) => !arg.startsWith('--')) ?? '.atomic-skills';
  const plans = new Map();
  const initiatives = new Map();
  const planPaths = new Map();
  const initiativePaths = new Map();
  const duplicateErrors = [];

  if (apply) recoverMigrationTransaction(resolve(root));

  for (const filePath of collectTargets([root])) {
    const kind = kindFromFile(filePath);
    if (kind !== 'plan' && kind !== 'initiative') continue;
    const raw = readFileSync(filePath, 'utf8');
    const parsed = parseFrontmatter(raw);
    if (parsed.error) throw new Error(`${filePath}: ${parsed.error}`);
    const frontmatter = { ...parsed.frontmatter, __projectId: projectIdFromPath(filePath) };
    const key = `${frontmatter.__projectId}/${frontmatter.slug}`;
    const values = kind === 'plan' ? plans : initiatives;
    const paths = kind === 'plan' ? planPaths : initiativePaths;
    if (values.has(key)) {
      duplicateErrors.push(migrationError(
        `duplicate-${kind}-identity`,
        `duplicate ${kind} identity ${key} resolves to ${paths.get(key).filePath} and ${filePath}`,
        { key, kind, paths: [paths.get(key).filePath, filePath] },
      ));
      continue;
    }
    values.set(key, frontmatter);
    paths.set(key, { filePath, raw, body: parsed.body });
  }

  if (duplicateErrors.length > 0) {
    for (const error of duplicateErrors) console.error(`[${error.code}] ${error.message}`);
    return 1;
  }

  const result = planStateIntegrityMigration(plans, initiatives);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`[${error.code}] ${error.message}`);
    return 1;
  }
  console.log(`${apply ? 'APPLY' : 'DRY-RUN'}: ${result.changes.length} change(s)`);
  const operations = [];
  for (const change of result.changes) {
    const source = initiativePaths.get(change.key);
    if (!source) throw new Error(`missing source path for ${change.key}`);
    console.log(`${source.filePath}: ${JSON.stringify(change.patch)}`);
    if (!apply) continue;
    const migrated = { ...change.initiative, ...change.patch };
    delete migrated.__projectId;
    operations.push({ filePath: source.filePath, content: render(migrated, source.body) });
  }
  if (apply && operations.length > 0) {
    applyMigrationAtomically(operations, { transactionRoot: resolve(root) });
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    console.error(`migrate-state-integrity: ${error.message}`);
    process.exitCode = 2;
  }
}
