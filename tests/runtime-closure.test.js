import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateRuntimeClosure } from '../scripts/validate-runtime-closure.js';
import { PUBLIC_IDE_IDS } from '../src/config.js';
import { computeSkillsFileSet } from '../src/providers/skills-file-set.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(PACKAGE_ROOT, 'skills');
const META_DIR = join(PACKAGE_ROOT, 'meta');

function createFixture(t, catalog) {
  const root = mkdtempSync(join(tmpdir(), 'atomic-skills-runtime-closure-'));
  const skillsDir = join(root, 'skills');
  const metaDir = join(root, 'meta');
  mkdirSync(join(skillsDir, 'shared'), { recursive: true });
  mkdirSync(metaDir, { recursive: true });
  writeFileSync(join(metaDir, 'catalog.yaml'), catalog);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  return {
    skillsDir,
    metaDir,
    writeSkill(relativePath, content) {
      const destination = join(skillsDir, relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, content);
    },
    writeShared(relativePath, content = relativePath) {
      const destination = join(skillsDir, 'shared', relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, content);
    },
  };
}

describe('installed runtime closure', () => {
  it('installs the audited standalone helpers and removes source-tree references', () => {
    const files = computeSkillsFileSet({
      language: 'en',
      ides: ['codex'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
      scope: 'project',
    });
    const paths = new Set(files.map((file) => file.path));

    for (const helper of [
      'worktree-isolation.md',
      'mode2-codex-lane.md',
      'implement-antipatterns.md',
      'debug-techniques.md',
      'diff-capture.md',
      'briefing-template.txt',
    ]) {
      assert.ok(
        paths.has(`.agents/atomic-skills/_assets/${helper}`),
        `missing installed helper: ${helper}`,
      );
    }

    const sourceReferences = files.flatMap((file) =>
      [...file.content.matchAll(/skills\/shared\/[A-Za-z0-9_./-]+/g)].map((match) => ({
        file: file.path,
        reference: match[0],
      })),
    );
    assert.deepEqual(sourceReferences, []);
  });

  it('emits argument-hint on Grok markdown SKILL.md for subcommand skills', () => {
    const files = computeSkillsFileSet({
      language: 'en',
      ides: ['grok'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
      scope: 'project',
    });
    const project = files.find(
      (f) => f.path === '.grok/plugins/atomic-skills/skills/project/SKILL.md',
    );
    assert.ok(project, 'expected grok project SKILL.md in file set');
    assert.match(
      project.content,
      /^---\nname: project\ndescription: '[\s\S]*?'\nargument-hint: '\[status\|/m,
      'Grok project skill must advertise subcommands via argument-hint',
    );
    // Catalog-curated prefix (grammar order); full list lives in subcommands[].
    assert.match(project.content, /argument-hint: '\[status\|help\|verify\|/);
  });

  it('recurses through arbitrary asset depth without flattening nested paths', (t) => {
    const fixture = createFixture(t, [
      'core:',
      '  alpha: { name: alpha, description: alpha }',
      'modules: {}',
      '',
    ].join('\n'));
    for (const relativePath of [
      'alpha-assets/root.md',
      'alpha-assets/one/child.md',
      'alpha-assets/one/two/grandchild.md',
      'alpha-assets/one/two/three/leaf.md',
    ]) {
      fixture.writeShared(relativePath);
    }

    const files = computeSkillsFileSet({
      language: 'en',
      ides: ['codex'],
      modules: {},
      skillsDir: fixture.skillsDir,
      metaDir: fixture.metaDir,
      scope: 'project',
    });
    const paths = new Set(files.map((file) => file.path));

    for (const relativePath of [
      'root.md',
      'one/child.md',
      'one/two/grandchild.md',
      'one/two/three/leaf.md',
    ]) {
      assert.ok(
        paths.has(`.agents/atomic-skills/_assets/${relativePath}`),
        `missing recursive asset: ${relativePath}`,
      );
    }
  });

  it('rejects two asset origins that project onto the same destination', (t) => {
    const fixture = createFixture(t, [
      'core:',
      '  alpha: { name: alpha, description: alpha }',
      '  beta: { name: beta, description: beta }',
      'modules: {}',
      '',
    ].join('\n'));
    fixture.writeShared('alpha-assets/same.md', 'same bytes');
    fixture.writeShared('beta-assets/same.md', 'same bytes');

    assert.throws(
      () => computeSkillsFileSet({
        language: 'en',
        ides: ['codex'],
        modules: {},
        skillsDir: fixture.skillsDir,
        metaDir: fixture.metaDir,
        scope: 'project',
      }),
      (error) => {
        assert.match(error.message, /destination collision/);
        assert.match(error.message, /\.agents\/atomic-skills\/_assets\/same\.md/);
        assert.match(error.message, /_assets\/alpha-assets\/same\.md/);
        assert.match(error.message, /_assets\/beta-assets\/same\.md/);
        return true;
      },
    );
  });

  it('accepts an empty shared directory without emitting asset files', (t) => {
    const fixture = createFixture(t, [
      'core:',
      '  alpha: { name: alpha, description: alpha }',
      'modules: {}',
      '',
    ].join('\n'));
    fixture.writeSkill('core/alpha.md', 'alpha body');

    const files = computeSkillsFileSet({
      language: 'en',
      ides: ['codex'],
      modules: {},
      skillsDir: fixture.skillsDir,
      metaDir: fixture.metaDir,
      scope: 'project',
    });

    assert.deepEqual(
      files.map((file) => file.path).sort(),
      [
        '.agents/skills/atomic-skills/SKILL.md',
        '.agents/skills/atomic-skills/alpha/SKILL.md',
      ],
    );
  });

  it('reports the consumer and reference for unresolved exact and glob assets', (t) => {
    const fixture = createFixture(t, [
      'core:',
      '  alpha: { name: alpha, description: alpha }',
      'modules: {}',
      '',
    ].join('\n'));
    fixture.writeSkill(
      'core/alpha.md',
      [
        '{{READ_TOOL}} `{{ASSETS_PATH}}/missing-helper.md` before continuing.',
        'Then inspect `{{ASSETS_PATH}}/missing-template-*.txt`.',
      ].join('\n'),
    );
    const result = validateRuntimeClosure({
      language: 'en',
      ides: ['codex'],
      scopes: ['project'],
      modules: {},
      skillsDir: fixture.skillsDir,
      metaDir: fixture.metaDir,
    });

    assert.equal(result.ok, false);
    assert.match(result.diagnostics.join('\n'), /alpha\/SKILL\.md/);
    assert.match(result.diagnostics.join('\n'), /missing-helper\.md/);
    assert.match(result.diagnostics.join('\n'), /missing-template-\*\.txt/);
  });

  it('closes the real file-set for every public IDE and install scope', () => {
    const result = validateRuntimeClosure();

    assert.equal(result.ok, true, result.diagnostics.join('\n'));
    assert.equal(result.combinationsChecked, PUBLIC_IDE_IDS.length * 2);
    assert.ok(result.filesChecked > 0);
  });

  it('publishes the closure validator and project help HTML in the npm tarball', () => {
    const packed = spawnSync(
      'npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts'],
      { cwd: PACKAGE_ROOT, encoding: 'utf8' },
    );
    assert.equal(packed.status, 0, packed.stderr || packed.stdout);
    const [manifest] = JSON.parse(packed.stdout);
    const paths = new Set(manifest.files.map((file) => file.path));

    assert.ok(paths.has('scripts/validate-runtime-closure.js'));
    assert.ok(paths.has('docs/design/project-onboarding/index.html'));
  });
});
