import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
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
    skillsDir = join(tmpRoot, 'skills', 'en');
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
