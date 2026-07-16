/**
 * F1/T-001 — Fix upstream baseline and capture RED reproductions against the
 * published @henryavila/minimalist-installer@0.1.0 tarball behavior.
 *
 * These tests assert that each raw repro observes the exact vulnerability
 * signature on 0.1.0. They are intentionally RED against current engine
 * behavior (they pass when the vuln is present). Green confinement/lock tests
 * live upstream after T-002+ and in consumer suites after the fix lands.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const RECEIPT_PATH = join(REPO_ROOT, 'docs/audits/minimalist-installer-upstream-receipt.json');
const FIXTURE_DIR = join(__dirname, 'fixtures/minimalist-installer-v0.1.0');
const EXPECTED_INTEGRITY =
  'sha512-XeZYy924Ps5jblp+YJuhBrXQlKXrPSKqwwozxVWheCLZadotqehv2nMoLB0Ferk45+ZfHtzYXjxuFbTRUUBYIw==';
const EXPECTED_BASE_SHA = '66c8e940812deaa0012debd713051cecd662acc5';

const REPROS = [
  'path-confinement.repro.js',
  'greenfield-conflict.repro.js',
  'fault-matrix.repro.js',
  'path-mutation-race.repro.js',
  'shared-resource-lock.repro.js',
];

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('minimalist-installer baseline (F1/T-001)', () => {
  it('receipt records dist.integrity, baseSha, origin, branch', () => {
    assert.ok(existsSync(RECEIPT_PATH), 'receipt file must exist');
    const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));
    assert.equal(receipt.dist.integrity, EXPECTED_INTEGRITY);
    assert.equal(receipt.baseSha, EXPECTED_BASE_SHA);
    assert.equal(typeof receipt.origin, 'string');
    assert.match(receipt.origin, /minimalist-installer/);
    assert.equal(receipt.branch, 'codex/integrity-remediation-v2');
    assert.ok(receipt.tasks?.['F1/T-001']?.resultSha);

    // Baseline dist.integrity is the published 0.1.0 tarball (content-addressed).
    // After T-006 the lock may pin a git SHA of the remediated branch; that is
    // recorded separately on receipt.resultSha / integrated.resolved.
    assert.equal(receipt.dist.integrity, EXPECTED_INTEGRITY);
    if (receipt.integrated?.resolved) {
      assert.match(receipt.integrated.resolved, /6550f1170b5f7568f02ba1ca00984a3c06e4349f|minimalist-installer/);
    }
  });

  it('baseSha uniquely corresponds to vendored 0.1.0 src tree', () => {
    // RED baseline is the published 0.1.0 tarball contents (vendored under fixtures),
    // not whatever the consumer currently pins (may be a remediated git SHA).
    const installedRoot = join(FIXTURE_DIR, 'package');
    const installedSrc = join(installedRoot, 'src');
    assert.ok(existsSync(installedSrc), 'vendored 0.1.0 package must exist under fixtures');
    const worktree = resolve(REPO_ROOT, '../minimalist-installer-integrity-remediation');
    assert.ok(existsSync(worktree), 'upstream worktree must exist');

    execFileSync('git', ['-C', worktree, 'cat-file', '-e', `${EXPECTED_BASE_SHA}^{commit}`]);

    const baseTree = execFileSync(
      'git',
      ['-C', worktree, 'ls-tree', '-r', '--name-only', EXPECTED_BASE_SHA, 'src'],
      { encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean).sort();

    const installedFiles = walkFiles(installedSrc)
      .map((f) => `src/${f.slice(installedSrc.length + 1).replace(/\\/g, '/')}`)
      .sort();
    assert.deepEqual(installedFiles, baseTree, 'vendored 0.1.0 src must match baseSha tree');

    for (const rel of baseTree) {
      const blob = execFileSync(
        'git',
        ['-C', worktree, 'show', `${EXPECTED_BASE_SHA}:${rel}`],
      );
      const disk = readFileSync(join(installedRoot, rel));
      assert.equal(
        createHash('sha256').update(blob).digest('hex'),
        createHash('sha256').update(disk).digest('hex'),
        `content mismatch for ${rel}`,
      );
    }
  });

  for (const name of REPROS) {
    it(`RED repro ${name} observes vulnerability on 0.1.0`, async () => {
      const mod = await import(pathToFileURL(join(FIXTURE_DIR, name)).href);
      const result = await mod.run();
      assert.equal(result.expectedVulnerableOn010, true);
      assert.equal(
        result.vulnerable,
        true,
        `${name} should observe vulnerable signature on 0.1.0, got ${JSON.stringify(result)}`,
      );
      assert.equal(typeof result.signature, 'string');
      assert.ok(result.signature.length > 0);
    });
  }
});
