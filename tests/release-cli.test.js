/**
 * T-003 — release.js plan / apply / ship CLI contract.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRelease } from '../scripts/release/release.js';

function writePkg(root, version = '0.1.0', extra = {}) {
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify(
      {
        name: '@example/release-fixture',
        version,
        repository: { type: 'git', url: 'git+https://github.com/example/release-fixture.git' },
        ...extra,
      },
      null,
      2,
    ) + '\n',
  );
}

function writeStageWorkflow(root) {
  mkdirSync(join(root, '.github/workflows'), { recursive: true });
  writeFileSync(
    join(root, '.github/workflows/publish.yml'),
    `# pin: atomic-skills/release-assets/publish-stage@v1
name: Publish to npm (stage)
on:
  release:
    types: [published]
permissions:
  contents: read
  id-token: write
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: |
          npx --yes npm@11.19.1 stage publish --access public
`,
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
      currentBranch: 'release/0.2.0',
      defaultBranch: 'main',
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
    writeStageWorkflow(root);
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
    writeStageWorkflow(root);
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

  it('refuses ship when npm in scope and stage Action is missing', () => {
    const cli = makeCli(root);
    const facts = cli.collect();
    assert.throws(
      () => cli.ship(facts, { dryRun: true }),
      /stage Action is missing|Refuse ship|adopt/i,
    );
  });

  it('allows ship with --no-npm when stage Action is missing', () => {
    const cli = makeCli(root);
    const facts = cli.collect();
    const result = cli.ship(facts, { dryRun: true, noNpm: true });
    assert.equal(result.tag, 'v0.2.0');
    assert.equal(result.dryRun, true);
  });

  it('allows ship when private package (npm out of scope) without Action', () => {
    writePkg(root, '0.2.0', { private: true });
    const cli = makeCli(root);
    const facts = cli.collect();
    const result = cli.ship(facts, { dryRun: true });
    assert.equal(result.tag, 'v0.2.0');
  });

  it('allows ship when stage Action is adopted', () => {
    writeStageWorkflow(root);
    const cli = makeCli(root);
    const facts = cli.collect();
    const result = cli.ship(facts, { dryRun: true });
    assert.equal(result.tag, 'v0.2.0');
  });

  it('refuses ship when stage publish appears only in comments', () => {
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    writeFileSync(
      join(root, '.github/workflows/publish.yml'),
      `# uses stage publish in comments only\nname: bad\non:\n  release:\n    types: [published]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hello\n`,
    );
    const cli = makeCli(root);
    const facts = cli.collect();
    assert.throws(
      () => cli.ship(facts, { dryRun: true }),
      /stage Action is missing|not stage-only|Refuse ship/i,
    );
  });

  it('refuses ship when workflow has bare npm publish even if stage is mentioned in comments', () => {
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    writeFileSync(
      join(root, '.github/workflows/publish.yml'),
      `# Prefer stage publish — but this drifted workflow still publishes directly\nname: bad\non:\n  release:\n    types: [published]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm publish --access public\n`,
    );
    const cli = makeCli(root);
    const facts = cli.collect();
    assert.throws(
      () => cli.ship(facts, { dryRun: true }),
      /stage Action is missing|not stage-only|Refuse ship|bare npm publish/i,
    );
  });

  it('refuses ship when on the default branch', () => {
    writeStageWorkflow(root);
    const cli = makeCli(root, {
      currentBranch: 'main',
      defaultBranch: 'main',
    });
    const facts = cli.collect();
    assert.throws(
      () => cli.ship(facts, { dryRun: true }),
      /default branch/i,
    );
  });

  it('plan next-steps refuse ship when Action missing', () => {
    const cli = makeCli(root);
    const facts = cli.collect();
    const text = cli.printPlan(facts);
    assert.match(text, /Refuse ship|stage Action is missing|adopt/i);
    assert.doesNotMatch(text, /node scripts\/release\/release\.js --ship/);
  });
});

describe('release CLI — reviewed failure modes', () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'as-release-review-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('classifies a BREAKING CHANGE footer, not only the subject', () => {
    writePkg(root, '1.0.0');
    writeChangelog(root, '');
    const formats = [];
    const cli = createRelease({
      root,
      skipRemote: true,
      sh: (_cmd, argv) => {
        if (argv[0] === 'log') {
          formats.push(argv.join(' '));
          return 'fix: change API\n\nBREAKING CHANGE: drop the old flag\n\x1e';
        }
        return '';
      },
      fixtures: {
        npmLatest: '1.0.0',
        npmVersions: ['1.0.0'],
        gitTags: ['1.0.0'],
        githubReleases: ['1.0.0'],
        currentBranch: 'release/x',
        defaultBranch: 'main',
        dirty: false,
      },
      now: () => new Date('2026-09-24T12:00:00Z'),
    });
    const facts = cli.collect();
    assert.match(formats.join('\n'), /%B/, 'git log must request the commit body');
    assert.equal(facts.plan.breaking, true);
    assert.equal(facts.plan.kind, 'major');
    assert.equal(facts.plan.next, '2.0.0');
  });

  it('after apply, an unpublished package still sees commits since the previous tag', () => {
    writePkg(root, '0.2.0');
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-24\n\n## [0.1.0] - 2026-01-01\n`,
    );
    const cli = createRelease({
      root,
      skipRemote: false,
      npmJson: () => null,
      sh: (cmd, argv) => {
        if (cmd === 'git' && argv[0] === 'tag' && argv.includes('v*')) return 'v0.1.0\n';
        if (cmd === 'git' && argv[0] === 'log' && argv.includes('-S')) return 'abc123';
        if (cmd === 'git' && argv[0] === 'log') {
          const range = String(argv[1] || '');
          if (range.startsWith('abc123')) return '';
          if (range.startsWith('v0.1.0')) return 'feat: add widget\n\x1e';
          return '';
        }
        if (cmd === 'git' && argv[0] === 'symbolic-ref') return 'refs/remotes/origin/main';
        if (cmd === 'git' && argv[0] === 'rev-parse' && argv.includes('--abbrev-ref')) {
          return 'release/0.2.0';
        }
        return '';
      },
      fixtures: { dirty: false },
      now: () => new Date('2026-09-24T12:00:00Z'),
    });
    const facts = cli.collect();
    assert.equal(facts.baseline, '0.1.0');
    assert.equal(facts.plan.kind, 'minor');
    assert.equal(facts.plan.next, '0.2.0');
  });

  it('refuses to ship a package.json version the chooser did not select', () => {
    writePkg(root, '1.0.1');
    writeStageWorkflow(root);
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n### Added\n- Initial\n`,
    );
    const cli = makeCli(root, {
      commits: ['feat: add widget'],
      npmLatest: '1.0.0',
      npmVersions: ['1.0.0'],
      gitTags: ['1.0.0'],
      githubReleases: ['1.0.0'],
    });
    const facts = cli.collect();
    assert.equal(facts.plan.next, '1.1.0');
    assert.throws(() => cli.ship(facts, { dryRun: true }), /1\.1\.0/);
  });

  it('keeps a changelog-only release shippable after apply emptied Unreleased', () => {
    writePkg(root, '0.2.0');
    writeStageWorkflow(root);
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-24\n\n### Added\n- Widget\n\n## [0.1.0] - 2026-01-01\n`,
    );
    const cli = makeCli(root, {
      commits: ['chore: release 0.2.0'],
      npmLatest: '0.1.0',
      npmVersions: ['0.1.0'],
      gitTags: ['0.1.0'],
      githubReleases: ['0.1.0'],
    });
    const facts = cli.collect();
    assert.equal(facts.plan.kind, 'minor');
    assert.equal(facts.plan.next, '0.2.0');
    const result = cli.ship(facts, { dryRun: true });
    assert.equal(result.tag, 'v0.2.0');
  });

  it('refuses to reuse a version tag that points at another commit', () => {
    writePkg(root, '0.2.0');
    writeStageWorkflow(root);
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-24\n\n### Added\n- Widget\n`,
    );
    const calls = [];
    const cli = createRelease({
      root,
      skipRemote: true,
      sh: (_cmd, argv) => {
        calls.push(argv.join(' '));
        if (argv[0] === 'status') return '';
        if (argv[0] === 'rev-parse' && argv.includes('HEAD') && !argv.includes('--abbrev-ref')) {
          return 'bbb';
        }
        if (argv[0] === 'rev-parse' && String(argv[2] || '').includes('^{commit}')) return 'aaa';
        if (argv[0] === 'ls-remote') return '';
        return '';
      },
      fixtures: {
        npmLatest: '0.1.0',
        npmVersions: ['0.1.0'],
        gitTags: ['0.1.0'],
        githubReleases: ['0.1.0'],
        commits: ['feat: add widget'],
        dirty: false,
        currentBranch: 'release/0.2.0',
        defaultBranch: 'main',
      },
      now: () => new Date('2026-09-24T12:00:00Z'),
    });
    const facts = cli.collect();
    assert.equal(facts.plan.next, '0.2.0');
    assert.throws(() => cli.ship(facts), /tag v0\.2\.0 points at aaa/);
    assert.equal(calls.some((c) => c.startsWith('push ')), false);
  });

  it('treats origin/main as the default when the local main ref is absent', () => {
    writePkg(root, '0.2.0');
    writeStageWorkflow(root);
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-24\n\n### Added\n- Widget\n`,
    );
    const cli = createRelease({
      root,
      skipRemote: true,
      sh: (_cmd, argv) => {
        if (argv[0] === 'symbolic-ref') return '';
        if (argv[0] === 'rev-parse' && argv.includes('refs/remotes/origin/main')) return 'abc';
        if (argv[0] === 'rev-parse' && argv.includes('--abbrev-ref')) return 'main';
        return '';
      },
      fixtures: {
        npmLatest: '0.1.0',
        npmVersions: ['0.1.0'],
        gitTags: ['0.1.0'],
        githubReleases: ['0.1.0'],
        commits: ['feat: add widget'],
        dirty: false,
        currentBranch: 'main',
      },
      now: () => new Date('2026-09-24T12:00:00Z'),
    });
    const facts = cli.collect();
    assert.throws(() => cli.ship(facts, { dryRun: true }), /default branch \(main\)/);
  });

  it('refuses to ship from a default branch whose name contains a slash', () => {
    writePkg(root, '0.2.0');
    writeStageWorkflow(root);
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-24\n\n### Added\n- Widget\n`,
    );
    const cli = createRelease({
      root,
      skipRemote: true,
      sh: (_cmd, argv) => {
        if (argv[0] === 'symbolic-ref') return 'refs/remotes/origin/release/stable';
        if (argv[0] === 'rev-parse' && argv.includes('--abbrev-ref')) return 'release/stable';
        return '';
      },
      fixtures: {
        npmLatest: '0.1.0',
        npmVersions: ['0.1.0'],
        gitTags: ['0.1.0'],
        githubReleases: ['0.1.0'],
        commits: ['feat: add widget'],
        dirty: false,
        currentBranch: 'release/stable',
      },
      now: () => new Date('2026-09-24T12:00:00Z'),
    });
    const facts = cli.collect();
    assert.throws(() => cli.ship(facts, { dryRun: true }), /default branch \(release\/stable\)/);
  });

  it('refuses to ship when the default branch cannot be resolved', () => {
    writePkg(root, '0.2.0');
    writeStageWorkflow(root);
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-24\n\n### Added\n- Widget\n`,
    );
    const cli = createRelease({
      root,
      skipRemote: true,
      sh: () => '',
      fixtures: {
        npmLatest: '0.1.0',
        npmVersions: ['0.1.0'],
        gitTags: ['0.1.0'],
        githubReleases: ['0.1.0'],
        commits: ['feat: add widget'],
        dirty: false,
        currentBranch: 'release/0.2.0',
      },
      now: () => new Date('2026-09-24T12:00:00Z'),
    });
    const facts = cli.collect();
    assert.throws(() => cli.ship(facts, { dryRun: true }), /could not resolve default branch/);
  });

  it('plans when npm history contains a prerelease', () => {
    writePkg(root, '1.0.0');
    writeChangelog(root, '### Fixed\n- typo\n');
    const cli = makeCli(root, {
      commits: ['fix: typo'],
      npmLatest: null,
      npmVersions: ['1.0.0-beta.1', '1.0.0', 'nightly'],
      gitTags: ['1.0.0'],
      githubReleases: ['1.0.0-rc.1', 'nightly', '1.0.0'],
    });
    const facts = cli.collect();
    assert.equal(facts.npmLatest, '1.0.0');
    assert.equal(facts.plan.kind, 'patch');
    assert.equal(facts.plan.next, '1.0.1');
  });

  it('plans and applies a GitHub-only repo that has no package.json', () => {
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog\n\n## [Unreleased]\n\n### Added\n- Widget\n\n## [0.1.0] - 2026-01-01\n\n### Added\n- Initial\n`,
    );
    const cli = createRelease({
      root,
      skipRemote: true,
      fixtures: {
        gitTags: ['0.1.0'],
        githubReleases: ['0.1.0'],
        commits: ['feat: add widget'],
        currentBranch: 'release/0.2.0',
        defaultBranch: 'main',
        remoteUrl: 'https://github.com/example/widget.git',
        dirty: false,
      },
      now: () => new Date('2026-09-24T12:00:00Z'),
    });
    const facts = cli.collect();
    assert.equal(facts.packageVersion, '0.1.0');
    assert.equal(facts.plan.kind, 'minor');
    assert.equal(facts.plan.next, '0.2.0');
    assert.equal(existsSync(join(root, 'package.json')), false);
    cli.apply(facts);
    assert.equal(existsSync(join(root, 'package.json')), false);
    const again = cli.collect();
    assert.equal(again.packageVersion, '0.2.0');
    assert.equal(again.plan.next, '0.2.0');
    const shipped = cli.ship(again, { dryRun: true });
    assert.equal(shipped.tag, 'v0.2.0');
  });

  it('rejects a workflow named stage publish whose command is npm --access public publish', () => {
    writePkg(root, '0.2.0');
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    writeFileSync(
      join(root, '.github/workflows/publish.yml'),
      `name: stage publish\non:\n  release:\n    types: [published]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm --access public publish\n`,
    );
    const cli = makeCli(root);
    const facts = cli.collect();
    assert.throws(
      () => cli.ship(facts, { dryRun: true }),
      /stage Action is missing|not stage-only|Refuse ship/i,
    );
  });

  it('ignores the words npm stage publish when they are not the command', () => {
    writePkg(root, '0.2.0');
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    writeFileSync(
      join(root, '.github/workflows/publish.yml'),
      `name: notes\non:\n  release:\n    types: [published]\njobs:\n  acknowledge:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo npm stage publish\n`,
    );
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-24\n\n### Added\n- Widget\n`,
    );
    const cli = makeCli(root);
    const facts = cli.collect();
    assert.throws(() => cli.ship(facts, { dryRun: true }), /stage Action is missing|not stage-only/i);
    const optedOut = cli.ship(facts, { dryRun: true, noNpm: true });
    assert.equal(optedOut.tag, 'v0.2.0');
  });

  it('refuses --no-npm when the release workflow still publishes', () => {
    writePkg(root, '0.2.0');
    writeStageWorkflow(root);
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-24\n\n### Added\n- Widget\n`,
    );
    const cli = makeCli(root);
    const facts = cli.collect();
    assert.throws(() => cli.ship(facts, { dryRun: true, noNpm: true }), /gh-only|registry publish/i);
  });

  it('allows --no-npm when the workflow is GitHub-only', () => {
    writePkg(root, '0.2.0');
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    writeFileSync(
      join(root, '.github/workflows/publish.yml'),
      `name: Release notes (GitHub only)\non:\n  release:\n    types: [published]\njobs:\n  acknowledge:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo GitHub Release only\n`,
    );
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-24\n\n### Added\n- Widget\n`,
    );
    const cli = makeCli(root);
    const facts = cli.collect();
    const result = cli.ship(facts, { dryRun: true, noNpm: true });
    assert.equal(result.tag, 'v0.2.0');
  });

  it('does not block a private package on another package npm history', () => {
    writePkg(root, '1.0.0', { private: true, name: 'left-pad' });
    writeChangelog(root, '### Added\n- Local\n');
    const cli = makeCli(root, {
      commits: ['feat: local only'],
      npmLatest: '9.0.0',
      npmVersions: ['9.0.0'],
      gitTags: ['1.0.0'],
      githubReleases: ['1.0.0'],
    });
    const facts = cli.collect();
    assert.equal(facts.npmLatest, null);
    assert.equal(facts.plan.kind, 'minor');
    assert.equal(facts.plan.next, '1.1.0');
  });

  it('does not query npm when --no-npm is set', () => {
    writePkg(root, '1.0.0');
    writeChangelog(root, '### Added\n- Local\n');
    const cli = makeCli(root, {
      commits: ['feat: local only'],
      npmLatest: '9.0.0',
      npmVersions: ['9.0.0'],
      gitTags: ['1.0.0'],
      githubReleases: ['1.0.0'],
    });
    const facts = cli.collect({ noNpm: true });
    assert.equal(facts.npmLatest, null);
    assert.equal(facts.plan.next, '1.1.0');
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
