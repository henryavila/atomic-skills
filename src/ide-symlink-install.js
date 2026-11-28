/**
 * IDE install roots that are symlinks (for example ~/.grok -> an external
 * volume) are not written through. The engine refuses every symlink component
 * (UNSAFE_PATH_RACE). For a direct child of the install base whose name is an
 * IDE root, read the link once and run that effect against the final directory.
 *
 * Only that one component is resolved. A symlink nested under the target, or a
 * symlink leaf, still refuses. Non-IDE directories (including .atomic-skills)
 * are never resolved by those effects. Global instruction text blocks alone
 * also resolve parent and leaf links, then use the same no-follow engine.
 */

import { lstatSync, realpathSync, statSync } from 'node:fs';
import { join, dirname, isAbsolute, relative } from 'node:path';
import { assertLexicalWithinBase, readFileNoFollow } from '@henryavila/minimalist-installer';
import { prepareTextBlockPlan } from './installer-driver.js';
import { IDE_CONFIG } from './config.js';
import { msg } from './ui.js';
import { GLOBAL_INSTRUCTION_PATHS } from './global-instruction-paths.js';

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

/**
 * @param {Map<string, object[]>} orphans
 * @param {string|null|undefined} realBase
 * @param {string} inner
 * @param {string|undefined} installedHash
 */
function queueOrphan(orphans, realBase, inner, installedHash) {
  if (!realBase || !inner) return;
  let rows = orphans.get(realBase);
  if (!rows) {
    rows = [];
    orphans.set(realBase, rows);
  }
  rows.push({ path: inner, installedHash });
}

/**
 * @param {Map<string, { realBase: string, desired: object[], previous: object[], logicalByInner: Map<string, string> }>} groups
 * @param {{ rootName: string, realBase: string }} loc
 */
function groupFor(groups, loc) {
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
}

/**
 * Split desired files between the normal tree and each relocated IDE root.
 * @param {object[]} desired
 * @param {Map<string, string>} roots
 * @param {object[]} normalDesired
 * @param {Map<string, object>} groups
 */
function collectDesiredFiles(desired, roots, normalDesired, groups) {
  for (const file of desired) {
    const loc = file && relocateLogicalPath(file.path, roots);
    if (!loc) {
      normalDesired.push(file);
      continue;
    }
    const group = groupFor(groups, loc);
    group.desired.push({ path: loc.innerPath, content: file.content });
    group.logicalByInner.set(loc.innerPath, loc.logicalPath);
  }
}

/**
 * The real directory a logical root occupies now, or null when it is absent or
 * is still a symlink (the journaled target moved).
 * @param {string} basePath
 * @param {string} logicalPath
 * @returns {string|null}
 */
function currentRealBase(basePath, logicalPath) {
  const top = logicalPath.replace(/\\/g, '/').split('/').filter(Boolean)[0];
  if (!top) return null;
  try {
    const st = lstatSync(join(basePath, top));
    if (!st.isSymbolicLink() && st.isDirectory()) return realpathSync(join(basePath, top));
  } catch {
    return null;
  }
  return null;
}

/**
 * Split prior rows between the normal tree, relocation groups and orphaned
 * real directories that need an explicit revert.
 * @param {string} basePath
 * @param {object[]} previous
 * @param {Map<string, string>} roots
 * @param {{ normalPrevious: object[], groups: Map<string, object>, orphans: Map<string, object[]> }} state
 */
function collectPreviousRows(basePath, previous, roots, state) {
  const { normalPrevious, groups, orphans } = state;
  for (const row of previous) {
    if (!row || typeof row.path !== 'string') {
      normalPrevious.push(row);
      continue;
    }
    const loc = relocateLogicalPath(row.path, roots);
    if (!loc) {
      const stored = typeof row.resolvedBase === 'string' ? row.resolvedBase : null;
      const now = currentRealBase(basePath, row.path);
      if (stored && stored !== now) {
        queueOrphan(orphans, stored, innerFromLogical(row.path), row.installedHash);
        continue;
      }
      normalPrevious.push(row);
      continue;
    }
    if (typeof row.resolvedBase === 'string' && row.resolvedBase !== loc.realBase) {
      queueOrphan(orphans, row.resolvedBase, innerFromLogical(row.path), row.installedHash);
      continue;
    }
    const group = groupFor(groups, loc);
    group.previous.push({ path: loc.innerPath, installedHash: row.installedHash });
    if (!group.logicalByInner.has(loc.innerPath)) {
      group.logicalByInner.set(loc.innerPath, loc.logicalPath);
    }
  }
}

