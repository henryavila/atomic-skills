/**
 * RED repro: greenfield clobber of pre-existing unowned content.
 *
 * Against 0.1.0, reconcileFileSet writes desired content whenever there is no
 * previous installed hash — even if a user file already exists at the path.
 *
 * Exit 0 = vulnerability observed.
 */
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

function resolvePackageRoot(specifier = '@henryavila/minimalist-installer') {
  const require = createRequire(import.meta.url);
  let dir = dirname(require.resolve(specifier));
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Unable to resolve package root for ${specifier}`);
}

const SIGNATURE = 'GREENFIELD_CLOBBER_UNOWNED';

export async function run(options = {}) {
  const pkgRoot = options.packageRoot ?? resolvePackageRoot();
  const { createReconcileFileSetEffect } = await import(
    pathToFileURL(join(pkgRoot, 'src/kernel/reconciler.js')).href
  );

  const root = mkdtempSync(join(tmpdir(), 'mi-repro-greenfield-'));
  try {
    const basePath = join(root, 'install');
    mkdirSync(basePath, { recursive: true });
    const userContent = 'USER-OWNED-BYTES';
    writeFileSync(join(basePath, 'config.json'), userContent, 'utf8');

    const effect = createReconcileFileSetEffect();
    let threw = null;
    try {
      effect.apply({
        basePath,
        desired: [{ path: 'config.json', content: '{"installed":true}' }],
        previous: [],
      });
    } catch (err) {
      threw = err;
    }

    const after = readFileSync(join(basePath, 'config.json'), 'utf8');
    const clobbered = after !== userContent && threw === null;
    return {
      signature: SIGNATURE,
      vulnerable: clobbered,
      threw: threw ? String(threw.message || threw) : null,
      after,
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
