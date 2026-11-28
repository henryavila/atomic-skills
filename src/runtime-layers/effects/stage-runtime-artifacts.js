import {
  readFileSync, readdirSync, statSync, existsSync, rmdirSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import {
  PathSafetyError,
  assertLexicalWithinBase,
  existsNoFollow,
  readFileNoFollow,
  writeFileNoFollow,
  unlinkNoFollow,
} from '@henryavila/minimalist-installer';

/**
 * Custom effect: `stageRuntimeArtifacts`.
 *
 * Stages runtime-layer artifacts (the aiDeck bin/dashboard/consumer/provisioner,
 * the auto-update hook script) under an install root, BINARY-SAFE (Buffer copy)
 * and MODE-AWARE (chmod for the executable hook). reconcileFileSet cannot do
 * either (it writes utf8 strings at 0o644), which is why the runtime layers
 * register this effect via defineInstaller({ effects }) instead of forcing the
 * file-set effect (P4 — the catalog stays closed; the consumer extends it
 * without reopening the kernel).
 *
 * P1-D / F-007: all mutations under basePath use engine no-follow helpers
 * (existsNoFollow / readFileNoFollow / writeFileNoFollow / unlinkNoFollow).
 * Leaf or intermediate symlinks refuse (PathSafetyError UNSAFE_PATH_RACE).
 *
 * Reversibility is the journal's: apply records which target paths it OWNS, and
 * revert removes exactly those — no proof-of-creation, no deletion (P3). A path is
 * owned when it did not exist before THIS apply OR it was already owned by the prior
 * install (carried forward via the Driver-threaded `previous` before-state). The
 * carry-forward is essential on the UPDATE path: a re-install re-stages a path that
 * a prior install created, so `existedBefore` is true, yet the path is still ours
 * and uninstall must still remove it — without threading `previous`, the latest
 * journal would record `created: []` and uninstall would leave the artifact behind
 * (F3 review CRITICAL A). A path that pre-existed the FIRST install and is NOT in
 * `previous.created` is a genuine user artifact and is never recorded (so revert
 * leaves it).
 *
 * apply args:
 *   { basePath, items: Array<Item>, previous?: { created: string[] } }
 * where Item is one of:
 *   { path, content, mode? }   — write string content to an owned target (optional chmod)
 *   { path, source, mode? }    — copy a single file to an owned target (binary-safe)
 *   { path, sourceTree }       — recursive tree copy from absolute `sourceTree` (owned targets only)
 * `path` is relative to basePath; before-state is { created: string[] }.
 */
/**
 * Does this apply own its target? A missing path, a path the prior install
 * created, and a path already holding the desired bytes are ours; anything else
 * is a user artifact.
 * @param {string} basePath
 * @param {object} item
 * @param {Set<string>} priorlyOwned
 * @returns {boolean}
 */
function ownsStageTarget(basePath, item, priorlyOwned) {
  let existedBefore = false;
  try {
    existedBefore = existsNoFollow(basePath, item.path);
  } catch (err) {
    if (err instanceof PathSafetyError) throw err;
    throw err;
  }

  if (!existedBefore || priorlyOwned.has(item.path) || 'sourceTree' in item) {
    return !existedBefore || priorlyOwned.has(item.path);
  }

  try {
    const current = readFileNoFollow(basePath, item.path, null);
    const desired = 'source' in item
      ? readFileSync(item.source)
      : Buffer.from(item.content);
    return Buffer.isBuffer(current)
      ? current.equals(desired)
      : Buffer.from(current).equals(desired);
  } catch (err) {
    if (err instanceof PathSafetyError) throw err;
    // Unreadable non-symlink — treat as non-matching.
    return false;
  }
}

/**
 * Write one staged item at its owned target.
 * @param {string} basePath
 * @param {object} item
 */
function stageRuntimeItem(basePath, item) {
  if ('sourceTree' in item) {
    // Remove prior owned tree entries leaf-first when we own the root.
    if (existsNoFollow(basePath, item.path)) {
      removeTreeNoFollow(basePath, item.path);
    }
    stageTreeNoFollow(basePath, item.path, item.sourceTree);
    return;
  }
  const data = 'source' in item
    ? readFileSync(item.source) // source is package asset (outside base)
    : item.content;
  // Mode is applied via writeFileNoFollow (O_CREAT + temp open) — no follow
  // chmodSync after write (TOCTOU if leaf replaced with symlink).
  writeFileNoFollow(basePath, item.path, data, {
    atomic: true,
    mode: item.mode != null ? item.mode : 0o644,
  });
}

/**
 * Remove one path recorded as created, leaf-first for directory trees.
 * @param {string} basePath
 * @param {string} relPath
 */
function revertStagedPath(basePath, relPath) {
  assertLexicalWithinBase(basePath, relPath);
  try {
    if (!existsNoFollow(basePath, relPath)) return;
  } catch (err) {
    if (err instanceof PathSafetyError) return; // symlink leaf — leave
    throw err;
  }
  // Directory trees (sourceTree) need recursive no-follow prune.
  const absPath = join(basePath, relPath);
  let isDir = false;
  try {
    isDir = statSync(absPath).isDirectory();
  } catch {
    isDir = false;
  }
  if (isDir) {
    removeTreeNoFollow(basePath, relPath);
  } else {
    try {
      unlinkNoFollow(basePath, relPath);
    } catch (err) {
      if (err instanceof PathSafetyError) return;
      throw err;
    }
  }
  pruneEmptyParentsLexical(basePath, relPath);
}

export const createStageRuntimeArtifactsEffect = () => ({
  type: 'stageRuntimeArtifacts',

  apply({ basePath, items = [], previous }) {
    const priorlyOwned = new Set(previous?.created ?? []);
    const created = [];
    for (const item of items) {
      assertLexicalWithinBase(basePath, item.path);
      if (!ownsStageTarget(basePath, item, priorlyOwned)) {
        throw new Error(`stageRuntimeArtifacts conflict: refusing to replace non-owned path "${item.path}"`);
      }
      stageRuntimeItem(basePath, item);
      created.push(item.path);
    }
    return { created };
  },

  revert({ basePath }, beforeState) {
    const created = beforeState?.created ?? [];
    for (const relPath of [...created].reverse()) {
      revertStagedPath(basePath, relPath);
    }
  },
});

/**
 * Best-effort empty-parent prune using lexical paths. Leaf mutations already
 * used no-follow; prune only removes empty dirs and stops at basePath.
 */
function pruneEmptyParentsLexical(basePath, relPath) {
  const base = resolve(basePath);
  let parent = dirname(resolve(join(basePath, relPath)));
  while (parent !== base && parent.startsWith(base + sep)) {
    try {
      if (readdirSync(parent).length === 0) {
        rmdirSync(parent);
        parent = dirname(parent);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}

/**
 * Recursively stage files from an absolute source tree into basePath/destRel
 * using writeFileNoFollow for every leaf.
 */
function stageTreeNoFollow(basePath, destRel, sourceTree) {
  const walk = (srcAbs, relUnderDest) => {
    const st = statSync(srcAbs);
    if (st.isDirectory()) {
      // Ensure parent dirs exist via write of a marker path's parents — mkdir under
      // base for the directory itself using path components (no-follow parents
      // are created by writeFileNoFollow's createParents).
      for (const name of readdirSync(srcAbs)) {
        walk(join(srcAbs, name), relUnderDest ? `${relUnderDest}/${name}` : name);
      }
      return;
    }
    if (!st.isFile()) return;
    const rel = relUnderDest ? `${destRel}/${relUnderDest}` : destRel;
    const data = readFileSync(srcAbs);
    writeFileNoFollow(basePath, rel, data, { atomic: true });
  };
  walk(sourceTree, '');
}

/**
 * Remove a file or directory tree under basePath without following symlinks.
 * For directories, walks children first; refuses symlink leaves via unlinkNoFollow.
 */
function removeTreeNoFollow(basePath, relPath) {
  assertLexicalWithinBase(basePath, relPath);
  const abs = join(basePath, relPath);
  if (!existsSync(abs)) return;
  let st;
  try {
    st = statSync(abs);
  } catch {
    return;
  }
  if (st.isDirectory()) {
    for (const name of readdirSync(abs)) {
      removeTreeNoFollow(basePath, `${relPath}/${name}`);
    }
    try {
      unlinkNoFollow(basePath, relPath); // rmdir path via engine when empty dir
    } catch {
      try { rmdirSync(abs); } catch { /* last resort ignore */ }
    }
  } else {
    try {
      unlinkNoFollow(basePath, relPath);
    } catch (err) {
      if (err instanceof PathSafetyError) throw err;
    }
  }
}

// Keep resolveWithinBase for tests/import compatibility if any external caller used it.
// Not used by apply/revert after P1-D.
export const resolveWithinBase = (basePath, path) => {
  const base = resolve(basePath);
  const absPath = resolve(join(basePath, path));
  if (absPath !== base && !absPath.startsWith(base + sep)) {
    throw new Error(`Refusing to operate outside basePath: "${path}"`);
  }
  return absPath;
};
