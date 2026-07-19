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

// Core-only catalog fixture (installer modules concept removed).
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
  it('appends the entry after existing core skills', () => {
    const entry = buildSkillEntry('demo', defaultFields('demo', '2.0.0'));
    const next = insertEntry(CATALOG, entry);
    assert.ok(next.indexOf('  fix:') < next.indexOf('  demo:'), 'entry follows existing core skill');
    assert.ok(next.includes('  demo:'), 'entry present');
  });

  it('produces parseable YAML with the new core key', () => {
    const entry = buildSkillEntry('demo', defaultFields('demo', '2.0.0'));
    const data = parse(insertEntry(CATALOG, entry));
    assert.ok(data.core.demo, 'core.demo exists');
    assert.equal(data.core.demo.name, 'demo');
    assert.equal(data.core.demo.schema_version, '0.2');
  });

  it('emits iron_law matching the body Iron Law line (catalog v0.3)', () => {
    const fields = defaultFields('demo', '2.0.0');
    assert.ok(fields.iron_law && fields.iron_law.trim().length > 0);
    const entry = buildSkillEntry('demo', fields);
    const data = parse(insertEntry(CATALOG, entry));
    assert.equal(data.core.demo.iron_law, fields.iron_law);
    const plan = planScaffold({ catalogText: CATALOG, name: 'demo', pkgVersion: '2.0.0' });
    assert.ok(plan.bodyText.includes(fields.iron_law));
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
      requireCatalogVersion: true,
    });
    assert.equal(report.totalIssues, 0, JSON.stringify(report.failures, null, 2));
  });

  it('v0.3 catalog scaffold includes iron_law and passes validateCatalog', () => {
    const catalogV03 = `version: '0.3'

product:
  what_is: 'Atomic Skills product.'
  what_is_not:
    - 'A monorepo of free-form prompts'
  docs_url: 'https://atomic-skills.henryavila.com'
  install:
    primary: 'npx @henryavila/atomic-skills install'

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
    iron_law: 'NO FIX WITHOUT ROOT CAUSE.'
`;
    const plan = planScaffold({ catalogText: catalogV03, name: 'demo', pkgVersion: '2.0.0' });
    const data = parse(plan.catalogText);
    assert.ok(data.core.demo.iron_law, 'scaffold emits iron_law');
    assert.ok(!('modules' in data), 'v0.3 scaffold stays core-only (no modules key)');
    const skillsDir = mkdtempSync(join(tmpdir(), 'skills-v03-'));
    writeBody(skillsDir, 'fix', 'Body.\n\n## Iron Law\n\nNO FIX WITHOUT ROOT CAUSE.\n');
    writeBody(skillsDir, 'demo', plan.bodyText);
    const report = validateCatalog(data, {
      skillsDir,
      requireCatalogVersion: true,
    });
    assert.equal(report.totalIssues, 0, JSON.stringify(report.failures, null, 2));
  });
});
