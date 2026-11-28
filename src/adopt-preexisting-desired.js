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
/**
 * @param {Set<string>|string[]|null} knownPackageHashes
 * @returns {Set<string>}
 */
function normalizeKnownHashes(knownPackageHashes) {
  if (knownPackageHashes instanceof Set) return knownPackageHashes;
  return new Set(Array.isArray(knownPackageHashes) ? knownPackageHashes : []);
}

/**
 * @returns {{
 *   adopted: number,
 *   paths: string[],
 *   unresolved: number,
 *   unresolvedPaths: string[],
 *   excludeFromDesired: string[],
 * }}
 */
function emptyAdoptionResult() {
  return {
    adopted: 0, paths: [], unresolved: 0, unresolvedPaths: [], excludeFromDesired: [],
  };
}

/**
 * Build the owned set and reconcile beforeState from the journal without
 * mutating it yet.
 *
 * @param {string} projectDir
 * @returns {{
 *   manifest: object,
 *   effects: object[],
 *   index: number,
 *   beforeState: Array<{ path: string, installedHash?: string }>,
 *   owned: Set<string>,
 * }}
 */
function readAdoptionJournal(projectDir) {
  let manifest = readManifest(projectDir);
  if (manifest == null) {
    manifest = { journalVersion: 2, effects: [] };
  }
  const effects = Array.isArray(manifest.effects) ? [...manifest.effects] : [];
  const index = effects.findIndex((e) => e && e.type === 'reconcileFileSet');
  const beforeState = index >= 0
    ? [...(effects[index].beforeState || [])]
    : [];
  const owned = new Set(
    beforeState
      .filter((e) => e && typeof e.path === 'string')
      .map((e) => e.path),
  );
  return { manifest, effects, index, beforeState, owned };
}

/**
 * @param {string} projectDir
 * @param {string} relPath
 * @returns {{ abs: string, installedHash: string } | null}
 */
function readPreexistingFile(projectDir, relPath) {
  const abs = join(projectDir, relPath);
  if (!existsSync(abs)) return null;
  try {
    if (!statSync(abs).isFile()) return null;
    return { abs, installedHash: hashContent(readFileSync(abs, 'utf8')) };
  } catch {
    // Unreadable / raced — leave for reconciler (may still fail closed).
    return null;
  }
}

/**
 * @param {object} fields
 * @param {boolean} fields.forceAdopt
 * @param {(absPath: string) => boolean} fields.isArtifact
 * @param {Set<string>} fields.knownHashes
 * @param {string} fields.abs
 * @param {string} fields.installedHash
 * @returns {boolean}
 */
function isEligibleForAdoption(fields) {
  const { forceAdopt, isArtifact, knownHashes, abs, installedHash } = fields;
  return forceAdopt
    || (typeof isArtifact === 'function' && isArtifact(abs))
    || knownHashes.has(installedHash);
}

/**
 * Classify one desired path as adopted, unmanaged-desired, or skipped.
 *
 * @param {object} fields
 * @param {string} fields.projectDir
 * @param {string} fields.relPath
 * @param {string} fields.desiredContent
 * @param {ReturnType<typeof readAdoptionJournal>} fields.journal
 * @param {boolean} fields.forceAdopt
 * @param {(absPath: string) => boolean} fields.isArtifact
 * @param {Set<string>} fields.knownHashes
 * @returns {'adopted' | 'unresolved' | 'skipped'}
 */
function adoptDesiredPath(fields) {
  const { projectDir, relPath, desiredContent, journal, forceAdopt, isArtifact, knownHashes } = fields;
  if (journal.owned.has(relPath)) return 'skipped';

  const preexisting = readPreexistingFile(projectDir, relPath);
  if (!preexisting) return 'skipped';

  // Already matches package desired bytes: reconciler will track as
  // already-desired without needing a force rewrite claim.
  if (preexisting.installedHash === hashContent(desiredContent)) return 'skipped';

  const eligible = isEligibleForAdoption({
    forceAdopt,
    isArtifact,
    knownHashes,
    abs: preexisting.abs,
    installedHash: preexisting.installedHash,
  });

  if (!eligible) {
    // Unmanaged-desired: exclude from reconcile desired set; never own.
    return 'unresolved';
  }

  // Claim ownership at current hash so 3-hash policy rewrites to desired.
  journal.beforeState.push({ path: relPath, installedHash: preexisting.installedHash });
  journal.owned.add(relPath);
  return 'adopted';
}

/**
 * @param {string} projectDir
 * @param {ReturnType<typeof readAdoptionJournal>} journal
 */
function persistAdoptions(projectDir, journal) {
  const { manifest, effects, index, beforeState } = journal;
  const effect = index >= 0
    ? { ...effects[index], type: 'reconcileFileSet', beforeState }
    : { type: 'reconcileFileSet', beforeState };
  if (index >= 0) effects[index] = effect;
  else effects.push(effect);
  writeManifest(projectDir, { ...manifest, effects });
}

/**
 * @param {string} projectDir
 * @param {Array<{ path: string, content: string }>} desired
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
  const knownHashes = normalizeKnownHashes(knownPackageHashes);

  if (!Array.isArray(desired) || desired.length === 0) return emptyAdoptionResult();

  const desiredByPath = new Map(
    desired
      .filter((d) => d && typeof d.path === 'string')
      .map((d) => [d.path, d.content ?? '']),
  );

  const journal = readAdoptionJournal(projectDir);
  const adoptedPaths = [];
  const unresolvedPaths = [];

  for (const [relPath, desiredContent] of desiredByPath) {
    const outcome = adoptDesiredPath({
      projectDir,
      relPath,
      desiredContent,
      journal,
      forceAdopt,
      isArtifact,
      knownHashes,
    });
    if (outcome === 'adopted') adoptedPaths.push(relPath);
    else if (outcome === 'unresolved') unresolvedPaths.push(relPath);
  }

  if (adoptedPaths.length > 0) persistAdoptions(projectDir, journal);

  return {
    adopted: adoptedPaths.length,
    paths: adoptedPaths,
    unresolved: unresolvedPaths.length,
    unresolvedPaths,
    excludeFromDesired: [...unresolvedPaths],
  };
}
