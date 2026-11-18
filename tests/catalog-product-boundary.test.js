/**
 * T-008 — Catalog product.what_is_not boundary: not a git-workflow replacement
 * AND agent-gate clarification for persistence/release skills.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'meta/catalog.yaml');
const README = join(ROOT, 'README.md');
const RELEASE_DOCS = join(ROOT, 'docs/skills/release.md');
const SAVE_DOCS = join(ROOT, 'docs/skills/save-and-push.md');

describe('catalog product.what_is_not boundary (T-008)', () => {
  it('keeps not-a-git-workflow-replacement and clarifies agent gates', () => {
    assert.ok(existsSync(CATALOG), 'missing meta/catalog.yaml');
    const catalog = parse(readFileSync(CATALOG, 'utf8'));
    const items = catalog?.product?.what_is_not;
    assert.ok(Array.isArray(items), 'product.what_is_not must be an array');
    const blob = items.join('\n');

    assert.match(
      blob,
      /not a replacement|replacement for your IDE, model, or git workflow|A replacement for your IDE, model, or git workflow/i,
      'must keep not-a-git-workflow-replacement clause',
    );
    assert.match(blob, /git workflow/i);

    assert.match(
      blob,
      /agent gates|impose agent gates|persistence and release skills impose/i,
      'must clarify persistence/release skills impose agent gates',
    );
    assert.match(blob, /PR-only/i);
    assert.match(blob, /stage\+2FA|stage\+2fa|stage\+2FA/i);
    assert.match(blob, /chooser/i);

    // Must not claim AS replaces the team's git workflow.
    assert.doesNotMatch(
      blob,
      /replaces (your|the) (team'?s )?git workflow|substitute for (your|the) git workflow/i,
    );

    // Install primary unchanged.
    assert.equal(
      catalog.product.install?.primary,
      'npx @henryavila/atomic-skills install',
    );

    // Host-tier honesty line still present.
    assert.ok(
      items.some((line) => /host adapter|day-to-day tested|Claude Code, Cursor, Codex, and Grok Build/i.test(line)),
      'must keep host-tier honesty line',
    );
  });

  it('README product region mirrors both what_is_not clauses', () => {
    assert.ok(existsSync(README), 'missing README.md');
    const readme = readFileSync(README, 'utf8');
    const region = readme.match(/\[PRODUCT_START\]: #[\s\S]*?\[PRODUCT_END\]: #/);
    assert.ok(region, 'README PRODUCT markers missing');
    const text = region[0];
    assert.match(text, /git workflow/i);
    assert.match(text, /PR-only/i);
    assert.match(text, /stage\+2FA|chooser/i);
    assert.match(text, /npx @henryavila\/atomic-skills install/);
  });

  it('release and save-and-push docs mention the shared contract', () => {
    assert.ok(existsSync(RELEASE_DOCS), 'missing docs/skills/release.md');
    assert.ok(existsSync(SAVE_DOCS), 'missing docs/skills/save-and-push.md');
    const release = readFileSync(RELEASE_DOCS, 'utf8');
    const save = readFileSync(SAVE_DOCS, 'utf8');

    assert.match(release, /shared (the )?release contract|release contract|release-assets/i);
    assert.match(release, /save-and-push/);
    assert.match(save, /shared (the )?release contract|release contract|release-assets/i);
    assert.match(save, /PR-only|default branch/i);
  });
});