/**
 * Apply each relocated group and map its rows back to logical journal paths.
 * @param {Function} originalApply
 * @param {Map<string, object>} groups
 * @param {object[]} out
 */
function applyRelocatedGroups(originalApply, groups, out) {
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
}

function applyReconcile(originalApply, originalRevert, args) {
  const { basePath, desired = [], previous = [] } = args;
  const onlyNames = ideRootNamesInPaths([
    ...desired.map((file) => file && file.path),
    ...previous.map((row) => row && row.path),
  ]);
  const roots = readIdeSymlinkRoots(basePath, { onlyNames });
  if (roots.size === 0 && ![...previous].some((row) => row && typeof row.resolvedBase === 'string')) {
    return originalApply(args);
  }

  const normalDesired = [];
  /** @type {Map<string, { realBase: string, desired: object[], previous: object[], logicalByInner: Map<string, string> }>} */
  const groups = new Map();
  const orphans = new Map();
  const normalPrevious = [];
  collectDesiredFiles(desired, roots, normalDesired, groups);
  collectPreviousRows(basePath, previous, roots, { normalPrevious, groups, orphans });

  const out = [];
  if (normalDesired.length > 0 || normalPrevious.length > 0) {
    out.push(...originalApply({
      ...args,
      desired: normalDesired,
      previous: normalPrevious,
    }));
  }
  applyRelocatedGroups(originalApply, groups, out);
  for (const [realBase, rows] of orphans) {
    originalRevert({ basePath: realBase }, rows);
  }
  return out;
}

/**
 * Resolve one journaled row to the real base to revert and the inner path there.
 * @param {string} basePath
 * @param {object} row
 * @param {Map<string, string>} roots
 * @returns {{ realBase: string, inner: string } | null}
 */
