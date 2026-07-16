/**
 * F3/T-003 — provider field enum + round-trip for review receipts / last-review
 * writers and readers. Same-family remap never records codex|grok.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  PROVIDER_ENUM,
  buildProviderFields,
  countsAsCrossModel,
  hostDefaultExternalMode,
  parseProviderFields,
  parseReviewFileFrontmatter,
  roundTripProviderFields,
} from '../src/review-provider-field.js';
import { HOST_FAMILIES, defaultExternalProvider } from '../src/cross-model-host-default.js';

describe('PROVIDER_ENUM', () => {
  it('is exactly codex | grok | local', () => {
    assert.deepEqual([...PROVIDER_ENUM].sort(), ['codex', 'grok', 'local'].sort());
  });
});

describe('buildProviderFields (writer)', () => {
  it('writes external provider + version', () => {
    assert.deepEqual(
      buildProviderFields({ provider: 'codex', providerVersion: '0.50.0' }),
      { provider: 'codex', providerVersion: '0.50.0', sameFamilyRemap: false },
    );
    assert.deepEqual(
      buildProviderFields({ provider: 'grok', providerVersion: '0.2.101' }),
      { provider: 'grok', providerVersion: '0.2.101', sameFamilyRemap: false },
    );
  });

  it('same-family remap NEVER writes provider codex or grok', () => {
    for (const requested of ['codex', 'grok', 'CODEX', 'Grok']) {
      const fields = buildProviderFields({
        provider: requested,
        sameFamilyRemap: true,
        providerVersion: '9.9.9',
      });
      assert.equal(fields.provider, 'local');
      assert.equal(fields.sameFamilyRemap, true);
      assert.equal(fields.providerVersion, '');
      assert.notEqual(fields.provider, 'codex');
      assert.notEqual(fields.provider, 'grok');
    }
  });

  it('rejects unknown provider ids', () => {
    assert.throws(() => buildProviderFields({ provider: 'claude' }), /unknown provider/i);
    assert.throws(() => buildProviderFields({ provider: '' }), /unknown provider/i);
  });
});

describe('parseProviderFields (reader)', () => {
  it('reads provider + providerVersion (camelCase and snake_case)', () => {
    assert.deepEqual(parseProviderFields({ provider: 'grok', providerVersion: '1.0' }), {
      provider: 'grok',
      providerVersion: '1.0',
      sameFamilyRemap: false,
    });
    assert.deepEqual(parseProviderFields({ provider: 'local', provider_version: '', sameFamilyRemap: true }), {
      provider: 'local',
      providerVersion: '',
      sameFamilyRemap: true,
    });
  });

  it('legacy codex_version without provider → provider codex', () => {
    assert.deepEqual(parseProviderFields({ codex_version: '0.40.0' }), {
      provider: 'codex',
      providerVersion: '0.40.0',
      sameFamilyRemap: false,
    });
  });

  it('missing provider leaves null (caller decides default)', () => {
    assert.deepEqual(parseProviderFields({}), {
      provider: null,
      providerVersion: '',
      sameFamilyRemap: false,
    });
  });
});

describe('round-trip', () => {
  it('writer → reader preserves enum + version + remap flag', () => {
    for (const provider of PROVIDER_ENUM) {
      const written = buildProviderFields({
        provider: provider === 'local' ? 'local' : provider,
        sameFamilyRemap: provider === 'local' ? false : false,
        providerVersion: provider === 'local' ? '' : '1.2.3',
      });
      const read = parseProviderFields(written);
      assert.deepEqual(read, written);
      assert.deepEqual(roundTripProviderFields(written), written);
    }
    // remap path
    const remapped = buildProviderFields({ provider: 'grok', sameFamilyRemap: true });
    assert.deepEqual(parseProviderFields(remapped), {
      provider: 'local',
      providerVersion: '',
      sameFamilyRemap: true,
    });
  });

  it('YAML-style review file frontmatter round-trips via parseReviewFileFrontmatter', () => {
    const fields = buildProviderFields({ provider: 'codex', providerVersion: '0.50.0' });
    const md = `---
date: 2026-07-16T15:00:00Z
provider: ${fields.provider}
provider_version: ${fields.providerVersion}
final_verdict: approve
---

# body
`;
    const parsed = parseReviewFileFrontmatter(md);
    assert.equal(parsed.provider, 'codex');
    assert.equal(parsed.providerVersion, '0.50.0');
  });
});

describe('hostDefaultExternalMode (review-due / create-plan flags)', () => {
  it('matches host external default matrix for every host family', () => {
    for (const host of HOST_FAMILIES) {
      const mode = hostDefaultExternalMode(host);
      assert.equal(mode, defaultExternalProvider(host));
      assert.ok(PROVIDER_ENUM.includes(mode));
      assert.notEqual(mode, 'local');
    }
  });
});

describe('countsAsCrossModel', () => {
  it('true only for family-different external provider when hostFamily is known', () => {
    assert.equal(countsAsCrossModel({ provider: 'codex', hostFamily: 'claude' }), true);
    assert.equal(countsAsCrossModel({ provider: 'grok', hostFamily: 'codex' }), true);
    assert.equal(countsAsCrossModel({ provider: 'codex', hostFamily: 'codex' }), false);
    assert.equal(countsAsCrossModel({ provider: 'grok', hostFamily: 'grok' }), false);
    assert.equal(countsAsCrossModel({ provider: 'local', hostFamily: 'claude' }), false);
    assert.equal(
      countsAsCrossModel({ provider: 'local', sameFamilyRemap: true, hostFamily: 'grok' }),
      false,
    );
  });

  it('fail closed without hostFamily (does not advance cadence)', () => {
    assert.equal(countsAsCrossModel({ provider: 'codex' }), false);
    assert.equal(countsAsCrossModel({ provider: 'grok' }), false);
    assert.equal(countsAsCrossModel({ provider: 'codex', hostFamily: '' }), false);
    assert.equal(countsAsCrossModel({ provider: 'codex', hostFamily: null }), false);
  });
});
