import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hashContent } from './hash.js';
import { readManifest, writeManifest } from './manifest.js';

/**
 * Adopt pre-existing files that land on the *desired* install set into the
 * journal's reconcileFileSet beforeState so the kernel does not throw
 * GREENFIELD_CONFLICT on IDE expansion / partial journals.
 *
 * P1-A / F-004 policy (not unconditional clobber):
 *   Adopt (claim ownership + allow reconcile rewrite) ONLY when:
 *     1. `--force-adopt` / forceAdopt option is set, OR
 *     2. frontmatter matches the atomic-skills safelist (`isArtifact`), OR
 *     3. content hash is in knownPackageHashes (last-known package content).
 *   Paths whose disk bytes already match desired are left alone (reconciler
 *   treats them as already-desired without ownership claim for rewrite).
 *
 *   Else → **unmanaged-desired** disposition:
 *     - Exclude from the reconcile desired set (no GREENFIELD, no rewrite)
 *     - Do NOT enter manifest.files / ownership
 *     - Uninstall must never delete them (never owned)
 *     - Surface as unresolved/kept-local counts
 *
 * Pure greenfield (no disk file at desired path) is unchanged.
 *
 * @param {string} projectDir install base (HOME for user scope, repo for project)
 * @param {Array<{ path: string, content: string }>} desired file set
 * @param {object} [options]
 * @param {boolean} [options.forceAdopt=false] reclaim foreign content at desired paths
 * @param {(absPath: string) => boolean} [options.isArtifact] safelist frontmatter check
 * @param {Set<string>|string[]|null} [options.knownPackageHashes] prior package content hashes
 * @returns {{
 *   adopted: number,
 *   paths: string[],
 *   unresolved: number,
 *   unresolvedPaths: string[],
 *   excludeFromDesired: string[],
 * }}
 */
export function adoptPreexistingDesiredFiles(projectDir, desired, options = {}) {
  const {
    forceAdopt = false,
    isArtifact = () => false,
    knownPackageHashes = null,
  } = options;
  const knownHashes = knownPackageHashes instanceof Set
    ? knownPackageHashes
    : new Set(Array.isArray(knownPackageHashes) ? knownPackageHashes : []);

  if (!Array.isArray(desired) || desired.length === 0) {
    return {
      adopted: 0, paths: [], unresolved: 0, unresolvedPaths: [], excludeFromDesired: [],
    };
  }

  const desiredByPath = new Map(
    desired
      .filter((d) => d && typeof d.path === 'string')
      .map((d) => [d.path, d.content ?? '']),
  );

  // Build owned set from journal (if any) without mutating yet.
  let manifest = readManifest(projectDir);
  if (manifest == null) {
    manifest = { journalVersion: 2, effects: [] };
  }
  const effects = Array.isArray(manifest.effects) ? [...manifest.effects] : [];
  let idx = effects.findIndex((e) => e && e.type === 'reconcileFileSet');
  const beforeState = idx >= 0
    ? [...(effects[idx].beforeState || [])]
    : [];
  const owned = new Set(
    beforeState
      .filter((e) => e && typeof e.path === 'string')
      .map((e) => e.path),
  );

  const adoptedPaths = [];
  const unresolvedPaths = [];

  for (const [relPath, desiredContent] of desiredByPath) {
    if (owned.has(relPath)) continue;
    const abs = join(projectDir, relPath);
    if (!existsSync(abs)) continue;
    let installedHash;
    try {
      if (!statSync(abs).isFile()) continue;
      installedHash = hashContent(readFileSync(abs, 'utf8'));
    } catch {
      // Unreadable / raced — leave for reconciler (may still fail closed).
      continue;
    }

    const desiredHash = hashContent(desiredContent);
    // Already matches package desired bytes: reconciler will track as
    // already-desired without needing a force rewrite claim.
    if (installedHash === desiredHash) continue;

    const eligible = forceAdopt
      || (typeof isArtifact === 'function' && isArtifact(abs))
      || knownHashes.has(installedHash);

    if (eligible) {
      // Claim ownership at current hash so 3-hash policy rewrites to desired.
      beforeState.push({ path: relPath, installedHash });
      owned.add(relPath);
      adoptedPaths.push(relPath);
    } else {
      // Unmanaged-desired: exclude from reconcile desired set; never own.
      unresolvedPaths.push(relPath);
    }
  }

  if (adoptedPaths.length > 0) {
    const effect = idx >= 0
      ? { ...effects[idx], type: 'reconcileFileSet', beforeState }
      : { type: 'reconcileFileSet', beforeState };
    if (idx >= 0) effects[idx] = effect;
    else effects.push(effect);
    writeManifest(projectDir, { ...manifest, effects });
  }

  return {
    adopted: adoptedPaths.length,
    paths: adoptedPaths,
    unresolved: unresolvedPaths.length,
    unresolvedPaths,
    excludeFromDesired: [...unresolvedPaths],
  };
}
