import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { installSkills } from '../src/install.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SKILLS_DIR = join(__dirname, '..', 'skills');
const META_DIR = join(__dirname, '..', 'meta');

describe('installSkills', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-install-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates command files for claude-code', () => {
    const result = installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    assert.ok(existsSync(join(tempDir, '.claude/commands/atomic-skills/fix.md')));
    const content = readFileSync(join(tempDir, '.claude/commands/atomic-skills/fix.md'), 'utf8');
    assert.ok(content.startsWith('---\n'));
    assert.ok(content.includes("description: '"));
    assert.ok(!content.includes('name: fix')); // commands don't have name field
    assert.strictEqual(result.files.length, 9); // 9 core skills (no namespace root for commands)
  });

  it('creates TOML files for gemini-commands', () => {
    const result = installSkills(tempDir, {
      language: 'en',
      ides: ['gemini-commands'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    const geminiFile = join(tempDir, '.gemini/commands/atomic-skills-fix.toml');
    assert.ok(existsSync(geminiFile));
    const content = readFileSync(geminiFile, 'utf8');
    assert.ok(content.includes('description = "'));
    assert.ok(content.includes('prompt = """'));
  });

  it('creates markdown files for gemini skills', () => {
    const result = installSkills(tempDir, {
      language: 'en',
      ides: ['gemini'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    const geminiFile = join(tempDir, '.gemini/skills/atomic-skills/fix/SKILL.md');
    assert.ok(existsSync(geminiFile));
    const content = readFileSync(geminiFile, 'utf8');
    assert.ok(content.startsWith('---\n'));
    assert.ok(content.includes('name: fix'));
  });

  it('installs memory module skills when module is enabled', () => {
    const result = installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: { memory: { installed: true, config: { memory_path: '.ai/memory/' } } },
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    assert.ok(existsSync(join(tempDir, '.claude/commands/atomic-skills/init-memory.md')));
    assert.strictEqual(result.files.length, 10); // 9 core + 1 module (no namespace root for commands)
  });

  it('substitutes memory_path variable', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: { memory: { installed: true, config: { memory_path: '.custom/mem/' } } },
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    const content = readFileSync(join(tempDir, '.claude/commands/atomic-skills/init-memory.md'), 'utf8');
    assert.ok(content.includes('.custom/mem/'));
    assert.ok(!content.includes('{{memory_path}}'));
  });

  it('adds .atomic-skills/ to .gitignore', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    const gitignore = readFileSync(join(tempDir, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.atomic-skills/'));
  });

  it('writes manifest with correct structure', () => {
    installSkills(tempDir, {
      language: 'pt',
      ides: ['claude-code', 'cursor'],
      modules: { memory: { installed: true, config: { memory_path: '.ai/memory/' } } },
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    const manifest = JSON.parse(readFileSync(join(tempDir, '.atomic-skills/manifest.json'), 'utf8'));
    assert.strictEqual(manifest.language, 'pt');
    assert.deepStrictEqual(manifest.ides, ['claude-code', 'cursor']);
    assert.ok(manifest.files['.claude/commands/atomic-skills/fix.md']);
    assert.ok(manifest.files['.cursor/skills/atomic-skills/fix/SKILL.md']);
    assert.ok(manifest.files['.cursor/skills/atomic-skills/SKILL.md']); // namespace root for cursor (markdown)
    assert.ok(!manifest.files['.claude/commands/atomic-skills/SKILL.md']); // no root for commands format
    assert.ok(manifest.files['.claude/commands/atomic-skills/fix.md'].installed_hash);
    assert.ok(manifest.files['.claude/commands/atomic-skills/fix.md'].source);
  });

  it('creates files for multiple IDEs', () => {
    const result = installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code', 'gemini-commands'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    assert.ok(existsSync(join(tempDir, '.claude/commands/atomic-skills/fix.md')));
    assert.ok(existsSync(join(tempDir, '.gemini/commands/atomic-skills-fix.toml')));
    assert.strictEqual(result.files.length, 18); // 9 core * 2 IDEs (no namespace root for command or toml formats)
  });

  it('uses pt language when specified', () => {
    installSkills(tempDir, {
      language: 'pt',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    const content = readFileSync(join(tempDir, '.claude/commands/atomic-skills/fix.md'), 'utf8');
    // Portuguese content should have Portuguese keywords
    assert.ok(content.includes('Regra Fundamental') || content.includes('Processo') || content.includes('Red Flags'));
  });

  it('skips .gitignore when scope is user', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
      scope: 'user',
    });

    assert.ok(!existsSync(join(tempDir, '.gitignore')),
      '.gitignore should not be created for user scope');
  });

  it('installs to basePath for user scope (simulated with tempDir)', () => {
    const result = installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
      scope: 'user',
    });

    // Files should still be created at basePath (tempDir simulates homedir)
    assert.ok(existsSync(join(tempDir, '.claude/commands/atomic-skills/fix.md')));

    // Manifest should exist
    const manifest = JSON.parse(readFileSync(join(tempDir, '.atomic-skills/manifest.json'), 'utf8'));
    assert.strictEqual(manifest.language, 'en');

    // .gitignore should NOT exist
    assert.ok(!existsSync(join(tempDir, '.gitignore')));
  });

  it('explicit project scope creates .gitignore', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
      scope: 'project',
    });

    const gitignore = readFileSync(join(tempDir, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.atomic-skills/'));
  });

  it('keeps core-only install count when scope is user and no module is selected', () => {
    const result = installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
      scope: 'user',
    });

    // Only core skills, no module skills (no namespace root for commands)
    assert.strictEqual(result.files.length, 9);
    assert.ok(!existsSync(join(tempDir, '.claude/commands/atomic-skills/init-memory.md')));
  });
});
