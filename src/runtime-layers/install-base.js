import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Normalize an install base for identity compares.
 * resolve always; realpath when the path exists.
 * @param {string} basePath
 * @returns {string}
 */
export function normalizeInstallBase(basePath) {
  if (typeof basePath !== 'string' || basePath.length === 0) return basePath;
  const abs = resolve(basePath);
  try {
    if (existsSync(abs)) return realpathSync(abs);
  } catch {
    // dangling path / race — fall through to resolved absolute form
  }
  return abs;
}
