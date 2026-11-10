/**
 * IDE install roots that are symlinks (for example ~/.grok -> an external
 * volume) are not written through. The engine refuses every symlink component
 * (UNSAFE_PATH_RACE). For a direct child of the install base whose name is an
 * IDE root, read the link once and run that effect against the final directory.
 *
 * Only that one component is resolved. A symlink nested under the target, or a
 * symlink leaf, still refuses. Non-IDE directories (including .atomic-skills)
 * are never resolved.
 */

import { lstatSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { IDE_CONFIG } from './config.js';

/**
 * Top directory of each IDE tree, relative to the install base.
 * @returns {string[]}
 */
export function ideRootNames() {
  const names = new Set();
  for (const ide of Object.values(IDE_CONFIG)) {
    const top = String(ide?.dir || '').replace(/\\/g, '/').split('/').filter(Boolean)[0];
    if (top) names.add(top);
  }
  return [...names];
}

/**
 * IDE roots under basePath that are symlinks to a real directory.
 * Only names in `onlyNames` are inspected. A dangling link or a link whose
 * final target is not a directory is skipped — it must not abort an install
 * that does not write through that root.
 * @param {string} basePath
 * @param {{ onlyNames?: Set<string> }} [opts]
 * @returns {Map<string, string>} root name -> absolute final directory
 */
export function readIdeSymlinkRoots(basePath, opts = {}) {
  const only = opts.onlyNames instanceof Set ? opts.onlyNames : null;
  const map = new Map();
  for (const name of ideRootNames()) {
    if (only && !only.has(name)) continue;
    const linkPath = join(basePath, name);
    let st;
    try {
      st = lstatSync(linkPath);
    } catch (err) {
      if (err?.code === 'ENOENT') continue;
      throw err;
    }
    if (!st.isSymbolicLink()) continue;

    let real;
    try {
      real = realpathSync(linkPath);
    } catch {
      continue;
    }
    let realSt;
    try {
      realSt = statSync(real);
    } catch {
      continue;
    }
    if (!realSt.isDirectory()) continue;
    map.set(name, real);
  }
  return map;
}

/**
 * @param {Array<string|undefined|null>} paths
 * @returns {Set<string>}
 */
export function ideRootNamesInPaths(paths) {
  const known = new Set(ideRootNames());
  const found = new Set();
  for (const logicalPath of paths) {
    if (typeof logicalPath !== 'string' || logicalPath.length === 0) continue;
    const top = logicalPath.replace(/\\/g, '/').split('/').filter(Boolean)[0];
    if (top && known.has(top)) found.add(top);
  }
  return found;
}

/**
 * @param {string} logicalPath path relative to the install base
 * @param {Map<string, string>} roots
 * @returns {{ rootName: string, realBase: string, innerPath: string, logicalPath: string } | null}
 */
export function relocateLogicalPath(logicalPath, roots) {
  if (typeof logicalPath !== 'string' || logicalPath.length === 0) return null;
  const norm = logicalPath.replace(/\\/g, '/');
  if (norm.startsWith('/') || norm.split('/').includes('..')) return null;
  const slash = norm.indexOf('/');
  if (slash <= 0) return null;
  const rootName = norm.slice(0, slash);
  const realBase = roots.get(rootName);
  if (!realBase) return null;
  const innerPath = norm.slice(slash + 1);
  if (!innerPath) return null;
  return { rootName, realBase, innerPath, logicalPath: norm };
}

function innerFromLogical(logicalPath) {
  const norm = String(logicalPath || '').replace(/\\/g, '/');
  const slash = norm.indexOf('/');
  return slash > 0 ? norm.slice(slash + 1) : norm;
}

function applyReconcile(originalApply, originalRevert, args) {
  const { basePath, desired = [], previous = [] } = args;
  const onlyNames = ideRootNamesInPaths([
    ...desired.map((file) => file && file.path),
    ...previous.map((row) => row && row.path),
  ]);
  const roots = readIdeSymlinkRoots(basePath, { onlyNames });
  const orphans = new Map();
  const queueOrphan = (realBase, inner, installedHash) => {
    if (!realBase || !inner) return;
    let rows = orphans.get(realBase);
    if (!rows) {
      rows = [];
      orphans.set(realBase, rows);
    }
    rows.push({ path: inner, installedHash });
  };
  if (roots.size === 0 && ![...previous].some((row) => row && typeof row.resolvedBase === 'string')) {
    return originalApply(args);
  }

  const normalDesired = [];
  const normalPrevious = [];
  /** @type {Map<string, { realBase: string, desired: object[], previous: object[], logicalByInner: Map<string, string> }>} */
  const groups = new Map();

  const groupFor = (loc) => {
    let group = groups.get(loc.rootName);
    if (!group) {
      group = {
        realBase: loc.realBase,
        desired: [],
        previous: [],
        logicalByInner: new Map(),
      };
      groups.set(loc.rootName, group);
    }
    return group;
  };

  for (const file of desired) {
    const loc = file && relocateLogicalPath(file.path, roots);
    if (!loc) {
      normalDesired.push(file);
      continue;
    }
    const group = groupFor(loc);
    group.desired.push({ path: loc.innerPath, content: file.content });
    group.logicalByInner.set(loc.innerPath, loc.logicalPath);
  }

  for (const row of previous) {
    if (!row || typeof row.path !== 'string') {
      normalPrevious.push(row);
      continue;
    }
    const loc = relocateLogicalPath(row.path, roots);
    if (!loc) {
      const stored = typeof row.resolvedBase === 'string' ? row.resolvedBase : null;
      const top = row.path.replace(/\\/g, '/').split('/').filter(Boolean)[0];
      let now = null;
      if (top) {
        try {
          const st = lstatSync(join(basePath, top));
          if (!st.isSymbolicLink() && st.isDirectory()) now = realpathSync(join(basePath, top));
        } catch {
          now = null;
        }
      }
      if (stored && stored !== now) {
        queueOrphan(stored, innerFromLogical(row.path), row.installedHash);
        continue;
      }
      normalPrevious.push(row);
      continue;
    }
    if (typeof row.resolvedBase === 'string' && row.resolvedBase !== loc.realBase) {
      queueOrphan(row.resolvedBase, innerFromLogical(row.path), row.installedHash);
      continue;
    }
    const group = groupFor(loc);
    group.previous.push({ path: loc.innerPath, installedHash: row.installedHash });
    if (!group.logicalByInner.has(loc.innerPath)) {
      group.logicalByInner.set(loc.innerPath, loc.logicalPath);
    }
  }

  const out = [];
  if (normalDesired.length > 0 || normalPrevious.length > 0) {
    out.push(...originalApply({
      ...args,
      desired: normalDesired,
      previous: normalPrevious,
    }));
  }

  for (const group of groups.values()) {
    const part = originalApply({
      basePath: group.realBase,
      desired: group.desired,
      previous: group.previous,
    });
    for (const row of part) {
      const logical = group.logicalByInner.get(row.path);
      if (!logical) {
        throw new Error(`relocated reconcile lost logical path for "${row.path}"`);
      }
      out.push({ ...row, path: logical, resolvedBase: group.realBase });
    }
  }
  for (const [realBase, rows] of orphans) {
    originalRevert({ basePath: realBase }, rows);
  }
  return out;
}

function revertReconcile(originalRevert, ctx, beforeState) {
  const rows = Array.isArray(beforeState) ? beforeState : [];
  const roots = readIdeSymlinkRoots(ctx.basePath, {
    onlyNames: ideRootNamesInPaths(rows.map((row) => row && row.path)),
  });
  const normal = [];
  /** @type {Map<string, object[]>} */
  const groups = new Map();

  for (const row of rows) {
    if (!row || typeof row.path !== 'string') {
      normal.push(row);
      continue;
    }
    const live = relocateLogicalPath(row.path, roots);
    const stored = typeof row.resolvedBase === 'string' ? row.resolvedBase : null;
    const liveReal = live?.realBase;
    const realBase = (typeof stored === 'string' && stored.length > 0 && (!liveReal || liveReal !== stored))
      ? stored
      : (liveReal || null);
    if (!realBase) {
      normal.push(row);
      continue;
    }
    const inner = (live && realBase === live.realBase)
      ? live.innerPath
      : innerFromLogical(row.path);
    let part = groups.get(realBase);
    if (!part) {
      part = [];
      groups.set(realBase, part);
    }
    part.push({ path: inner, installedHash: row.installedHash });
  }

  if (normal.length > 0) originalRevert(ctx, normal);
  for (const [realBase, part] of groups) {
    originalRevert({ ...ctx, basePath: realBase }, part);
  }
}

function applyJsonMerge(originalApply, originalRevert, args) {
  const roots = readIdeSymlinkRoots(args.basePath, {
    onlyNames: ideRootNamesInPaths([args.path, args.previous && args.previous.path]),
  });
  const loc = relocateLogicalPath(args.path, roots);
  const stored = typeof args.previous?.resolvedBase === 'string' ? args.previous.resolvedBase : null;
  // A different final directory than the one journaled last time. Clean the old
  // tree only after the new apply succeeds, so a refused write leaves it in place.
  const moved = Boolean(stored && (!loc || loc.realBase !== stored));

  let result;
  if (!loc) {
    result = originalApply({
      ...args,
      previous: moved ? undefined : args.previous,
    });
  } else {
    const sameTree = !stored || stored === loc.realBase;
    const previous = args.previous && sameTree
      ? { ...args.previous, path: loc.innerPath }
      : undefined;
    const applied = originalApply({
      ...args,
      basePath: loc.realBase,
      path: loc.innerPath,
      previous,
    });
    result = { ...applied, path: loc.logicalPath, resolvedBase: loc.realBase };
  }

  if (moved) {
    originalRevert(
      { basePath: stored },
      { ...args.previous, path: innerFromLogical(args.previous.path || args.path) },
    );
  }
  return result;
}

function revertJsonMerge(originalRevert, ctx, beforeState) {
  if (!beforeState || typeof beforeState.path !== 'string') {
    return originalRevert(ctx, beforeState);
  }
  const roots = readIdeSymlinkRoots(ctx.basePath, {
    onlyNames: ideRootNamesInPaths([beforeState.path]),
  });
  const live = relocateLogicalPath(beforeState.path, roots);
  const stored = typeof beforeState.resolvedBase === 'string' ? beforeState.resolvedBase : null;
  const liveReal = live?.realBase;
  const realBase = (typeof stored === 'string' && stored.length > 0 && (!liveReal || liveReal !== stored))
    ? stored
    : (liveReal || null);
  if (!realBase) return originalRevert(ctx, beforeState);
  const inner = (live && realBase === live.realBase)
    ? live.innerPath
    : innerFromLogical(beforeState.path);
  return originalRevert(
    { ...ctx, basePath: realBase },
    { ...beforeState, path: inner },
  );
}

/**
 * Mutate reconcileFileSet and jsonMerge on this installer registry so IDE-root
 * symlinks are installed at their final directory. Same journal paths as a
 * real directory (`.grok/...`), so status and uninstall stay on the logical path.
 * @param {{ get: (type: string) => { apply?: Function, revert?: Function } | undefined }} registry
 */
export function wrapInstallerRegistryForIdeSymlinks(registry) {
  const reconcile = registry.get('reconcileFileSet');
  if (reconcile && !reconcile.ideSymlinkWrapped) {
    const originalApply = reconcile.apply.bind(reconcile);
    const originalRevert = reconcile.revert.bind(reconcile);
    reconcile.apply = (args) => applyReconcile(originalApply, originalRevert, args);
    reconcile.revert = (ctx, beforeState) => revertReconcile(originalRevert, ctx, beforeState);
    reconcile.ideSymlinkWrapped = true;
  }

  const jsonMerge = registry.get('jsonMerge');
  if (jsonMerge && !jsonMerge.ideSymlinkWrapped) {
    const originalApply = jsonMerge.apply.bind(jsonMerge);
    const originalRevert = jsonMerge.revert.bind(jsonMerge);
    jsonMerge.apply = (args) => applyJsonMerge(originalApply, originalRevert, args);
    jsonMerge.revert = (ctx, beforeState) => revertJsonMerge(originalRevert, ctx, beforeState);
    jsonMerge.ideSymlinkWrapped = true;
  }
}
