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
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { stringify as stringifyYaml } from 'yaml';
import { createHash, randomUUID } from 'node:crypto';

import { collectTargets, parseFrontmatter } from './validate-state.js';
import { collectStateIntegrityViolations } from '../src/state-invariants.js';
import { fsyncDirectory } from '../src/durable-file.js';
import { withScopeTransactionLockSync } from './transaction-lock.js';
import {
  currentProcessOwner,
  isProcessOwnerAlive,
  readOwnedFile,
  withProcessClaimGuard,
} from '../src/process-lock-guard.js';

const text = (value) => (typeof value === 'string' && value.length > 0 ? value : null);
const projectIdOf = (value) => text(value?.__projectId) ?? '__legacy';
const DETERMINISTIC_VERIFIER_KINDS = new Set(['shell', 'test', 'query']);
const MIGRATION_LOCK_NAME = '.state-integrity-migration.lock';
const MIGRATION_LOCK_RETRIES = 400;
const MIGRATION_LOCK_RETRY_MS = 25;
const MIGRATION_LOCK_OWNER_GRACE_MS = 1_000;
const MIGRATION_LOCK_WAIT = new Int32Array(new SharedArrayBuffer(4));

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

function writeExclusiveDurable(path, content) {
  const fd = openSync(path, 'wx', 0o600);
  try {
    writeFileSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function fileDigest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function copyExclusiveDurable(source, destination) {
  copyFileSync(source, destination, constants.COPYFILE_EXCL);
  const fd = openSync(destination, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  fsyncDirectory(dirname(destination));
  return fileDigest(destination);
}

function migrationLockOwner(lockPath) {
  try {
    return readOwnedFile(join(lockPath, 'owner.json'), 'migration lock owner');
  } catch (error) {
    if (/symbolic link|real regular file/.test(error.message)) throw error;
    return null;
  }
}

function removeMigrationLock(lockPath, token) {
  if (migrationLockOwner(lockPath)?.token !== token) return;
  const stalePath = `${lockPath}.released.${process.pid}.${randomUUID()}`;
  try {
    renameSync(lockPath, stalePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  rmSync(stalePath, { recursive: true, force: true });
  fsyncDirectory(dirname(lockPath));
}

function acquireMigrationLock(root, { faultAt } = {}) {
  const lockPath = join(root, MIGRATION_LOCK_NAME);
  for (let attempt = 0; attempt < MIGRATION_LOCK_RETRIES; attempt += 1) {
    const lock = withProcessClaimGuard(`${lockPath}.guard`, () => {
      const token = randomUUID();
      try {
        mkdirSync(lockPath, { mode: 0o700 });
        faultAt?.({ point: 'after-lock-directory', lockPath });
        writeExclusiveDurable(
          join(lockPath, 'owner.json'),
          `${JSON.stringify(currentProcessOwner(token))}\n`,
        );
        fsyncDirectory(lockPath);
        fsyncDirectory(root);
        return { lockPath, token };
      } catch (error) {
        if (error?.code !== 'EEXIST') {
          rmSync(lockPath, { recursive: true, force: true });
          throw error;
        }
      }

      const lockStat = lstatSync(lockPath);
      if (!lockStat.isDirectory() || lockStat.isSymbolicLink()) {
        throw new Error(`migration lock path is not a real directory: ${lockPath}`);
      }
      const owner = migrationLockOwner(lockPath);
      const orphaned = owner
        ? !isProcessOwnerAlive(owner)
        : Date.now() - lockStat.mtimeMs >= MIGRATION_LOCK_OWNER_GRACE_MS;
      if (!orphaned) return null;
      const stalePath = `${lockPath}.stale.${process.pid}.${randomUUID()}`;
      try {
        renameSync(lockPath, stalePath);
        rmSync(stalePath, { recursive: true, force: true });
        fsyncDirectory(root);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      return null;
    }, { label: 'migration lock guard' });
    if (lock) return lock;
    if (attempt < MIGRATION_LOCK_RETRIES - 1) {
      Atomics.wait(MIGRATION_LOCK_WAIT, 0, 0, MIGRATION_LOCK_RETRY_MS);
    }
  }
  throw new Error(`state-integrity migration lock timed out: ${lockPath}`);
}

function withMigrationLock(root, operation, { faultAt } = {}) {
  const lock = acquireMigrationLock(root, { faultAt });
  try {
    return operation();
  } finally {
    withProcessClaimGuard(`${lock.lockPath}.guard`, () => {
      removeMigrationLock(lock.lockPath, lock.token);
    }, { label: 'migration lock guard' });
  }
}

function withStateScopeLocks(repositoryRoot, scopes, operation, index = 0) {
  if (index >= scopes.length) return operation();
  return withScopeTransactionLockSync(
    repositoryRoot,
    'phase-state',
    scopes[index],
    () => withStateScopeLocks(repositoryRoot, scopes, operation, index + 1),
  );
}

function canonicalStateScopes(scopes) {
  const unique = new Map();
  for (const scope of scopes) {
    if (!Array.isArray(scope) || scope.length !== 3
        || scope.some((part) => typeof part !== 'string' || part.length === 0)) {
      throw new TypeError('migration stateScopes must contain projectId/planSlug/phaseId tuples');
    }
    unique.set(JSON.stringify(scope), [...scope]);
  }
  return [...unique.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([, scope]) => scope);
}

function stateScopeForMigrationOperation(operation) {
  if (kindFromFile(operation.filePath) !== 'initiative') {
    throw new TypeError(`migration cannot derive a phase-state scope from ${operation.filePath}`);
  }
  const parsed = parseFrontmatter(Buffer.isBuffer(operation.content)
    ? operation.content.toString('utf8')
    : operation.content);
  if (parsed.error) {
    throw new TypeError(`migration cannot derive a phase-state scope: ${parsed.error}`);
  }
  const scope = [
    projectIdFromPath(operation.filePath),
    parsed.frontmatter?.parentPlan,
    parsed.frontmatter?.phaseId,
  ];
  if (scope.some((part) => typeof part !== 'string' || part.length === 0 || part === '__legacy')) {
    throw new TypeError(`migration cannot derive a complete phase-state scope from ${operation.filePath}`);
  }
  return scope;
}

function migrationManifestPath(transactionRoot) {
  return join(resolve(transactionRoot), '.state-integrity-migration-transaction.json');
}

function pathEscapesRoot(root, absolute) {
  const rel = relative(root, absolute);
  return rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
    || isAbsolute(rel);
}

function pathWithinRoot(root, input, label, rootAlias = root) {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error(`${label} must be a non-empty path`);
  }
  let absolute = resolve(input);
  if (pathEscapesRoot(root, absolute)) {
    const aliasAbsolute = resolve(rootAlias);
    if (pathEscapesRoot(aliasAbsolute, absolute)) {
      throw new Error(`${label} escapes the migration transaction root`);
    }
    absolute = resolve(root, relative(aliasAbsolute, absolute));
  }
  const rel = relative(root, absolute);
  let cursor = root;
  for (const component of rel.split(/[\\/]/).filter(Boolean)) {
    cursor = join(cursor, component);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`${label} traverses a symbolic link: ${cursor}`);
    }
  }
  return absolute;
}

function validatedManifestOperations(root, operations, rootAlias = root) {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error('migration transaction manifest has no operations');
  }
  return operations.map((operation, index) => {
    const filePath = pathWithinRoot(
      root, operation?.filePath, `operations[${index}].filePath`, rootAlias,
    );
    const backupPath = pathWithinRoot(
      root, operation?.backupPath, `operations[${index}].backupPath`, rootAlias,
    );
    const tempPath = pathWithinRoot(
      root, operation?.tempPath, `operations[${index}].tempPath`, rootAlias,
    );
    if (dirname(backupPath) !== dirname(filePath) || !backupPath.startsWith(`${filePath}.bak`)
        || dirname(tempPath) !== dirname(filePath) || !tempPath.startsWith(`${filePath}.`)) {
      throw new Error(`migration transaction operation ${index} has non-sibling recovery paths`);
    }
    for (const field of ['backupDigest', 'sourceDigest', 'targetDigest']) {
      if (operation[field] !== undefined && !/^[a-f0-9]{64}$/.test(operation[field])) {
        throw new Error(`migration transaction operation ${index} has an invalid ${field}`);
      }
    }
    return {
      filePath,
      backupPath,
      tempPath,
      ...(operation.backupDigest ? { backupDigest: operation.backupDigest } : {}),
      ...(operation.sourceDigest ? { sourceDigest: operation.sourceDigest } : {}),
      ...(operation.targetDigest ? { targetDigest: operation.targetDigest } : {}),
    };
  });
}

function restoreFromBackup(root, operation) {
  operation.filePath = pathWithinRoot(root, operation.filePath, 'restore filePath');
  operation.backupPath = pathWithinRoot(root, operation.backupPath, 'restore backupPath');
  if (operation.backupDigest && fileDigest(operation.backupPath) !== operation.backupDigest) {
    throw new Error(`migration recovery backup digest mismatch: ${operation.backupPath}`);
  }
  const restore = `${operation.filePath}.${process.pid}.${randomUUID()}.restore`;
  pathWithinRoot(root, restore, 'restore tempPath');
  copyExclusiveDurable(operation.backupPath, restore);
  renameSync(restore, operation.filePath);
  fsyncDirectory(dirname(operation.filePath));
}

function recoverMigrationTransactionLocked(root, rootAlias = root) {
  const manifestPath = migrationManifestPath(root);
  if (!existsSync(manifestPath)) return false;
  const manifestStat = lstatSync(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
    throw new Error(`migration transaction manifest is not a real file: ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (![1, 2, 3].includes(manifest?.version) || !Array.isArray(manifest.operations)) {
    throw new Error(`invalid state-integrity migration transaction manifest: ${manifestPath}`);
  }
  if (manifest.version === 1) {
    throw new Error(`legacy migration transaction version 1 has unauthenticated backup bytes: ${manifestPath}`);
  }
  if (manifest.version === 2) {
    throw new Error(`legacy migration transaction version 2 has unauthenticated current source bytes: ${manifestPath}`);
  }
  const operations = validatedManifestOperations(root, manifest.operations, rootAlias);
  if (operations.some((operation) => (
    !operation.backupDigest || !operation.sourceDigest || !operation.targetDigest
    || operation.backupDigest !== operation.sourceDigest
  ))) {
    throw new Error(`invalid state-integrity migration transaction digests: ${manifestPath}`);
  }
  for (const operation of operations) {
    if (!existsSync(operation.backupPath)) {
      throw new Error(`migration recovery backup is missing: ${operation.backupPath}`);
    }
    const backupStat = lstatSync(operation.backupPath);
    if (!backupStat.isFile() || backupStat.isSymbolicLink()) {
      throw new Error(`migration recovery backup is not a real file: ${operation.backupPath}`);
    }
    if (operation.backupDigest && fileDigest(operation.backupPath) !== operation.backupDigest) {
      throw new Error(`migration recovery backup digest mismatch: ${operation.backupPath}`);
    }
  }
  for (const operation of operations) {
    if (!existsSync(operation.filePath)) {
      throw new Error(`migration recovery source is missing: ${operation.filePath}`);
    }
    const sourceStat = lstatSync(operation.filePath);
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
      throw new Error(`migration recovery source is not a real file: ${operation.filePath}`);
    }
    const currentDigest = fileDigest(operation.filePath);
    if (currentDigest !== operation.sourceDigest && currentDigest !== operation.targetDigest) {
      throw new Error(
        `migration recovery current source digest matches neither source nor target: ${operation.filePath}`,
      );
    }
  }
  for (const operation of operations) restoreFromBackup(root, operation);
  for (const operation of operations) rmSync(operation.tempPath, { force: true });
  unlinkSync(manifestPath);
  fsyncDirectory(dirname(manifestPath));
  return true;
}

export function recoverMigrationTransaction(transactionRoot) {
  const requestedRoot = resolve(transactionRoot);
  mkdirSync(requestedRoot, { recursive: true });
  const root = realpathSync(requestedRoot);
  return withMigrationLock(root, () => recoverMigrationTransactionLocked(root, requestedRoot));
}

export function applyMigrationAtomically(operations, {
  transactionRoot,
  faultAt,
  lockFaultAt,
} = {}) {
  if (!Array.isArray(operations) || operations.length === 0) return { applied: 0, backups: [] };
  const normalized = operations.map((operation) => ({
    filePath: resolve(operation.filePath),
    content: operation.content,
    expectedSourceDigest: operation.expectedSourceDigest,
  }));
  if (new Set(normalized.map((operation) => operation.filePath)).size !== normalized.length) {
    throw new Error('migration operations contain duplicate source paths');
  }
  for (const operation of normalized) {
    if (typeof operation.content !== 'string' && !Buffer.isBuffer(operation.content)) {
      throw new TypeError('migration operation content must be a string or Buffer');
    }
    if (operation.expectedSourceDigest !== undefined
        && !/^[a-f0-9]{64}$/.test(operation.expectedSourceDigest)) {
      throw new TypeError('migration operation expectedSourceDigest must be a lowercase sha256');
    }
  }
  const requestedRoot = resolve(transactionRoot ?? dirname(normalized[0].filePath));
  mkdirSync(requestedRoot, { recursive: true });
  const root = realpathSync(requestedRoot);
  for (const [index, operation] of normalized.entries()) {
    operation.filePath = pathWithinRoot(
      root,
      operation.filePath,
      `operations[${index}].filePath`,
      requestedRoot,
    );
  }
  const repositoryStateTree = basename(requestedRoot) === '.atomic-skills';
  const scopes = repositoryStateTree
    ? canonicalStateScopes(normalized.map(stateScopeForMigrationOperation))
    : [];
  const stateRepositoryRoot = repositoryStateTree
    ? realpathSync(repositoryRootForStateTree(requestedRoot))
    : null;
  return withMigrationLock(root, () => withStateScopeLocks(stateRepositoryRoot, scopes, () => {
    recoverMigrationTransactionLocked(root, requestedRoot);
    for (const [index, operation] of normalized.entries()) {
      operation.filePath = pathWithinRoot(root, operation.filePath, `operations[${index}].filePath`);
      const sourceStat = lstatSync(operation.filePath);
      if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
        throw new Error(`migration source is not a real file: ${operation.filePath}`);
      }
      if (operation.expectedSourceDigest !== undefined) {
        const currentDigest = createHash('sha256').update(readFileSync(operation.filePath)).digest('hex');
        if (currentDigest !== operation.expectedSourceDigest) {
          throw new Error(`migration source changed after planning: ${operation.filePath}`);
        }
      }
    }
    const manifestPath = migrationManifestPath(root);
    const prepared = [];
    let manifestTemp = null;
    let manifestPublished = false;
    try {
      for (const operation of normalized) {
        pathWithinRoot(root, operation.filePath, 'migration source');
        const backupPath = pathWithinRoot(root, nextBackupPath(operation.filePath), 'migration backup');
        const backupDigest = copyExclusiveDurable(operation.filePath, backupPath);
        const tempPath = pathWithinRoot(
          root,
          `${operation.filePath}.${process.pid}.${randomUUID()}.migration-tmp`,
          'migration temp',
        );
        writeExclusiveDurable(tempPath, operation.content);
        const targetDigest = fileDigest(tempPath);
        prepared.push({
          ...operation,
          backupPath,
          backupDigest,
          sourceDigest: backupDigest,
          targetDigest,
          tempPath,
        });
      }
      const manifest = {
        version: 3,
        operations: prepared.map(({
          filePath, backupPath, backupDigest, sourceDigest, targetDigest, tempPath,
        }) => ({
          filePath, backupPath, backupDigest, sourceDigest, targetDigest, tempPath,
        })),
      };
      manifestTemp = pathWithinRoot(
        root,
        `${manifestPath}.${process.pid}.${randomUUID()}.tmp`,
        'migration manifest temp',
      );
      writeExclusiveDurable(manifestTemp, `${JSON.stringify(manifest, null, 2)}\n`);
      renameSync(manifestTemp, manifestPath);
      manifestTemp = null;
      fsyncDirectory(dirname(manifestPath));
      manifestPublished = true;
      faultAt?.({
        point: 'before-publish',
        operations: prepared.map((operation) => structuredClone(operation)),
      });
      const changed = prepared.find((operation) => fileDigest(operation.filePath) !== operation.sourceDigest);
      if (changed) {
        for (const operation of prepared) rmSync(operation.tempPath, { force: true });
        unlinkSync(manifestPath);
        fsyncDirectory(dirname(manifestPath));
        manifestPublished = false;
        throw new Error(`migration source changed before publish: ${changed.filePath}`);
      }
      for (const [index, operation] of prepared.entries()) {
        pathWithinRoot(root, operation.filePath, 'migration publish source');
        pathWithinRoot(root, operation.tempPath, 'migration publish temp');
        renameSync(operation.tempPath, operation.filePath);
        fsyncDirectory(dirname(operation.filePath));
        faultAt?.({ point: 'after-publish', index, operation: structuredClone(operation) });
      }
      unlinkSync(manifestPath);
      fsyncDirectory(dirname(manifestPath));
      return { applied: prepared.length, backups: prepared.map((item) => item.backupPath) };
    } catch (error) {
      if (manifestPublished || existsSync(manifestPath)) {
        try {
          recoverMigrationTransactionLocked(root, requestedRoot);
        } catch (recoveryError) {
          recoveryError.cause = error;
          throw recoveryError;
        }
      } else {
        for (const operation of prepared) rmSync(operation.tempPath, { force: true });
        if (manifestTemp) rmSync(manifestTemp, { force: true });
      }
      throw error;
    }
  }), { faultAt: lockFaultAt });
}

function repositoryRootForStateTree(stateRoot) {
  let cursor = resolve(stateRoot);
  while (basename(cursor) !== '.atomic-skills') {
    const parent = dirname(cursor);
    if (parent === cursor) {
      throw new Error(`migration root is not inside .atomic-skills: ${stateRoot}`);
    }
    cursor = parent;
  }
  return dirname(cursor);
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
    operations.push({
      filePath: source.filePath,
      content: render(migrated, source.body),
      expectedSourceDigest: createHash('sha256').update(source.raw).digest('hex'),
    });
  }
  if (apply && operations.length > 0) {
    applyMigrationAtomically(operations, {
      transactionRoot: resolve(root),
    });
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
