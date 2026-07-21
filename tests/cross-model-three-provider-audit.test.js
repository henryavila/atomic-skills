/**
 * Audit: codex / grok / claude stay wired as first-class external reviewers.
 * Contract + pure routing (no live CLI spawn).
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXTERNAL_PROVIDER_ORDER,
  externalBothLegs,
  resolveReviewRoute,
  isSameFamilyExternal,
  defaultExternalProvider,
} from '../src/cross-model-host-default.js';
import { PROVIDER_ENUM, normalizeProvider } from '../src/review-provider-field.js';
import {
  KNOWN_EXTERNAL_PROVIDERS,
  planEndReviewOk,
} from '../src/plan-end-review.js';
import { EXTERNAL_PROVIDER_ORDER as MERGE_ORDER } from '../src/external-both-merge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROVIDERS = ['codex', 'grok', 'claude'];

describe('three-provider external matrix (audit)', () => {
  it('EXTERNAL_PROVIDER_ORDER is codex → grok → claude on host + merge modules', () => {
    assert.deepEqual([...EXTERNAL_PROVIDER_ORDER], PROVIDERS);
    assert.deepEqual([...MERGE_ORDER], PROVIDERS);
    assert.deepEqual([...KNOWN_EXTERNAL_PROVIDERS].sort(), [...PROVIDERS].sort());
  });

  it('PROVIDER_ENUM includes all three externals + local', () => {
    for (const p of PROVIDERS) {
      assert.equal(normalizeProvider(p), p);
      assert.ok(PROVIDER_ENUM.includes(p));
    }
  });

  it('each provider has leaf assets (invocation + preflight)', () => {
    for (const p of PROVIDERS) {
      const inv = join(
        ROOT,
        `skills/shared/codex-bridge-assets/providers/${p}/invocation-canonical.txt`,
      );
      const pre = join(
        ROOT,
        `skills/shared/codex-bridge-assets/providers/${p}/preflight-checks.txt`,
      );
      assert.ok(existsSync(inv), `missing ${inv}`);
      assert.ok(existsSync(pre), `missing ${pre}`);
      assert.ok(readFileSync(inv, 'utf8').length > 50, `${p} invocation too thin`);
      assert.ok(readFileSync(pre, 'utf8').length > 20, `${p} preflight too thin`);
    }
  });

  it('external-both filters same-family host correctly for each host', () => {
    assert.deepEqual(externalBothLegs('claude'), ['codex', 'grok']);
    assert.deepEqual(externalBothLegs('codex'), ['grok', 'claude']);
    assert.deepEqual(externalBothLegs('grok'), ['codex', 'claude']);
    assert.equal(isSameFamilyExternal('claude', 'claude'), true);
    assert.equal(isSameFamilyExternal('claude', 'codex'), false);
  });

  it('resolveReviewRoute supports claude / both-claude / external-both', () => {
    const claudeOnly = resolveReviewRoute({
      hostFamily: 'grok',
      mode: 'claude',
      interactive: false,
    });
    assert.equal(claudeOnly.action, 'run');
    assert.equal(claudeOnly.externalProvider, 'claude');

    const bothClaude = resolveReviewRoute({
      hostFamily: 'codex',
      mode: 'both-claude',
      interactive: false,
    });
    assert.equal(bothClaude.action, 'run');
    assert.equal(bothClaude.includesLocal, true);
    assert.equal(bothClaude.externalProvider, 'claude');

    const ext = resolveReviewRoute({
      hostFamily: 'claude',
      mode: 'external-both',
      interactive: false,
    });
    assert.equal(ext.action, 'run');
    assert.ok(Array.isArray(ext.externalProviders));
    assert.deepEqual(ext.externalProviders, ['codex', 'grok']);
  });

  it('default external provider matrix is family-different', () => {
    assert.equal(defaultExternalProvider('claude'), 'codex');
    assert.equal(defaultExternalProvider('codex'), 'grok');
    assert.equal(defaultExternalProvider('grok'), 'codex');
  });

  it('planEndReviewOk accepts each provider as sole succeeded family-different leg', () => {
    const shape = (provider) => ({
      mode: 'external-both',
      reviewFile: '.atomic-skills/reviews/audit-plan-end.md',
      verifiedAt: '2026-07-21T00:00:00.000Z',
      legs: [{ provider, status: 'succeeded', familyDifferent: true }],
    });
    for (const p of PROVIDERS) {
      assert.equal(planEndReviewOk(shape(p)), true, `${p} leg must count`);
    }
    assert.equal(planEndReviewOk(shape('local')), false);
  });

  it('skill/envelope prose names all three providers', () => {
    const env = readFileSync(
      join(ROOT, 'skills/shared/codex-bridge-assets/envelope-orchestration.md'),
      'utf8',
    );
    const modeUx = readFileSync(
      join(ROOT, 'skills/shared/codex-bridge-assets/review-mode-ux.md'),
      'utf8',
    );
    for (const p of PROVIDERS) {
      assert.ok(env.includes(p), `envelope-orchestration must mention ${p}`);
      assert.ok(modeUx.includes(p), `review-mode-ux must mention ${p}`);
    }
    assert.ok(env.includes('codex → grok → claude') || env.includes('codex → grok → claude'.replace(/ /g, ' ')));
  });
});
