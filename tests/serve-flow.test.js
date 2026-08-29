/**
 * serve-flow — preview L2 over HTTP (never file://).
 */
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'serve-flow.js');
const SKILL = join(ROOT, 'skills', 'shared', 'project-assets', 'project-flow.md');
const SPAWN_OPTS = { encoding: 'utf8', timeout: 15_000, maxBuffer: 2 * 1024 * 1024 };

const closers = [];

afterEach(async () => {
  while (closers.length) {
    const close = closers.pop();
    try { await close(); } catch { /* ignore */ }
  }
});

function writeHtml(body = '<html><body>flow-preview</body></html>') {
  const dir = mkdtempSync(join(tmpdir(), 'serve-flow-'));
  const htmlPath = join(dir, 'flow', 'flow.html');
  mkdirSync(dirname(htmlPath), { recursive: true });
  writeFileSync(htmlPath, body);
  return { dir, htmlPath, body };
}

async function fetchText(url) {
  const res = await fetch(url);
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

describe('serveFlowHtml', () => {
  it('serves the HTML body over http://127.0.0.1 (not file://)', async () => {
    const { serveFlowHtml } = await import('../scripts/lib/serve-flow.js');
    const { htmlPath, body } = writeHtml('<html><body>hello-flow</body></html>');
    try {
      const preview = await serveFlowHtml(htmlPath);
      closers.push(() => preview.close());
      assert.match(preview.url, /^http:\/\/127\.0\.0\.1:\d+\/flow\.html$/);
      assert.doesNotMatch(preview.url, /file:/);
      const got = await fetchText(preview.url);
      assert.equal(got.status, 200);
      assert.equal(got.text, body);
      assert.match(got.headers.get('content-type') || '', /text\/html/);
    } finally {
      rmSync(dirname(dirname(htmlPath)), { recursive: true, force: true });
    }
  });

  it('serves / as the same document', async () => {
    const { serveFlowHtml } = await import('../scripts/lib/serve-flow.js');
    const { htmlPath, body } = writeHtml('<html><body>root-alias</body></html>');
    try {
      const preview = await serveFlowHtml(htmlPath);
      closers.push(() => preview.close());
      const root = new URL('/', preview.url).href;
      const got = await fetchText(root);
      assert.equal(got.status, 200);
      assert.equal(got.text, body);
    } finally {
      rmSync(dirname(dirname(htmlPath)), { recursive: true, force: true });
    }
  });

  it('refuses path traversal', async () => {
    const { serveFlowHtml } = await import('../scripts/lib/serve-flow.js');
    const { htmlPath } = writeHtml();
    try {
      const preview = await serveFlowHtml(htmlPath);
      closers.push(() => preview.close());
      const sneaky = new URL('/../package.json', preview.url).href;
      const got = await fetchText(sneaky);
      assert.equal(got.status, 404);
      assert.doesNotMatch(got.text, /"name"\s*:/);
    } finally {
      rmSync(dirname(dirname(htmlPath)), { recursive: true, force: true });
    }
  });

  it('throws when the HTML file is missing', async () => {
    const { serveFlowHtml } = await import('../scripts/lib/serve-flow.js');
    await assert.rejects(
      () => serveFlowHtml(join(tmpdir(), 'no-such-flow.html')),
      /not found|ENOENT/i,
    );
  });
});

describe('serve-flow CLI --up', () => {
  it('prints an http URL that serves the file, then --down stops it', async () => {
    const home = mkdtempSync(join(tmpdir(), 'serve-flow-home-'));
    const { htmlPath, body } = writeHtml('<html><body>cli-up</body></html>');
    try {
      const up = spawnSync(process.execPath, [CLI, '--up', htmlPath], {
        ...SPAWN_OPTS,
        env: { ...process.env, HOME: home, USERPROFILE: home },
      });
      assert.equal(up.status, 0, up.stderr || up.stdout);
      const url = up.stdout.trim();
      assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/flow\.html$/);
      const got = await fetchText(url);
      assert.equal(got.status, 200);
      assert.equal(got.text, body);

      const again = spawnSync(process.execPath, [CLI, '--up', htmlPath], {
        ...SPAWN_OPTS,
        env: { ...process.env, HOME: home, USERPROFILE: home },
      });
      assert.equal(again.status, 0, again.stderr);
      assert.equal(again.stdout.trim(), url);

      const down = spawnSync(process.execPath, [CLI, '--down', htmlPath], {
        ...SPAWN_OPTS,
        env: { ...process.env, HOME: home, USERPROFILE: home },
      });
      assert.equal(down.status, 0, down.stderr);
      await assert.rejects(() => fetchText(url));
    } finally {
      spawnSync(process.execPath, [CLI, '--down', htmlPath], {
        ...SPAWN_OPTS,
        env: { ...process.env, HOME: home, USERPROFILE: home },
      });
      rmSync(home, { recursive: true, force: true });
      rmSync(dirname(dirname(htmlPath)), { recursive: true, force: true });
    }
  });

  it('exits 2 when the file is missing', () => {
    const home = mkdtempSync(join(tmpdir(), 'serve-flow-home-miss-'));
    try {
      const r = spawnSync(
        process.execPath,
        [CLI, '--up', join(home, 'missing.html')],
        { ...SPAWN_OPTS, env: { ...process.env, HOME: home, USERPROFILE: home } },
      );
      assert.equal(r.status, 2);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('exits 2 when asked to preview map.html (abolished L2 name)', () => {
    const home = mkdtempSync(join(tmpdir(), 'serve-flow-home-map-'));
    const dir = mkdtempSync(join(tmpdir(), 'serve-flow-map-'));
    const mapPath = join(dir, 'process', 'map.html');
    mkdirSync(dirname(mapPath), { recursive: true });
    writeFileSync(mapPath, '<html><body>old-map</body></html>');
    try {
      const r = spawnSync(process.execPath, [CLI, '--up', mapPath], {
        ...SPAWN_OPTS,
        env: { ...process.env, HOME: home, USERPROFILE: home },
      });
      assert.equal(r.status, 2, r.stderr || r.stdout);
      assert.match(r.stderr || '', /flow\.html|abolished|map\.html/i);
    } finally {
      spawnSync(process.execPath, [CLI, '--down', mapPath], {
        ...SPAWN_OPTS,
        env: { ...process.env, HOME: home, USERPROFILE: home },
      });
      rmSync(home, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes the lock under HOME/USERPROFILE, not os.homedir() when they differ', async () => {
    const home = mkdtempSync(join(tmpdir(), 'serve-flow-home-lock-'));
    const { htmlPath, body } = writeHtml('<html><body>lock-home</body></html>');
    try {
      const up = spawnSync(process.execPath, [CLI, '--up', htmlPath], {
        ...SPAWN_OPTS,
        env: { ...process.env, HOME: home, USERPROFILE: home },
      });
      assert.equal(up.status, 0, up.stderr || up.stdout);
      const lockFile = join(home, '.atomic-skills', 'flow-serve.json');
      assert.equal(existsSync(lockFile), true, `expected lock at ${lockFile}`);
      const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
      assert.ok(Array.isArray(lock.servers) && lock.servers.length >= 1);
      const got = await fetchText(up.stdout.trim());
      assert.equal(got.status, 200);
      assert.equal(got.text, body);
    } finally {
      spawnSync(process.execPath, [CLI, '--down', htmlPath], {
        ...SPAWN_OPTS,
        env: { ...process.env, HOME: home, USERPROFILE: home },
      });
      rmSync(home, { recursive: true, force: true });
      rmSync(dirname(dirname(htmlPath)), { recursive: true, force: true });
    }
  });
});

describe('project flow skill — always HTTP', () => {
  it('requires serve-flow --up and forbids opening the file path', () => {
    const skill = readFileSync(SKILL, 'utf8');
    assert.match(skill, /serve-flow\.js/);
    assert.match(skill, /--up/);
    assert.match(skill, /http:\/\//);
    assert.match(skill, /Never `?file:\/\//);
    assert.match(skill, /Always via HTTP web server/);
    assert.doesNotMatch(skill, /open `\$L2` with the WSL-aware/);
  });
});
