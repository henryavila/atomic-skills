import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  classifyProviderLimitFailure,
  formatProviderLimitFailureMessage,
} from '../src/provider-limit-failure.js';

describe('classifyProviderLimitFailure — Claude session limit (dogfood)', () => {
  it('detects session limit banner even when exit code is 0', () => {
    const r = classifyProviderLimitFailure({
      provider: 'claude',
      exitCode: 0,
      stdout: "You've hit your session limit · resets 5:10pm (America/Sao_Paulo)\n",
      stderr: '',
    });
    assert.ok(r);
    assert.equal(r.kind, 'session-limit');
    assert.equal(r.doNotRetry, true);
    assert.equal(r.retryable, false);
    assert.match(r.resetsAt || '', /5:10pm/);
    assert.match(r.message, /session limit/i);
  });

  it('detects session limit on stderr too', () => {
    const r = classifyProviderLimitFailure({
      exitCode: 1,
      stdout: '',
      stderr: 'Error: session limit resets 9:00am UTC',
    });
    assert.ok(r);
    assert.equal(r.kind, 'session-limit');
  });

  it('does not false-positive a long review that mentions rate limits in findings', () => {
    const body = [
      '---',
      'verdict: needs_changes',
      'pass: blind',
      '---',
      '## Summary',
      'Review of auth rate limit middleware.',
      '## Findings',
      '### F-001 [major]',
      '**Claim:** The rate limit window is wrong',
      '**Impact:** users get 429 early',
      '**Recommendation:** fix the window',
      '**Confidence:** high',
      '**Evidence:**',
      '```',
      'rate limit = 100/min',
      '```',
      ...Array.from({ length: 80 }, (_, i) => `line ${i} of legitimate review body padding`),
    ].join('\n');
    const r = classifyProviderLimitFailure({
      exitCode: 0,
      stdout: body,
      stderr: '',
    });
    assert.equal(r, null);
  });

  it('classifies short rate-limit banners', () => {
    const r = classifyProviderLimitFailure({
      exitCode: 1,
      stdout: 'Rate limit reached. Try again later.',
      stderr: '',
    });
    assert.ok(r);
    assert.equal(r.kind, 'rate-limit');
    assert.equal(r.doNotRetry, true);
  });

  it('classifies auth failures', () => {
    const r = classifyProviderLimitFailure({
      exitCode: 1,
      stdout: '',
      stderr: 'Not logged in. Please run /login',
    });
    assert.ok(r);
    assert.equal(r.kind, 'auth');
  });

  it('returns null for empty / normal review stub', () => {
    assert.equal(
      classifyProviderLimitFailure({
        exitCode: 0,
        stdout: '---\nverdict: approve\npass: blind\n---\n## Summary\nok\n## Findings\n',
      }),
      null,
    );
    assert.equal(classifyProviderLimitFailure({}), null);
  });
});

describe('formatProviderLimitFailureMessage', () => {
  it('tells external-both to continue other legs', () => {
    const f = classifyProviderLimitFailure({
      exitCode: 0,
      stdout: "You've hit your session limit · resets 5:10pm (America/Sao_Paulo)",
    });
    const msg = formatProviderLimitFailureMessage(f, { mode: 'external-both' });
    assert.match(msg, /continue other legs/i);
  });

  it('lists alternate modes for single-provider abort', () => {
    const f = classifyProviderLimitFailure({
      exitCode: 0,
      stdout: "You've hit your session limit · resets 5:10pm (America/Sao_Paulo)",
    });
    const msg = formatProviderLimitFailureMessage(f, {
      mode: 'claude',
      alternateModes: ['codex'],
    });
    assert.match(msg, /--mode=codex/);
    assert.match(msg, /ABORT/i);
  });
});
