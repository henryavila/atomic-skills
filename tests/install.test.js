import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { install, installSkills, resolveProjectScopeTarget, installRuntimeArtifacts } from '../src/install.js';

/** Builds a throwaway @henryavila/aideck-shaped package dir (dist/cli.js +
 *  dist/client/index.html) so installRuntimeArtifacts can be exercised without
 *  the real published dependency on disk. */
function fakeAideckPkg() {
  const dir = mkdtempSync(join(tmpdir(), 'as-fake-aideck-'));
  mkdirSync(join(dir, 'dist', 'client'), { recursive: true });
  writeFileSync(join(dir, 'dist', 'cli.js'), 'export {}\n');
  writeFileSync(join(dir, 'dist', 'client', 'index.html'), '<!doctype html><title>aideck</title>\n');
  return dir;
}

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
    assert.strictEqual(result.files.length, 69); // post-consolidation footprint (single IDE, no module): 14 core skills + 16 shared codex/debate assets + 26 project-assets top-level (incl. project-consolidate.md + review-plan-target-resolution.md) + 5 hooks + 4 design-brief-assets + namespace root + auto-update hook
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
    assert.strictEqual(result.files.length, 70); // post-consolidation footprint (single IDE + 1 module skill): the no-module count (69) + 1 enabled module skill
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

  it('does not touch .gitignore (the .atomic-skills/ tree is tracked, not ignored)', () => {
    // A pre-existing .gitignore must be left byte-for-byte unchanged: the
    // installer no longer appends a .atomic-skills/ ignore line.
    const before = 'node_modules/\ndist/\n';
    writeFileSync(join(tempDir, '.gitignore'), before);

    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    assert.equal(
      readFileSync(join(tempDir, '.gitignore'), 'utf8'),
      before,
      'installer must not modify .gitignore anymore',
    );
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
    assert.strictEqual(result.files.length, 137); // post-consolidation footprint across 2 IDEs (claude-code + gemini-commands), command/toml formats (no namespace root) + one auto-update hook (incl. project-consolidate.md + review-plan-target-resolution.md ×2 IDEs)
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

  it('explicit project scope does not create .gitignore', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
      scope: 'project',
    });

    assert.ok(!existsSync(join(tempDir, '.gitignore')),
      'project scope must not create .gitignore anymore');
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

    // Only core skills + shared assets + project assets (incl. 5 hooks) + namespace root + auto-update hook, no module skills
    assert.strictEqual(result.files.length, 69); // post-consolidation: core skills + shared assets + project-assets (incl. 5 hooks + project-consolidate.md + review-plan-target-resolution.md) + design-brief skill+assets + namespace root + auto-update hook, no module skills
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
    writeFileSync(join(metaDir, 'catalog.yaml'),
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

  it('review-{plan,code} render with ASSETS_PATH substituted (codex sub-flow assets reachable per IDE)', async () => {
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

      for (const skillName of ['review-plan', 'review-code']) {
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

  it('copies codex-bridge and project assets to claude-code namespace', async () => {
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
    // post-consolidation namespace assets: codex-bridge assets + project-assets top-level + hooks/ subdir + design-brief-assets = 50 entries (incl. project-consolidate.md + review-plan-target-resolution.md)
    assert.strictEqual(files.length, 50,
      `expected 50 namespace asset entries (codex-bridge + project-assets + hooks/ dir + design-brief-assets), got ${files.length}: ${files.join(', ')}`);
    // F-001 guard: hooks subdir is now recursively installed (was previously dropped silently)
    const hooksDir = pjoin(assetsDir, 'hooks');
    assert.ok(existsSync(hooksDir), '_assets/hooks/ must exist');
    for (const h of ['session-start.sh', 'stop.sh', 'pre-write.sh', 'config.json']) {
      assert.ok(existsSync(pjoin(hooksDir, h)), `_assets/hooks/${h} must be installed`);
    }
    // Spot-check one from each origin
    assert.ok(files.includes('preflight-checks.txt'), 'must include codex-bridge asset');
    assert.ok(files.includes('CLAUDE.md-gate.template.md'), 'must include project-status asset');
    assert.ok(files.includes('minimal-source.template.md'), 'must include project asset (minimal-source)');
    assert.ok(files.includes('project-view.md'), 'must include project lazy detail (project-view)');
  });
});

describe('install command artifacts', () => {
  it('stages the aideck launcher shim + client from the resolved published package', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-install-home-'));
    const aideckDir = fakeAideckPkg();
    const originalHome = process.env.HOME;

    try {
      process.env.HOME = fakeHome;
      installRuntimeArtifacts({ aideckDir });

      const shim = join(fakeHome, '.atomic-skills', 'bin', 'aideck.mjs');
      assert.ok(existsSync(shim), 'must write the launcher shim');
      // The shim rewrites argv[1] to the resolved published cli, then imports
      // it — so the CLI's `import.meta.url===pathToFileURL(argv[1])` guard fires.
      const cliLit = JSON.stringify(join(aideckDir, 'dist', 'cli.js'));
      const shimBody = readFileSync(shim, 'utf8');
      assert.ok(shimBody.includes(`process.argv[1] = ${cliLit}`), 'shim must rewrite argv[1] to the cli');
      assert.ok(shimBody.includes(`await import(${cliLit})`), 'shim must import the resolved cli');
      assert.ok(
        existsSync(join(fakeHome, '.atomic-skills', 'dashboard', 'index.html')),
        'must copy the aideck client to the dashboard dir'
      );
    } finally {
      if (originalHome === undefined) delete process.env.HOME;
      else process.env.HOME = originalHome;
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(aideckDir, { recursive: true, force: true });
    }
  });

  it('skips the aideck shim + client gracefully when the package is unresolved (pre-publish)', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-install-home-'));
    const originalHome = process.env.HOME;
    try {
      process.env.HOME = fakeHome;
      // aideckDir: null mirrors the pre-publish / stripped-checkout reality.
      assert.doesNotThrow(() => installRuntimeArtifacts({ aideckDir: null }));
      assert.ok(!existsSync(join(fakeHome, '.atomic-skills', 'bin', 'aideck.mjs')), 'no shim without the package');
      assert.ok(!existsSync(join(fakeHome, '.atomic-skills', 'dashboard')), 'no dashboard without the package');
      // The consumer template + provisioner are staged from this package regardless.
      assert.ok(
        existsSync(join(fakeHome, '.atomic-skills', 'aideck-consumer', 'manifest.yaml')),
        'consumer template still staged'
      );
    } finally {
      if (originalHome === undefined) delete process.env.HOME;
      else process.env.HOME = originalHome;
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  it('resolves project scope to the git root when run from a subdirectory', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-install-home-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-install-repo-'));
    const nested = join(repo, 'src', 'nested');
    const originalHome = process.env.HOME;

    try {
      mkdirSync(nested, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: repo });
      process.env.HOME = fakeHome;

      await install(nested, {
        yes: true,
        project: true,
        ide: ['claude-code'],
        lang: 'en',
      });

      assert.ok(existsSync(join(repo, '.claude/commands/atomic-skills/fix.md')));
      assert.ok(existsSync(join(repo, '.atomic-skills/manifest.json')));
      assert.ok(!existsSync(join(nested, '.claude/commands/atomic-skills/fix.md')));
      assert.ok(!existsSync(join(nested, '.atomic-skills/manifest.json')));
    } finally {
      if (originalHome === undefined) delete process.env.HOME;
      else process.env.HOME = originalHome;
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('rejects project scope outside a git worktree', () => {
    const dir = mkdtempSync(join(tmpdir(), 'as-install-not-repo-'));
    try {
      const result = resolveProjectScopeTarget(dir);
      assert.equal(result.ok, false);
      assert.match(result.reason, /not inside a Git repository/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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

import {
  findLegacyOrphans,
  removeLegacyOrphans,
  isAtomicSkillsArtifact,
} from '../src/install.js';
import { existsSync as fsExistsSync, mkdirSync as fsMkdirSync, writeFileSync as fsWriteFileSync, rmSync as fsRmSync, mkdtempSync as fsMkdtempSync } from 'node:fs';
import { tmpdir as fsTmpdir } from 'node:os';
import { join as pjoin, dirname as pdirname } from 'node:path';

describe('findLegacyOrphans + removeLegacyOrphans', () => {
  let tmp;
  beforeEach(() => {
    tmp = fsMkdtempSync(pjoin(fsTmpdir(), 'as-legacy-'));
  });
  afterEach(() => {
    fsRmSync(tmp, { recursive: true, force: true });
  });

  const writeSkill = (subPath, name) => {
    const full = pjoin(tmp, subPath);
    fsMkdirSync(pdirname(full), { recursive: true });
    fsWriteFileSync(full, `---\nname: ${name}\ndescription: test\n---\n\nBody\n`);
    return full;
  };

  it('returns empty when no legacy paths exist', () => {
    const orphans = findLegacyOrphans(tmp, new Set(['fix']));
    assert.deepEqual(orphans, []);
  });

  it('finds files under <legacyRoot>/atomic-skills/', () => {
    writeSkill('.claude/skills/atomic-skills/fix/SKILL.md', 'fix');
    writeSkill('.claude/skills/atomic-skills/hunt/SKILL.md', 'hunt');
    const orphans = findLegacyOrphans(tmp, new Set(['fix', 'hunt']));
    assert.equal(orphans.length, 2);
  });

  it('marks orphans with frontmatter `name:` matching current known names as safe', () => {
    writeSkill('.claude/skills/atomic-skills/fix/SKILL.md', 'fix');
    const [orphan] = findLegacyOrphans(tmp, new Set(['fix']));
    assert.equal(orphan.safe, true);
  });

  it('marks orphans matching HISTORICAL names as safe (removed skills)', () => {
    writeSkill('.claude/skills/atomic-skills/review-plan-internal/SKILL.md', 'review-plan-internal');
    const [orphan] = findLegacyOrphans(tmp, new Set(['fix']));
    assert.equal(orphan.safe, true);
  });

  it('marks files WITHOUT atomic-skills signature as UNSAFE (preserve)', () => {
    writeSkill('.claude/skills/atomic-skills/my-custom/SKILL.md', 'my-custom-thing');
    const [orphan] = findLegacyOrphans(tmp, new Set(['fix']));
    assert.equal(orphan.safe, false);
  });

  it('marks files without frontmatter as UNSAFE', () => {
    const full = pjoin(tmp, '.claude/skills/atomic-skills/random.txt');
    fsMkdirSync(pdirname(full), { recursive: true });
    fsWriteFileSync(full, 'plain text no frontmatter');
    const [orphan] = findLegacyOrphans(tmp, new Set(['fix']));
    assert.equal(orphan.safe, false);
  });

  it('treats namespace root SKILL.md as safe (name = atomic-skills)', () => {
    const full = pjoin(tmp, '.claude/skills/atomic-skills/SKILL.md');
    fsMkdirSync(pdirname(full), { recursive: true });
    fsWriteFileSync(full, `---\nname: atomic-skills\ndescription: ns\n---\n\nBody\n`);
    const [orphan] = findLegacyOrphans(tmp, new Set());
    assert.equal(orphan.safe, true);
  });

  it('removes safe orphans + walks back up empty parents up to namespace root', () => {
    writeSkill('.claude/skills/atomic-skills/fix/SKILL.md', 'fix');
    writeSkill('.claude/skills/atomic-skills/hunt/SKILL.md', 'hunt');
    const orphans = findLegacyOrphans(tmp, new Set(['fix', 'hunt']));
    removeLegacyOrphans(tmp, orphans);
    // Files removed
    assert.equal(fsExistsSync(pjoin(tmp, '.claude/skills/atomic-skills/fix/SKILL.md')), false);
    // Sub-dirs removed
    assert.equal(fsExistsSync(pjoin(tmp, '.claude/skills/atomic-skills/fix')), false);
    // Namespace root removed (empty)
    assert.equal(fsExistsSync(pjoin(tmp, '.claude/skills/atomic-skills')), false);
    // Legacy dir PRESERVED (not ours)
    assert.equal(fsExistsSync(pjoin(tmp, '.claude/skills')), true);
  });

  it('L1: does NOT walk into sibling dirs with prefix collision', () => {
    // Sibling dir starting with namespace prefix
    writeSkill('.claude/skills/atomic-skills/fix/SKILL.md', 'fix');
    fsMkdirSync(pjoin(tmp, '.claude/skills/atomic-skills-sibling/inner'), { recursive: true });
    fsWriteFileSync(pjoin(tmp, '.claude/skills/atomic-skills-sibling/inner/keep.md'), 'do not touch');
    const orphans = findLegacyOrphans(tmp, new Set(['fix']));
    removeLegacyOrphans(tmp, orphans);
    // Sibling preserved
    assert.equal(fsExistsSync(pjoin(tmp, '.claude/skills/atomic-skills-sibling/inner/keep.md')), true);
  });
});

describe('isAtomicSkillsArtifact', () => {
  let tmp;
  beforeEach(() => { tmp = fsMkdtempSync(pjoin(fsTmpdir(), 'as-art-')); });
  afterEach(() => { fsRmSync(tmp, { recursive: true, force: true }); });

  const write = (name, content) => {
    const p = pjoin(tmp, name);
    fsWriteFileSync(p, content);
    return p;
  };

  it('returns true when frontmatter name matches known current skill', () => {
    const p = write('a.md', `---\nname: fix\n---\nbody`);
    assert.equal(isAtomicSkillsArtifact(p, new Set(['fix'])), true);
  });

  it('returns true when frontmatter name matches historical skill', () => {
    const p = write('a.md', `---\nname: review-plan-internal\n---\nbody`);
    assert.equal(isAtomicSkillsArtifact(p, new Set()), true);
  });

  it('returns false when frontmatter name is unknown', () => {
    const p = write('a.md', `---\nname: my-thing\n---\nbody`);
    assert.equal(isAtomicSkillsArtifact(p, new Set(['fix'])), false);
  });

  it('returns false when no frontmatter', () => {
    const p = write('a.md', `plain text`);
    assert.equal(isAtomicSkillsArtifact(p, new Set(['fix'])), false);
  });

  it('returns false when frontmatter has no name field', () => {
    const p = write('a.md', `---\ndescription: foo\n---\nbody`);
    assert.equal(isAtomicSkillsArtifact(p, new Set(['fix'])), false);
  });

  it('returns false on unreadable file (conservative preserve)', () => {
    assert.equal(isAtomicSkillsArtifact('/nonexistent/path/file.md', new Set(['fix'])), false);
  });

  it('handles quoted frontmatter name', () => {
    const p1 = write('a.md', `---\nname: "fix"\n---\nbody`);
    const p2 = write('b.md', `---\nname: 'fix'\n---\nbody`);
    assert.equal(isAtomicSkillsArtifact(p1, new Set(['fix'])), true);
    assert.equal(isAtomicSkillsArtifact(p2, new Set(['fix'])), true);
  });
});
