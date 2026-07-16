/**
 * RED repro: concurrent installs share no lock on a shared resource.
 *
 * Two processes write the same shared registry-like file via path-based
 * read-modify-write (mirroring 0.1.0 manifest.js + consumer installs.json).
 * Without a canonical shared lock, lost updates drop one of the entries.
 * Independently, 0.1.0 ships no lock module at all.
 *
 * Exit 0 = vulnerability observed (lost update and/or missing lock module).
 */
import {
  mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

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

const SIGNATURE = 'SHARED_RESOURCE_LOST_UPDATE';

function childCode(registryPath, barrierPath, value) {
  return `
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const p = ${JSON.stringify(registryPath)};
const barrier = ${JSON.stringify(barrierPath)};
const value = ${JSON.stringify(value)};
while (!existsSync(barrier)) {
  await new Promise((r) => setTimeout(r, 5));
}
let list = [];
try {
  const v = JSON.parse(readFileSync(p, 'utf8'));
  if (Array.isArray(v)) list = v;
} catch {}
await new Promise((r) => setTimeout(r, 50));
if (!list.includes(value)) list.push(value);
writeFileSync(p, JSON.stringify(list, null, 2) + '\\n', 'utf8');
`;
}

export async function run() {
  const root = mkdtempSync(join(tmpdir(), 'mi-repro-shared-lock-'));
  try {
    const registryPath = join(root, 'installs.json');
    const barrier = join(root, 'go');
    writeFileSync(registryPath, '[]\n', 'utf8');

    const c1 = spawn(process.execPath, ['--input-type=module', '-e', childCode(registryPath, barrier, 'root-A')], {
      stdio: 'ignore',
    });
    const c2 = spawn(process.execPath, ['--input-type=module', '-e', childCode(registryPath, barrier, 'root-B')], {
      stdio: 'ignore',
    });
    await new Promise((r) => setTimeout(r, 40));
    writeFileSync(barrier, 'go', 'utf8');
    const [code1, code2] = await Promise.all([
      new Promise((res) => c1.on('exit', res)),
      new Promise((res) => c2.on('exit', res)),
    ]);

    const list = JSON.parse(readFileSync(registryPath, 'utf8'));
    const lostUpdate = !(list.includes('root-A') && list.includes('root-B'));

    let hasLockExport = false;
    try {
      const pkgRoot = resolvePackageRoot();
      hasLockExport = existsSync(join(pkgRoot, 'src/lock.js'));
    } catch {
      hasLockExport = false;
    }

    return {
      signature: SIGNATURE,
      vulnerable: lostUpdate || !hasLockExport,
      list,
      lostUpdate,
      hasLockExport,
      childExitCodes: [code1, code2],
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
