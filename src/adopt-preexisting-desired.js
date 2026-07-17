import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hashContent } from './hash.js';
import { readManifest, writeManifest } from './manifest.js';

/**
 * Adopt pre-existing files that land on the *desired* install set into the
 * journal's reconcileFileSet beforeState so the kernel does not throw
 * GREENFIELD_CONFLICT on IDE expansion / partial journals.
 *
 * Scenario (user report 2026-07-17):
 *   - Journal only owns `.grok/...` paths (last install was Grok-only, or
 *     multi-IDE tracking was lost).
 *   - Disk still has `.claude/commands/atomic-skills/*.md` from an older install.
 *   - Re-install with Claude selected → reconciler sees unowned pre-existing
 *     content that differs from desired → PathSafetyError GREENFIELD_CONFLICT.
 *
 * Fix: before Driver.install, for every desired path that already exists on
 * disk and is not yet in the reconcile beforeState, record
 * `{ path, installedHash: hash(current) }`. The 3-hash policy then treats the
 * path as owned (`current === installed` → unchanged) and rewrites to desired
 * content. Package destination paths are exclusive to Atomic Skills.
 *
 * Pure greenfield (no disk file at desired path) is unchanged — previous stays
 * empty for those paths and the reconciler writes normally.
 *
 * @param {string} projectDir install base (HOME for user scope, repo for project)
 * @param {Array<{ path: string, content: string }>} desired file set
 * @returns {{ adopted: number, paths: string[] }}
 */
export function adoptPreexistingDesiredFiles(projectDir, desired) {
  if (!Array.isArray(desired) || desired.length === 0) {
    return { adopted: 0, paths: [] };
  }

  const candidates = [];
  for (const { path } of desired) {
    if (typeof path !== 'string' || path.length === 0) continue;
    const abs = join(projectDir, path);
    if (!existsSync(abs)) continue;
    try {
      if (!statSync(abs).isFile()) continue;
      const installedHash = hashContent(readFileSync(abs, 'utf8'));
      candidates.push({ path, installedHash });
    } catch {
      // Unreadable / raced — leave for reconciler (may still fail closed).
    }
  }
  if (candidates.length === 0) return { adopted: 0, paths: [] };

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
  for (const entry of candidates) {
    if (owned.has(entry.path)) continue;
    beforeState.push(entry);
    owned.add(entry.path);
    adoptedPaths.push(entry.path);
  }
  if (adoptedPaths.length === 0) return { adopted: 0, paths: [] };

  const effect = idx >= 0
    ? { ...effects[idx], type: 'reconcileFileSet', beforeState }
    : { type: 'reconcileFileSet', beforeState };
  if (idx >= 0) effects[idx] = effect;
  else effects.push(effect);

  writeManifest(projectDir, { ...manifest, effects });
  return { adopted: adoptedPaths.length, paths: adoptedPaths };
}
