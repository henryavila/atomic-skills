import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  validateSkill,
  validateCatalog,
  ACCEPTED_SCHEMA_VERSIONS,
} from '../scripts/lib/validate-skills-core.js';

const baseV01 = (overrides = {}) => ({
  name: 'demo',
  title: 'Demo — Test',
  description: 'A test skill used by unit tests.',
  purpose: 'A test skill used by unit tests.',
  when_to_use: ['Testing'],
  when_not_to_use: ['Production'],
  examples: [{ command: '/atomic-skills:demo', description: 'Run demo' }],
  schema_version: '0.1',
  ...overrides,
});

const baseV02 = (overrides = {}) =>
  baseV01({
    schema_version: '0.2',
    one_liner: 'Compact demo skill used by unit tests',
    emoji: '🧪',
    version_added: '3.1.0',
    ...overrides,
  });

const known = (names = ['demo']) => new Set(names);

describe('validateSkill — legacy v0.1 rejection', () => {
  it('rejects a schema_version "0.1" entry after the hard cut', () => {
    const issues = validateSkill('demo', baseV01(), known());
    assert.ok(
      issues.some((m) => m.includes('unsupported schema_version "0.1"')),
      JSON.stringify(issues)
    );
  });

  it('rejects unknown schema_version', () => {
    const issues = validateSkill('demo', baseV02({ schema_version: '9.9' }), known());
    assert.ok(issues.some((m) => m.includes('unsupported schema_version "9.9"')));
  });

  it('rejects missing required field', () => {
    const e = baseV02();
    delete e.purpose;
    const issues = validateSkill('demo', e, known());
    assert.ok(issues.some((m) => m.includes('missing required field: purpose')));
  });

  it('rejects related ref to unknown skill', () => {
    const issues = validateSkill('demo', baseV02({ related: ['ghost'] }), known());
    assert.ok(issues.some((m) => m.includes('related references unknown skill "ghost"')));
  });

  it('rejects ide_compatibility with unknown IDE', () => {
    const issues = validateSkill(
      'demo',
      baseV02({ ide_compatibility: ['neovim'] }),
      known()
    );
    assert.ok(issues.some((m) => m.includes('unknown IDE "neovim"')));
  });
});

describe('validateSkill — v0.2 entries', () => {
  it('passes a fully valid v0.2 entry', () => {
    const issues = validateSkill('demo', baseV02(), known());
    assert.deepStrictEqual(issues, []);
  });

  it('rejects v0.2 entry without one_liner', () => {
    const e = baseV02();
    delete e.one_liner;
    const issues = validateSkill('demo', e, known());
    assert.ok(issues.some((m) => m.includes('missing required v0.2 field: one_liner')));
  });

  it('rejects v0.2 entry without emoji', () => {
    const e = baseV02();
    delete e.emoji;
    const issues = validateSkill('demo', e, known());
    assert.ok(issues.some((m) => m.includes('missing required v0.2 field: emoji')));
  });

  it('rejects malformed version_added', () => {
    const issues = validateSkill('demo', baseV02({ version_added: '3.0' }), known());
    assert.ok(issues.some((m) => m.includes('version_added must match')));
  });

  it('rejects one_liner outside 10-80 chars', () => {
    const tooShort = validateSkill('demo', baseV02({ one_liner: 'short' }), known());
    assert.ok(tooShort.some((m) => m.includes('one_liner must be 10-80 chars')));

    const tooLong = validateSkill(
      'demo',
      baseV02({ one_liner: 'x'.repeat(100) }),
      known()
    );
    assert.ok(tooLong.some((m) => m.includes('one_liner must be 10-80 chars')));
  });

  it('rejects argument_hint over 120 chars (composer placeholder breaks on long hints)', () => {
    const tooLong = validateSkill(
      'demo',
      baseV02({ argument_hint: `[${'subcmd|'.repeat(20)}end]` }),
      known()
    );
    assert.ok(
      tooLong.some((m) => m.includes('argument_hint must be at most 120 chars')),
      JSON.stringify(tooLong)
    );
  });

  it('accepts argument_hint at exactly 120 chars', () => {
    const issues = validateSkill(
      'demo',
      baseV02({ argument_hint: `[${'x'.repeat(118)}]` }),
      known()
    );
    assert.ok(
      !issues.some((m) => m.includes('argument_hint must be at most')),
      JSON.stringify(issues)
    );
  });
});

