/**
 * The shell source rule, mirroring qa/measure/lib/shellfiles.py.
 *
 * A path is shell source when it ends in `.sh` under a root of the `sh` stack,
 * or when it is a file directly inside `.husky/` (no further `/`). Nothing
 * under the generated `.husky/_/` directory is shell source.
 */
export function isShellSource(key, roots) {
  const normalized = key.split('\\').join('/').replace(/^\/+|\/+$/g, '');
  if (normalized === '.husky/_' || normalized.startsWith('.husky/_/')) return false;
  if (normalized.startsWith('.husky/')) {
    const rest = normalized.slice('.husky/'.length);
    if (rest.includes('/')) return rest.endsWith('.sh');
    return true;
  }
  if (!normalized.endsWith('.sh')) return false;
  return roots.some((root) => {
    const base = root.replace(/\/+$/, '');
    return normalized === base || normalized.startsWith(`${base}/`);
  });
}
