import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  HOST_EXTERNAL_DEFAULT,
  HOST_FAMILIES,
  acceptsSameFamilyAsLocal,
  defaultExternalProvider,
  detectHostFamily,
  externalProviderForMode,
  isSameFamilyExternal,
  normalizeHostFamily,
  resolveReviewRoute,
} from '../src/cross-model-host-default.js';

describe('normalizeHostFamily / detectHostFamily', () => {
  it('normalizes aliases', () => {
    assert.equal(normalizeHostFamily('claude-code'), 'claude');
    assert.equal(normalizeHostFamily('Grok'), 'grok');
    assert.equal(normalizeHostFamily('openai-codex'), 'codex');
    assert.equal(normalizeHostFamily(''), 'unknown');
    assert.equal(normalizeHostFamily('nope'), 'unknown');
  });

  it('prefers explicit host then ATOMIC_SKILLS_HOST then session signals', () => {
    assert.equal(
      detectHostFamily({ explicitHost: 'grok', env: { ATOMIC_SKILLS_HOST: 'codex' } }),
      'grok',
    );
    assert.equal(
      detectHostFamily({ env: { ATOMIC_SKILLS_HOST: 'cursor' } }),
      'cursor',
    );
    assert.equal(
      detectHostFamily({ env: { GROK_SESSION_ID: 'abc' } }),
      'grok',
    );
    assert.equal(
      detectHostFamily({ env: { CODEX_THREAD_ID: 't1' } }),
      'codex',
    );
    assert.equal(
      detectHostFamily({ env: { CLAUDECODE: '1' } }),
      'claude',
    );
    assert.equal(detectHostFamily({ env: {} }), 'unknown');
  });
});

describe('host → external default matrix (every host row)', () => {
  for (const host of HOST_FAMILIES) {
    it(`defaultExternalProvider(${host}) matches locked matrix`, () => {
      assert.equal(defaultExternalProvider(host), HOST_EXTERNAL_DEFAULT[host]);
      assert.ok(['codex', 'grok'].includes(defaultExternalProvider(host)));
    });
  }

  it('table is exactly the design D6 rows', () => {
    assert.deepEqual({ ...HOST_EXTERNAL_DEFAULT }, {
      grok: 'codex',
      codex: 'grok',
      claude: 'codex',
      cursor: 'codex',
      unknown: 'codex',
    });
  });
});

describe('isSameFamilyExternal', () => {
  it('flags only matching external families', () => {
    assert.equal(isSameFamilyExternal('grok', 'grok'), true);
    assert.equal(isSameFamilyExternal('codex', 'codex'), true);
    assert.equal(isSameFamilyExternal('grok', 'codex'), false);
    assert.equal(isSameFamilyExternal('claude', 'codex'), false);
    assert.equal(isSameFamilyExternal('claude', 'grok'), false);
    assert.equal(isSameFamilyExternal('grok', 'local'), false);
  });
});

describe('externalProviderForMode', () => {
  it('resolves modes against host default', () => {
    assert.equal(externalProviderForMode('local', 'claude'), null);
    assert.equal(externalProviderForMode('codex', 'grok'), 'codex');
    assert.equal(externalProviderForMode('grok', 'claude'), 'grok');
    assert.equal(externalProviderForMode('both', 'grok'), 'codex');
    assert.equal(externalProviderForMode('both', 'codex'), 'grok');
    assert.equal(externalProviderForMode('both', 'claude'), 'codex');
    assert.equal(externalProviderForMode('both-codex', 'codex'), 'codex');
    assert.equal(externalProviderForMode('both-grok', 'claude'), 'grok');
    assert.equal(externalProviderForMode('external-both', 'claude'), 'codex');
  });
});

describe('acceptsSameFamilyAsLocal', () => {
  it('honors flag and env', () => {
    assert.equal(acceptsSameFamilyAsLocal({ acceptSameFamilyAsLocal: true }), true);
    assert.equal(acceptsSameFamilyAsLocal({ env: { ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL: '1' } }), true);
    assert.equal(acceptsSameFamilyAsLocal({ env: { ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL: 'true' } }), true);
    assert.equal(acceptsSameFamilyAsLocal({ env: {} }), false);
  });
});

