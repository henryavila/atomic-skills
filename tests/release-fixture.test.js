/**
 * T-006 — Consumer fixture proves release contract (hygiene path).
 *
 * Fixture lives at tests/fixtures/release-hygiene-consumer/ (NOT
 * tests/fixtures/release-consumer/, which is owned by release-blackbox).
 * No network publish.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRelease } from '../scripts/release/release.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = join(ROOT, 'tests/fixtures/release-hygiene-consumer');
const RELEASE_SKILL = join(ROOT, 'skills/core/release.md');
const SAVE_AND_PUSH = join(ROOT, 'skills/core/save-and-push.md');
const STAGE_TEMPLATE = join(
  ROOT,
  'skills/shared/release-assets/templates/publish-stage.yml',
);

function makeCli(root, fixtures = {}) {
  return createRelease({
    root,
    skipRemote: true,
    fixtures: {
      npmLatest: '0.1.0',
      npmVersions: ['0.1.0'],
      gitTags: ['0.1.0'],
      githubReleases: ['0.1.0'],
      commits: ['feat: add widget'],
      dirty: false,
      ...fixtures,
    },
    now: () => new Date('2026-09-24T12:00:00Z'),
  });
}

describe('release-hygiene-consumer fixture layout', () => {
  it('includes sample package.json, CHANGELOG, and adopted stage workflow', () => {
    assert.ok(existsSync(join(FIXTURE, 'package.json')), 'missing package.json');
    assert.ok(existsSync(join(FIXTURE, 'CHANGELOG.md')), 'missing CHANGELOG.md');
    const workflow = join(FIXTURE, '.github/workflows/publish.yml');
    assert.ok(existsSync(workflow), 'missing adopted .github/workflows/publish.yml');

    const pkg = JSON.parse(readFileSync(join(FIXTURE, 'package.json'), 'utf8'));
    assert.equal(pkg.private, false, 'fixture must be a public npm package (npm in scope)');
    assert.match(pkg.name, /release-hygiene-consumer/);

    const changelog = readFileSync(join(FIXTURE, 'CHANGELOG.md'), 'utf8');
    assert.match(changelog, /## \[Unreleased\]/);
    assert.match(changelog, /### Added/);

    const yaml = readFileSync(workflow, 'utf8');
    assert.match(yaml, /stage\s+publish/);
    assert.match(yaml, /id-token:\s*write/);
    assert.match(yaml, /pin:\s*atomic-skills\/release-assets\/publish-stage@v1/);
    assert.doesNotMatch(
      yaml,
      /^\s+- run: npm publish\b/m,
      'adopted workflow must not use bare npm publish as happy path',
    );

    // Pin should match the package template (adopted, not inventing a workflow).
    const template = readFileSync(STAGE_TEMPLATE, 'utf8');
    assert.equal(
      yaml,
      template,
      'fixture publish.yml should match publish-stage.yml template bytes',
    );
  });
});

describe('chooser plan on hygiene fixture', () => {
  it('plans minor next version from feat + Unreleased Added', () => {
    const cli = makeCli(FIXTURE);
    const facts = cli.collect();
    assert.equal(facts.plan.kind, 'minor');
    assert.equal(facts.plan.next, '0.2.0');
    assert.equal(facts.name, '@example/release-hygiene-consumer');
    assert.equal(facts.hasChangelog, true);

    const text = cli.printPlan(facts);
    assert.match(text, /next\s+:\s+0\.2\.0/);
    assert.match(text, /bump\s+:\s+minor/);
  });
});

describe('refuse ship when Action missing without GH-only opt-out', () => {
  it('release skill dual-mode refuses ship when stage Action missing unless opt-out', () => {
    assert.ok(existsSync(RELEASE_SKILL), 'missing skills/core/release.md');
    const text = readFileSync(RELEASE_SKILL, 'utf8');

    assert.match(text, /Action missing|not stage-only/i);
    assert.match(text, /\*\*Refuse\*\*\s+ship|Refuse.*ship/i);
    assert.match(text, /opt-out|--no-npm|GH-only/i);
    assert.match(text, /adopt/);
    // Direct registry publish is forbidden as the happy path (stage-only).
    assert.match(text, /npm publish[\s\S]{0,80}happy path|happy path[\s\S]{0,80}npm publish/i);
  });

  it('ship() refuses when npm in scope and stage Action is missing', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'as-hygiene-no-action-'));
    try {
      // Public package + CHANGELOG, but no adopted publish.yml → Action missing.
      writeFileSync(
        join(tmp, 'package.json'),
        JSON.stringify(
          {
            name: '@example/missing-stage-action',
            version: '0.2.0',
            private: false,
            repository: {
              type: 'git',
              url: 'git+https://github.com/example/missing-stage-action.git',
            },
          },
          null,
          2,
        ) + '\n',
      );
      writeFileSync(
        join(tmp, 'CHANGELOG.md'),
        `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-24\n\n### Added\n- Thing\n\n## [0.1.0] - 2026-01-01\n\n### Added\n- Initial\n`,
      );

      const workflow = join(tmp, '.github/workflows/publish.yml');
      assert.equal(existsSync(workflow), false, 'Action must be missing in this probe');

      const cli = makeCli(tmp, {
        commits: ['feat: add thing'],
        npmLatest: '0.1.0',
        npmVersions: ['0.1.0'],
        gitTags: ['0.1.0'],
        githubReleases: ['0.1.0'],
        currentBranch: 'release/0.2.0',
        defaultBranch: 'main',
      });
      const facts = cli.collect();
      assert.equal(facts.plan.kind, 'minor');
      assert.throws(
        () => cli.ship(facts, { dryRun: true }),
        /stage Action is missing|Refuse ship|adopt/i,
      );
      const allowed = cli.ship(facts, { dryRun: true, noNpm: true });
      assert.equal(allowed.tag, 'v0.2.0');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('with explicit GH-only opt-out flag language, skill allows GH Release path', () => {
    const text = readFileSync(RELEASE_SKILL, 'utf8');
    assert.match(
      text,
      /GH-only despite a public package requires explicit operator opt-out|--no-npm/i,
    );
    assert.match(text, /No npm in scope[\s\S]*GitHub Release/i);
  });
});

describe('save-and-push contract still refuses default push language', () => {
  it('HARD-GATE refuses push on default; no push-directly ask', () => {
    assert.ok(existsSync(SAVE_AND_PUSH), 'missing skills/core/save-and-push.md');
    const text = readFileSync(SAVE_AND_PUSH, 'utf8');

    assert.match(text, /<HARD-GATE>/);
    assert.match(text, /Refuse/i);
    assert.match(text, /origin\/HEAD|default-branch\.md/);
    assert.match(text, /gh pr create/);
    assert.doesNotMatch(
      text,
      /Ask the user:\s*push directly/i,
      'must not ask to push directly to main/master',
    );
    assert.doesNotMatch(
      text,
      /push directly to main or create branch \+ PR\?/i,
      'legacy ask-before-push prompt must stay gone',
    );
  });
});

describe('hygiene fixture is distinct from release-blackbox fixture', () => {
  it('does not collide with tests/fixtures/release-consumer/', () => {
    const blackbox = join(ROOT, 'tests/fixtures/release-consumer/package.json');
    assert.ok(existsSync(blackbox), 'blackbox fixture should still exist');
    const hygienePkg = JSON.parse(readFileSync(join(FIXTURE, 'package.json'), 'utf8'));
    const blackboxPkg = JSON.parse(readFileSync(blackbox, 'utf8'));
    assert.notEqual(hygienePkg.name, blackboxPkg.name);
    assert.equal(hygienePkg.private, false);
    assert.equal(blackboxPkg.private, true);
  });
});