describe('validateSkill — subcommands', () => {
  const withSubs = (subcommands) => baseV02({ subcommands });

  it('passes a valid subcommand list', () => {
    const issues = validateSkill(
      'demo',
      withSubs([
        {
          name: 'new',
          signature: '<slug>',
          description: 'Create a new thing',
          example: '/atomic-skills:demo new my-thing',
        },
      ]),
      known()
    );
    assert.deepStrictEqual(issues, []);
  });

  it('rejects subcommand without name', () => {
    const issues = validateSkill(
      'demo',
      withSubs([{ signature: '', description: 'x', example: '/atomic-skills:demo' }]),
      known()
    );
    assert.ok(issues.some((m) => m.includes('subcommands[0].name is required')));
  });

  it('rejects duplicate subcommand names within a skill', () => {
    const subs = [
      {
        name: 'pop',
        signature: '',
        description: 'A',
        example: '/atomic-skills:demo pop',
      },
      {
        name: 'pop',
        signature: '',
        description: 'B',
        example: '/atomic-skills:demo pop --park',
      },
    ];
    const issues = validateSkill('demo', withSubs(subs), known());
    assert.ok(issues.some((m) => m.includes('"pop" is duplicated')));
  });

  it('rejects subcommand example that does not begin with /atomic-skills:<name>', () => {
    const issues = validateSkill(
      'demo',
      withSubs([
        {
          name: 'go',
          signature: '',
          description: 'X',
          example: '/atomic-skills:other go',
        },
      ]),
      known()
    );
    assert.ok(issues.some((m) => m.includes('must start with "/atomic-skills:demo"')));
  });

  it('rejects non-kebab-case subcommand name', () => {
    const issues = validateSkill(
      'demo',
      withSubs([
        {
          name: 'NewThing',
          signature: '',
          description: 'X',
          example: '/atomic-skills:demo NewThing',
        },
      ]),
      known()
    );
    assert.ok(issues.some((m) => m.includes('must be kebab-case')));
  });
});

describe('validateSkill — args', () => {
  const withArgs = (args) => baseV02({ args });

  it('passes valid args (positional + flag + option)', () => {
    const issues = validateSkill(
      'demo',
      withArgs([
        { name: 'symptom', kind: 'positional', required: false, description: 'desc' },
        { name: '--flag', kind: 'flag', required: false, description: 'desc' },
        {
          name: '--target',
          kind: 'option',
          required: false,
          description: 'desc',
          default: 'active phase',
        },
      ]),
      known()
    );
    assert.deepStrictEqual(issues, []);
  });

  it('rejects args with invalid kind', () => {
    const issues = validateSkill(
      'demo',
      withArgs([{ name: 'foo', kind: 'switch', required: true, description: 'x' }]),
      known()
    );
    assert.ok(issues.some((m) => m.includes('args[0].kind must be one of')));
  });

  it('rejects args.default that is not a string', () => {
    const issues = validateSkill(
      'demo',
      withArgs([
        {
          name: '--n',
          kind: 'option',
          required: false,
          description: 'x',
          default: 42,
        },
      ]),
      known()
    );
    assert.ok(issues.some((m) => m.includes('default must be a string')));
  });
});

describe('ACCEPTED_SCHEMA_VERSIONS', () => {
  it('is narrowed to {0.2} after the v0.1 hard cut', () => {
    assert.ok(ACCEPTED_SCHEMA_VERSIONS.has('0.2'));
    assert.ok(!ACCEPTED_SCHEMA_VERSIONS.has('0.1'));
  });
});

