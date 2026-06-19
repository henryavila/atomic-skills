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
 * Reversibility is the journal's: apply records which target paths it CREATED
 * (those that did not exist before), and revert removes exactly those — no
 * proof-of-creation, no deletion (P3). Pre-existing artifacts (e.g. staged by an
 * earlier install) are clobbered in place but NOT recorded as created, so revert
 * leaves them.
 *
 * apply args:
 *   { basePath, items: Array<Item> }
 * where Item is one of:
 *   { path, content, mode? }   — write string content (optional chmod)
 *   { path, source, mode? }    — copy a single file from absolute `source` (binary-safe)
 *   { path, sourceTree }       — cpSync a whole tree from absolute `sourceTree` (clobbers)
 * `path` is relative to basePath; before-state is { created: string[] }.
 */
export const createStageRuntimeArtifactsEffect = () => ({
  type: 'stageRuntimeArtifacts',

  apply({ basePath, items = [] }) {
    const created = [];
    for (const item of items) {
      const absPath = resolveWithinBase(basePath, item.path);
      const existedBefore = existsSync(absPath);

      if ('sourceTree' in item) {
        if (existsSync(absPath)) rmSync(absPath, { recursive: true, force: true });
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

      if (!existedBefore) created.push(item.path);
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
