import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'yaml';
import {
  planScaffold,
  buildSkillEntry,
  insertEntry,
  defaultFields,
  validateName,
  validateFields,
} from '../scripts/lib/scaffold-skill.js';
import { validateCatalog } from '../scripts/lib/validate-skills-core.js';

// A small but realistic catalog: one core skill + the module_meta the
// requireModuleMeta gate expects, plus a `modules:` anchor to insert before.
const CATALOG = `version: '0.2'

core:
  fix:
    name: fix
    title: 'Fix'
    description: 'Existing skill.'
    purpose: 'Existing skill.'
    when_to_use:
      - 'A bug'
    when_not_to_use:
      - 'A feature'
    examples:
      - command: '/atomic-skills:fix'
        description: 'Run'
    one_liner: 'Root cause diagnosis plus a TDD fix'
    emoji: '🔧'
    version_added: '1.0.0'
    schema_version: '0.2'

modules: {}

module_meta: {}
`;

// Build a temp skills dir whose core/<name>.md has an Iron Law, so the
// requireIronLaw cross-check passes during full-catalog validation.
function writeBody(skillsDir, name, bodyText) {
  mkdirSync(join(skillsDir, 'core'), { recursive: true });
  writeFileSync(join(skillsDir, 'core', `${name}.md`), bodyText, 'utf8');
}

describe('scaffold-skill: name + field validation', () => {
  it('accepts kebab-case names', () => {
    assert.equal(validateName('new-skill'), 'new-skill');
  });

  it('rejects invalid names', () => {
    assert.throws(() => validateName('New_Skill'));
    assert.throws(() => validateName('1bad'));
    assert.throws(() => validateName(''));
  });

  it('default fields satisfy the v0.2 schema', () => {
    assert.doesNotThrow(() => validateFields(defaultFields('demo', '2.0.0')));
  });

  it('rejects an out-of-range one_liner', () => {
    assert.throws(() => validateFields({ ...defaultFields('demo', '2.0.0'), one_liner: 'short' }));
  });

  it('rejects a malformed version_added', () => {
    assert.throws(() => validateFields({ ...defaultFields('demo', '2.0.0'), version_added: '2.0' }));
  });
});

describe('scaffold-skill: catalog insertion', () => {
  it('inserts the entry before the modules anchor', () => {
    const entry = buildSkillEntry('demo', defaultFields('demo', '2.0.0'));
    const next = insertEntry(CATALOG, entry);
    assert.ok(next.indexOf('  demo:') < next.indexOf('modules:'), 'entry precedes modules:');
    assert.ok(next.indexOf('  fix:') < next.indexOf('  demo:'), 'entry follows existing core skill');
  });

  it('produces parseable YAML with the new core key', () => {
    const entry = buildSkillEntry('demo', defaultFields('demo', '2.0.0'));
    const data = parse(insertEntry(CATALOG, entry));
    assert.ok(data.core.demo, 'core.demo exists');
    assert.equal(data.core.demo.name, 'demo');
    assert.equal(data.core.demo.schema_version, '0.2');
  });

  it('escapes single quotes in field values', () => {
    const fields = { ...defaultFields('demo', '2.0.0'), title: "It's fine" };
    const data = parse(insertEntry(CATALOG, buildSkillEntry('demo', fields)));
    assert.equal(data.core.demo.title, "It's fine");
  });
});

describe('scaffold-skill: planScaffold end-to-end', () => {
  it('rejects a duplicate skill name', () => {
    assert.throws(() => planScaffold({ catalogText: CATALOG, name: 'fix', pkgVersion: '2.0.0' }));
  });

  it('produces a body containing an Iron Law', () => {
    const plan = planScaffold({ catalogText: CATALOG, name: 'demo', pkgVersion: '2.0.0' });
    assert.match(plan.bodyText, /^## Iron Law/m);
    assert.equal(plan.bodyRelPath, 'core/demo.md');
  });

  it('output passes full validateCatalog (the gate the commit will run)', () => {
    const plan = planScaffold({ catalogText: CATALOG, name: 'demo', pkgVersion: '2.0.0' });
    const skillsDir = mkdtempSync(join(tmpdir(), 'skills-'));
    // Existing skill body so the fix entry also passes the disk cross-check.
    writeBody(skillsDir, 'fix', 'Body.\n\n## Iron Law\n\nLAW.\n');
    writeBody(skillsDir, 'demo', plan.bodyText);

    const data = parse(plan.catalogText);
    const report = validateCatalog(data, {
      skillsDir,
      requireIronLaw: true,
      requireModuleMeta: true,
      requireCatalogVersion: true,
    });
    assert.equal(report.totalIssues, 0, JSON.stringify(report.failures, null, 2));
  });
});