describe('validateCatalog — cross-checks', () => {
  let tmpRoot;
  let skillsDir;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'validate-skills-'));
    skillsDir = join(tmpRoot, 'skills');
    mkdirSync(join(skillsDir, 'core'), { recursive: true });
    mkdirSync(join(skillsDir, 'modules', 'memory'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('passes when every catalog entry has a matching body and vice versa', () => {
    writeFileSync(join(skillsDir, 'core', 'demo.md'), '## Iron Law\nNO TEST WITHOUT EVIDENCE.\n');
    writeFileSync(
      join(skillsDir, 'modules', 'memory', 'init-memory.md'),
      '## Iron Law\nNO DELETION WITHOUT CONFIRMED BACKUP.\n'
    );
    const data = {
      core: { demo: baseV02() },
      modules: { memory: { 'init-memory': baseV02({ name: 'init-memory' }) } },
    };
    const report = validateCatalog(data, { skillsDir });
    assert.strictEqual(report.totalIssues, 0, JSON.stringify(report.failures));
  });

  it('fails when a catalog entry has no body on disk', () => {
    const data = { core: { demo: baseV02() } };
    const report = validateCatalog(data, { skillsDir });
    assert.strictEqual(report.failedSkills, 1);
    assert.ok(
      report.failures.some((f) =>
        f.issues.some((m) => m.includes('skill body missing on disk'))
      )
    );
  });

  it('fails when a body exists without a catalog entry', () => {
    writeFileSync(join(skillsDir, 'core', 'ghost.md'), '## Iron Law\nGhost.\n');
    writeFileSync(join(skillsDir, 'core', 'demo.md'), '## Iron Law\nDemo.\n');
    const data = { core: { demo: baseV02() } };
    const report = validateCatalog(data, { skillsDir });
    assert.ok(
      report.failures.some((f) =>
        f.issues.some((m) => m.includes('body exists on disk without a catalog entry'))
      ),
      JSON.stringify(report.failures)
    );
  });

  it('Iron Law check is opt-in via `requireIronLaw`', () => {
    writeFileSync(join(skillsDir, 'core', 'demo.md'), 'No iron law header here.\n');
    const data = { core: { demo: baseV02() } };

    const off = validateCatalog(data, { skillsDir });
    assert.strictEqual(off.totalIssues, 0);

    const on = validateCatalog(data, { skillsDir, requireIronLaw: true });
    assert.ok(
      on.failures.some((f) =>
        f.issues.some((m) => m.includes('missing canonical `## Iron Law`'))
      )
    );
  });

  it('reports parse error when data is not an object', () => {
    const report = validateCatalog(null, { skillsDir });
    assert.ok(report.parseError);
  });
});

import {
  validateModuleMeta,
  validateReadmeMentions,
  validateCatalogVersion,
  validateReleaseHighlight,
} from '../scripts/lib/validate-skills-core.js';

describe('validateModuleMeta', () => {
  it('returns no issues when module_meta absent and modules empty', () => {
    assert.deepEqual(validateModuleMeta({ modules: {} }), []);
    assert.deepEqual(validateModuleMeta({}), []);
  });

  it('flags missing module_meta when modules has entries', () => {
    const issues = validateModuleMeta({ modules: { foo: {}, bar: {} } });
    assert.equal(issues.length, 1);
    assert.match(issues[0], /module_meta block missing/);
    assert.match(issues[0], /2 module/);
  });

  it('flags orphan module_meta keys (no matching module)', () => {
    const data = {
      modules: { foo: {} },
      module_meta: {
        foo: { title: 'Foo', intro: 'F' },
        ghost: { title: 'Ghost', intro: 'G' },
      },
    };
    const issues = validateModuleMeta(data);
    assert.ok(issues.some((i) => i.includes('module_meta.ghost has no matching')));
  });

  it('flags modules missing from module_meta (undocumented)', () => {
    const data = {
      modules: { foo: {}, undocumented: {} },
      module_meta: { foo: { title: 'Foo', intro: 'F' } },
    };
    const issues = validateModuleMeta(data);
    assert.ok(issues.some((i) => i.includes('modules.undocumented has no module_meta')));
  });

  it('flags missing required fields (title, intro)', () => {
    const data = {
      modules: { foo: {} },
      module_meta: { foo: { /* no title, no intro */ } },
    };
    const issues = validateModuleMeta(data);
    assert.ok(issues.some((i) => i.includes('module_meta.foo.title is required')));
    assert.ok(issues.some((i) => i.includes('module_meta.foo.intro is required')));
  });

  it('flags malformed version_added', () => {
    const data = {
      modules: { foo: {} },
      module_meta: { foo: { title: 'Foo', intro: 'Bar', version_added: 'not-a-version' } },
    };
    const issues = validateModuleMeta(data);
    assert.ok(issues.some((i) => i.includes('version_added must match')));
  });

  it('flags features not being array of strings', () => {
    const data = {
      modules: { foo: {} },
      module_meta: { foo: { title: 'Foo', intro: 'Bar', features: 'not-array' } },
    };
    assert.ok(validateModuleMeta(data).some((i) => i.includes('features must be an array of strings')));
  });

  it('passes a fully valid module_meta entry', () => {
    const data = {
      modules: { foo: {} },
      module_meta: {
        foo: {
          title: 'Foo',
          intro: 'A real intro.',
          version_added: '1.2.3',
          features: ['Feature A', 'Feature B'],
          notes: 'Some notes.',
        },
      },
    };
    assert.deepEqual(validateModuleMeta(data), []);
  });

  it('flags module_meta entry that is not an object', () => {
    const data = { modules: { foo: {} }, module_meta: { foo: 'not-object' } };
    assert.ok(validateModuleMeta(data).some((i) => i.includes('must be an object')));
  });
});

