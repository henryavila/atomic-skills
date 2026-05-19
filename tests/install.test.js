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
    assert.strictEqual(result.files.length, 30); // 11 core + 11 codex-bridge assets + 7 project-status assets + 1 auto-update hook (no namespace root for commands)
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
    assert.strictEqual(result.files.length, 31); // 11 core + 1 module + 11 codex-bridge assets + 7 project-status assets + 1 auto-update hook (no namespace root for commands)
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
    assert.strictEqual(result.files.length, 59); // (11 core + 11 codex-bridge assets + 7 project-status assets) * 2 IDEs + 1 auto-update hook (no namespace root for command or toml formats)
  });

  it('injects PT communication directive when language=pt; skill body remains EN', () => {
    installSkills(tempDir, {
      language: 'pt',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    const content = readFileSync(join(tempDir, '.claude/commands/atomic-skills/fix.md'), 'utf8');
    // Communication language is injected as a directive at top of body.
    assert.ok(
      content.includes('Communicate with the user in Portuguese'),
      'must inject PT communication directive at top of skill body'
    );
    // Skill source is EN canonical, so body keeps EN section names.
    assert.ok(content.includes('Red Flags'), 'skill body remains EN canonical');
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

    // Only core skills + codex-bridge assets + project-status assets + auto-update hook, no module skills (no namespace root for commands)
    assert.strictEqual(result.files.length, 30);
    assert.ok(!existsSync(join(tempDir, '.claude/commands/atomic-skills/init-memory.md')));
  });

  it('copies shared module assets to each IDE namespace dir', async () => {
    const { tmpdir } = await import('node:os');
    const { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');

    const tmp = mkdtempSync(join(tmpdir(), 'install-assets-'));
    const skillsDir = join(tmp, 'skills');
    const metaDir = join(tmp, 'meta');
    mkdirSync(join(skillsDir, 'shared', 'codex-bridge-assets'), { recursive: true });
    mkdirSync(metaDir, { recursive: true });
    writeFileSync(join(skillsDir, 'shared', 'codex-bridge-assets', 'sample.md'),
      'asset content path={{ASSETS_PATH}}');
    writeFileSync(join(metaDir, 'skills.yaml'),
      'core: {}\nmodules:\n  codex-bridge:\n    name: codex-bridge\n    description: test\n');

    const projectDir = join(tmp, 'project');
    mkdirSync(projectDir, { recursive: true });

    const { installSkills } = await import('../src/install.js');
    installSkills(projectDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir,
      metaDir,
      scope: 'project',
    });

    const expected = join(projectDir, '.claude/commands/atomic-skills/_assets/sample.md');
    assert.ok(existsSync(expected), `expected ${expected} to exist`);
    const content = readFileSync(expected, 'utf8');
    assert.ok(content.includes('.claude/commands/atomic-skills/_assets'),
      'ASSETS_PATH should be substituted');
  });

  it('review-{plan,code}-with-codex renders with ASSETS_PATH for each IDE', async () => {
    const { mkdtempSync, existsSync, readFileSync, mkdirSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join: pjoin, dirname: pdirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const PACKAGE_ROOT = pjoin(pdirname(fileURLToPath(import.meta.url)), '..');
    const skillsDir = pjoin(PACKAGE_ROOT, 'skills');
    const metaDir = pjoin(PACKAGE_ROOT, 'meta');
    const { getSkillPath } = await import('../src/config.js');

    for (const ideId of ['claude-code', 'cursor', 'codex']) {
      const tmp = mkdtempSync(pjoin(tmpdir(), `install-rwc-${ideId}-`));
      const projectDir = pjoin(tmp, 'project');
      mkdirSync(projectDir, { recursive: true });

      installSkills(projectDir, {
        language: 'en',
        ides: [ideId],
        modules: {},
        skillsDir,
        metaDir,
        scope: 'project',
      });

      for (const skillName of ['review-plan-with-codex', 'review-code-with-codex']) {
        const installed = pjoin(projectDir, getSkillPath(ideId, skillName));
        assert.ok(existsSync(installed),
          `${skillName} not installed for ${ideId}: ${installed}`);
        const content = readFileSync(installed, 'utf8');
        assert.ok(!content.includes('{{ASSETS_PATH}}'),
          `${ideId}/${skillName} still has unsubstituted {{ASSETS_PATH}}`);
        assert.ok(content.includes('_assets'),
          `${ideId}/${skillName} missing _assets path reference`);
      }
    }
  });

  it('copies codex-bridge and project-status assets to claude-code namespace', async () => {
    const { mkdtempSync, existsSync, readdirSync, mkdirSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join: pjoin, dirname: pdirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const tmp = mkdtempSync(pjoin(tmpdir(), 'install-codex-'));
    const projectDir = pjoin(tmp, 'project');
    mkdirSync(projectDir, { recursive: true });

    const PACKAGE_ROOT = pjoin(pdirname(fileURLToPath(import.meta.url)), '..');
    const realSkillsDir = pjoin(PACKAGE_ROOT, 'skills');
    const realMetaDir = pjoin(PACKAGE_ROOT, 'meta');

    installSkills(projectDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: realSkillsDir,
      metaDir: realMetaDir,
      scope: 'project',
    });

    const assetsDir = pjoin(projectDir, '.claude/commands/atomic-skills/_assets');
    assert.ok(existsSync(assetsDir), 'assets dir should exist');
    const files = readdirSync(assetsDir);
    // 11 codex-bridge + 7 project-status (hooks subdir is skipped — not a file)
    assert.strictEqual(files.length, 18,
      `expected 18 assets (11 codex-bridge + 7 project-status), got ${files.length}: ${files.join(', ')}`);
    // Spot-check one from each origin
    assert.ok(files.includes('preflight-checks.txt'), 'must include codex-bridge asset');
    assert.ok(files.includes('CLAUDE.md-gate.template.md'), 'must include project-status asset');
  });
});

describe('install.js source guards', () => {
  // Catches regressions like calling a helper after it was renamed/removed.
  // The interactive path is hard to exercise via tests, so we statically verify
  // that deleted symbols are not still referenced.
  const SRC = readFileSync(join(__dirname, '..', 'src', 'install.js'), 'utf8');

  it('does not reference removed deduplicateGeminiCodex helper', () => {
    assert.ok(
      !SRC.includes('deduplicateGeminiCodex'),
      'src/install.js still references deduplicateGeminiCodex — use normalizeIDESelection from ./config.js'
    );
  });
});
