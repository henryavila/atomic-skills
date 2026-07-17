/**
 * P1-A / F-004 — end-to-end unmanaged-desired vs safelist reclaim via installSkills.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { installSkills } from '../src/install.js';
import { buildInstaller } from '../src/installer.js';
import { readManifest, writeManifest } from '../src/manifest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SKILLS_DIR = join(ROOT, 'skills');
const META_DIR = join(ROOT, 'meta');

const baseOpts = {
  language: 'en',
  ides: ['claude-code'],
  skillsDir: SKILLS_DIR,
  metaDir: META_DIR,
  scope: 'project',
};

describe('unmanaged-desired install path (P1-A / F-004)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-unmanaged-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('preserves user-edited foreign skill body; reports unresolved; retry same', () => {
    const rel = '.claude/commands/atomic-skills/project.md';
    mkdirSync(join(tempDir, '.claude/commands/atomic-skills'), { recursive: true });
    const userBody = '# My custom project command — do not clobber\n';
    writeFileSync(join(tempDir, rel), userBody);

    // Partial journal (other path only) so project.md is unowned desired.
    writeManifest(tempDir, {
      journalVersion: 2,
      effects: [{
        type: 'reconcileFileSet',
        beforeState: [{
          path: '.claude/commands/atomic-skills/fix.md',
          installedHash: 'deadbeef',
        }],
      }],
      version: '2.0.0',
      language: 'en',
      ides: ['claude-code'],
    });

    const result = installSkills(tempDir, baseOpts);
    assert.equal(readFileSync(join(tempDir, rel), 'utf8'), userBody, 'user body preserved');
    assert.ok(result.adopt?.unresolved >= 1, 'reports unresolved');
    assert.ok(
      result.adopt.unresolvedPaths.includes(rel),
      'unresolvedPaths includes user file',
    );
    assert.ok(
      !result.files.some((f) => f.path === rel),
      'unmanaged path not in installed files',
    );
    const m = readManifest(tempDir);
    assert.ok(!m.files?.[rel], 'not in manifest.files');

    // Retry without force-adopt remains non-destructive
    const again = installSkills(tempDir, baseOpts);
    assert.equal(readFileSync(join(tempDir, rel), 'utf8'), userBody, 'retry still preserves');
    assert.ok(again.adopt?.unresolvedPaths?.includes(rel) || !again.files.some((f) => f.path === rel));
  });

  it('uninstall does not remove unmanaged user file', () => {
    const rel = '.claude/commands/atomic-skills/project.md';
    mkdirSync(join(tempDir, '.claude/commands/atomic-skills'), { recursive: true });
    const userBody = '# keep me across uninstall\n';
    writeFileSync(join(tempDir, rel), userBody);

    installSkills(tempDir, baseOpts);
    assert.equal(readFileSync(join(tempDir, rel), 'utf8'), userBody);

    const installer = buildInstaller(baseOpts);
    installer.uninstall({ projectDir: tempDir });

    assert.ok(existsSync(join(tempDir, rel)), 'unmanaged file survives uninstall');
    assert.equal(readFileSync(join(tempDir, rel), 'utf8'), userBody);
  });

  it('stale package leftover with safelist frontmatter is reclaimed', () => {
    const rel = '.claude/skills/atomic-skills/project/SKILL.md';
    mkdirSync(join(tempDir, '.claude/skills/atomic-skills/project'), { recursive: true });
    // name: project is a known catalog skill → isAtomicSkillsArtifact true
    writeFileSync(
      join(tempDir, rel),
      '---\nname: project\ndescription: stale leftover\n---\n\nold body from prior install\n',
    );

    writeManifest(tempDir, {
      journalVersion: 2,
      effects: [{
        type: 'reconcileFileSet',
        beforeState: [{
          path: '.grok/plugins/atomic-skills/skills/fix/SKILL.md',
          installedHash: 'deadbeefcafebabe',
        }],
      }],
      version: '2.0.0',
      language: 'en',
      ides: ['grok'],
    });

    const result = installSkills(tempDir, {
      ...baseOpts,
      ides: ['claude-code', 'grok'],
    });

    assert.ok(existsSync(join(tempDir, rel)));
    const content = readFileSync(join(tempDir, rel), 'utf8');
    assert.ok(!content.includes('old body from prior install'), 'stale body replaced');
    assert.ok(result.adopt?.adopted >= 1 || result.files.some((f) => f.path === rel));
    assert.ok(result.files.some((f) => f.path === rel), 'reclaimed path in files');
  });

  it('--force-adopt reclaims foreign content at desired path', () => {
    const rel = '.claude/commands/atomic-skills/project.md';
    mkdirSync(join(tempDir, '.claude/commands/atomic-skills'), { recursive: true });
    writeFileSync(join(tempDir, rel), '# totally foreign content\n');

    const result = installSkills(tempDir, { ...baseOpts, forceAdopt: true });
    const content = readFileSync(join(tempDir, rel), 'utf8');
    assert.ok(!content.includes('totally foreign'), 'force-adopt rewrote foreign body');
    assert.ok(result.files.some((f) => f.path === rel));
    assert.equal(result.adopt?.unresolved ?? 0, 0);
  });
});
