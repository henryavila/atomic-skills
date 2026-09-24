/**
 * T-003 — classifyBump / rewriteChangelog chooser contract.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  bumpVersion,
  classifyBump,
  extractReleaseNotes,
  parseUnreleased,
  rewriteChangelog,
} from '../scripts/release/semver-bump.js';

describe('parseUnreleased', () => {
  it('collects keep-a-changelog items and ignores empty headings', () => {
    const md = `# Changelog

## [Unreleased]

### Added
- **Prop lens**

### Changed
- Capo sem dual

### Fixed
- Pulso do metrônomo

### Removed

## [0.1.3] - 2026-09-12
`;

    assert.deepEqual(parseUnreleased(md), {
      added: ['**Prop lens**'],
      changed: ['Capo sem dual'],
      deprecated: [],
      removed: [],
      fixed: ['Pulso do metrônomo'],
      security: [],
    });
  });
});

describe('bumpVersion', () => {
  it('bumps patch / minor / major', () => {
    assert.equal(bumpVersion('0.1.3', 'patch'), '0.1.4');
    assert.equal(bumpVersion('0.1.3', 'minor'), '0.2.0');
    assert.equal(bumpVersion('1.4.2', 'major'), '2.0.0');
  });

  it('never auto-jumps 0.x to 1.0.0 — breaking stays minor via major kind', () => {
    assert.equal(bumpVersion('0.9.5', 'major'), '0.10.0');
    assert.equal(bumpVersion('0.1.3', 'major'), '0.2.0');
  });
});

describe('classifyBump — feature forbids patch', () => {
  it('maps feat / Added / Changed to minor', () => {
    const plan = classifyBump({
      current: '0.1.2',
      commits: ['feat: enrich Cifra Club em cifra existente (meta-only)'],
      unreleased: parseUnreleased(`## [Unreleased]

### Added
- CLI enrich-cc
`),
    });
    assert.equal(plan.kind, 'minor');
    assert.equal(plan.next, '0.2.0');
    assert.notEqual(plan.kind, 'patch');
  });

  it('maps fix / Fixed-only to patch', () => {
    const plan = classifyBump({
      current: '0.2.0',
      commits: ['fix: lente Só letra persiste no ensaio'],
      unreleased: parseUnreleased(`## [Unreleased]

### Fixed
- Lente no ensaio
`),
    });
    assert.equal(plan.kind, 'patch');
    assert.equal(plan.next, '0.2.1');
  });

  it('maps 0.x breaking to minor, 1.x breaking to major', () => {
    const zero = classifyBump({
      current: '0.2.0',
      commits: ['feat!: rename ChordproViewer prop chart → source'],
      unreleased: {
        added: [],
        changed: [],
        deprecated: [],
        removed: ['prop chart'],
        fixed: [],
        security: [],
      },
    });
    assert.equal(zero.kind, 'minor');
    assert.equal(zero.next, '0.3.0');
    assert.equal(zero.breaking, true);

    const one = classifyBump({
      current: '1.2.0',
      commits: ['feat!: rename ChordproViewer prop chart → source'],
      unreleased: {
        added: [],
        changed: [],
        deprecated: [],
        removed: ['prop chart'],
        fixed: [],
        security: [],
      },
    });
    assert.equal(one.kind, 'major');
    assert.equal(one.next, '2.0.0');
  });

  it('gate: feat commit forbids patch even if changelog only lists Fixed', () => {
    const plan = classifyBump({
      current: '0.1.3',
      commits: ['feat: nova prop lens no host'],
      unreleased: parseUnreleased(`## [Unreleased]

### Fixed
- typo
`),
    });
    assert.equal(plan.kind, 'minor');
    assert.equal(plan.next, '0.2.0');
    assert.notEqual(plan.kind, 'patch');
  });

  it('gate: changelog Added forbids patch even if commits are only fix:', () => {
    const plan = classifyBump({
      current: '1.0.0',
      commits: ['fix: crash on empty chart'],
      unreleased: parseUnreleased(`## [Unreleased]

### Added
- Export Nashville
`),
    });
    assert.equal(plan.kind, 'minor');
    assert.equal(plan.next, '1.1.0');
  });

  it('returns none when there is nothing to ship', () => {
    const plan = classifyBump({
      current: '0.2.0',
      commits: ['docs: memória do contrato', 'chore: bump ci'],
      unreleased: parseUnreleased(`## [Unreleased]

## [0.2.0] - 2026-09-12
`),
    });
    assert.equal(plan.kind, 'none');
    assert.equal(plan.next, '0.2.0');
  });
});

describe('rewriteChangelog', () => {
  const src = `# Changelog

## [Unreleased]

### Added
- Prop lens

### Fixed
- Pulso

## [0.1.3] - 2026-09-12

### Added
- Enrich

[Unreleased]: https://github.com/henryavila/atomic-skills/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/henryavila/atomic-skills/releases/tag/v0.1.3
`;

  it('moves Unreleased into the new version and retargets compare links', () => {
    const out = rewriteChangelog(src, {
      next: '0.2.0',
      date: '2026-09-12',
      repoUrl: 'https://github.com/henryavila/atomic-skills',
    });
    assert.match(out, /## \[Unreleased\]\n/);
    assert.match(out, /## \[0\.2\.0\] - 2026-09-12/);
    assert.match(out, /- Prop lens/);
    assert.ok(out.indexOf('## [Unreleased]') < out.indexOf('## [0.2.0]'));
    assert.ok(out.indexOf('## [0.2.0]') < out.indexOf('## [0.1.3]'));
    assert.match(
      out,
      /\[Unreleased\]: https:\/\/github\.com\/henryavila\/atomic-skills\/compare\/v0\.2\.0\.\.\.HEAD/,
    );
    assert.match(
      out,
      /\[0\.2\.0\]: https:\/\/github\.com\/henryavila\/atomic-skills\/releases\/tag\/v0\.2\.0/,
    );
    assert.match(extractReleaseNotes(out, '0.2.0'), /Prop lens/);
    assert.doesNotMatch(extractReleaseNotes(out, '0.2.0'), /## \[0\.1\.3\]/);
  });
});
