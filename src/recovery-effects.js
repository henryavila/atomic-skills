/**
 * Reverse journaled effects without the incomplete-transaction assertion.
 *
 * Split out of `recovery-cli.js`: this is the one place both repair and
 * force-incomplete touch the effect registry, and it soft-fails per effect so
 * partial cleanup still progresses.
 */
import { readEffects } from '@henryavila/minimalist-installer';
import { MANIFEST_DIR } from './manifest.js';

/**
 * Best-effort reverse of journaled effects without assertNoIncompleteTransaction.
 * Soft-fails per effect so partial cleanup still progresses.
 *
 * @param {string} basePath
 * @param {object} manifest
 * @param {object} registry - effect registry from buildInstaller().registry
 * @returns {{ reversed: object[], failed: object[] }}
 */
export function reverseJournaledEffects(basePath, manifest, registry) {
  const reversed = [];
  const failed = [];
  const effects = [...readEffects(manifest)].reverse();
  const ctx = { basePath, manifestDir: MANIFEST_DIR };

  for (const entry of effects) {
    const type = entry?.type;
    try {
      const effectType = registry.get(type);
      if (!effectType) {
        failed.push({
          type,
          id: entry?.id,
          error: `unknown effect type "${type}"`,
          code: 'UNKNOWN_EFFECT',
        });
        continue;
      }
      effectType.revert(ctx, entry.beforeState);
      reversed.push({ type, id: entry?.id });
    } catch (err) {
      failed.push({
        type,
        id: entry?.id,
        error: err?.message || String(err),
        code: err?.code,
      });
    }
  }

  return { reversed, failed };
}
