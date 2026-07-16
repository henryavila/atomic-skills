/**
 * Multi-platform install contract (HARD).
 *
 * Atomic Skills claims Linux + macOS + Windows install. This suite fails closed
 * if product or engine code regains a single-OS-only mutation path, and proves
 * the public CLI surface works under the path-nofollow backend (macOS/Windows
 * class) even when the current host has /proc/self/fd.
 *
 * Layers:
 *  1. Static — ban Linux-only fail-closed and raw /proc hardcodes
 *  2. CI declaration — release matrix must still name all three OS families
 *  3. Behavioral — subprocess install/status/detect/uninstall with forced
 *     MINIMALIST_INSTALLER_PATH_BACKEND=path (simulates macOS on Linux CI)
 */
import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync,
  existsSync, symlinkSync, constants as fsConstants,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const SCRIPTS = join(ROOT, 'scripts');
const BIN = join(ROOT, 'bin');
const WORKFLOW = join(ROOT, '.github/workflows/test.yml');
const require = createRequire(import.meta.url);

function walkFiles(dir, pred, out = []) {
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'fixtures') continue;
      walkFiles(p, pred, out);
    } else if (ent.isFile() && pred(ent.name, p)) {
      out.push(p);
    }
  }
  return out;
}

function read(p) {
  return readFileSync(p, 'utf8');
}

async function loadMi() {
  if (process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT) {
    const root = process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT;
    return import(pathToFileURL(join(root, 'src/index.js')).href);
  }
  return import('@henryavila/minimalist-installer');
}

function miPackageRoot() {
  if (process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT) {
    return process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT;
  }
  // Package "exports" does not expose package.json — walk up from the entry.
  let dir = dirname(require.resolve('@henryavila/minimalist-installer'));
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'src', 'path-safety.js'))) return dir;
    dir = dirname(dir);
  }
  throw new Error('could not resolve @henryavila/minimalist-installer package root');
}

/**
 * Run a CLI command in an isolated HOME with forced path-nofollow backend.
 * Fresh process ⇒ backend cache cannot stick to Linux /proc from the parent.
 */
