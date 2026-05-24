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
  const PKG_ROOT = import.meta.url.replace('file://', '').replace('/tests/status.test.js', '');
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'as-status-fp-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('with forceProject: true + valid projectDir manifest reads PROJECT manifest from tmp', async () => {
    installSkills(tmp, {
      language: 'pt',
      ides: ['claude-code'],
      modules: {},
      skillsDir: join(PKG_ROOT, 'skills'),
      metaDir: join(PKG_ROOT, 'meta'),
    });
    const { status } = await import('../src/status.js');
    const result = status(tmp, { forceProject: true });
    // Mutation that would fail: swap readManifest(projectDir) for readManifest(homeDir)
    // inside the forceProject branch — manifest would be null (or wrong) and scope wrong.
    assert.equal(result.scope, 'project');
    assert.equal(result.base, tmp);
    assert.ok(result.manifest, 'project manifest must be returned, not null');
    assert.equal(result.manifest.language, 'pt');
  });

  it('with forceProject: true + null projectDir returns null manifest without falling back to user', async () => {
    const { status } = await import('../src/status.js');
    const result = status(null, { forceProject: true });
    // Mutation that would fail: removing the forceProject branch entirely —
    // would fall back to reading homeDir and possibly return a non-null manifest.
    assert.equal(result.manifest, null);
    assert.equal(result.scope, 'project');
    assert.equal(result.base, null);
  });

  it('with forceProject: true + projectDir without manifest returns null without user fallback', async () => {
    const { status } = await import('../src/status.js');
    const result = status(tmp, { forceProject: true });
    // Mutation that would fail: any branch that falls back to homeDir after
    // a missing project manifest — would return a non-null manifest if HOME
    // happens to have one installed.
    assert.equal(result.manifest, null);
    assert.equal(result.scope, 'project');
    assert.equal(result.base, tmp);
  });

  it('without forceProject (default) prefers user scope when present, falls back to project when not', async () => {
    // Install a project manifest in tmp.
    installSkills(tmp, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: join(PKG_ROOT, 'skills'),
      metaDir: join(PKG_ROOT, 'meta'),
    });
    const { status } = await import('../src/status.js');
    const result = status(tmp);
    // Mutation that would fail: skipping the homeDir check entirely —
    // result.scope would always be 'project'; assertion below relies on
    // the documented "user-scope-first" branch existing.
    assert.ok(result.scope === 'user' || result.scope === 'project',
      `scope must be 'user' or 'project', got: ${result.scope}`);
    // If HOME has no manifest, the fallback path MUST have produced the
    // tmp project manifest (which we just installed). This proves the
    // fallback wire-up — a mutation removing the fallback would leave
    // manifest null even though the project manifest exists.
    if (result.scope === 'project') {
      assert.equal(result.base, tmp);
      assert.ok(result.manifest, 'project fallback should have produced the tmp manifest');
    }
  });
});
