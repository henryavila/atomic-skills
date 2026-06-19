import { readManifest, writeManifest } from '@henryavila/tooling-installer';

// T-F3-6 — migrate a pre-kernel (legacy) install into journal ownership records.
//
// A legacy manifest is `{ files: { <relPath>: { installed_hash, source } }, ... }`
// with NO `effects` key. The new journal-based uninstall (the package Driver's
// replayReverse) only reverts entries recorded in `effects`, so a legacy install
// would be un-reversible by the new engine — the codex F-002 critical gap this
// task closes.
//
// Migration adopts each file entry whose `installed_hash` is a verifiable
// before-state into ONE `reconcileFileSet` effect: `installedHash` is the proof
// of ownership the effect's revert checks against the disk before deleting, so a
// file the user edited since install survives uninstall (P3 — no proof-less
// deletion of user content). Entries WITHOUT a verifiable before-state are
// recorded in `unmanaged` and never enter an effect, so the uninstall can never
// remove them ("sem prova de propriedade, não apaga").

const isVerifiableHash = (value) => typeof value === 'string' && value.length > 0;

const isJournalManifest = (manifest) =>
  manifest != null && Object.prototype.hasOwnProperty.call(manifest, 'effects');

/**
 * Pure transform: a legacy manifest object → a journal-shaped manifest object.
 * Idempotent — an already-journal manifest (has `effects`) is returned unchanged.
 *
 * @param {object|null} manifest
 * @returns {object|null}
 */
export function migrateLegacyManifest(manifest) {
  if (manifest == null) return manifest;
  if (isJournalManifest(manifest)) return manifest;

  const files = manifest.files ?? {};
  const adopted = [];
  const unmanaged = [];

  for (const path of Object.keys(files).sort()) {
    const entry = files[path] ?? {};
    if (isVerifiableHash(entry.installed_hash)) {
      adopted.push({ path, installedHash: entry.installed_hash });
    } else {
      unmanaged.push(path);
    }
  }

  const effects = adopted.length
    ? [{ type: 'reconcileFileSet', beforeState: adopted }]
    : [];

  // Carry every key forward except the legacy `files` map (superseded by effects).
  const rest = Object.fromEntries(
    Object.entries(manifest).filter(([key]) => key !== 'files'),
  );

  return { ...rest, effects, unmanaged, legacyMigrated: true };
}

/**
 * Operational entry: read the on-disk manifest, migrate it, and write it back so
 * the journal-based Driver can update/uninstall a previously pre-kernel install.
 * No-op when there is no install, or when the manifest is already journal-shaped
 * (so re-running before every Driver call is safe and does not churn the file).
 *
 * @param {string} projectDir
 * @param {string} [manifestDir]
 * @returns {object|null} the migrated manifest, or null when there was none
 */
export function migrateLegacyInstall(projectDir, manifestDir) {
  const manifest = readManifest(projectDir, manifestDir);
  if (manifest == null) return null;
  if (isJournalManifest(manifest)) return manifest;

  const migrated = migrateLegacyManifest(manifest);
  writeManifest(projectDir, migrated, manifestDir);
  return migrated;
}
