/**
 * F0/T-002 — save-and-push PR-only on default branch.
 * Asserts HARD-GATE refuse language, no "push directly" ask, and
 * origin/HEAD / shared default-branch asset reference.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'skills/core/save-and-push.md');
const DOCS = join(ROOT, 'docs/skills/save-and-push.md');
const CATALOG = join(ROOT, 'meta/catalog.yaml');

describe('save-and-push PR-only (F0/T-002)', () => {
  it('skill HARD-GATE refuses push on default and references origin/HEAD asset', () => {
    assert.ok(existsSync(SKILL), 'missing skills/core/save-and-push.md');
    const text = readFileSync(SKILL, 'utf8');

    assert.match(text, /<HARD-GATE>/);
    assert.match(text, /origin\/HEAD/);
    assert.match(text, /skills\/shared\/release-assets\/default-branch\.md/);
    assert.match(text, /Refuse/i);
    assert.match(text, /gh pr create/);

    assert.doesNotMatch(
      text,
      /Ask the user:\s*push directly/i,
      'must not ask to push directly to main/master',
    );
    assert.doesNotMatch(
      text,
      /push directly to main or create branch \+ PR\?/i,
      'legacy ask-before-push prompt must be gone',
    );
  });

  it('catalog pitches describe PR-only default-branch policy', () => {
    const catalog = readFileSync(CATALOG, 'utf8');
    const blockMatch = catalog.match(
      /save-and-push:[\s\S]*?(?=\n  [a-z0-9-]+:|\nproduct:|\nides:|\Z)/,
    );
    assert.ok(blockMatch, 'core.save-and-push block missing in catalog');
    const block = blockMatch[0];
    assert.match(block, /origin\/HEAD|default branch/i);
    assert.match(block, /PR|pull request/i);
    assert.doesNotMatch(block, /without explicit confirmation/i);
  });

  it('generated docs/skills/save-and-push.md matches PR-only catalog pitch', () => {
    assert.ok(existsSync(DOCS), 'missing docs/skills/save-and-push.md — run generate-skill-docs');
    const docs = readFileSync(DOCS, 'utf8');
    assert.match(docs, /origin\/HEAD|default branch/i);
    assert.match(docs, /PR|pull request/i);
    assert.doesNotMatch(docs, /without confirmation/i);
  });
});