describe('resolveReviewRoute — happy paths per host matrix row', () => {
  for (const host of HOST_FAMILIES) {
    const expected = HOST_EXTERNAL_DEFAULT[host];
    it(`host ${host}: mode=both → external ${expected}`, () => {
      const r = resolveReviewRoute({ hostFamily: host, mode: 'both', interactive: false });
      assert.equal(r.action, 'run');
      assert.equal(r.externalProvider, expected);
      assert.equal(r.provider, expected);
      assert.equal(r.includesLocal, true);
      assert.equal(r.sameFamilyRemap, false);
    });

    it(`host ${host}: mode=${expected} → cross-family external`, () => {
      const r = resolveReviewRoute({ hostFamily: host, mode: expected, interactive: false });
      assert.equal(r.action, 'run');
      assert.equal(r.provider, expected);
      assert.equal(r.sameFamilyRemap, false);
    });
  }

  it('mode=local always runs local', () => {
    const r = resolveReviewRoute({ hostFamily: 'grok', mode: 'local' });
    assert.equal(r.action, 'run');
    assert.equal(r.provider, 'local');
    assert.equal(r.externalProvider, null);
  });

  it('external-both runs codex then grok legs', () => {
    const r = resolveReviewRoute({ hostFamily: 'claude', mode: 'external-both' });
    assert.equal(r.action, 'run');
    assert.deepEqual(r.externalProviders, ['codex', 'grok']);
  });
});

describe('resolveReviewRoute — same-family interactive', () => {
  it('pauses for confirm when interactive and same-family', () => {
    const r = resolveReviewRoute({
      hostFamily: 'grok',
      mode: 'grok',
      interactive: true,
    });
    assert.equal(r.action, 'confirm-same-family');
    assert.match(r.message, /same-family|local|cross-model/i);
    assert.equal(r.crossFamilyAlternative, 'codex');
  });

  it('confirm → local with sameFamilyRemap', () => {
    const r = resolveReviewRoute({
      hostFamily: 'grok',
      mode: 'grok',
      interactive: true,
      sameFamilyDecision: 'confirm',
    });
    assert.equal(r.action, 'run');
    assert.equal(r.provider, 'local');
    assert.equal(r.sameFamilyRemap, true);
    assert.equal(r.externalProvider, null);
  });

  it('decline → abort', () => {
    const r = resolveReviewRoute({
      hostFamily: 'codex',
      mode: 'codex',
      interactive: true,
      sameFamilyDecision: 'decline',
    });
    assert.equal(r.action, 'abort');
    assert.equal(r.crossFamilyAlternative, 'grok');
  });

  it('offer-cross-family → host default external', () => {
    const r = resolveReviewRoute({
      hostFamily: 'grok',
      mode: 'grok',
      interactive: true,
      sameFamilyDecision: 'offer-cross-family',
    });
    assert.equal(r.action, 'run');
    assert.equal(r.provider, 'codex');
    assert.equal(r.sameFamilyRemap, false);
  });
});

describe('resolveReviewRoute — same-family non-interactive', () => {
  it('HARD ABORT without accept flag', () => {
    const r = resolveReviewRoute({
      hostFamily: 'grok',
      mode: 'grok',
      interactive: false,
    });
    assert.equal(r.action, 'abort');
    assert.match(r.message, /HARD ABORT/);
    assert.match(r.message, /accept-same-family-as-local/);
    assert.equal(r.crossFamilyAlternative, 'codex');
  });

  it('HARD ABORT for codex-on-codex without flag', () => {
    const r = resolveReviewRoute({
      hostFamily: 'codex',
      mode: 'both-codex',
      interactive: false,
    });
    assert.equal(r.action, 'abort');
    assert.match(r.message, /HARD ABORT/);
    assert.equal(r.crossFamilyAlternative, 'grok');
  });

  it('--accept-same-family-as-local remaps to local', () => {
    const r = resolveReviewRoute({
      hostFamily: 'grok',
      mode: 'grok',
      interactive: false,
      acceptSameFamilyAsLocal: true,
    });
    assert.equal(r.action, 'run');
    assert.equal(r.provider, 'local');
    assert.equal(r.sameFamilyRemap, true);
  });

  it('env ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL=1 remaps to local', () => {
    const r = resolveReviewRoute({
      hostFamily: 'codex',
      mode: 'codex',
      interactive: false,
      env: { ATOMIC_SKILLS_ACCEPT_SAME_FAMILY_AS_LOCAL: '1' },
    });
    assert.equal(r.action, 'run');
    assert.equal(r.provider, 'local');
    assert.equal(r.sameFamilyRemap, true);
  });

  it('does not silent-remap without flag (claude requesting codex is fine)', () => {
    const r = resolveReviewRoute({
      hostFamily: 'claude',
      mode: 'codex',
      interactive: false,
    });
    assert.equal(r.action, 'run');
    assert.equal(r.provider, 'codex');
    assert.equal(r.sameFamilyRemap, false);
  });
});
