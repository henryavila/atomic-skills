import {
  existsSync, mkdirSync, writeFileSync, copyFileSync, cpSync, rmSync,
  unlinkSync, readdirSync, rmdirSync, statSync, chmodSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

/**
 * Custom effect: `stageRuntimeArtifacts`.
 *
 * Stages runtime-layer artifacts (the aiDeck bin/dashboard/consumer/provisioner,
 * the auto-update hook script) under an install root, BINARY-SAFE (cpSync /
 * copyFileSync — a web bundle may carry binary assets) and MODE-AWARE (chmod for
 * the executable hook). reconcileFileSet cannot do either (it writes utf8 strings
 * at 0o644), which is why the runtime layers register this effect via
 * defineInstaller({ effects }) instead of forcing the file-set effect (P4 — the
 * catalog stays closed; the consumer extends it without reopening the kernel).
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
 *   { path, sourceTree }       — cpSync a whole tree from absolute `sourceTree` (owned targets only)
 * `path` is relative to basePath; before-state is { created: string[] }.
 */
export const createStageRuntimeArtifactsEffect = () => ({
  type: 'stageRuntimeArtifacts',

  apply({ basePath, items = [], previous }) {
    const priorlyOwned = new Set(previous?.created ?? []);
    const created = [];
    for (const item of items) {
      const absPath = resolveWithinBase(basePath, item.path);
      const existedBefore = existsSync(absPath);
      const ownsTarget = !existedBefore || priorlyOwned.has(item.path);

      if (!ownsTarget) {
        throw new Error(`stageRuntimeArtifacts conflict: refusing to replace non-owned path "${item.path}"`);
      }

      if ('sourceTree' in item) {
        if (existedBefore) rmSync(absPath, { recursive: true, force: true });
        mkdirSync(dirname(absPath), { recursive: true });
        cpSync(item.sourceTree, absPath, { recursive: true });
      } else if ('source' in item) {
        mkdirSync(dirname(absPath), { recursive: true });
        copyFileSync(item.source, absPath);
        if (item.mode != null) chmodSync(absPath, item.mode);
      } else {
        mkdirSync(dirname(absPath), { recursive: true });
        writeFileSync(absPath, item.content);
        if (item.mode != null) chmodSync(absPath, item.mode);
      }

      // Own the path if we created it now, or if a prior install already owned it
      // (the UPDATE case: existedBefore is true but the artifact is still ours).
      if (ownsTarget) created.push(item.path);
    }
    return { created };
  },

  revert({ basePath }, beforeState) {
    const created = beforeState?.created ?? [];
    for (const relPath of [...created].reverse()) {
      const absPath = resolveWithinBase(basePath, relPath);
      if (!existsSync(absPath)) continue;
      if (statSync(absPath).isDirectory()) {
        rmSync(absPath, { recursive: true, force: true });
      } else {
        unlinkSync(absPath);
      }
      pruneEmptyParents(absPath, basePath);
    }
  },
});

const resolveWithinBase = (basePath, path) => {
  const base = resolve(basePath);
  const absPath = resolve(join(basePath, path));
  if (absPath !== base && !absPath.startsWith(base + sep)) {
    throw new Error(`Refusing to operate outside basePath: "${path}"`);
  }
  return absPath;
};

const pruneEmptyParents = (absPath, basePath) => {
  const base = resolve(basePath);
  let parent = dirname(resolve(absPath));
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
};
