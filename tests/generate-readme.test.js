import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { renderReadme, renderReadmeFromPaths, MARKERS } from '../scripts/lib/render-readme.js';

const minimalV02Entry = (name, overrides = {}) => ({
  name,
  title: `${name} — Demo`,
  description: 'A demo skill used by tests.',
  purpose: 'A demo skill used by tests.',
  when_to_use: ['Testing'],
  when_not_to_use: ['Production'],
  examples: [{ command: `/atomic-skills:${name}`, description: 'Run the skill' }],
  one_liner: 'Compact demo skill used by unit tests',
  emoji: '🧪',
  version_added: '3.1.0',
  schema_version: '0.2',
  ...overrides,
});

const buildReadmeShell = (extras = '') =>
  `# Header (hand-written)

Some prose.

<!-- SKILLS_TABLE_START -->
placeholder
<!-- SKILLS_TABLE_END -->

---

<!-- SKILL_DETAILS_START -->
placeholder
<!-- SKILL_DETAILS_END -->

## Hand-written section that must NOT be touched

This text contains a real value: 42.${extras}
`;

describe('renderReadme', () => {
  let tmpRoot;
  let skillsDir;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'gen-readme-'));
    skillsDir = join(tmpRoot, 'skills', 'en');
    mkdirSync(join(skillsDir, 'core'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('renders the SKILLS_TABLE between markers', () => {
    writeFileSync(
      join(skillsDir, 'core', 'demo.md'),
      '## Iron Law\nNO TEST WITHOUT EVIDENCE.\n'
    );
    const data = { core: { demo: minimalV02Entry('demo') } };
    const out = renderReadme({ catalogData: data, readme: buildReadmeShell(), skillsDir });

    const tableSection = out.slice(
      out.indexOf(MARKERS.TABLE_START),
      out.indexOf(MARKERS.TABLE_END) + MARKERS.TABLE_END.length
    );
    assert.ok(tableSection.includes('| | Skill |'));
    assert.ok(tableSection.includes('🧪'));
    assert.ok(tableSection.includes('`demo`'));
    assert.ok(tableSection.includes('`NO TEST WITHOUT EVIDENCE.`'));
  });

  it('renders skill detail sections with all v0.2 fields', () => {
    writeFileSync(
      join(skillsDir, 'core', 'demo.md'),
      '## Iron Law\nNO TEST WITHOUT EVIDENCE.\n'
    );
    const entry = minimalV02Entry('demo', {
      subcommands: [
        {
          name: 'go',
          signature: '<slug>',
          description: 'Run go subcommand',
          example: '/atomic-skills:demo go thing',
        },
      ],
      args: [
        {
          name: '--flag',
          kind: 'flag',
          required: false,
          description: 'Enable a flag',
        },
      ],
      output_artifacts: ['.atomic-skills/out.md'],
      dependencies: ['git'],
      related: [],
      tags: ['testing'],
    });
    const data = { core: { demo: entry } };
    const out = renderReadme({ catalogData: data, readme: buildReadmeShell(), skillsDir });

    const detailSection = out.slice(
      out.indexOf(MARKERS.DETAILS_START),
      out.indexOf(MARKERS.DETAILS_END) + MARKERS.DETAILS_END.length
    );
    assert.ok(detailSection.includes('### `atomic-skills:demo`'));
    assert.ok(detailSection.includes('**Iron Law:** `NO TEST WITHOUT EVIDENCE.`'));
    assert.ok(detailSection.includes('**One-liner:**'));
    assert.ok(detailSection.includes('**Subcommands:**'));
    assert.ok(detailSection.includes('`/atomic-skills:demo go thing`'));
    assert.ok(detailSection.includes('**Arguments:**'));
    assert.ok(detailSection.includes('`--flag`'));
    assert.ok(detailSection.includes('**Output artifacts:** `.atomic-skills/out.md`'));
    assert.ok(detailSection.includes('**Dependencies:** `git`'));
    assert.ok(detailSection.includes('**Version added:** `3.1.0`'));
  });

  it('preserves hand-written content outside markers', () => {
    writeFileSync(join(skillsDir, 'core', 'demo.md'), '## Iron Law\nNO X.\n');
    const data = { core: { demo: minimalV02Entry('demo') } };
    const before = buildReadmeShell('\n\nMore prose with secret-marker-XYZ.');
    const out = renderReadme({ catalogData: data, readme: before, skillsDir });

    assert.ok(out.includes('secret-marker-XYZ'), 'hand-written tail preserved');
    assert.ok(out.includes('# Header (hand-written)'), 'header preserved');
    assert.ok(
      out.includes('## Hand-written section that must NOT be touched'),
      'hand-written section preserved'
    );
    assert.ok(out.includes('a real value: 42.'), 'hand-written paragraph preserved');
  });

  it('throws when README is missing required markers', () => {
    writeFileSync(join(skillsDir, 'core', 'demo.md'), '## Iron Law\nNO X.\n');
    const data = { core: { demo: minimalV02Entry('demo') } };
    const readmeWithoutMarkers = '# README\n\nNo markers here.\n';
    assert.throws(
      () => renderReadme({ catalogData: data, readme: readmeWithoutMarkers, skillsDir }),
      /missing required marker/
    );
  });

  it('throws when a skill body lacks `## Iron Law`', () => {
    writeFileSync(join(skillsDir, 'core', 'demo.md'), 'No iron law here.\n');
    const data = { core: { demo: minimalV02Entry('demo') } };
    assert.throws(
      () => renderReadme({ catalogData: data, readme: buildReadmeShell(), skillsDir }),
      /missing canonical `## Iron Law`/
    );
  });
});

describe('renderReadmeFromPaths (project-root integration)', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'gen-readme-root-'));
    mkdirSync(join(projectRoot, 'meta'), { recursive: true });
    mkdirSync(join(projectRoot, 'skills', 'en', 'core'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'skills', 'en', 'core', 'demo.md'),
      '## Iron Law\nNO ZERO COVERAGE.\n'
    );
    writeFileSync(
      join(projectRoot, 'meta', 'skills.yaml'),
      stringify({ core: { demo: minimalV02Entry('demo') } })
    );
    writeFileSync(join(projectRoot, 'README.md'), buildReadmeShell());
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('is idempotent: running the generator twice produces the same output', () => {
    const first = renderReadmeFromPaths({ projectRoot });
    writeFileSync(join(projectRoot, 'README.md'), first);
    const second = renderReadmeFromPaths({ projectRoot });
    assert.strictEqual(first, second);
  });
});
