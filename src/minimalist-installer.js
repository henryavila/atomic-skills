import './minimalist-installer-platform.js';
import * as engine from '@henryavila/minimalist-installer';
import { assertWindowsPathHasNoReparsePoints } from './minimalist-installer-platform.js';

export * from '@henryavila/minimalist-installer';

function collectMutationPaths(value, key = '', paths = new Set()) {
  if (typeof value === 'string') {
    if (key === 'path' || key === 'created') paths.add(value);
    return paths;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMutationPaths(item, key, paths);
    return paths;
  }
  if (!value || typeof value !== 'object') return paths;
  for (const [childKey, child] of Object.entries(value)) {
    collectMutationPaths(child, childKey, paths);
  }
  return paths;
}

function guardPaths(projectDir, manifestDir, values) {
  if (process.platform !== 'win32') return;
  const paths = new Set([`${manifestDir || '.minimalist-installer'}/manifest.json`]);
  for (const value of values) collectMutationPaths(value, '', paths);
  for (const relativePath of paths) {
    assertWindowsPathHasNoReparsePoints(projectDir, relativePath);
  }
}

function guardManifestPath(projectDir, manifestDir) {
  if (process.platform !== 'win32') return;
  assertWindowsPathHasNoReparsePoints(
    projectDir,
    `${manifestDir || engine.MANIFEST_DIR}/manifest.json`,
  );
}

export function readManifest(projectDir, manifestDir) {
  guardManifestPath(projectDir, manifestDir);
  return engine.readManifest(projectDir, manifestDir);
}

export function writeManifest(projectDir, value, manifestDir) {
  guardManifestPath(projectDir, manifestDir);
  return engine.writeManifest(projectDir, value, manifestDir);
}

export function removeManifest(projectDir, manifestDir) {
  guardManifestPath(projectDir, manifestDir);
  return engine.removeManifest(projectDir, manifestDir);
}

export function inspectTransaction(projectDir, manifestDir) {
  guardManifestPath(projectDir, manifestDir);
  return engine.inspectTransaction(projectDir, manifestDir);
}

export function describeRecovery(projectDir, manifestDir) {
  guardManifestPath(projectDir, manifestDir);
  return engine.describeRecovery(projectDir, manifestDir);
}

export function readJournaledEffects(projectDir, manifestDir) {
  guardManifestPath(projectDir, manifestDir);
  return engine.readJournaledEffects(projectDir, manifestDir);
}

export function assertNoIncompleteTransaction(projectDir, manifestDir) {
  guardManifestPath(projectDir, manifestDir);
  return engine.assertNoIncompleteTransaction(projectDir, manifestDir);
}

export function atomicWriteJsonNoFollow(basePath, relativePath, value) {
  if (process.platform === 'win32') {
    assertWindowsPathHasNoReparsePoints(basePath, relativePath);
  }
  return engine.atomicWriteJsonNoFollow(basePath, relativePath, value);
}

/**
 * Product wrapper around the upstream factory. Windows receives a reparse-point
 * preflight before the engine's path backend runs; other platforms receive the
 * upstream object unchanged.
 */
export function defineInstaller(options = {}) {
  const installer = engine.defineInstaller(options);
  if (process.platform !== 'win32') return installer;

  const { config = {}, providers = [] } = options;
  return {
    ...installer,
    install({ projectDir }) {
      const planContext = { basePath: projectDir, manifestDir: config.manifestDir };
      const planned = providers.flatMap((provider) => provider.plan(config, planContext));
      guardPaths(projectDir, config.manifestDir, planned);
      return installer.install({ projectDir });
    },
    uninstall({ projectDir }) {
      guardManifestPath(projectDir, config.manifestDir);
      const manifest = engine.readManifest(projectDir, config.manifestDir);
      guardPaths(projectDir, config.manifestDir, manifest == null ? [] : [manifest]);
      return installer.uninstall({ projectDir });
    },
  };
}