function runCli(args, { home, cwd, extraEnv = {} } = {}) {
  const result = spawnSync(process.execPath, [join(BIN, 'cli.js'), ...args], {
    cwd: cwd || home,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home, // Windows
      ATOMIC_SKILLS_SKIP_GROK_HOST: '1',
      MINIMALIST_INSTALLER_PATH_BACKEND: 'path',
      // Avoid interactive / host pollution
      CI: '1',
      NO_COLOR: '1',
      ...extraEnv,
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
  return result;
}

describe('multiplatform static guards (product tree)', () => {
  it('src/ never hardcodes /proc/self/fd (engine owns fd-relative paths)', () => {
    const offenders = walkFiles(SRC, (n) => n.endsWith('.js'))
      .filter((p) => read(p).includes('/proc/self/fd'))
      .map((p) => relative(ROOT, p));
    assert.deepEqual(offenders, [], `Linux-only path hardcode in src: ${offenders.join(', ')}`);
  });

  it('bin/ never hardcodes /proc/self/fd', () => {
    const offenders = walkFiles(BIN, (n) => n.endsWith('.js'))
      .filter((p) => read(p).includes('/proc/self/fd'))
      .map((p) => relative(ROOT, p));
    assert.deepEqual(offenders, [], `Linux-only path hardcode in bin: ${offenders.join(', ')}`);
  });

  it('product JS never throws Linux-only PathSafety fail-closed message', () => {
    const banned = /No-follow mutations require \/proc\/self\/fd \(Linux\)/;
    const offenders = walkFiles(ROOT, (n) => n.endsWith('.js'), [])
      .filter((p) => {
        const rel = relative(ROOT, p);
        if (rel.startsWith('node_modules') || rel.startsWith('.git')) return false;
        if (rel.startsWith('tests/fixtures')) return false;
        // Historical vendored 0.1.0 baseline is allowed as a known-bad oracle.
        if (rel.includes('minimalist-installer-v0.1.0')) return false;
        return banned.test(read(p));
      })
      .map((p) => relative(ROOT, p));
    assert.deepEqual(
      offenders,
      [],
      `Linux-only fail-closed string still present: ${offenders.join(', ')}`,
    );
  });

  it('open-URL shell snippets always offer Darwin + Linux (or WSL) branches', () => {
    // Generated help / skill bodies may embed open-url helpers — each must not be Darwin-only.
    const files = [
      ...walkFiles(SCRIPTS, (n) => n.endsWith('.js') || n.endsWith('.sh')),
      ...walkFiles(join(ROOT, 'skills'), (n) => n.endsWith('.sh') || n.endsWith('.md')),
    ];
    const offenders = [];
    for (const file of files) {
      const text = read(file);
      if (!/uname/.test(text) || !/\bopen\b/.test(text)) continue;
      const hasDarwin = /Darwin/.test(text);
      const hasLinuxPath = /xdg-open|microsoft|WSL|linux/i.test(text);
      if (hasDarwin && !hasLinuxPath) {
        offenders.push(relative(ROOT, file));
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `open-url helpers missing Linux/WSL branch: ${offenders.join(', ')}`,
    );
  });

  it('release CI matrix still declares linux, macos, and windows runners', () => {
    const yml = read(WORKFLOW);
    assert.match(yml, /ubuntu-latest/);
    assert.match(yml, /macos-latest/);
    assert.match(yml, /windows-latest/);
    assert.match(yml, /release-matrix/);
  });

  it('release matrix runs the full unit suite on every OS (not path-only jobs)', () => {
    const yml = read(WORKFLOW);
    // The release-matrix job must invoke npm test (full product surface).
    assert.match(yml, /release-matrix:[\s\S]*?run:\s*npm test/);
  });
});

describe('multiplatform static guards (minimalist-installer package)', () => {
  it('only path-safety.js may contain /proc/self/fd literals', () => {
    const pkgRoot = miPackageRoot();
    const srcRoot = join(pkgRoot, 'src');
    const offenders = walkFiles(srcRoot, (n) => n.endsWith('.js'))
      .filter((p) => {
        if (p.replace(/\\/g, '/').endsWith('/src/path-safety.js')) return false;
        return read(p).includes('/proc/self/fd');
      })
      .map((p) => relative(srcRoot, p));
    assert.deepEqual(
      offenders,
      [],
      `Engine hardcodes /proc outside path-safety (use entryPath): ${offenders.join(', ')}`,
    );
  });

  it('path-safety.js ships path-nofollow backend (macOS/Windows class)', async () => {
    const pkgRoot = miPackageRoot();
    const src = read(join(pkgRoot, 'src/path-safety.js'));
    assert.match(src, /path-nofollow/);
    assert.match(src, /O_NOFOLLOW/);
    assert.doesNotMatch(
      src,
      /require \/proc\/self\/fd \(Linux\)\. Refusing permissive fallback/,
    );
    assert.doesNotMatch(
      src,
      /O_NOFOLLOW === 'number' && process\.platform !== 'win32'/,
    );

    const mi = await loadMi();
    assert.equal(typeof mi.getPathSafetyBackend, 'function');
    assert.equal(typeof mi.writeFileNoFollow, 'function');
    assert.equal(typeof mi.entryPath, 'function');
  });

  it('host can always select a backend when O_NOFOLLOW exists', async () => {
    assert.equal(typeof fsConstants.O_NOFOLLOW, 'number');
    const mi = await loadMi();
    const backend = mi.getPathSafetyBackend();
    assert.ok(
      backend.kind === 'fd-relative' || backend.kind === 'path-nofollow',
      JSON.stringify(backend),
    );
  });
});

describe('multiplatform behavioral — forced path-nofollow (macOS/Windows class)', () => {
  let home;
  let projectDir;

  afterEach(() => {
    if (home) rmSync(home, { recursive: true, force: true });
    if (projectDir) rmSync(projectDir, { recursive: true, force: true });
    home = undefined;
    projectDir = undefined;
  });

  it('engine install/uninstall round-trip under path-nofollow backend', async () => {
    const mi = await loadMi();
    if (typeof mi.resetPathSafetyBackendForTests !== 'function') {
      assert.fail(
        'minimalist-installer missing resetPathSafetyBackendForTests — pin path-safety multiplatform SHA',
      );
    }
    const prev = process.env.MINIMALIST_INSTALLER_PATH_BACKEND;
    process.env.MINIMALIST_INSTALLER_PATH_BACKEND = 'path';
    mi.resetPathSafetyBackendForTests();
    try {
      assert.equal(mi.getPathSafetyBackend().kind, 'path-nofollow');
      home = mkdtempSync(join(tmpdir(), 'as-mp-mi-'));
      projectDir = join(home, 'proj');
      mkdirSync(projectDir, { recursive: true });
      const installer = mi.defineInstaller({
        providers: [mi.createFileSetProvider()],
        config: {
          manifestDir: '.atomic-skills',
          lockRoot: join(home, 'locks'),
          files: [
            { path: 'skills/core/x.md', content: 'X' },
            { path: 'deep/a/b.md', content: 'B' },
          ],
        },
      });
      installer.install({ projectDir });
      assert.equal(readFileSync(join(projectDir, 'skills/core/x.md'), 'utf8'), 'X');
      installer.uninstall({ projectDir });
      assert.equal(existsSync(join(projectDir, 'skills/core/x.md')), false);
    } finally {
      if (prev === undefined) delete process.env.MINIMALIST_INSTALLER_PATH_BACKEND;
      else process.env.MINIMALIST_INSTALLER_PATH_BACKEND = prev;
      mi.resetPathSafetyBackendForTests();
    }
  });

  it('engine refuses leaf symlink under path-nofollow (sentinel intact)', async () => {
    const mi = await loadMi();
    const prev = process.env.MINIMALIST_INSTALLER_PATH_BACKEND;
    process.env.MINIMALIST_INSTALLER_PATH_BACKEND = 'path';
    mi.resetPathSafetyBackendForTests();
    try {
      home = mkdtempSync(join(tmpdir(), 'as-mp-sym-'));
      const projectDirLocal = join(home, 'proj');
      const outside = join(home, 'out');
      mkdirSync(join(projectDirLocal, 'dir'), { recursive: true });
      mkdirSync(outside, { recursive: true });
      const sentinel = join(outside, 'secret.txt');
      writeFileSync(sentinel, 'SAFE');
      try {
        symlinkSync(sentinel, join(projectDirLocal, 'dir', 'file.txt'));
      } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EACCES') return;
        throw err;
      }
      const installer = mi.defineInstaller({
        providers: [mi.createFileSetProvider()],
        config: {
          manifestDir: '.atomic-skills',
          lockRoot: join(home, 'locks'),
          files: [{ path: 'dir/file.txt', content: 'PWNED' }],
        },
      });
      assert.throws(
        () => installer.install({ projectDir: projectDirLocal }),
        (err) => err?.code === 'UNSAFE_PATH_RACE' || /symlink|UNSAFE/i.test(String(err?.message || err)),
      );
      assert.equal(readFileSync(sentinel, 'utf8'), 'SAFE');
    } finally {
      if (prev === undefined) delete process.env.MINIMALIST_INSTALLER_PATH_BACKEND;
      else process.env.MINIMALIST_INSTALLER_PATH_BACKEND = prev;
      mi.resetPathSafetyBackendForTests();
    }
  });

  it('CLI install → status → detect → uninstall all succeed under path-nofollow', () => {
    home = mkdtempSync(join(tmpdir(), 'as-mp-cli-home-'));
    projectDir = mkdtempSync(join(tmpdir(), 'as-mp-cli-proj-'));
    // Minimal git root so --project works if needed; we install user-scope via HOME.
    writeFileSync(join(projectDir, 'package.json'), '{"name":"mp-cli-fixture"}\n');

    const install = runCli(
      ['install', '--yes', '--ide', 'claude-code', '--lang', 'en'],
      { home, cwd: projectDir },
    );
    assert.equal(
      install.status,
      0,
      `install failed under path-nofollow:\nstdout=${install.stdout}\nstderr=${install.stderr}`,
    );
    assert.match(install.stdout + install.stderr, /Done|installed|skills/i);

    const status = runCli(['status'], { home, cwd: projectDir });
    assert.equal(
      status.status,
      0,
      `status failed under path-nofollow:\nstdout=${status.stdout}\nstderr=${status.stderr}`,
    );

    const detect = runCli(['detect', '--json'], { home, cwd: projectDir });
    assert.equal(
      detect.status,
      0,
      `detect failed under path-nofollow:\nstdout=${detect.stdout}\nstderr=${detect.stderr}`,
    );
    // JSON object on stdout
    assert.match(detect.stdout, /\{[\s\S]*\}/);

    const uninstall = runCli(['uninstall', '--yes'], { home, cwd: projectDir });
    assert.equal(
      uninstall.status,
      0,
      `uninstall failed under path-nofollow:\nstdout=${uninstall.stdout}\nstderr=${uninstall.stderr}`,
    );
  });

  it('product install.js API round-trip under path-nofollow env (fresh worker)', () => {
    home = mkdtempSync(join(tmpdir(), 'as-mp-api-home-'));
    projectDir = mkdtempSync(join(tmpdir(), 'as-mp-api-proj-'));
    const worker = `
      import { install } from ${JSON.stringify(pathToFileURL(join(ROOT, 'src/install.js')).href)};
      import { uninstall } from ${JSON.stringify(pathToFileURL(join(ROOT, 'src/uninstall.js')).href)};
      import { existsSync } from 'node:fs';
      import { join } from 'node:path';
      const home = process.env.HOME;
      const projectDir = process.env.AS_MP_PROJECT;
      await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
      if (!existsSync(join(home, '.claude'))) {
        console.error('missing .claude after install');
        process.exit(2);
      }
      await uninstall(projectDir, { scope: 'user', yes: true });
      console.log('API_ROUNDTRIP_OK');
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', worker], {
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        AS_MP_PROJECT: projectDir,
        ATOMIC_SKILLS_SKIP_GROK_HOST: '1',
        MINIMALIST_INSTALLER_PATH_BACKEND: 'path',
        CI: '1',
        NO_COLOR: '1',
      },
      encoding: 'utf8',
      timeout: 120_000,
    });
    assert.equal(
      result.status,
      0,
      `API round-trip failed under path-nofollow:\nstdout=${result.stdout}\nstderr=${result.stderr}`,
    );
    assert.match(result.stdout, /API_ROUNDTRIP_OK/);
  });
});

describe('multiplatform CI enforces path-nofollow simulation on Linux', () => {
  it('workflow declares a path-nofollow (or multiplatform-contract) verification step', () => {
    const yml = read(WORKFLOW);
    // Either dedicated job/env force, or the multiplatform-contract suite is part of npm test
    // (always true if this file is under tests/). Require an explicit CI signal so
    // maintainers cannot drop the force-backend job silently.
    const hasForceEnv = /MINIMALIST_INSTALLER_PATH_BACKEND:\s*path/.test(yml)
      || /MINIMALIST_INSTALLER_PATH_BACKEND=path/.test(yml);
    const hasNamedJob = /multiplatform|path-nofollow|path_nofollow/i.test(yml);
    assert.ok(
      hasForceEnv || hasNamedJob,
      'CI must force path-nofollow backend or name a multiplatform job — '
      + 'otherwise Linux-only /proc regressions only fail on macOS hosts',
    );
  });
});
