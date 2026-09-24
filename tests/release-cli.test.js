/**
 * T-003 — release.js plan / apply / ship CLI contract.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRelease } from '../scripts/release/release.js';

function writePkg(root, version = '0.1.0') {
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify(
      {
        name: '@example/release-fixture',
        version,
        repository: { type: 'git', url: 'git+https://github.com/example/release-fixture.git' },
      },
      null,
      2,
    ) + '\n',
  );
}

function writeChangelog(root, body = '### Added\n- Widget\n') {
  writeFileSync(
    join(root, 'CHANGELOG.md'),
    `# Changelog

## [Unreleased]

${body}
## [0.1.0] - 2026-01-01

### Added
- Initial

[Unreleased]: https://github.com/example/release-fixture/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/example/release-fixture/releases/tag/v0.1.0
`,
  );
}

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

describe('release CLI — plan', () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'as-release-plan-'));
    writePkg(root);
    writeChangelog(root);
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('plan prints next version for feat → minor', () => {
    const cli = makeCli(root);
    const facts = cli.collect();
    assert.equal(facts.plan.kind, 'minor');
    assert.equal(facts.plan.next, '0.2.0');
    const text = cli.printPlan(facts);
    assert.match(text, /next\s+:\s+0\.2\.0/);
    assert.match(text, /bump\s+:\s+minor/);
  });

  it('plan JSON via run --json includes next', () => {
    const cli = makeCli(root);
    let out = '';
    const code = cli.run(['--json'], {
      stdout: { write: (s) => { out += s; } },
      stderr: { write: () => {} },
    });
    assert.equal(code, 0);
    const plan = JSON.parse(out);
    assert.equal(plan.next, '0.2.0');
    assert.equal(plan.kind, 'minor');
  });
});

describe('release CLI — apply', () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'as-release-apply-'));
    writePkg(root);
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('rewrites package.json version and CHANGELOG Unreleased when present', () => {
    writeChangelog(root);
    const cli = makeCli(root);
    const facts = cli.collect();
    const applied = cli.apply(facts);
    assert.equal(applied.version, '0.2.0');
    assert.equal(applied.changelogRewritten, true);

    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.version, '0.2.0');

    const md = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    assert.match(md, /## \[0\.2\.0\] - 2026-09-24/);
    assert.match(md, /- Widget/);
    assert.match(md, /## \[Unreleased\]\n/);
  });

  it('rewrites package.json even when CHANGELOG is absent', () => {
    assert.equal(existsSync(join(root, 'CHANGELOG.md')), false);
    const cli = makeCli(root);
    const facts = cli.collect();
    const applied = cli.apply(facts);
    assert.equal(applied.version, '0.2.0');
    assert.equal(applied.changelogRewritten, false);
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.version, '0.2.0');
  });

  it('refuses apply when kind is none', () => {
    writeChangelog(root, '');
    const cli = makeCli(root, { commits: ['docs: only', 'chore: housekeeping'] });
    const facts = cli.collect();
    assert.equal(facts.plan.kind, 'none');
    assert.throws(() => cli.apply(facts), /kind=none/);
  });
});

describe('release CLI — ship', () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'as-release-ship-'));
    writePkg(root, '0.2.0');
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog

## [Unreleased]

## [0.2.0] - 2026-09-24

### Added
- Widget

## [0.1.0] - 2026-01-01

### Added
- Initial
`,
    );
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('refuses when kind is none', () => {
    writePkg(root, '0.1.0');
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog

## [Unreleased]

## [0.1.0] - 2026-01-01
`,
    );
    const cliNone = makeCli(root, {
      commits: ['docs: only'],
      npmLatest: '0.1.0',
      npmVersions: ['0.1.0'],
    });
    const factsNone = cliNone.collect();
    assert.equal(factsNone.plan.kind, 'none');
    assert.throws(() => cliNone.ship(factsNone), /kind=none/);
  });

  it('refuses when npm version already published', () => {
    writePkg(root, '0.2.0');
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog

## [Unreleased]

## [0.2.0] - 2026-09-24

### Added
- Widget
`,
    );
    const cli = makeCli(root, {
      commits: ['feat: add widget'],
      npmLatest: '0.2.0',
      npmVersions: ['0.1.0', '0.2.0'],
      githubReleases: ['0.1.0'],
    });
    // package.json == npm latest → collect does not throw; plan may be none
    // Ship must refuse published version. Use already-bumped facts shape via ship() on crafted facts:
    const facts = cli.collect();
    // Override to simulate ship of published version with a non-none plan
    const published = {
      ...facts,
      packageVersion: '0.2.0',
      npmLatest: '0.2.0',
      npmVersions: ['0.1.0', '0.2.0'],
      plan: { ...facts.plan, kind: 'minor', next: '0.2.0' },
      hasChangelog: true,
      changelog: readFileSync(join(root, 'CHANGELOG.md'), 'utf8'),
      githubReleases: ['0.1.0'],
    };
    assert.throws(() => cli.ship(published), /already on npm|already published/i);
  });

  it('dry-run ship succeeds when version is new and kind is not none', () => {
    const cli = makeCli(root, {
      commits: ['feat: add widget'],
      npmLatest: '0.1.0',
      npmVersions: ['0.1.0'],
      githubReleases: ['0.1.0'],
      gitTags: ['0.1.0'],
    });
    const facts = cli.collect();
    assert.notEqual(facts.plan.kind, 'none');
    const result = cli.ship(facts, { dryRun: true });
    assert.equal(result.tag, 'v0.2.0');
    assert.equal(result.dryRun, true);
  });
});

describe('release CLI — feature-forbids-patch gate (integration)', () => {
  it('plan never proposes patch when feat is present', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-release-gate-'));
    try {
      writePkg(root, '1.0.0');
      writeChangelog(root, '### Fixed\n- typo\n');
      const cli = makeCli(root, {
        commits: ['feat: new capability'],
        npmLatest: '1.0.0',
        npmVersions: ['1.0.0'],
        gitTags: ['1.0.0'],
        githubReleases: ['1.0.0'],
      });
      const facts = cli.collect();
      assert.equal(facts.plan.kind, 'minor');
      assert.equal(facts.plan.next, '1.1.0');
      assert.notEqual(facts.plan.kind, 'patch');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
