/**
 * Install-ledger I/O for atomic-skills.
 *
 * Single API over the engine's atomic/no-follow writer (P1-C / F-006).
 * All install-ledger writes (adopt, installSkills patch, tests that touch
 * the journal) MUST go through `writeManifest` here — never plain
 * `writeFileSync` to `.atomic-skills/manifest.json`.
 *
 * MANIFEST_DIR is fixed to `.atomic-skills` (consumer override of the engine
 * default `.minimalist-installer`).
 */
import {
  readManifest as engineReadManifest,
  writeManifest as engineWriteManifest,
  removeManifest as engineRemoveManifest,
  MANIFEST_FILE as ENGINE_MANIFEST_FILE,
} from '@henryavila/minimalist-installer';

export const MANIFEST_DIR = '.atomic-skills';
export const MANIFEST_FILE = ENGINE_MANIFEST_FILE;

/**
 * @param {string} projectDir
 * @returns {object|null}
 */
export function readManifest(projectDir) {
  return engineReadManifest(projectDir, MANIFEST_DIR);
}

/**
 * Atomic same-dir temp+rename write; refuses leaf/intermediate symlinks
 * under projectDir (engine path-safety).
 *
 * @param {string} projectDir
 * @param {object} data
 */
export function writeManifest(projectDir, data) {
  return engineWriteManifest(projectDir, data, MANIFEST_DIR);
}

/**
 * @param {string} projectDir
 */
export function removeManifest(projectDir) {
  return engineRemoveManifest(projectDir, MANIFEST_DIR);
}