describe('validateReadmeMentions', () => {
  const known = new Set(['fix', 'hunt', 'review-plan']);

  it('returns no issues for empty/non-string input', () => {
    assert.deepEqual(validateReadmeMentions('', known), []);
    assert.deepEqual(validateReadmeMentions(null, known), []);
  });

  it('returns no issues when all mentions resolve', () => {
    const md = '# X\n\nRun `atomic-skills:fix` and `atomic-skills:hunt`.';
    assert.deepEqual(validateReadmeMentions(md, known), []);
  });

  it('flags unknown skill mentions with line number', () => {
    const md = '# X\n\n`atomic-skills:does-not-exist` here.';
    const issues = validateReadmeMentions(md, known);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /does-not-exist/);
    assert.match(issues[0], /line\(s\) 3/);
  });

  it('groups multiple mentions of same unknown name', () => {
    const md = '`atomic-skills:foo` on line 1\n`atomic-skills:foo` on line 2\n`atomic-skills:foo` on line 3\n`atomic-skills:foo` on line 4';
    const issues = validateReadmeMentions(md, known);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /1, 2, 3 \(\+1 more\)/);
  });

  it('separate issues for different unknown names', () => {
    const md = '`atomic-skills:foo` then `atomic-skills:bar`';
    const issues = validateReadmeMentions(md, known);
    assert.equal(issues.length, 2);
  });
});

describe('validateCatalogVersion', () => {
  it('flags missing version field', () => {
    const issues = validateCatalogVersion({ core: {} });
    assert.equal(issues.length, 1);
    assert.match(issues[0], /missing required root field: version/);
  });

  it('flags non-string version', () => {
    assert.match(validateCatalogVersion({ version: 0.2 })[0], /must be a string/);
  });

  it('flags unsupported version', () => {
    const issues = validateCatalogVersion({ version: '0.1' });
    assert.match(issues[0], /unsupported root version "0.1"/);
  });

  it('passes valid version', () => {
    assert.deepEqual(validateCatalogVersion({ version: '0.2' }), []);
  });

  it('handles null/non-object data gracefully', () => {
    assert.deepEqual(validateCatalogVersion(null), []);
    assert.deepEqual(validateCatalogVersion('string'), []);
  });
});

describe('validateReleaseHighlight', () => {
  it('returns no issues when block absent', () => {
    assert.deepEqual(validateReleaseHighlight({ core: {} }), []);
    assert.deepEqual(validateReleaseHighlight({}), []);
  });

  it('flags non-object release_highlight', () => {
    assert.match(validateReleaseHighlight({ release_highlight: 'string' })[0], /must be an object/);
    assert.match(validateReleaseHighlight({ release_highlight: [] })[0], /must be an object/);
    assert.match(validateReleaseHighlight({ release_highlight: null })[0], /must be an object/);
  });

  it('flags missing body', () => {
    assert.match(validateReleaseHighlight({ release_highlight: { } })[0], /body is required/);
  });

  it('flags non-string body', () => {
    assert.match(validateReleaseHighlight({ release_highlight: { body: 42 } })[0], /must be a string/);
  });

  it('flags empty body', () => {
    assert.match(validateReleaseHighlight({ release_highlight: { body: '   ' } })[0], /non-empty string/);
  });

  it('passes valid release_highlight', () => {
    assert.deepEqual(validateReleaseHighlight({ release_highlight: { body: 'Real release notes.' } }), []);
  });
});

describe('project skill plan dependency command docs', () => {
  it('routes project depend to a lazy detail file with add/remove/list/resolve semantics', () => {
    const routerPath = join(process.cwd(), 'skills', 'core', 'project.md');
    const detailPath = join(
      process.cwd(),
      'skills',
      'shared',
      'project-assets',
      'project-dependencies.md'
    );

    assert.equal(existsSync(detailPath), true, 'project-dependencies.md must exist');

    const router = readFileSync(routerPath, 'utf8');
    const detail = readFileSync(detailPath, 'utf8');

    assert.match(router, /project depend list/);
    assert.match(router, /project-dependencies\.md/);
    assert.match(detail, /depend add/);
    assert.match(detail, /depend remove/);
    assert.match(detail, /depend list/);
    assert.match(detail, /depend resolve/);
    assert.match(detail, /addPlanDependency/);
    assert.match(detail, /dependsOnPlans\[\]/);
    assert.match(detail, /release\.archived: resolved/);
    assert.match(detail, /cross-project plan dependencies are not supported/);
    assert.match(detail, /never edits `spawnedFrom`/);
    assert.match(detail, /never edits `phases\[\]\.spawnedPlans`/);
  });
});