function resolveRevertTarget(basePath, row, roots) {
  const live = relocateLogicalPath(row.path, roots);
  const stored = typeof row.resolvedBase === 'string' ? row.resolvedBase : null;
  const liveReal = live?.realBase;
  const realBase = (typeof stored === 'string' && stored.length > 0 && (!liveReal || liveReal !== stored))
    ? stored
    : (liveReal || null);
  if (!realBase) return null;
  const inner = (live && realBase === live.realBase)
    ? live.innerPath
    : innerFromLogical(row.path);
  return { realBase, inner };
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
    const target = (row && typeof row.path === 'string')
      ? resolveRevertTarget(ctx.basePath, row, roots)
      : null;
    if (!target) {
      normal.push(row);
      continue;
    }
    const part = groups.get(target.realBase);
    const entry = { path: target.inner, installedHash: row.installedHash };
    if (part) part.push(entry);
    else groups.set(target.realBase, [entry]);
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

// Only global instruction files opt into resolving every directory component
// and the leaf. Other text blocks retain the engine's strict no-follow rule.
// Derived lazily because the provider and resolver share this module boundary.
const instructionAgents = () => new Map(Object.entries(GLOBAL_INSTRUCTION_PATHS)
  .filter(([, path]) => path).map(([agent, path]) => [path, agent]));
const isInstructionBlock = (state) => instructionAgents().has(state.path)
  && state.id === `global-instructions:${instructionAgents().get(state.path)}`;

export function resolveInstructionPath(basePath, path) {
  assertLexicalWithinBase(basePath, path);
  if (!instructionAgents().has(path)) return { basePath, path };
  let current = basePath;
  let resolvedBase;
  const parts = path.split('/');
  try {
    for (let i = 0; i < parts.length; i++) {
      current = join(current, parts[i]);
      let st;
      try { st = lstatSync(current); }
      catch (err) { if (err.code === 'ENOENT') continue; throw err; }
      if (st.isSymbolicLink()) {
        current = realpathSync(current); // dangling links and loops refuse
        st = statSync(current);
        resolvedBase = i < parts.length - 1 ? current : dirname(current);
      }
      if (i < parts.length - 1 ? !st.isDirectory() : !st.isFile()) {
        throw Object.assign(new Error(`Expected ${i < parts.length - 1 ? 'directory' : 'regular file'} at ${current}`),
          { code: 'GLOBAL_INSTRUCTIONS_REFUSED' });
      }
    }
    return resolvedBase ? { basePath: resolvedBase, path: relative(resolvedBase, current).replace(/\\/g, '/') } : { basePath, path };
  } catch (err) {
    err.globalInstructionPath = path;
    throw err;
  }
}

/**
 * realpath when the path exists; keep the input when it is absent.
 * @param {string} path
 * @returns {string}
 */
function canonicalizeIfExists(path) {
  try {
    return realpathSync(path);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return path;
  }
}

/**
 * True when the live file still carries the exact block this journal entry wrote.
 * @param {{ basePath: string, path: string }} live
 * @param {{ inserted: string, prefix?: string }} state
 * @returns {boolean}
 */
function carriesOwnedBlock(live, state) {
  const bytes = readFileNoFollow(live.basePath, live.path, null);
  const segment = Buffer.from(state.inserted, 'base64').subarray(Buffer.byteLength(state.prefix ?? ''));
  const start = bytes.indexOf(segment);
  return start >= 0 && (start === 0 || bytes[start - 1] === 10);
}

/**
 * @param {object} state
 * @param {string} stored
 * @returns {Error & { globalInstructionPath?: string, code?: string }}
 */
function destinationChangedError(state, stored) {
  /** @type {Error & { globalInstructionPath?: string, code?: string }} */
  const err = new Error(`Destination changed for "${state.path}"; journaled file ${stored}`);
  err.globalInstructionPath = state.path;
  err.code = 'GLOBAL_INSTRUCTIONS_REFUSED';
  return err;
}

export function instructionLocation(basePath, state) {
  // Resolve both the journal and live path at comparison time. Moving the
  // same file behind a link does not revoke its journaled block ownership.
  const storedBase = state.resolvedBase ?? basePath;
  const storedPath = state.resolvedPath ?? state.path;
  const stored = join(storedBase, storedPath);
  let live;
  try { live = resolveInstructionPath(basePath, state.path); }
  catch (err) {
    err.message = `${err.message}; journaled file ${stored}`;
    throw err;
  }
  const canonicalStored = canonicalizeIfExists(stored);
  const livePath = canonicalizeIfExists(join(live.basePath, live.path));
  // A move can remove the old physical path entirely. The exact journaled
  // block at the live destination still proves ownership; a foreign file does not.
  const relocated = join(live.basePath, live.path) !== stored;
  const changed = canonicalStored !== livePath || relocated;
  const proven = changed && state.inserted !== undefined && carriesOwnedBlock(live, state);
  if (!isAbsolute(storedBase) || (changed && !proven)) {
    throw destinationChangedError(state, stored);
  }
  return live;
}

function prepareInstructionPlan(entries, states, basePath) {
  const ordinary = prepareTextBlockPlan(entries.filter((args) => !isInstructionBlock(args)),
    states.filter((state) => !isInstructionBlock(state)), basePath);
  entries = entries.filter(isInstructionBlock);
  states = states.filter(isInstructionBlock);
  const logicalByState = new Map();
  const parked = [];
  const relocatedStates = states.flatMap((state) => {
    let loc;
    try { loc = instructionLocation(basePath, state); }
    catch { parked.push(state); return []; }
    const relocated = { ...state, path: loc.path };
    logicalByState.set(relocated, state);
    return [relocated];
  });
  const relocatedEntries = entries.map((args) => {
    const refused = parked.find((state) => state.id === args.id);
    if (refused) instructionLocation(basePath, refused); // changed during preflight: abort before mutations
    const loc = resolveInstructionPath(args.basePath, args.path);
    return { ...args, ...loc,
      previous: relocatedStates.find((state) => logicalByState.get(state) === args.previous),
      logicalPath: args.path,
    };
  });
  // The upstream planner reads omitted states relative to basePath. Validate
  // each global file independently, with its own physical directory, including
  // removals. There is exactly one global block per supported file.
  const result = { entries: [...ordinary.entries], removals: [...ordinary.removals], parked };
  const handled = new Set();
  for (const args of relocatedEntries) {
    const prior = relocatedStates.filter((state) => logicalByState.get(state).path === args.logicalPath);
    prior.forEach((state) => handled.add(state));
    const prepared = prepareTextBlockPlan([args], prior, args.basePath);
    result.entries.push(...prepared.entries.map((entry) => ({ ...entry,
      basePath, path: args.logicalPath, resolvedBase: args.basePath, resolvedPath: args.path,
      previous: entry.previous && { ...entry.previous, path: args.logicalPath },
    })));
    result.removals.push(...prepared.removals.map((state) => logicalByState.get(state)));
  }
  for (const state of relocatedStates.filter((state) => !handled.has(state))) {
    const logical = logicalByState.get(state);
    try {
      const loc = instructionLocation(basePath, logical);
      prepareTextBlockPlan([], [state], loc.basePath);
      result.removals.push(logical);
    } catch (err) {
      // The provider already reported this owned destination's I/O refusal.
      // Keep its ownership while other agents install. Malformed markers still
      // block preflight with the existing recovery guidance.
      if (!err.code) throw err;
      parked.push(logical);
    }
  }
  return result;
}

function wrapTextBlock(registry) {
  const effect = registry.get('textBlock');
  if (!effect || effect.ideSymlinkWrapped) return;
  const apply = effect.apply.bind(effect);
  const revert = effect.revert.bind(effect);
  effect.preparePlan = prepareInstructionPlan;
  effect.apply = (args) => {
    if (!isInstructionBlock(args)) return apply(args);
    const loc = resolveInstructionPath(args.basePath, args.path);
    if (args.resolvedBase && (loc.basePath !== args.resolvedBase || loc.path !== args.resolvedPath)) {
      throw new Error(`Destination changed for "${args.path}" before apply`);
    }
    const state = apply({ ...args, ...loc,
      previous: args.previous && { ...args.previous, path: loc.path },
    });
    return { ...state, path: args.path, resolvedBase: loc.basePath, resolvedPath: loc.path };
  };
  effect.revert = (ctx, state) => {
    if (!isInstructionBlock(state)) return revert(ctx, state);
    let loc;
    try { loc = instructionLocation(ctx.basePath, state); }
    catch (err) {
      if (!['GLOBAL_INSTRUCTIONS_REFUSED', 'ENOENT', 'ELOOP', 'ENOTDIR'].includes(err.code)) throw err;
      console.log(`  ${msg(ctx.language).globalInstructionsRefused(state.path, err.message)}`);
      return;
    }
    // I/O failures must propagate: the driver must retain the journal for retry.
    return revert({ ...ctx, basePath: loc.basePath }, { ...state, path: loc.path });
  };
  effect.ideSymlinkWrapped = true;
}

/**
 * Mutate reconcileFileSet, jsonMerge and global instruction textBlock on this installer registry so IDE-root
 * symlinks are installed at their final directory. Same journal paths as a
 * real directory (`.grok/...`), so status and uninstall stay on the logical path.
 * @param {{ get: (type: string) => { apply?: Function, revert?: Function, ideSymlinkWrapped?: boolean, preparePlan?: Function } | undefined }} registry
 */
export function wrapInstallerRegistryForIdeSymlinks(registry) {
  wrapTextBlock(registry);
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
