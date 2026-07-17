import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import {
  renderReadme,
  renderReadmeFromPaths,
  renderProductEnvelope,
  buildSkillDocs,
  MARKERS,
} from '../scripts/lib/render-readme.js';

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

const minimalProduct = (overrides = {}) => ({
  what_is: 'Battle-tested skill prompts for unit tests.',
  what_is_not: ['A copy-paste prompt pack'],
  docs_url: 'https://atomic-skills.henryavila.com',
  install: { primary: 'npx @henryavila/atomic-skills install' },
  ...overrides,
});

const buildReadmeShell = (extras = '') =>
  `# Header (hand-written)

Some prose.

[PRODUCT_START]: #
placeholder
[PRODUCT_END]: #

[IDES_TABLE_START]: #
placeholder
[IDES_TABLE_END]: #

[VERSION_NOTE_START]: #
[VERSION_NOTE_END]: #

[SKILLS_TABLE_START]: #
placeholder
[SKILLS_TABLE_END]: #

---

[SKILL_DETAILS_START]: #
placeholder
[SKILL_DETAILS_END]: #

[MODULES_START]: #
[MODULES_END]: #

## Hand-written section that must NOT be touched

This text contains a real value: 42.${extras}
`;

describe('renderReadme', () => {
  let tmpRoot;
  let skillsDir;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'gen-readme-'));
    skillsDir = join(tmpRoot, 'skills');
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

  it('renders IDES_TABLE with Tested vs Theoretical support', () => {
    writeFileSync(
      join(skillsDir, 'core', 'demo.md'),
      '## Iron Law\nNO TEST WITHOUT EVIDENCE.\n'
    );
    const data = { core: { demo: minimalV02Entry('demo') } };
    const out = renderReadme({ catalogData: data, readme: buildReadmeShell(), skillsDir });

    const idesSection = out.slice(
      out.indexOf(MARKERS.IDES_START),
      out.indexOf(MARKERS.IDES_END) + MARKERS.IDES_END.length
    );
    assert.ok(idesSection.includes('| Support |'), 'support column header');
    assert.ok(idesSection.includes('| Tested |') || idesSection.includes('Tested |'), 'tested rows');
    assert.ok(idesSection.includes('Theoretical'), 'theoretical rows');
    // Battle-tested set (Claude / Cursor / Codex / Grok)
    for (const id of ['claude-code', 'cursor', 'codex', 'grok']) {
      assert.match(
        idesSection,
        new RegExp(`\\| \`${id}\` \\|[^|]+\\|[^|]+\\| Tested \\|`),
        `${id} must be Tested`
      );
    }
    // Theoretical set
    for (const id of ['gemini', 'gemini-commands', 'opencode', 'github-copilot']) {
      assert.match(
        idesSection,
        new RegExp(`\\| \`${id}\` \\|[^|]+\\|[^|]+\\| Theoretical \\|`),
        `${id} must be Theoretical`
      );
    }
  });

  it('renders product envelope from catalog.product (SSOT)', () => {
    writeFileSync(join(skillsDir, 'core', 'demo.md'), '## Iron Law\nNO X.\n');
    const data = {
      product: minimalProduct(),
      core: { demo: minimalV02Entry('demo') },
    };
    const out = renderReadme({ catalogData: data, readme: buildReadmeShell(), skillsDir });
    const productSection = out.slice(
      out.indexOf(MARKERS.PRODUCT_START),
      out.indexOf(MARKERS.PRODUCT_END) + MARKERS.PRODUCT_END.length
    );
    assert.ok(productSection.includes('## What it is'));
    assert.ok(productSection.includes('Battle-tested skill prompts for unit tests.'));
    assert.ok(productSection.includes('## What it is not'));
    assert.ok(productSection.includes('A copy-paste prompt pack'));
    assert.ok(productSection.includes('## Install'));
    assert.ok(productSection.includes('npx @henryavila/atomic-skills install'));
    assert.ok(productSection.includes('https://atomic-skills.henryavila.com'));
  });

  it('does not render long per-skill value_pitch blurbs in README details', () => {
    writeFileSync(
      join(skillsDir, 'core', 'demo.md'),
      '## Iron Law\nNO TEST WITHOUT EVIDENCE.\n'
    );
    const entry = minimalV02Entry('demo', {
      value_pitch: 'This skill catches bugs before they reach production.',
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
    // Slim envelope: DETAILS body is empty — blurbs deferred to docs site
    assert.ok(
      !detailSection.includes('catches bugs before they reach production'),
      'value pitch must not appear in README details'
    );
    assert.ok(!detailSection.includes('**Iron Law:**'), 'iron law blurb not in details');
    assert.ok(!detailSection.includes('[Full reference →]'), 'per-skill blurbs removed');
    // Compact table still carries the skill index
    assert.ok(out.includes('| | Skill |'));
    assert.ok(out.includes('`demo`'));
  });

  it('leaves MODULES and VERSION_NOTE regions empty in the slim envelope', () => {
    writeFileSync(join(skillsDir, 'core', 'demo.md'), '## Iron Law\nNO X.\n');
    const data = {
      core: { demo: minimalV02Entry('demo') },
      release_highlight: { body: 'Should not appear in slim README.' },
      module_meta: {
        memory: {
          title: 'Memory',
          intro: 'Should not appear in slim README.',
          features: ['x'],
        },
      },
    };
    const out = renderReadme({
      catalogData: data,
      readme: buildReadmeShell(),
      skillsDir,
      pkgVersion: '9.9.9',
    });
    const modules = out.slice(
      out.indexOf(MARKERS.MODULES_START),
      out.indexOf(MARKERS.MODULES_END) + MARKERS.MODULES_END.length
    );
    const version = out.slice(
      out.indexOf(MARKERS.VERSION_NOTE_START),
      out.indexOf(MARKERS.VERSION_NOTE_END) + MARKERS.VERSION_NOTE_END.length
    );
    assert.ok(!modules.includes('Memory'), 'modules section empty');
    assert.ok(!modules.includes('Should not appear'), 'module copy not in README');
    assert.ok(!version.includes('Should not appear'), 'release highlight not in README');
    assert.ok(!version.includes('Note (v9.9.9)'), 'version callout suppressed');
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

  it('prefers catalog iron_law over body extract when present', () => {
    // Body has a different law; generators must use catalog SSOT (design D2).
    writeFileSync(join(skillsDir, 'core', 'demo.md'), '## Iron Law\nBODY LAW ONLY.\n');
    const data = {
      core: {
        demo: minimalV02Entry('demo', { iron_law: 'CATALOG LAW WINS.' }),
      },
    };
    const out = renderReadme({ catalogData: data, readme: buildReadmeShell(), skillsDir });
    assert.ok(out.includes('`CATALOG LAW WINS.`'), 'catalog iron_law used');
    assert.ok(!out.includes('BODY LAW ONLY'), 'body law not used when catalog present');
  });

  it('does not throw on missing body Iron Law when catalog iron_law is set', () => {
    writeFileSync(join(skillsDir, 'core', 'demo.md'), 'No iron law section here.\n');
    const data = {
      core: {
        demo: minimalV02Entry('demo', { iron_law: 'CATALOG ONLY LAW.' }),
      },
    };
    const out = renderReadme({ catalogData: data, readme: buildReadmeShell(), skillsDir });
    assert.ok(out.includes('`CATALOG ONLY LAW.`'));
  });
});

describe('renderProductEnvelope', () => {
  it('renders what_is / what_is_not / install / docs_url', () => {
    const out = renderProductEnvelope(minimalProduct());
    assert.ok(out.includes('## What it is'));
    assert.ok(out.includes('Battle-tested skill prompts for unit tests.'));
    assert.ok(out.includes('- A copy-paste prompt pack'));
    assert.ok(out.includes('```bash\nnpx @henryavila/atomic-skills install\n```'));
    assert.ok(out.includes('https://atomic-skills.henryavila.com'));
  });

  it('returns empty string when product is absent', () => {
    assert.strictEqual(renderProductEnvelope(null), '');
    assert.strictEqual(renderProductEnvelope(undefined), '');
  });

  it('throws on incomplete product', () => {
    assert.throws(() => renderProductEnvelope({}), /what_is/);
    assert.throws(
      () => renderProductEnvelope({ what_is: 'x', what_is_not: [] }),
      /what_is_not/
    );
  });
});

describe('renderReadmeFromPaths (project-root integration)', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'gen-readme-root-'));
    mkdirSync(join(projectRoot, 'meta'), { recursive: true });
    mkdirSync(join(projectRoot, 'skills', 'core'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'skills', 'core', 'demo.md'),
      '## Iron Law\nNO ZERO COVERAGE.\n'
    );
    writeFileSync(
      join(projectRoot, 'meta', 'catalog.yaml'),
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

describe('buildSkillDocs (per-skill reference pages)', () => {
  let tmpRoot;
  let skillsDir;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'skill-docs-'));
    skillsDir = join(tmpRoot, 'skills');
    mkdirSync(join(skillsDir, 'core'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('generates full reference docs with all fields', () => {
    writeFileSync(
      join(skillsDir, 'core', 'demo.md'),
      '## Iron Law\nNO TEST WITHOUT EVIDENCE.\n'
    );
    const entry = minimalV02Entry('demo', {
      value_pitch: 'Catches bugs before production.',
      args: [
        { name: '--flag', kind: 'flag', required: false, description: 'Enable a flag' },
      ],
      output_artifacts: ['.atomic-skills/out.md'],
      dependencies: ['git'],
      related: ['fix'],
      tags: ['testing'],
    });
    const data = { core: { demo: entry } };
    const docs = buildSkillDocs({ catalogData: data, skillsDir });

    assert.strictEqual(docs.length, 1);
    assert.strictEqual(docs[0].key, 'demo');
    const content = docs[0].content;
    assert.ok(content.includes('# `atomic-skills:demo`'), 'H1 with skill key');
    assert.ok(content.includes('`NO TEST WITHOUT EVIDENCE.`'), 'Iron Law');
    assert.ok(content.includes('Catches bugs before production'), 'value pitch');
    assert.ok(content.includes('## Purpose'), 'purpose section');
    assert.ok(content.includes('## Usage'), 'usage section');
    assert.ok(content.includes('## Reference'), 'reference section');
    assert.ok(content.includes('`--flag`'), 'args present');
    assert.ok(content.includes('**Version added:** `3.1.0`'), 'version in metadata');
  });

  it('renders a flat command/description table when subcommands have no group', () => {
    writeFileSync(join(skillsDir, 'core', 'demo.md'), '## Iron Law\nNO X.\n');
    const entry = minimalV02Entry('demo', {
      subcommands: [
        { name: 'go', signature: '<slug>', description: 'Run go', example: '/atomic-skills:demo go x' },
        { name: 'stop', signature: '', description: 'Halt', example: '/atomic-skills:demo stop' },
      ],
    });
    const content = buildSkillDocs({ catalogData: { core: { demo: entry } }, skillsDir })[0].content;
    assert.ok(content.includes('**Subcommands**'), 'subcommands header present');
    assert.ok(content.includes('| Command | Description |'), 'command/description table');
    assert.ok(content.includes('`go <slug>`'), 'command renders name + signature');
    assert.ok(content.includes('`stop`'), 'empty signature renders bare name');
    assert.ok(!content.includes('| Example |'), 'old example column dropped');
  });

  it('renders one table per group, in first-appearance order, with escaped pipes', () => {
    writeFileSync(join(skillsDir, 'core', 'demo.md'), '## Iron Law\nNO X.\n');
    const entry = minimalV02Entry('demo', {
      subcommands: [
        { name: 'push', group: 'Stack', signature: '<desc>', description: 'Open frame', example: '/atomic-skills:demo push x' },
        { name: 'pop', group: 'Stack', signature: '[--a|--b]', description: 'Close frame', example: '/atomic-skills:demo pop' },
        { name: 'park', group: 'Backlog', signature: '<desc>', description: 'Note later', example: '/atomic-skills:demo park x' },
      ],
    });
    const content = buildSkillDocs({ catalogData: { core: { demo: entry } }, skillsDir })[0].content;
    assert.ok(content.includes('*Stack*'), 'first group label present');
    assert.ok(content.includes('*Backlog*'), 'second group label present');
    assert.ok(
      content.indexOf('*Stack*') < content.indexOf('*Backlog*'),
      'groups render in first-appearance order'
    );
    assert.ok(content.includes('`pop [--a\\|--b]`'), 'pipes in signature are escaped for the table');
  });

  it('returns one entry per skill', () => {
    writeFileSync(join(skillsDir, 'core', 'a.md'), '## Iron Law\nNO A.\n');
    writeFileSync(join(skillsDir, 'core', 'b.md'), '## Iron Law\nNO B.\n');
    const data = {
      core: {
        a: minimalV02Entry('a'),
        b: minimalV02Entry('b'),
      },
    };
    const docs = buildSkillDocs({ catalogData: data, skillsDir });
    assert.strictEqual(docs.length, 2);
    const keys = docs.map((d) => d.key);
    assert.ok(keys.includes('a'));
    assert.ok(keys.includes('b'));
  });
});
