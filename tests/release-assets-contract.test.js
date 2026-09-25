/**
 * F0/T-001 — Shared release-assets contract.
 * Asserts default-branch + conventional-commits helpers exist and carry
 * the origin/HEAD + feat: markers required by acceptance.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BRANCH = join(ROOT, 'skills/shared/release-assets/default-branch.md');
const CONVENTIONAL = join(ROOT, 'skills/shared/release-assets/conventional-commits.md');

describe('release-assets contract (F0/T-001)', () => {
  it('ships default-branch.md with origin/HEAD resolution', () => {
    assert.ok(existsSync(DEFAULT_BRANCH), 'missing skills/shared/release-assets/default-branch.md');
    const text = readFileSync(DEFAULT_BRANCH, 'utf8');
    assert.match(text, /origin\/HEAD/);
    assert.match(text, /symbolic-ref\s+refs\/remotes\/origin\/HEAD/);
    assert.match(text, /refs\/remotes\/origin\//);
    assert.match(text, /release\/stable/);
    assert.doesNotMatch(text, /basename after the last/);
    assert.match(text, /main/);
    assert.match(text, /master/);
  });

  it('ships conventional-commits.md with feat: mapping', () => {
    assert.ok(existsSync(CONVENTIONAL), 'missing skills/shared/release-assets/conventional-commits.md');
    const text = readFileSync(CONVENTIONAL, 'utf8');
    assert.match(text, /feat:/);
    assert.match(text, /fix:/);
    assert.match(text, /perf:/);
    assert.match(text, /breaking/i);
  });
});
