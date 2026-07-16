/**
 * RED repro: late-effect failure leaves filesystem mutated without a durable
 * journal (driver writes manifest only after all effects succeed).
 *
 * Exit 0 = vulnerability observed (files on disk, no manifest).
 */
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync,
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

const SIGNATURE = 'LATE_FAILURE_NO_JOURNAL';

export async function run(options = {}) {
  const pkgRoot = options.packageRoot ?? resolvePackageRoot();
  const { defineInstaller, createFileSetProvider } = await import(
    pathToFileURL(join(pkgRoot, 'src/index.js')).href
  );

  const root = mkdtempSync(join(tmpdir(), 'mi-repro-fault-'));
  try {
    const projectDir = join(root, 'project');
    mkdirSync(projectDir, { recursive: true });

    const boom = {
      type: 'boom',
      apply() {
        throw new Error('injected late failure');
      },
      revert() {},
    };

    const installer = defineInstaller({
      providers: [
        createFileSetProvider(),
        {
          plan() {
            return [{ type: 'boom', args: {} }];
          },
        },
      ],
      effects: [boom],
      config: {
        manifestDir: '.mi',
        files: [{ path: 'skills/a.md', content: 'A' }],
      },
    });

    let threw = null;
    try {
      installer.install({ projectDir });
    } catch (err) {
      threw = err;
    }

    const fileExists = existsSync(join(projectDir, 'skills/a.md'));
    const manifestExists = existsSync(join(projectDir, '.mi', 'manifest.json'));
    const vulnerable = Boolean(threw) && fileExists && !manifestExists;

    return {
      signature: SIGNATURE,
      vulnerable,
      threw: threw ? String(threw.message || threw) : null,
      fileExists,
      manifestExists,
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
