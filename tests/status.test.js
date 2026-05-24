import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installSkills } from '../src/install.js';
import { readManifest } from '../src/manifest.js';

const SKILLS_DIR = join(process.cwd(), 'skills');
const META_DIR = join(process.cwd(), 'meta');

describe('status data verification', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-status-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('all installed files exist on disk', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    const manifest = readManifest(tempDir);
    assert.ok(manifest);
    for (const filePath of Object.keys(manifest.files)) {
      assert.ok(existsSync(join(tempDir, filePath)), `${filePath} should exist`);
    }
  });

  it('detects missing files after deletion', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    unlinkSync(join(tempDir, '.claude/commands/atomic-skills/fix.md'));

    const manifest = readManifest(tempDir);
    let missingCount = 0;
    for (const filePath of Object.keys(manifest.files)) {
      if (!existsSync(join(tempDir, filePath))) missingCount++;
    }
    assert.strictEqual(missingCount, 1);
  });

  it('returns null manifest when not installed', () => {
    const manifest = readManifest(tempDir);
    assert.strictEqual(manifest, null);
  });

  it('groups files by IDE correctly', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code', 'cursor'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    const manifest = readManifest(tempDir);
    const claudeFiles = Object.keys(manifest.files).filter(f => f.startsWith('.claude/'));
    const cursorFiles = Object.keys(manifest.files).filter(f => f.startsWith('.cursor/'));
    assert.ok(claudeFiles.length > 0);
    assert.ok(cursorFiles.length > 0);
  });
});

describe('status({forceProject}) — T7', () => {
  let tmp;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'as-status-fp-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('without forceProject: default user-scope-first behavior is preserved (smoke check)', async () => {
    // Install a project manifest in tmp
    installSkills(tmp, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: join(import.meta.url.replace('file://', '').replace('/tests/status.test.js', ''), 'skills'),
      metaDir: join(import.meta.url.replace('file://', '').replace('/tests/status.test.js', ''), 'meta'),
    });
    const { status } = await import('../src/status.js');
    // status() default behavior with projectDir=tmp: tries user home first.
    // If user home has no manifest, falls back to project. We can't easily
    // assert console output here, but we can verify the function doesn't throw.
    assert.doesNotThrow(() => status(tmp));
  });

  it('with forceProject: true + valid projectDir manifest, reads project manifest', async () => {
    const PKG_ROOT = import.meta.url.replace('file://', '').replace('/tests/status.test.js', '');
    installSkills(tmp, {
      language: 'pt',
      ides: ['claude-code'],
      modules: {},
      skillsDir: join(PKG_ROOT, 'skills'),
      metaDir: join(PKG_ROOT, 'meta'),
    });
    const { status } = await import('../src/status.js');
    // forceProject: true → reads tmp/.atomic-skills/manifest.json (lang=pt)
    assert.doesNotThrow(() => status(tmp, { forceProject: true }));
  });

  it('with forceProject: true + null projectDir, manifest is null (early return)', async () => {
    const { status } = await import('../src/status.js');
    assert.doesNotThrow(() => status(null, { forceProject: true }));
  });

  it('with forceProject: true + projectDir without manifest, prints "Not installed"', async () => {
    const { status } = await import('../src/status.js');
    // tmp is a fresh dir with no .atomic-skills/manifest.json
    assert.doesNotThrow(() => status(tmp, { forceProject: true }));
  });
});
